"""契约（2026-09）：播放器信息 /media、签名地址 download=1、节拍 GET、并排对齐、拍摄时间和排序。"""
import base64
import json
from urllib.parse import parse_qs, urlparse

import numpy as np

from tests.conftest import MEDIA_TOKEN
from tests.schema import Any, Nullable, assert_error, assert_shape

VIDEO_INFO = {
    'kind': 'video', 'version': 2, 'width': 720, 'height': 1280, 'duration': 61.77, 'hdr': False, 'audio': True,
    'renditions': [1080, 720], 'poster': True,
    'sprite': {'count': 162, 'sheets': 2, 'cols': 10, 'width': 90, 'height': 160, 'interval': 1.0},
    'frames': {'count': 31, 'interval': 2.0, 'width': 432, 'height': 768},
    'beats': {'bpm': 115.04, 'count': 119},
    'errors': {'frames': 'timeout'},
}

MEDIA_VIDEO = {
    'file_id': int, 'kind': str, 'status': str, 'width': Nullable(int), 'height': Nullable(int),
    'duration': Nullable(float), 'hdr': bool, 'audio': Nullable(bool), 'taken_at': Nullable(str),
    'playback': {'url': str, 'hls': bool, 'qualities': [int]},
    'poster_url': str,
    'sprite': Nullable({'sheets': [str], 'count': int, 'cols': int, 'rows': int, 'width': int, 'height': int,
                        'interval': float}),
    'preview_frames': Nullable({'times': [float], 'urls': [str], 'width': int, 'height': int}),
    'beats': Nullable({'bpm': float, 'count': int}),
    'lockai': Nullable({'status': str, 'requested_by': Nullable({'id': int, 'name': str}),
                        'requested_at': Nullable(str), 'finished_at': Nullable(str), 'chapters': Any}),
    'errors': Any, 'expires_in': int,
}
MEDIA_IMAGE = {'file_id': int, 'kind': str, 'status': str, 'width': Nullable(int), 'height': Nullable(int),
               'orientation': int, 'taken_at': Nullable(str), 'errors': Any, 'expires_in': int}
BEATS = {'bpm': float, 'times': [float], 'sections': [[int]], 'parts': [int], 'envelope_rate': float, 'envelope': str,
         'ones': [float], 'base_sections': [[int]], 'bounds': [int], 'editable': bool}


def _q(url):
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


def _hex(seed, fid):
    return seed.s3_key(fid)[6:38]


def _envelope(values) -> str:
    return base64.b64encode(np.clip(values, 0, 255).astype(np.uint8).tobytes()).decode()


TIMES = [round(0.52 * i, 2) for i in range(1, 21)]
SECTIONS = [[0, 3], [12, 13]]   # 第 12 拍起小节位置变了（剪辑接口）


def _beats_json(envelope_values=None):
    env = envelope_values if envelope_values is not None else np.zeros(100)
    return json.dumps({'bpm': 115.04, 'times': TIMES, 'sections': SECTIONS,
                       'envelope_rate': 43.07, 'envelope': _envelope(env)}).encode()


# ---------------------------------------------------------------- /media


def test_media_ready_video(client, seed):
    uid = seed.user()
    fid = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO,
                    taken_at='2025-10-20T14:25:26+00:00')
    r = client.get(f'/api/files/{fid}/media', user=uid)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), MEDIA_VIDEO)
    assert (body['file_id'], body['kind'], body['status']) == (fid, 'video', 'ready')
    assert (body['width'], body['height'], body['duration'], body['audio']) == (720, 1280, 61.77, True)
    assert body['taken_at'] == '2025-10-20T14:25:26+00:00'
    assert body['playback']['hls'] is True and body['playback']['qualities'] == [1080, 720]
    assert f'/api/files/hls/{fid}/' in body['playback']['url']
    assert body['poster_url'].startswith(f'https://oss.test/media/{_hex(seed, fid)}/poster.jpg?')
    sprite = body['sprite']
    assert [urlparse(u).path for u in sprite['sheets']] == [f'/media/{_hex(seed, fid)}/sprite/0.jpg',
                                                            f'/media/{_hex(seed, fid)}/sprite/1.jpg']
    assert (sprite['count'], sprite['cols'], sprite['rows'], sprite['interval']) == (162, 10, 10, 1.0)
    frames = body['preview_frames']   # 31 帧不到上限，全给；悬停预览用，转 webp
    assert len(frames['urls']) == 31 and frames['times'][:2] == [0.0, 2.0] and frames['times'][-1] == 60.0
    assert urlparse(frames['urls'][30]).path == f'/media/{_hex(seed, fid)}/frames/00030.jpg'
    assert _q(frames['urls'][0])['x-oss-process'] == 'image/format,webp/quality,q_75'
    assert body['beats'] == {'bpm': 115.04, 'count': 119}
    assert body['errors'] == {'frames': 'timeout'} and body['expires_in'] == 3600


def test_media_pending_video_and_image(client, seed):
    uid = seed.user()
    vid = seed.file(uid, content_type='video/mp4')
    body = assert_shape(client.get(f'/api/files/{vid}/media', user=uid).json(), MEDIA_VIDEO)
    assert body['status'] == 'pending' and body['playback']['hls'] is False
    assert body['playback']['url'].startswith('https://oss.test/files/')   # 处理中给原文件
    assert body['playback']['qualities'] == []
    assert _q(body['poster_url'])['x-oss-process'].startswith('video/snapshot')
    assert body['sprite'] is None and body['beats'] is None and body['errors'] == {}

    img = seed.file(uid, raw_w=4032, raw_h=3024, orientation=6, taken_at='2025-03-15T19:02:11')
    body = assert_shape(client.get(f'/api/files/{img}/media', user=uid).json(), MEDIA_IMAGE)
    assert (body['kind'], body['width'], body['height'], body['orientation']) == ('image', 4032, 3024, 6)
    assert body['taken_at'] == '2025-03-15T19:02:11'
    assert_error(client.get('/api/files/99999/media', user=uid), 404, 'FILE_001')


# ---------------------------------------------------------------- 签名地址 download=1


def test_signed_url_download_attachment(client, seed):
    uid = seed.user()
    fid = seed.file(uid, '合影.jpg')
    url = client.get(f'/api/files/signed-url/{fid}', params={'download': 1}, user=uid).json()['signed_url']
    assert _q(url)['response-content-disposition'] == "attachment; filename*=UTF-8''%E5%90%88%E5%BD%B1.jpg"
    url = client.get(f'/api/files/signed-url/{fid}', user=uid).json()['signed_url']
    assert _q(url)['response-content-disposition'].startswith('inline;')
    # 只对原文件有效：缩略图不管
    url = client.get(f'/api/files/signed-url/{fid}', params={'download': 1, 'style': 'thumbdesktop'},
                     user=uid).json()['signed_url']
    assert 'response-content-disposition' not in _q(url)


# ---------------------------------------------------------------- 节拍


def test_beats_get(client, seed, storage):
    """八拍谁都能看；改走 /beats/ones 和修改申请（test_beat_grid.py），老的 PUT /beats 没有了。"""
    owner, other = seed.user('上传的人'), seed.user('别人')
    fid = seed.file(owner, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO)
    storage.objects[f'media/{_hex(seed, fid)}/beats.json'] = _beats_json()

    r = client.get(f'/api/files/{fid}/beats', user=other)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), BEATS)
    # 拍点连着没断：一段连续的音乐只定一个小节位置（beat_this 中途改口的不算），只有一个段落
    assert (body['sections'], body['parts']) == ([[0, 3]], [0])
    assert (body['ones'], body['base_sections'], body['bounds'], body['editable']) == ([], [[0, 3]], [0], False)
    assert body['times'] == TIMES and body['envelope_rate'] == 43.07
    assert client.put(f'/api/files/{fid}/beats', json_body={'reset': True}, user=owner).status == 405


def test_beats_default_parts():
    """算法默认在音乐停了一阵的地方分段落；连着的剪辑接口不分。"""
    from services.beat_grid import default_parts
    times = [0.5 * i for i in range(16)] + [20 + 0.5 * i for i in range(16)]
    assert default_parts(times, [[0, 0], [8, 9], [16, 16]]) == [0, 16]
    assert default_parts(times, [[0, 0]]) == [0]


def test_beats_missing(client, seed, storage):
    uid = seed.user()
    no_audio = seed.file(uid, content_type='video/mp4', media_status='ready', media_info={**VIDEO_INFO, 'beats': None})
    assert_error(client.get(f'/api/files/{no_audio}/beats', user=uid), 404, 'MEDIA_002')
    not_in_bucket = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO)
    assert_error(client.get(f'/api/files/{not_in_bucket}/beats', user=uid), 404, 'MEDIA_002')
    assert_error(client.get('/api/files/99999/beats', user=uid), 404, 'FILE_001')


# ---------------------------------------------------------------- 对齐


def _onsets(seconds, seed_value, rate=43.07):
    rng = np.random.default_rng(seed_value)
    x = np.zeros(int(seconds * rate))
    idx = rng.choice(len(x), int(seconds * 4), replace=False)
    x[idx] = rng.uniform(120, 255, len(idx))
    return x


def test_align(client, seed, storage):
    uid = seed.user()
    rate = 43.07
    music = _onsets(90, 1)
    shift = int(round(1.24 * rate))
    env_a = music[:int(60 * rate)]
    env_b = np.concatenate([np.zeros(shift), music[:int(70 * rate)]])   # b 晚 1.24 秒开始放同一首歌
    a = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO)
    b = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO)
    other = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO)
    none = seed.file(uid, content_type='video/mp4', media_status='ready', media_info={**VIDEO_INFO, 'beats': None})
    storage.objects[f'media/{_hex(seed, a)}/beats.json'] = _beats_json(env_a)
    storage.objects[f'media/{_hex(seed, b)}/beats.json'] = _beats_json(env_b)
    storage.objects[f'media/{_hex(seed, other)}/beats.json'] = _beats_json(_onsets(60, 7))

    r = client.get('/api/compare/align', params={'a': a, 'b': b}, user=uid)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), {'offset': float, 'confidence': float, 'method': str})
    assert abs(body['offset'] - 1.24) < 0.03 and body['confidence'] > 0.8 and body['method'] == 'onset'
    back = client.get('/api/compare/align', params={'a': b, 'b': a}, user=uid).json()
    assert abs(back['offset'] + 1.24) < 0.03

    assert client.get('/api/compare/align', params={'a': a, 'b': other}, user=uid).json()['confidence'] < 0.3

    assert_error(client.get('/api/compare/align', params={'a': a, 'b': a}, user=uid), 400, 'VALIDATION_001')
    assert_error(client.get('/api/compare/align', params={'a': a}, user=uid), 400, 'VALIDATION_001')
    assert_error(client.get('/api/compare/align', params={'a': a, 'b': none}, user=uid), 404, 'MEDIA_002')
    assert_error(client.get('/api/compare/align', params={'a': a, 'b': 99999}, user=uid), 404, 'FILE_001')


# ---------------------------------------------------------------- 拍摄时间、方向、排序


def test_file_taken_at_and_orientation(client, seed):
    uid = seed.user()
    img = seed.file(uid, orientation=6, taken_at='2025-03-15T19:02:11+08:00')
    vid = seed.file(uid, content_type='video/mp4', orientation=6)
    f = client.get(f'/api/files/{img}', user=uid).json()['file']
    assert (f['taken_at'], f['orientation']) == ('2025-03-15T19:02:11+08:00', 6)
    f = client.get(f'/api/files/{vid}', user=uid).json()['file']
    assert (f['taken_at'], f['orientation']) == (None, 1)   # 视频永远是 1


def test_media_callback_writes_taken_at(client, seed):
    uid = seed.user()
    fid = seed.file(uid, content_type='video/mp4')
    r = client.post('/api/files/internal/media-result', headers={'X-Media-Token': MEDIA_TOKEN}, json_body={
        'status': 'ready', 'kind': 'video', 'taken_at': '2025-10-20T14:25:26+00:00', 'key': seed.s3_key(fid)})
    assert r.status == 200
    assert client.get(f'/api/files/{fid}', user=uid).json()['file']['taken_at'] == '2025-10-20T14:25:26+00:00'
    # 回调里拍摄时间是空串时不覆盖
    client.post('/api/files/internal/media-result', headers={'X-Media-Token': MEDIA_TOKEN}, json_body={
        'status': 'ready', 'kind': 'video', 'taken_at': '', 'key': seed.s3_key(fid)})
    assert seed.one('SELECT taken_at FROM files WHERE id = ?', (fid,))[0] == '2025-10-20T14:25:26+00:00'


def test_list_sort(client, seed):
    uid = seed.user()
    a = seed.file(uid, 'b.jpg', activity_date='2025-03-01', taken_at='2025-03-01T10:00:00',
                  uploaded_at='2025-03-05 00:00:00.000000')
    b = seed.file(uid, 'a.jpg', activity_date='2025-03-02', taken_at='2025-03-01T10:00:00',
                  uploaded_at='2025-03-04 00:00:00.000000')
    c = seed.file(uid, 'c.jpg', activity_date='2025-03-03', taken_at=None, uploaded_at='2025-03-06 00:00:00.000000')
    d = seed.file(uid, 'd.jpg', activity_date='2025-02-01', taken_at='2025-01-01T00:00:00',
                  uploaded_at='2025-03-01 00:00:00.000000')

    def ids(**params):
        r = client.get('/api/files', params=params, user=uid)
        assert r.status == 200, r.text
        return [f['id'] for f in r.json()['files']]

    assert ids() == [c, b, a, d]                      # 默认：活动日期倒序
    assert ids(sort='activity') == [c, b, a, d]
    assert ids(sort='taken') == [d, b, a, c]          # 拍摄时间正序；同一时刻按显示名；没有的排后面
    assert ids(sort='uploaded') == [c, a, b, d]       # 上传时间倒序
    assert ids(sort='taken', activity_date='2025-03-01', activity_name='周末特训',
               activity_type='regular_training') == [a]
    assert_error(client.get('/api/files', params={'sort': 'size'}, user=uid), 400, 'VALIDATION_001')


def test_preview_frames_sampled():
    """帧多的长视频均匀挑 60 张，头尾都在。"""
    from types import SimpleNamespace
    from routers.media import PREVIEW_FRAMES, _preview_frames
    f = SimpleNamespace(s3_key='files/' + 'a' * 32 + '.mp4')
    out = _preview_frames(f, {'frames': {'count': 300, 'interval': 2.0, 'width': 432, 'height': 768}})
    assert len(out['urls']) == len(out['times']) == PREVIEW_FRAMES
    assert out['times'][0] == 0.0 and out['times'][-1] == 598.0
    assert out['times'] == sorted(out['times'])
    assert _preview_frames(f, {}) is None
