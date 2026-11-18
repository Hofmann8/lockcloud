"""契约（2026-09）：删除改成进回收站；回收站列表、恢复、彻底删除、清空；进了回收站的文件处处不可见。"""
from datetime import datetime, timedelta

from tests.conftest import unit_vector
from tests.schema import FILE_DISPLAY, ISO_DATETIME, PAGINATION, Nullable, assert_error, assert_shape

TRASH_ITEM = {**FILE_DISPLAY, 'deleted_at': ISO_DATETIME, 'deleted_by': Nullable({'id': int, 'name': str}),
              'purge_at': ISO_DATETIME}


def _deleted(seed, fid):
    return seed.one('SELECT deleted_at, deleted_by FROM files WHERE id = ?', (fid,))


# ---------------------------------------------------------------- 删除 = 进回收站


def test_delete_moves_to_trash_and_keeps_everything(client, seed, storage):
    uid = seed.user()
    fid = seed.file(uid)
    key = seed.s3_key(fid)
    storage.objects.update({key: b'1', f'media/{key[6:38]}/poster.jpg': b'2'})
    seed.face(fid)
    seed.image_embedding(fid, [0.1] * 768)

    r = client.delete(f'/api/files/{fid}', user=uid)
    assert r.status == 200
    assert r.json() == {'success': True, 'message': '文件删除成功'}   # 响应体和以前一样
    deleted_at, deleted_by = _deleted(seed, fid)
    assert deleted_at and deleted_by == uid
    assert len(storage.objects) == 2 and storage.deleted == []        # 对象不动
    assert seed.one('SELECT COUNT(*) FROM faces')[0] == 1
    assert seed.one('SELECT COUNT(*) FROM image_embeddings')[0] == 1
    assert seed.one('SELECT operation FROM file_logs')[0] == 'DELETE'
    # 再删一次：已经不存在了
    assert_error(client.delete(f'/api/files/{fid}', user=uid), 404, 'FILE_001')


def test_batch_delete_moves_to_trash(client, seed, storage):
    uid = seed.user()
    a, b = seed.file(uid), seed.file(uid)
    storage.objects[seed.s3_key(a)] = b'x'
    r = client.post('/api/files/batch/delete', json_body={'file_ids': [a, b]}, user=uid)
    assert r.status == 200 and r.json()['results']['succeeded'] == [a, b]
    assert _deleted(seed, a)[1] == uid and _deleted(seed, b)[1] == uid
    assert seed.s3_key(a) in storage.objects
    again = client.post('/api/files/batch/delete', json_body={'file_ids': [a]}, user=uid)
    assert again.status == 400 and again.json()['results']['failed'] == [{'file_id': a, 'error': '文件不存在'}]


def test_approved_delete_request_moves_to_trash(client, seed, storage):
    owner, me = seed.user(), seed.user()
    fid = seed.file(owner)
    storage.objects[seed.s3_key(fid)] = b'x'
    rid = seed.request(me, owner, file_id=fid, request_type='delete')
    assert client.post(f'/api/requests/{rid}/approve', json_body={}, user=owner).status == 200
    assert _deleted(seed, fid)[1] == owner
    assert seed.one('SELECT status, file_id FROM file_requests WHERE id = ?', (rid,)) == ('approved', fid)
    # 恢复后申请还指着这个文件
    assert client.post(f'/api/trash/{fid}/restore', user=owner).status == 200


# ---------------------------------------------------------------- 处处不可见


def test_trashed_file_is_invisible(client, seed, storage, embedding):
    uid = seed.user()
    keep = seed.file(uid, 'keep.jpg', activity_name='春训')
    gone = seed.file(uid, 'gone.jpg', activity_name='春训')
    only = seed.file(uid, 'only.jpg', activity_date='2025-05-01', activity_name='只剩回收站')
    t = seed.tag('开心', uid)
    seed.file_tag(keep, t)
    seed.file_tag(gone, t)
    seed.image_embedding(gone, unit_vector(0, 768))
    seed.image_embedding(keep, unit_vector(1, 768))
    p = seed.person(face_count=2)
    seed.face(gone, person_id=p)
    seed.face(keep, person_id=p)
    seed.trash(gone, uid)
    seed.trash(only, uid)

    body = client.get('/api/files', user=uid).json()
    assert [f['id'] for f in body['files']] == [keep]
    assert body['pagination']['total'] == 1
    assert body['timeline'] == {'2025': {'3': {'count': 1}}}
    for sort in ('taken', 'uploaded'):
        assert [f['id'] for f in client.get('/api/files', params={'sort': sort}, user=uid).json()['files']] == [keep]

    assert_error(client.get(f'/api/files/{gone}', user=uid), 404, 'FILE_001')
    assert_error(client.get(f'/api/files/signed-url/{gone}', user=uid), 404, 'FILE_001')
    assert_error(client.patch(f'/api/files/{gone}', json_body={'filename': 'x.jpg'}, user=uid), 404, 'FILE_001')
    urls = client.post('/api/files/signed-urls', json_body={'file_ids': [keep, gone]}, user=uid).json()['urls']
    assert set(urls) == {str(keep)}
    assert_error(client.get(f'/api/files/{gone}/adjacent', user=uid), 404, 'FILE_NOT_FOUND')
    adj = client.get(f'/api/files/{keep}/adjacent', user=uid).json()
    assert adj['previous'] is None and adj['next'] is None

    dirs = client.get('/api/files/directories', user=uid).json()['directories']
    assert [(y['value'], y['file_count']) for y in dirs] == [('2025', 1)]
    names = client.get('/api/files/activity-names', params={'date': '2025-03-15'}, user=uid).json()
    assert names['activity_names'][0]['file_count'] == 1
    info = client.get('/api/files/activity-directory', params={
        'activity_date': '2025-03-15', 'activity_name': '春训', 'activity_type': 'regular_training'}, user=uid)
    assert info.json()['directory']['file_count'] == 1
    assert_error(client.get('/api/files/activity-directory', params={
        'activity_date': '2025-05-01', 'activity_name': '只剩回收站', 'activity_type': 'regular_training'},
        user=uid), 404, 'DIR_001')
    check = client.post('/api/files/check-filenames', json_body={
        'filenames': ['gone.jpg', 'keep.jpg'], 'activity_date': '2025-03-20',
        'activity_type': 'regular_training'}, user=uid).json()
    assert check['existing_files'] == ['keep.jpg'] and check['available_files'] == ['gone.jpg']

    tags = client.get('/api/tags', user=uid).json()['tags']
    assert tags == [{'id': t, 'name': '开心', 'count': 1}]
    assert client.get('/api/tags/search', params={'q': '开'}, user=uid).json()['tags'][0]['count'] == 1
    assert_error(client.get(f'/api/files/{gone}/tags', user=uid), 404, 'FILE_010')

    embedding.vectors['跳舞'] = unit_vector(0, 768)
    results = client.post('/api/files/ai-search', json_body={'q': '跳舞'}, user=uid).json()['results']
    assert [x['file']['id'] for x in results] == [keep]

    assert client.get(f'/api/files/{gone}/faces', user=uid).json()['faces'] == []
    assert client.get(f'/api/files/{gone}/people', user=uid).json()['people'] == []
    person = client.get(f'/api/files/persons/{p}', user=uid).json()
    assert [f['id'] for f in person['files']] == [keep] and person['pagination']['total'] == 1


# ---------------------------------------------------------------- 回收站列表


def test_trash_list_visibility_and_order(client, seed):
    owner, other, deleter = seed.user(), seed.user(), seed.user('删的人')
    admin = seed.user(is_admin=True)
    mine = seed.file(owner)
    theirs = seed.file(other)
    deleted_by_me = seed.file(other)
    alive = seed.file(owner)
    seed.trash(mine, owner, at='2026-09-01 10:00:00.000000')
    seed.trash(theirs, other, at='2026-09-02 10:00:00.000000')
    seed.trash(deleted_by_me, deleter, at='2026-09-03 10:00:00.000000')

    r = client.get('/api/trash', user=admin)
    assert r.status == 200
    body = assert_shape(r.json(), {'files': [TRASH_ITEM], 'pagination': PAGINATION})
    assert [f['id'] for f in body['files']] == [deleted_by_me, theirs, mine]   # 删除时间倒序
    assert alive not in [f['id'] for f in body['files']]
    first = body['files'][0]
    assert first['deleted_by'] == {'id': deleter, 'name': '删的人'}
    assert first['deleted_at'] == '2026-09-03T10:00:00'
    assert first['purge_at'] == '2026-10-03T10:00:00'
    assert body['pagination'] == {'page': 1, 'per_page': 50, 'total': 3, 'pages': 1,
                                  'has_next': False, 'has_prev': False}

    assert [f['id'] for f in client.get('/api/trash', user=owner).json()['files']] == [mine]
    assert [f['id'] for f in client.get('/api/trash', user=deleter).json()['files']] == [deleted_by_me]
    assert [f['id'] for f in client.get('/api/trash', user=other).json()['files']] == [deleted_by_me, theirs]
    p = client.get('/api/trash', params={'page': 2, 'per_page': 2}, user=admin).json()['pagination']
    assert (p['page'], p['per_page'], p['total'], p['pages']) == (2, 2, 3, 2)
    assert client.get('/api/trash', params={'per_page': 500}, user=admin).json()['pagination']['per_page'] == 100
    assert_error(client.get('/api/trash'), 401, 'AUTH_001')


# ---------------------------------------------------------------- 恢复


def test_restore(client, seed):
    owner, deleter, stranger = seed.user(), seed.user(), seed.user()
    admin = seed.user(is_admin=True)
    fid = seed.file(owner, 'a.jpg')
    seed.trash(fid, deleter)

    assert_error(client.post(f'/api/trash/{fid}/restore', user=stranger), 403, 'TRASH_003')
    r = client.post(f'/api/trash/{fid}/restore', user=deleter)   # 删除者可以
    assert r.status == 200
    body = assert_shape(r.json(), {'file': FILE_DISPLAY})
    assert body['file']['id'] == fid
    assert _deleted(seed, fid) == (None, None)
    assert client.get(f'/api/files/{fid}', user=owner).status == 200
    assert_error(client.post(f'/api/trash/{fid}/restore', user=owner), 404, 'TRASH_001')
    assert_error(client.post('/api/trash/99999/restore', user=owner), 404, 'TRASH_001')

    seed.trash(fid, owner)
    assert client.post(f'/api/trash/{fid}/restore', user=admin).status == 200    # 管理员可以
    seed.trash(fid, admin)
    assert client.post(f'/api/trash/{fid}/restore', user=owner).status == 200    # 上传者可以


def test_restore_conflict(client, seed):
    uid = seed.user()
    old = seed.file(uid, 'same.jpg')
    seed.trash(old, uid)
    new = seed.file(uid, 'same.jpg')   # 删了之后又传了同名的
    err = assert_error(client.post(f'/api/trash/{old}/restore', user=uid), 409, 'TRASH_002')
    assert 'same.jpg' in err['message']
    assert err['details'] == {'existing_id': new}
    assert _deleted(seed, old)[0] is not None


# ---------------------------------------------------------------- 彻底删除


def _full_file(seed, storage, uid):
    fid = seed.file(uid)
    key = seed.s3_key(fid)
    media_dir = f'media/{key[6:38]}/'
    storage.objects.update({key: b'1', media_dir + 'poster.jpg': b'2', media_dir + 'hls/master.m3u8': b'3'})
    face = seed.face(fid)
    person = seed.person(cover_face_id=face)
    seed.image_embedding(fid, [0.1] * 768)
    seed.frame_embedding(fid, 2000, [0.1] * 768)
    seed.comment(fid, uid)
    t = seed.tag('标签', uid)
    seed.file_tag(fid, t)
    rp = seed.real_person('某人', anchor_file_id=fid, anchor_bbox=(1, 2, 3, 4))
    return fid, person, rp


def _assert_purged(seed, storage, person, rp):
    assert storage.objects == {}
    for table in ('files', 'faces', 'image_embeddings', 'video_frame_embeddings', 'comments', 'file_tags'):
        assert seed.one(f'SELECT COUNT(*) FROM {table}')[0] == 0, table
    assert seed.one('SELECT cover_face_id FROM persons WHERE id = ?', (person,))[0] is None
    assert seed.one('SELECT anchor_file_id, name FROM real_people WHERE id = ?', (rp,)) == (None, '某人')


def test_purge_one(client, seed, storage):
    owner, deleter = seed.user(), seed.user()
    fid, person, rp = _full_file(seed, storage, owner)
    rid = seed.request(deleter, owner, file_id=fid, request_type='delete', status='approved')
    assert_error(client.delete(f'/api/trash/{fid}', user=owner), 404, 'TRASH_001')   # 还没进回收站
    seed.trash(fid, deleter)
    assert_error(client.delete(f'/api/trash/{fid}', user=deleter), 403, 'TRASH_003')   # 删除者不能彻底删
    r = client.delete(f'/api/trash/{fid}', user=owner)
    assert r.status == 200 and r.json() == {'success': True}
    _assert_purged(seed, storage, person, rp)
    # 批准过的删除申请留着（file_id 置空）
    assert seed.one('SELECT status, file_id FROM file_requests WHERE id = ?', (rid,)) == ('approved', None)


def test_purge_storage_failure_keeps_row(client, seed, storage):
    uid = seed.user()
    fid = seed.file(uid)
    seed.trash(fid, uid)
    storage.fail_delete = True
    assert_error(client.delete(f'/api/trash/{fid}', user=uid), 500, 'S3_001')
    assert seed.one('SELECT COUNT(*) FROM files')[0] == 1


def test_empty_trash(client, seed, storage):
    uid = seed.user()
    admin = seed.user(is_admin=True)
    fid, person, rp = _full_file(seed, storage, uid)
    other = seed.file(uid)
    alive = seed.file(uid)
    seed.trash(fid, uid)
    seed.trash(other, uid)
    assert_error(client.post('/api/trash/empty', user=uid), 403, 'TRASH_003')
    r = client.post('/api/trash/empty', user=admin)
    assert r.status == 200 and r.json() == {'purged': 2}
    assert [row[0] for row in seed.all('SELECT id FROM files')] == [alive]


def test_daily_purge_only_expired(seed, storage):
    import database
    from services import file_cleanup
    uid = seed.user()
    old = seed.file(uid)
    recent = seed.file(uid)
    alive = seed.file(uid)
    seed.trash(old, uid, at=datetime.utcnow() - timedelta(days=31))
    seed.trash(recent, uid, at=datetime.utcnow() - timedelta(days=29))
    with database.session() as db:
        purged, failed = file_cleanup.purge_expired(db, days=30)
    assert (purged, failed) == (1, 0)
    assert sorted(row[0] for row in seed.all('SELECT id FROM files')) == [recent, alive]
