"""/api/files 下的 AI 搜索、人脸、人物。

表关系：files 1-N faces N-1 persons（聚类出来的 cluster）N-1 real_people（真人身份：名字、置顶头像）。
faces.person_id = 0 表示还没聚类（vec0 的普通列不能是 NULL）。persons.cover_face_id 是代表脸，
头像是对原图签名裁剪出来的。背景见 .memory/decision_embedding_arch.md。
"""
import logging
import time
from datetime import datetime

import sqlite_vec
from fastapi import APIRouter, Depends, Request
from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from database import get_db, paginate
from deps import Body, arg, body, jwt_identity
from errors import ApiError, error_response, json_response
from files.models import HIDDEN_FILES_SQL, File
from services import media, person_anchors
from services.embedding_service import EmbeddingClient
from services.storage import derived_key, is_file_key

router = APIRouter(prefix='/api/files')
log = logging.getLogger(__name__)


def _person_thumb_url(file_row, bbox, width=200, frame_id=None):
    """人物头像：从原图裁出这张脸。file_row = (file_id, s3_key, raw_w, raw_h, orientation, media_info)；bbox 是 raw 坐标。

    视频抽帧里的脸（frame_id 不为空）从 media/{uuid}/frames/{frame_id:05d}.jpg 裁，帧已经转正，没有 EXIF。
    """
    file_id, s3_key, raw_w, raw_h, orientation, info = file_row
    if frame_id is not None and is_file_key(s3_key):
        return media.face_crop_url(file_id, derived_key(s3_key, f'frames/{int(frame_id):05d}.jpg'), bbox,
                                   width=width)
    return media.face_crop_url(file_id, s3_key, bbox, raw_w, raw_h, orientation, width=width, info=info)


def _trashed(db: Session, file_id: int) -> bool:
    return db.execute(text("SELECT 1 FROM files WHERE id = :id AND deleted_at IS NOT NULL"),
                      {"id": file_id}).first() is not None


# ---------------------------------------------------------------- AI 语义搜索


@router.post('/ai-search')
def ai_search(identity: str = Depends(jwt_identity), payload: Body = Depends(body), db: Session = Depends(get_db)):
    """文本 → embedding → sqlite-vec KNN，按距离排序的文件（距离越小越像）。"""
    data = payload.get_json(silent=True) or {}
    q = (data.get('q') or '').strip()
    limit = max(1, min(int(data.get('limit') or 30), 200))
    if not q:
        raise ApiError('BAD_REQUEST', '查询内容不能为空')

    # 端到端计时：embedding 调用 + KNN，反映用户实际等的时间
    t0 = time.monotonic()
    try:
        emb = EmbeddingClient.from_env().embed_text(q)
    except Exception as e:
        log.error(f'ai-search embed text failed: {e}')
        return error_response('EMBED_FAILED', '搜索暂不可用，请稍后再试', 500)

    try:
        rows = db.execute(
            text("SELECT file_id, distance FROM image_embeddings WHERE embedding MATCH :vec AND k = :k "
                 "ORDER BY distance"),
            {"vec": sqlite_vec.serialize_float32(emb.vector), "k": limit},
        ).all()
    except Exception as e:
        log.error(f'ai-search vec0 query failed: {e}')
        return error_response('VEC_QUERY_FAILED', '搜索失败，请稍后再试', 500)
    ms_search = int((time.monotonic() - t0) * 1000)

    if not rows:
        return json_response({'results': [], 'query': q, 'query_tokens': emb.input_tokens, 'ms': ms_search})

    by_id = {f.id: f for f in db.query(File).filter(File.id.in_([int(r[0]) for r in rows])).all()}
    results = []
    # rank 是向量近邻里的名次，被跳过的孤儿向量（文件删了、向量还在）也占名次
    for rank, (fid, dist) in enumerate(rows, start=1):
        f = by_id.get(int(fid))
        if f is None:
            continue
        results.append({'rank': rank, 'distance': float(dist), 'file': f.to_dict(include_uploader=True)})
    return json_response({'results': results, 'query': q, 'query_tokens': emb.input_tokens, 'ms': ms_search})


# ---------------------------------------------------------------- 文件里的脸


@router.get('/{file_id:int}/faces')
def list_faces_in_file(file_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """文件里检测到的脸，带 bbox（raw 坐标）和 person_id（没聚类是 null）。回收站里的文件当没有脸。"""
    if _trashed(db, file_id):
        return json_response({'file_id': file_id, 'faces': []})
    rows = db.execute(
        text("SELECT face_id, person_id, bbox_x, bbox_y, bbox_w, bbox_h, confidence_bp "
             "FROM faces WHERE file_id = :fid ORDER BY face_id"),
        {"fid": file_id},
    ).all()
    faces = [{
        'face_id': int(r[0]),
        'person_id': int(r[1]) if r[1] else None,
        'bbox': {'x': int(r[2]), 'y': int(r[3]), 'w': int(r[4]), 'h': int(r[5])},
        'confidence': float(r[6]) / 10000.0,
    } for r in rows]
    return json_response({'file_id': file_id, 'faces': faces})


@router.get('/{file_id:int}/people')
def list_people_in_file(file_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """文件里出现的人（每人一条，带这张图里最好的那张脸），没聚类的脸只给个数。

    file_dims 是原图尺寸和 EXIF 方向，前端用来把 raw 坐标的 bbox 换算到转正后的图上；
    旧文件没有时是 null，前端退回用 thumb_url。见 .memory/gotcha_bitiful_rect_raw_coord.md。
    """
    dims = db.execute(text("SELECT raw_w, raw_h, orientation, deleted_at FROM files WHERE id = :id"),
                      {"id": file_id}).first()
    if dims and dims[3] is not None:
        return json_response({'file_id': file_id, 'people': [], 'unidentified_count': 0, 'file_dims': None})
    file_dims = None
    if dims and dims[0] and dims[1]:
        file_dims = {'raw_w': int(dims[0]), 'raw_h': int(dims[1]), 'orientation': int(dims[2] or 1)}

    face_rows = db.execute(
        text("SELECT face_id, person_id, bbox_x, bbox_y, bbox_w, bbox_h, confidence_bp "
             "FROM faces WHERE file_id = :fid"),
        {"fid": file_id},
    ).all()
    if not face_rows:
        return json_response({'file_id': file_id, 'people': [], 'unidentified_count': 0, 'file_dims': file_dims})

    # 每个 person 挑 面积 × 置信度 最大的那张
    best_by_pid = {}
    unidentified = 0
    for r in face_rows:
        face_id, pid, x, y, w, h, conf = (int(r[0]), int(r[1] or 0), int(r[2]), int(r[3]),
                                          int(r[4]), int(r[5]), int(r[6]))
        if pid <= 0:
            unidentified += 1
            continue
        score = w * h * conf
        cur = best_by_pid.get(pid)
        if cur is None or score > cur[6]:
            best_by_pid[pid] = (face_id, x, y, w, h, conf, score)

    if not best_by_pid:
        return json_response({'file_id': file_id, 'people': [], 'unidentified_count': unidentified,
                              'file_dims': file_dims})

    stmt = text(
        "SELECT p.id, rp.name, p.face_count, "
        "       fi.id, fi.s3_key, fi.raw_w, fi.raw_h, fi.orientation, "
        "       f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h, f.frame_id, fi.media_info "
        "FROM persons p "
        "LEFT JOIN real_people rp ON p.real_person_id = rp.id "
        "LEFT JOIN faces f ON p.cover_face_id = f.face_id "
        "LEFT JOIN files fi ON f.file_id = fi.id "
        "WHERE p.id IN :pids "
        "ORDER BY p.face_count DESC"
    ).bindparams(bindparam("pids", expanding=True))
    people = []
    for pr in db.execute(stmt, {"pids": list(best_by_pid.keys())}).all():
        pid = int(pr[0])
        face_id, bx, by, bw, bh = best_by_pid[pid][:5]
        cover_bbox = (pr[8], pr[9], pr[10], pr[11]) if pr[8] is not None else None
        people.append({
            'id': pid,
            'name': pr[1],
            'face_count': int(pr[2]),
            # 代表脸的裁剪头像，前端拿不到 file_dims 时用
            'thumb_url': (_person_thumb_url((pr[3], pr[4], pr[5], pr[6], pr[7], pr[13]), cover_bbox, frame_id=pr[12])
                          if cover_bbox else None),
            'best_face_in_file': {'face_id': face_id, 'bbox': {'x': bx, 'y': by, 'w': bw, 'h': bh}},
        })
    return json_response({'file_id': file_id, 'people': people, 'unidentified_count': unidentified,
                          'file_dims': file_dims})


# ---------------------------------------------------------------- 人物列表 / 详情


@router.get('/persons')
def list_persons(request: Request, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """所有 cluster（脸多的在前），名字和置顶来自链接的真人。多个 cluster 可以链到同一个真人。"""
    limit = max(1, min(int(arg(request, 'limit', 500)), 1000))
    rows = db.execute(
        text("SELECT p.id, rp.name, p.face_count, p.cover_face_id, "
             "       COALESCE(rp.cover_pinned, 0) AS pinned, "
             "       fi.id, fi.s3_key, fi.raw_w, fi.raw_h, fi.orientation, "
             "       f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h, "
             "       p.real_person_id, f.frame_id, fi.media_info "
             "FROM persons p "
             "LEFT JOIN real_people rp ON p.real_person_id = rp.id "
             "LEFT JOIN faces f ON p.cover_face_id = f.face_id "
             "LEFT JOIN files fi ON f.file_id = fi.id "
             "WHERE p.face_count >= 1 "
             "ORDER BY p.face_count DESC "
             "LIMIT :lim"),
        {"lim": limit},
    ).all()
    persons = []
    for r in rows:
        bbox = (r[10], r[11], r[12], r[13]) if r[10] is not None else None
        persons.append({
            'id': int(r[0]),
            'name': r[1],
            'face_count': int(r[2]),
            'cover_face_id': int(r[3]) if r[3] else None,
            'cover_pinned': bool(r[4]),
            'thumb_url': _person_thumb_url((r[5], r[6], r[7], r[8], r[9], r[16]), bbox, frame_id=r[15]) if bbox else None,
            'real_person_id': int(r[14]) if r[14] else None,
        })
    return json_response({'persons': persons, 'total': len(persons)})


@router.get('/persons/{person_id:int}')
def get_person_files(person_id: int, request: Request, identity: str = Depends(jwt_identity),
                     db: Session = Depends(get_db)):
    """这个人出现过的文件（上传时间新的在前，每个文件一次）。"""
    page = int(arg(request, 'page', 1))
    per_page = max(1, min(int(arg(request, 'per_page', 24)), 200))

    p_row = db.execute(
        text("SELECT p.id, rp.name, p.face_count "
             "FROM persons p LEFT JOIN real_people rp ON p.real_person_id = rp.id WHERE p.id = :pid"),
        {"pid": person_id},
    ).first()
    if not p_row:
        raise ApiError('NOT_FOUND', '人物不存在', 404)
    person = {'id': int(p_row[0]), 'name': p_row[1], 'face_count': int(p_row[2])}

    file_ids = [int(r[0]) for r in db.execute(
        text(f"SELECT DISTINCT f.file_id FROM faces f WHERE f.person_id = :pid "
             f"AND f.file_id NOT IN ({HIDDEN_FILES_SQL})"), {"pid": person_id}).all()]
    if not file_ids:
        return json_response({'person': person, 'files': [], 'pagination': {
            'total': 0, 'page': page, 'per_page': per_page, 'pages': 0, 'has_next': False, 'has_prev': False}})

    paged = paginate(db.query(File).filter(File.id.in_(file_ids)).order_by(File.uploaded_at.desc()), page, per_page)
    return json_response({
        'person': person,
        'files': [f.to_dict(include_uploader=True) for f in paged.items],
        # 现状：total 是出现过的文件数（含已经没有行的孤儿，不含回收站里的），page 原样回写
        'pagination': {'total': len(file_ids), 'page': page, 'per_page': per_page, 'pages': paged.pages,
                       'has_next': paged.has_next, 'has_prev': paged.has_prev},
    })


# ---------------------------------------------------------------- 命名、合并、换头像


@router.patch('/persons/{person_id:int}')
def rename_person(person_id: int, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                  db: Session = Depends(get_db)):
    """给 cluster 起名字，实际写在 real_people 上。

    - 已链接真人 → 改真人的名字（空名字就清掉）；
    - 没链接 → 用代表脸的 (file_id, bbox) 当锚点新建真人再链上；
    - 和别的真人重名 → 409 NAME_CONFLICT，带上那个人的信息，前端弹合并（/persons/<id>/merge）。
    """
    data = payload.get_json(silent=True) or {}
    name = (data.get('name') or '').strip() or None

    info = db.execute(
        text("SELECT p.real_person_id, f.file_id, f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h, f.frame_id "
             "FROM persons p LEFT JOIN faces f ON p.cover_face_id = f.face_id WHERE p.id = :pid"),
        {"pid": person_id},
    ).first()
    if not info:
        raise ApiError('NOT_FOUND', '人物不存在', 404)
    cur_real_pid = int(info[0]) if info[0] else None
    cover_file_id = int(info[1]) if info[1] else None
    cover_bbox = (info[2], info[3], info[4], info[5]) if info[1] else None
    cover_frame = info[6] if info[1] else None

    if name:
        conflict = db.execute(
            text("SELECT rp.id, rp.name, "
                 "       COALESCE((SELECT SUM(p.face_count) FROM persons p "
                 "                 WHERE p.real_person_id = rp.id), 0) AS face_count, "
                 "       rp.anchor_file_id, rp.anchor_bbox_x, rp.anchor_bbox_y, "
                 "       rp.anchor_bbox_w, rp.anchor_bbox_h, rp.anchor_frame_id "
                 "FROM real_people rp WHERE rp.name = :n AND rp.id != :exclude LIMIT 1"),
            {"n": name, "exclude": cur_real_pid or 0},
        ).first()
        if conflict:
            existing_file = db.execute(
                text("SELECT id, s3_key, raw_w, raw_h, orientation, media_info FROM files WHERE id = :id"),
                {"id": int(conflict[3])},
            ).first() if conflict[3] else None
            # x 可以是 0（脸贴着左边缘），要按 None 判断
            ex_bbox = (conflict[4], conflict[5], conflict[6], conflict[7]) if conflict[4] is not None else None
            thumb_url = (_person_thumb_url(tuple(existing_file), ex_bbox, frame_id=conflict[8])
                         if existing_file and ex_bbox else None)
            raise ApiError('NAME_CONFLICT', f'已存在同名人物「{name}」', 409, existing={
                'id': int(conflict[0]), 'name': conflict[1], 'face_count': int(conflict[2] or 0),
                'thumb_url': thumb_url})

    now = datetime.utcnow().isoformat()
    if cur_real_pid:
        db.execute(text("UPDATE real_people SET name = :n, updated_at = :ts WHERE id = :rid"),
                   {"n": name, "ts": now, "rid": cur_real_pid})
    else:
        if not cover_bbox:
            raise ApiError('NO_ANCHOR', '此人物暂时无法命名')
        res = db.execute(
            text("INSERT INTO real_people (name, cover_pinned, anchor_file_id, anchor_frame_id, "
                 "  anchor_bbox_x, anchor_bbox_y, anchor_bbox_w, anchor_bbox_h, created_at, updated_at) "
                 "VALUES (:n, 0, :fid, :frame, :bx, :by, :bw, :bh, :ts, :ts)"),
            {"n": name, "fid": cover_file_id, "frame": cover_frame, "bx": cover_bbox[0], "by": cover_bbox[1],
             "bw": cover_bbox[2], "bh": cover_bbox[3], "ts": now},
        )
        db.execute(text("UPDATE persons SET real_person_id = :rid WHERE id = :pid"),
                   {"rid": int(res.lastrowid), "pid": person_id})
    db.commit()
    return json_response({'id': person_id, 'name': name})


@router.post('/persons/{person_id:int}/merge')
def merge_person(person_id: int, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                 db: Session = Depends(get_db)):
    """把 cluster 改链到目标真人（target_id 是 real_people.id）。只动身份层，不动 faces。

    原来链的真人没人再指着就删掉；已经链在目标上时原样返回 noop。

    persons 每晚重新聚类时会清空重建，所以合并要落在锚点上才留得住：把这个 cluster 的代表脸记成目标真人的
    附加锚点，原来的真人指着这个 cluster 的锚点去掉（见 services/person_anchors.py）。
    """
    data = payload.get_json(silent=True) or {}
    target_id = data.get('target_id')
    if not target_id:
        raise ApiError('BAD_REQUEST', 'target_id 必填')
    target_id = int(target_id)

    src = db.execute(text("SELECT id, real_person_id FROM persons WHERE id = :id"), {"id": person_id}).first()
    if not src:
        raise ApiError('NOT_FOUND', '人物不存在', 404)
    if not db.execute(text("SELECT id, name FROM real_people WHERE id = :id"), {"id": target_id}).first():
        raise ApiError('NOT_FOUND', '目标人物不存在', 404)

    old_real_id = int(src[1]) if src[1] else None
    if old_real_id == target_id:
        return json_response({'merged_into_real_id': target_id, 'source_cluster_id': person_id,
                              'orphan_real_id_deleted': None, 'noop': True})

    db.execute(text("UPDATE persons SET real_person_id = :rid WHERE id = :pid"),
               {"rid": target_id, "pid": person_id})
    cover = db.execute(
        text("SELECT f.file_id, f.frame_id, f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h "
             "FROM persons p JOIN faces f ON p.cover_face_id = f.face_id WHERE p.id = :pid"),
        {"pid": person_id}).first()
    if cover:
        person_anchors.add_anchor(db, target_id, cover[0], cover[1], cover[2:6])
    orphan_deleted = None
    if old_real_id:
        still_used = db.execute(text("SELECT 1 FROM persons WHERE real_person_id = :rid LIMIT 1"),
                                {"rid": old_real_id}).first()
        if not still_used:
            # 原来那个真人的附加锚点（以前合并进来的 cluster）一起归到目标名下
            db.execute(text("UPDATE real_people_anchors SET real_person_id = :to WHERE real_person_id = :rid"),
                       {"to": target_id, "rid": old_real_id})
            db.execute(text("DELETE FROM real_people WHERE id = :rid"), {"rid": old_real_id})
            orphan_deleted = old_real_id
        else:
            person_anchors.drop_anchors_into(db, old_real_id, person_id)
    db.commit()
    return json_response({'merged_into_real_id': target_id, 'source_cluster_id': person_id,
                          'orphan_real_id_deleted': orphan_deleted})


@router.put('/persons/{person_id:int}/cover')
def set_person_cover(person_id: int, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                     db: Session = Depends(get_db)):
    """指定某张图做这个人的头像：选图里属于他的最好那张脸，写到真人的锚点上并置顶。

    没链接真人时新建一个匿名真人（重新聚类后靠锚点找回）；cluster 的 cover_face_id 也同步，列表立即跟上。
    """
    data = payload.get_json(silent=True) or {}
    file_id = data.get('file_id')
    if not file_id:
        raise ApiError('BAD_REQUEST', 'file_id 必填')
    file_id = int(file_id)

    best = db.execute(
        text("SELECT face_id, bbox_x, bbox_y, bbox_w, bbox_h, frame_id FROM faces "
             "WHERE file_id = :fid AND person_id = :pid "
             "ORDER BY (bbox_w * bbox_h * confidence_bp) DESC LIMIT 1"),
        {"fid": file_id, "pid": person_id},
    ).first()
    if not best:
        raise ApiError('NO_MATCHING_FACE', '这张照片中没有此人')
    new_face_id = int(best[0])
    new_bbox = (int(best[1]), int(best[2]), int(best[3]), int(best[4]))

    old_row = db.execute(
        text("SELECT p.real_person_id, p.cover_face_id, f.file_id "
             "FROM persons p LEFT JOIN faces f ON p.cover_face_id = f.face_id WHERE p.id = :pid"),
        {"pid": person_id},
    ).first()
    if not old_row:
        raise ApiError('NOT_FOUND', '人物不存在', 404)
    cur_real_pid = int(old_row[0]) if old_row[0] else None
    if not db.get(File, file_id):
        raise ApiError('NOT_FOUND', '文件不存在', 404)

    now = datetime.utcnow().isoformat()
    anchor = {"fid": file_id, "frame": best[5], "bx": new_bbox[0], "by": new_bbox[1], "bw": new_bbox[2],
              "bh": new_bbox[3], "ts": now}
    try:
        if cur_real_pid:
            db.execute(
                text("UPDATE real_people SET cover_pinned = 1, anchor_frame_id = :frame, "
                     "  anchor_file_id = :fid, anchor_bbox_x = :bx, anchor_bbox_y = :by, "
                     "  anchor_bbox_w = :bw, anchor_bbox_h = :bh, updated_at = :ts WHERE id = :rid"),
                {**anchor, "rid": cur_real_pid},
            )
        else:
            res = db.execute(
                text("INSERT INTO real_people (name, cover_pinned, anchor_file_id, anchor_frame_id, "
                     "  anchor_bbox_x, anchor_bbox_y, anchor_bbox_w, anchor_bbox_h, created_at, updated_at) "
                     "VALUES (NULL, 1, :fid, :frame, :bx, :by, :bw, :bh, :ts, :ts)"),
                anchor,
            )
            cur_real_pid = int(res.lastrowid)
            db.execute(text("UPDATE persons SET real_person_id = :rid WHERE id = :pid"),
                       {"rid": cur_real_pid, "pid": person_id})
        db.execute(text("UPDATE persons SET cover_face_id = :fc, updated_at = :ts WHERE id = :pid"),
                   {"fc": new_face_id, "ts": now, "pid": person_id})
        db.commit()
    except Exception as e:
        db.rollback()
        log.error("set_person_cover: db commit failed: %s", e)
        return error_response('DB_FAILED', '保存失败，请稍后再试', 500)
    return json_response({'id': person_id, 'cover_face_id': new_face_id, 'cover_pinned': True})


# ---------------------------------------------------------------- 以脸搜脸


@router.post('/face-search')
def face_search(identity: str = Depends(jwt_identity), payload: Body = Depends(body), db: Session = Depends(get_db)):
    """跟这张脸最像的脸（余弦 KNN），排除自己，每个文件只留最像的一张。"""
    data = payload.get_json(silent=True) or {}
    face_id = data.get('face_id')
    limit = max(1, min(int(data.get('limit') or 50), 200))
    if not face_id:
        raise ApiError('BAD_REQUEST', 'face_id 必填')

    t0 = time.monotonic()
    row = db.execute(text("SELECT embedding FROM faces WHERE face_id = :fid"), {"fid": int(face_id)}).first()
    if not row:
        raise ApiError('NOT_FOUND', '人脸不存在', 404)
    try:
        rows = db.execute(
            text("SELECT face_id, file_id, person_id, distance "
                 "FROM faces WHERE embedding MATCH :vec AND k = :k ORDER BY distance"),
            # 多取一些再按文件去重：同一个视频的抽帧里同一张脸有几十上百张，只取 limit + 1 个会全落在一两个文件上
            {"vec": row[0], "k": min(4096, max((limit + 1) * 20, 400))},
        ).all()
    except Exception as e:
        log.error(f'face-search vec0 query failed: {e}')
        return error_response('VEC_QUERY_FAILED', '搜索失败，请稍后再试', 500)
    ms = int((time.monotonic() - t0) * 1000)

    seen_files = set()
    matches = []
    for r in rows:
        fid, file_id, person_id, dist = int(r[0]), int(r[1]), int(r[2]), float(r[3])
        if fid == int(face_id) or file_id in seen_files:
            continue
        seen_files.add(file_id)
        matches.append({'face_id': fid, 'file_id': file_id, 'person_id': person_id if person_id else None,
                        'similarity': 1.0 - dist})
        if len(matches) >= limit:
            break

    by_id = {f.id: f for f in db.query(File).filter(File.id.in_([m['file_id'] for m in matches])).all()}
    results = []
    for rank, m in enumerate(matches, 1):
        f = by_id.get(m['file_id'])
        if f is None:
            continue
        results.append({'rank': rank, 'face_id': m['face_id'], 'similarity': m['similarity'],
                        'person_id': m['person_id'], 'file': f.to_dict(include_uploader=True)})
    return json_response({'query_face_id': int(face_id), 'results': results, 'ms': ms})


# ---------------------------------------------------------------- 视频里谁在什么时候出现


APPEAR_GAP = 6.0       # 相邻出现帧间隔 ≤ 6 秒合成一段
FRAME_INTERVAL = 2.0   # media.json 里没写时的抽帧间隔


def _appearance_segments(frame_ids, interval: float, duration=None) -> tuple[list, float]:
    """出现过的帧号 → [{start, end}] 和总时长。段尾是最后一帧再加一个抽帧间隔（不超过视频时长）。"""
    segments = []
    for t in sorted({int(i) * interval for i in frame_ids}):
        if segments and t - segments[-1]['last'] <= APPEAR_GAP:
            segments[-1]['last'] = t
        else:
            segments.append({'start': t, 'last': t})
    out = []
    for s in segments:
        end = s['last'] + interval
        if duration:
            end = min(end, float(duration))
        out.append({'start': round(s['start'], 3), 'end': round(max(end, s['start']), 3)})
    return out, round(sum(s['end'] - s['start'] for s in out), 3)


def _frame_interval(file) -> float:
    return float((media.media_info(file).get('frames') or {}).get('interval') or FRAME_INTERVAL)


@router.get('/{file_id:int}/appearances')
def file_appearances(file_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """视频里每个人出现的时间段（来自抽帧的人脸，faces.frame_id 是帧号）。按出场总时长倒序。

    人物的 id、名字、头像和 /{file_id}/people 一样（cluster → 真人）。不是视频或还没处理时 people 为空。
    """
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    if not media.is_video(file):
        return json_response({'file_id': file_id, 'people': [], 'unidentified_count': 0})

    frames_by_pid, unidentified = {}, 0
    for _, pid, frame_id in db.execute(
            text("SELECT face_id, person_id, frame_id FROM faces WHERE file_id = :fid"), {"fid": file_id}).all():
        if frame_id is None:
            continue
        if int(pid or 0) <= 0:
            unidentified += 1
            continue
        frames_by_pid.setdefault(int(pid), set()).add(int(frame_id))
    if not frames_by_pid:
        return json_response({'file_id': file_id, 'people': [], 'unidentified_count': unidentified})

    interval, duration = _frame_interval(file), media.media_info(file).get('duration')
    stmt = text(
        "SELECT p.id, rp.name, fi.id, fi.s3_key, fi.raw_w, fi.raw_h, fi.orientation, "
        "       f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h, f.frame_id, fi.media_info "
        "FROM persons p "
        "LEFT JOIN real_people rp ON p.real_person_id = rp.id "
        "LEFT JOIN faces f ON p.cover_face_id = f.face_id "
        "LEFT JOIN files fi ON f.file_id = fi.id "
        "WHERE p.id IN :pids"
    ).bindparams(bindparam("pids", expanding=True))
    people = []
    for r in db.execute(stmt, {"pids": list(frames_by_pid)}).all():
        bbox = (r[7], r[8], r[9], r[10]) if r[7] is not None else None
        segments, total = _appearance_segments(frames_by_pid[int(r[0])], interval, duration)
        people.append({
            'id': int(r[0]), 'name': r[1],
            'thumb_url': _person_thumb_url((r[2], r[3], r[4], r[5], r[6], r[12]), bbox, frame_id=r[11]) if bbox else None,
            'segments': segments, 'total': total,
        })
    people.sort(key=lambda p: (-p['total'], p['id']))
    return json_response({'file_id': file_id, 'people': people, 'unidentified_count': unidentified})


@router.get('/persons/{person_id:int}/appearances')
def person_appearances(person_id: int, request: Request, identity: str = Depends(jwt_identity),
                       db: Session = Depends(get_db)):
    """一个人出现过的视频和时间段，出场总时长多的在前。分页参数同 /persons/{id}。"""
    from routers.files import with_display

    page = max(1, int(arg(request, 'page', 1)))
    per_page = max(1, min(int(arg(request, 'per_page', 24)), 200))
    p_row = db.execute(
        text("SELECT p.id, rp.name, p.face_count "
             "FROM persons p LEFT JOIN real_people rp ON p.real_person_id = rp.id WHERE p.id = :pid"),
        {"pid": person_id},
    ).first()
    if not p_row:
        raise ApiError('NOT_FOUND', '人物不存在', 404)
    person = {'id': int(p_row[0]), 'name': p_row[1], 'face_count': int(p_row[2])}

    frames_by_file = {}
    for file_id, frame_id in db.execute(
            text("SELECT file_id, frame_id FROM faces WHERE person_id = :pid"), {"pid": person_id}).all():
        if frame_id is not None:
            frames_by_file.setdefault(int(file_id), set()).add(int(frame_id))
    videos = []
    if frames_by_file:
        for f in db.query(File).filter(File.id.in_(list(frames_by_file)), File.content_type.like('video/%')).all():
            segments, total = _appearance_segments(frames_by_file[f.id], _frame_interval(f),
                                                   media.media_info(f).get('duration'))
            videos.append((f, segments, total))
    videos.sort(key=lambda v: (-v[2], -v[0].id))
    total = len(videos)
    pages = -(-total // per_page) if total else 0
    chunk = videos[(page - 1) * per_page:page * per_page]
    return json_response({
        'person': person,
        'videos': [{'file': with_display(f), 'segments': segs, 'total': t} for f, segs, t in chunk],
        'pagination': {'page': page, 'per_page': per_page, 'total': total, 'pages': pages,
                       'has_next': page < pages, 'has_prev': page > 1},
    })
