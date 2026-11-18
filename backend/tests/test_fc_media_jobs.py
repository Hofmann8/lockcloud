"""媒体 FC（fc/media/handler.py）的 HTTP 路由：/jobs/process、/jobs/zip 要令牌；OSS 触发的 /invoke 照旧。

不连 OSS：_bucket() 换成内存桶，oss2.resumable_upload 换成把本地 zip 读回来，回调的 requests.post 记下来。
"""
import io
import json
import os
import sys
import zipfile

import pytest

FC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'fc', 'media')
TOKEN = 'fc-test-token'
JOB_ID = 'd_' + 'a' * 32
OUT = f'media/_downloads/{JOB_ID}.zip'


class _Obj(io.BytesIO):
    def __init__(self, data: bytes):
        super().__init__(data)
        self.content_length = len(data)


class FakeBucket:
    def __init__(self, objects):
        self.objects = objects

    def get_object(self, key):
        import oss2
        if key not in self.objects:
            raise oss2.exceptions.NotFound(404, {}, b'', {})
        return _Obj(self.objects[key])


@pytest.fixture
def media_fc(monkeypatch, sso):
    if FC_DIR not in sys.path:
        sys.path.insert(0, FC_DIR)
    import handler
    monkeypatch.setattr(handler, 'CALLBACK_TOKEN', TOKEN)
    monkeypatch.setattr(handler, 'CALLBACK_URL', 'https://cloud.test/api/files/internal/media-result')
    monkeypatch.setattr(handler, 'JOB_CALLBACK_URL', '')
    state = {'uploads': {}, 'callbacks': [], 'handled': [],
             'bucket': FakeBucket({'files/a.mp4': b'A' * 1000, 'files/b.jpg': b'B' * 10, 'files/c.jpg': b'C'})}

    def upload(bucket, key, path, headers=None, **kw):
        with open(path, 'rb') as f:
            state['uploads'][key] = (f.read(), headers)

    class _R:
        status_code = 200

    def post(url, json=None, headers=None, timeout=None):
        state['callbacks'].append((url, json, headers))
        return _R()

    def handle(key, steps=None):
        state['handled'].append((key, steps))
        return {'key': key, 'status': 'ready'}

    monkeypatch.setattr(handler, '_bucket', lambda: state['bucket'])
    monkeypatch.setattr(handler.oss2, 'resumable_upload', upload)
    monkeypatch.setattr(handler.requests, 'post', post)
    monkeypatch.setattr(handler, 'handle', handle)
    state['client'] = handler.app.test_client()
    state['module'] = handler
    return state


def _post(media_fc, path, body, token=TOKEN):
    headers = {'X-Media-Token': token} if token is not None else {}
    return media_fc['client'].post(path, data=json.dumps(body), headers=headers, content_type='application/json')


def test_jobs_require_token(media_fc):
    for path in ('/jobs/process', '/jobs/zip'):
        assert _post(media_fc, path, {}, token=None).status_code == 401
        assert _post(media_fc, path, {}, token='wrong').status_code == 401
    media_fc['module'].CALLBACK_TOKEN = ''   # 没配令牌时一律拒绝
    assert _post(media_fc, '/jobs/zip', {}, token='').status_code == 401
    assert media_fc['handled'] == [] and media_fc['uploads'] == {}


def test_jobs_process(media_fc):
    key = 'files/' + 'b' * 32 + '.mp4'
    r = _post(media_fc, '/jobs/process', {'key': key, 'steps': ['sprite', 'beats']})
    assert r.status_code == 200 and r.get_json() == {'results': [{'key': key, 'status': 'ready'}]}
    assert media_fc['handled'] == [(key, ['sprite', 'beats'])]
    assert _post(media_fc, '/jobs/process', {'key': key}).status_code == 200
    assert media_fc['handled'][-1] == (key, None)
    assert _post(media_fc, '/jobs/process', {'key': key, 'steps': ['nope']}).status_code == 400
    assert _post(media_fc, '/jobs/process', {'key': 'media/x/poster.jpg'}).status_code == 400


def test_invoke_unchanged(media_fc):
    """OSS 触发器投递到 /invoke，不带令牌。"""
    key = 'files/' + 'c' * 32 + '.jpg'
    event = {'events': [{'oss': {'bucket': {'name': 'lock-cloud'}, 'object': {'key': key, 'size': 1}}}]}
    r = media_fc['client'].post('/invoke', data=json.dumps(event), content_type='application/json')
    assert r.status_code == 200 and media_fc['handled'] == [(key, None)]


def test_zip_job(media_fc):
    items = [{'key': 'files/a.mp4', 'name': '2026-03-15 春季例训/独舞.mp4'},
             {'key': 'files/b.jpg', 'name': '../../etc/passwd'},
             {'key': 'files/gone.jpg', 'name': '未分类/没了.jpg'},
             {'key': 'files/c.jpg', 'name': '未分类\\c.jpg'}]
    r = _post(media_fc, '/jobs/zip', {'id': JOB_ID, 'items': items, 'out': OUT})
    assert r.status_code == 200, r.data
    body = r.get_json()
    assert body['status'] == 'ready' and body['missing'] == ['files/gone.jpg']

    data, headers = media_fc['uploads'][OUT]
    assert headers == {'Content-Type': 'application/zip'} and body['size'] == len(data)
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        assert zf.namelist() == ['2026-03-15 春季例训/独舞.mp4', 'etc/passwd', '未分类/c.jpg']
        assert all(i.compress_type == zipfile.ZIP_STORED for i in zf.infolist())
        assert zf.read('2026-03-15 春季例训/独舞.mp4') == b'A' * 1000

    url = 'https://cloud.test/api/files/internal/job-result'
    assert [(u, j['status']) for u, j, _ in media_fc['callbacks']] == [(url, 'running'), (url, 'ready')]
    assert media_fc['callbacks'][-1][1] == {'job': 'zip', 'id': JOB_ID, 'status': 'ready', 'size': len(data), 'error': ''}
    assert media_fc['callbacks'][-1][2] == {'X-Media-Token': TOKEN}


def test_zip_job_all_missing_fails(media_fc):
    r = _post(media_fc, '/jobs/zip', {'id': JOB_ID, 'items': [{'key': 'files/none.jpg', 'name': 'x.jpg'}], 'out': OUT})
    assert r.status_code == 200 and r.get_json()['status'] == 'failed'
    assert media_fc['uploads'] == {}
    last = media_fc['callbacks'][-1][1]
    assert last['status'] == 'failed' and last['error']


def test_zip_job_validation(media_fc):
    ok = [{'key': 'files/a.mp4', 'name': 'a.mp4'}]
    assert _post(media_fc, '/jobs/zip', {'id': 'bad', 'items': ok, 'out': OUT}).status_code == 400
    assert _post(media_fc, '/jobs/zip', {'id': JOB_ID, 'items': ok, 'out': 'files/x.zip'}).status_code == 400
    assert _post(media_fc, '/jobs/zip', {'id': JOB_ID, 'items': [], 'out': OUT}).status_code == 400
    assert _post(media_fc, '/jobs/zip', {'id': JOB_ID, 'items': [{'key': 'media/x/y'}], 'out': OUT}).status_code == 400
    assert media_fc['callbacks'] == []


def test_job_callback_url_override(media_fc, monkeypatch):
    assert media_fc['module'].job_callback_url() == 'https://cloud.test/api/files/internal/job-result'
    monkeypatch.setattr(media_fc['module'], 'JOB_CALLBACK_URL', 'https://other.test/cb')
    assert media_fc['module'].job_callback_url() == 'https://other.test/cb'
