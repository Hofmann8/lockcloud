"""契约（2026-09）：评论。"""
from tests.schema import ISO_DATETIME, Nullable, assert_error, assert_shape

COMMENT = {'id': int, 'file_id': int, 'body': str, 't': Nullable(float),
           'user': {'id': int, 'name': str, 'avatar_url': Nullable(str)},
           'created_at': ISO_DATETIME, 'updated_at': ISO_DATETIME, 'can_delete': bool}
VIDEO = {'duration': 61.5}


def test_comments_list_order_and_can_delete(client, seed):
    me, other = seed.user(), seed.user('别人')
    admin = seed.user(is_admin=True)
    vid = seed.file(me, content_type='video/mp4', media_status='ready', media_info=VIDEO)
    no_t = seed.comment(vid, other, '整体不错', created_at='2026-09-01 10:00:00.000000')
    late = seed.comment(vid, me, '这里', t=34.5, created_at='2026-09-01 12:00:00.000000')
    early = seed.comment(vid, other, '同一时刻先发的', t=34.5, created_at='2026-09-01 11:00:00.000000')
    first = seed.comment(vid, other, '开头', t=1.0, created_at='2026-09-02 10:00:00.000000')

    r = client.get(f'/api/files/{vid}/comments', user=me)
    assert r.status == 200, r.text
    comments = assert_shape(r.json(), {'comments': [COMMENT]})['comments']
    assert [c['id'] for c in comments] == [first, early, late, no_t]   # t 正序，没有 t 的最后，同 t 按时间
    assert [c['can_delete'] for c in comments] == [False, False, True, False]
    assert comments[1]['user']['name'] == '别人'
    assert all(c['can_delete'] for c in client.get(f'/api/files/{vid}/comments', user=admin).json()['comments'])
    assert_error(client.get('/api/files/99999/comments', user=me), 404, 'FILE_001')


def test_create_comment(client, seed):
    uid = seed.user()
    vid = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=VIDEO)
    img = seed.file(uid)
    url = f'/api/files/{vid}/comments'

    r = client.post(url, json_body={'body': ' 第二个八拍手没到位 ', 't': 34.5}, user=uid)
    assert r.status == 201, r.text
    c = assert_shape(r.json(), {'comment': COMMENT})['comment']
    assert (c['body'], c['t'], c['file_id'], c['user']['id'], c['can_delete']) == \
        ('第二个八拍手没到位', 34.5, vid, uid, True)
    assert client.post(url, json_body={'body': '没有时刻'}, user=uid).json()['comment']['t'] is None
    assert client.post(url, json_body={'body': '整数', 't': 3}, user=uid).json()['comment']['t'] == 3.0
    assert client.post(f'/api/files/{img}/comments', json_body={'body': '图片也能评论'}, user=uid).status == 201

    for bad in ({'body': ''}, {'body': '   '}, {}, {'body': 'x' * 2001}, {'body': 'x', 't': -1},
                {'body': 'x', 't': 61.6}, {'body': 'x', 't': 'abc'}, {'body': 'x', 't': True}):
        assert_error(client.post(url, json_body=bad, user=uid), 400, 'VALIDATION_001')
    assert client.post(url, json_body={'body': 'x' * 2000, 't': 61.5}, user=uid).status == 201
    assert_error(client.post(f'/api/files/{img}/comments', json_body={'body': 'x', 't': 1}, user=uid),
                 400, 'VALIDATION_001')
    assert_error(client.post('/api/files/99999/comments', json_body={'body': 'x'}, user=uid), 404, 'FILE_001')
    assert_error(client.post(url, json_body={'body': 'x'}), 401, 'AUTH_001')


def test_delete_comment(client, seed):
    author, other = seed.user(), seed.user()
    admin = seed.user(is_admin=True)
    fid = seed.file(author)
    c1 = seed.comment(fid, author)
    c2 = seed.comment(fid, author)
    assert_error(client.delete(f'/api/comments/{c1}', user=other), 403, 'COMMENT_002')
    assert client.delete(f'/api/comments/{c1}', user=author).json() == {'success': True}
    assert_error(client.delete(f'/api/comments/{c1}', user=author), 404, 'COMMENT_001')
    assert client.delete(f'/api/comments/{c2}', user=admin).status == 200


def test_comments_hidden_with_trashed_file(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    cid = seed.comment(fid, uid)
    seed.trash(fid, uid)
    assert_error(client.get(f'/api/files/{fid}/comments', user=uid), 404, 'FILE_001')
    assert_error(client.post(f'/api/files/{fid}/comments', json_body={'body': 'x'}, user=uid), 404, 'FILE_001')
    assert_error(client.delete(f'/api/comments/{cid}', user=uid), 404, 'COMMENT_001')
    client.post(f'/api/trash/{fid}/restore', user=uid)
    assert len(client.get(f'/api/files/{fid}/comments', user=uid).json()['comments']) == 1
