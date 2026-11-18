"""契约（2026-09）：POST /api/search 统一搜索（照片、视频片段、你是不是要找）。"""
from urllib.parse import urlparse

import pytest

from tests.conftest import unit_vector
from tests.schema import FILE_DISPLAY, ISO_DATE, Nullable, assert_error, assert_shape

BODY = {
    'query': str, 'ms': int,
    'matches': {
        'people': [{'id': int, 'name': str, 'face_count': int, 'thumb_url': Nullable(str)}],
        'tags': [{'id': int, 'name': str, 'count': int}],
        'activities': [{'activity_date': ISO_DATE, 'activity_type': Nullable(str), 'activity_name': str,
                        'file_count': int}],
    },
    'photos': [{'file': FILE_DISPLAY, 'score': Nullable(float)}],
    'segments': [{'file': FILE_DISPLAY, 'start': float, 'end': float, 'at': float, 'frame_url': Nullable(str),
                  'score': float}],
}

FRAMES = {'duration': 60.0, 'frames': {'count': 30, 'interval': 2.0, 'width': 432, 'height': 768}}


def _search(client, uid, **body):
    r = client.post('/api/search', json_body=body, user=uid)
    assert r.status == 200, r.text
    return assert_shape(r.json(), BODY)


def test_search_photos_and_segments(client, seed, embedding):
    uid = seed.user()
    near = seed.file(uid, 'near.jpg')
    far = seed.file(uid, 'far.jpg')
    gone = seed.file(uid, 'gone.jpg')
    seed.image_embedding(near, unit_vector(0, 768, mix=(1, 0.1)))
    seed.image_embedding(far, unit_vector(5, 768))
    seed.image_embedding(gone, unit_vector(0, 768))
    seed.trash(gone, uid)

    vid = seed.file(uid, 'dance.mp4', content_type='video/mp4', media_status='ready', media_info=FRAMES)
    # 34、36、38 秒连着命中（间隔 ≤ 4 秒合成一段，38 秒最像）；50 秒单独一段
    seed.frame_embedding(vid, 34000, unit_vector(0, 768, mix=(1, 0.3)))
    seed.frame_embedding(vid, 36000, unit_vector(0, 768, mix=(1, 0.2)))
    seed.frame_embedding(vid, 38000, unit_vector(0, 768, mix=(1, 0.05)))
    seed.frame_embedding(vid, 50000, unit_vector(0, 768, mix=(1, 0.4)))
    embedding.vectors['蓝色队服'] = unit_vector(0, 768)

    body = _search(client, uid, q=' 蓝色队服 ', limit=10)
    assert body['query'] == '蓝色队服' and embedding.calls == ['蓝色队服']
    assert [p['file']['id'] for p in body['photos']] == [near, far]
    assert 0.9 < body['photos'][0]['score'] <= 1.0 and body['photos'][1]['score'] < 0.1

    segs = body['segments']
    assert [(s['start'], s['end'], s['at']) for s in segs] == [(34.0, 40.0, 38.0), (50.0, 52.0, 50.0)]
    assert segs[0]['file']['id'] == vid and segs[0]['score'] > segs[1]['score']
    assert urlparse(segs[0]['frame_url']).path == f'/media/{seed.s3_key(vid)[6:38]}/frames/00019.jpg'

    # media_type 只要一种
    assert _search(client, uid, q='蓝色队服', filters={'media_type': 'image'})['segments'] == []
    assert _search(client, uid, q='蓝色队服', filters={'media_type': 'video'})['photos'] == []


@pytest.fixture
def gate(monkeypatch):
    """装一个参照向量（第 1 维 0.5）：相关度 = 和搜索词的相似度 - 0.5 × 第 1 维。"""
    from services import search_gate
    c = [0.0] * 768
    c[1] = 0.5
    monkeypatch.setattr(search_gate, '_centroid', lambda: {'model': 'test-model', 'vector': c})
    search_gate._usable.cache_clear()
    yield search_gate
    search_gate._usable.cache_clear()


def test_search_keeps_only_relevant(client, seed, embedding, gate):
    uid = seed.user()
    hit = seed.file(uid, 'hit.jpg')
    weak = seed.file(uid, 'weak.jpg')
    faint = seed.file(uid, 'faint.jpg')
    generic = seed.file(uid, 'generic.jpg')
    seed.image_embedding(hit, unit_vector(0, 768, mix=(2, 0.1)))
    seed.image_embedding(weak, unit_vector(5, 768, mix=(0, 0.1)))      # 0.11，过线
    seed.image_embedding(faint, unit_vector(5, 768, mix=(0, 0.03)))    # 0.03，不过线
    seed.image_embedding(generic, unit_vector(1, 768))                 # 对什么词都像的那种，减掉以后是负的

    vid = seed.file(uid, 'dance.mp4', content_type='video/mp4', media_status='ready', media_info=FRAMES)
    other = seed.file(uid, 'other.mp4', content_type='video/mp4', media_status='ready', media_info=FRAMES)
    for ms, vector in ((10000, unit_vector(0, 768, mix=(2, 0.2))), (12000, unit_vector(0, 768, mix=(2, 0.1))),
                       (14000, unit_vector(5, 768)), (16000, unit_vector(5, 768)), (18000, unit_vector(5, 768)),
                       (20000, unit_vector(0, 768, mix=(2, 0.3)))):
        seed.frame_embedding(vid, ms, vector)
    for ms in (0, 2000, 4000):
        seed.frame_embedding(other, ms, unit_vector(1, 768))

    body = _search(client, uid, q='蛋糕', limit=60)
    assert [p['file']['id'] for p in body['photos']] == [hit, weak]
    assert body['photos'][1]['score'] >= gate.FLOOR
    # 不相关的帧不参与合并：整个视频不会连成一段，没有相关帧的视频不出现
    assert [(s['file']['id'], s['start'], s['end'], s['at']) for s in body['segments']] == [
        (vid, 10.0, 14.0, 12.0), (vid, 20.0, 22.0, 20.0)]

    embedding.vectors['大象'] = unit_vector(7, 768)     # 库里没有的东西：空，不拿最像的充数
    body = _search(client, uid, q='大象', limit=60)
    assert body['photos'] == [] and body['segments'] == []


def test_search_gate_needs_matching_model(gate, monkeypatch):
    assert gate.probe(unit_vector(0, 768), 'test-model').floor == gate.FLOOR
    raw = gate.probe(unit_vector(0, 768), 'another-model')     # 参照向量是别的模型算的：不减、不卡线
    assert raw.floor is None and raw.vector == unit_vector(0, 768) and raw.score(0.0) == 1.0
    assert gate.probe(unit_vector(0, 64), 'test-model').floor is None


def test_search_centroid_file():
    """仓库里的参照向量和默认模型配套。"""
    import json

    from services import embedding_service, search_gate
    data = json.loads(search_gate.PATH.read_text(encoding='utf-8'))
    assert data['model'] == embedding_service.DEFAULT_MODEL
    assert len(data['vector']) == data['dimension'] == embedding_service.DEFAULT_DIM


def test_search_filters(client, seed, embedding):
    uid = seed.user()
    a = seed.file(uid, activity_type='competition', activity_date='2025-05-20')
    b = seed.file(uid, activity_type='regular_training', activity_date='2025-06-01')
    c = seed.file(uid, activity_type='competition', activity_date='2024-05-20')
    for fid in (a, b, c):
        seed.image_embedding(fid, unit_vector(0, 768))
    rp = seed.real_person('小明')
    p1 = seed.person(face_count=3, real_person_id=rp)
    p2 = seed.person(face_count=1, real_person_id=rp)   # 同一个真人的另一个 cluster
    seed.face(a, person_id=p1)
    seed.face(b, person_id=p2)
    t = seed.tag('比赛', uid)
    seed.file_tag(a, t)
    seed.file_tag(c, t)

    def ids(**filters):
        return sorted(p['file']['id'] for p in _search(client, uid, q='x', filters=filters)['photos'])

    assert ids(activity_type='competition') == sorted([a, c])
    assert ids(date_from='2025-01-01', date_to='2025-05-31') == [a]
    assert ids(person_ids=[p2]) == sorted([a, b])   # 链到同一个真人的 cluster 都算
    assert ids(tags=['比赛']) == sorted([a, c])
    assert ids(tags=['比赛'], person_ids=[p1]) == [a]
    assert ids(media_type='all') == sorted([a, b, c])

    assert_error(client.post('/api/search', json_body={'q': 'x', 'filters': {'date_from': 'bad'}}, user=uid),
                 400, 'VALIDATION_001')
    assert_error(client.post('/api/search', json_body={'q': 'x', 'filters': {'media_type': 'pdf'}}, user=uid),
                 400, 'VALIDATION_001')
    assert_error(client.post('/api/search', json_body={'q': 'x', 'filters': {'person_ids': ['a']}}, user=uid),
                 400, 'VALIDATION_001')


def test_search_filters_only(client, seed, embedding):
    uid = seed.user()
    early = seed.file(uid, activity_type='competition', taken_at='2025-05-20T10:00:00')
    late = seed.file(uid, activity_type='competition', taken_at='2025-05-20T12:00:00')
    unknown = seed.file(uid, activity_type='competition')
    seed.file(uid, activity_type='team_building')
    body = _search(client, uid, filters={'activity_type': 'competition'})
    assert [p['file']['id'] for p in body['photos']] == [late, early, unknown]   # 拍摄时间倒序
    assert all(p['score'] is None for p in body['photos'])
    assert body['segments'] == [] and body['query'] == ''
    assert body['matches'] == {'people': [], 'tags': [], 'activities': []}
    assert embedding.calls == []   # 没有 q 不调模型


def test_search_matches(client, seed, embedding):
    uid = seed.user()
    img = seed.file(uid, activity_date='2025-05-20', activity_type='competition', activity_name='比赛初赛')
    seed.file(uid, activity_date='2025-06-01', activity_type='competition', activity_name='比赛')
    rp = seed.real_person('比赛哥')
    face = seed.face(img, person_id=0)
    seed.person(face_count=4, cover_face_id=face, real_person_id=rp)
    t1 = seed.tag('比赛', uid)
    t2 = seed.tag('比赛日', uid)
    seed.tag('没人用', uid)
    seed.file_tag(img, t1)
    seed.file_tag(img, t2)

    m = _search(client, uid, q='比赛')['matches']
    assert [(p['name'], p['face_count']) for p in m['people']] == [('比赛哥', 4)]
    assert m['people'][0]['thumb_url']
    assert [t['name'] for t in m['tags']] == ['比赛', '比赛日']    # 精确的在前
    assert [a['activity_name'] for a in m['activities']] == ['比赛', '比赛初赛']
    assert m['activities'][0]['file_count'] == 1


def test_search_validation_and_errors(client, seed, embedding, monkeypatch):
    uid = seed.user()
    assert_error(client.post('/api/search', json_body={}, user=uid), 400, 'VALIDATION_001')
    assert_error(client.post('/api/search', json_body={'q': '  ', 'filters': {'media_type': 'all'}}, user=uid),
                 400, 'VALIDATION_001')
    assert_error(client.post('/api/search', json_body={'q': 'x'}), 401, 'AUTH_001')

    embedding.fail = RuntimeError('quota')
    assert_error(client.post('/api/search', json_body={'q': 'x'}, user=uid), 502, 'SEARCH_002')

    from services import embedding_service

    def not_configured(cls):
        raise embedding_service.EmbeddingConfigError('DASHSCOPE_API_KEY not set')
    monkeypatch.setattr(embedding_service.EmbeddingClient, 'from_env', classmethod(not_configured))
    err = assert_error(client.post('/api/search', json_body={'q': 'x'}, user=uid), 503, 'SEARCH_001')
    assert err['message'] == '搜索暂不可用'   # 配置细节只进日志，不给用户看


@pytest.fixture
def limited():
    from ratelimit import limiter
    limiter.enabled = True
    limiter.clear()
    yield
    limiter.enabled = False
    limiter.clear()


def test_search_rate_limit(client, seed, limited):
    uid = seed.user()
    codes = [client.post('/api/search', json_body={'filters': {'media_type': 'image'}}, user=uid).status
             for _ in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429
