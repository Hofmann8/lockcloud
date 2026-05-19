"""
DEV 一键灌库脚本:重置 failed -> pending,然后中等并发(默认 32)一把梭。

为什么 32 而不是更高:
  - dashscope SDK 每次调用内部 CPU 活不小(签名 + 768 维向量 marshaling)
  - Python GIL 同时只允许 1 线程执行字节码;256 线程实测 CPU 100%
    都耗在内核 context switch 上,吞吐反而垮掉
  - HTTP 出站 Python 线程池甜点在 32-64,再多基本是费电
  - dashscope 服务端也有租户并发限,客户端开 256 也是排队

  实测:32 并发跑 ~1800 张大约 1-2 分钟,CPU 占用 < 50%。

跑完 0 向量和 API 失败会标 failed,本脚本顺手重置一遍再跑,
默认 2 轮通常一轮就清干净。

Usage:
  python scripts/dev_embed_blast.py                  # 默认 32 并发, 2 轮
  python scripts/dev_embed_blast.py --workers 64     # 上限建议 64
  python scripts/dev_embed_blast.py --rounds 3       # 多重试一轮
  python scripts/dev_embed_blast.py --no-reset       # 不重置 failed,只跑当前 pending
"""
import argparse
import logging
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from scripts.embed_worker import run_in_context  # noqa: E402


def reset_failed():
    """failed -> pending,返回重置行数。"""
    result = db.session.execute(
        text("UPDATE files SET embedding_status='pending' "
             "WHERE embedding_status='failed'")
    )
    db.session.commit()
    return result.rowcount


def count_status():
    rows = db.session.execute(
        text("SELECT embedding_status, COUNT(*) FROM files "
             "WHERE content_type LIKE 'image/%' "
             "GROUP BY embedding_status ORDER BY embedding_status")
    ).all()
    return dict(rows)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--workers", type=int, default=32,
                   help="并发数(默认 32,实测甜点;再高 GIL 切上下文反而慢)")
    p.add_argument("--rounds", type=int, default=2,
                   help="reset+run 总轮数(默认 2:首轮跑全部 pending,"
                        "次轮把首轮 fail 的再试一次)")
    p.add_argument("--no-reset", action="store_true",
                   help="不重置 failed,只跑当前 pending(N 轮一样有效)")
    args = p.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    for noisy in ("dashscope", "botocore", "boto3", "urllib3", "s3transfer"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    log = logging.getLogger("dev_embed_blast")

    app = create_app()
    with app.app_context():
        log.info("起点状态: %s", count_status())

        t0 = time.monotonic()
        for round_no in range(1, args.rounds + 1):
            log.info("=" * 70)
            log.info("ROUND %d/%d", round_no, args.rounds)
            log.info("=" * 70)

            if not args.no_reset:
                n_reset = reset_failed()
                log.info("reset failed->pending: %d 行", n_reset)
                if n_reset == 0 and round_no > 1:
                    log.info("本轮无可重置,提前结束")
                    break

            rc = run_in_context(limit=None, dry_run=False, workers=args.workers)
            log.info("round %d 退出码: %d", round_no, rc)
            log.info("当前状态: %s", count_status())

        log.info("=" * 70)
        log.info("全部完成,耗时 %.1fs", time.monotonic() - t0)
        log.info("最终状态: %s", count_status())
        return 0


if __name__ == "__main__":
    sys.exit(main())
