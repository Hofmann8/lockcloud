"""
Migration: 新增向量检索 4 张表 + files 表 2 个状态列。

背景:
- 图文 embedding: tongyi-embedding-vision-flash-2026-03-06, dim=768, res_level=3
- 人脸 embedding: 阿里云 FC + InsightFace ArcFace, dim=512
- 视频走 VPS 本地 ffmpeg 抽帧后逐帧调图片 API(视频 API 50MB 限制 + 仅返聚合向量,不适合舞队"找某瞬间"场景)
- 向量库选 sqlite-vec(本地零成本,10 万级量级性能足够)

新增对象:
  1) image_embeddings        (vec0, FLOAT[768], PK=file_id)        静态图 1:1
  2) video_frame_embeddings  (vec0, FLOAT[768], PK=frame_id AI)    视频抽帧 N:1
  3) faces                   (vec0, FLOAT[512], PK=face_id AI)      每张脸一行
  4) persons                 (普通表)                              人物聚类
  5) files.embedding_status  TEXT NOT NULL DEFAULT 'pending'        worker 状态机
  6) files.face_status       TEXT NOT NULL DEFAULT 'pending'

幂等:每一步先检查是否存在。重复跑安全。
不可逆性:本迁移只新增,不删数据,真要回滚就 DROP 这 4 张表 + 删 2 列即可。

前置:
  pip install sqlite-vec  (已在 requirements.txt)

Run:
  cd backend && python migrations/add_vector_tables.py
"""
import os
import sqlite3
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite_vec  # noqa: E402

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "instance",
    "lockcloud.db",
)

IMAGE_EMBED_DIM = 768
FACE_EMBED_DIM = 512


def _has_table(cur, name: str) -> bool:
    cur.execute(
        "SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?",
        (name,),
    )
    return cur.fetchone() is not None


def _has_column(cur, table: str, column: str) -> bool:
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def _has_index(cur, name: str) -> bool:
    cur.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?", (name,)
    )
    return cur.fetchone() is not None


def migrate():
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"DB not found: {DB_PATH}")

    con = sqlite3.connect(DB_PATH)
    con.enable_load_extension(True)
    sqlite_vec.load(con)
    con.enable_load_extension(False)
    cur = con.cursor()

    cur.execute("SELECT vec_version()")
    print(f"sqlite-vec version: {cur.fetchone()[0]}")

    # ---------- 1) image_embeddings ----------
    if _has_table(cur, "image_embeddings"):
        print("[1/6] image_embeddings already exists, skip")
    else:
        cur.execute(
            f"""
            CREATE VIRTUAL TABLE image_embeddings USING vec0(
              file_id INTEGER PRIMARY KEY,
              embedding FLOAT[{IMAGE_EMBED_DIM}],
              model_name TEXT PARTITION KEY,
              +created_at TEXT
            )
            """
        )
        print("[1/6] created image_embeddings")

    # ---------- 2) video_frame_embeddings ----------
    if _has_table(cur, "video_frame_embeddings"):
        print("[2/6] video_frame_embeddings already exists, skip")
    else:
        cur.execute(
            f"""
            CREATE VIRTUAL TABLE video_frame_embeddings USING vec0(
              frame_id INTEGER PRIMARY KEY AUTOINCREMENT,
              embedding FLOAT[{IMAGE_EMBED_DIM}],
              model_name TEXT PARTITION KEY,
              file_id INTEGER,
              timestamp_ms INTEGER,
              +is_keyframe INTEGER,
              +created_at TEXT
            )
            """
        )
        print("[2/6] created video_frame_embeddings")

    # ---------- 3) faces ----------
    if _has_table(cur, "faces"):
        print("[3/6] faces already exists, skip")
    else:
        # confidence 用 INTEGER basis points(value * 10000)存储:
        # vec0 0.1.9 在 aux REAL 列上有 "chunk_size" bug(bisect 已验证),
        # 转 INTEGER 同时避免浮点比较精度问题。读出来除 10000 即可。
        cur.execute(
            f"""
            CREATE VIRTUAL TABLE faces USING vec0(
              face_id INTEGER PRIMARY KEY AUTOINCREMENT,
              embedding FLOAT[{FACE_EMBED_DIM}],
              model_name TEXT PARTITION KEY,
              file_id INTEGER,
              person_id INTEGER,
              +frame_id INTEGER,
              +bbox_x INTEGER,
              +bbox_y INTEGER,
              +bbox_w INTEGER,
              +bbox_h INTEGER,
              +confidence_bp INTEGER,
              +created_at TEXT
            )
            """
        )
        print("[3/6] created faces")

    # ---------- 4) persons ----------
    if _has_table(cur, "persons"):
        print("[4/6] persons already exists, skip")
    else:
        cur.execute(
            """
            CREATE TABLE persons (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT,
              face_count INTEGER NOT NULL DEFAULT 0,
              cover_face_id INTEGER,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        if not _has_index(cur, "idx_persons_name"):
            cur.execute("CREATE INDEX idx_persons_name ON persons(name)")
        print("[4/6] created persons + index")

    # ---------- 5) files.embedding_status ----------
    if not _has_table(cur, "files"):
        raise SystemExit("files table missing — abort")
    if _has_column(cur, "files", "embedding_status"):
        print("[5/6] files.embedding_status already exists, skip")
    else:
        cur.execute(
            "ALTER TABLE files ADD COLUMN embedding_status TEXT NOT NULL DEFAULT 'pending'"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_files_embedding_status ON files(embedding_status)"
        )
        print("[5/6] added files.embedding_status + index")

    # ---------- 6) files.face_status ----------
    if _has_column(cur, "files", "face_status"):
        print("[6/6] files.face_status already exists, skip")
    else:
        cur.execute(
            "ALTER TABLE files ADD COLUMN face_status TEXT NOT NULL DEFAULT 'pending'"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_files_face_status ON files(face_status)"
        )
        print("[6/6] added files.face_status + index")

    con.commit()
    con.close()

    now = datetime.now(timezone.utc).isoformat()
    print(f"\nMigration completed successfully at {now}")
    print("Next steps:")
    print("  - 改 extensions.py 让运行时也自动加载 sqlite-vec(我已经准备好这步)")
    print("  - 然后实现入库 worker + FC handler")


if __name__ == "__main__":
    migrate()
