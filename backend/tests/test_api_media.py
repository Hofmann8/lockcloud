"""契约：访问地址（用途 → OSS 处理参数）、HLS 播放列表、媒体 FC 回调。"""
import json
import re
import time
from urllib.parse import parse_qs, urlparse

from tests.conftest import MEDIA_TOKEN
from tests.schema import assert_error, assert_shape

READY_VIDEO = {'kind': 'video', 'duration': 12.0, 'width': 1920, 'height': 1080,
               'renditions': [1080, 720], 'poster': True}

MASTER = """#EXTM3U
#EXT-X-VERSION:3
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080,CODECS="avc1.64002a,mp4a.40.2"
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3500000,RESOLUTION=1280x720,CODECS="avc1.640028,mp4a.40.2"
720p/index.m3u8
"""

CHILD = """#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXTINF:4.000,
seg_00000.ts
#EXTINF:4.000,
seg_00001.ts
#EXT-X-ENDLIST
"""


def _query(url: str) -> dict:
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


def _signed(client, uid, fid, **params):
    r = client.get(f'/api/files/signed-url/{fid}', params=params, user=uid)
    assert r.status == 200, r.text
    return assert_shape(r.json(), {'success': bool, 'signed_url': str, 'expires_in': int, 'hls_ready': bool})


def _hex(seed, fid):
    return seed.s3_key(fid)[6:38]


# ---------------------------------------------------------------- 单个地址


def test_signed_url_image_styles(client, seed):
    uid = seed.user()
    fid = seed.file(uid, '合影.jpg')
    key = seed.s3_key(fid)

    thumb = _signed(client, uid, fid, style='thumbdesktop')
    assert thumb['signed_url'].startswith(f'https://oss.test/{key}?')
    assert _query(thumb['signed_url'])['x-oss-process'] == \
        'image/auto-orient,1/resize,m_lfit,w_720,h_720/quality,q_78/format,webp'
    assert thumb['expires_in'] == 3600 and thumb['hls_ready'] is False

    # 空、original、不认识的用途 → 原文件，下载名用数据库里的文件名
    for style in ['', 'original', 'w_9999/whatever']:
        q = _query(_signed(client, uid, fid, style=style)['signed_url'])
        assert 'x-oss-process' not in q
        assert q['response-content-disposition'] == "inline; filename*=UTF-8''%E5%90%88%E5%BD%B1.jpg"


def test_signed_url_expiration_is_clamped(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    assert _signed(client, uid, fid, expiration=10)['expires_in'] == 60
    assert _signed(client, uid, fid, expiration=10 ** 7)['expires_in'] == 86400
    assert _signed(client, uid, fid, expiration='abc')['expires_in'] == 3600
    assert _signed(client, uid, fid, expiration=7200)['expires_in'] == 7200


def test_signed_url_video_before_and_after_transcode(client, seed):
    uid = seed.user()
    pending = seed.file(uid, content_type='video/mp4')
    ready = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=READY_VIDEO)

    # 转码前：封面 OSS 实时截帧，播放给原文件
    cover = _signed(client, uid, pending, style='thumbdesktop')
    assert _query(cover['signed_url'])['x-oss-process'] == 'video/snapshot,t_1000,f_jpg,w_720,m_fast,ar_auto'
    play = _signed(client, uid, pending, style='hls:auto')
    assert play['hls_ready'] is False and play['signed_url'].startswith('https://oss.test/files/')

    # 转码后：封面用 poster.jpg，播放给后端改写的 HLS 地址（带完整域名）
    cover = _signed(client, uid, ready, style='videothumbnav')
    assert cover['signed_url'].startswith(f'https://oss.test/media/{_hex(seed, ready)}/poster.jpg?')
    assert _query(cover['signed_url'])['x-oss-process'] == 'image/resize,m_lfit,w_200,h_200/quality,q_80/format,webp'
    play = _signed(client, uid, ready, style='hls:auto')
    assert play['hls_ready'] is True
    assert re.fullmatch(rf'https?://[^/]+/api/files/hls/{ready}/\d+\.[0-9a-f]{{24}}/master\.m3u8', play['signed_url'])


def test_signed_url_unknown_file(client, seed):
    uid = seed.user()
    assert_error(client.get('/api/files/signed-url/99999', user=uid), 404, 'FILE_001')


# ---------------------------------------------------------------- 批量地址


def test_signed_urls_batch(client, seed):
    uid = seed.user()
    img = seed.file(uid)
    vid = seed.file(uid, content_type='video/mp4')
    r = client.post('/api/files/signed-urls', json_body={'file_ids': [img, vid, 99999], 'style': 'thumbmobile',
                                                         'expiration': 120}, user=uid)
    assert r.status == 200
    body = r.json()
    assert body['success'] is True and body['expires_in'] == 120
    assert set(body['urls']) == {str(img), str(vid)}   # 不存在的直接不返回；键是字符串
    assert_shape(body['urls'][str(img)], {'signed_url': str, 's3_key': str, 'content_type': str})
    assert 'w_480' in _query(body['urls'][str(img)]['signed_url'])['x-oss-process']
    # 视频没给 video_style 时，图片用途换成同尺寸的视频封面
    assert _query(body['urls'][str(vid)]['signed_url'])['x-oss-process'].startswith('video/snapshot,t_1000,f_jpg,w_480')

    r = client.post('/api/files/signed-urls', json_body={'file_ids': [vid], 'style': 'thumbmobile',
                                                         'video_style': 'original'}, user=uid)
    assert 'x-oss-process' not in _query(r.json()['urls'][str(vid)]['signed_url'])


def test_signed_urls_validation(client, seed):
    uid = seed.user()
    url = '/api/files/signed-urls'
    assert_error(client.post(url, json_body={}, user=uid), 400, 'VALIDATION_001', '缺少 file_ids 参数')
    assert_error(client.post(url, json_body={'file_ids': []}, user=uid), 400, 'VALIDATION_001', 'file_ids 必须是非空数组')
    assert_error(client.post(url, json_body={'file_ids': list(range(101))}, user=uid), 400, 'VALIDATION_001',
                 '单次最多请求 100 个文件')


# ---------------------------------------------------------------- 清晰度


def test_hls_qualities(client, seed):
    uid = seed.user()
    ready = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=READY_VIDEO)
    pending = seed.file(uid, content_type='video/mp4')
    img = seed.file(uid)
    assert client.get(f'/api/files/hls-qualities/{ready}', user=uid).json() == {
        'success': True,
        'qualities': [{'height': 1080, 'label': '1080p', 'playlist': '1080p/index.m3u8'},
                      {'height': 720, 'label': '720p', 'playlist': '720p/index.m3u8'}],
        'default_quality': 1080, 'hls_ready': True}
    assert client.get(f'/api/files/hls-qualities/{pending}', user=uid).json() == \
        {'success': True, 'qualities': [], 'default_quality': None, 'hls_ready': False}
    assert_error(client.get(f'/api/files/hls-qualities/{img}', user=uid), 400, 'VALIDATION_001', '只能对比视频')
    assert_error(client.get('/api/files/hls-qualities/99999', user=uid), 404, 'FILE_001')


# ---------------------------------------------------------------- HLS 播放列表


def _ready_with_playlists(seed, storage, uid):
    fid = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=READY_VIDEO)
    base = f'media/{_hex(seed, fid)}/hls/'
    storage.objects[base + 'master.m3u8'] = MASTER.encode()
    storage.objects[base + '1080p/index.m3u8'] = CHILD.encode()
    storage.objects[base + '720p/index.m3u8'] = CHILD.encode()
    return fid


def _token(client, uid, fid):
    url = client.get(f'/api/files/signed-url/{fid}', params={'style': 'hls:auto'}, user=uid).json()['signed_url']
    return url.split('/')[-2]


def test_hls_playlist_rewrite(client, seed, storage):
    uid = seed.user()
    fid = _ready_with_playlists(seed, storage, uid)
    token = _token(client, uid, fid)

    # 不需要登录头
    r = client.get(f'/api/files/hls/{fid}/{token}/master.m3u8')
    assert r.status == 200, r.text
    assert r.headers['Content-Type'] == 'application/vnd.apple.mpegurl'
    assert r.headers['Cache-Control'] == 'no-store'
    assert r.headers['Access-Control-Allow-Origin'] == '*'
    lines = r.text.splitlines()
    assert lines[:3] == ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-INDEPENDENT-SEGMENTS']
    assert f'/api/files/hls/{fid}/{token}/1080p/index.m3u8' in lines
    assert f'/api/files/hls/{fid}/{token}/720p/index.m3u8' in lines

    child = client.get(f'/api/files/hls/{fid}/{token}/720p/index.m3u8')
    assert child.status == 200
    segs = [line for line in child.text.splitlines() if line and not line.startswith('#')]
    hex_ = _hex(seed, fid)
    assert [s.split('?')[0] for s in segs] == [f'https://oss.test/media/{hex_}/hls/720p/seg_00000.ts',
                                              f'https://oss.test/media/{hex_}/hls/720p/seg_00001.ts']
    # 分片比播放列表多留一小时
    assert int(_query(segs[0])['expires']) > 6 * 3600
    assert '#EXT-X-ENDLIST' in child.text


def test_hls_playlist_rejects_bad_token(client, seed, storage):
    uid = seed.user()
    fid = _ready_with_playlists(seed, storage, uid)
    token = _token(client, uid, fid)
    for bad in ['nope', f'{int(time.time()) + 3600}.{"0" * 24}', f'{int(time.time()) - 10}.{token.split(".")[1]}']:
        assert_error(client.get(f'/api/files/hls/{fid}/{bad}/master.m3u8'), 403, 'AUTH_INVALID_TOKEN',
                     '播放地址已过期，请刷新页面')
    # token 绑定文件 id
    other = _ready_with_playlists(seed, storage, uid)
    assert_error(client.get(f'/api/files/hls/{other}/{token}/master.m3u8'), 403, 'AUTH_INVALID_TOKEN')


def test_hls_playlist_not_ready_or_bad_path(client, seed, storage):
    uid = seed.user()
    fid = _ready_with_playlists(seed, storage, uid)
    token = _token(client, uid, fid)
    # ".." 编码后发：HTTP 客户端会把明文的 ".." 在发出前就规整掉，到不了后端
    assert_error(client.get(f'/api/files/hls/{fid}/{token}/%2E%2E/%2E%2E/secret.m3u8'), 404, 'HLS_001')
    assert_error(client.get(f'/api/files/hls/{fid}/{token}/720p/seg_00000.ts'), 404, 'HLS_001')
    assert_error(client.get(f'/api/files/hls/{fid}/{token}/480p/index.m3u8'), 404, 'HLS_001', '播放列表不存在')

    pending = seed.file(uid, content_type='video/mp4')
    assert_error(client.get(f'/api/files/hls-proxy/{pending}/master.m3u8', user=uid), 404, 'HLS_001',
                 '视频正在处理，请稍后再试')


def test_hls_proxy_legacy_paths(client, seed, storage):
    """老 App：带登录头走 /hls-proxy，路径名是迁移前的。"""
    uid = seed.user()
    fid = _ready_with_playlists(seed, storage, uid)
    assert_error(client.get(f'/api/files/hls-proxy/{fid}/master.m3u8'), 401, 'AUTH_001')
    r = client.get(f'/api/files/hls-proxy/{fid}/medium/auto_medium.m3u8', user=uid)
    assert r.status == 200
    assert f'/api/files/hls-proxy/{fid}/720p/index.m3u8' in r.text.splitlines()
    r = client.get(f'/api/files/hls-proxy/{fid}/medium/480p_medium.m3u8', user=uid)
    assert r.status == 200 and '/720p/seg_00000.ts' in r.text
    assert_error(client.get('/api/files/hls-proxy/99999/master.m3u8', user=uid), 404, 'FILE_001')


def test_hls_1080p_falls_back_to_top_rendition(client, seed, storage):
    uid = seed.user()
    fid = seed.file(uid, content_type='video/mp4', media_status='ready',
                    media_info={**READY_VIDEO, 'renditions': [720]})
    storage.objects[f'media/{_hex(seed, fid)}/hls/720p/index.m3u8'] = CHILD.encode()
    r = client.get(f'/api/files/hls-proxy/{fid}/medium/1080p_medium.m3u8', user=uid)
    assert r.status == 200 and '/720p/seg_00000.ts' in r.text


# ---------------------------------------------------------------- 媒体 FC 回调


def _callback(client, body, token=MEDIA_TOKEN):
    return client.post('/api/files/internal/media-result', json_body=body, headers={'X-Media-Token': token})


def test_media_callback_auth(client):
    assert_error(_callback(client, {'key': 'x'}, token='wrong'), 401, 'UNAUTHORIZED', 'invalid token')
    assert_error(client.post('/api/files/internal/media-result', json_body={}), 401, 'UNAUTHORIZED')


def test_media_callback_before_confirm(client):
    r = _callback(client, {'key': 'files/' + 'a' * 32 + '.mp4', 'status': 'ready'})
    assert r.status == 202
    assert r.json() == {'success': True, 'pending': True}
    assert _callback(client, {'key': '../x', 'status': 'ready'}).status == 202


def test_media_callback_updates_file(client, seed):
    uid = seed.user()
    fid = seed.file(uid, content_type='video/mp4')
    key = seed.s3_key(fid)
    r = _callback(client, {
        'status': 'ready', 'kind': 'video', 'version': 2, 'width': 720, 'height': 1280, 'duration': 61.766,
        'hdr': False, 'audio': True, 'taken_at': '2025-10-20T14:25:26+00:00', 'thumbhash': 'necFFAQ5',
        'renditions': [720], 'poster': True,
        'sprite': {'count': 62, 'sheets': 1, 'cols': 10, 'width': 90, 'height': 160, 'interval': 1.0},
        'frames': {'count': 31, 'interval': 2.0, 'width': 432, 'height': 768},
        'beats': {'bpm': 115.04, 'count': 119},
        'key': key, 'elapsed': 12.5, 'something_new': 1})
    assert r.status == 200 and r.json() == {'success': True}

    status, thumbhash, info = seed.one('SELECT media_status, thumbhash, media_info FROM files WHERE id = ?', (fid,))
    assert (status, thumbhash) == ('ready', 'necFFAQ5')
    info = json.loads(info)
    assert info['renditions'] == [720] and info['beats']['bpm'] == 115.04 and info['sprite']['count'] == 62
    assert info['taken_at'] == '2025-10-20T14:25:26+00:00'
    assert 'key' not in info and 'elapsed' not in info and 'something_new' not in info   # 只存白名单里的

    f = client.get(f'/api/files/{fid}', user=uid).json()['file']
    assert (f['media_status'], f['duration'], f['width'], f['height']) == ('ready', 61.766, 720, 1280)


def test_media_callback_image_dims_and_failed(client, seed):
    uid = seed.user()
    img = seed.file(uid)
    _callback(client, {'status': 'ready', 'kind': 'image', 'width': 4000, 'height': 3000, 'orientation': 6,
                       'key': seed.s3_key(img)})
    assert seed.one('SELECT raw_w, raw_h, orientation FROM files WHERE id = ?', (img,)) == (4000, 3000, 6)

    vid = seed.file(uid, content_type='video/mp4')
    _callback(client, {'status': 'failed', 'kind': 'video', 'error': '没有视频流', 'key': seed.s3_key(vid)})
    status, info = seed.one('SELECT media_status, media_info FROM files WHERE id = ?', (vid,))
    assert status == 'failed' and json.loads(info)['error'] == '没有视频流'

    # 不认识的状态不动
    _callback(client, {'status': 'weird', 'key': seed.s3_key(vid)})
    assert seed.one('SELECT media_status FROM files WHERE id = ?', (vid,))[0] == 'failed'
