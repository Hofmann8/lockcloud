"""节拍标注试验（只在本地用）：拿一批视频打好拍子给人标对错，回头按标注评估算法。

数据都在 instance/beat_lab/（不进库、不上线；没有这个目录时接口返回 404）：
  samples.json           {"ids": [文件 id, ...]}，标注页按这个顺序列
  raw/{id}.json          scripts/beat_lab_prepare.py 取回来的原料：
                         {file, beats（媒体 FC 的 beats.json）, allin1（All-In-One 的结果，没跑过是 null）}
  labels/{id}.json       标注页存的：{status, note, marks: [{t, beat, kind, text}]}
  labels/history.jsonl   每次保存追加一行，误操作了能找回来

网格在请求时现算（build），算法改了不用重新取原料。标注里的时刻 t 是绝对秒数，不依赖算法。

打拍子用的就是线上那一套（beat_grid.analyze：两个模型的拍点互相校验，一段连续的音乐只定一个小节位置），
这里多带出每块里两个模型各自的意见（candidates）和是否一致（flag），标注回来后按块算各种取法的正确率。
标注里的 beat 是标的时候的下标，算法改了拍点会变：读的时候按 t 重新对到最近的拍（load_labels 的调用方负责）。
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

from config import BACKEND_DIR
from services import beat_grid

LAB_DIR = Path(os.getenv('BEAT_LAB_DIR') or Path(BACKEND_DIR) / 'instance' / 'beat_lab')
VERSION = 'lab-2'

MARK_KINDS = ('one', 'cut', 'off', 'note')   # 这拍是 1、这里换歌或剪辑、拍点没踩在拍上、备注
STATUSES = (None, 'ok', 'issues')


def enabled() -> bool:
    return (LAB_DIR / 'samples.json').is_file()


def sample_ids() -> list[int]:
    try:
        return [int(i) for i in json.loads((LAB_DIR / 'samples.json').read_text(encoding='utf-8'))['ids']]
    except (OSError, ValueError, KeyError, TypeError):
        return []


def _read(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def load_raw(file_id: int) -> dict | None:
    return _read(LAB_DIR / 'raw' / f'{file_id}.json')


def load_labels(file_id: int) -> dict:
    return _read(LAB_DIR / 'labels' / f'{file_id}.json') or {'status': None, 'note': '', 'marks': []}


def clean_labels(body: dict) -> dict:
    """标注页传来的内容只留认识的字段。"""
    status = body.get('status')
    marks = []
    for m in (body.get('marks') or [])[:1000]:
        if not isinstance(m, dict) or m.get('kind') not in MARK_KINDS:
            continue
        try:
            marks.append({'t': round(float(m['t']), 3), 'beat': int(m['beat']), 'kind': m['kind'],
                          'text': str(m.get('text') or '')[:500]})
        except (KeyError, TypeError, ValueError):
            continue
    marks.sort(key=lambda m: m['t'])
    return {'status': status if status in STATUSES else None, 'note': str(body.get('note') or '')[:4000], 'marks': marks}


def save_labels(file_id: int, labels: dict, user_id: int) -> dict:
    out = {**labels, 'file_id': file_id, 'version': VERSION, 'saved_by': user_id,
           'saved_at': time.strftime('%Y-%m-%dT%H:%M:%S')}
    folder = LAB_DIR / 'labels'
    folder.mkdir(parents=True, exist_ok=True)
    text = json.dumps(out, ensure_ascii=False, indent=1)
    with open(folder / 'history.jsonl', 'a', encoding='utf-8') as f:
        f.write(json.dumps(out, ensure_ascii=False) + '\n')
    tmp = folder / f'{file_id}.json.tmp'
    tmp.write_text(text, encoding='utf-8')
    os.replace(tmp, folder / f'{file_id}.json')
    return out


# ---------------------------------------------------------------- 打拍子


def build(raw: dict) -> dict:
    """原料 → 标注页要的网格：线上同一套算法（beat_grid.analyze），多带每块里两个模型各自的意见。"""
    data = raw['beats']
    allin1 = raw.get('allin1') or {}
    a = beat_grid.analyze(data, allin1)
    return {
        'version': VERSION,
        'bpm': data.get('bpm'),
        'times': a['times'],
        'sections': a['sections'],
        'parts': [b['start'] for b in a['blocks']],
        'blocks': a['blocks'],
        'spliced': a['spliced'],
        'has_allin1': bool(allin1.get('downbeats')),
        'envelope_rate': data.get('envelope_rate'),
        'envelope': data.get('envelope'),
    }
