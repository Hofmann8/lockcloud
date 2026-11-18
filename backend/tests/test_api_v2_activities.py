"""契约（2026-09）：GET /api/activities 资料库首页的活动卡片。"""
from tests.schema import ISO_DATE, ISO_DATETIME, PAGINATION, Nullable, assert_error, assert_shape

ACTIVITY = {
    'activity_date': ISO_DATE, 'activity_type': Nullable(str), 'activity_type_display': str,
    'activity_name': Nullable(str),
    'file_count': int, 'image_count': int, 'video_count': int, 'audio_count': int, 'duration': float,
    'owner': Nullable({'id': int, 'name': str}),
    'covers': [{'id': int, 'thumbhash': Nullable(str), 'is_video': bool, 'width': Nullable(int),
                'height': Nullable(int)}],
    'taken_from': Nullable(str), 'taken_to': Nullable(str), 'updated_at': ISO_DATETIME,
}
BODY = {'activities': [ACTIVITY], 'pagination': PAGINATION, 'years': [{'year': int, 'count': int}]}


def test_activity_cards(client, seed):
    first, later = seed.user('最早上传的'), seed.user()
    kw = dict(activity_date='2026-03-15', activity_type='regular_training', activity_name='春季例训')
    seed.file(later, 'p1.jpg', raw_w=3000, raw_h=4000, taken_at='2026-03-15T19:10:00',
              uploaded_at='2026-03-16 10:00:00.000000', **kw)
    seed.file(first, 'p2.jpg', raw_w=4000, raw_h=3000, taken_at='2026-03-15T19:02:11', thumbhash='abc',
              uploaded_at='2026-03-16 09:00:00.000000', **kw)
    seed.file(later, 'v.mp4', content_type='video/mp4', media_status='ready',
              media_info={'width': 1920, 'height': 1080, 'duration': 30.5}, taken_at='2026-03-15T21:40:03',
              uploaded_at='2026-03-16 11:00:00.000000', **kw)
    seed.file(later, 'v2.mp4', content_type='video/mp4', media_status='ready', media_info={'duration': 10},
              uploaded_at='2026-03-16 12:00:00.000000', **kw)
    seed.file(later, 'doc.pdf', content_type='application/pdf', uploaded_at='2026-03-16 13:00:00.000000', **kw)
    seed.file(later, 'song.mp3', content_type='audio/mpeg', ext='.mp3', uploaded_at='2026-03-16 12:30:00.000000', **kw)
    other = seed.file(later, activity_date='2025-11-01', activity_type='competition', activity_name='比赛')
    seed.file(later, activity_date=None, activity_type=None, activity_name=None)   # 未分类不算活动
    trashed = seed.file(later, activity_date='2024-01-01', activity_name='全删了')
    seed.trash(trashed, later)

    r = client.get('/api/activities', user=first)
    assert r.status == 200, r.text
    body = assert_shape(r.json(), BODY)
    assert [(a['activity_date'], a['activity_name']) for a in body['activities']] == \
        [('2026-03-15', '春季例训'), ('2025-11-01', '比赛')]
    card = body['activities'][0]
    assert (card['file_count'], card['image_count'], card['video_count'], card['audio_count']) == (6, 2, 2, 1)
    assert card['activity_type_display'] == '例训'
    assert card['duration'] == 40.5
    assert card['owner'] == {'id': first, 'name': '最早上传的'}     # 最早上传的人
    assert card['taken_from'] == '2026-03-15T19:02:11' and card['taken_to'] == '2026-03-15T21:40:03'
    assert card['updated_at'] == '2026-03-16T13:00:00'
    # 封面：横图和视频优先（3 个），不够再用竖图补；按拍摄时间排，没有拍摄时间的在后面
    covers = card['covers']
    assert len(covers) == 4
    assert [c['is_video'] for c in covers] == [False, False, True, True]
    assert covers[0] == {'id': covers[0]['id'], 'thumbhash': 'abc', 'is_video': False, 'width': 4000, 'height': 3000}
    assert body['activities'][1]['covers'][0]['id'] == other
    assert body['years'] == [{'year': 2026, 'count': 1}, {'year': 2025, 'count': 1}]
    assert body['pagination']['total'] == 2 and body['pagination']['per_page'] == 30


def test_activity_filters_and_pagination(client, seed):
    uid = seed.user()
    seed.file(uid, activity_date='2026-03-15', activity_name='春季例训')
    seed.file(uid, 'v.mp4', content_type='video/mp4', activity_date='2026-02-01', activity_type='competition',
              activity_name='冬季赛')
    seed.file(uid, activity_date='2025-12-24', activity_type='team_building', activity_name='圣诞团建')
    seed.file(uid, activity_date='2025-12-01', activity_name='十二月例训')

    def names(**params):
        r = client.get('/api/activities', params=params, user=uid)
        assert r.status == 200, r.text
        return [a['activity_name'] for a in r.json()['activities']]

    assert names() == ['春季例训', '冬季赛', '圣诞团建', '十二月例训']
    assert names(year=2025) == ['圣诞团建', '十二月例训']
    assert names(year=2026, month=2) == ['冬季赛']
    assert names(activity_type='competition') == ['冬季赛']
    assert names(media_type='video') == ['冬季赛']
    assert names(q='例训') == ['春季例训', '十二月例训']
    # years 不受 year / month 影响，受其他条件影响
    body = client.get('/api/activities', params={'year': 2025}, user=uid).json()
    assert body['years'] == [{'year': 2026, 'count': 2}, {'year': 2025, 'count': 2}]
    body = client.get('/api/activities', params={'q': '例训'}, user=uid).json()
    assert body['years'] == [{'year': 2026, 'count': 1}, {'year': 2025, 'count': 1}]

    p = client.get('/api/activities', params={'page': 2, 'per_page': 3}, user=uid).json()
    assert [a['activity_name'] for a in p['activities']] == ['十二月例训']
    assert p['pagination'] == {'page': 2, 'per_page': 3, 'total': 4, 'pages': 2, 'has_next': False, 'has_prev': True}
    assert client.get('/api/activities', params={'per_page': 500}, user=uid).json()['pagination']['per_page'] == 100
    assert_error(client.get('/api/activities', params={'media_type': 'pdf'}, user=uid), 400, 'VALIDATION_001')
    assert_error(client.get('/api/activities'), 401, 'AUTH_001')
