"""/api/search：统一搜索（照片 + 视频片段 + "你是不是要找"）。旧的 /api/files/ai-search 保留。

- photos：文本 embedding → image_embeddings KNN；
- segments：→ video_frame_embeddings KNN（抽帧由 scripts/embed_worker.py 入库），同一视频里相邻命中帧
  （间隔 ≤ 4 秒）合成一段，at 是最像的那帧；
- 只留相关的：照片和帧都要过 services/search_gate.py 的那条线，库里没有的东西搜出来就是空的，
  不拿"最像的前几十个"充数；
- matches：名字精确或前缀命中的人物、标签、活动；
- 只给条件没有 q：photos 放符合条件的文件（按拍摄时间倒序，score 为 null），segments 为空。

向量表是 L2 距离、向量归一化过。score 是"比一般搜索词多像多少"（见 search_gate），没有参照向量时退回余弦相似度
1 - d²/2、不卡线。回收站里的文件一律跳过。
每分钟 30 次（ratelimit.py）。
"""
import logging
import time
from collections import defaultdict
from datetime import datetime

import sqlite_vec
from fastapi import APIRouter, Depends
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from constants.activity_types import ACTIVITY_TYPE_VALUES
from database import get_db
from deps import Body, body, jwt_identity
from errors import ApiError, json_response
from files.models import File, FileTag, Tag
from routers.files import with_display
from routers.people import _person_thumb_url
from services import media, search_gate
from services.embedding_service import EmbeddingClient, EmbeddingConfigError
from services.storage import derived_key, is_file_key, storage
from services.tag_service import tag_service

router = APIRouter(prefix='/api/search')
log = logging.getLogger(__name__)

DEFAULT_LIMIT = 40
MAX_LIMIT = 100
MATCH_LIMIT = 5
SEGMENT_GAP = 4.0      # 相邻命中帧间隔 ≤ 4 秒合成一段
FRAME_INTERVAL = 2.0   # media.json 里没写时的抽帧间隔
KNN_MAX = 4096         # sqlite-vec 的 k 上限
URL_SECONDS = 3600


def _score(probe, distance: float) -> float:
    return round(max(0.0, min(1.0, probe.score(distance))), 4)


def _relevant(probe, rows: list, fallback: int) -> list:
    """KNN 结果（按距离升序，最后一列是距离）里相关的那些。没有参照向量时只能取最像的前 fallback 个。"""
    if probe.floor is None:
        return rows[:fallback]
    for i, row in enumerate(rows):
        if probe.score(row[-1]) < probe.floor:
            return rows[:i]
    return rows


# ---------------------------------------------------------------- 条件


def _date(value, name):
    try:
        return datetime.fromisoformat(str(value)).date()
    except ValueError:
        raise ApiError('VALIDATION_001', f'{name} 日期格式无效，请使用 YYYY-MM-DD')


def _person_file_ids(db: Session, person_ids: list) -> set:
    """这些人都出现过的文件（同时出现）。同一个真人链着的几个 cluster 算一个人。"""
    result = None
    for pid in person_ids:
        rows = db.execute(text(
            "SELECT id FROM persons WHERE id = :pid OR (real_person_id IS NOT NULL AND real_person_id = "
            "(SELECT real_person_id FROM persons WHERE id = :pid))"), {'pid': pid}).all()
        clusters = {int(r[0]) for r in rows} or {pid}
        files = set()
        for cid in clusters:
            files |= {int(r[0]) for r in db.execute(
                text("SELECT DISTINCT file_id FROM faces WHERE person_id = :p"), {'p': cid}).all()}
        result = files if result is None else result & files
    return result or set()


def _filtered(db: Session, filters: dict):
    """条件 → File 查询（已经去掉回收站）。返回 (query, media_type, 有没有有效条件)。

    person_ids 是"这些人同时出现"，tags 是"带任一标签"（和 /api/files 的 tags 一样）。
    """
    query = db.query(File)
    active = False
    activity_type = (filters.get('activity_type') or '').strip() if isinstance(filters.get('activity_type'), str) else ''
    if activity_type:
        if activity_type not in ACTIVITY_TYPE_VALUES:
            raise ApiError('VALIDATION_001', '活动类型无效')
        query = query.filter(File.activity_type == activity_type)
        active = True
    if filters.get('date_from'):
        query = query.filter(File.activity_date >= _date(filters['date_from'], 'date_from'))
        active = True
    if filters.get('date_to'):
        query = query.filter(File.activity_date <= _date(filters['date_to'], 'date_to'))
        active = True
    person_ids = filters.get('person_ids') or []
    if person_ids:
        if not isinstance(person_ids, list) or not all(isinstance(p, int) and not isinstance(p, bool)
                                                       for p in person_ids):
            raise ApiError('VALIDATION_001', 'person_ids 必须是整数数组')
        query = query.filter(File.id.in_(_person_file_ids(db, person_ids)))
        active = True
    tags = [t.strip() for t in (filters.get('tags') or []) if isinstance(t, str) and t.strip()]
    if tags:
        query = query.filter(File.id.in_(
            db.query(FileTag.file_id).join(Tag, FileTag.tag_id == Tag.id).filter(Tag.name.in_(tags))))
        active = True
    raw = filters.get('media_type') or 'all'
    media_type = raw.strip().lower() if isinstance(raw, str) else ''
    if media_type not in ('all', 'image', 'video'):
        raise ApiError('VALIDATION_001', 'media_type 只能是 all、image、video')
    if media_type != 'all':
        query = query.filter(File.content_type.like(f'{media_type}/%'))
        active = True
    return query, media_type, active


# ---------------------------------------------------------------- 你是不是要找


def _match_people(db: Session, q: str) -> list:
    rows = db.execute(text(
        "SELECT rp.id, rp.name FROM real_people rp WHERE rp.name IS NOT NULL "
        "AND lower(substr(rp.name, 1, :n)) = lower(:q)"), {'n': len(q), 'q': q}).all()
    out = []
    for rid, name in rows:
        clusters = db.execute(text(
            "SELECT p.id, p.face_count, fi.id, fi.s3_key, fi.raw_w, fi.raw_h, fi.orientation, "
            "       f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h, f.frame_id, fi.media_info "
            "FROM persons p LEFT JOIN faces f ON p.cover_face_id = f.face_id "
            "LEFT JOIN files fi ON f.file_id = fi.id "
            "WHERE p.real_person_id = :rid AND p.face_count >= 1 ORDER BY p.face_count DESC"), {'rid': rid}).all()
        if not clusters:
            continue
        top = clusters[0]
        bbox = (top[7], top[8], top[9], top[10]) if top[7] is not None else None
        out.append({
            'id': int(top[0]), 'name': name, 'face_count': sum(int(c[1]) for c in clusters),
            'thumb_url': _person_thumb_url((top[2], top[3], top[4], top[5], top[6], top[12]), bbox, frame_id=top[11])
            if bbox and top[3] else None,
        })
    out.sort(key=lambda p: (p['name'].lower() != q.lower(), -p['face_count']))
    return out[:MATCH_LIMIT]


def _match_tags(db: Session, q: str) -> list:
    tags = [t for t in tag_service.search_tags(db, q, 20) if t.count > 0]
    tags.sort(key=lambda t: (t.name.lower() != q.lower(), -t.count))
    return [{'id': t.id, 'name': t.name, 'count': t.count} for t in tags[:MATCH_LIMIT]]


def _match_activities(db: Session, q: str) -> list:
    rows = db.query(File.activity_date, File.activity_type, File.activity_name, func.count(File.id)).filter(
        File.activity_date.isnot(None), File.activity_name.isnot(None),
        func.lower(func.substr(File.activity_name, 1, len(q))) == q.lower(),
    ).group_by(File.activity_date, File.activity_type, File.activity_name).all()
    rows.sort(key=lambda r: (r[2].lower() != q.lower(), -r[0].toordinal()))
    return [{'activity_date': d.isoformat(), 'activity_type': t, 'activity_name': n, 'file_count': c}
            for d, t, n, c in rows[:MATCH_LIMIT]]


# ---------------------------------------------------------------- 向量


def _knn(db: Session, sql: str, vector, k: int):
    try:
        return db.execute(text(sql), {'vec': sqlite_vec.serialize_float32(vector), 'k': k}).all()
    except Exception as e:
        log.error(f'search vec0 query failed: {e}')
        raise ApiError('SEARCH_003', '搜索失败，请稍后再试', 500)


def _photos(db: Session, query, probe, limit: int) -> list:
    rows = _knn(db, "SELECT file_id, distance FROM image_embeddings WHERE embedding MATCH :vec AND k = :k "
                    "ORDER BY distance", probe.vector, KNN_MAX)
    step = max(limit * 10, 200)
    rows = _relevant(probe, rows, step)
    out = []
    for i in range(0, len(rows), step):     # 一批一批查文件：没有筛选条件时第一批就够了
        chunk = rows[i:i + step]
        allowed = {f.id: f for f in query.filter(File.id.in_([int(r[0]) for r in chunk]),
                                                 File.content_type.like('image/%')).all()}
        for fid, dist in chunk:
            f = allowed.get(int(fid))
            if f is not None:
                out.append({'file': with_display(f), 'score': _score(probe, dist)})
            if len(out) >= limit:
                return out
    return out


def _merge_hits(hits: list, interval: float, duration) -> list:
    """一个视频里的命中帧 [(秒, score)] → 段。间隔 ≤ 4 秒的连成一段，段尾是最后一帧再加一个抽帧间隔。"""
    hits.sort()
    segments, cur = [], None
    for t, score in hits:
        if cur and t - cur['last'] <= SEGMENT_GAP:
            cur['last'] = t
            if score > cur['score']:
                cur['score'], cur['at'] = score, t
        else:
            cur = {'start': t, 'last': t, 'at': t, 'score': score}
            segments.append(cur)
    for s in segments:
        end = s.pop('last') + interval
        s['end'] = round(min(end, float(duration)) if duration else end, 3)
    return segments


def _segments(db: Session, query, probe, limit: int) -> list:
    rows = _knn(db, "SELECT frame_id, file_id, timestamp_ms, distance FROM video_frame_embeddings "
                    "WHERE embedding MATCH :vec AND k = :k ORDER BY distance", probe.vector, KNN_MAX)
    rows = _relevant(probe, rows, max(limit * 20, 400))
    ids = list({int(r[1]) for r in rows})
    allowed = {f.id: f for f in query.filter(File.id.in_(ids), File.content_type.like('video/%')).all()} if ids else {}
    hits = defaultdict(list)
    for _, fid, ts, dist in rows:
        if int(fid) in allowed:
            hits[int(fid)].append((int(ts) / 1000.0, _score(probe, dist)))
    out = []
    for fid, file_hits in hits.items():
        f = allowed[fid]
        info = media.media_info(f)
        interval = float((info.get('frames') or {}).get('interval') or FRAME_INTERVAL)
        file_json = with_display(f)
        for seg in _merge_hits(file_hits, interval, info.get('duration')):
            index = int(round(seg['at'] / interval))
            frame_url = (storage.sign_get(derived_key(f.s3_key, f'frames/{index:05d}.jpg'), URL_SECONDS)
                         if is_file_key(f.s3_key) else None)
            out.append({'file': file_json, 'start': seg['start'], 'end': seg['end'], 'at': seg['at'],
                        'frame_url': frame_url, 'score': seg['score']})
    out.sort(key=lambda s: -s['score'])
    return out[:limit]


# ---------------------------------------------------------------- 接口


@router.post('')
def search(identity: str = Depends(jwt_identity), payload: Body = Depends(body), db: Session = Depends(get_db)):
    int(identity)
    data = payload.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    q = data.get('q') if isinstance(data.get('q'), str) else ''
    q = q.strip()
    filters = data.get('filters') or {}
    if not isinstance(filters, dict):
        raise ApiError('VALIDATION_001', 'filters 必须是对象')
    try:
        limit = max(1, min(int(data.get('limit') or DEFAULT_LIMIT), MAX_LIMIT))
    except (TypeError, ValueError):
        raise ApiError('VALIDATION_001', 'limit 必须是整数')

    t0 = time.monotonic()
    query, media_type, active = _filtered(db, filters)
    if not q and not active:
        raise ApiError('VALIDATION_001', '请输入搜索内容或筛选条件')

    matches = {'people': [], 'tags': [], 'activities': []}
    photos, segments = [], []
    if q:
        try:
            client = EmbeddingClient.from_env()
        except EmbeddingConfigError as e:
            log.error(f'search embedding not configured: {e}')
            raise ApiError('SEARCH_001', '搜索暂不可用', 503)
        try:
            vector = client.embed_text(q).vector
        except Exception as e:
            log.error(f'search embed text failed: {e}')
            raise ApiError('SEARCH_002', '搜索暂不可用，请稍后再试', 502)
        matches = {'people': _match_people(db, q), 'tags': _match_tags(db, q),
                   'activities': _match_activities(db, q)}
        probe = search_gate.probe(vector, getattr(client, 'model', None))
        if media_type != 'video':
            photos = _photos(db, query, probe, limit)
        if media_type != 'image':
            segments = _segments(db, query, probe, limit)
    else:
        files = query.order_by(File.taken_at.is_(None), File.taken_at.desc(), File.uploaded_at.desc()).limit(
            limit).all()
        photos = [{'file': with_display(f), 'score': None} for f in files]

    return json_response({'query': q, 'ms': int((time.monotonic() - t0) * 1000), 'matches': matches,
                          'photos': photos, 'segments': segments})
