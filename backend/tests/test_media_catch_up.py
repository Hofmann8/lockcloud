"""回调没送到时的补收：列表、详情、播放器信息替还在处理中的文件去桶里读 media.json。"""
import json
from datetime import datetime, timedelta

import pytest

from services import media


@pytest.fixture(autouse=True)
def _fresh():
    media._caught.clear()
    yield
    media._caught.clear()


def _result(storage, seed, fid, **result):
    key = seed.s3_key(fid)
    storage.objects[f'media/{key[6:38]}/media.json'] = json.dumps({'status': 'ready', 'key': key, **result}).encode()


def _status(seed, fid):
    return seed.one('SELECT media_status FROM files WHERE id = ?', (fid,))[0]


def test_list_detail_and_media_pick_up_results(client, seed, storage):
    uid = seed.user()
    old = datetime.utcnow() - timedelta(minutes=5)
    song = seed.file(uid, 'song.m4a', content_type='audio/mp4', ext='.m4a', uploaded_at=old)
    photo = seed.file(uid, 'a.jpg', uploaded_at=old)
    clip = seed.file(uid, 'b.mp4', content_type='video/mp4', ext='.mp4', uploaded_at=old)
    _result(storage, seed, song, kind='audio', duration=180.0, playback=True, waveform=[1, 2, 3])
    _result(storage, seed, photo, kind='image', width=40, height=30)
    _result(storage, seed, clip, kind='video', duration=3.0, renditions=[720], poster=True)

    files = {f['id']: f for f in client.get('/api/files', user=uid).json()['files']}
    assert files[song]['media_status'] == 'ready' and files[song]['waveform'] == [1, 2, 3]
    assert _status(seed, song) == 'ready' and _status(seed, photo) == 'ready' and _status(seed, clip) == 'ready'


def test_single_file_endpoints(client, seed, storage):
    uid = seed.user()
    old = datetime.utcnow() - timedelta(minutes=5)
    a = seed.file(uid, 'a.m4a', content_type='audio/mp4', ext='.m4a', uploaded_at=old)
    b = seed.file(uid, 'b.m4a', content_type='audio/mp4', ext='.m4a', uploaded_at=old)
    _result(storage, seed, a, kind='audio', duration=10.0, playback=True)
    _result(storage, seed, b, kind='audio', duration=10.0, playback=True)

    assert client.get(f'/api/files/{a}', user=uid).json()['file']['media_status'] == 'ready'
    m = client.get(f'/api/files/{b}/media', user=uid).json()
    assert m['status'] == 'ready' and m['playback']['url'].split('?')[0].endswith('/audio.m4a')


def test_leaves_fresh_and_rechecks_later(client, seed, storage, monkeypatch):
    uid = seed.user()
    fresh = seed.file(uid, 'new.jpg')                     # 刚传：FC 一般会先回调，先不去看
    _result(storage, seed, fresh, kind='image', width=4, height=3)
    client.get('/api/files', user=uid)
    assert _status(seed, fresh) == 'pending'

    slow = seed.file(uid, 'slow.jpg', uploaded_at=datetime.utcnow() - timedelta(minutes=5))
    client.get('/api/files', user=uid)                    # 桶里还没有结果
    _result(storage, seed, slow, kind='image', width=4, height=3)
    client.get('/api/files', user=uid)                    # 刚看过，不马上再看
    assert _status(seed, slow) == 'pending'

    monkeypatch.setattr(media, 'CATCH_UP_EVERY', 0)
    client.get('/api/files', user=uid)
    assert _status(seed, slow) == 'ready'


def test_bucket_errors_are_ignored(client, seed, storage, monkeypatch):
    uid = seed.user()
    fid = seed.file(uid, 'a.jpg', uploaded_at=datetime.utcnow() - timedelta(minutes=5))

    def boom(key):
        raise RuntimeError('OSS 不可用（测试注入）')

    monkeypatch.setattr(storage, 'get_text', boom)
    from services.storage import storage as real
    monkeypatch.setattr(real, 'get_text', boom)
    r = client.get('/api/files', user=uid)
    assert r.status == 200 and _status(seed, fid) == 'pending'
