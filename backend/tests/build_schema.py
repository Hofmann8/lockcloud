"""生成 tests/db_schema.sql：契约测试用的空库结构。

表结构分散在模型和一堆迁移脚本里（向量表、人物表是原生 SQL 建的），这里拼成一份：
  - SQLAlchemy 模型的 create_all
  - migrations/ 里原生 SQL 建的表：vec0 向量表、persons、real_people

测试直接用 sqlite3 执行这份 SQL，不依赖 app。模型或迁移改了就重跑：
    python tests/build_schema.py
"""
from __future__ import annotations

import os
import sqlite3
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import sqlite_vec  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402

RAW_DDL = [
    # migrations/add_vector_tables.py
    """CREATE VIRTUAL TABLE image_embeddings USING vec0(
      file_id INTEGER PRIMARY KEY,
      embedding FLOAT[768],
      model_name TEXT PARTITION KEY,
      +created_at TEXT
    )""",
    """CREATE VIRTUAL TABLE video_frame_embeddings USING vec0(
      frame_id INTEGER PRIMARY KEY AUTOINCREMENT,
      embedding FLOAT[768],
      model_name TEXT PARTITION KEY,
      file_id INTEGER,
      timestamp_ms INTEGER,
      +is_keyframe INTEGER,
      +created_at TEXT
    )""",
    """CREATE VIRTUAL TABLE faces USING vec0(
      face_id INTEGER PRIMARY KEY AUTOINCREMENT,
      embedding FLOAT[512],
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
    )""",
    # add_vector_tables.py + add_persons_cover_pinned.py + add_real_people.py
    """CREATE TABLE persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      face_count INTEGER NOT NULL DEFAULT 0,
      cover_face_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      cover_pinned INTEGER NOT NULL DEFAULT 0,
      real_person_id INTEGER
    )""",
    "CREATE INDEX idx_persons_name ON persons(name)",
    "CREATE INDEX idx_persons_real_person ON persons(real_person_id) WHERE real_person_id IS NOT NULL",
    """CREATE TABLE real_people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      cover_pinned INTEGER NOT NULL DEFAULT 0,
      anchor_file_id INTEGER,
      anchor_bbox_x INTEGER,
      anchor_bbox_y INTEGER,
      anchor_bbox_w INTEGER,
      anchor_bbox_h INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      anchor_frame_id INTEGER
    )""",
    "CREATE UNIQUE INDEX idx_real_people_name ON real_people(name) WHERE name IS NOT NULL",
    "CREATE INDEX idx_real_people_anchor_file ON real_people(anchor_file_id)",
    # services/person_anchors.py（database.migrate() 启动时建）
    """CREATE TABLE real_people_anchors (
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
    "CREATE INDEX idx_real_people_anchors_person ON real_people_anchors(real_person_id)",
    "CREATE INDEX idx_real_people_anchors_file ON real_people_anchors(file_id)",
]

VIRTUAL = ('image_embeddings', 'video_frame_embeddings', 'faces')


def build() -> str:
    import database
    database.import_models()

    path = os.path.join(tempfile.mkdtemp(prefix='lockcloud_schema_'), 'schema.db')
    engine = create_engine('sqlite:///' + path.replace('\\', '/'))
    database.Base.metadata.create_all(engine)
    engine.dispose()

    con = sqlite3.connect(path)
    con.enable_load_extension(True)
    sqlite_vec.load(con)
    for stmt in RAW_DDL:
        con.execute(stmt)
    con.commit()

    rows = con.execute(
        "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' "
        "ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, rowid"
    ).fetchall()
    con.close()
    os.remove(path)

    out = ['-- 由 tests/build_schema.py 生成，不要手改', '']
    for kind, name, sql in rows:
        # vec0 自己的影子表由 CREATE VIRTUAL TABLE 带出来，不单独写
        if any(name.startswith(v + '_') for v in VIRTUAL):
            continue
        out.append(sql.strip() + ';')
        out.append('')
    return '\n'.join(out)


if __name__ == '__main__':
    target = os.path.join(HERE, 'db_schema.sql')
    with open(target, 'w', encoding='utf-8', newline='\n') as f:
        f.write(build())
    print('写好了', target)
