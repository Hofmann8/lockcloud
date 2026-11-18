"""/api/activities：资料库首页的活动卡片。一个活动 = 同一 (activity_date, activity_type, activity_name)。

没有活动日期的文件不算活动（用 /api/files 看）。owner 是活动里最早上传的人，和 /api/files/activity-directory 一致。
"""
from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, Request
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from auth.models import User
from constants.activity_types import display_name_for
from database import get_db, paginate
from deps import arg, jwt_identity
from errors import ApiError, guarded, json_response
from files.models import File
from services import media

router = APIRouter(prefix='/api/activities')

MAX_COVERS = 4


def _key(f: File) -> tuple:
    return f.activity_date, f.activity_type, f.activity_name


def display_dims(f: File) -> tuple:
    """转正后的显示宽高：图片 EXIF 方向 5-8 要对调；视频的宽高本来就是转正的。"""
    info = media.media_info(f)
    if media.is_video(f):
        return info.get('width'), info.get('height')
    w, h = f.raw_w or info.get('width'), f.raw_h or info.get('height')
    if int(f.orientation or 1) >= 5:
        w, h = h, w
    return w, h


def _time_key(f: File) -> tuple:
    return f.taken_at is None, f.taken_at or '', f.uploaded_at


def _spread(items: list, n: int) -> list:
    """按时间均匀取 n 个。"""
    if n <= 0:
        return []
    if len(items) <= n:
        return list(items)
    if n == 1:
        return [items[len(items) // 2]]
    return [items[round(i * (len(items) - 1) / (n - 1))] for i in range(n)]


def pick_covers(files: list) -> list:
    """最多 4 个：优先横图和视频，按拍摄时间均匀取，不够再用竖图补。"""
    cands = sorted((f for f in files if media.is_image(f) or media.is_video(f)), key=_time_key)

    def preferred(f):
        if media.is_video(f):
            return True
        w, h = display_dims(f)
        return bool(w and h and w > h)

    chosen = _spread([f for f in cands if preferred(f)], MAX_COVERS)
    if len(chosen) < MAX_COVERS:
        ids = {f.id for f in chosen}
        chosen += _spread([f for f in cands if f.id not in ids], MAX_COVERS - len(chosen))
    chosen.sort(key=_time_key)
    out = []
    for f in chosen:
        w, h = display_dims(f)
        out.append({'id': f.id, 'thumbhash': f.thumbhash, 'is_video': media.is_video(f), 'width': w, 'height': h})
    return out


def activity_card(files: list, users: dict) -> dict:
    first = min(files, key=lambda f: f.uploaded_at)
    owner = users.get(first.uploader_id)
    taken = sorted(f.taken_at for f in files if f.taken_at)
    activity_date, activity_type, activity_name = _key(first)
    return {
        'activity_date': activity_date.isoformat(),
        'activity_type': activity_type,
        'activity_type_display': display_name_for(activity_type),
        'activity_name': activity_name,
        'file_count': len(files),
        'image_count': sum(1 for f in files if media.is_image(f)),
        'video_count': sum(1 for f in files if media.is_video(f)),
        'audio_count': sum(1 for f in files if media.is_audio(f)),
        'duration': round(sum(float(media.media_info(f).get('duration') or 0) for f in files if media.is_video(f)), 3),
        'owner': {'id': owner.id, 'name': owner.name} if owner else None,
        'covers': pick_covers(files),
        'taken_from': taken[0] if taken else None,
        'taken_to': taken[-1] if taken else None,
        'updated_at': max(f.uploaded_at for f in files).isoformat(),
    }


@router.get('')
@guarded('获取活动失败，请稍后重试')
def list_activities(request: Request, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """筛选：year、month（要和 year 一起）、activity_type、media_type（只要含这类文件的活动）、q（活动名包含）。

    按活动日期倒序。years 是去掉 year / month 之后每年的活动数，给时间轴用。
    """
    int(identity)
    year = arg(request, 'year', type=int)
    month = arg(request, 'month', type=int)
    activity_type = arg(request, 'activity_type', '').strip()
    media_type = arg(request, 'media_type', '').strip().lower()
    q = arg(request, 'q', '').strip()
    page = max(1, arg(request, 'page', 1, type=int))
    per_page = arg(request, 'per_page', 30, type=int)
    per_page = per_page if 1 <= per_page <= 100 else (100 if per_page > 100 else 30)
    if media_type not in ('', 'all', 'image', 'video'):
        raise ApiError('VALIDATION_001', 'media_type 只能是 image、video、all')

    base = db.query(File).filter(File.activity_date.isnot(None))
    if activity_type:
        base = base.filter(File.activity_type == activity_type)
    if q:
        base = base.filter(File.activity_name.ilike(f'%{q}%'))
    if media_type in ('image', 'video'):
        base = base.filter(File.content_type.like(f'{media_type}/%'))
    keys = (File.activity_date, File.activity_type, File.activity_name)

    years = Counter(d.year for d, _, _ in base.with_entities(*keys).distinct().all())

    scoped = base
    if year:
        scoped = scoped.filter(extract('year', File.activity_date) == year)
        if month:
            scoped = scoped.filter(extract('month', File.activity_date) == month)
    groups = scoped.with_entities(*keys).group_by(*keys).order_by(
        File.activity_date.desc(), func.max(File.uploaded_at).desc(), File.activity_type, File.activity_name)
    pagination = paginate(groups, page, per_page)

    wanted = [tuple(row) for row in pagination.items]
    by_key = defaultdict(list)
    if wanted:
        # 卡片上的数量、封面、owner 按整个活动算（不受 media_type 影响）
        for f in db.query(File).filter(File.activity_date.in_({k[0] for k in wanted})).all():
            by_key[_key(f)].append(f)
    uploader_ids = {f.uploader_id for fs in by_key.values() for f in fs}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(uploader_ids)).all()} if uploader_ids else {}
    activities = [activity_card(by_key[k], users) for k in wanted if by_key.get(k)]
    return json_response({
        'activities': activities,
        'pagination': pagination.meta(),
        'years': [{'year': y, 'count': n} for y, n in sorted(years.items(), reverse=True)],
    })
