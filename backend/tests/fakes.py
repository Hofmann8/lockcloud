"""契约测试里替换掉的外部服务：OSS、DashScope embedding、LockAuth SSO、媒体 FC 的 HTTP 触发器。

测试不连任何外部服务，也不读 .env 里的真钥匙。
签名地址是假的，但格式固定（https://oss.test/{key}?...），测试可以断言里面带了哪些参数。
"""
from __future__ import annotations

from typing import Optional
from urllib.parse import quote, urlencode

SIGN_BASE = 'https://oss.test/'


class FakeStorage:
    """替换 services.storage.storage 上的方法。对象存在内存里。"""

    METHODS = ('sign_get', 'sign_put', 'head', 'exists', 'put_bytes', 'get_bytes', 'get_text',
               'delete', 'delete_prefix', 'delete_file', 'list_keys')

    def __init__(self):
        self.objects: dict[str, bytes] = {}
        self.deleted: list[str] = []
        self.fail_delete = False

    # ------------------------------------------------------------ 签名
    def sign_get(self, key: str, expires: int = 3600, process: Optional[str] = None,
                 filename: Optional[str] = None, disposition: str = 'inline', internal: bool = False) -> str:
        params = {'expires': str(expires)}
        if process:
            params['x-oss-process'] = process
        if filename:
            params['response-content-disposition'] = f"{disposition}; filename*=UTF-8''{quote(filename)}"
        return SIGN_BASE + key + '?' + urlencode(params)

    def sign_put(self, key: str, content_type: str, expires: int = 3600) -> str:
        return SIGN_BASE + key + '?' + urlencode({'method': 'PUT', 'content-type': content_type})

    # ------------------------------------------------------------ 读写
    def head(self, key: str) -> Optional[int]:
        data = self.objects.get(key)
        return None if data is None else len(data)

    def exists(self, key: str) -> bool:
        return key in self.objects

    def put_bytes(self, key: str, data: bytes, content_type: str = 'application/octet-stream') -> None:
        self.objects[key] = data

    def get_bytes(self, key: str) -> Optional[bytes]:
        return self.objects.get(key)

    def get_text(self, key: str) -> Optional[str]:
        data = self.objects.get(key)
        return None if data is None else data.decode('utf-8')

    def delete(self, key: str) -> None:
        if self.fail_delete:
            raise RuntimeError('OSS 不可用（测试注入）')
        self.objects.pop(key, None)
        self.deleted.append(key)

    def delete_prefix(self, prefix: str) -> int:
        keys = [k for k in self.objects if k.startswith(prefix)]
        for k in keys:
            self.delete(k)
        return len(keys)

    def delete_file(self, key: str) -> None:
        from services.storage import is_file_key, media_prefix
        self.delete(key)
        if is_file_key(key):
            self.delete_prefix(media_prefix(key))

    def list_keys(self, prefix: str):
        for k in sorted(self.objects):
            if k.startswith(prefix):
                yield type('Obj', (), {'key': k, 'size': len(self.objects[k])})()

    def install(self, monkeypatch) -> 'FakeStorage':
        from services.storage import storage
        for name in self.METHODS:
            monkeypatch.setattr(storage, name, getattr(self, name))
        return self


class FakeEmbedding:
    """替换 EmbeddingClient.from_env()。embed_text 返回固定向量，可以指定每句话的向量。"""

    DIM = 768

    def __init__(self):
        self.vectors: dict[str, list[float]] = {}
        self.fail: Optional[Exception] = None
        self.calls: list[str] = []

    def unit(self, index: int) -> list[float]:
        v = [0.0] * self.DIM
        v[index] = 1.0
        return v

    def embed_text(self, text: str):
        self.calls.append(text)
        if self.fail:
            raise self.fail
        vector = self.vectors.get(text, self.unit(0))
        return type('EmbeddingResult', (), {'vector': vector, 'input_tokens': len(text), 'dim': self.DIM})()

    model = 'test-model'

    def embed_image_url(self, url: str):
        """worker 用：按地址（去掉查询串）返回预设向量，默认第 1 维。"""
        self.calls.append(url)
        if self.fail:
            raise self.fail
        vector = self.vectors.get(url.split('?', 1)[0], self.unit(1))
        return type('EmbeddingResult', (), {'vector': vector, 'input_tokens': 10, 'dim': self.DIM})()

    def install(self, monkeypatch) -> 'FakeEmbedding':
        from services import embedding_service
        monkeypatch.setattr(embedding_service.EmbeddingClient, 'from_env', classmethod(lambda cls: self))
        return self


class FakeSSO:
    """替换 LockAuth 的 /api/auth/verify-token。按 token 返回预设结果。"""

    def __init__(self):
        self.users: dict[str, dict] = {}   # token → LockAuth 返回的 user
        self.down = False
        self.calls: list[tuple[str, dict]] = []

    def post(self, url, json=None, timeout=None, **kwargs):
        import requests
        self.calls.append((url, json))
        if self.down:
            raise requests.ConnectionError('LockAuth 不可用（测试注入）')
        if not url.endswith('/api/auth/verify-token'):
            raise AssertionError(f'没料到会请求 {url}')
        user = self.users.get((json or {}).get('token'))
        if user is None:
            return _Resp(401, {'valid': False})
        return _Resp(200, {'valid': True, 'user': user})

    def install(self, monkeypatch) -> 'FakeSSO':
        import routers.auth
        monkeypatch.setattr(routers.auth.requests, 'post', self.post)
        return self


class FakeLockAuthAvatars:
    """替换 LockAuth 的 GET /api/auth/service/avatars（头像归 LockAuth，LockCloud 按邮箱问它）。"""

    KEY = 'svc-test-key'

    def __init__(self):
        self.urls: dict[str, str | None] = {}   # 邮箱 → 头像地址
        self.down = False
        self.status = 200
        self.calls: list[tuple[str, dict, dict]] = []

    def get(self, url, params=None, headers=None, timeout=None, **kwargs):
        import requests
        self.calls.append((url, params or {}, headers or {}))
        if self.down:
            raise requests.ConnectionError('LockAuth 不可用（测试注入）')
        if not url.endswith('/api/auth/service/avatars'):
            raise AssertionError(f'没料到会请求 {url}')
        users = [{'id': i + 1, 'email': e, 'avatar_url': u} for i, (e, u) in enumerate(self.urls.items())]
        return _Resp(self.status, {'success': True, 'users': users})

    def install(self, monkeypatch) -> 'FakeLockAuthAvatars':
        import services.avatars as avatars
        from config import settings
        monkeypatch.setattr(settings, 'lockauth_service_key', self.KEY)
        monkeypatch.setattr(avatars.requests, 'get', self.get)
        avatars.reset_cache()
        return self


class FakeMediaFC:
    """替换 services.fc_jobs.invoke：记下调用了哪个路径、带什么 body，不真的发请求。"""

    def __init__(self):
        self.calls: list[tuple[str, dict]] = []
        self.fail: Optional[Exception] = None

    def invoke(self, path: str, body: dict) -> None:
        if self.fail:
            raise self.fail
        self.calls.append((path, body))

    def install(self, monkeypatch) -> 'FakeMediaFC':
        from services import fc_jobs
        monkeypatch.setattr(fc_jobs, 'invoke', self.invoke)
        return self


class _Resp:
    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body
