"""契约：文件上传、登记、列表、详情、编辑、删除、目录、文件名检查、相邻文件、标签、批量操作、活动目录。"""
import json
import re

from tests.schema import (BATCH_RESULTS, FILE_BASE, FILE_DISPLAY, FILE_WITH_UPLOADER, PAGINATION, TAG, Any,
                          Nullable, assert_error, assert_shape)

KEY_RE = re.compile(r'^files/[0-9a-f]{32}\.[a-z0-9]+$')

UPLOAD = {
    'original_filename': 'IMG_0001.JPG',
    'content_type': 'image/jpeg',
    'size': 1234,
    'activity_date': '2025-03-15',
    'activity_type': 'regular_training',
}


def _upload_url(client, uid, **overrides):
    return client.post('/api/files/upload-url', json_body={**UPLOAD, **overrides}, user=uid)


# ---------------------------------------------------------------- 上传地址


def test_upload_url_success(client, seed):
    uid = seed.user()
    r = _upload_url(client, uid, activity_name='周末特训')
    assert r.status == 200, r.text
    body = assert_shape(r.json(), {'success': bool, 'upload_url': str, 's3_key': str, 'content_type': str,
                                   'generated_filename': str, 'expires_in': int})
    assert KEY_RE.match(body['s3_key']) and body['s3_key'].endswith('.jpg')   # 扩展名统一小写
    assert body['generated_filename'] == 'IMG_0001.JPG'
    assert body['expires_in'] == 3600
    assert body['upload_url'].startswith('https://oss.test/' + body['s3_key'])
    ticket = seed.one('SELECT user_id, filename, content_type, size FROM upload_tickets WHERE s3_key = ?',
                      (body['s3_key'],))
    assert ticket == (uid, 'IMG_0001.JPG', 'image/jpeg', 1234)


def test_upload_url_custom_filename_and_path_stripping(client, seed):
    uid = seed.user()
    body = _upload_url(client, uid, custom_filename='我的视频', original_filename='a/b/c.mp4',
                       content_type='video/mp4').json()
    assert body['generated_filename'] == '我的视频.mp4'
    body = _upload_url(client, uid, original_filename='dir\\sub\\clip.MOV', content_type='video/quicktime').json()
    assert body['generated_filename'] == 'clip.MOV'
    assert body['s3_key'].endswith('.mov')


def test_upload_url_content_type_from_format_table(client, seed):
    """签名用的 Content-Type 按格式表定，不照搬浏览器报的（HEIC、mts 浏览器常报空的或怪的）。"""
    uid = seed.user()
    cases = [('IMG_0002.HEIC', '', 'image/heic'), ('clip.MTS', 'model/vnd.mts', 'video/mp2t'),
             ('song.flac', 'audio/x-flac', 'audio/flac'), ('raw.DNG', 'application/octet-stream', 'image/x-adobe-dng'),
             ('IMG_0003.jpg', 'image/jpeg', 'image/jpeg')]
    for name, sent, expected in cases:
        body = _upload_url(client, uid, original_filename=name, content_type=sent or 'x').json()
        assert body['content_type'] == expected, name
        assert seed.one('SELECT content_type FROM upload_tickets WHERE s3_key = ?', (body['s3_key'],))[0] == expected


def test_formats_endpoint(client, seed):
    uid = seed.user()
    r = client.get('/api/files/formats', user=uid)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), {'formats': [{'ext': str, 'kind': str}], 'max_size': int})
    kinds = {f['ext']: f['kind'] for f in body['formats']}
    assert kinds['heic'] == 'image' and kinds['dng'] == 'image' and kinds['mts'] == 'video'
    assert kinds['flac'] == 'audio' and kinds['pdf'] == 'other'
    assert 'exe' not in kinds
    assert client.get('/api/files/formats').status == 401


def test_upload_url_validation(client, seed):
    uid = seed.user()
    for field in ['original_filename', 'content_type', 'size', 'activity_date', 'activity_type']:
        payload = {k: v for k, v in UPLOAD.items() if k != field}
        assert_error(client.post('/api/files/upload-url', json_body=payload, user=uid), 400,
                     'VALIDATION_001', f'缺少必填字段: {field}')
    assert_error(_upload_url(client, uid, activity_date='2025/03/15'), 400, 'FILE_007')
    assert_error(_upload_url(client, uid, activity_type='party'), 400, 'FILE_008')
    assert_error(_upload_url(client, uid, activity_name='x' * 201), 400, 'VALIDATION_001', '活动名称不能超过 200 个字符')
    assert_error(_upload_url(client, uid, original_filename='noext'), 400, 'VALIDATION_001', '文件名必须包含扩展名')
    err = assert_error(_upload_url(client, uid, original_filename='virus.exe'), 400, 'VALIDATION_001')
    assert err['message'].startswith('不支持的文件类型: .exe')
    assert_error(_upload_url(client, uid, custom_filename='a/b'), 400, 'VALIDATION_001', '文件名包含不支持的字符')
    assert_error(_upload_url(client, uid, custom_filename='x' * 201), 400, 'VALIDATION_001')
    assert_error(_upload_url(client, uid, size=2 * 1024 ** 3 + 1), 400, 'VALIDATION_001', '文件不能超过 2 GB')


def test_upload_url_duplicate_name_in_same_month(client, seed):
    uid = seed.user()
    seed.file(uid, 'IMG_0001.JPG', activity_date='2025-03-02', activity_type='regular_training')
    err = assert_error(_upload_url(client, uid), 400, 'FILE_005')
    assert err['message'] == '此活动中已有同名文件「IMG_0001.JPG」'
    # 别的月份、别的类型不算重名
    assert _upload_url(client, uid, activity_date='2025-04-15').status == 200
    assert _upload_url(client, uid, activity_type='competition').status == 200


def test_upload_url_requires_login(client):
    assert_error(client.post('/api/files/upload-url', json_body=UPLOAD), 401, 'AUTH_001')


# ---------------------------------------------------------------- 登记（confirm）

CONFIRM = {
    'size': 1234,
    'content_type': 'image/jpeg',
    'original_filename': 'IMG_0001.JPG',
    'activity_date': '2025-03-15',
    'activity_type': 'regular_training',
    'activity_name': '周末特训',
}


def _prepare(client, seed, storage, uid, *, size=1234, **upload):
    body = _upload_url(client, uid, **upload).json()
    storage.objects[body['s3_key']] = b'x' * size
    return body['s3_key']


def test_confirm_success(client, seed, storage):
    uid = seed.user('阿伟')
    key = _prepare(client, seed, storage, uid)
    r = client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key}, user=uid)
    assert r.status == 201, r.text
    body = assert_shape(r.json(), {'success': bool, 'message': str, 'file': FILE_DISPLAY})
    assert body['message'] == '文件上传成功'
    f = body['file']
    assert f['s3_key'] == key and f['filename'] == 'IMG_0001.JPG' and f['size'] == 1234
    assert f['directory'] == 'regular_training/2025/03'
    assert f['activity_name'] == '周末特训' and f['activity_type_display'] == '例训'
    assert f['media_status'] == 'pending'
    assert f['uploader']['name'] == '阿伟' and f['free_tags'] == []
    assert seed.one('SELECT COUNT(*) FROM upload_tickets')[0] == 0
    assert seed.one("SELECT operation, file_id FROM file_logs")[0:2] == ('UPLOAD', f['id'])


def test_confirm_non_media_file_is_skipped(client, seed, storage):
    uid = seed.user()
    key = _prepare(client, seed, storage, uid, original_filename='notes.pdf', content_type='application/pdf')
    f = client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key, 'content_type': 'application/pdf',
                                                    'original_filename': 'notes.pdf'}, user=uid).json()['file']
    assert f['media_status'] == 'skipped'


def test_confirm_ingests_media_json_already_in_bucket(client, seed, storage):
    uid = seed.user()
    key = _prepare(client, seed, storage, uid)
    uid_hex = key[6:38]
    storage.objects[f'media/{uid_hex}/media.json'] = json.dumps({
        'status': 'ready', 'kind': 'image', 'width': 4000, 'height': 3000, 'orientation': 6,
        'thumbhash': 'abc123', 'key': key}).encode()
    f = client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key}, user=uid).json()['file']
    assert f['media_status'] == 'ready'
    assert f['thumbhash'] == 'abc123'
    assert f['width'] == 4000 and f['height'] == 3000


def test_confirm_uses_ticket_not_client_values(client, seed, storage):
    """文件名、类型、大小以签发时的票据和桶里的实际大小为准。"""
    uid = seed.user()
    key = _prepare(client, seed, storage, uid, custom_filename='定名')
    f = client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key, 'size': 1,
                                                    'content_type': 'text/plain'}, user=uid).json()['file']
    assert f['filename'] == '定名.jpg' and f['content_type'] == 'image/jpeg' and f['size'] == 1234
    assert f['original_filename'] == 'IMG_0001.JPG'


def test_confirm_validation(client, seed, storage):
    uid = seed.user()
    for field in ['s3_key', 'size', 'content_type', 'original_filename', 'activity_date', 'activity_type']:
        payload = {**CONFIRM, 's3_key': 'files/x.jpg'}
        payload.pop(field)
        assert_error(client.post('/api/files/confirm', json_body=payload, user=uid), 400, 'VALIDATION_001',
                     f'缺少必填字段: {field}')
    key = _prepare(client, seed, storage, uid)
    assert_error(client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key, 'activity_date': 'x'},
                             user=uid), 400, 'FILE_007', '活动日期格式无效')
    assert_error(client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key, 'activity_type': 'x'},
                             user=uid), 400, 'FILE_008', '活动类型无效')


def test_confirm_rejects_foreign_or_unknown_ticket(client, seed, storage):
    owner = seed.user()
    other = seed.user()
    key = _prepare(client, seed, storage, owner)
    assert_error(client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key}, user=other), 400,
                 'FILE_009', '上传凭据无效，请重新上传')
    assert_error(client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': 'files/' + 'a' * 32 + '.jpg'},
                             user=owner), 400, 'FILE_009')
    assert_error(client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': '../etc/passwd'},
                             user=owner), 400, 'FILE_009')


def test_confirm_object_missing_or_incomplete(client, seed, storage):
    uid = seed.user()
    key = _upload_url(client, uid).json()['s3_key']
    assert_error(client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key}, user=uid), 400,
                 'FILE_010', '文件尚未上传完成')
    storage.objects[key] = b'x' * 10
    assert_error(client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key}, user=uid), 400,
                 'FILE_010', '文件上传不完整，请重新上传')


def test_confirm_twice(client, seed, storage):
    uid = seed.user()
    key = _prepare(client, seed, storage, uid)
    assert client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key}, user=uid).status == 201
    assert_error(client.post('/api/files/confirm', json_body={**CONFIRM, 's3_key': key}, user=uid), 400,
                 'FILE_005', '已有同名文件')


# ---------------------------------------------------------------- 列表

LIST_BODY = {
    'success': bool,
    'files': [FILE_DISPLAY],
    'pagination': PAGINATION,
    'timeline': Any,
}


def test_list_shape_and_order(client, seed):
    uid = seed.user()
    a = seed.file(uid, activity_date='2025-01-10')
    b = seed.file(uid, activity_date='2025-03-10')
    c = seed.file(uid, activity_date='2024-12-31', activity_type='competition')
    r = client.get('/api/files', user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), LIST_BODY)
    assert [f['id'] for f in body['files']] == [b, a, c]   # 活动日期新的在前
    assert body['pagination'] == {'page': 1, 'per_page': 50, 'total': 3, 'pages': 1,
                                  'has_next': False, 'has_prev': False}
    assert body['timeline'] == {'2025': {'1': {'count': 1}, '3': {'count': 1}}, '2024': {'12': {'count': 1}}}
    assert body['files'][0]['activity_type_display'] == '例训'


def test_list_pagination(client, seed):
    uid = seed.user()
    for d in range(1, 6):
        seed.file(uid, activity_date=f'2025-03-0{d}')
    p = client.get('/api/files', params={'page': 2, 'per_page': 2}, user=uid).json()['pagination']
    assert p == {'page': 2, 'per_page': 2, 'total': 5, 'pages': 3, 'has_next': True, 'has_prev': True}
    # 越界的 per_page 回到 50，page < 1 当第 1 页
    p = client.get('/api/files', params={'page': 0, 'per_page': 500}, user=uid).json()['pagination']
    assert (p['page'], p['per_page']) == (1, 50)
    empty = client.get('/api/files', params={'page': 9}, user=uid).json()
    assert empty['files'] == [] and empty['pagination']['page'] == 9


def test_list_filters(client, seed):
    u1, u2 = seed.user(), seed.user()
    img = seed.file(u1, '合影.jpg', activity_date='2025-03-15', activity_name='周末特训')
    vid = seed.file(u2, 'solo.mp4', content_type='video/mp4', activity_date='2025-04-01',
                    activity_type='competition', activity_name='比赛')
    old = seed.file(u1, 'old.png', content_type='image/png', activity_date='2024-11-20', activity_name='去年')
    t = seed.tag('开心', u1)
    seed.file_tag(vid, t)

    def ids(**params):
        r = client.get('/api/files', params=params, user=u1)
        assert r.status == 200, r.text
        return sorted(f['id'] for f in r.json()['files'])

    assert ids(uploader_id=u2) == [vid]
    assert ids(activity_type='competition') == [vid]
    assert ids(activity_name='周末特训') == [img]
    assert ids(activity_date='2025-03-15') == [img]
    assert ids(media_type='video') == [vid]
    assert ids(media_type='image') == sorted([img, old])
    assert ids(media_type='all') == sorted([img, vid, old])
    assert ids(tags='开心,不存在') == [vid]
    assert ids(year=2025) == sorted([img, vid])
    assert ids(year=2025, month=4) == [vid]
    assert ids(month=4) == sorted([img, vid, old])      # 没有 year 时 month 不生效
    assert ids(search='SOLO') == [vid]                  # 不分大小写
    assert ids(search='competition') == [vid]           # 也搜活动类型
    assert ids(date_from='2025-01-01') == sorted([img, vid])
    assert ids(date_to='2025-03-31') == sorted([img, old])
    assert ids(directory='/regular_training/2025/') == [img]
    assert ids(directory='regular_training') == sorted([img, old])


def test_list_bad_dates(client, seed):
    uid = seed.user()
    assert_error(client.get('/api/files', params={'activity_date': 'x'}, user=uid), 400, 'VALIDATION_001')
    assert_error(client.get('/api/files', params={'date_from': 'x'}, user=uid), 400, 'VALIDATION_001',
                 '日期格式无效 (date_from)。请使用 ISO 格式 (YYYY-MM-DD)')
    assert_error(client.get('/api/files', params={'date_to': 'x'}, user=uid), 400, 'VALIDATION_001',
                 '日期格式无效 (date_to)。请使用 ISO 格式 (YYYY-MM-DD)')


def test_list_undated_and_media_fields(client, seed):
    uid = seed.user()
    seed.file(uid, activity_date=None, activity_type=None, activity_name=None)
    seed.file(uid, content_type='video/mp4', media_status='ready',
              media_info={'duration': 12.5, 'width': 1920, 'height': 1080, 'renditions': [1080, 720]})
    body = client.get('/api/files', user=uid).json()
    assert body['timeline']['undated'] == {'count': 1}
    video = next(f for f in body['files'] if f['content_type'] == 'video/mp4')
    assert (video['duration'], video['width'], video['height']) == (12.5, 1920, 1080)
    undated = next(f for f in body['files'] if f['activity_date'] is None)
    assert 'activity_type_display' not in undated   # 没有类型就不给这个键
    assert 'duration' not in undated                # 没有 media_info 就不给


# ---------------------------------------------------------------- 详情


def test_get_file(client, seed):
    uid = seed.user()
    fid = seed.file(uid, activity_type='master_class')
    r = client.get(f'/api/files/{fid}', user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {'success': bool, 'file': FILE_DISPLAY})
    assert body['file']['activity_type_display'] == '大师课'
    assert_error(client.get('/api/files/99999', user=uid), 404, 'FILE_001', '文件不存在')


# ---------------------------------------------------------------- 删除


def test_delete_by_owner_moves_to_trash(client, seed, storage):
    # 2026-09 起删除 = 进回收站：对象、人脸、embedding 都留着，彻底删除见 test_api_v2_trash.py
    uid = seed.user()
    fid = seed.file(uid)
    key = seed.s3_key(fid)
    media_dir = f'media/{key[6:38]}/'
    storage.objects.update({key: b'1', media_dir + 'poster.jpg': b'2', media_dir + 'hls/master.m3u8': b'3'})
    seed.face(fid)
    seed.image_embedding(fid, [0.1] * 768)

    r = client.delete(f'/api/files/{fid}', user=uid)
    assert r.status == 200
    assert r.json() == {'success': True, 'message': '文件删除成功'}
    assert len(storage.objects) == 3
    assert seed.one('SELECT deleted_by FROM files WHERE id = ?', (fid,))[0] == uid
    assert seed.one('SELECT COUNT(*) FROM faces')[0] == 1
    assert seed.one('SELECT COUNT(*) FROM image_embeddings')[0] == 1
    assert seed.one("SELECT operation FROM file_logs")[0] == 'DELETE'
    assert_error(client.get(f'/api/files/{fid}', user=uid), 404, 'FILE_001')


def test_delete_permissions(client, seed, storage):
    owner, other = seed.user(), seed.user()
    admin = seed.user(is_admin=True)
    fid = seed.file(owner)
    assert_error(client.delete(f'/api/files/{fid}', user=other), 403, 'FILE_002', '你没有删除此文件的权限')
    assert client.delete(f'/api/files/{fid}', user=admin).status == 200
    assert_error(client.delete(f'/api/files/{fid}', user=owner), 404, 'FILE_001')


def test_delete_does_not_touch_storage(client, seed, storage):
    # 以前是"桶删失败就 500 S3_001、行留着"；现在删除不碰桶，桶坏了也能删
    uid = seed.user()
    fid = seed.file(uid)
    storage.fail_delete = True
    assert client.delete(f'/api/files/{fid}', user=uid).status == 200
    assert seed.one('SELECT COUNT(*) FROM files')[0] == 1 and storage.deleted == []


# ---------------------------------------------------------------- 编辑


def test_patch_updates_and_recomputes_directory(client, seed):
    uid = seed.user()
    fid = seed.file(uid, 'a.jpg')
    r = client.patch(f'/api/files/{fid}', json_body={
        'activity_date': '2024-12-01', 'activity_type': 'competition', 'activity_name': '  决赛 ',
        'filename': '新名字.jpg', 'free_tags': ['甲', ' 乙 ', '']}, user=uid)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), {'success': bool, 'message': str, 'file': FILE_DISPLAY})
    f = body['file']
    assert body['message'] == '文件信息更新成功'
    assert f['directory'] == 'competition/2024/12' and f['activity_type_display'] == '比赛'
    assert f['activity_name'] == '决赛' and f['filename'] == '新名字.jpg'
    assert sorted(t['name'] for t in f['free_tags']) == ['乙', '甲']
    assert seed.one("SELECT operation FROM file_logs")[0] == 'UPDATE'


def test_patch_no_changes(client, seed):
    uid = seed.user()
    fid = seed.file(uid, 'a.jpg')
    r = client.patch(f'/api/files/{fid}', json_body={'filename': 'a.jpg'}, user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {'success': bool, 'message': str, 'file': FILE_WITH_UPLOADER})
    # 现状：没改动时 file 里没有 activity_type_display
    assert body['message'] == '没有需要更新的内容'


def test_patch_clear_activity_type(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    f = client.patch(f'/api/files/{fid}', json_body={'activity_type': None}, user=uid).json()['file']
    assert f['activity_type'] is None and f['activity_type_display'] == '未分类'
    assert f['directory'] == 'regular_training/2025/03'   # 现状：类型清空后目录保持原样


def test_patch_validation(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    assert_error(client.patch(f'/api/files/{fid}', json_body={}, user=uid), 400, 'VALIDATION_001', '请求数据不能为空')
    assert_error(client.patch(f'/api/files/{fid}', json_body={'activity_date': 'x'}, user=uid), 400, 'FILE_007')
    assert_error(client.patch(f'/api/files/{fid}', json_body={'activity_type': 'x'}, user=uid), 400, 'FILE_008')
    assert_error(client.patch(f'/api/files/{fid}', json_body={'activity_type': 3}, user=uid), 400, 'FILE_008',
                 '活动类型必须是字符串或 null')
    assert_error(client.patch(f'/api/files/{fid}', json_body={'activity_name': 'x' * 201}, user=uid), 400,
                 'VALIDATION_001')
    assert_error(client.patch(f'/api/files/{fid}', json_body={'filename': ''}, user=uid), 400, 'VALIDATION_001',
                 '文件名不能为空')
    assert_error(client.patch(f'/api/files/{fid}', json_body={'filename': 'a/b.jpg'}, user=uid), 400,
                 'VALIDATION_001')
    assert_error(client.patch(f'/api/files/{fid}', json_body={'filename': 'x' * 256}, user=uid), 400,
                 'VALIDATION_001', '文件名不能超过 255 个字符')
    assert_error(client.patch(f'/api/files/{fid}', json_body={'free_tags': 'a'}, user=uid), 400, 'VALIDATION_001',
                 'free_tags 必须是数组')


def test_patch_permissions_and_conflict(client, seed):
    owner, other = seed.user(), seed.user()
    admin = seed.user(is_admin=True)
    a = seed.file(owner, 'a.jpg')
    seed.file(owner, 'b.jpg')
    assert_error(client.patch('/api/files/99999', json_body={'filename': 'x'}, user=owner), 404, 'FILE_001')
    assert_error(client.patch(f'/api/files/{a}', json_body={'filename': 'x.jpg'}, user=other), 403, 'FILE_002',
                 '你没有编辑此文件的权限')
    err = assert_error(client.patch(f'/api/files/{a}', json_body={'filename': 'b.jpg'}, user=owner), 400, 'FILE_005')
    assert err['message'] == '已有同名文件「b.jpg」'   # 提示里是冲突的新名字
    assert seed.one('SELECT filename FROM files WHERE id = ?', (a,))[0] == 'a.jpg'
    assert client.patch(f'/api/files/{a}', json_body={'filename': 'c.jpg'}, user=admin).status == 200


# ---------------------------------------------------------------- 目录树


def test_directories(client, seed):
    uid = seed.user()
    seed.file(uid, activity_date='2025-03-15', activity_name='周末特训', activity_type='regular_training')
    seed.file(uid, activity_date='2025-03-15', activity_name='周末特训', activity_type='regular_training')
    seed.file(uid, activity_date='2025-03-20', activity_name=None)
    seed.file(uid, activity_date='2024-11-02', activity_name='比赛', activity_type='competition')
    seed.file(uid, activity_date=None, activity_type=None, activity_name=None)
    r = client.get('/api/files/directories', user=uid)
    assert r.status == 200
    dirs = r.json()['directories']
    assert [d['value'] for d in dirs] == ['2025', '2024']
    y2025 = dirs[0]
    assert y2025 == {
        'value': '2025', 'name': '2025年', 'path': '2025', 'file_count': 3,
        'subdirectories': [{
            'name': '3月', 'path': '2025/03', 'file_count': 3,
            'subdirectories': [
                {'name': '03-20 未分类', 'path': '2025/03/03-20_未分类', 'file_count': 1,
                 'activity_date': '2025-03-20', 'activity_name': '', 'activity_type': 'regular_training'},
                {'name': '03-15 周末特训 (例训)', 'path': '2025/03/03-15_周末特训_regular_training', 'file_count': 2,
                 'activity_date': '2025-03-15', 'activity_name': '周末特训', 'activity_type': 'regular_training'},
            ],
        }],
    }


# ---------------------------------------------------------------- 文件名检查


def test_check_filenames(client, seed):
    uid = seed.user()
    seed.file(uid, 'a.jpg', activity_date='2025-03-01')
    seed.file(uid, 'b.jpg', activity_date='2025-04-01')
    r = client.post('/api/files/check-filenames', json_body={
        'filenames': ['a.jpg', 'b.jpg', 'c.jpg'], 'activity_date': '2025-03-20',
        'activity_type': 'regular_training'}, user=uid)
    assert r.status == 200
    assert r.json() == {'success': True, 'existing_files': ['a.jpg'], 'available_files': ['b.jpg', 'c.jpg']}


def test_check_filenames_validation(client, seed):
    uid = seed.user()
    url = '/api/files/check-filenames'
    assert_error(client.post(url, json_body={}, user=uid), 400, 'INVALID_INPUT', '请求数据不能为空')
    assert_error(client.post(url, json_body={'filenames': []}, user=uid), 400, 'INVALID_INPUT', '文件名列表不能为空')
    assert_error(client.post(url, json_body={'filenames': ['a']}, user=uid), 400, 'INVALID_INPUT',
                 '活动日期和活动类型不能为空')
    assert_error(client.post(url, json_body={'filenames': ['a'], 'activity_date': '2025-3-1x',
                                             'activity_type': 'x'}, user=uid), 400, 'INVALID_DATE')


# ---------------------------------------------------------------- 相邻文件


def test_adjacent(client, seed):
    uid = seed.user()
    a = seed.file(uid, 'a.jpg', activity_date='2025-03-20')
    b = seed.file(uid, 'b.jpg', activity_date='2025-03-20')
    c = seed.file(uid, 'c.jpg', activity_date='2025-03-01')
    r = client.get(f'/api/files/{b}/adjacent', user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {'previous': Nullable(FILE_BASE), 'next': Nullable(FILE_BASE),
                                   'previous_files': [FILE_BASE], 'next_files': [FILE_BASE]})
    assert body['previous']['id'] == a and body['next']['id'] == c
    assert [f['id'] for f in body['previous_files']] == [a]
    assert [f['id'] for f in body['next_files']] == [c]
    assert 'uploader' not in body['previous']

    limited = client.get(f'/api/files/{a}/adjacent', params={'limit': 1}, user=uid).json()
    assert [f['id'] for f in limited['next_files']] == [b]
    assert_error(client.get('/api/files/99999/adjacent', user=uid), 404, 'FILE_NOT_FOUND')


def test_adjacent_crosses_month_boundary(client, seed):
    uid = seed.user()
    march = seed.file(uid, 'm.jpg', activity_date='2025-03-10')
    feb = seed.file(uid, 'f.jpg', activity_date='2025-02-10')
    april = seed.file(uid, 'a.jpg', activity_date='2025-04-10')
    body = client.get(f'/api/files/{march}/adjacent', user=uid).json()
    assert body['previous']['id'] == april and body['next']['id'] == feb
    assert body['previous_files'] == [] and body['next_files'] == []


# ---------------------------------------------------------------- 单个文件的标签


def test_file_tags_crud(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    r = client.post(f'/api/files/{fid}/tags', json_body={'tag_name': '  开心 '}, user=uid)
    assert r.status == 201
    body = assert_shape(r.json(), {'success': bool, 'message': str, 'tag': TAG})
    assert body['tag']['name'] == '开心'
    tag_id = body['tag']['id']
    # 重复添加：同一个标签
    again = client.post(f'/api/files/{fid}/tags', json_body={'tag_name': '开心'}, user=uid)
    assert again.status == 201 and again.json()['tag']['id'] == tag_id

    listed = client.get(f'/api/files/{fid}/tags', user=uid).json()
    assert listed == {'success': True, 'tags': [{'id': tag_id, 'name': '开心'}]}

    assert client.delete(f'/api/files/{fid}/tags/{tag_id}', user=uid).json() == \
        {'success': True, 'message': '标签移除成功'}
    assert_error(client.delete(f'/api/files/{fid}/tags/{tag_id}', user=uid), 404, 'TAG_001', '该文件没有此标签')


def test_file_tags_errors(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    assert_error(client.get('/api/files/99999/tags', user=uid), 404, 'FILE_010', '文件不存在')
    assert_error(client.post('/api/files/99999/tags', json_body={'tag_name': 'x'}, user=uid), 404, 'FILE_010')
    assert_error(client.delete('/api/files/99999/tags/1', user=uid), 404, 'FILE_010')
    assert_error(client.post(f'/api/files/{fid}/tags', json_body={}, user=uid), 400, 'VALIDATION_001',
                 '缺少必填字段: tag_name')
    assert_error(client.post(f'/api/files/{fid}/tags', json_body={'tag_name': '  '}, user=uid), 400, 'TAG_003',
                 '标签不能为空')
    assert_error(client.post(f'/api/files/{fid}/tags', json_body={'tag_name': 'x' * 101}, user=uid), 400, 'TAG_003')


def test_anyone_can_tag_any_file(client, seed):
    """现状：打标签不检查是不是上传者。"""
    owner, other = seed.user(), seed.user()
    fid = seed.file(owner)
    assert client.post(f'/api/files/{fid}/tags', json_body={'tag_name': 'x'}, user=other).status == 201


# ---------------------------------------------------------------- 批量删除


def test_batch_delete(client, seed, storage):
    owner, other = seed.user(), seed.user()
    mine = [seed.file(owner), seed.file(owner)]
    theirs = seed.file(other)
    url = '/api/files/batch/delete'

    r = client.post(url, json_body={'file_ids': [mine[0], theirs, 99999]}, user=owner)
    assert r.status == 207
    body = assert_shape(r.json(), {'success': bool, 'code': str, 'message': str, 'results': BATCH_RESULTS})
    assert body['success'] is False and body['code'] == 'TAG_004'   # 现状：删除也用 TAG_004
    assert body['results']['succeeded'] == [mine[0]]
    assert body['results']['failed'] == [{'file_id': theirs, 'error': '没有删除权限'},
                                         {'file_id': 99999, 'error': '文件不存在'}]

    all_bad = client.post(url, json_body={'file_ids': [theirs]}, user=owner)
    assert all_bad.status == 400 and all_bad.json()['message'] == '所有文件删除失败'

    ok = client.post(url, json_body={'file_ids': [mine[1]]}, user=owner)
    assert ok.status == 200
    assert ok.json() == {'success': True, 'message': '成功删除 1 个文件',
                         'results': {'succeeded': [mine[1]], 'failed': []}}


def test_batch_delete_validation(client, seed):
    uid = seed.user()
    url = '/api/files/batch/delete'
    assert_error(client.post(url, json_body={}, user=uid), 400, 'BATCH_001', '缺少必填字段: file_ids')
    assert_error(client.post(url, json_body={'file_ids': []}, user=uid), 400, 'BATCH_001', '文件ID列表不能为空')
    assert_error(client.post(url, json_body={'file_ids': list(range(101))}, user=uid), 400, 'BATCH_002')


# ---------------------------------------------------------------- 批量标签


def test_batch_add_tag(client, seed):
    uid = seed.user()
    a, b = seed.file(uid), seed.file(uid)
    url = '/api/files/batch/tags'
    r = client.post(url, json_body={'file_ids': [a, b], 'tag_name': '合集'}, user=uid)
    assert r.status == 200
    body = assert_shape(r.json(), {'success': bool, 'message': str, 'tag': TAG, 'results': BATCH_RESULTS})
    assert body['results'] == {'succeeded': [a, b], 'failed': []}
    # 已经有的算成功，不存在的文件算失败
    r = client.post(url, json_body={'file_ids': [a, 99999], 'tag_name': '合集'}, user=uid)
    assert r.status == 207
    assert r.json()['code'] == 'TAG_004' and r.json()['results']['succeeded'] == [a]
    r = client.post(url, json_body={'file_ids': [99999], 'tag_name': '合集'}, user=uid)
    assert r.status == 400 and r.json()['success'] is False


def test_batch_add_tag_validation(client, seed):
    uid = seed.user()
    url = '/api/files/batch/tags'
    assert_error(client.post(url, json_body={}, user=uid), 400, 'BATCH_001', '请求数据不能为空')
    assert_error(client.post(url, json_body={'file_ids': [], 'tag_name': 'x'}, user=uid), 400, 'BATCH_001')
    assert_error(client.post(url, json_body={'file_ids': [1], 'tag_name': ' '}, user=uid), 400, 'TAG_003')
    assert_error(client.post(url, json_body={'file_ids': [1], 'tag_name': 'x' * 101}, user=uid), 400, 'TAG_003')
    assert_error(client.post(url, json_body={'file_ids': list(range(101)), 'tag_name': 'x'}, user=uid), 400,
                 'BATCH_002')


def test_batch_remove_tag(client, seed):
    uid = seed.user()
    a, b = seed.file(uid), seed.file(uid)
    t = seed.tag('合集', uid)
    seed.file_tag(a, t)
    url = '/api/files/batch/tags'
    r = client.delete(url, json_body={'file_ids': [a, b], 'tag_id': t}, user=uid)
    assert r.status == 200
    assert r.json()['results'] == {'succeeded': [a, b], 'failed': []}   # 没有这个标签也算成功
    assert seed.one('SELECT COUNT(*) FROM file_tags')[0] == 0
    assert client.delete(url, json_body={'file_ids': [a, 99999], 'tag_id': t}, user=uid).status == 207

    assert_error(client.delete(url, json_body={'file_ids': [a], 'tag_id': 99999}, user=uid), 404, 'TAG_001', '标签不存在')
    assert_error(client.delete(url, json_body={'file_ids': [a]}, user=uid), 400, 'VALIDATION_001',
                 '缺少必填字段: tag_id')
    assert_error(client.delete(url, json_body={'tag_id': t}, user=uid), 400, 'BATCH_001')


# ---------------------------------------------------------------- 批量编辑


def test_batch_update(client, seed):
    owner, other = seed.user(), seed.user()
    a = seed.file(owner, 'a.jpg')
    b = seed.file(owner, 'b.jpg')
    theirs = seed.file(other, 'c.jpg')
    t = seed.tag('旧', owner)
    seed.file_tag(a, t)
    url = '/api/files/batch/update'

    r = client.post(url, json_body={'file_ids': [a, b], 'updates': {
        'activity_date': '2024-05-01', 'activity_type': 'team_building', 'activity_name': '春游',
        'free_tags': ['新'], 'tag_mode': 'replace'}}, user=owner)
    assert r.status == 200, r.text
    assert r.json() == {'success': True, 'message': '成功更新 2 个文件', 'results': {'succeeded': [a, b], 'failed': []}}
    row = seed.one('SELECT directory, activity_name FROM files WHERE id = ?', (a,))
    assert row == ('team_building/2024/05', '春游')
    names = [r[0] for r in seed.all('SELECT t.name FROM tags t JOIN file_tags ft ON ft.tag_id = t.id '
                                    'WHERE ft.file_id = ?', (a,))]
    assert names == ['新']

    r = client.post(url, json_body={'file_ids': [a, theirs, 99999], 'updates': {'activity_name': 'x'}}, user=owner)
    assert r.status == 207
    body = r.json()
    assert body['code'] == 'PARTIAL_SUCCESS'
    assert body['results']['failed'] == [{'file_id': theirs, 'error': '没有编辑权限'},
                                         {'file_id': 99999, 'error': '文件不存在'}]

    r = client.post(url, json_body={'file_ids': [theirs], 'updates': {'activity_name': 'x'}}, user=owner)
    assert r.status == 400 and 'code' not in r.json() and r.json()['message'] == '所有文件更新失败'


def test_batch_update_directory_conflict(client, seed):
    uid = seed.user()
    a = seed.file(uid, 'same.jpg', activity_date='2025-03-01')
    seed.file(uid, 'same.jpg', activity_date='2025-04-01')
    r = client.post('/api/files/batch/update', json_body={'file_ids': [a], 'updates': {
        'activity_date': '2025-04-10'}}, user=uid)
    assert r.status == 400
    assert r.json()['results']['failed'] == [{'file_id': a, 'error': '已有同名文件「same.jpg」'}]
    assert seed.one('SELECT activity_date FROM files WHERE id = ?', (a,))[0] == '2025-03-01'


def test_batch_update_validation(client, seed):
    uid = seed.user()
    url = '/api/files/batch/update'
    assert_error(client.post(url, json_body={}, user=uid), 400, 'BATCH_001', '请求数据不能为空')
    assert_error(client.post(url, json_body={'updates': {'x': 1}}, user=uid), 400, 'BATCH_001', '文件ID列表不能为空')
    assert_error(client.post(url, json_body={'file_ids': [1]}, user=uid), 400, 'BATCH_001', '更新内容不能为空')
    assert_error(client.post(url, json_body={'file_ids': list(range(101)), 'updates': {'x': 1}}, user=uid), 400,
                 'BATCH_002')
    assert_error(client.post(url, json_body={'file_ids': [1], 'updates': {'activity_type': 'x'}}, user=uid), 400,
                 'FILE_008')
    assert_error(client.post(url, json_body={'file_ids': [1], 'updates': {'activity_date': 'x'}}, user=uid), 400,
                 'FILE_007')


# ---------------------------------------------------------------- 活动名、活动目录


def test_activity_names(client, seed):
    uid = seed.user()
    seed.file(uid, activity_date='2025-03-15', activity_name='周末特训')
    seed.file(uid, activity_date='2025-03-15', activity_name='周末特训')
    seed.file(uid, activity_date='2025-03-15', activity_name='比赛', activity_type='competition')
    seed.file(uid, activity_date='2025-03-15', activity_name='')
    r = client.get('/api/files/activity-names', params={'date': '2025-03-15'}, user=uid)
    assert r.status == 200
    assert r.json() == {'success': True, 'date': '2025-03-15', 'activity_names': [
        {'name': '周末特训', 'activity_type': 'regular_training', 'activity_type_display': '例训', 'file_count': 2},
        {'name': '比赛', 'activity_type': 'competition', 'activity_type_display': '比赛', 'file_count': 1},
    ]}
    assert_error(client.get('/api/files/activity-names', user=uid), 400, 'VALIDATION_001', '缺少必填参数: date')
    assert_error(client.get('/api/files/activity-names', params={'date': 'x'}, user=uid), 400, 'VALIDATION_001')


DIR_QUERY = {'activity_date': '2025-03-15', 'activity_name': '周末特训', 'activity_type': 'regular_training'}


def test_activity_directory_info(client, seed):
    owner, other = seed.user('队长'), seed.user()
    seed.file(owner, uploaded_at='2025-03-15 10:00:00.000000')
    seed.file(other, uploaded_at='2025-03-16 10:00:00.000000')
    r = client.get('/api/files/activity-directory', params=DIR_QUERY, user=other)
    assert r.status == 200
    d = assert_shape(r.json(), {'success': bool, 'directory': {
        'activity_date': str, 'activity_name': str, 'activity_type': str, 'activity_type_display': str,
        'file_count': int, 'owner_id': int, 'owner_name': str, 'created_at': Nullable(str), 'is_owner': bool}})['directory']
    assert (d['file_count'], d['owner_id'], d['owner_name'], d['is_owner']) == (2, owner, '队长', False)
    assert client.get('/api/files/activity-directory', params=DIR_QUERY, user=owner).json()['directory']['is_owner']

    assert_error(client.get('/api/files/activity-directory', params={'activity_date': '2025-03-15'}, user=owner),
                 400, 'VALIDATION_001')
    assert_error(client.get('/api/files/activity-directory', params={**DIR_QUERY, 'activity_date': 'x'}, user=owner),
                 400, 'VALIDATION_001')
    assert_error(client.get('/api/files/activity-directory', params={**DIR_QUERY, 'activity_name': '无'}, user=owner),
                 404, 'DIR_001', '活动不存在')


def test_activity_directory_update(client, seed):
    owner, other = seed.user(), seed.user()
    a = seed.file(owner, uploaded_at='2025-03-15 10:00:00.000000')
    b = seed.file(other, uploaded_at='2025-03-16 10:00:00.000000')
    url = '/api/files/activity-directory'

    err = assert_error(client.patch(url, json_body={**DIR_QUERY, 'new_activity_name': '改'}, user=other), 403, 'DIR_002')
    assert err['owner_id'] == owner and err['need_request'] is True

    r = client.patch(url, json_body={**DIR_QUERY, 'new_activity_name': '春训', 'new_activity_type': 'internal_training'},
                     user=owner)
    assert r.status == 200
    assert r.json() == {'success': True, 'message': '已更新 2 个文件', 'updated_count': 2,
                        'new_activity_name': '春训', 'new_activity_type': 'internal_training'}
    assert {r[0] for r in seed.all('SELECT directory FROM files WHERE id IN (?, ?)', (a, b))} == \
        {'internal_training/2025/03'}


def test_activity_directory_update_validation(client, seed):
    uid = seed.user()
    seed.file(uid)
    url = '/api/files/activity-directory'
    assert_error(client.patch(url, json_body={'activity_date': '2025-03-15'}, user=uid), 400, 'VALIDATION_001',
                 '缺少必填字段: activity_name')
    assert_error(client.patch(url, json_body=DIR_QUERY, user=uid), 400, 'VALIDATION_001')
    assert_error(client.patch(url, json_body={**DIR_QUERY, 'activity_date': 'x', 'new_activity_name': 'y'}, user=uid),
                 400, 'VALIDATION_001', '日期格式无效')
    assert_error(client.patch(url, json_body={**DIR_QUERY, 'new_activity_type': 'x'}, user=uid), 400, 'VALIDATION_001')
    assert_error(client.patch(url, json_body={**DIR_QUERY, 'activity_name': '无', 'new_activity_name': 'y'}, user=uid),
                 404, 'DIR_001')

