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

视频抽帧(2026-09 起):
  媒体 FC 给每个视频抽了帧 media/{uuid}/frames/{i:05d}.jpg(第 i 张在 i × interval 秒,
  interval / count 在 media_info.frames 里)。这里逐帧算 embedding 写进 video_frame_embeddings
  (file_id, timestamp_ms = i × interval × 1000),给 /api/search 的视频片段用。
  - 进度记在 files.frame_embedding_status(pending / ok / failed / no_frames),不动 embedding_status
  - 以文件为单位:一个视频的帧全部成功才写库(先删这个文件的旧帧行再插),有一帧失败整个视频记 failed,
    重跑:UPDATE files SET frame_embedding_status='pending' WHERE frame_embedding_status='failed'
  - 只挑 media_status='ready' 且 media_info 里有 frames 的视频;回收站里的不跑
  - 帧是 768px 的 jpg,远小于 5MB,不用降档阶梯
  - 只跑 LockAI 分析过的视频(files.lockai_status = 'ready',见 services/lockai.py),分析完成时自动触发,
    命令行跑也只会处理分析过的视频

Usage:
  python scripts/embed_worker.py                 # 默认 16 并发,图片 + 视频抽帧,跑所有 pending
  python scripts/embed_worker.py --kind image    # 只跑图片(只跑视频 --kind video)
  python scripts/embed_worker.py --workers 8     # 调并发(1-16)
  python scripts/embed_worker.py --limit 10      # 只跑前 10 个文件
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

from sqlalchemy import and_, or_, text  # noqa: E402

import database  # noqa: E402
from files.models import File  # noqa: E402
from services.embedding_service import (  # noqa: E402
    EmbeddingAPIError,
    EmbeddingClient,
    EmbeddingError,
)
from services.storage import derived_key, is_file_key, storage  # noqa: E402
from services.formats import OSS_IMAGE  # noqa: E402
from services.media import IMAGE_STYLES, OSS_IMAGE_LIMIT, image_source, media_info, oss_can_process  # noqa: E402


IMAGE_SIZE_LIMIT = 5 * 1024 * 1024  # 阿里云 flash 接口图片 5MB 上限
TARGET_MB_AFTER_TRANSFORM = 4.5  # 经 OSS 压缩后的目标大小(留 0.5MB 安全余量)
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


def fetch_pending(db, limit):
    # 只拉图片;视频留给后续视频 worker(它们的 pending 不会被本 worker 改动)
    # 超过 20 MB 的原图 OSS 图片处理不收,HEIC / RAW 这类 OSS 不切(services/formats.py 的 OSS_IMAGE),
    # 都要等媒体 FC 存好转正的 preview.jpg 才有东西可以拿去算。
    # 刚传完时 FC 还没跑完(media_status 还是 pending),这时先不碰,FC 回调时会再排一轮
    # (routers/media.py 的 media_result_callback);不等的话七档地址全部失败,文件被记成 failed 再也没人管
    oss_format = or_(*(File.s3_key.ilike(f"%.{e}") for e in sorted(OSS_IMAGE)))
    q = (
        db.query(File)
        .filter(File.embedding_status == "pending")
        .filter(File.content_type.ilike("image/%"))
        .filter(or_(and_(File.size <= OSS_IMAGE_LIMIT, oss_format), File.media_status != "pending"))
        .order_by(File.id.asc())
    )
    if limit:
        q = q.limit(limit)
    return q.all()


def classify(f):
    # 不再因 size 跳过:>5MB 走 OSS 实时处理压到 5MB 内(见 build_url_ladder)
    return ("embed", None)


# 超限文件的降档阶梯:从最高质量(只转 JPEG 不动 q)到最激进(q=15)
# worker 顺序尝试,遇到阿里云 size-too-large 错误就降一档;首个成功的即采用
STYLE_LADDER = [
    "embedJpeg",  # 转 jpg,q=90,信息损失最小
    "embedQ85",
    "embedQ70",
    "embedQ55",
    "embedQ40",
    "embedQ25",
    "embedQ15",
]


def build_url_ladder(s3, f):
    """生成阿里云抓图的 URL 列表。
    - 常见格式的小图(<5MB):单 URL,不变换
    - 大图、HEIC / RAW 这类:返回 STYLE_LADDER 顺序的 URL 列表,worker 按序试到第一个被 API 接受为止
    """
    if (not f.size or f.size <= IMAGE_SIZE_LIMIT) and oss_can_process(f):
        return [s3.sign_get(f.s3_key, SIGNED_URL_EXPIRATION)]
    # 超过 20 MB 的原图、HEIC / RAW 这类 OSS 处理不了，用 FC 存的 preview.jpg
    key, _ = image_source(f.s3_key, f.media_info, f.raw_w)
    return [
        s3.sign_get(key, SIGNED_URL_EXPIRATION, process=IMAGE_STYLES[s])
        for s in STYLE_LADDER
    ]


def _looks_like_size_error(api_err):
    """判断 API 错误是否因图片过大。OSS 压完仍超 5MB 时 DashScope 会拒。"""
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


def insert_embedding(db, file_id, vector, model):
    """写入 image_embeddings,幂等。

    幂等的必要性:image_embeddings 用 file_id 当主键。如果上次跑到一半崩了
    (vector 已写但 embedding_status 还是 pending),下次重跑会撞 UNIQUE。
    或者多 worker 并发抢同一行也会撞。直接 DELETE 旧的再 INSERT 新的,
    保证向量永远是这次跑出来的最新结果。
    """
    import json
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        text("DELETE FROM image_embeddings WHERE file_id = :file_id"),
        {"file_id": file_id},
    )
    db.execute(
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


def update_status(db, file_id, status):
    db.execute(
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


def run_in_session(db, limit=None, dry_run=False, workers=DEFAULT_WORKERS, kind="image"):
    """用调用方给的数据库会话跑 worker。kind: image / video / all。
    供 embed_trigger 的自动触发线程复用 —— 避免每次冷启一个进程(默认只跑图片,和以前一样)。
    返回退出码: 0 全成 / 1 部分 failed / 2 启动错(无 API key 等)。
    """
    codes = []
    if kind in ("image", "all"):
        codes.append(run_images(db, limit=limit, dry_run=dry_run, workers=workers))
    if kind in ("video", "all") and 2 not in codes:
        codes.append(run_videos(db, limit=limit, dry_run=dry_run, workers=workers))
    return max(codes) if codes else 0


def run_images(db, limit=None, dry_run=False, workers=DEFAULT_WORKERS):
    """图片:embedding_status='pending' 的图片 → image_embeddings。"""
    try:
        client = EmbeddingClient.from_env()
    except Exception as e:
        log.error("embedding client init failed: %s", e)
        return 2

    s3 = storage
    pending = fetch_pending(db, limit)
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
            update_status(db, f.id, skip_reason)
            counters[skip_reason] = counters.get(skip_reason, 0) + 1
            continue
        try:
            urls = build_url_ladder(s3, f)
        except Exception as e:
            log.error("file=%s sign URL failed: %s", f.id, e)
            update_status(db, f.id, "failed")
            counters["failed"] = counters.get("failed", 0) + 1
            continue
        tasks.append((f.id, urls))

    db.commit()  # 落地所有 skip / sign-failed 标记
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
                update_status(db, file_id, "failed")
                counters["failed"] = counters.get("failed", 0) + 1
            else:
                insert_embedding(db, file_id, vector, client.model)
                update_status(db, file_id, "ok")
                counters["ok"] = counters.get("ok", 0) + 1
                total_tokens += tokens
                if style_idx > 0:
                    # 记录用了哪级降档,便于事后分析尺寸分布
                    style_name = STYLE_LADDER[style_idx] if style_idx < len(STYLE_LADDER) else "?"
                    k = f"used_{style_name}"
                    counters[k] = counters.get(k, 0) + 1

            db.commit()
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


# ---------------------------------------------------------------- 视频抽帧


def fetch_pending_videos(db, limit):
    """抽过帧、帧 embedding 还没做的视频。回收站里的由 ORM 钩子自动排除。"""
    from sqlalchemy import func
    q = (
        db.query(File)
        .filter(File.frame_embedding_status == "pending")
        .filter(File.lockai_status == "ready")   # 只跑 LockAI 分析过的视频
        .filter(File.content_type.ilike("video/%"))
        .filter(File.media_status == "ready")
        .filter(func.json_extract(File.media_info, "$.frames").isnot(None))
        .order_by(File.id.asc())
    )
    if limit:
        q = q.limit(limit)
    return q.all()


def frame_plan(f, step=1):
    """[(帧号, 毫秒)]:第 i 张帧在 i × interval 秒。step=2 隔一张取一张。"""
    frames = media_info(f).get("frames") or {}
    interval = float(frames.get("interval") or 2.0)
    count = int(frames.get("count") or 0)
    return [(i, int(round(i * interval * 1000))) for i in range(0, count, max(1, step))]


def update_frame_status(db, file_id, status):
    db.execute(
        text("UPDATE files SET frame_embedding_status = :s WHERE id = :id"),
        {"s": status, "id": file_id},
    )


def replace_frame_embeddings(db, file_id, rows, model):
    """一个视频的帧向量整体替换:先按主键删旧的(vec0 只能按主键删),再插新的。不 commit。"""
    import json
    old = [r[0] for r in db.execute(
        text("SELECT frame_id FROM video_frame_embeddings WHERE file_id = :fid"), {"fid": file_id}).all()]
    for frame_id in old:
        db.execute(text("DELETE FROM video_frame_embeddings WHERE frame_id = :id"), {"id": frame_id})
    now = datetime.now(timezone.utc).isoformat()
    for ts_ms, vector in rows:
        db.execute(
            text(
                "INSERT INTO video_frame_embeddings"
                " (embedding, model_name, file_id, timestamp_ms, is_keyframe, created_at)"
                " VALUES (:embedding, :model_name, :file_id, :ts, 0, :created_at)"
            ),
            {"embedding": json.dumps(vector), "model_name": model, "file_id": file_id, "ts": ts_ms,
             "created_at": now},
        )


def run_videos(db, limit=None, dry_run=False, workers=DEFAULT_WORKERS):
    """视频:抽帧逐张算 embedding → video_frame_embeddings。以文件为单位,全部成功才写库。"""
    try:
        client = EmbeddingClient.from_env()
    except Exception as e:
        log.error("embedding client init failed: %s", e)
        return 2

    pending = fetch_pending_videos(db, limit)
    log.info("%d pending videos (limit=%s, workers=%d, dry_run=%s)", len(pending), limit, workers, dry_run)
    if not pending:
        return 0
    if dry_run:
        log.info("dry-run: would embed %d frames", sum(len(frame_plan(f)) for f in pending))
        return 0

    counters, total_tokens = {}, 0
    t0 = time.monotonic()
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="embed-frame") as ex:
        for n, f in enumerate(pending, 1):
            plan = frame_plan(f)
            if not plan or not is_file_key(f.s3_key):
                update_frame_status(db, f.id, "no_frames")
                db.commit()
                counters["no_frames"] = counters.get("no_frames", 0) + 1
                continue
            try:
                urls = [storage.sign_get(derived_key(f.s3_key, f"frames/{i:05d}.jpg"), SIGNED_URL_EXPIRATION)
                        for i, _ in plan]
            except Exception as e:
                log.error("file=%s sign frame URLs failed: %s", f.id, e)
                update_frame_status(db, f.id, "failed")
                db.commit()
                counters["failed"] = counters.get("failed", 0) + 1
                continue
            results = list(ex.map(lambda u: call_api_with_outer_retry(client, [u]), urls))
            errors = [r[2] for r in results if r[0] is None]
            if errors:
                log.warning("file=%s FAILED: %d/%d frames, first error: %s", f.id, len(errors), len(plan), errors[0])
                update_frame_status(db, f.id, "failed")
                counters["failed"] = counters.get("failed", 0) + 1
            else:
                replace_frame_embeddings(db, f.id, [(ts, r[0]) for (_, ts), r in zip(plan, results)], client.model)
                update_frame_status(db, f.id, "ok")
                counters["ok"] = counters.get("ok", 0) + 1
                total_tokens += sum(r[1] for r in results)
            db.commit()
            log.info("video %d/%d file=%s frames=%d counters=%s tokens=%d",
                     n, len(pending), f.id, len(plan), counters, total_tokens)

    log.info("=" * 60)
    log.info("videos done in %.1fs: counters=%s tokens=%d est_cost=%s%.4f", time.monotonic() - t0, counters,
             total_tokens, "¥", total_tokens / 1000 * PRICE_PER_KTOKEN)
    return 1 if counters.get("failed", 0) > 0 else 0


def run(limit, dry_run, workers, verbose, kind="all"):
    """CLI 入口:开一个数据库会话调 run_in_session。"""
    setup_logging(verbose)
    with database.session() as db:
        return run_in_session(db, limit=limit, dry_run=dry_run, workers=workers, kind=kind)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--workers", type=int, default=DEFAULT_WORKERS,
                   help=f"并发数 1-16(默认 {DEFAULT_WORKERS})")
    p.add_argument("--kind", choices=("image", "video", "all"), default="all",
                   help="跑图片、视频抽帧,还是都跑(默认 all)")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--verbose", action="store_true")
    args = p.parse_args()
    workers = max(1, min(16, args.workers))
    return run(limit=args.limit, dry_run=args.dry_run, workers=workers, verbose=args.verbose, kind=args.kind)


if __name__ == "__main__":
    sys.exit(main())
