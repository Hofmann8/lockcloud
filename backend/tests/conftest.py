"""契约测试的夹具。

- 不读 .env：导入 app 之前把 dotenv.load_dotenv 换成空函数，所有配置用下面的假值。
- 库：临时 SQLite，用 tests/db_schema.sql 建表；每个测试开始前清空。
  测试数据用 sqlite3 直接写（Seeder），不经过 ORM。
- 登录：用 PyJWT 按 flask-jwt-extended 的格式签令牌（LockAuth 签的令牌就是这个格式）。
- 外部服务（OSS、DashScope、LockAuth）全换成 tests/fakes.py 里的桩。
- 限流关掉（RATELIMIT_ENABLED=false），定时任务不启动；TestClient 不进 lifespan。

app 从 LOCKCLOUD_ASGI_APP（默认 asgi:app）导入。
"""
from __future__ import annotations

import importlib
import json
import os
import sqlite3
import sys
import tempfile
import time
import uuid
from datetime import datetime

import pytest

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

# ---------------------------------------------------------------- 配置（必须在导入 app 之前）

import dotenv  # noqa: E402

dotenv.load_dotenv = lambda *a, **k: False

_TMP = tempfile.mkdtemp(prefix='lockcloud_contract_')
DB_PATH = os.path.join(_TMP, 'contract.db')

JWT_SECRET = 'test-jwt-secret'
MEDIA_TOKEN = 'test-media-token'
TEST_ENV = {
    'FLASK_ENV': 'development',
    'SECRET_KEY': 'test-secret-key',
    'JWT_SECRET_KEY': JWT_SECRET,
    'DATABASE_URL': 'sqlite:///' + DB_PATH.replace('\\', '/'),
    'OSS_ACCESS_KEY_ID': 'test-key',
    'OSS_ACCESS_KEY_SECRET': 'test-secret',
    'OSS_BUCKET': 'lock-cloud',
    'MEDIA_CALLBACK_TOKEN': MEDIA_TOKEN,
    'DASHSCOPE_API_KEY': '',
    'FACE_FC_ENDPOINT': '',
    'DEV_LOGIN_ENABLED': 'false',
    'CORS_ORIGINS': 'http://localhost:3000',
    'SSO_AUTH_API_URL': 'https://auth-api.test',
    'SSO_AUTH_FRONTEND_URL': 'https://auth.test',
    'LOCKAUTH_SERVICE_KEY': '',
    'LOCKCLOUD_SCHEDULER_DISABLED': '1',
    'RATELIMIT_ENABLED': 'false',
}
os.environ.update(TEST_ENV)

# ---------------------------------------------------------------- 库

VEC_TABLES = {'faces': 'face_id', 'image_embeddings': 'file_id', 'video_frame_embeddings': 'frame_id'}
PLAIN_TABLES = ('lockai_jobs', 'beat_fixes', 'comments', 'downloads', 'file_tags', 'file_requests', 'file_logs', 'upload_tickets', 'tags', 'files',
                'users', 'persons', 'real_people', 'real_people_anchors')


def connect() -> sqlite3.Connection:
    import sqlite_vec
    con = sqlite3.connect(DB_PATH, isolation_level=None, timeout=10)
    con.enable_load_extension(True)
    sqlite_vec.load(con)
    con.enable_load_extension(False)
    return con


def _create_schema():
    with open(os.path.join(os.path.dirname(__file__), 'db_schema.sql'), encoding='utf-8') as f:
        ddl = f.read()
    con = connect()
    con.executescript(ddl)
    con.close()


def _wipe():
    con = connect()
    for table, pk in VEC_TABLES.items():
        for (rid,) in con.execute(f'SELECT {pk} FROM {table}').fetchall():
            con.execute(f'DELETE FROM {table} WHERE {pk} = ?', (rid,))
    for table in PLAIN_TABLES:
        con.execute(f'DELETE FROM {table}')
    con.execute("DELETE FROM sqlite_sequence")
    con.close()


_create_schema()


# ---------------------------------------------------------------- 客户端

class Resp:
    def __init__(self, status: int, headers, body: bytes):
        self.status = status
        self.headers = headers
        self.body = body

    def json(self):
        return json.loads(self.body.decode('utf-8'))

    @property
    def text(self) -> str:
        return self.body.decode('utf-8', errors='replace')


class Client:
    def __init__(self, app):
        from fastapi.testclient import TestClient
        self._c = TestClient(app)

    def call(self, method, path, *, json_body=None, content=None, params=None, headers=None, user=None):
        headers = dict(headers or {})
        if user is not None:
            headers['Authorization'] = f'Bearer {token_for(user)}'
        kwargs = {'headers': headers, 'params': params}
        if json_body is not None:
            kwargs['json'] = json_body
        elif content is not None:
            kwargs['content'] = content
        r = self._c.request(method, path, **kwargs)
        return Resp(r.status_code, r.headers, r.content)

    def get(self, path, **kw):
        return self.call('GET', path, **kw)

    def post(self, path, **kw):
        return self.call('POST', path, **kw)

    def put(self, path, **kw):
        return self.call('PUT', path, **kw)

    def patch(self, path, **kw):
        return self.call('PATCH', path, **kw)

    def delete(self, path, **kw):
        return self.call('DELETE', path, **kw)

    def options(self, path, **kw):
        return self.call('OPTIONS', path, **kw)


def token_for(user_id, *, expires_in: int = 3600, secret: str = JWT_SECRET, **claims) -> str:
    """跟 flask-jwt-extended 签出来的访问令牌同一格式。"""
    import jwt
    now = int(time.time())
    payload = {'sub': str(user_id), 'type': 'access', 'fresh': False, 'jti': uuid.uuid4().hex,
               'iat': now, 'nbf': now, 'exp': now + expires_in, **claims}
    return jwt.encode(payload, secret, algorithm='HS256')


# ---------------------------------------------------------------- app

@pytest.fixture(scope='session')
def app():
    spec = os.environ.get('LOCKCLOUD_ASGI_APP', 'asgi:app')
    module_name, _, attr = spec.partition(':')
    return getattr(importlib.import_module(module_name), attr or 'app')


@pytest.fixture(scope='session')
def client(app):
    return Client(app)


# ---------------------------------------------------------------- 每个测试：清库 + 换桩

@pytest.fixture(autouse=True)
def fresh_db():
    _wipe()
    yield


@pytest.fixture(autouse=True)
def storage(monkeypatch, app):
    from tests.fakes import FakeStorage
    return FakeStorage().install(monkeypatch)


@pytest.fixture(autouse=True)
def embedding(monkeypatch, app):
    from tests.fakes import FakeEmbedding
    return FakeEmbedding().install(monkeypatch)


@pytest.fixture(autouse=True)
def sso(monkeypatch, app):
    from tests.fakes import FakeSSO
    return FakeSSO().install(monkeypatch)


@pytest.fixture(autouse=True)
def lockauth_avatars(monkeypatch, app):
    from tests.fakes import FakeLockAuthAvatars
    fake = FakeLockAuthAvatars().install(monkeypatch)
    yield fake
    import services.avatars
    services.avatars.reset_cache()


@pytest.fixture(autouse=True)
def fc(monkeypatch, app):
    from tests.fakes import FakeMediaFC
    return FakeMediaFC().install(monkeypatch)


# ---------------------------------------------------------------- 测试数据

def _ts(value=None) -> str:
    value = value or datetime.utcnow()
    if isinstance(value, str):
        return value
    return value.strftime('%Y-%m-%d %H:%M:%S.%f')


class Seeder:
    def __init__(self):
        self._n = 0

    def _next(self) -> int:
        self._n += 1
        return self._n

    def exec(self, sql: str, params=()) -> int:
        con = connect()
        try:
            cur = con.execute(sql, params)
            return cur.lastrowid
        finally:
            con.close()

    def one(self, sql: str, params=()):
        con = connect()
        try:
            return con.execute(sql, params).fetchone()
        finally:
            con.close()

    def all(self, sql: str, params=()):
        con = connect()
        try:
            return con.execute(sql, params).fetchall()
        finally:
            con.close()

    # ------------------------------------------------------------
    def user(self, name=None, *, email=None, is_admin=False, is_active=True, created_at=None) -> int:
        n = self._next()
        return self.exec(
            'INSERT INTO users (email, name, created_at, last_login, is_active, is_admin) '
            'VALUES (?, ?, ?, NULL, ?, ?)',
            (email or f'user{n}@test.local', name or f'用户{n}', _ts(created_at),
             int(is_active), int(is_admin)))

    def file(self, uploader_id: int, filename=None, *, content_type='image/jpeg', ext=None,
             activity_date='2025-03-15', activity_type='regular_training', activity_name='周末特训',
             size=1000, s3_key=None, uploaded_at=None, media_status='pending', media_info=None,
             thumbhash=None, raw_w=None, raw_h=None, orientation=1, original_filename=None,
             directory=None, taken_at=None, deleted_at=None, deleted_by=None) -> int:
        n = self._next()
        if ext is None:
            ext = '.mp4' if content_type.startswith('video/') else '.jpg'
        filename = filename or f'file{n}{ext}'
        if s3_key is None:
            s3_key = f'files/{uuid.uuid4().hex}{ext}'
        if directory is None:
            if activity_date and activity_type:
                y, m = activity_date[:4], activity_date[5:7]
                directory = f'{activity_type}/{y}/{m}'
            else:
                directory = 'legacy'
        if isinstance(media_info, dict):
            media_info = json.dumps(media_info)
        return self.exec(
            'INSERT INTO files (filename, directory, s3_key, size, content_type, uploader_id, uploaded_at, '
            'original_filename, activity_date, activity_type, activity_name, is_legacy, thumbhash, '
            'embedding_status, face_status, raw_w, raw_h, orientation, media_status, media_info, '
            'taken_at, deleted_at, deleted_by) '
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?)",
            (filename, directory, s3_key, size, content_type, uploader_id, _ts(uploaded_at),
             original_filename or filename, activity_date, activity_type, activity_name, thumbhash,
             raw_w, raw_h, orientation, media_status, media_info, taken_at,
             _ts(deleted_at) if deleted_at else None, deleted_by))

    def trash(self, file_id: int, by: int, at=None) -> None:
        """把文件放进回收站（软删除）。"""
        self.exec('UPDATE files SET deleted_at = ?, deleted_by = ? WHERE id = ?', (_ts(at), by, file_id))

    def comment(self, file_id: int, user_id: int, body='评论', t=None, created_at=None) -> int:
        return self.exec('INSERT INTO comments (file_id, user_id, body, t, created_at, updated_at) '
                         'VALUES (?, ?, ?, ?, ?, ?)', (file_id, user_id, body, t, _ts(created_at), _ts(created_at)))

    def s3_key(self, file_id: int) -> str:
        return self.one('SELECT s3_key FROM files WHERE id = ?', (file_id,))[0]

    def tag(self, name: str, created_by: int) -> int:
        return self.exec('INSERT INTO tags (name, created_at, created_by) VALUES (?, ?, ?)',
                         (name, _ts(), created_by))

    def file_tag(self, file_id: int, tag_id: int) -> None:
        self.exec('INSERT INTO file_tags (file_id, tag_id, created_at) VALUES (?, ?, ?)',
                  (file_id, tag_id, _ts()))

    def ticket(self, s3_key: str, user_id: int, *, filename='a.jpg', content_type='image/jpeg', size=1000):
        self.exec('INSERT INTO upload_tickets (s3_key, user_id, filename, content_type, size, created_at) '
                  'VALUES (?, ?, ?, ?, ?, ?)', (s3_key, user_id, filename, content_type, size, _ts()))

    def log(self, user_id: int, operation='upload', *, file_id=None, file_path=None, timestamp=None) -> int:
        # SQLAlchemy 的 Enum 列存的是枚举名（UPLOAD），不是值
        return self.exec(
            'INSERT INTO file_logs (user_id, file_id, operation, file_path, timestamp, ip_address, user_agent) '
            'VALUES (?, ?, ?, ?, ?, ?, ?)',
            (user_id, file_id, operation.upper(), file_path, _ts(timestamp), '127.0.0.1', 'pytest'))

    def request(self, requester_id: int, owner_id: int, *, file_id=None, request_type='edit',
                status='pending', proposed_changes=None, directory_info=None, message=None) -> int:
        return self.exec(
            'INSERT INTO file_requests (file_id, requester_id, owner_id, request_type, status, proposed_changes, '
            'directory_info, message, response_message, created_at, updated_at) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',
            (file_id, requester_id, owner_id, request_type, status,
             json.dumps(proposed_changes) if proposed_changes is not None else None,
             json.dumps(directory_info) if directory_info is not None else None,
             message, _ts(), _ts()))

    # ------------------------------------------------------------ 人脸 / 向量
    def real_person(self, name=None, *, cover_pinned=0, anchor_file_id=None, anchor_bbox=None) -> int:
        bx, by, bw, bh = anchor_bbox or (None, None, None, None)
        return self.exec(
            'INSERT INTO real_people (name, cover_pinned, anchor_file_id, anchor_bbox_x, anchor_bbox_y, '
            'anchor_bbox_w, anchor_bbox_h, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (name, cover_pinned, anchor_file_id, bx, by, bw, bh, _ts(), _ts()))

    def person(self, *, face_count=1, cover_face_id=None, real_person_id=None) -> int:
        return self.exec(
            'INSERT INTO persons (name, face_count, cover_face_id, created_at, updated_at, cover_pinned, '
            'real_person_id) VALUES (NULL, ?, ?, ?, ?, 0, ?)',
            (face_count, cover_face_id, _ts(), _ts(), real_person_id))

    def set_person(self, person_id: int, **cols) -> None:
        sets = ', '.join(f'{k} = ?' for k in cols)
        self.exec(f'UPDATE persons SET {sets} WHERE id = ?', (*cols.values(), person_id))

    def face(self, file_id: int, *, person_id=0, bbox=(10, 20, 30, 40), confidence=0.9, vector=None,
             frame_id=None) -> int:
        import sqlite_vec
        vector = vector or unit_vector(0, 512)
        x, y, w, h = bbox
        return self.exec(
            'INSERT INTO faces (embedding, model_name, file_id, person_id, frame_id, bbox_x, bbox_y, bbox_w, '
            "bbox_h, confidence_bp, created_at) VALUES (?, 'buffalo_l', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (sqlite_vec.serialize_float32(vector), file_id, person_id, frame_id, x, y, w, h,
             int(round(confidence * 10000)), _ts()))

    def frame_embedding(self, file_id: int, timestamp_ms: int, vector) -> int:
        import sqlite_vec
        return self.exec("INSERT INTO video_frame_embeddings (embedding, model_name, file_id, timestamp_ms, "
                         "is_keyframe, created_at) VALUES (?, 'test-model', ?, ?, 0, ?)",
                         (sqlite_vec.serialize_float32(vector), file_id, int(timestamp_ms), _ts()))

    def image_embedding(self, file_id: int, vector) -> None:
        import sqlite_vec
        self.exec("INSERT INTO image_embeddings (file_id, embedding, model_name, created_at) "
                  "VALUES (?, ?, 'test-model', ?)", (file_id, sqlite_vec.serialize_float32(vector), _ts()))


def unit_vector(index: int, dim: int, *, mix=None) -> list[float]:
    """第 index 维是 1 的单位向量。mix=(另一维, 权重) 时两维混合后归一化，用来做"有点像"的向量。"""
    v = [0.0] * dim
    v[index] = 1.0
    if mix:
        other, weight = mix
        v[index] = 1.0 - weight
        v[other] = weight
        norm = sum(x * x for x in v) ** 0.5
        v = [x / norm for x in v]
    return v


@pytest.fixture
def seed():
    return Seeder()
