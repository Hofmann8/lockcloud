"""契约：AI 语义搜索、人脸、人物（cluster + 真人身份）、以脸搜脸。"""
from urllib.parse import parse_qs, urlparse

from tests.conftest import unit_vector
from tests.schema import BBOX, FILE_WITH_UPLOADER, Nullable, assert_error, assert_shape


def _process(url: str) -> str:
    return parse_qs(urlparse(url).query)['x-oss-process'][0]


# ---------------------------------------------------------------- AI 语义搜索


def test_ai_search_ranks_by_distance(client, seed, embedding):
    uid = seed.user()
    near = seed.file(uid, 'near.jpg')
    far = seed.file(uid, 'far.jpg')
    gone = 99999   # 文件删了、向量还在：跳过
    seed.image_embedding(near, unit_vector(0, 768, mix=(1, 0.1)))
    seed.image_embedding(far, unit_vector(5, 768))
    seed.image_embedding(gone, unit_vector(0, 768))
    embedding.vectors['跳舞'] = unit_vector(0, 768)

    r = client.post('/api/files/ai-search', json_body={'q': ' 跳舞 ', 'limit': 5}, user=uid)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), {'results': [{'rank': int, 'distance': float, 'file': FILE_WITH_UPLOADER}],
                                   'query': str, 'query_tokens': int, 'ms': int})
    assert body['query'] == '跳舞' and embedding.calls == ['跳舞']
    # rank 是向量近邻里的名次，被跳过的孤儿向量也占名次
    assert [(x['rank'], x['file']['id']) for x in body['results']] == [(2, near), (3, far)]
    assert body['results'][0]['distance'] < body['results'][1]['distance']


def test_ai_search_empty_and_errors(client, seed, embedding):
    uid = seed.user()
    assert_error(client.post('/api/files/ai-search', json_body={'q': '  '}, user=uid), 400, 'BAD_REQUEST',
                 '查询内容不能为空')
    empty = client.post('/api/files/ai-search', json_body={'q': 'x'}, user=uid).json()
    assert empty['results'] == [] and empty['query'] == 'x'
    embedding.fail = RuntimeError('quota')
    err = assert_error(client.post('/api/files/ai-search', json_body={'q': 'x'}, user=uid), 500, 'EMBED_FAILED')
    assert err['message'] == '搜索暂不可用，请稍后再试'   # 异常原文只进日志


# ---------------------------------------------------------------- 文件里的脸


def test_file_faces(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    p = seed.person()
    f1 = seed.face(fid, person_id=p, bbox=(1, 2, 3, 4), confidence=0.95)
    f2 = seed.face(fid, person_id=0, bbox=(5, 6, 7, 8), confidence=0.5)
    r = client.get(f'/api/files/{fid}/faces', user=uid)
    assert r.status == 200
    assert r.json() == {'file_id': fid, 'faces': [
        {'face_id': f1, 'person_id': p, 'bbox': {'x': 1, 'y': 2, 'w': 3, 'h': 4}, 'confidence': 0.95},
        {'face_id': f2, 'person_id': None, 'bbox': {'x': 5, 'y': 6, 'w': 7, 'h': 8}, 'confidence': 0.5},
    ]}
    assert client.get('/api/files/99999/faces', user=uid).json() == {'file_id': 99999, 'faces': []}


def test_file_people(client, seed):
    uid = seed.user()
    fid = seed.file(uid, raw_w=4000, raw_h=3000, orientation=6)
    rp = seed.real_person('阿伟')
    p = seed.person(face_count=7, real_person_id=rp)
    small = seed.face(fid, person_id=p, bbox=(0, 0, 10, 10), confidence=0.99)
    big = seed.face(fid, person_id=p, bbox=(100, 200, 300, 400), confidence=0.9)
    seed.set_person(p, cover_face_id=big)
    seed.face(fid, person_id=0)
    assert small

    r = client.get(f'/api/files/{fid}/people', user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {
        'file_id': int, 'unidentified_count': int,
        'file_dims': Nullable({'raw_w': int, 'raw_h': int, 'orientation': int}),
        'people': [{'id': int, 'name': Nullable(str), 'face_count': int, 'thumb_url': Nullable(str),
                    'best_face_in_file': {'face_id': int, 'bbox': BBOX}}]})
    assert body['file_dims'] == {'raw_w': 4000, 'raw_h': 3000, 'orientation': 6}
    assert body['unidentified_count'] == 1
    person = body['people'][0]
    assert (person['id'], person['name'], person['face_count']) == (p, '阿伟', 7)
    assert person['best_face_in_file'] == {'face_id': big, 'bbox': {'x': 100, 'y': 200, 'w': 300, 'h': 400}}
    # 头像：原始像素上裁脸，再按 EXIF 转正
    assert _process(person['thumb_url']) == \
        'image/auto-orient,0/crop,x_100,y_200,w_300,h_400/rotate,90/resize,m_lfit,w_200,h_200/quality,q_80/format,webp'


def test_file_people_empty_cases(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    assert client.get(f'/api/files/{fid}/people', user=uid).json() == \
        {'file_id': fid, 'people': [], 'unidentified_count': 0, 'file_dims': None}
    seed.face(fid, person_id=0)
    assert client.get(f'/api/files/{fid}/people', user=uid).json()['unidentified_count'] == 1


# ---------------------------------------------------------------- 人物列表 / 详情


def test_persons_list(client, seed):
    uid = seed.user()
    fid = seed.file(uid, raw_w=100, raw_h=100)
    rp = seed.real_person('阿伟', cover_pinned=1)
    named = seed.person(face_count=3, real_person_id=rp)
    face = seed.face(fid, person_id=named, bbox=(10, 10, 20, 20))
    seed.set_person(named, cover_face_id=face)
    anon = seed.person(face_count=9)
    seed.person(face_count=0)   # 空 cluster 不列
    r = client.get('/api/files/persons', user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {'total': int, 'persons': [{
        'id': int, 'name': Nullable(str), 'face_count': int, 'cover_face_id': Nullable(int),
        'cover_pinned': bool, 'thumb_url': Nullable(str), 'real_person_id': Nullable(int)}]})
    assert body['total'] == 2
    assert [p['id'] for p in body['persons']] == [anon, named]   # 脸多的在前
    assert body['persons'][0] == {'id': anon, 'name': None, 'face_count': 9, 'cover_face_id': None,
                                  'cover_pinned': False, 'thumb_url': None, 'real_person_id': None}
    assert body['persons'][1]['cover_pinned'] is True and body['persons'][1]['real_person_id'] == rp
    assert 'crop,x_10,y_10,w_20,h_20' in _process(body['persons'][1]['thumb_url'])
    assert len(client.get('/api/files/persons', params={'limit': 1}, user=uid).json()['persons']) == 1


def test_person_files(client, seed):
    uid = seed.user()
    a = seed.file(uid, uploaded_at='2025-01-01 00:00:00.000000')
    b = seed.file(uid, uploaded_at='2025-02-01 00:00:00.000000')
    p = seed.person(face_count=3)
    seed.face(a, person_id=p)
    seed.face(b, person_id=p)
    seed.face(b, person_id=p)
    r = client.get(f'/api/files/persons/{p}', user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {
        'person': {'id': int, 'name': Nullable(str), 'face_count': int},
        'files': [FILE_WITH_UPLOADER],
        'pagination': {'total': int, 'page': int, 'per_page': int, 'pages': int, 'has_next': bool, 'has_prev': bool}})
    assert [f['id'] for f in body['files']] == [b, a]   # 上传时间新的在前，同一文件只出现一次
    assert body['pagination'] == {'total': 2, 'page': 1, 'per_page': 24, 'pages': 1,
                                  'has_next': False, 'has_prev': False}

    lonely = seed.person(face_count=0)
    assert client.get(f'/api/files/persons/{lonely}', user=uid).json()['pagination'] == \
        {'total': 0, 'page': 1, 'per_page': 24, 'pages': 0, 'has_next': False, 'has_prev': False}
    assert_error(client.get('/api/files/persons/99999', user=uid), 404, 'NOT_FOUND', '人物不存在')


# ---------------------------------------------------------------- 命名、合并、换头像


def test_rename_person_creates_identity(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    p = seed.person()
    face = seed.face(fid, person_id=p, bbox=(1, 2, 3, 4))
    seed.set_person(p, cover_face_id=face)
    r = client.patch(f'/api/files/persons/{p}', json_body={'name': ' 阿伟 '}, user=uid)
    assert r.status == 200
    assert r.json() == {'id': p, 'name': '阿伟'}
    rp = seed.one('SELECT real_person_id FROM persons WHERE id = ?', (p,))[0]
    assert seed.one('SELECT name, anchor_file_id, anchor_bbox_x, anchor_bbox_h FROM real_people WHERE id = ?',
                    (rp,)) == ('阿伟', fid, 1, 4)

    # 已经有身份：直接改名；传空名字就清掉名字
    assert client.patch(f'/api/files/persons/{p}', json_body={'name': '伟哥'}, user=uid).json()['name'] == '伟哥'
    assert client.patch(f'/api/files/persons/{p}', json_body={'name': ''}, user=uid).json() == {'id': p, 'name': None}
    assert seed.one('SELECT name FROM real_people WHERE id = ?', (rp,))[0] is None


def test_rename_person_conflict_and_errors(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    existing = seed.real_person('阿伟', anchor_file_id=fid, anchor_bbox=(5, 5, 50, 50))
    other = seed.person(face_count=4, real_person_id=existing)
    assert other
    p = seed.person()
    face = seed.face(fid, person_id=p)
    seed.set_person(p, cover_face_id=face)

    err = assert_error(client.patch(f'/api/files/persons/{p}', json_body={'name': '阿伟'}, user=uid), 409,
                       'NAME_CONFLICT', '已存在同名人物「阿伟」')
    assert_shape(err['existing'], {'id': int, 'name': str, 'face_count': int, 'thumb_url': Nullable(str)})
    assert (err['existing']['id'], err['existing']['face_count']) == (existing, 4)
    assert 'crop,x_5,y_5,w_50,h_50' in _process(err['existing']['thumb_url'])

    no_cover = seed.person()
    assert_error(client.patch(f'/api/files/persons/{no_cover}', json_body={'name': '新人'}, user=uid), 400, 'NO_ANCHOR')
    assert_error(client.patch('/api/files/persons/99999', json_body={'name': 'x'}, user=uid), 404, 'NOT_FOUND')


def test_merge_person(client, seed):
    uid = seed.user()
    target = seed.real_person('阿伟')
    old = seed.real_person('临时名')
    p = seed.person(real_person_id=old)
    url = f'/api/files/persons/{p}/merge'

    r = client.post(url, json_body={'target_id': target}, user=uid)
    assert r.status == 200
    assert r.json() == {'merged_into_real_id': target, 'source_cluster_id': p, 'orphan_real_id_deleted': old}
    assert seed.one('SELECT COUNT(*) FROM real_people WHERE id = ?', (old,))[0] == 0

    assert client.post(url, json_body={'target_id': target}, user=uid).json() == \
        {'merged_into_real_id': target, 'source_cluster_id': p, 'orphan_real_id_deleted': None, 'noop': True}

    assert_error(client.post(url, json_body={}, user=uid), 400, 'BAD_REQUEST', 'target_id 必填')
    assert_error(client.post(url, json_body={'target_id': 99999}, user=uid), 404, 'NOT_FOUND')
    assert_error(client.post('/api/files/persons/99999/merge', json_body={'target_id': target}, user=uid), 404,
                 'NOT_FOUND', '人物不存在')


def test_merge_keeps_shared_identity(client, seed):
    uid = seed.user()
    target = seed.real_person('甲')
    shared = seed.real_person('乙')
    p1 = seed.person(real_person_id=shared)
    seed.person(real_person_id=shared)
    r = client.post(f'/api/files/persons/{p1}/merge', json_body={'target_id': target}, user=uid)
    assert r.json()['orphan_real_id_deleted'] is None   # 还有别的 cluster 指着它


def test_set_person_cover(client, seed):
    uid = seed.user()
    a, b = seed.file(uid), seed.file(uid)
    p = seed.person()
    fa = seed.face(a, person_id=p)
    fb_small = seed.face(b, person_id=p, bbox=(0, 0, 5, 5))
    fb_big = seed.face(b, person_id=p, bbox=(0, 0, 50, 50))
    seed.set_person(p, cover_face_id=fa)
    assert fb_small

    r = client.put(f'/api/files/persons/{p}/cover', json_body={'file_id': b}, user=uid)
    assert r.status == 200
    assert r.json() == {'id': p, 'cover_face_id': fb_big, 'cover_pinned': True}
    rp, cover = seed.one('SELECT real_person_id, cover_face_id FROM persons WHERE id = ?', (p,))
    assert cover == fb_big
    assert seed.one('SELECT name, cover_pinned, anchor_file_id, anchor_bbox_w FROM real_people WHERE id = ?',
                    (rp,)) == (None, 1, b, 50)

    # 已有身份：更新同一行，不新建
    client.put(f'/api/files/persons/{p}/cover', json_body={'file_id': a}, user=uid)
    assert seed.one('SELECT COUNT(*) FROM real_people')[0] == 1
    assert seed.one('SELECT anchor_file_id FROM real_people WHERE id = ?', (rp,))[0] == a


def test_set_person_cover_errors(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    p = seed.person()
    url = f'/api/files/persons/{p}/cover'
    assert_error(client.put(url, json_body={}, user=uid), 400, 'BAD_REQUEST', 'file_id 必填')
    assert_error(client.put(url, json_body={'file_id': fid}, user=uid), 400, 'NO_MATCHING_FACE')


# ---------------------------------------------------------------- 以脸搜脸


def test_face_search(client, seed):
    uid = seed.user()
    a, b, c = seed.file(uid), seed.file(uid), seed.file(uid)
    p = seed.person()
    query = seed.face(a, person_id=p, vector=unit_vector(0, 512))
    same_file = seed.face(a, vector=unit_vector(0, 512, mix=(1, 0.05)))
    close = seed.face(b, person_id=p, vector=unit_vector(0, 512, mix=(1, 0.1)))
    closer_dup = seed.face(b, vector=unit_vector(0, 512, mix=(1, 0.2)))
    far = seed.face(c, vector=unit_vector(3, 512))
    assert closer_dup

    r = client.post('/api/files/face-search', json_body={'face_id': query}, user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {'query_face_id': int, 'ms': int, 'results': [{
        'rank': int, 'face_id': int, 'similarity': float, 'person_id': Nullable(int), 'file': FILE_WITH_UPLOADER}]})
    assert body['query_face_id'] == query
    # 排除自己；同一文件只留最像的那张
    assert [(x['face_id'], x['file']['id']) for x in body['results']] == [(same_file, a), (close, b), (far, c)]
    assert body['results'][1]['person_id'] == p and body['results'][0]['person_id'] is None
    sims = [x['similarity'] for x in body['results']]
    assert sims == sorted(sims, reverse=True)

    limited = client.post('/api/files/face-search', json_body={'face_id': query, 'limit': 1}, user=uid).json()
    assert len(limited['results']) == 1


def test_face_search_errors(client, seed):
    uid = seed.user()
    assert_error(client.post('/api/files/face-search', json_body={}, user=uid), 400, 'BAD_REQUEST', 'face_id 必填')
    assert_error(client.post('/api/files/face-search', json_body={'face_id': 99999}, user=uid), 404, 'NOT_FOUND')
