"""LockAI 分析：发起、额度、队列处理、分析结果用到八拍段落上、抽帧只跑分析过的视频。"""
import json
from datetime import datetime

import pytest

from tests.schema import assert_error
from tests.test_api_v2_media import VIDEO_INFO, _beats_json, _hex

CHAPTERS_JSON = {'segments': [
    {'start': 0, 'end': 1.4, 'type': 'other', 'piece': None, 'label': '开场站位', 'confidence': 0.9},
    {'start': 1.5, 'end': 5.0, 'type': 'dance', 'piece': 'A', 'label': '红衣组', 'confidence': 0.9},
    {'start': 5.0, 'end': 6.0, 'type': 'talk', 'piece': None, 'label': '换场', 'confidence': 0.8},
    {'start': 6.3, 'end': 10.4, 'type': 'dance', 'piece': 'B', 'label': '黑衣组', 'confidence': 0.9},
], 'notes': '两组依次表演'}


@pytest.fixture
def fake_model(monkeypatch):
    from services import lockai
    calls = []

    def call(url, prompt, tag='', client=None, model=None):
        calls.append({'url': url, 'prompt': prompt})
        if fake_model_state['fail']:
            raise RuntimeError('模型超时')
        return {'text': '```json\n' + json.dumps(CHAPTERS_JSON, ensure_ascii=False) + '\n```', 'reasoning': '',
                'usage': {'total_tokens': 100}, 'finish_reason': 'stop', 'first_token_s': 1.0, 'elapsed_s': 2.0}

    fake_model_state = {'fail': False}
    monkeypatch.setattr(lockai, 'call_model', call)
    return {'calls': calls, 'state': fake_model_state}


def _video(seed, uid, **kw):
    return seed.file(uid, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO, **kw)


def _job_id(seed, fid):
    return seed.one('SELECT id FROM lockai_jobs WHERE file_id = ?', (fid,))[0]


def test_request_and_quota(client, seed):
    uploader, member = seed.user('上传的人'), seed.user('队员')
    admin = seed.user('管理员', is_admin=True)
    videos = [_video(seed, uploader) for _ in range(5)]
    image = seed.file(uploader)

    q = client.get('/api/lockai/quota', user=member).json()
    assert (q['limit'], q['used'], q['remaining']) == (3, 0, 3) and q['resets_at']

    # 别人上传的视频也能发起：发起人记成自己
    r = client.post(f'/api/files/{videos[0]}/lockai', json_body={}, user=member)
    assert r.status == 201, r.text
    body = r.json()
    assert body['lockai']['status'] == 'queued' and body['lockai']['requested_by'] == {'id': member, 'name': '队员'}
    assert body['quota']['remaining'] == 2
    assert client.get(f'/api/files/{videos[0]}', user=uploader).json()['file']['lockai_status'] == 'queued'
    assert client.get(f'/api/files/{videos[0]}/media', user=uploader).json()['lockai']['status'] == 'queued'

    assert_error(client.post(f'/api/files/{videos[0]}/lockai', json_body={}, user=uploader), 409, 'LOCKAI_003')
    assert_error(client.post(f'/api/files/{image}/lockai', json_body={}, user=member), 400, 'LOCKAI_001')
    assert_error(client.post('/api/files/99999/lockai', json_body={}, user=member), 404, 'FILE_001')

    for fid in videos[1:3]:
        assert client.post(f'/api/files/{fid}/lockai', json_body={}, user=member).status == 201
    assert_error(client.post(f'/api/files/{videos[3]}/lockai', json_body={}, user=member), 403, 'LOCKAI_005')

    # 失败的不占额度
    seed.exec("UPDATE lockai_jobs SET status = 'failed' WHERE file_id = ?", (videos[0],))
    assert client.get('/api/lockai/quota', user=member).json()['remaining'] == 1
    # 上个月发起的不算
    seed.exec("UPDATE lockai_jobs SET requested_at = '2020-01-01 00:00:00' WHERE file_id = ?", (videos[1],))
    assert client.get('/api/lockai/quota', user=member).json()['remaining'] == 2

    # 管理员不限，还能重新分析已经分析过的
    q = client.get('/api/lockai/quota', user=admin).json()
    assert (q['limit'], q['remaining']) == (None, None)
    seed.exec("UPDATE lockai_jobs SET status = 'ready' WHERE file_id = ?", (videos[2],))
    assert_error(client.post(f'/api/files/{videos[2]}/lockai', json_body={}, user=member), 409, 'LOCKAI_004')
    assert client.post(f'/api/files/{videos[2]}/lockai', json_body={'force': True}, user=admin).status == 201
    assert client.post(f'/api/files/{videos[4]}/lockai', json_body={}, user=admin).status == 201


def test_month_bounds():
    from services.lockai import month_bounds
    # 北京时间 12 月 1 日 01:00 已经是 12 月
    start, end = month_bounds(datetime(2026, 11, 30, 17, 0))
    assert (start, end) == (datetime(2026, 11, 30, 16, 0), datetime(2026, 12, 31, 16, 0))
    start, end = month_bounds(datetime(2026, 11, 30, 15, 59))
    assert (start, end) == (datetime(2026, 10, 31, 16, 0), datetime(2026, 11, 30, 16, 0))


def test_process_job(client, seed, storage, fake_model):
    from services import lockai
    uploader, member = seed.user('上传的人'), seed.user('队员')
    fid = _video(seed, uploader)
    storage.objects[f'media/{_hex(seed, fid)}/beats.json'] = _beats_json()
    client.post(f'/api/files/{fid}/lockai', json_body={}, user=member)

    assert lockai.process_job(_job_id(seed, fid)) == 'ready'
    assert lockai.process_job(_job_id(seed, fid)) == 'skipped'   # 不会重复跑
    call = fake_model['calls'][0]
    assert call['url'].startswith('https://oss.test/files/') and '有音乐节拍的区间' in call['prompt']

    info = client.get(f'/api/files/{fid}/media', user=uploader).json()['lockai']
    assert info['status'] == 'ready' and info['finished_at']
    assert [(c['kind'], c['title'], c['piece']) for c in info['chapters']] == \
        [('other', '开场站位', None), ('dance', '红衣组', 'A'), ('talk', '换场', None), ('dance', '黑衣组', 'B')]
    assert client.get(f'/api/files/{fid}', user=uploader).json()['file']['lockai_status'] == 'ready'

    # 八拍的段落按每支舞的开头分：1.5 秒吸到第 2 拍（1.56），6.3 秒吸到第 11 拍（6.24）；开场单独一段
    beats = client.get(f'/api/files/{fid}/beats', user=uploader).json()
    assert beats['parts'] == [0, 2, 11]
    assert beats['sections'] == [[0, 3], [2, 3], [11, 3]]


def test_process_retry_then_fail(client, seed, storage, fake_model):
    from services import lockai
    member = seed.user()
    fid = _video(seed, member)
    storage.objects[f'media/{_hex(seed, fid)}/beats.json'] = _beats_json()
    client.post(f'/api/files/{fid}/lockai', json_body={}, user=member)
    fake_model['state']['fail'] = True
    assert lockai.process_job(_job_id(seed, fid)) == 'queued'     # 第一次失败放回队列
    assert lockai.process_job(_job_id(seed, fid)) == 'failed'
    assert client.get(f'/api/files/{fid}/media', user=member).json()['lockai']['status'] == 'failed'
    assert client.get('/api/lockai/quota', user=member).json()['remaining'] == 3
    # 失败了可以重新发起
    assert client.post(f'/api/files/{fid}/lockai', json_body={}, user=member).status == 201


def test_claimable_waits_for_media(client, seed):
    """视频还没处理好的先等着；视频处理失败的直接记 failed；回收站里的不跑。"""
    import database
    from services import lockai
    member = seed.user(is_admin=True)   # 四个，超过普通成员的额度
    ready = _video(seed, member)
    pending = seed.file(member, content_type='video/mp4', media_status='pending')
    broken = seed.file(member, content_type='video/mp4', media_status='pending')
    trashed = _video(seed, member)
    for fid in (ready, pending, broken, trashed):
        assert client.post(f'/api/files/{fid}/lockai', json_body={}, user=member).status == 201
    seed.exec("UPDATE files SET media_status = 'failed' WHERE id = ?", (broken,))
    seed.exec("UPDATE files SET deleted_at = '2026-11-01 00:00:00' WHERE id = ?", (trashed,))
    with database.session() as db:
        ids, waiting = lockai._claimable(db, 10)
    assert ids == [_job_id(seed, ready)] and waiting is True
    assert seed.one('SELECT status FROM lockai_jobs WHERE file_id = ?', (broken,))[0] == 'failed'
    assert seed.one('SELECT lockai_status FROM files WHERE id = ?', (broken,))[0] == 'failed'


def test_frame_workers_only_take_analyzed(seed):
    """抽帧 embedding、人脸只挑 LockAI 分析过的视频。"""
    import database
    from scripts import embed_worker, face_worker
    uid = seed.user()
    info = {**VIDEO_INFO, 'frames': {'count': 3, 'interval': 2.0}}
    plain = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=info)
    analyzed = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=info)
    seed.exec("UPDATE files SET lockai_status = 'ready' WHERE id = ?", (analyzed,))
    with database.session() as db:
        assert [f.id for f in embed_worker.fetch_pending_videos(db, None)] == [analyzed]
        assert [f.id for f in face_worker.fetch_pending_videos(db, None)] == [analyzed]
    assert plain


def test_chapter_grid():
    from services.beat_grid import chapter_grid
    times = [0.5 * i for i in range(40)]           # 0 – 19.5 秒，每 0.5 秒一拍
    sections = [[0, 0]]
    chapters = [
        {'start': 3.1, 'end': 9.0, 'kind': 'dance'},    # 吸到 3.0（第 6 拍）
        {'start': 9.0, 'end': 10.0, 'kind': 'talk'},    # 不是舞，不分
        {'start': 12.0, 'end': 13.0, 'kind': 'dance'},  # 正好在拍上
        {'start': 12.2, 'end': 13.0, 'kind': 'dance'},  # 吸过去和上一段同一拍，跳过
    ]
    assert chapter_grid(times, sections, chapters) == {'sections': [[0, 0], [6, 0], [24, 0]], 'parts': [0, 6, 24]}
    # 开头附近没拍（音乐晚进）：取这支舞里的第一拍
    late = [0.5 * i for i in range(10)] + [20 + 0.5 * i for i in range(10)]
    assert chapter_grid(late, [[0, 0], [10, 10]], [{'start': 15.0, 'end': 30.0, 'kind': 'dance'}])['parts'] == [0, 10]
    # 舞里一拍都没有：不分
    assert chapter_grid(late, [[0, 0]], [{'start': 8.0, 'end': 12.0, 'kind': 'dance'}])['parts'] == [0]


def test_queue_thread_runs_jobs(client, seed, storage, fake_model, monkeypatch):
    """发起后不用人管：调度线程自己认领、跑完。"""
    import time as _time
    from services import lockai
    monkeypatch.setattr(lockai, '_enabled', True)
    monkeypatch.setattr(lockai, 'POLL_SECONDS', 0.2)
    member = seed.user(is_admin=True)
    fids = [_video(seed, member) for _ in range(4)]
    for fid in fids:
        storage.objects[f'media/{_hex(seed, fid)}/beats.json'] = _beats_json()
        assert client.post(f'/api/files/{fid}/lockai', json_body={}, user=member).status == 201
    deadline = _time.monotonic() + 10
    while _time.monotonic() < deadline:
        done = [seed.one('SELECT status FROM lockai_jobs WHERE file_id = ?', (f,))[0] for f in fids]
        if all(s == 'ready' for s in done) and not lockai._running:
            break
        _time.sleep(0.1)
    assert done == ['ready'] * 4 and len(fake_model['calls']) == 4
    assert not lockai._running     # 跑完线程自己退出


def test_songs_in_medley():
    """串烧：一支舞里换了歌，换歌点只听模型的；新歌从它的第一个小节头数"1"（算法常把"5"当成"1"）。"""
    from services.beat_grid import chapter_grid
    from services.lockai import chapters_of
    # 前 40 拍 125 BPM，后 40 拍 117 BPM。算法在第 40 拍（接口处的过渡拍）换相位，小节头是 41、45……，却挑了 45 当"1"
    times = [5 + 0.48 * i for i in range(40)]
    times += [times[-1] + 0.513 * (i + 1) for i in range(40)]
    sections = [[0, 0], [40, 45]]

    parsed = {'segments': [
        {'start': 0, 'end': 5, 'type': 'other', 'label': '准备', 'songs': [2]},           # 非舞蹈段的 songs 不要
        {'start': 5, 'end': 50, 'type': 'dance', 'piece': 'A', 'label': '群舞',
         'songs': [round(times[40], 1), 'x', 99]},                                       # 坏的、越界的不要
    ]}
    chapters = chapters_of(parsed, 60)
    assert chapters[0]['songs'] == [] and chapters[1]['songs'] == [round(times[40], 1)]

    grid = chapter_grid(times, sections, chapters)
    assert grid['parts'] == [0, 41]
    assert grid['sections'] == [[0, 0], [40, 41], [41, 41]]   # 第 40 拍数成新歌前面的 8

    # 附近没有相位突变：取离换歌时刻最近的小节头，前一首歌的数拍不动
    flat = [5 + 0.5 * i for i in range(80)]
    grid = chapter_grid(flat, [[0, 4]], [{'start': 5, 'end': 45, 'kind': 'dance', 'songs': [flat[31]]}])
    assert grid == {'sections': [[0, 4], [32, 32]], 'parts': [0, 32]}
    # 离拍点太远：不分
    assert chapter_grid(flat, [[0, 4]], [{'start': 5, 'end': 45, 'kind': 'dance', 'songs': [60.0]}])['parts'] == [0]


class _Resp:
    def __init__(self, body):
        self.body = body

    def raise_for_status(self):
        pass

    def json(self):
        return self.body


def test_process_job_with_allin1(client, seed, storage, fake_model, monkeypatch):
    """配了 All-In-One：和模型同时调，小节头存进结果；调失败不影响分析，只是没有小节头。"""
    from services import lockai
    from config import settings
    sent = []

    def post(url, json=None, headers=None, timeout=None):
        sent.append((url, json, headers))
        if json['key'].endswith('fail.mp4'):
            raise TimeoutError('冷启动太久')
        return _Resp({'downbeats': [1.04, 3.12, 5.2], 'beats': [0.52, 1.04, 1.56]})

    monkeypatch.setattr(lockai, 'ALLIN1_URL', 'https://allin1.test')
    monkeypatch.setattr(lockai.requests, 'post', post)
    member = seed.user()
    fid = _video(seed, member)
    storage.objects[f'media/{_hex(seed, fid)}/beats.json'] = _beats_json()
    client.post(f'/api/files/{fid}/lockai', json_body={}, user=member)
    assert lockai.process_job(_job_id(seed, fid)) == 'ready'
    url, body, headers = sent[0]
    assert url == 'https://allin1.test/analyze' and body['key'].startswith('files/')
    assert headers['X-Media-Token'] == (settings.media_callback_token or '')
    result = json.loads(seed.one('SELECT result FROM lockai_jobs WHERE file_id = ?', (fid,))[0])
    assert result['downbeats'] == [1.04, 3.12, 5.2] and result['allin1_beats'] == [0.52, 1.04, 1.56]
    # 小节头都落在第 1、5、9 拍上，和 beat_this 后半段的意见一样：整段按这个位置数
    assert client.get(f'/api/files/{fid}/beats', user=member).json()['sections'] == [[0, 5], [2, 5], [11, 5]]

    monkeypatch.setattr(lockai, 'call_allin1', lambda key, tag='': None)   # 失败时 call_allin1 返回 None
    fid2 = _video(seed, member)
    storage.objects[f'media/{_hex(seed, fid2)}/beats.json'] = _beats_json()
    client.post(f'/api/files/{fid2}/lockai', json_body={}, user=member)
    assert lockai.process_job(_job_id(seed, fid2)) == 'ready'
    assert 'downbeats' not in json.loads(seed.one('SELECT result FROM lockai_jobs WHERE file_id = ?', (fid2,))[0])


def test_call_allin1_failure_is_soft(monkeypatch):
    from services import lockai

    def boom(*a, **k):
        raise TimeoutError('冷启动太久')

    monkeypatch.setattr(lockai, 'ALLIN1_URL', 'https://allin1.test')
    monkeypatch.setattr(lockai.requests, 'post', boom)
    assert lockai.call_allin1('files/' + 'a' * 32 + '.mp4') is None
    monkeypatch.setattr(lockai, 'ALLIN1_URL', '')
    assert lockai.call_allin1('files/' + 'a' * 32 + '.mp4') is None


def _lattice(n, period=0.5, t0=1.0):
    return [round(t0 + i * period, 3) for i in range(n)]


def test_regularize_offbeat_run_in_song():
    """同一首歌中间有一段跳到反拍上（先隔半拍、跟一阵、再隔一拍半回来）：换回等距格子，前后的拍子原样，"1"接着前面数。"""
    from services import beat_grid
    good = _lattice(80)
    times = good[:30] + [round(x + 0.25, 3) for x in good[30:40]] + good[41:]   # 第 30–39 拍在反拍上，少了一拍
    sections = [[0, 2], [30, 33], [40, 41]]                                      # beat_this 在跳的地方另起了相位段
    t2, s2 = beat_grid.regularize(times, sections)
    assert len(t2) == 80 and max(abs(a - b) for a, b in zip(t2, good)) < 0.01
    assert t2[:30] == times[:30] and t2[-39:] == times[-39:]                    # 本来对的拍子一个没动
    assert s2[1] == [30, 2]                                                      # 被换掉的那段"1"跟前面数


def test_regularize_keeps_pauses_and_clean_tracks():
    """音乐停过（两支舞之间）不往空白里补拍；本来就整齐的不动。"""
    from services import beat_grid
    clean = _lattice(64)
    assert beat_grid.regularize(clean, [[0, 0]]) == (clean, [[0, 0]])
    a = _lattice(30)
    b = [round(x + 20.25, 3) for x in _lattice(30)]                             # 停了 5 秒再放，相位不一样
    t2, s2 = beat_grid.regularize(a + b, [[0, 0], [30, 30]])
    assert t2 == a + b and s2 == [[0, 0], [30, 30]]


def test_regularize_song_change_keeps_previous_song_until_seam():
    """换歌前 beat_this 跳到反拍上跟了一阵：前一首的格子一直铺到后一首对得上的地方，后一首原样，交接那一下不管。"""
    from services import beat_grid
    song1 = _lattice(48, 0.48)
    off = [round(x + 0.24, 3) for x in song1[40:]]                               # 最后 8 拍跑到反拍上
    start2 = round(song1[-1] + 0.7, 3)
    song2 = [round(start2 + 0.513 * i, 3) for i in range(40)]
    times = song1[:40] + off + song2
    t2, _ = beat_grid.regularize(times, [[0, 0], [40, 41], [48, 48]])
    assert max(abs(x - y) for x, y in zip(t2[:48], song1)) < 0.01             # 反拍那几拍回到第一首的格子上
    assert max(abs(x - y) for x, y in zip(t2[-40:], song2)) < 1e-6             # 第二首一个没动
