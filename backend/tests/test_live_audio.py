"""2026-11：Live Photo 配对（照片 + 动态部分）和音频文件的接口。"""
import json
from urllib.parse import urlparse

from tests.conftest import MEDIA_TOKEN
from tests.schema import assert_shape

LIVE = '5F3B1C2A-1111-2222-3333-444455556666'


def _callback(client, seed, fid, **result):
    r = client.post('/api/files/internal/media-result', headers={'X-Media-Token': MEDIA_TOKEN},
                    json_body={'status': 'ready', 'key': seed.s3_key(fid), **result})
    assert r.status == 200, r.text


def _ids(client, uid):
    r = client.get('/api/files', user=uid)
    assert r.status == 200, r.text
    return [f['id'] for f in r.json()['files']]


def _live_pair(client, seed, uid, *, video_first=False):
    photo = seed.file(uid, 'IMG_0001.HEIC', content_type='image/heic', ext='.heic')
    video = seed.file(uid, 'IMG_0001.MOV', content_type='video/quicktime', ext='.mov')
    steps = [(video, {'kind': 'video', 'duration': 2.9, 'renditions': [720], 'poster': True, 'live_id': LIVE}),
             (photo, {'kind': 'image', 'width': 4032, 'height': 3024, 'orientation': 1, 'live_id': LIVE,
                      'preview': {'width': 4032, 'height': 3024}})]
    for fid, result in (steps if video_first else steps[::-1]):
        _callback(client, seed, fid, **result)
    return photo, video


def test_live_photo_pairs_and_hides_motion(client, seed):
    uid = seed.user()
    other = seed.file(uid, 'other.jpg')
    for video_first in (False, True):   # 谁先处理完都能配上
        photo, video = _live_pair(client, seed, uid, video_first=video_first)
        assert seed.one('SELECT live_photo_id FROM files WHERE id = ?', (video,))[0] == photo
        assert seed.one('SELECT live_video_id FROM files WHERE id = ?', (photo,))[0] == video
        ids = _ids(client, uid)
        assert photo in ids and video not in ids and other in ids
        assert client.get(f'/api/files/{video}', user=uid).status == 404
        f = client.get(f'/api/files/{photo}', user=uid).json()['file']
        assert f['live'] is True
        m = client.get(f'/api/files/{photo}/media', user=uid).json()
        assert m['kind'] == 'image' and m['live']['hls'] is True and m['live']['duration'] == 2.9
        assert f'/api/files/hls/{video}/' in m['live']['url']
    assert client.get(f'/api/files/{other}', user=uid).json()['file']['live'] is False


def test_live_photo_needs_same_uploader(client, seed):
    a, b = seed.user(), seed.user()
    photo = seed.file(a, 'IMG_0002.HEIC', content_type='image/heic', ext='.heic')
    video = seed.file(b, 'IMG_0002.MOV', content_type='video/quicktime', ext='.mov')
    _callback(client, seed, photo, kind='image', width=10, height=10, live_id=LIVE)
    _callback(client, seed, video, kind='video', duration=3, live_id=LIVE)
    assert seed.one('SELECT live_photo_id FROM files WHERE id = ?', (video,))[0] is None
    assert video in _ids(client, b)


def test_live_photo_follows_photo_through_trash(client, seed, storage):
    uid = seed.user()
    photo, video = _live_pair(client, seed, uid)
    assert client.delete(f'/api/files/{photo}', user=uid).status == 200
    assert seed.one('SELECT deleted_at IS NOT NULL FROM files WHERE id = ?', (video,))[0] == 1
    trash = client.get('/api/trash', user=uid).json()['files']
    assert [f['id'] for f in trash] == [photo]   # 动态部分不单列

    assert client.post(f'/api/trash/{photo}/restore', user=uid).status == 200
    assert seed.one('SELECT deleted_at FROM files WHERE id = ?', (video,))[0] is None
    assert video not in _ids(client, uid)   # 恢复后还是挂在照片名下

    client.delete(f'/api/files/{photo}', user=uid)
    video_key = seed.s3_key(video)
    assert client.delete(f'/api/trash/{photo}', user=uid).status == 200
    assert seed.one('SELECT COUNT(*) FROM files WHERE id IN (?, ?)', (photo, video))[0] == 0
    assert video_key in storage.deleted


def test_audio_media_and_card(client, seed, storage):
    uid = seed.user()
    wave = [10, 50, 100, 30]
    song = seed.file(uid, 'song.mp3', content_type='audio/mpeg', ext='.mp3', media_status='ready',
                     media_info={'kind': 'audio', 'duration': 183.2, 'playback': True, 'poster': True,
                                 'waveform': wave, 'beats': {'bpm': 104.0, 'count': 300}})
    bare = seed.file(uid, 'raw.wav', content_type='audio/wav', ext='.wav')
    key = seed.s3_key(song)

    f = client.get(f'/api/files/{song}', user=uid).json()['file']
    assert f['cover'] is True and f['waveform'] == wave and f['duration'] == 183.2
    assert client.get(f'/api/files/{bare}', user=uid).json()['file'].get('cover') is not True

    m = client.get(f'/api/files/{song}/media', user=uid).json()
    assert_shape(m, {'file_id': int, 'kind': str, 'status': str, 'width': None, 'height': None, 'duration': float,
                     'hdr': bool, 'audio': bool, 'taken_at': None,
                     'playback': {'url': str, 'hls': bool, 'qualities': []}, 'poster_url': str,
                     'sprite': None, 'preview_frames': None, 'beats': {'bpm': float, 'count': int},
                     'waveform': [int], 'lockai': None, 'errors': {}, 'expires_in': int})
    assert m['kind'] == 'audio' and urlparse(m['playback']['url']).path.endswith('/audio.m4a')
    assert urlparse(m['poster_url']).path.endswith('/poster.jpg')
    # 没处理完：放原文件，没有封面
    m = client.get(f'/api/files/{bare}/media', user=uid).json()
    assert urlparse(m['playback']['url']).path == '/' + seed.s3_key(bare) and m['poster_url'] is None

    # 卡片缩略图：有封面给封面
    r = client.get(f'/api/files/signed-url/{song}?style=thumbmobile', user=uid).json()
    assert urlparse(r['signed_url']).path.endswith('/poster.jpg')

    # 音频不用 LockAI 分析也能改八拍
    storage.objects[f'media/{key[6:38]}/beats.json'] = json.dumps(
        {'bpm': 120, 'times': [i * 0.5 for i in range(64)], 'sections': [[0, 0]]}).encode()
    r = client.get(f'/api/files/{song}/beats', user=uid)
    assert r.status == 200, r.text
    r = client.put(f'/api/files/{song}/beats/ones', json_body={'ones': [2.0]}, user=uid)
    assert r.status == 200, r.text
    assert r.json()['ones'] == [2.0]
