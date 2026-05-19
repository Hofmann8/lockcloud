"""
图片 embedding 入库 worker。

干啥:
  扫 files 表 embedding_status='pending' 的图片
  → 主线程算 S3 签名 URL
  → 线程池(I/O 并发)调 dashscope embedding API
  → 主线程串行 INSERT image_embeddings + UPDATE files.embedding_status

并发模型(为 2 核 VPS 设计):
  - I/O bound 任务,GIL 期间 socket 等待会释放,2 核能撑 16 并发(实测 QPS 远低于 16)
  - DB 写入只在主线程(as_completed 回收),SQLite 单写,无锁竞争
  - signed URL 30 分钟有效期,16 并发跑 1634 张约 3-4 分钟,远低于过期

兜底:
  - embedding_service 内层重试网络/429/5xx(4 次)
  - worker 外层再重试 1 次:首次 fail 或 0 向量,重新走一遍
  - 全零向量(API 偶发返回)视为失败,触发外层重试

幂等:
  - status='ok'/'failed'/'skipped_*' 都跳过(WHERE embedding_status='pending')
  - 重试失败:UPDATE files SET embedding_status='pending' WHERE embedding_status='failed'

状态值:
  pending             — 待处理
  ok                  — 成功,vector 已写入 image_embeddings
  failed              — API 失败(已重试到上限)
  skipped_too_large   — 文件 > 5MB,超 flash 接口上限,等预处理方案
  skipped_unsupported — content_type 不是 image/*

Usage:
  python scripts/embed_worker.py                 # 默认 16 并发,跑所有 pending
  python scripts/embed_worker.py --workers 8     # 调并发(1-16)
  python scripts/embed_worker.py --limit 10      # 只跑前 10 张
  python scripts/embed_worker.py --dry-run       # 不调 API、不写表(单线程)
  python scripts/embed_worker.py --verbose       # DEBUG 日志

退出码: 0 全成 / 1 部分 failed / 2 启动错
"""
import argparse
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from files.models import File  # noqa: E402
from services.embedding_service import (  # noqa: E402
    EmbeddingAPIError,
    EmbeddingClient,
    EmbeddingError,
)
from services.s3_service import S3Service  # noqa: E402


IMAGE_SIZE_LIMIT = 5 * 1024 * 1024  # 阿里云 flash 接口图片 5MB 上限
TARGET_MB_AFTER_TRANSFORM = 4.5  # 经缤纷云 q= 压缩后的目标大小(留 0.5MB 安全余量)
SIGNED_URL_EXPIRATION = 1800
PRICE_PER_KTOKEN = 0.00015
DEFAULT_WORKERS = 16
OUTER_RETRY = 1  # 外层兜底重试次数(内层 service 已有 4 次)
ZERO_CHECK_HEAD = 32  # 检查前 N 维是否全 0

log = logging.getLogger("embed_worker")


def setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    # 压住第三方库的 DEBUG 喷射
    for noisy in ("dashscope", "botocore", "boto3", "urllib3", "s3transfer"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def fetch_pending(limit):
    # 只拉图片;视频留给后续视频 worker(它们的 pending 不会被本 worker 改动)
    q = (
        File.query
        .filter(File.embedding_status == "pending")
        .filter(File.content_type.ilike("image/%"))
        .order_by(File.id.asc())
    )
    if limit:
        q = q.limit(limit)
    return q.all()


def classify(f):
    # 不再因 size 跳过:>5MB 走缤纷云实时变换压到 5MB 内(见 build_image_url)
    return ("embed", None)


# 超限文件的降档阶梯:从最高质量(只转 JPEG 不动 q)到最激进(q=15)
# worker 顺序尝试,遇到阿里云 size-too-large 错误就降一档;首个成功的即采用
STYLE_LADDER = [
    "embedJpeg",  # fmt=jpeg (用缤纷云默认 q,信息损失最小)
    "embedQ85",
    "embedQ70",
    "embedQ55",
    "embedQ40",
    "embedQ25",
    "embedQ15",
]


def build_url_ladder(s3, f):
    """生成阿里云抓图的 URL 列表。
    - 小图(<5MB):单 URL,不变换
    - 大图:返回 STYLE_LADDER 顺序的 URL 列表,worker 按序试到第一个被 API 接受为止
    """
    if not f.size or f.size <= IMAGE_SIZE_LIMIT:
        return [s3.generate_signed_url(f.s3_key, expiration=SIGNED_URL_EXPIRATION)]
    return [
        s3.generate_signed_url(f.s3_key, expiration=SIGNED_URL_EXPIRATION, style=s)
        for s in STYLE_LADDER
    ]


def _looks_like_size_error(api_err):
    """判断 API 错误是否因图片过大。缤纷云压完仍超 5MB 时阿里云会拒。"""
    body = (api_err.body or "").lower()
    return any(
        kw in body for kw in (
            "too large", "exceed", "size limit", "size_limit",
            "image size", "5mb", "5 mb",
        )
    )


def is_bad_vector(vector):
    """空 / 头部全 0 视为坏向量,需重试。"""
    if not vector:
        return True
    return all(v == 0 for v in vector[:ZERO_CHECK_HEAD])


def insert_embedding(file_id, vector, model):
    import json
    now = datetime.now(timezone.utc).isoformat()
    db.session.execute(
        text(
            "INSERT INTO image_embeddings (file_id, embedding, model_name, created_at)"
            " VALUES (:file_id, :embedding, :model_name, :created_at)"
        ),
        {
            "file_id": file_id,
            "embedding": json.dumps(vector),
            "model_name": model,
            "created_at": now,
        },
    )


def update_status(file_id, status):
    db.session.execute(
        text("UPDATE files SET embedding_status = :s WHERE id = :id"),
        {"s": status, "id": file_id},
    )


def call_api_with_outer_retry(client, urls):
    """线程任务:按 URL 阶梯试,size 错误降一档,其它错误走 OUTER_RETRY 重试。
    返回 (vector|None, tokens, error_msg|None, style_idx)。
    阶梯走完仍拿不到向量就一律 failed —— 不区分 timeout 还是底档超限,
    reset_embedding_status.py 重置 failed 再跑一遍就行。
    """
    last_err = None
    for style_idx, url in enumerate(urls):
        for attempt in range(OUTER_RETRY + 1):
            try:
                result = client.embed_image_url(url)
                if is_bad_vector(result.vector):
                    last_err = (
                        f"bad vector style_idx={style_idx} attempt={attempt}"
                    )
                    continue
                return (result.vector, result.input_tokens, None, style_idx)
            except EmbeddingAPIError as e:
                last_err = (
                    f"api_err status={e.status_code} code={e.code} "
                    f"msg={e.body[:200]} style_idx={style_idx} attempt={attempt}"
                )
                if _looks_like_size_error(e):
                    break  # 不重试当前 q,直接降一档
                continue
            except EmbeddingError as e:
                last_err = (
                    f"embed_err {e} style_idx={style_idx} attempt={attempt}"
                )
                continue
            except Exception as e:
                last_err = (
                    f"unexpected {type(e).__name__}: {e} "
                    f"style_idx={style_idx} attempt={attempt}"
                )
                continue
    return (None, 0, last_err, -1)


def run_dry(pending):
    """Dry-run: 只分类、统计、打印。不调 API、不写表、不开线程。"""
    counters = {}
    for f in pending:
        action, skip_reason = classify(f)
        key = f"would-{skip_reason}" if action == "skip" else "would-embed"
        counters[key] = counters.get(key, 0) + 1
    log.info("dry-run summary: %s", counters)
    return 0


def run_in_context(limit=None, dry_run=False, workers=DEFAULT_WORKERS):
    """在调用方已 push 的 app context 内跑 worker。
    供 embed_trigger 的自动触发线程复用 —— 避免每次冷启 Flask app。
    返回退出码: 0 全成 / 1 部分 failed / 2 启动错(无 API key 等)。
    """
    try:
        client = EmbeddingClient.from_env()
    except Exception as e:
        log.error("embedding client init failed: %s", e)
        return 2

    s3 = S3Service()
    pending = fetch_pending(limit)
    total = len(pending)

    log.info(
        "%d pending files (limit=%s, workers=%d, dry_run=%s, model=%s)",
        total, limit, workers, dry_run, client.model,
    )
    if total == 0:
        return 0
    if dry_run:
        return run_dry(pending)

    # 1) 主线程跑分类 + 签名 URL,提前刷掉跳过项,留待 embed 的塞进队列
    counters = {}
    tasks = []  # (file_id, urls_ladder)
    for f in pending:
        action, skip_reason = classify(f)
        if action == "skip":
            update_status(f.id, skip_reason)
            counters[skip_reason] = counters.get(skip_reason, 0) + 1
            continue
        try:
            urls = build_url_ladder(s3, f)
        except Exception as e:
            log.error("file=%s sign URL failed: %s", f.id, e)
            update_status(f.id, "failed")
            counters["failed"] = counters.get("failed", 0) + 1
            continue
        tasks.append((f.id, urls))

    db.session.commit()  # 落地所有 skip / sign-failed 标记
    log.info(
        "classification done: %s; %d to embed", counters, len(tasks),
    )

    # 2) 线程池只跑 API 调用,as_completed 在主线程回收并写 DB
    total_tokens = 0
    t0 = time.monotonic()
    done = 0
    last_log = 0

    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="embed") as ex:
        future_to_file = {
            ex.submit(call_api_with_outer_retry, client, urls): file_id
            for file_id, urls in tasks
        }
        # as_completed 在主线程逐个 yield,DB 写入只发生在这里,无线程竞争
        for fut in as_completed(future_to_file):
            file_id = future_to_file[fut]
            try:
                vector, tokens, err, style_idx = fut.result()
            except Exception as e:
                log.exception("file=%s future exception: %s", file_id, e)
                vector, tokens, err, style_idx = None, 0, f"future_exc {e}", -1

            if vector is None:
                log.warning("file=%s FAILED: %s", file_id, err)
                update_status(file_id, "failed")
                counters["failed"] = counters.get("failed", 0) + 1
            else:
                insert_embedding(file_id, vector, client.model)
                update_status(file_id, "ok")
                counters["ok"] = counters.get("ok", 0) + 1
                total_tokens += tokens
                if style_idx > 0:
                    # 记录用了哪级降档,便于事后分析尺寸分布
                    style_name = STYLE_LADDER[style_idx] if style_idx < len(STYLE_LADDER) else "?"
                    k = f"used_{style_name}"
                    counters[k] = counters.get(k, 0) + 1

            db.session.commit()
            done += 1
            if done - last_log >= 50 or done == len(tasks):
                rate = done / max(time.monotonic() - t0, 0.001)
                log.info(
                    "embed %d/%d (%.1f/s) counters=%s tokens=%d",
                    done, len(tasks), rate, counters, total_tokens,
                )
                last_log = done

    elapsed = time.monotonic() - t0
    est_cost = total_tokens / 1000 * PRICE_PER_KTOKEN
    log.info("=" * 60)
    log.info(
        "done in %.1fs: counters=%s tokens=%d est_cost=%s%.4f",
        elapsed, counters, total_tokens, "¥", est_cost,
    )
    return 1 if counters.get("failed", 0) > 0 else 0


def run(limit, dry_run, workers, verbose):
    """CLI 入口:自建 app + push context + 调 run_in_context。"""
    setup_logging(verbose)
    app = create_app()
    with app.app_context():
        return run_in_context(limit=limit, dry_run=dry_run, workers=workers)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--workers", type=int, default=DEFAULT_WORKERS,
                   help=f"并发数 1-16(默认 {DEFAULT_WORKERS})")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--verbose", action="store_true")
    args = p.parse_args()
    workers = max(1, min(16, args.workers))
    return run(limit=args.limit, dry_run=args.dry_run, workers=workers, verbose=args.verbose)


if __name__ == "__main__":
    sys.exit(main())
