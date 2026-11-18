"""契约：基础路由、错误格式、安全头、CORS、登录与用户、头像（问 LockAuth）。"""
from tests.conftest import JWT_SECRET, token_for
from tests.schema import USER, assert_error, assert_shape

# ---------------------------------------------------------------- 基础


def test_index(client):
    r = client.get('/')
    assert r.status == 200
    assert r.json() == {'status': 'ok', 'message': 'LockCloud API 正在运行'}


def test_health(client):
    r = client.get('/health')
    assert r.status == 200
    assert r.json() == {'status': 'healthy', 'service': 'lockcloud-backend'}


def test_unknown_route_is_json_404(client):
    assert_error(client.get('/api/nope'), 404, 'NOT_FOUND', '请求的资源不存在')


def test_wrong_method_is_json_405(client):
    assert_error(client.put('/health'), 405, 'METHOD_NOT_ALLOWED', '不支持的请求方法')


def test_security_headers(client):
    h = client.get('/health').headers
    assert h['X-Content-Type-Options'] == 'nosniff'
    assert h['X-Frame-Options'] == 'DENY'
    assert h['Strict-Transport-Security'].startswith('max-age=31536000')
    assert h['Referrer-Policy'] == 'strict-origin-when-cross-origin'
    assert h['Content-Security-Policy'] == "default-src 'self'"


def test_cors_allows_configured_origin_only(client):
    ok = client.options('/api/files', headers={
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
    })
    assert ok.status == 200
    assert ok.headers.get('Access-Control-Allow-Origin') == 'http://localhost:3000'
    assert ok.headers.get('Access-Control-Allow-Credentials') == 'true'

    bad = client.options('/api/files', headers={
        'Origin': 'https://evil.example',
        'Access-Control-Request-Method': 'GET',
    })
    assert bad.headers.get('Access-Control-Allow-Origin') is None


# ---------------------------------------------------------------- 令牌


def test_missing_token(client):
    assert_error(client.get('/api/auth/me'), 401, 'AUTH_001', '请先登录')


def test_garbage_token(client):
    r = client.get('/api/auth/me', headers={'Authorization': 'Bearer not-a-jwt'})
    assert_error(r, 401, 'AUTH_004', '无效的登录令牌')


def test_wrong_secret_token(client, seed):
    uid = seed.user()
    r = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token_for(uid, secret="other")}'})
    assert_error(r, 401, 'AUTH_004')


def test_expired_token(client, seed):
    uid = seed.user()
    r = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token_for(uid, expires_in=-60)}'})
    assert_error(r, 401, 'AUTH_004', '登录已过期，请重新登录')


def test_token_signed_by_lockauth_secret_works(client, seed):
    """LockAuth 和 LockCloud 共用 JWT_SECRET_KEY：sub 是字符串形式的用户 id。"""
    uid = seed.user()
    r = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token_for(uid, secret=JWT_SECRET)}'})
    assert r.status == 200


# ---------------------------------------------------------------- /me /refresh


def test_me_shape(client, seed, lockauth_avatars):
    lockauth_avatars.urls['awei@test.local'] = 'https://public.test/avatars/7/a.webp?x-oss-process=x'
    uid = seed.user('阿伟', email='AWei@test.local')
    r = client.get('/api/auth/me', user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {'success': bool, 'user': USER})
    assert body['success'] is True
    user = body['user']
    assert user['id'] == uid and user['name'] == '阿伟'
    assert user['avatar_url'] == 'https://public.test/avatars/7/a.webp?x-oss-process=x'   # 按邮箱对上，不分大小写
    assert 'avatar_key' not in user   # LockCloud 不存头像


def test_me_without_avatar(client, seed):
    uid = seed.user()
    assert client.get('/api/auth/me', user=uid).json()['user']['avatar_url'] is None


def test_me_unknown_user(client, seed):
    assert_error(client.get('/api/auth/me', user=9999), 404, 'AUTH_001', '账号不存在')


def test_me_inactive_user(client, seed):
    uid = seed.user(is_active=False)
    assert_error(client.get('/api/auth/me', user=uid), 401, 'AUTH_006')


def test_refresh_returns_new_token(client, seed):
    uid = seed.user()
    r = client.post('/api/auth/refresh', user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {'success': bool, 'message': str, 'token': str, 'user': USER})
    assert body['message'] == '令牌刷新成功'
    again = client.get('/api/auth/me', headers={'Authorization': f'Bearer {body["token"]}'})
    assert again.status == 200 and again.json()['user']['id'] == uid


def test_refresh_unknown_or_inactive(client, seed):
    assert_error(client.post('/api/auth/refresh', user=9999), 401, 'AUTH_001')
    uid = seed.user(is_active=False)
    assert_error(client.post('/api/auth/refresh', user=uid), 401, 'AUTH_006')


# ---------------------------------------------------------------- SSO 登录


def test_sso_config(client):
    r = client.get('/api/auth/sso/config')
    assert r.status == 200
    assert r.json() == {'success': True, 'sso_login_url': 'https://auth.test',
                        'sso_frontend_url': 'https://auth.test'}


def test_sso_login_requires_token(client):
    assert_error(client.post('/api/auth/sso/login', json_body={}), 400, 'VALIDATION_001', '请提供 SSO token')


def test_sso_login_creates_user_and_issues_token(client, seed, sso):
    sso.users['good'] = {'id': 42, 'email': 'New@Test.Local', 'name': '新人', 'avatar_key': 'avatars/42/x.webp'}
    r = client.post('/api/auth/sso/login', json_body={'token': 'good'})
    assert r.status == 200, r.text
    body = assert_shape(r.json(), {'success': bool, 'message': str, 'token': str, 'user': USER})
    assert body['message'] == '登录成功'
    assert body['user']['email'] == 'new@test.local'   # 邮箱转小写
    assert body['user']['name'] == '新人'
    assert 'avatar_key' not in body['user']   # LockAuth 给了也不存，头像显示时再问它
    assert body['user']['last_login'] is not None
    assert sso.calls[0][0] == 'https://auth-api.test/api/auth/verify-token'
    assert sso.calls[0][1] == {'token': 'good'}

    me = client.get('/api/auth/me', headers={'Authorization': f'Bearer {body["token"]}'})
    assert me.status == 200 and me.json()['user']['id'] == body['user']['id']


def test_sso_login_updates_existing_user(client, seed, sso):
    uid = seed.user('旧名', email='old@test.local')
    sso.users['t'] = {'id': 1, 'email': 'old@test.local', 'name': '新名', 'avatar_key': None}
    body = client.post('/api/auth/sso/login', json_body={'token': 't'}).json()
    assert body['user']['id'] == uid
    assert body['user']['name'] == '新名'


def test_sso_login_invalid_token(client, sso):
    assert_error(client.post('/api/auth/sso/login', json_body={'token': 'bad'}), 401,
                 'AUTH_INVALID_TOKEN', '登录已过期，请重新登录')


def test_sso_login_lockauth_down(client, sso):
    sso.down = True
    assert_error(client.post('/api/auth/sso/login', json_body={'token': 'x'}), 503, 'SSO_ERROR')


def test_sso_login_without_email(client, sso):
    sso.users['t'] = {'id': 1, 'email': '', 'name': 'x'}
    assert_error(client.post('/api/auth/sso/login', json_body={'token': 't'}), 400, 'SSO_ERROR',
                 '账号信息不完整，请联系管理员')


def test_sso_login_inactive_user(client, seed, sso):
    seed.user(email='off@test.local', is_active=False)
    sso.users['t'] = {'id': 1, 'email': 'off@test.local', 'name': 'x'}
    assert_error(client.post('/api/auth/sso/login', json_body={'token': 't'}), 401, 'AUTH_006')


def test_dev_login_disabled_by_default(client):
    r = client.post('/api/auth/dev/login', json_body={'email': 'a@b.c'})
    assert_error(r, 403, 'DEV_LOGIN_DISABLED')


def test_dev_login_when_enabled(client, monkeypatch):
    monkeypatch.setenv('DEV_LOGIN_ENABLED', 'true')
    r = client.post('/api/auth/dev/login', json_body={'email': 'Dev@Local.Test', 'name': '开发'})
    assert r.status == 200
    body = assert_shape(r.json(), {'success': bool, 'message': str, 'token': str, 'user': USER})
    assert body['message'] == '[开发模式] 登录成功'
    assert body['user']['email'] == 'dev@local.test'


# ---------------------------------------------------------------- 头像（归 LockAuth 管）


def test_avatar_write_routes_are_gone(client, seed):
    uid = seed.user()
    for method, path in [('POST', '/api/auth/avatar/upload-url'), ('POST', '/api/auth/avatar/confirm'),
                         ('DELETE', '/api/auth/avatar')]:
        err = assert_error(client.call(method, path, user=uid), 410, 'AVATAR_MOVED')
        assert err['manage_url'] == 'https://auth.test/dashboard/profile'


def test_old_avatar_routes_are_removed(client, seed):
    """头像归 LockAuth：签名地址、给老版 LockAuth 的内部接口都删了。"""
    uid = seed.user()
    assert client.get('/api/auth/avatar/signed-url', params={'avatar_key': 'avatars/1/a.webp'}, user=uid).status == 404
    assert client.get('/api/auth/sso-internal/avatar/1').status == 404
    assert client.post('/api/auth/sso-internal/avatars', json_body={'user_ids': [1]}).status == 404
    assert client.get('/api/auth/sso-internal/avatar/by-email', params={'email': 'a@b.c'}).status == 404


# ---------------------------------------------------------------- 头像：问 LockAuth


def test_avatar_lookup_asks_lockauth_once_and_caches(client, seed, lockauth_avatars):
    lockauth_avatars.urls['a@test.local'] = 'https://public.test/a.webp'
    a = seed.user(email='a@test.local')
    b = seed.user(email='b@test.local')
    assert client.get('/api/auth/me', user=a).json()['user']['avatar_url'] == 'https://public.test/a.webp'
    assert client.get('/api/auth/me', user=b).json()['user']['avatar_url'] is None
    assert len(lockauth_avatars.calls) == 1   # 整份缓存，不是每个人问一次
    url, params, headers = lockauth_avatars.calls[0]
    assert url == 'https://auth-api.test/api/auth/service/avatars'
    assert params == {'style': 'avatarmd'}
    assert headers == {'X-Service-Key': lockauth_avatars.KEY}


def test_avatar_lookup_survives_lockauth_down(client, seed, lockauth_avatars):
    lockauth_avatars.down = True
    uid = seed.user()
    r = client.get('/api/auth/me', user=uid)
    assert r.status == 200 and r.json()['user']['avatar_url'] is None
    client.get('/api/auth/me', user=uid)
    assert len(lockauth_avatars.calls) == 1   # 失败后隔一会儿再试，不是每个请求都去撞


def test_avatar_lookup_keeps_last_table_on_error(client, seed, lockauth_avatars, monkeypatch):
    import services.avatars as avatars
    lockauth_avatars.urls['a@test.local'] = 'https://public.test/a.webp'
    uid = seed.user(email='a@test.local')
    assert client.get('/api/auth/me', user=uid).json()['user']['avatar_url'] == 'https://public.test/a.webp'
    monkeypatch.setattr(avatars, '_fresh_until', 0.0)   # 到期了
    lockauth_avatars.status = 500
    assert client.get('/api/auth/me', user=uid).json()['user']['avatar_url'] == 'https://public.test/a.webp'


def test_avatar_lookup_skipped_without_service_key(client, seed, lockauth_avatars, monkeypatch):
    from config import settings
    monkeypatch.setattr(settings, 'lockauth_service_key', '')
    uid = seed.user()
    assert client.get('/api/auth/me', user=uid).json()['user']['avatar_url'] is None
    assert lockauth_avatars.calls == []

