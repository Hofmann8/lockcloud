"""契约：标签、日志统计（管理员）、用户列表（管理员）、修改申请。"""
from tests.schema import (BATCH_RESULTS, FILE_REQUEST, FILE_REQUEST_FULL, LOG, PAGINATION, TAG_WITH_COUNT, USAGE_SUMMARY,
                          USER, assert_error, assert_shape)

# ---------------------------------------------------------------- 标签


def test_tags_list_ordered_by_usage(client, seed):
    uid = seed.user()
    a, b = seed.file(uid), seed.file(uid)
    hot = seed.tag('热门', uid)
    cold = seed.tag('冷门', uid)
    unused = seed.tag('没人用', uid)
    for f in (a, b):
        seed.file_tag(f, hot)
    seed.file_tag(a, cold)
    r = client.get('/api/tags', user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {'success': bool, 'tags': [TAG_WITH_COUNT]})
    assert [(t['id'], t['count']) for t in body['tags']] == [(hot, 2), (cold, 1), (unused, 0)]


def test_tags_search(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    seed.tag('Dance', uid)
    used = seed.tag('dancer', uid)
    seed.tag('其他', uid)
    seed.file_tag(fid, used)
    r = client.get('/api/tags/search', params={'q': 'DAN'}, user=uid)
    assert r.status == 200
    assert [t['name'] for t in r.json()['tags']] == ['dancer', 'Dance']   # 前缀、不分大小写、用得多的在前
    assert len(client.get('/api/tags/search', params={'q': 'd', 'limit': 1}, user=uid).json()['tags']) == 1
    assert_error(client.get('/api/tags/search', user=uid), 400, 'VALIDATION_001', '缺少搜索关键词参数 (q)')
    assert_error(client.get('/api/tags', ), 401, 'AUTH_001')


# ---------------------------------------------------------------- 日志（管理员）


def test_logs_require_admin(client, seed):
    uid = seed.user()
    for path in ['/api/logs', '/api/logs/summary', '/api/logs/quarterly/2025/1']:
        assert_error(client.get(path, user=uid), 403, 'FORBIDDEN', '需要管理员权限')
        assert_error(client.get(path, user=99999), 401, 'AUTH_001', '账号不存在')
        assert_error(client.get(path), 401, 'AUTH_001')


def test_logs_query(client, seed):
    admin = seed.user('管理员', is_admin=True)
    uid = seed.user()
    fid = seed.file(uid)
    seed.log(uid, 'upload', file_id=fid, file_path='a.jpg', timestamp='2025-03-01 10:00:00.000000')
    seed.log(uid, 'delete', file_path='b.jpg', timestamp='2025-03-02 10:00:00.000000')
    seed.log(admin, 'access', timestamp='2025-03-03 10:00:00.000000')

    r = client.get('/api/logs', user=admin)
    assert r.status == 200
    data = assert_shape(r.json(), {'success': bool, 'data': {'logs': [LOG], 'total': int, 'page': int,
                                                             'per_page': int, 'pages': int, 'has_next': bool,
                                                             'has_prev': bool}})['data']
    assert [x['operation'] for x in data['logs']] == ['access', 'delete', 'upload']   # 新的在前
    assert data['logs'][2]['file'] == {'id': fid, 'filename': seed.one('SELECT filename FROM files')[0],
                                       'directory': 'regular_training/2025/03'}
    assert 'file' not in data['logs'][1]   # 没有关联文件就没有 file 键
    assert data['logs'][0]['user']['name'] == '管理员'

    def ops(**params):
        return [x['operation'] for x in client.get('/api/logs', params=params, user=admin).json()['data']['logs']]

    assert ops(user_id=uid) == ['delete', 'upload']
    assert ops(operation='upload') == ['upload']
    assert ops(start_date='2025-03-02') == ['access', 'delete']
    assert ops(end_date='2025-03-02') == ['upload']
    assert ops(per_page=1) == ['access']
    assert_error(client.get('/api/logs', params={'operation': 'hack'}, user=admin), 400, 'VALIDATION_001')
    assert_error(client.get('/api/logs', params={'start_date': 'x'}, user=admin), 400, 'VALIDATION_001')


def test_logs_summary_and_quarterly(client, seed):
    admin = seed.user(is_admin=True)
    uid = seed.user()
    seed.file(uid, size=1024, uploaded_at='2025-02-01 00:00:00.000000')
    seed.file(uid, size=2048, uploaded_at='2025-05-01 00:00:00.000000')
    seed.log(uid, 'upload', timestamp='2025-02-01 00:00:00.000000')
    seed.log(uid, 'upload', timestamp='2025-05-01 00:00:00.000000')
    seed.log(admin, 'update', timestamp='2025-05-02 00:00:00.000000')

    s = client.get('/api/logs/summary', user=admin).json()
    data = assert_shape(s, {'success': bool, 'data': USAGE_SUMMARY})['data']
    assert data == {'total_storage': 3072, 'total_storage_formatted': '3.00 KB', 'total_files': 2,
                    'upload_count': 2, 'active_users': 2,
                    'operation_stats': {'upload': 2, 'delete': 0, 'access': 0, 'update': 1},
                    'period': {'start_date': None, 'end_date': None}}

    q = client.get('/api/logs/quarterly/2025/2', user=admin).json()['data']
    assert (q['quarter'], q['year'], q['total_files'], q['upload_count']) == (2, 2025, 1, 1)
    assert q['period'] == {'start_date': '2025-04-01T00:00:00', 'end_date': '2025-07-01T00:00:00'}
    assert_error(client.get('/api/logs/quarterly/2025/5', user=admin), 400, 'VALIDATION_001', '季度必须在 1 到 4 之间')
    assert_error(client.get('/api/logs/summary', params={'start_date': 'x'}, user=admin), 400, 'VALIDATION_001')


# ---------------------------------------------------------------- 用户列表（管理员）


def test_admin_users(client, seed):
    admin = seed.user(is_admin=True, created_at='2025-01-01 00:00:00.000000')
    uid = seed.user(created_at='2025-06-01 00:00:00.000000')
    assert_error(client.get('/api/admin/users', user=uid), 403, 'ADMIN_001', '需要管理员权限')
    assert_error(client.get('/api/admin/users', user=99999), 403, 'ADMIN_001')
    assert_error(client.get('/api/admin/users'), 401, 'AUTH_001')
    r = client.get('/api/admin/users', user=admin)
    assert r.status == 200
    body = assert_shape(r.json(), {'success': bool, 'users': [USER], 'pagination': PAGINATION})
    assert [u['id'] for u in body['users']] == [uid, admin]   # 新注册的在前
    assert client.get('/api/admin/users', params={'per_page': 1}, user=admin).json()['pagination']['pages'] == 2


# ---------------------------------------------------------------- 修改申请：单个文件


def test_create_request(client, seed):
    owner, me = seed.user(), seed.user()
    fid = seed.file(owner)
    r = client.post('/api/requests', json_body={'file_id': fid, 'request_type': 'edit',
                                                'proposed_changes': {'activity_name': '新'}, 'message': ' 请改 '},
                    user=me)
    assert r.status == 201
    body = assert_shape(r.json(), {'success': bool, 'message': str, 'request': FILE_REQUEST})
    req = body['request']
    assert (req['owner_id'], req['requester_id'], req['status'], req['message']) == (owner, me, 'pending', '请改')
    assert req['proposed_changes'] == {'activity_name': '新'}

    assert_error(client.post('/api/requests', json_body={'file_id': fid, 'request_type': 'edit'}, user=me), 400,
                 'REQUEST_002', '已有待处理的申请')
    delete = client.post('/api/requests', json_body={'file_id': seed.file(owner), 'request_type': 'delete',
                                                     'proposed_changes': {'x': 1}}, user=me).json()['request']
    assert delete['proposed_changes'] is None   # 删除申请不带修改内容


def test_create_request_validation(client, seed):
    owner, me = seed.user(), seed.user()
    fid = seed.file(owner)
    mine = seed.file(me)
    assert_error(client.post('/api/requests', json_body={}, user=me), 400, 'VALIDATION_001', '请求数据不能为空')
    assert_error(client.post('/api/requests', json_body={'file_id': fid}, user=me), 400, 'VALIDATION_001', '缺少必填字段')
    assert_error(client.post('/api/requests', json_body={'file_id': fid, 'request_type': 'steal'}, user=me), 400,
                 'VALIDATION_001', '无效的请求类型')
    assert_error(client.post('/api/requests', json_body={'file_id': 99999, 'request_type': 'edit'}, user=me), 404,
                 'FILE_001')
    assert_error(client.post('/api/requests', json_body={'file_id': mine, 'request_type': 'edit'}, user=me), 400,
                 'REQUEST_001', '不能对自己的文件发起申请')


def test_received_sent_and_pending_count(client, seed):
    owner, me = seed.user('主人'), seed.user('申请人')
    fid = seed.file(owner)
    seed.request(me, owner, file_id=fid)
    seed.request(me, owner, file_id=fid, status='rejected')

    received = client.get('/api/requests/received', user=owner).json()
    assert_shape(received, {'success': bool, 'requests': [FILE_REQUEST_FULL]})
    assert len(received['requests']) == 2
    first = received['requests'][0]
    assert first['requester'] == {'id': me, 'name': '申请人'} and first['owner'] == {'id': owner, 'name': '主人'}
    assert first['file']['id'] == fid
    assert len(client.get('/api/requests/received', params={'status': 'pending'}, user=owner).json()['requests']) == 1
    assert len(client.get('/api/requests/sent', user=me).json()['requests']) == 2
    assert client.get('/api/requests/sent', user=owner).json()['requests'] == []
    assert client.get('/api/requests/pending-count', user=owner).json() == {'success': True, 'count': 1}
    assert client.get('/api/requests/pending-count', user=me).json() == {'success': True, 'count': 0}


def test_approve_edit_request(client, seed):
    owner, me = seed.user(), seed.user()
    fid = seed.file(owner, 'a.jpg')
    rid = seed.request(me, owner, file_id=fid, proposed_changes={
        'activity_date': '2024-01-05', 'activity_type': 'competition', 'activity_name': '决赛',
        'filename': 'b.jpg', 'free_tags': ['冠军']})
    assert_error(client.post(f'/api/requests/{rid}/approve', user=me), 403, 'REQUEST_004', '你没有处理此申请的权限')
    r = client.post(f'/api/requests/{rid}/approve', json_body={'response_message': '好'}, user=owner)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), {'success': bool, 'message': str, 'request': FILE_REQUEST})
    assert body['request']['status'] == 'approved' and body['request']['response_message'] == '好'
    assert seed.one('SELECT filename, directory, activity_name FROM files WHERE id = ?', (fid,)) == \
        ('b.jpg', 'competition/2024/01', '决赛')
    assert seed.one('SELECT t.name FROM tags t JOIN file_tags ft ON ft.tag_id = t.id')[0] == '冠军'
    assert_error(client.post(f'/api/requests/{rid}/approve', user=owner), 400, 'REQUEST_005', '此申请已处理')


def test_approve_delete_request(client, seed, storage):
    owner, me = seed.user(), seed.user()
    admin = seed.user(is_admin=True)
    fid = seed.file(owner)
    storage.objects[seed.s3_key(fid)] = b'x'
    rid = seed.request(me, owner, file_id=fid, request_type='delete')
    assert client.post(f'/api/requests/{rid}/approve', json_body={}, user=admin).status == 200   # 管理员也能批
    # 2026-09 起：文件进回收站（对象不动），申请留着、状态 approved
    assert seed.one('SELECT deleted_by FROM files WHERE id = ?', (fid,))[0] == admin
    assert len(storage.objects) == 1
    assert seed.one('SELECT status, file_id FROM file_requests WHERE id = ?', (rid,)) == ('approved', fid)
    sent = client.get('/api/requests/sent', user=me).json()['requests']
    assert [(r['id'], r['status'], r['file_id']) for r in sent] == [(rid, 'approved', fid)]
    assert 'file' not in sent[0]   # 回收站里的文件不可见


def test_approve_request_for_missing_file(client, seed):
    owner, me = seed.user(), seed.user()
    rid = seed.request(me, owner, file_id=99999)
    assert_error(client.post(f'/api/requests/{rid}/approve', json_body={}, user=owner), 404, 'FILE_001', '文件已不存在')
    assert seed.one('SELECT status, response_message FROM file_requests WHERE id = ?', (rid,)) == \
        ('rejected', '文件已不存在')
    assert_error(client.post('/api/requests/99999/approve', user=owner), 404, 'REQUEST_003', '申请不存在')


def test_approve_edit_conflict(client, seed):
    owner, me = seed.user(), seed.user()
    fid = seed.file(owner, 'a.jpg')
    seed.file(owner, 'b.jpg')
    rid = seed.request(me, owner, file_id=fid, proposed_changes={'filename': 'b.jpg'})
    err = assert_error(client.post(f'/api/requests/{rid}/approve', json_body={}, user=owner), 400, 'FILE_005')
    assert err['message'] == '已有同名文件「b.jpg」'   # 提示里是冲突的新名字
    assert seed.one('SELECT filename FROM files WHERE id = ?', (fid,))[0] == 'a.jpg'
    assert seed.one('SELECT status FROM file_requests WHERE id = ?', (rid,))[0] == 'pending'


def test_approve_without_json_body(client, seed):
    """批准 / 拒绝不带请求体时当成 {}（Flask 版会 500）。"""
    owner, me = seed.user(), seed.user()
    fid = seed.file(owner)
    rid = seed.request(me, owner, file_id=fid, proposed_changes={'activity_name': '新'})
    r = client.post(f'/api/requests/{rid}/approve', user=owner)
    assert r.status == 200, r.text
    assert r.json()['request']['status'] == 'approved' and r.json()['request']['response_message'] is None
    assert seed.one('SELECT activity_name FROM files WHERE id = ?', (fid,))[0] == '新'

    other = seed.request(me, owner, file_id=seed.file(owner))
    r = client.post(f'/api/requests/{other}/reject', user=owner)
    assert r.status == 200, r.text
    assert r.json()['request']['status'] == 'rejected'


def test_reject_request(client, seed):
    owner, me = seed.user(), seed.user()
    rid = seed.request(me, owner, file_id=seed.file(owner))
    assert_error(client.post(f'/api/requests/{rid}/reject', user=me), 403, 'REQUEST_004')
    r = client.post(f'/api/requests/{rid}/reject', json_body={'response_message': '不行'}, user=owner)
    assert r.status == 200
    assert r.json()['request']['status'] == 'rejected' and r.json()['message'] == '申请已拒绝'
    assert_error(client.post(f'/api/requests/{rid}/reject', user=owner), 400, 'REQUEST_005')
    assert_error(client.post('/api/requests/99999/reject', user=owner), 404, 'REQUEST_003')


# ---------------------------------------------------------------- 修改申请：整个活动目录

DIR = {'activity_date': '2025-03-15', 'activity_name': '周末特训', 'activity_type': 'regular_training'}


def test_directory_request_flow(client, seed):
    owner, me = seed.user(), seed.user()
    seed.file(owner, uploaded_at='2025-03-15 00:00:00.000000')
    seed.file(me, uploaded_at='2025-03-16 00:00:00.000000')
    r = client.post('/api/requests/directory', json_body={**DIR, 'proposed_changes': {
        'new_activity_name': '春训', 'new_activity_type': 'internal_training'}, 'message': '改个名'}, user=me)
    assert r.status == 201
    req = assert_shape(r.json(), {'success': bool, 'message': str, 'request': FILE_REQUEST})['request']
    assert (req['file_id'], req['request_type'], req['owner_id']) == (None, 'directory_edit', owner)
    assert req['directory_info'] == DIR

    assert_error(client.post('/api/requests/directory', json_body={**DIR, 'proposed_changes': {
        'new_activity_name': 'x'}}, user=me), 400, 'REQUEST_002', '此活动已有待处理的编辑申请')

    ok = client.post(f'/api/requests/{req["id"]}/approve', json_body={}, user=owner)
    assert ok.status == 200
    assert ok.json()['updated_count'] == 2 and ok.json()['message'] == '申请已同意，已更新 2 个文件'
    assert {r[0] for r in seed.all('SELECT directory FROM files')} == {'internal_training/2025/03'}


def test_directory_request_validation(client, seed):
    owner, me = seed.user(), seed.user()
    seed.file(owner)
    url = '/api/requests/directory'
    change = {'proposed_changes': {'new_activity_name': 'x'}}
    assert_error(client.post(url, json_body={}, user=me), 400, 'VALIDATION_001', '请求数据不能为空')
    assert_error(client.post(url, json_body={'activity_date': '2025-03-15', **change}, user=me), 400,
                 'VALIDATION_001', '缺少必填字段')
    assert_error(client.post(url, json_body={**DIR, 'proposed_changes': {}}, user=me), 400, 'VALIDATION_001',
                 '请提供要修改的内容')
    assert_error(client.post(url, json_body={**DIR, 'activity_date': 'x', **change}, user=me), 400,
                 'VALIDATION_001', '日期格式无效')
    assert_error(client.post(url, json_body={**DIR, 'proposed_changes': {'new_activity_type': 'x'}}, user=me), 400,
                 'VALIDATION_001')
    assert_error(client.post(url, json_body={**DIR, 'activity_name': '无', **change}, user=me), 404, 'DIR_001')
    assert_error(client.post(url, json_body={**DIR, **change}, user=owner), 400, 'REQUEST_001',
                 '不能对自己的活动发起申请')


def test_directory_request_approve_when_gone(client, seed):
    owner, me = seed.user(), seed.user()
    rid = seed.request(me, owner, request_type='directory_edit', directory_info=DIR,
                       proposed_changes={'new_activity_name': 'x'})
    assert_error(client.post(f'/api/requests/{rid}/approve', json_body={}, user=owner), 404, 'DIR_001', '活动已不存在')
    assert seed.one('SELECT status FROM file_requests WHERE id = ?', (rid,))[0] == 'rejected'


# ---------------------------------------------------------------- 修改申请：批量


def test_batch_requests(client, seed):
    owner, me = seed.user(), seed.user()
    a, b = seed.file(owner), seed.file(owner)
    mine = seed.file(me)
    url = '/api/requests/batch'
    changes = {'activity_name': '新'}

    r = client.post(url, json_body={'file_ids': [a, b], 'proposed_changes': changes}, user=me)
    assert r.status == 200
    assert r.json() == {'success': True, 'message': '已发送 2 个编辑申请', 'results': {'succeeded': [a, b], 'failed': []}}

    r = client.post(url, json_body={'file_ids': [a, mine, 99999, seed.file(owner)], 'proposed_changes': changes},
                    user=me)
    assert r.status == 207
    body = assert_shape(r.json(), {'success': bool, 'code': str, 'message': str, 'results': BATCH_RESULTS})
    assert body['code'] == 'PARTIAL_SUCCESS'
    assert [f['error'] for f in body['results']['failed']] == ['已有待处理的申请', '不能对自己的文件发起申请', '文件不存在']

    r = client.post(url, json_body={'file_ids': [mine], 'proposed_changes': changes}, user=me)
    assert r.status == 400 and r.json()['message'] == '申请均未发送成功'

    assert_error(client.post(url, json_body={}, user=me), 400, 'VALIDATION_001', '请求数据不能为空')
    assert_error(client.post(url, json_body={'proposed_changes': changes}, user=me), 400, 'VALIDATION_001',
                 '文件ID列表不能为空')
    assert_error(client.post(url, json_body={'file_ids': [a]}, user=me), 400, 'VALIDATION_001', '修改内容不能为空')
    assert_error(client.post(url, json_body={'file_ids': list(range(101)), 'proposed_changes': changes}, user=me),
                 400, 'BATCH_002')
