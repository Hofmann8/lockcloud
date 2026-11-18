"""契约（2026-09）：视频里谁在什么时候出现（抽帧人脸，faces.frame_id = 帧号，时刻 = 帧号 × 抽帧间隔）。"""
from urllib.parse import parse_qs, urlparse

from tests.schema import FILE_DISPLAY, PAGINATION, Nullable, assert_error, assert_shape

INFO = {'duration': 60.0, 'frames': {'count': 30, 'interval': 2.0, 'width': 432, 'height': 768}}
SEGMENT = {'start': float, 'end': float}
FILE_BODY = {'file_id': int, 'people': [{'id': int, 'name': Nullable(str), 'thumb_url': Nullable(str),
                                         'segments': [SEGMENT], 'total': float}],
             'unidentified_count': int}


def test_file_appearances(client, seed):
    uid = seed.user()
    vid = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=INFO)
    rp = seed.real_person('小红')
    a = seed.person(real_person_id=rp)
    b = seed.person()
    # a：第 2、3、4 帧（4、6、8 秒）连着，第 7 帧（14 秒）隔 6 秒也连上 → 4–16；第 25 帧（50 秒）单独 → 50–52
    cover = None
    for i in (2, 3, 4, 7, 25):
        face = seed.face(vid, person_id=a, frame_id=i)
        cover = cover or face
    seed.set_person(a, cover_face_id=cover)
    seed.face(vid, person_id=b, frame_id=29)       # 58 秒，段尾不超过视频时长 60
    seed.face(vid, person_id=0, frame_id=5)
    seed.face(vid, person_id=a, frame_id=None)      # 不是抽帧来的脸不算

    r = client.get(f'/api/files/{vid}/appearances', user=uid)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), FILE_BODY)
    assert body['unidentified_count'] == 1
    first, second = body['people']
    assert (first['id'], first['name']) == (a, '小红')
    assert first['segments'] == [{'start': 4.0, 'end': 16.0}, {'start': 50.0, 'end': 52.0}]
    assert first['total'] == 14.0
    # 头像从抽帧图裁，不是从视频原文件
    thumb = urlparse(first['thumb_url'])
    assert thumb.path == f'/media/{seed.s3_key(vid)[6:38]}/frames/00002.jpg'
    assert 'crop' in parse_qs(thumb.query)['x-oss-process'][0]
    assert (second['id'], second['segments'], second['total']) == (b, [{'start': 58.0, 'end': 60.0}], 2.0)
    assert second['thumb_url'] is None


def test_file_appearances_empty_cases(client, seed):
    uid = seed.user()
    img = seed.file(uid)
    seed.face(img, person_id=seed.person())
    assert client.get(f'/api/files/{img}/appearances', user=uid).json() == \
        {'file_id': img, 'people': [], 'unidentified_count': 0}
    vid = seed.file(uid, content_type='video/mp4')
    assert client.get(f'/api/files/{vid}/appearances', user=uid).json()['people'] == []
    assert_error(client.get('/api/files/99999/appearances', user=uid), 404, 'FILE_001')
    seed.trash(vid, uid)
    assert_error(client.get(f'/api/files/{vid}/appearances', user=uid), 404, 'FILE_001')


def test_person_appearances(client, seed):
    uid = seed.user()
    p = seed.person(face_count=9)
    short = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=INFO)
    long = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=INFO)
    trashed = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=INFO)
    img = seed.file(uid)
    seed.face(short, person_id=p, frame_id=1)
    for i in range(0, 10):
        seed.face(long, person_id=p, frame_id=i)
    seed.face(trashed, person_id=p, frame_id=1)
    seed.trash(trashed, uid)
    seed.face(img, person_id=p)

    r = client.get(f'/api/files/persons/{p}/appearances', user=uid)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), {
        'person': {'id': int, 'name': Nullable(str), 'face_count': int},
        'videos': [{'file': FILE_DISPLAY, 'segments': [SEGMENT], 'total': float}],
        'pagination': PAGINATION})
    assert body['person'] == {'id': p, 'name': None, 'face_count': 9}
    assert [(v['file']['id'], v['total']) for v in body['videos']] == [(long, 20.0), (short, 2.0)]
    assert body['videos'][0]['segments'] == [{'start': 0.0, 'end': 20.0}]
    assert body['pagination'] == {'page': 1, 'per_page': 24, 'total': 2, 'pages': 1,
                                  'has_next': False, 'has_prev': False}
    page2 = client.get(f'/api/files/persons/{p}/appearances', params={'page': 2, 'per_page': 1}, user=uid).json()
    assert [v['file']['id'] for v in page2['videos']] == [short] and page2['pagination']['has_prev'] is True
    assert_error(client.get('/api/files/persons/99999/appearances', user=uid), 404, 'NOT_FOUND')
