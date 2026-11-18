"""节拍标注试验：把样本视频的原料取回本地（instance/beat_lab/raw/{id}.json），标注页 /lab/beats 用。

每个视频取两样：
  beats    媒体 FC 早就算好的 beats.json（beat_this 的拍点和小节位置），从桶里读
  allin1   All-In-One 的结果（小节头）。桶里有（media/{uuid}/allin1.json，以前跑过）就直接读；
           没有就调 All-In-One 函数现算（LOCKAI_ALLIN1_URL），一个 2 分半的视频约 60–80 秒，函数并发是 1，所以一个一个来

不写数据库。调函数时函数自己会往桶里写一份 allin1.json（和 LockAI 分析时一样）。

    conda activate lockcloud
    cd backend
    python scripts/beat_lab_prepare.py --no-fc      # 只读桶里已有的，不调函数（几秒）
    python scripts/beat_lab_prepare.py              # 缺 All-In-One 结果的调函数补上（15 个视频约 15–20 分钟）
    python scripts/beat_lab_prepare.py --ids 87 14  # 换一批样本（会改写 samples.json 的名单，原料和标注都不动）

已经取全的跳过，断了重跑接着来。完整日志在 instance/beat_lab/prepare.log。
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests  # noqa: E402
from tqdm import tqdm  # noqa: E402

import database  # noqa: E402
from config import settings  # noqa: E402
from files.models import File  # noqa: E402
from services import beat_lab, media  # noqa: E402
from services.lockai import ALLIN1_TIMEOUT, ALLIN1_URL  # noqa: E402
from services.storage import derived_key, is_file_key, storage  # noqa: E402

# 练舞、排练、演出，音乐各不相同，速度 86–148 BPM；87、3900 是已知小节位置出过错的
DEFAULT_IDS = [87, 3900, 14, 281, 17, 277, 2662, 3389, 3382, 2653, 1052, 3801, 2571, 3905, 2665]

log = logging.getLogger('beat_lab')


def allin1_from_bucket(key: str) -> dict | None:
    try:
        text = storage.get_text(derived_key(key, 'allin1.json'))
        return json.loads(text) if text else None
    except Exception as e:  # noqa: BLE001
        log.warning(f'读 allin1.json 失败 {key}: {type(e).__name__}: {e}')
        return None


def allin1_from_fc(key: str) -> dict:
    r = requests.post(f'{ALLIN1_URL}/analyze', json={'key': key},
                      headers={'X-Media-Token': settings.media_callback_token or ''}, timeout=ALLIN1_TIMEOUT)
    r.raise_for_status()
    return r.json()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', type=int, nargs='*', help='样本的文件 id；给了就改写名单')
    ap.add_argument('--no-fc', action='store_true', help='不调 All-In-One 函数，只读桶里已有的')
    args = ap.parse_args()

    lab = beat_lab.LAB_DIR
    (lab / 'raw').mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                        handlers=[logging.FileHandler(lab / 'prepare.log', encoding='utf-8')])
    logging.getLogger('oss2').setLevel(logging.WARNING)   # 桶里没有 allin1.json 时它会把 404 整段记下来
    names = lab / 'samples.json'
    if args.ids or not names.is_file():
        names.write_text(json.dumps({'ids': args.ids or DEFAULT_IDS}), encoding='utf-8')
    ids = beat_lab.sample_ids()
    if not args.no_fc and not ALLIN1_URL:
        print('没配 LOCKAI_ALLIN1_URL，按 --no-fc 跑')
        args.no_fc = True

    database.import_models()
    db = database.session()
    done = missing = 0
    try:
        bar = tqdm(ids, unit='个')
        for i in bar:
            file = db.get(File, i)
            if not file or not is_file_key(file.s3_key):
                log.warning(f'{i} 不存在或不是桶里的文件，跳过')
                continue
            name = media.display_name(file)
            bar.set_description(f'{i} {name[:16]}')
            path = lab / 'raw' / f'{i}.json'
            raw = beat_lab.load_raw(i) or {}
            if not (raw.get('beats') or {}).get('times'):
                raw['beats'] = media.load_beats(file)
            raw['file'] = {'id': i, 'name': name, 'key': file.s3_key, 'duration': media.media_info(file).get('duration')}
            if not raw.get('beats'):
                log.warning(f'{i} {name} 没有节拍，跳过')
                continue
            if not (raw.get('allin1') or {}).get('downbeats'):
                raw['allin1'] = allin1_from_bucket(file.s3_key)
                if raw['allin1']:
                    log.info(f'{i} {name} All-In-One 用桶里已有的')
                elif not args.no_fc:
                    t0 = time.monotonic()
                    try:
                        raw['allin1'] = allin1_from_fc(file.s3_key)
                        log.info(f'{i} {name} All-In-One {time.monotonic() - t0:.0f}s '
                                 f'{len(raw["allin1"].get("downbeats") or [])} 个小节头')
                    except Exception as e:  # noqa: BLE001
                        log.error(f'{i} {name} All-In-One 失败（{time.monotonic() - t0:.0f}s）：{type(e).__name__}: {e}')
            tmp = path.with_suffix('.json.tmp')
            tmp.write_text(json.dumps(raw, ensure_ascii=False), encoding='utf-8')
            os.replace(tmp, path)
            done += 1
            missing += not (raw.get('allin1') or {}).get('downbeats')
    finally:
        db.close()
    print(f'取回 {done}/{len(ids)} 个，其中 {missing} 个还没有 All-In-One 的结果。日志：{lab / "prepare.log"}')


if __name__ == '__main__':
    main()
