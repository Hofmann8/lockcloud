"""/api/admin：用户列表（只读，账号管理在 LockAuth）、统计、媒体处理失败和重跑。都要管理员（403 ADMIN_001）。"""
import logging
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from auth.models import User
from constants.activity_types import display_name_for
from database import get_db, paginate
from deps import Body, admin_only, arg, body
from errors import ApiError, guarded, json_response
from files.models import INCLUDE_DELETED, File
from routers.files import with_display
from services import fc_jobs, media
from services.storage import is_file_key

log = logging.getLogger(__name__)

router = APIRouter(prefix='/api/admin')

# 媒体 FC 的视频步骤，和 fc/media/handler.py 的 VIDEO_STEPS 一致
VIDEO_STEPS = ('transcode', 'sprite', 'frames', 'beats')
MAX_REPROCESS = 200
GROWTH_MONTHS = 24


@router.get('/users')
@guarded('获取用户列表失败')
def list_users(request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    page = arg(request, 'page', 1, type=int)
    per_page = arg(request, 'per_page', 50, type=int)
    if page < 1:
        page = 1
    if per_page < 1 or per_page > 100:
        per_page = 50
    pagination = paginate(db.query(User).order_by(User.created_at.desc()), page, per_page)
    return json_response({'success': True, 'users': [u.to_dict() for u in pagination.items],
                          'pagination': pagination.meta()})


# ---------------------------------------------------------------- 统计


def _months(now: datetime, n: int) -> list:
    y, m = now.year, now.month
    out = []
    for _ in range(n):
        out.append(f'{y:04d}-{m:02d}')
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    return out[::-1]


def _pipeline(rows, done=('ok',)) -> dict:
    """[(状态, 数量)] → {pending, done, failed}；skipped_* 之类不算。"""
    out = {'pending': 0, 'done': 0, 'failed': 0}
    for status, n in rows:
        if status == 'pending':
            out['pending'] += n
        elif status in done:
            out['done'] += n
        elif status == 'failed':
            out['failed'] += n
    return out


def _merge(*parts: dict) -> dict:
    return {k: sum(p[k] for p in parts) for k in ('pending', 'done', 'failed')}


@router.get('/stats')
@guarded('获取统计失败')
def stats(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    """存储、增长（最近 24 个月）、各活动类型、处理流水线、回收站、用户。回收站里的文件只算在 trash 里。"""
    is_image = File.content_type.like('image/%')
    is_video = File.content_type.like('video/%')
    total_bytes, total_files = db.query(func.coalesce(func.sum(File.size), 0), func.count(File.id)).one()
    images = db.query(func.count(File.id)).filter(is_image).scalar()
    videos = db.query(func.count(File.id)).filter(is_video).scalar()

    now = datetime.utcnow()
    months = _months(now, GROWTH_MONTHS)
    month = func.strftime('%Y-%m', File.uploaded_at)
    by_month = {m: (n, b) for m, n, b in db.query(month, func.count(File.id), func.coalesce(func.sum(File.size), 0))
                .filter(File.uploaded_at >= datetime.strptime(months[0] + '-01', '%Y-%m-%d')).group_by(month).all()}
    growth = [{'month': m, 'files': by_month.get(m, (0, 0))[0], 'bytes': int(by_month.get(m, (0, 0))[1])}
              for m in months]

    types = defaultdict(lambda: {'files': 0, 'activities': 0})
    for activity_type, activity_date, _, n in db.query(
            File.activity_type, File.activity_date, File.activity_name, func.count(File.id)).group_by(
            File.activity_type, File.activity_date, File.activity_name).all():
        types[activity_type]['files'] += n
        if activity_date:
            types[activity_type]['activities'] += 1
    by_type = sorted(({'activity_type': t, 'display': display_name_for(t), **v} for t, v in types.items()),
                     key=lambda x: -x['files'])

    media_counts = {'pending': 0, 'ready': 0, 'failed': 0, 'skipped': 0}
    for status, n in db.query(File.media_status, func.count(File.id)).group_by(File.media_status).all():
        media_counts[status] = media_counts.get(status, 0) + n
    # 视频只算已经抽过帧的（media.json 里有 frames）
    has_frames = func.json_extract(File.media_info, '$.frames').isnot(None)
    videos_with_frames = db.query(File).filter(is_video, File.media_status == 'ready', has_frames)
    embedding = _merge(
        _pipeline(db.query(File.embedding_status, func.count(File.id)).filter(is_image)
                  .group_by(File.embedding_status).all()),
        _pipeline(videos_with_frames.with_entities(File.frame_embedding_status, func.count(File.id))
                  .group_by(File.frame_embedding_status).all()))
    faces = _merge(
        _pipeline(db.query(File.face_status, func.count(File.id)).filter(is_image)
                  .group_by(File.face_status).all(), done=('ok', 'no_face')),
        _pipeline(videos_with_frames.with_entities(File.frame_face_status, func.count(File.id))
                  .group_by(File.frame_face_status).all(), done=('ok', 'no_face')))
    persons, named = db.execute(text(
        "SELECT COUNT(*), COUNT(rp.name) FROM persons p LEFT JOIN real_people rp ON p.real_person_id = rp.id "
        "WHERE p.face_count >= 1")).one()

    trash_files, trash_bytes = db.query(func.count(File.id), func.coalesce(func.sum(File.size), 0)).execution_options(
        **INCLUDE_DELETED).filter(File.deleted_at.isnot(None)).one()
    users_total = db.query(func.count(User.id)).scalar()
    active = db.query(func.count(User.id)).filter(User.last_login >= now - timedelta(days=30)).scalar()

    return json_response({
        'storage': {'bytes': int(total_bytes), 'files': total_files, 'images': images, 'videos': videos,
                    'others': total_files - images - videos},
        'growth': growth,
        'by_type': by_type,
        'pipeline': {'media': media_counts, 'embedding': embedding, 'faces': faces,
                     'persons': int(persons), 'named_persons': int(named)},
        'trash': {'files': trash_files, 'bytes': int(trash_bytes)},
        'users': {'total': users_total, 'active_30d': active},
    })


# ---------------------------------------------------------------- 媒体处理


@router.get('/media/failures')
@guarded('获取处理失败列表失败')
def media_failures(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    """处理失败（media_status=failed）或有步骤失败（media.json 的 errors）的文件，新传的在前，最多 500 个。"""
    rows = db.query(File).filter(or_(File.media_status == 'failed', File.media_info.like('%"errors"%'))).order_by(
        File.uploaded_at.desc()).limit(500).all()
    out = []
    for f in rows:
        info = media.media_info(f)
        errors = info.get('errors') or {}
        if f.media_status != 'failed' and not errors:
            continue
        out.append({'file': with_display(f), 'status': f.media_status, 'error': info.get('error'), 'errors': errors})
    return json_response({'files': out})


@router.post('/media/reprocess')
@guarded('提交重跑失败')
def media_reprocess(admin: User = Depends(admin_only), payload: Body = Depends(body), db: Session = Depends(get_db)):
    """异步调媒体 FC（/jobs/process）。steps 省略就全跑（图片也行）；给了 steps 只对视频有效。"""
    data = payload.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    ids = data.get('file_ids')
    if not isinstance(ids, list) or not ids or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
        raise ApiError('VALIDATION_001', 'file_ids 必须是非空的整数数组')
    ids = list(dict.fromkeys(ids))
    if len(ids) > MAX_REPROCESS:
        raise ApiError('VALIDATION_001', f'一次最多 {MAX_REPROCESS} 个文件')
    steps = data.get('steps')
    if steps is not None and (not isinstance(steps, list) or not steps or not set(steps) <= set(VIDEO_STEPS)):
        raise ApiError('VALIDATION_001', f'steps 只能是 {", ".join(VIDEO_STEPS)} 里的')

    queued, skipped = [], []
    files = {f.id: f for f in db.query(File).filter(File.id.in_(ids)).all()}
    for fid in ids:
        f = files.get(fid)
        reason = None
        if not f:
            reason = '文件不存在'
        elif steps and not media.is_video(f):
            reason = '不是视频'
        elif not (media.is_video(f) or media.is_image(f)):
            reason = '不是图片或视频'
        elif not is_file_key(f.s3_key):
            reason = '老路径的文件，媒体 FC 处理不了'
        if reason:
            skipped.append({'file_id': fid, 'reason': reason})
            continue
        body_ = {'key': f.s3_key, **({'steps': steps} if steps else {})}
        try:
            fc_jobs.invoke('/jobs/process', body_)
            queued.append(fid)
        except Exception as e:
            log.error(f'reprocess {fid}: media FC invoke failed: {e}')
            skipped.append({'file_id': fid, 'reason': '处理服务暂不可用'})
    return json_response({'queued': queued, 'skipped': skipped})
