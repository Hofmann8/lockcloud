"""database.migrate() 能在 2026-09 之前的库上补齐新表新列，可以反复跑，并从 media.json 结果里补拍摄时间。"""
import os
import shutil
import sqlite3
import tempfile

import sqlalchemy as sa

NEW_COLUMNS = ('taken_at', 'deleted_at', 'deleted_by', 'beats_ones', 'beats_updated_by', 'beats_updated_at',
               'frame_embedding_status', 'frame_face_status')


def _old_db(path):
    """当前的测试库结构去掉这次新加的表和列，就是线上库现在的样子。"""
    with open(os.path.join(os.path.dirname(__file__), 'db_schema.sql'), encoding='utf-8') as f:
        ddl = f.read()
    import sqlite_vec
    con = sqlite3.connect(path)
    con.enable_load_extension(True)
    sqlite_vec.load(con)
    con.executescript(ddl)
    con.execute('DROP INDEX ix_files_deleted_at')
    for col in NEW_COLUMNS:
        con.execute(f'ALTER TABLE files DROP COLUMN {col}')
    con.execute('DROP TABLE comments')
    con.execute('DROP TABLE downloads')
    # 2026-11：人物的附加锚点表、锚点的帧号
    con.execute('DROP TABLE real_people_anchors')
    con.execute('ALTER TABLE real_people DROP COLUMN anchor_frame_id')
    con.execute("INSERT INTO users (id, email, name, created_at, is_active, is_admin) "
                "VALUES (1, 'a@b', 'a', '2025-01-01 00:00:00', 1, 0)")
    for i, info in enumerate(['{"taken_at": "2025-10-20T14:25:26+00:00"}', '{"taken_at": ""}', 'not json', None]):
        con.execute("INSERT INTO files (id, filename, directory, s3_key, size, uploader_id, uploaded_at, is_legacy, "
                    "embedding_status, face_status, orientation, media_status, media_info) "
                    "VALUES (?, 'a.jpg', 'd', ?, 1, 1, '2025-01-01 00:00:00', 0, 'pending', 'pending', 1, 'ready', ?)",
                    (i + 1, f'k{i}', info))
    con.commit()
    con.close()


def test_migrate_old_schema(monkeypatch):
    import database
    path = os.path.join(tempfile.mkdtemp(prefix='lockcloud_migrate_'), 'old.db')
    _old_db(path)
    engine = sa.create_engine('sqlite:///' + path.replace('\\', '/'))
    monkeypatch.setattr(database, 'engine', engine)
    try:
        database.migrate()
        database.migrate()   # 再跑一次不报错
        with engine.connect() as conn:
            cols = {r[1] for r in conn.exec_driver_sql('PRAGMA table_info(files)')}
            assert set(NEW_COLUMNS) <= cols
            tables = {r[0] for r in conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type = 'table'")}
            assert {'comments', 'downloads', 'real_people_anchors'} <= tables
            assert 'anchor_frame_id' in {r[1] for r in conn.exec_driver_sql('PRAGMA table_info(real_people)')}
            indexes = {r[1] for r in conn.exec_driver_sql('PRAGMA index_list(files)')}
            assert 'ix_files_deleted_at' in indexes
            rows = conn.exec_driver_sql('SELECT id, taken_at, frame_embedding_status, deleted_at FROM files '
                                        'ORDER BY id').all()
            assert rows == [(1, '2025-10-20T14:25:26+00:00', 'pending', None), (2, None, 'pending', None),
                            (3, None, 'pending', None), (4, None, 'pending', None)]
    finally:
        engine.dispose()
        shutil.rmtree(os.path.dirname(path), ignore_errors=True)
