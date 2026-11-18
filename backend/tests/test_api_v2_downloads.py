"""契约（2026-09）：打包下载（媒体 FC 打 zip）和 FC 的任务回调。"""
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

from tests.conftest import MEDIA_TOKEN
from tests.schema import ISO_DATETIME, Nullable, Regex, assert_error, assert_shape

DOWNLOAD = {'id': Regex(r'^d_[0-9a-f]{32}$'), 'status': str, 'file_count': int, 'size': int, 'name': str,
            'url': Nullable(str), 'expires_at': Nullable(ISO_DATETIME), 'created_at': ISO_DATETIME,
            'error': Nullable(str)}


def _result(client, body, token=MEDIA_TOKEN):
    return client.post('/api/files/internal/job-result', json_body=body, headers={'X-Media-Token': token})


def test_create_download_invokes_fc(client, seed, fc):
    uid = seed.user()
    kw = dict(activity_date='2026-03-15', activity_name='春季例训')
    a = seed.file(uid, 'IMG_1.jpg', size=100, **kw)
    b = seed.file(uid, 'img_1.jpg', size=200, directory='x', **kw)      # 不分大小写也算重名
    c = seed.file(uid, 'IMG_1.jpg', size=300, directory='y', **kw)
    d = seed.file(uid, 'a:b.mp4', content_type='video/mp4', size=400, activity_date='2025-11-01',
                  activity_type='competition', activity_name=None)
    e = seed.file(uid, '', original_filename='原名.png', size=500, activity_date=None, activity_type=None,
                  activity_name=None)
    seed.exec("UPDATE files SET filename = '' WHERE id = ?", (e,))

    r = client.post('/api/downloads', json_body={'file_ids': [a, b, c, d, e, a], 'name': '2026-03-15 春季例训'},
                    user=uid)
    assert r.status == 201, r.text
    dl = assert_shape(r.json(), {'download': DOWNLOAD})['download']
    assert (dl['status'], dl['file_count'], dl['size'], dl['name']) == ('pending', 5, 1500, '2026-03-15 春季例训')
    assert dl['url'] is None and dl['expires_at'] is None and dl['error'] is None

    assert len(fc.calls) == 1
    path, body = fc.calls[0]
    assert path == '/jobs/zip'
    assert body['id'] == dl['id'] and body['out'] == f'media/_downloads/{dl["id"]}.zip'
    names = {item['key']: item['name'] for item in body['items']}
    assert len(names) == 5
    assert [names[seed.s3_key(k)] for k in (a, b, c)] == \
        ['2026-03-15 春季例训/IMG_1.jpg', '2026-03-15 春季例训/img_1 (2).jpg', '2026-03-15 春季例训/IMG_1 (3).jpg']
    assert names[seed.s3_key(d)] == '2025-11-01 比赛/a_b.mp4'      # 没有活动名用类型；非法字符换掉
    assert names[seed.s3_key(e)] == '未分类/原名.png'               # 显示名 filename || original_filename


def test_download_lifecycle(client, seed, fc, storage):
    uid, other = seed.user(), seed.user()
    fid = seed.file(uid, size=10)
    dl = client.post('/api/downloads', json_body={'file_ids': [fid]}, user=uid).json()['download']
    assert dl['name'].startswith('LockCloud ')
    url = f'/api/downloads/{dl["id"]}'
    assert_error(client.get(url, user=other), 403, 'DOWNLOAD_003')
    assert_error(client.get('/api/downloads/d_nope', user=uid), 404, 'DOWNLOAD_001')

    assert _result(client, {'job': 'zip', 'id': dl['id'], 'status': 'running'}).status == 200
    assert client.get(url, user=uid).json()['download']['status'] == 'running'

    r = _result(client, {'job': 'zip', 'id': dl['id'], 'status': 'ready', 'size': 1234, 'error': ''})
    assert r.status == 200 and r.json() == {'success': True}
    got = assert_shape(client.get(url, user=uid).json(), {'download': DOWNLOAD})['download']
    assert (got['status'], got['size']) == ('ready', 1234)
    signed = urlparse(got['url'])
    assert signed.path == f'/media/_downloads/{dl["id"]}.zip'
    assert parse_qs(signed.query)['response-content-disposition'][0].startswith('attachment;')
    assert got['expires_at'] is not None
    # 迟到的 running 不回退
    _result(client, {'job': 'zip', 'id': dl['id'], 'status': 'running'})
    assert client.get(url, user=uid).json()['download']['status'] == 'ready'

    # 一天后桶里的 zip 被生命周期规则删掉
    seed.exec('UPDATE downloads SET finished_at = ? WHERE id = ?',
              ((datetime.utcnow() - timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S.%f'), dl['id']))
    gone = client.get(url, user=uid).json()['download']
    assert gone['status'] == 'expired' and gone['url'] is None


def test_download_failed(client, seed, fc):
    uid = seed.user()
    fid = seed.file(uid)
    dl = client.post('/api/downloads', json_body={'file_ids': [fid]}, user=uid).json()['download']
    _result(client, {'job': 'zip', 'id': dl['id'], 'status': 'failed', 'error': '磁盘满了'})
    got = client.get(f'/api/downloads/{dl["id"]}', user=uid).json()['download']
    assert (got['status'], got['error'], got['url']) == ('failed', '磁盘满了', None)

    # FC 调不通：任务直接是 failed
    fc.fail = RuntimeError('connection refused')
    r = client.post('/api/downloads', json_body={'file_ids': [fid]}, user=uid)
    assert r.status == 201
    body = r.json()['download']
    assert body['status'] == 'failed' and 'connection refused' in body['error']


def test_download_validation(client, seed, fc):
    uid = seed.user()
    ok = seed.file(uid)
    big = seed.file(uid, size=8 * 1024 ** 3)
    gone = seed.file(uid)
    seed.trash(gone, uid)
    for bad in ({}, {'file_ids': []}, {'file_ids': 'x'}, {'file_ids': [True]}, {'file_ids': ['1']}):
        assert_error(client.post('/api/downloads', json_body=bad, user=uid), 400, 'VALIDATION_001')
    assert_error(client.post('/api/downloads', json_body={'file_ids': list(range(1, 502))}, user=uid),
                 400, 'DOWNLOAD_002')
    assert_error(client.post('/api/downloads', json_body={'file_ids': [ok, big]}, user=uid), 400, 'DOWNLOAD_002')
    err = assert_error(client.post('/api/downloads', json_body={'file_ids': [ok, gone, 99999]}, user=uid),
                       404, 'FILE_001')
    assert err['details'] == {'missing': [gone, 99999]}
    assert fc.calls == []
    assert_error(client.post('/api/downloads', json_body={'file_ids': [ok]}), 401, 'AUTH_001')


def test_job_result_auth_and_validation(client, seed):
    assert_error(_result(client, {'job': 'zip'}, token='wrong'), 401, 'UNAUTHORIZED', 'invalid token')
    assert_error(client.post('/api/files/internal/job-result', json_body={}), 401, 'UNAUTHORIZED')
    assert_error(_result(client, {'job': 'other', 'id': 'd_x', 'status': 'ready'}), 400, 'VALIDATION_001')
    assert_error(_result(client, {'job': 'zip', 'id': 'd_x', 'status': 'weird'}), 400, 'VALIDATION_001')
    assert_error(_result(client, {'job': 'zip', 'id': 'd_x', 'status': 'ready'}), 404, 'DOWNLOAD_001')
