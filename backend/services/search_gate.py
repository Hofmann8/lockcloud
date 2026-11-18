"""搜索的相关度：把"不管搜什么都会有的那部分相似度"减掉，再定一条线。

文字向量和图片向量的余弦相似度整体很低（真命中也只有 0.1–0.2），而且每张图对任何文字都有自己的底分，
视频帧尤其高。直接拿原始相似度定不出"相关 / 不相关"：库里根本没有的东西，排在前面的帧分数也比别的词的真命中高。

做法：拿一批通用搜索词的文字向量求平均 c（`scripts/build_search_centroid.py` 生成 `search_centroid.json`），
搜索时用 q - c 去找。图片向量 x 是单位向量，所以

    x·(q - c) = x·q - x·c = (1 + |q - c|² - d²) / 2        d 是 x 到 q - c 的 L2 距离

也就是"比一般搜索词多像多少"。一次 KNN 同时给出排序和这个分数，照片和视频帧用同一条线 FLOOR。

FLOOR 是在 2026-11 的库上看图定的（蛋糕的照片到 0.050 为止都是真蛋糕，往下开始是别的；库里没有的大象、钢琴、
游泳池一张都过不了）。参照向量是按模型算的：模型或维度和现在用的不一样时不做这一步，退回原来的"取最像的前几个"。
"""
import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple, Optional

log = logging.getLogger(__name__)

PATH = Path(__file__).with_name('search_centroid.json')
FLOOR = float(os.environ.get('SEARCH_FLOOR') or 0.05)


class Probe(NamedTuple):
    """拿去做 KNN 的向量。floor 是 None 表示没有参照向量，不卡相关度。"""
    vector: list
    norm2: float
    floor: Optional[float]

    def score(self, distance: float) -> float:
        return (1.0 + self.norm2 - float(distance) ** 2) / 2


@lru_cache(maxsize=1)
def _centroid() -> Optional[dict]:
    try:
        data = json.loads(PATH.read_text(encoding='utf-8'))
        return {'model': str(data['model']), 'vector': [float(x) for x in data['vector']]}
    except FileNotFoundError:
        log.warning(f'search centroid missing: {PATH.name}; results are not filtered by relevance')
    except Exception as e:  # noqa: BLE001
        log.error(f'search centroid unreadable: {e}; results are not filtered by relevance')
    return None


@lru_cache(maxsize=8)
def _usable(model: Optional[str], dim: int) -> bool:
    """参照向量能不能配这个模型用。不能用时只在第一次打一条日志。"""
    c = _centroid()
    if c is None:
        return False
    if c['model'] != model or len(c['vector']) != dim:
        log.warning(f"search centroid is for {c['model']} ({len(c['vector'])}d), current model is {model} ({dim}d); "
                    'run scripts/build_search_centroid.py. Results are not filtered by relevance')
        return False
    return True


def probe(vector, model: Optional[str]) -> Probe:
    vector = [float(x) for x in vector]
    if not _usable(model, len(vector)):
        return Probe(vector, 1.0, None)
    centred = [a - b for a, b in zip(vector, _centroid()['vector'])]
    return Probe(centred, sum(x * x for x in centred), FLOOR)
