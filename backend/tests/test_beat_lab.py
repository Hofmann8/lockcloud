"""节拍标注试验：连续音乐块里只定一个小节位置、剪辑接口切块、标注的存取。"""
import json
import tempfile
from pathlib import Path

import pytest

from tests.schema import assert_error
from tests.test_api_v2_media import VIDEO_INFO


def _lattice(n, period=0.5, t0=1.0):
    return [round(t0 + i * period, 3) for i in range(n)]


def _raw(times, sections, downbeats=None):
    return {'beats': {'bpm': 120, 'times': times, 'sections': sections, 'envelope_rate': 43.07, 'envelope': ''},
            'allin1': {'downbeats': downbeats} if downbeats is not None else None}


def test_one_phase_per_block():
    """同一首歌里 beat_this 中途把小节位置挪了半个小节、All-In-One 没变：整块只定一个位置，标成意见不一。
    停顿之后是另一块，两个模型一致。"""
    from services import beat_lab
    a = _lattice(80)
    b = [round(x + 45.2, 3) for x in _lattice(40)]          # 停 5 秒多再放
    times = a + b
    sections = [[0, 2], [30, 36], [80, 81]]                 # 第 30 拍起 beat_this 改口（2 → 0）
    down = [a[i] for i in range(0, 80, 4)] + [b[i] for i in range(1, 40, 4)]
    g = beat_lab.build(_raw(times, sections, down))
    assert [(x['start'], x['why'], x['flag']) for x in g['blocks']] == [(0, 'start', 'split'), (80, 'pause', 'agree')]
    assert g['blocks'][0]['phase'] == 0 and g['blocks'][1]['phase'] == 1
    assert g['blocks'][0]['candidates'] == {'bt_major': 0, 'bt_entry': 2, 'aio': 0}
    assert [s[0] for s in g['sections']] == [0, 80] and g['parts'] == [0, 80]
    assert g['sections'][0][1] % 4 == 0 and g['sections'][1][1] % 4 == 1
    assert g['times'] == times and g['has_allin1']


def test_models_disagree_and_no_allin1():
    """两个模型各说各的：听 All-In-One 的；没有 All-In-One 时按 beat_this 占多的那个。"""
    from services import beat_lab
    times = _lattice(64)
    down = [times[i] for i in range(2, 64, 4)][:9]          # All-In-One 漏了几个小节头也不吃亏
    g = beat_lab.build(_raw(times, [[0, 0]], down))
    assert g['blocks'][0]['phase'] == 2 and g['blocks'][0]['flag'] == 'split' and g['sections'] == [[0, 2]]
    g = beat_lab.build(_raw(times, [[0, 0], [40, 43]]))
    assert g['blocks'][0]['phase'] == 0 and g['blocks'][0]['flag'] == 'split' and not g['has_allin1']
    g = beat_lab.build(_raw(times, [[0, 3]]))
    assert g['blocks'][0]['flag'] == 'single' and g['sections'] == [[0, 3]]


def test_edit_splits_block():
    """剪辑接口：两个模型的小节位置在同一处都变了（接口那一拍还长了一截），从那里切成两块。"""
    from services import beat_lab
    a = _lattice(40)
    b = [round(a[-1] + 0.56 + i * 0.5, 3) for i in range(40)]
    times = a + b
    down = [a[i] for i in range(0, 40, 4)] + [b[i] for i in range(1, 40, 4)]
    g = beat_lab.build(_raw(times, [[0, 0], [41, 41]], down))
    assert [(x['start'], x['why']) for x in g['blocks']] == [(0, 'start'), (40, 'edit')]
    assert [x['phase'] for x in g['blocks']] == [0, 1]


@pytest.fixture
def lab(monkeypatch):
    from services import beat_lab
    with tempfile.TemporaryDirectory() as d:    # 不用 pytest 的 tmp_path：它的根目录在这台机器上没权限（同 test_large_images）
        monkeypatch.setattr(beat_lab, 'LAB_DIR', Path(d))
        yield Path(d)


def test_lab_api(client, seed, lab):
    member = seed.user()
    fid = seed.file(member, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO)
    other = seed.file(member, content_type='video/mp4', media_status='ready', media_info=VIDEO_INFO)
    assert_error(client.get('/api/lab/beats', user=member), 404, 'LAB_001')     # 没有样本目录：整个功能不存在

    (lab / 'samples.json').write_text(json.dumps({'ids': [fid]}), encoding='utf-8')
    row = client.get('/api/lab/beats', user=member).json()['samples'][0]
    assert row['file_id'] == fid and row['ready'] is False and row['status'] is None and row['marks'] == 0
    assert_error(client.get(f'/api/lab/beats/{fid}', user=member), 404, 'LAB_003')
    assert_error(client.get(f'/api/lab/beats/{other}', user=member), 404, 'LAB_002')

    (lab / 'raw').mkdir()
    (lab / 'raw' / f'{fid}.json').write_text(json.dumps(_raw(_lattice(64), [[0, 0]])), encoding='utf-8')
    body = client.get(f'/api/lab/beats/{fid}', user=member).json()
    assert body['grid']['sections'] == [[0, 0]] and body['labels'] == {'status': None, 'note': '', 'marks': []}

    labels = {'status': 'issues', 'note': '第二段错了', 'junk': 1,
              'marks': [{'t': 9.0, 'beat': 16, 'kind': 'cut', 'text': ''}, {'t': 3.0, 'beat': 4, 'kind': 'one', 'text': '进拍'},
                        {'t': 1, 'beat': 0, 'kind': 'nope'}]}
    saved = client.put(f'/api/lab/beats/{fid}/labels', json_body=labels, user=member).json()['labels']
    assert [m['kind'] for m in saved['marks']] == ['one', 'cut'] and saved['status'] == 'issues' and 'junk' not in saved
    client.put(f'/api/lab/beats/{fid}/labels', json_body={'status': 'ok', 'marks': []}, user=member)
    body = client.get(f'/api/lab/beats/{fid}', user=member).json()
    assert body['labels']['status'] == 'ok' and body['labels']['marks'] == []
    row = client.get('/api/lab/beats', user=member).json()['samples'][0]
    assert row['ready'] is True and row['status'] == 'ok'
    # 每次保存都留底
    assert len((lab / 'labels' / 'history.jsonl').read_text(encoding='utf-8').splitlines()) == 2
    assert_error(client.put(f'/api/lab/beats/{other}/labels', json_body=labels, user=member), 404, 'LAB_002')
    assert client.get('/api/lab/beats').status == 401
