"""契约（2026-09）：管理页的统计、媒体处理失败、重跑。"""
from datetime import datetime

from tests.schema import FILE_DISPLAY, Any, Nullable, Regex, assert_error, assert_shape

PIPE = {'pending': int, 'done': int, 'failed': int}
STATS = {
    'storage': {'bytes': int, 'files': int, 'images': int, 'videos': int, 'others': int},
    'growth': [{'month': Regex(r'^\d{4}-\d{2}$'), 'files': int, 'bytes': int}],
    'by_type': [{'activity_type': Nullable(str), 'display': str, 'files': int, 'activities': int}],
    'pipeline': {'media': {'pending': int, 'ready': int, 'failed': int, 'skipped': int}, 'embedding': PIPE,
                 'faces': PIPE, 'persons': int, 'named_persons': int},
    'trash': {'files': int, 'bytes': int},
    'users': {'total': int, 'active_30d': int},
}


def test_admin_only(client, seed):
    uid = seed.user()
    for method, path in (('get', '/api/admin/stats'), ('get', '/api/admin/media/failures'),
                         ('post', '/api/admin/media/reprocess')):
        assert_error(getattr(client, method)(path, json_body={} if method == 'post' else None, user=uid),
                     403, 'ADMIN_001')


def test_stats(client, seed):
    admin = seed.user(is_admin=True)
    seed.exec('UPDATE users SET last_login = ? WHERE id = ?', (datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f'),
                                                               admin))
    seed.user()
    now = datetime.utcnow()
    this_month = now.strftime('%Y-%m')
    img = seed.file(admin, size=100, media_status='ready', activity_name='例训一')
    seed.file(admin, size=200, media_status='ready', activity_name='例训二')
    vid = seed.file(admin, content_type='video/mp4', size=1000, media_status='ready', activity_type='competition',
                    activity_name='比赛', media_info={'frames': {'count': 3, 'interval': 2.0}})
    seed.file(admin, content_type='application/pdf', size=5, media_status='skipped', activity_name='例训一')
    seed.file(admin, content_type='video/mp4', size=7, media_status='failed', activity_date=None, activity_type=None,
              activity_name=None, uploaded_at='2020-01-01 00:00:00.000000')
    gone = seed.file(admin, size=9999)
    seed.trash(gone, admin)
    seed.exec("UPDATE files SET embedding_status = 'ok', face_status = 'no_face' WHERE id = ?", (img,))
    seed.exec("UPDATE files SET frame_embedding_status = 'failed' WHERE id = ?", (vid,))
    rp = seed.real_person('有名字')
    seed.person(face_count=3, real_person_id=rp)
    seed.person(face_count=2)
    seed.person(face_count=0)

    r = client.get('/api/admin/stats', user=admin)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), STATS)
    assert body['storage'] == {'bytes': 1312, 'files': 5, 'images': 2, 'videos': 2, 'others': 1}
    assert len(body['growth']) == 24 and body['growth'][-1]['month'] == this_month
    assert body['growth'][-1] == {'month': this_month, 'files': 4, 'bytes': 1305}   # 2020 年那个不在 24 个月里
    types = {t['activity_type']: t for t in body['by_type']}
    assert types['regular_training'] == {'activity_type': 'regular_training', 'display': '例训', 'files': 3,
                                         'activities': 2}
    assert types['competition']['activities'] == 1
    assert types[None] == {'activity_type': None, 'display': '未分类', 'files': 1, 'activities': 0}
    pipe = body['pipeline']
    assert pipe['media'] == {'pending': 0, 'ready': 3, 'failed': 1, 'skipped': 1}
    # 图片 2 张（1 ok、1 pending）+ 抽过帧的视频 1 个（failed）
    assert pipe['embedding'] == {'pending': 1, 'done': 1, 'failed': 1}
    assert pipe['faces'] == {'pending': 2, 'done': 1, 'failed': 0}
    assert (pipe['persons'], pipe['named_persons']) == (2, 1)
    assert body['trash'] == {'files': 1, 'bytes': 9999}
    assert body['users'] == {'total': 2, 'active_30d': 1}


def test_media_failures(client, seed):
    admin = seed.user(is_admin=True)
    failed = seed.file(admin, content_type='video/mp4', media_status='failed', media_info={'error': '没有视频流'})
    partial = seed.file(admin, content_type='video/mp4', media_status='ready',
                        media_info={'duration': 3, 'errors': {'beats': '音轨太短'}})
    seed.file(admin, content_type='video/mp4', media_status='ready', media_info={'duration': 3})
    gone = seed.file(admin, media_status='failed')
    seed.trash(gone, admin)
    r = client.get('/api/admin/media/failures', user=admin)
    assert r.status == 200
    body = assert_shape(r.json(), {'files': [{'file': FILE_DISPLAY, 'status': str, 'error': Nullable(str),
                                              'errors': Any}]})
    items = {x['file']['id']: x for x in body['files']}
    assert set(items) == {failed, partial}
    assert (items[failed]['status'], items[failed]['error'], items[failed]['errors']) == ('failed', '没有视频流', {})
    assert (items[partial]['status'], items[partial]['error'], items[partial]['errors']) == \
        ('ready', None, {'beats': '音轨太短'})


def test_media_reprocess(client, seed, fc):
    admin = seed.user(is_admin=True)
    vid = seed.file(admin, content_type='video/mp4')
    img = seed.file(admin)
    pdf = seed.file(admin, content_type='application/pdf', ext='.pdf')
    url = '/api/admin/media/reprocess'

    r = client.post(url, json_body={'file_ids': [vid, img, 99999], 'steps': ['sprite', 'beats']}, user=admin)
    assert r.status == 200, r.text
    assert r.json() == {'queued': [vid], 'skipped': [{'file_id': img, 'reason': '不是视频'},
                                                     {'file_id': 99999, 'reason': '文件不存在'}]}
    assert fc.calls == [('/jobs/process', {'key': seed.s3_key(vid), 'steps': ['sprite', 'beats']})]

    fc.calls.clear()
    r = client.post(url, json_body={'file_ids': [vid, img, pdf]}, user=admin).json()
    assert r == {'queued': [vid, img], 'skipped': [{'file_id': pdf, 'reason': '不是图片或视频'}]}
    assert fc.calls == [('/jobs/process', {'key': seed.s3_key(vid)}), ('/jobs/process', {'key': seed.s3_key(img)})]

    fc.fail = RuntimeError('timeout')
    r = client.post(url, json_body={'file_ids': [vid]}, user=admin).json()
    assert r['queued'] == [] and r['skipped'][0]['reason'] == '处理服务暂不可用'

    for bad in ({}, {'file_ids': []}, {'file_ids': [vid], 'steps': ['nope']}, {'file_ids': [vid], 'steps': 'beats'},
                {'file_ids': list(range(1, 202))}):
        assert_error(client.post(url, json_body=bad, user=admin), 400, 'VALIDATION_001')
