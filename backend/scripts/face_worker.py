"""人脸向量入库 worker —— 跟 embed_worker.py 一一对应,只是后端 API 换成阿里云 FC。

干啥:
  扫 files 表 face_status='pending' 的图片
  → 主线程算 S3 签名 URL
  → 线程池(I/O 并发)POST 给 FC handler /invoke
  → 主线程串行 INSERT faces(每张检测出的脸一行) + UPDATE files.face_status

跟 embed_worker 的差异:
  - status 列: face_status(不是 embedding_status)
  - 后端: HTTP POST 到 FC 而不是 dashscope SDK
  - 每张图可能产出 0 / 1 / N 行 faces(取决于检测出几张脸)
  - status 值: ok / no_face / failed
  - 不需要 STYLE_LADDER —— FC handler 自己去 S3 拉原图,不受 5MB 限制
  - 不需要 token 统计 —— FC 按调用次数计费,前期 100w 次/月免费

状态值:
  pending             — 待处理
  ok                  — FC 返回 ≥1 张脸,向量已写入 faces
  no_face             — FC 返回 0 张脸(图里没人),已视为完成,不会重试
  failed              — FC 调用失败(已重试到上限)
  skipped_unsupported — content_type 不是 image/*

并发模型(同 embed_worker,为 2 核 VPS 设计):
  - I/O bound,默认 16 并发
  - DB 写入只在主线程(as_completed 回收),SQLite 单写无锁竞争
  - signed URL 30 分钟有效期,16 并发跑 3500 张约 5-15 分钟

环境变量(.env 里加):
  FACE_FC_ENDPOINT=https://lockcloud-face-uiygipfrjj.cn-hangzhou.fcapp.run
  FACE_FC_TOKEN=                (可选,Bearer 鉴权;空 = 无鉴权)

Usage:
  python scripts/face_worker.py                 # 跑所有 pending
  python scripts/face_worker.py --limit 5       # 只跑 5 张(冒烟用)
  python scripts/face_worker.py --workers 8     # 调并发(1-16)
  python scripts/face_worker.py --dry-run       # 不调 FC、不写表

退出码: 0 全成 / 1 部分 failed / 2 启动错
"""
import argparse
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests  # noqa: E402
import sqlite_vec  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from files.models import File  # noqa: E402
from services.s3_service import S3Service  # noqa: E402


SIGNED_URL_EXPIRATION = 1800
DEFAULT_WORKERS = 16
OUTER_RETRY = 1  # 外层兜底,FC 偶发 502/503/超时再试一次
FC_TIMEOUT = 60  # 兜底冷启动,热请求一般 1-3 秒
MODEL_NAME = "antelopev2"  # 跟 handler 里写死的一致,sanity check

log = logging.getLogger("face_worker")


def setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    for noisy in ("botocore", "boto3", "urllib3", "s3transfer"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def fetch_pending(limit):
    q = (
        File.query
        .filter(File.face_status == "pending")
        .filter(File.content_type.ilike("image/%"))
        .order_by(File.id.asc())
    )
    if limit:
        q = q.limit(limit)
    return q.all()


def update_status(file_id, status):
    db.session.execute(
        text("UPDATE files SET face_status = :s WHERE id = :id"),
        {"s": status, "id": file_id},
    )


def update_image_dims(file_id, raw_w, raw_h, orientation):
    """把 FC handler 返回的 raw 尺寸 + EXIF orientation 落回 files 表,给详情页 CSS 裁切用。"""
    if not raw_w or not raw_h:
        return
    db.session.execute(
        text(
            "UPDATE files SET raw_w = :rw, raw_h = :rh, orientation = :o WHERE id = :id"
        ),
        {"rw": int(raw_w), "rh": int(raw_h), "o": int(orientation or 1), "id": file_id},
    )


# 临时归属参数 —— 不能照搬 DBSCAN 的 eps=0.45。
# DBSCAN 是 density-reachable 链式连通:同一簇里任意两脸的距离可以远 >0.45,
# 只要它们能通过"近邻链"连起来。实测 InsightFace antelopev2 同人脸成对距离
# 散在 0.4–0.9 之间,单纯卡 dist<0.45 会把大多数同人脸丢掉 → 全 pid=0。
#
# 改成 top-K 投票:取 K 近邻,看哪个 pid>0 出现次数最多。
#   - TIGHT_DISTANCE:最近邻 dist < 这个就直接信它(快通道)
#   - WIDE_DISTANCE :投票时只看 dist < 这个的邻居,过远的 noise 不参与
#   - VOTE_K        :K 近邻数
#   - VOTE_MIN      :至少这么多票才认
TIGHT_DISTANCE = 0.45
WIDE_DISTANCE = 0.95
VOTE_K = 20
VOTE_MIN = 3


def _tentative_assign_for_face(face_id, emb_blob):
    """对单张脸跑一次 KNN,先看最近邻是否足够近(tight 通道),
    否则在 top-K 内做投票。返 chosen_pid(int)或 None。"""
    try:
        knn = db.session.execute(
            text(
                "SELECT face_id, person_id, distance "
                "FROM faces WHERE embedding MATCH :vec AND k = :k "
                "ORDER BY distance"
            ),
            {"vec": emb_blob, "k": VOTE_K},
        ).all()
    except Exception as e:
        log.warning("KNN failed for face=%d: %s", face_id, e)
        return None

    cands = []
    for fid, pid, dist in knn:
        fid, pid, dist = int(fid), int(pid or 0), float(dist)
        if fid == face_id:
            continue
        cands.append((fid, pid, dist))
    if not cands:
        return None

    # 快通道:最近邻就是 pid>0 且距离非常近 → 直接信它
    nf, np_, nd = cands[0]
    if np_ > 0 and nd < TIGHT_DISTANCE:
        return np_

    # 投票:top-K 内 dist<WIDE 的 pid>0 邻居数最多者
    votes = {}
    for _, pid, dist in cands:
        if pid <= 0 or dist >= WIDE_DISTANCE:
            continue
        votes[pid] = votes.get(pid, 0) + 1
    if not votes:
        return None
    best_pid, best_n = max(votes.items(), key=lambda kv: kv[1])
    return best_pid if best_n >= VOTE_MIN else None


def _assign_and_count(face_id, chosen_pid):
    """把脸 UPDATE 到给定 person_id,并把 persons.face_count + 1。"""
    db.session.execute(
        text("UPDATE faces SET person_id = :pid WHERE face_id = :fid"),
        {"pid": chosen_pid, "fid": face_id},
    )
    db.session.execute(
        text("UPDATE persons SET face_count = face_count + 1 WHERE id = :pid"),
        {"pid": chosen_pid},
    )


def insert_faces(file_id, faces, model):
    """faces = handler 返回的 list[{bbox: [x,y,w,h], det_score, embedding}]

    每张脸 INSERT 完会立即跑一次 vec0 KNN 做临时归属。详见 _tentative_assign_for_face。
    临时归属可能错,但 04:00 cron 的 DBSCAN 全量重排会覆盖修正。
    """
    now = datetime.now(timezone.utc).isoformat()

    tentative_assigned = 0
    for f in faces:
        x, y, w, h = f["bbox"]
        emb_blob = sqlite_vec.serialize_float32(f["embedding"])
        db.session.execute(
            text(
                "INSERT INTO faces ("
                "  embedding, model_name, file_id, person_id,"
                "  frame_id, bbox_x, bbox_y, bbox_w, bbox_h,"
                "  confidence_bp, created_at"
                ") VALUES ("
                "  :embedding, :model_name, :file_id, 0,"
                "  NULL, :bbox_x, :bbox_y, :bbox_w, :bbox_h,"
                "  :confidence_bp, :created_at"
                ")"
            ),
            {
                "embedding": emb_blob,
                "model_name": model,
                "file_id": file_id,
                "bbox_x": int(x),
                "bbox_y": int(y),
                "bbox_w": int(w),
                "bbox_h": int(h),
                "confidence_bp": int(round(float(f["det_score"]) * 10000)),
                "created_at": now,
            },
        )
        new_face_id = int(
            db.session.execute(text("SELECT last_insert_rowid()")).scalar()
        )
        chosen_pid = _tentative_assign_for_face(new_face_id, emb_blob)
        if chosen_pid is not None:
            _assign_and_count(new_face_id, chosen_pid)
            tentative_assigned += 1

    if tentative_assigned:
        log.info(
            "file=%d 临时归属:%d/%d 张脸命中现有 cluster",
            file_id, tentative_assigned, len(faces),
        )


def call_fc_with_retry(session, endpoint, headers, url):
    """线程任务:POST 到 FC /invoke,外层重试 OUTER_RETRY 次。
    返回 (faces|None, error_msg|None, fc_infer_ms)。
    """
    last_err = None
    for attempt in range(OUTER_RETRY + 1):
        try:
            resp = session.post(
                f"{endpoint}/invoke",
                headers=headers,
                json={"image_url": url},
                timeout=FC_TIMEOUT,
            )
            if not resp.ok:
                last_err = f"http {resp.status_code}: {resp.text[:300]} (attempt={attempt})"
                continue
            data = resp.json()
            faces = data.get("faces", [])
            # sanity:确认 model 跟我们预期一致(防止 FC 函数被改成别的镜像)
            got_model = data.get("model")
            if got_model and got_model != MODEL_NAME:
                last_err = f"model mismatch: got {got_model}, want {MODEL_NAME}"
                continue
            # sanity:每张脸 embedding 512 维
            for f in faces:
                if len(f.get("embedding", [])) != 512:
                    last_err = f"bad embedding dim: {len(f.get('embedding', []))}"
                    break
            else:
                # raw 尺寸 + EXIF orientation 一并带回,worker 主线程会 UPDATE 到 files 表。
                # 这两个量给详情页"在已加载大图上 CSS 裁切人物 chip"用,见 [[gotcha_bitiful_rect_raw_coord]]。
                raw_size = data.get("raw_size") or [None, None]
                meta = {
                    "raw_w": raw_size[0] if len(raw_size) >= 1 else None,
                    "raw_h": raw_size[1] if len(raw_size) >= 2 else None,
                    "orientation": data.get("orientation") or 1,
                }
                return (faces, None, int(data.get("infer_ms", 0)), meta)
        except requests.RequestException as e:
            last_err = f"{type(e).__name__}: {e} (attempt={attempt})"
            continue
        except Exception as e:
            last_err = f"unexpected {type(e).__name__}: {e} (attempt={attempt})"
            continue
    return (None, last_err, 0, None)


def run_dry(pending):
    log.info("dry-run: would process %d files", len(pending))
    return 0


def run_in_context(limit=None, dry_run=False, workers=DEFAULT_WORKERS):
    """在调用方已 push 的 app context 内跑 worker。
    供 face_trigger(以后做) 复用,避免每次冷启 Flask app。
    """
    endpoint = os.environ.get("FACE_FC_ENDPOINT")
    if not endpoint:
        log.error("FACE_FC_ENDPOINT 环境变量未设;在 backend/.env 里加上 FC URL")
        return 2
    token = os.environ.get("FACE_FC_TOKEN", "").strip()
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    s3 = S3Service()
    pending = fetch_pending(limit)
    total = len(pending)

    log.info(
        "%d pending files (limit=%s, workers=%d, dry_run=%s, endpoint=%s)",
        total, limit, workers, dry_run, endpoint,
    )
    if total == 0:
        return 0
    if dry_run:
        return run_dry(pending)

    # 1) 主线程签 URL,装任务队列
    # 不在这里 mirror 公开桶 —— 公开桶留给后面聚类阶段的"每个 person 代表图"用,
    # 不是每张有脸的图都进 public(那样 ~22GB,违背中转区定位)
    tasks = []  # (file_id, signed_url)
    counters = {}
    for f in pending:
        try:
            url = s3.generate_signed_url(f.s3_key, expiration=SIGNED_URL_EXPIRATION)
        except Exception as e:
            log.error("file=%s sign URL failed: %s", f.id, e)
            update_status(f.id, "failed")
            counters["failed"] = counters.get("failed", 0) + 1
            continue
        tasks.append((f.id, url))
    db.session.commit()
    log.info("sign URLs done: %d to process", len(tasks))

    # 2) 线程池打 FC,主线程 as_completed 写库
    session = requests.Session()
    total_faces = 0
    t0 = time.monotonic()
    done = 0
    last_log = 0

    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="face") as ex:
        future_to_file = {
            ex.submit(call_fc_with_retry, session, endpoint, headers, url): file_id
            for file_id, url in tasks
        }
        for fut in as_completed(future_to_file):
            file_id = future_to_file[fut]
            try:
                faces, err, infer_ms, meta = fut.result()
            except Exception as e:
                log.exception("file=%s future exception: %s", file_id, e)
                faces, err, infer_ms, meta = None, f"future_exc {e}", 0, None

            if faces is None:
                log.warning("file=%s FAILED: %s", file_id, err)
                update_status(file_id, "failed")
                counters["failed"] = counters.get("failed", 0) + 1
            elif len(faces) == 0:
                # FC 即使没检到脸也返了 raw_size + orientation,落库 —— 没人脸的图后续也可能要画 chip
                if meta:
                    update_image_dims(file_id, meta["raw_w"], meta["raw_h"], meta["orientation"])
                update_status(file_id, "no_face")
                counters["no_face"] = counters.get("no_face", 0) + 1
            else:
                insert_faces(file_id, faces, MODEL_NAME)
                if meta:
                    update_image_dims(file_id, meta["raw_w"], meta["raw_h"], meta["orientation"])
                update_status(file_id, "ok")
                counters["ok"] = counters.get("ok", 0) + 1
                total_faces += len(faces)

            db.session.commit()
            done += 1
            if done - last_log >= 50 or done == len(tasks):
                rate = done / max(time.monotonic() - t0, 0.001)
                log.info(
                    "face %d/%d (%.1f/s) counters=%s total_faces=%d",
                    done, len(tasks), rate, counters, total_faces,
                )
                last_log = done

    elapsed = time.monotonic() - t0
    log.info("=" * 60)
    log.info(
        "done in %.1fs: counters=%s total_faces=%d avg=%.2f faces/image",
        elapsed, counters, total_faces,
        total_faces / max(counters.get("ok", 0), 1),
    )

    return 1 if counters.get("failed", 0) > 0 else 0


def run(limit, dry_run, workers, verbose):
    setup_logging(verbose)
    app = create_app()
    with app.app_context():
        return run_in_context(limit=limit, dry_run=dry_run, workers=workers)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--workers", type=int, default=DEFAULT_WORKERS,
                   help=f"并发数(默认 {DEFAULT_WORKERS})。封顶 256;FC 是 HTTP I/O,"
                        f"参考 [[feedback_python_thread_concurrency]],一次性全量批跑用户明确说 128 也行")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--verbose", action="store_true")
    args = p.parse_args()
    workers = max(1, min(256, args.workers))
    return run(limit=args.limit, dry_run=args.dry_run, workers=workers, verbose=args.verbose)


if __name__ == "__main__":
    sys.exit(main())
