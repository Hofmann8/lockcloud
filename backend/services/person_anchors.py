"""
人物身份的锚点：每晚重新聚类之后，靠锚点把"真人"重新链到新的 cluster 上。

背景：persons 表是聚类的结果，每晚 04:00 清空重建（scripts/cluster_faces.py），cluster 的 id 每天都变。
用户认定的身份（名字、置顶的头像、合并关系）存在 real_people 上，靠锚点找回自己的 cluster。
锚点是一张脸的位置 (file_id, frame_id, bbox)，不用 face_id：人脸重跑后 face_id 会变，文件和位置不变。

- 主锚点：real_people.anchor_*。命名时取 cluster 的代表脸；用户换头像时改成选的那张（cover_pinned = 1）。
  重新聚类后置顶的头像也靠它恢复。
- 附加锚点：real_people_anchors 表。把另一个 cluster 合并进来时记一条，重新聚类后这个 cluster 还能链回来。
  没有它，合并只能撑到当晚。
- 锚点所在的文件被彻底删除时，换一张这个人别的脸当锚点（repair_primary），否则名字就再也链不回来了。

回收站里的文件不动锚点：恢复后原样回来；30 天后彻底删除时才换。
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

IOU_THRESHOLD = 0.5

ANCHORS_DDL = [
    """CREATE TABLE IF NOT EXISTS real_people_anchors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      real_person_id INTEGER NOT NULL,
      file_id INTEGER NOT NULL,
      frame_id INTEGER,
      bbox_x INTEGER NOT NULL,
      bbox_y INTEGER NOT NULL,
      bbox_w INTEGER NOT NULL,
      bbox_h INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_real_people_anchors_person ON real_people_anchors(real_person_id)",
    "CREATE INDEX IF NOT EXISTS idx_real_people_anchors_file ON real_people_anchors(file_id)",
]


_schema_ready = False


def ensure_schema(db: Session) -> None:
    """附加锚点表和 real_people.anchor_frame_id。后端启动时 database.migrate() 会建；
    这里给不经过后端启动、直接跑的脚本（聚类、清回收站）兜一下。每个进程只查一次。不 commit。"""
    global _schema_ready
    if _schema_ready:
        return
    for ddl in ANCHORS_DDL:
        db.execute(text(ddl))
    columns = {r[1] for r in db.execute(text("PRAGMA table_info(real_people)")).all()}
    if columns and 'anchor_frame_id' not in columns:
        db.execute(text("ALTER TABLE real_people ADD COLUMN anchor_frame_id INTEGER"))
    _schema_ready = True


def iou(a, b) -> float:
    """两个 bbox (x, y, w, h) 的交并比。"""
    ax1, ay1, aw, ah = a
    bx1, by1, bw, bh = b
    iw = max(0, min(ax1 + aw, bx1 + bw) - max(ax1, bx1))
    ih = max(0, min(ay1 + ah, by1 + bh) - max(ay1, by1))
    inter = iw * ih
    if inter == 0:
        return 0.0
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def match_face(db: Session, file_id: int, frame_id, bbox, threshold: float = IOU_THRESHOLD):
    """锚点对应的那张脸：同一文件（视频还要同一帧）里和 bbox 重合最多的、已经聚进 cluster 的脸。

    返回 (face_id, person_id, iou)；没有重合够多的返回 None。
    """
    rows = db.execute(
        text("SELECT face_id, person_id, frame_id, bbox_x, bbox_y, bbox_w, bbox_h "
             "FROM faces WHERE file_id = :fid AND person_id > 0"),
        {"fid": int(file_id)},
    ).all()
    best = None
    for face_id, person_id, face_frame, x, y, w, h in rows:
        # 视频里不同帧的同一个位置可能是不同的人，帧号要对上；以前的锚点没记帧号，不卡
        if frame_id is not None and (face_frame is None or int(face_frame) != int(frame_id)):
            continue
        score = iou(tuple(int(v) for v in bbox), (int(x), int(y), int(w), int(h)))
        if best is None or score > best[2]:
            best = (int(face_id), int(person_id), score)
    return best if best and best[2] >= threshold else None


def add_anchor(db: Session, real_id: int, file_id: int, frame_id, bbox) -> None:
    """给真人加一个附加锚点。同一张脸（同文件同帧、重合够多）已经记过就不重复记。不 commit。"""
    bbox = tuple(int(v) for v in bbox)
    existing = db.execute(
        text("SELECT frame_id, bbox_x, bbox_y, bbox_w, bbox_h FROM real_people_anchors "
             "WHERE real_person_id = :rid AND file_id = :fid"),
        {"rid": int(real_id), "fid": int(file_id)},
    ).all()
    for face_frame, x, y, w, h in existing:
        if (face_frame is None) == (frame_id is None) and (frame_id is None or int(face_frame) == int(frame_id)) \
                and iou(bbox, (int(x), int(y), int(w), int(h))) >= IOU_THRESHOLD:
            return
    db.execute(
        text("INSERT INTO real_people_anchors (real_person_id, file_id, frame_id, bbox_x, bbox_y, bbox_w, bbox_h, "
             "created_at) VALUES (:rid, :fid, :frame, :x, :y, :w, :h, :ts)"),
        {"rid": int(real_id), "fid": int(file_id), "frame": int(frame_id) if frame_id is not None else None,
         "x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3], "ts": datetime.utcnow().isoformat()},
    )


def all_anchors(db: Session) -> list[dict]:
    """全部锚点：[{real_id, file_id, frame_id, bbox, primary, pinned}]。主锚点在前。"""
    out = []
    for r in db.execute(text(
            "SELECT id, anchor_file_id, anchor_frame_id, anchor_bbox_x, anchor_bbox_y, anchor_bbox_w, anchor_bbox_h, "
            "       cover_pinned FROM real_people WHERE anchor_file_id IS NOT NULL AND anchor_bbox_x IS NOT NULL")).all():
        out.append({'real_id': int(r[0]), 'file_id': int(r[1]), 'frame_id': r[2],
                    'bbox': (int(r[3]), int(r[4]), int(r[5]), int(r[6])), 'primary': True, 'pinned': bool(r[7])})
    for r in db.execute(text(
            "SELECT a.real_person_id, a.file_id, a.frame_id, a.bbox_x, a.bbox_y, a.bbox_w, a.bbox_h "
            "FROM real_people_anchors a JOIN real_people rp ON rp.id = a.real_person_id ORDER BY a.id")).all():
        out.append({'real_id': int(r[0]), 'file_id': int(r[1]), 'frame_id': r[2],
                    'bbox': (int(r[3]), int(r[4]), int(r[5]), int(r[6])), 'primary': False, 'pinned': False})
    return out


def _best_face_of(db: Session, cluster_ids, exclude_file_id: Optional[int] = None):
    """这些 cluster 里最适合当锚点的脸（面积 × 置信度最大），不取回收站里的文件。"""
    best = None
    for cid in cluster_ids:
        row = db.execute(
            text("SELECT file_id, frame_id, bbox_x, bbox_y, bbox_w, bbox_h, (bbox_w * bbox_h * confidence_bp) AS score "
                 "FROM faces WHERE person_id = :pid AND file_id != :skip "
                 "AND file_id IN (SELECT id FROM files WHERE deleted_at IS NULL) "
                 "ORDER BY score DESC LIMIT 1"),
            {"pid": int(cid), "skip": int(exclude_file_id or 0)},
        ).first()
        if row and (best is None or row[6] > best[6]):
            best = row
    return best


def repair_primary(db: Session, real_id: int, exclude_file_id: Optional[int] = None,
                   exclude_cluster_id: Optional[int] = None) -> bool:
    """主锚点不能用了（文件要彻底删除，或者它指的 cluster 被合并到别人那里）：换一个。

    先从这个人现在链着的 cluster 里挑一张最好的脸；没有就提一个附加锚点上来；都没有就置空。
    换了之后头像不再算置顶。返回有没有换到新的。不 commit。
    """
    clusters = [int(r[0]) for r in db.execute(
        text("SELECT id FROM persons WHERE real_person_id = :rid"), {"rid": int(real_id)}).all()
        if int(r[0]) != int(exclude_cluster_id or 0)]
    face = _best_face_of(db, clusters, exclude_file_id)
    now = datetime.utcnow().isoformat()
    if face:
        db.execute(
            text("UPDATE real_people SET cover_pinned = 0, anchor_file_id = :fid, anchor_frame_id = :frame, "
                 "anchor_bbox_x = :x, anchor_bbox_y = :y, anchor_bbox_w = :w, anchor_bbox_h = :h, updated_at = :ts "
                 "WHERE id = :rid"),
            {"fid": int(face[0]), "frame": face[1], "x": int(face[2]), "y": int(face[3]), "w": int(face[4]),
             "h": int(face[5]), "ts": now, "rid": int(real_id)})
        return True
    extra = db.execute(
        text("SELECT id, file_id, frame_id, bbox_x, bbox_y, bbox_w, bbox_h FROM real_people_anchors "
             "WHERE real_person_id = :rid AND file_id != :skip ORDER BY id LIMIT 1"),
        {"rid": int(real_id), "skip": int(exclude_file_id or 0)}).first()
    if extra:
        db.execute(
            text("UPDATE real_people SET cover_pinned = 0, anchor_file_id = :fid, anchor_frame_id = :frame, "
                 "anchor_bbox_x = :x, anchor_bbox_y = :y, anchor_bbox_w = :w, anchor_bbox_h = :h, updated_at = :ts "
                 "WHERE id = :rid"),
            {"fid": int(extra[1]), "frame": extra[2], "x": int(extra[3]), "y": int(extra[4]), "w": int(extra[5]),
             "h": int(extra[6]), "ts": now, "rid": int(real_id)})
        db.execute(text("DELETE FROM real_people_anchors WHERE id = :id"), {"id": int(extra[0])})
        return True
    db.execute(
        text("UPDATE real_people SET cover_pinned = 0, anchor_file_id = NULL, anchor_frame_id = NULL, "
             "anchor_bbox_x = NULL, anchor_bbox_y = NULL, anchor_bbox_w = NULL, anchor_bbox_h = NULL, "
             "updated_at = :ts WHERE id = :rid"),
        {"ts": now, "rid": int(real_id)})
    return False


def forget_file(db: Session, file_id: int) -> None:
    """文件要彻底删除了：锚在它上面的真人换一个锚点，附加锚点直接删。

    调用前这个文件的 faces 行应该已经删掉（这样挑新锚点时不会再挑到它）。不 commit。
    """
    db.execute(text("DELETE FROM real_people_anchors WHERE file_id = :fid"), {"fid": int(file_id)})
    for (real_id,) in db.execute(
            text("SELECT id FROM real_people WHERE anchor_file_id = :fid"), {"fid": int(file_id)}).all():
        repair_primary(db, int(real_id), exclude_file_id=int(file_id))


def drop_anchors_into(db: Session, real_id: int, cluster_id: int) -> None:
    """cluster 从这个真人名下拿走了（合并到别人那里）：这个真人指着它的锚点都要去掉，
    不然下次聚类两边会抢同一个 cluster。不 commit。"""
    for a_id, file_id, frame_id, x, y, w, h in db.execute(
            text("SELECT id, file_id, frame_id, bbox_x, bbox_y, bbox_w, bbox_h FROM real_people_anchors "
                 "WHERE real_person_id = :rid"), {"rid": int(real_id)}).all():
        hit = match_face(db, file_id, frame_id, (x, y, w, h))
        if hit and hit[1] == int(cluster_id):
            db.execute(text("DELETE FROM real_people_anchors WHERE id = :id"), {"id": int(a_id)})
    primary = db.execute(
        text("SELECT anchor_file_id, anchor_frame_id, anchor_bbox_x, anchor_bbox_y, anchor_bbox_w, anchor_bbox_h "
             "FROM real_people WHERE id = :rid AND anchor_file_id IS NOT NULL AND anchor_bbox_x IS NOT NULL"),
        {"rid": int(real_id)}).first()
    if primary:
        hit = match_face(db, primary[0], primary[1], primary[2:6])
        if hit and hit[1] == int(cluster_id):
            repair_primary(db, int(real_id), exclude_cluster_id=int(cluster_id))
