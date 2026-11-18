"""
重建搜索用的参照向量 services/search_centroid.json（services/search_gate.py 读它）。

什么时候跑：换了 embedding 模型或维度之后。平时不用跑。
会做什么：每个参照词调一次文字向量接口（共 60 次，花费不到一分钱），把平均向量写进
services/search_centroid.json（覆盖原文件）。不碰数据库。

Usage:
  python scripts/build_search_centroid.py
  python scripts/build_search_centroid.py --cache 已有向量.json   # {词: 向量}，有的词不再调接口，新算的会写回去
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402,F401  读 .env
from services.embedding_service import EmbeddingClient  # noqa: E402
from services.search_gate import PATH  # noqa: E402

# 参照词：成员平时会搜的各种东西，库里有的没有的都要有。求的是"一般搜索词"的平均，不是某一类词的平均。
WORDS = [
    '蛋糕', '合影', '舞台表演', '镜子前练舞', '聚餐吃饭', '奖杯', '海边', '篮球场', '大象', '飞机',
    '雪山', '猫', '游泳池', '方向盘', '滑雪', '生日', '烟花', '小狗', '自行车', '帽子',
    '钢琴', '火锅', '毕业', '红色衣服', '地下车库', 'battle', '人', '一群人', '自拍', '女生',
    '男生', '笑', '跳舞', '街舞', '练习室', '室外', '夜晚', '白天', '食物', '饮料',
    '手机', '电脑', '衣服', '鞋子', '海报', '文字', '屏幕', '灯光', '观众', '比赛',
    '颁奖', '教室', '操场', '树', '天空', '建筑', '车', '桌子', '椅子', '花',
]


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--cache', help='{词: 向量} 的 json，里面有的词不再调接口')
    args = p.parse_args()

    client = EmbeddingClient.from_env()
    cache = {}
    if args.cache and os.path.exists(args.cache):
        with open(args.cache, encoding='utf-8') as f:
            cache = json.load(f)
    vectors = []
    for i, word in enumerate(WORDS, 1):
        if word not in cache:
            cache[word] = [float(x) for x in client.embed_text(word).vector]
            if args.cache:
                with open(args.cache, 'w', encoding='utf-8') as f:
                    json.dump(cache, f, ensure_ascii=False)
            print(f'[{i}/{len(WORDS)}] {word}', flush=True)
        vectors.append(cache[word])

    dims = {len(v) for v in vectors}
    if dims != {client.dimension}:
        sys.exit(f'[错误] 向量维度 {sorted(dims)} 和当前配置 {client.dimension} 不一致（缓存是别的模型算的？）')
    centroid = [round(sum(col) / len(vectors), 7) for col in zip(*vectors)]
    with open(PATH, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'model': client.model, 'dimension': client.dimension, 'words': WORDS, 'vector': centroid},
                  f, ensure_ascii=False)
        f.write('\n')
    print(f'写好 {PATH}（{client.model}，{client.dimension} 维，{len(WORDS)} 个词，'
          f'|c| = {sum(x * x for x in centroid) ** 0.5:.3f}）')


if __name__ == '__main__':
    main()
