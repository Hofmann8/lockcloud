"""八拍网格：两个模型的拍点互相校验、人改的"1"、直接改和修改申请。
（一段连续音乐只定一个小节位置、剪辑接口切块见 test_beat_lab.py；拍点归位、按舞分段见 test_lockai.py。）"""
import json

from tests.schema import assert_error
from tests.test_api_v2_media import TIMES, VIDEO_INFO, _beats_json, _hex


def _lattice(n, period=0.5, t0=1.0):
    return [round(t0 + i * period, 3) for i in range(n)]


def _steady(times, period, tolerance=0.12):
    return all(abs((b - a) / period - 1) < tolerance for a, b in zip(times, times[1:]))


def test_reconcile_takes_the_continuous_lattice():
    """同一首歌里 beat_this 被带跑（一阵四分之三拍长的拍子），回来后一直晚半拍到结尾；All-In-One 的拍点全程连贯：
    后半首换成 All-In-One 的拍点，整首是一块，小节位置按两个模型在前半首的一致意见定。"""
    from services import beat_grid
    song = _lattice(160)
    stray = [round(song[79] + 0.375 * (i + 1), 3) for i in range(12)]
    late = [round(t + 0.25, 3) for t in song[90:]]
    data = {'times': song[:80] + stray + late, 'sections': [[0, 2], [80, 81], [92, 95]]}
    other = [round(t - 0.03, 3) for t in song]                       # All-In-One 的拍点整体早 30 毫秒
    a = beat_grid.analyze(data, {'beats': other, 'downbeats': other[2::4]})
    assert a['spliced'] and abs(a['spliced'][0][0] - song[80]) < 0.05
    assert len(a['times']) == 160 and _steady(a['times'], 0.5)
    assert max(abs(x - y) for x, y in zip(a['times'], song)) < 0.05
    assert [b['start'] for b in a['blocks']] == [0] and a['blocks'][0]['phase'] == 2 and a['sections'] == [[0, 2]]
    # 没有 All-In-One 的拍点（老的分析结果、函数没配）：不校验，照旧用 beat_this 的
    assert beat_grid.analyze(data, {'downbeats': other[2::4]})['spliced'] == []


def test_reconcile_keeps_beat_this_when_the_other_slips():
    """反过来 All-In-One 中途滑了半拍、beat_this 连贯：拍点不动；All-In-One 在这一块里有一截没跟住，
    它判的小节头（比 beat_this 早一拍）也不算票。"""
    from services import beat_grid
    song = _lattice(120)
    other = song[:50] + [round(t + 0.25, 3) for t in song[50:]]
    data = {'times': song, 'sections': [[0, 0]]}
    a = beat_grid.analyze(data, {'beats': other, 'downbeats': other[3:50:4]})
    assert a['times'] == song and a['spliced'] == []
    assert a['blocks'][0]['phase'] == 0 and a['blocks'][0]['votes']['aio'] == {}
    # 对照：它没滑的话，两个模型各说各的，打平听 All-In-One 的
    b = beat_grid.analyze(data, {'beats': song, 'downbeats': song[3::4]})
    assert b['blocks'][0]['phase'] == 3 and b['blocks'][0]['flag'] == 'split'


def test_reconcile_new_song_beat_this_was_slow_to_follow():
    """换歌后 beat_this 有十来拍没跟上新速度、还空了两秒，All-In-One 从换歌那一拍起就在新歌的格子上：
    这一截换成 All-In-One 的，分界落在真正换歌的地方。"""
    from services import beat_grid
    song1 = _lattice(60, 0.6)
    start2 = round(song1[-1] + 0.6, 3)
    song2 = [round(start2 + 0.5 * i, 3) for i in range(100)]
    limp = [round(start2 + 0.575 * i, 3) for i in range(14)]          # 既不是前一首的速度，也不是后一首的
    data = {'times': song1 + limp + song2[20:], 'sections': [[0, 0], [74, 74]]}
    a = beat_grid.analyze(data, {'beats': song1 + song2, 'downbeats': song1[::4] + song2[::4]})
    assert a['spliced'] and len(a['times']) == 160
    assert max(abs(x - y) for x, y in zip(a['times'], song1 + song2)) < 0.1      # 交接的那一拍差几十毫秒，不管
    assert _steady(a['times'][62:], 0.5)
    # 新歌头两拍 beat_this 还在容差里，留着没换，分界可能晚一两拍
    assert len(a['blocks']) == 2 and a['blocks'][1]['why'] == 'tempo' and 60 <= a['blocks'][1]['start'] <= 62


def test_apply_ones():
    """人标的"1"：一段里标一个，整段跟着数；同一段后面再标一个，从那一拍起按新的数；不出这一段。"""
    from services import beat_grid
    times = _lattice(40) + [round(x + 30, 3) for x in _lattice(40)]
    sections = [[0, 0], [16, 0], [40, 41]]           # 第 16 拍是舞的开头（数法没变），第 40 拍起是停顿后的另一段
    bounds = beat_grid.fix_bounds(times, sections, [0, 40])
    assert bounds == [0, 40]
    assert beat_grid.apply_ones(times, sections, bounds, None) == sections
    assert beat_grid.apply_ones(times, sections, bounds, [times[22] + 0.1]) == [[0, 22], [16, 22], [40, 41]]
    two = beat_grid.apply_ones(times, sections, bounds, [times[6], times[29], times[43]])
    assert two == [[0, 6], [16, 6], [29, 29], [40, 43]]
    # 数法在串烧换歌处本来就变了的地方也是边界（不是连续音乐块的起点也算）
    medley = [[0, 0], [20, 22]]
    assert beat_grid.fix_bounds(times, medley, [0]) == [0, 20]
    assert beat_grid.apply_ones(times, medley, [0, 20], [times[3]]) == [[0, 3], [20, 22]]


def _analyzed(seed, storage, uid):
    fid = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO)
    seed.exec("UPDATE files SET lockai_status = 'ready' WHERE id = ?", (fid,))
    storage.objects[f'media/{_hex(seed, fid)}/beats.json'] = _beats_json()
    return fid


def test_beat_ones_put(client, seed, storage):
    """上传者、管理员直接改八拍；别人不行；没分析过的视频不能改。"""
    owner, other, admin = seed.user('上传的人'), seed.user('别人'), seed.user('管理员', is_admin=True)
    fid = _analyzed(seed, storage, owner)
    body = client.get(f'/api/files/{fid}/beats', user=owner).json()
    assert body['sections'] == [[0, 3]] and body['ones'] == [] and body['editable'] is True
    assert client.get(f'/api/files/{fid}/beats', user=other).json()['editable'] is False

    r = client.put(f'/api/files/{fid}/beats/ones', json_body={'ones': [TIMES[5] + 0.1, TIMES[5] + 0.1]}, user=owner)
    assert r.status == 200, r.text
    body = r.json()
    assert body['ones'] == [round(TIMES[5] + 0.1, 3)] and body['sections'] == [[0, 5]] and body['base_sections'] == [[0, 3]]
    assert client.get(f'/api/files/{fid}/beats', user=other).json()['sections'] == [[0, 5]]
    assert client.put(f'/api/files/{fid}/beats/ones', json_body={'ones': []}, user=admin).json()['sections'] == [[0, 3]]

    assert_error(client.put(f'/api/files/{fid}/beats/ones', json_body={'ones': [1.0]}, user=other), 403, 'FILE_002')
    for bad in ({'ones': 'x'}, {'ones': [-1]}, {'ones': ['1']}, {}):
        assert_error(client.put(f'/api/files/{fid}/beats/ones', json_body=bad, user=owner), 400, 'VALIDATION_001')
    plain = seed.file(owner, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO)
    storage.objects[f'media/{_hex(seed, plain)}/beats.json'] = _beats_json()
    assert_error(client.put(f'/api/files/{plain}/beats/ones', json_body={'ones': [1.0]}, user=owner), 400, 'BEATS_001')


def test_beats_request(client, seed, storage):
    """别人改八拍走修改申请：上传者同意后才生效，拒绝不生效。"""
    owner, member = seed.user('上传的人'), seed.user('队员')
    fid = _analyzed(seed, storage, owner)
    assert_error(client.post('/api/requests', json_body={'file_id': fid, 'request_type': 'beats',
                                                         'proposed_changes': {'ones': 'x'}}, user=member),
                 400, 'VALIDATION_001')
    r = client.post('/api/requests', json_body={'file_id': fid, 'request_type': 'beats',
                                                'proposed_changes': {'ones': [TIMES[6], 99999], 'junk': 1},
                                                'message': '第二段数错了'}, user=member)
    assert r.status == 201, r.text
    req = r.json()['request']
    assert req['request_type'] == 'beats' and req['proposed_changes'] == {'ones': [TIMES[6], 99999.0]}
    assert client.get(f'/api/files/{fid}/beats', user=member).json()['sections'] == [[0, 3]]      # 还没生效
    assert client.post(f'/api/requests/{req["id"]}/reject', json_body={}, user=owner).status == 200
    assert client.get(f'/api/files/{fid}/beats', user=member).json()['ones'] == []

    req = client.post('/api/requests', json_body={'file_id': fid, 'request_type': 'beats',
                                                  'proposed_changes': {'ones': [TIMES[6]]}}, user=member).json()['request']
    assert client.post(f'/api/requests/{req["id"]}/approve', json_body={}, user=owner).status == 200
    body = client.get(f'/api/files/{fid}/beats', user=member).json()
    assert body['ones'] == [TIMES[6]] and body['sections'] == [[0, 6]]
    assert json.loads(seed.one('SELECT ones FROM beat_fixes WHERE file_id = ?', (fid,))[0]) == [TIMES[6]]

    plain = seed.file(owner, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO)
    storage.objects[f'media/{_hex(seed, plain)}/beats.json'] = _beats_json()
    assert_error(client.post('/api/requests', json_body={'file_id': plain, 'request_type': 'beats',
                                                         'proposed_changes': {'ones': [1.0]}}, user=member),
                 400, 'BEATS_001')
