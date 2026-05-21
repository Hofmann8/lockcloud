"""把 faces 表里的脸聚类成 persons,写回 person_id + 填 persons 表。

默认算法:DBSCAN on cosine distance。
  - 两张脸 cosine 相似度 > THRESHOLD 才可能连边
  - min_samples 控制一个人至少在全库出现几次才归成 person
  - label=-1 是噪声/出现次数不足,faces.person_id 保持 0

single-linkage 仍保留作调参对照:
  - 边 = 两张脸 cosine 相似度 > THRESHOLD
  - 连通分量 = 同一个 person
  - 缺点:single-linkage 有 chain effect(A 似 B、B 似 C,A 不太似 C 也归一起)

为啥不用 K-means / HDBSCAN:
  - K-means 要预设 K
  - HDBSCAN 启发式参数多,小数据集 (~20k) 反而不稳

Cover face 选择:面积 × confidence 最大的那张
  - 面积大 → 公开桶动态 crop URL 出来不糊
  - confidence 高 → 不是误检的鬼脸
  - basis points confidence_bp 直接相乘 OK,score 比较用不到归一

复杂度:
  - N=19841 时 N×N 距离矩阵 = 1.5GB 太大,用 sklearn radius_neighbors_graph
    + scipy connected_components,只存阈值上的稀疏边
  - 实测 2 核 VPS 上 < 60s

Usage:
  python scripts/cluster_faces.py                    # 跑全量,阈值 0.45
  python scripts/cluster_faces.py --threshold 0.5    # 严一点(person 多 + 碎)
  python scripts/cluster_faces.py --threshold 0.4    # 松一点(person 少 + 串)
  python scripts/cluster_faces.py --dry-run          # 只看分布,不写库
  python scripts/cluster_faces.py --reset            # 先把现有 person_id 全清回 0 再聚

出库:
  - persons 表:每个 cluster 一行 (face_count, cover_face_id, created_at, updated_at)
  - faces.person_id:聚到簇的脸更新成对应 person.id,noise 保持 0

退出码:0 成功 / 2 启动错
"""
import argparse
import logging
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np  # noqa: E402
import sqlite_vec  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402


DEFAULT_THRESHOLD = 0.55  # cosine similarity 下限;低于此值不算同人。
                          # antelopev2(R100 + Glint360K)实测 0.55 给出 189 个干净簇;
                          # 老默认 0.45 太松,DBSCAN chain effect 会把大半人挤进一个簇。
                          # 改之前用 buffalo_l 时 0.45 还合理,换模型后这里必须跟着调。

# 入口质量过滤 —— 低 confidence / 小 bbox 的脸 embedding 不稳定,
# 不参与聚类(留 person_id=0,前端归"未识别")。
# 这俩门槛是为了避免"垃圾脸"成为 single-linkage 的中转节点把不同人串成巨型 chain。
DEFAULT_MIN_CONFIDENCE_BP = 7000   # det_score >= 0.70
DEFAULT_MIN_BBOX_SIDE = 60         # 短边 >= 60 px(ArcFace 112×112 输入,60px 原图 = upsample 不到 2x)

log = logging.getLogger("cluster_faces")


def _update_face_person_ids(assignments):
    """Row-by-row UPDATE for sqlite-vec vec0 tables.

    sqlite-vec 0.1.x 的 vec0 虚表不能执行多行 UPDATE,例如
    `WHERE face_id IN (...)` 或无 WHERE 的全表 UPDATE 会报
    "UPDATE on partition key columns are not supported yet."。
    executemany 发送的是单行 `face_id = ?` UPDATE,可正常写回。
    """
    if not assignments:
        return 0
    stmt = text(
        "UPDATE faces SET person_id = :person_id WHERE face_id = :face_id"
    )
    db.session.execute(stmt, assignments)
    return len(assignments)


def setup_logging(verbose):
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def load_faces(min_conf_bp, min_bbox_side):
    """返回 (face_ids, embeddings, areas, confs, n_filtered_out)。
    只载入"质量达标"的脸(参与聚类的)。被过滤掉的脸留 person_id=0 不动。

    person_id 哨兵约定:
       0 = 待聚类(默认 / 上次 DBSCAN noise)
      -1 = 被 CLIP gate 判定为非脸(gate_faces_by_clip.py),不参与聚类
      >0 = persons.id
    这里 SQL 过滤掉 -1。
    """
    rows = db.session.execute(
        text(
            "SELECT face_id, embedding, bbox_w, bbox_h, confidence_bp "
            "FROM faces WHERE person_id != -1 ORDER BY face_id"
        )
    ).all()
    if not rows:
        return None
    total = len(rows)
    face_ids_list, emb_list, areas_list, confs_list = [], [], [], []
    skipped = 0
    for r in rows:
        bw, bh, conf = int(r[2]), int(r[3]), int(r[4])
        if conf < min_conf_bp or min(bw, bh) < min_bbox_side:
            skipped += 1
            continue
        face_ids_list.append(int(r[0]))
        emb_list.append(np.frombuffer(r[1], dtype=np.float32, count=512))
        areas_list.append(bw * bh)
        confs_list.append(conf)
    n = len(face_ids_list)
    log.info("loaded %d faces (%d skipped by quality: conf<%d bp 或 min_side<%dpx)",
             n, skipped, min_conf_bp, min_bbox_side)
    if n == 0:
        return None
    face_ids = np.array(face_ids_list, dtype=np.int64)
    embeddings = np.stack(emb_list).astype(np.float32)
    areas = np.array(areas_list, dtype=np.int64)
    confs = np.array(confs_list, dtype=np.int64)
    return face_ids, embeddings, areas, confs, skipped


def _normalize(embeddings):
    norms = np.linalg.norm(embeddings, axis=1)
    if not np.allclose(norms, 1.0, atol=1e-3):
        log.warning("embeddings 没归一,均值范数=%.4f,强制归一", norms.mean())
        embeddings = embeddings / norms[:, None]
    return embeddings


def cluster_single_linkage(embeddings, threshold):
    """sklearn radius_neighbors + scipy connected_components(single-linkage 等价)

    极快但脆 —— 一条假阳性边就把两组连起来。仅在数据很干净时用。
    """
    from sklearn.neighbors import NearestNeighbors
    from scipy.sparse.csgraph import connected_components

    embeddings = _normalize(embeddings)
    radius = 1.0 - threshold
    log.info("[single-linkage] building NN graph (N=%d, radius=%.3f i.e. cos_sim > %.3f)",
             len(embeddings), radius, threshold)
    nn = NearestNeighbors(metric="cosine", radius=radius, algorithm="brute", n_jobs=-1)
    nn.fit(embeddings)
    adj = nn.radius_neighbors_graph(embeddings, mode="connectivity")
    log.info("graph built: %d edges (incl. self-loops)", adj.nnz)

    n_clusters, labels = connected_components(adj, directed=False)
    log.info("connected components: %d clusters", n_clusters)
    return labels


def cluster_dbscan(embeddings, threshold, min_samples):
    """sklearn DBSCAN(cosine 距离)。

    比 single-linkage 鲁棒:要求每个核心点必须有 min_samples 个邻居,
    噪声/偶发误连进不了核心,变 label=-1。
    我们把 -1 当作"未识别",前端按 person_id=0 处理。
    """
    from sklearn.cluster import DBSCAN

    embeddings = _normalize(embeddings)
    eps = 1.0 - threshold
    log.info("[dbscan] N=%d eps=%.3f (cos_sim > %.3f) min_samples=%d",
             len(embeddings), eps, threshold, min_samples)
    db = DBSCAN(eps=eps, min_samples=min_samples, metric="cosine",
                algorithm="brute", n_jobs=-1)
    labels = db.fit_predict(embeddings)
    n_noise = int((labels == -1).sum())
    n_clusters = int(labels.max() + 1) if labels.max() >= 0 else 0
    log.info("DBSCAN: %d clusters + %d noise points", n_clusters, n_noise)
    return labels


def pick_cover(face_ids, areas, confs, member_idx):
    """member_idx: np.array of indices within a cluster
    返回 (cover_face_id, score) ;score = area * conf_bp / 10000
    """
    sub_score = areas[member_idx].astype(np.float64) * confs[member_idx] / 10000.0
    best = member_idx[sub_score.argmax()]
    return int(face_ids[best]), float(sub_score.max())


def summarize(labels, face_ids, areas, confs):
    n_noise = int((labels == -1).sum())
    valid_mask = labels >= 0
    valid_labels = labels[valid_mask]
    if len(valid_labels) == 0:
        log.info("没有任何 cluster(全是 noise),阈值太严或 min_samples 太高")
        return
    sizes = np.bincount(valid_labels)
    log.info("cluster size 分布: max=%d  p95=%d  median=%d  singletons=%d  total=%d  noise=%d",
             sizes.max(), int(np.percentile(sizes, 95)), int(np.median(sizes)),
             int((sizes == 1).sum()), len(sizes), n_noise)
    # 列出最大的 10 个
    top = np.argsort(sizes)[::-1][:10]
    log.info("top 10 clusters:")
    for rank, label in enumerate(top, 1):
        member_idx = np.where(labels == label)[0]
        cover_face_id, score = pick_cover(face_ids, areas, confs, member_idx)
        log.info("  #%d  label=%d  size=%d  cover_face_id=%d  score=%.1f",
                 rank, label, sizes[label], cover_face_id, score)


def reset_person_ids():
    log.warning("--reset:清空所有 face.person_id 并删 persons 表内容")
    rows = db.session.execute(text("SELECT face_id FROM faces")).all()
    n = _update_face_person_ids([
        {"person_id": 0, "face_id": int(r[0])}
        for r in rows
    ])
    db.session.execute(text("DELETE FROM persons"))
    db.session.commit()
    log.info("reset done: %d faces set person_id=0, persons cleared", n)


def write_clusters(labels, face_ids, areas, confs):
    """聚类结果落库 —— **现在 persons 表退化成纯 cluster 状态,身份信息在 real_people**。

    所以这里逻辑回归"简单的 INSERT":
      - 每个 cluster 一行新 persons(face_count + cover_face_id)
      - faces.person_id 回写到新 cluster id
      - DBSCAN noise → person_id=0

    name/pin 都不在 persons 表里了,**不需要 inherit、不需要 protection、不需要孤儿清理**。
    身份通过 reconcile_real_people() 在写完之后单独 link:
      - 每个 real_people 行有 anchor(file_id + bbox)
      - 用 IoU 找出 anchor 对应的新 face → 它的新 cluster id → 写 persons.real_person_id

    保持调用方契约:返回 None,内部 commit。reconcile 在 run_clustering 里跟着调一次。
    """
    now = datetime.now(timezone.utc).isoformat()

    members = defaultdict(list)
    member_idxs = defaultdict(list)
    noise_face_ids = []
    for i, lab in enumerate(labels):
        lab_i = int(lab)
        if lab_i < 0:
            noise_face_ids.append(int(face_ids[i]))
            continue
        members[lab_i].append(int(face_ids[i]))
        member_idxs[lab_i].append(i)

    n_assigned = sum(len(v) for v in members.values())
    log.info("writing %d persons rows + reassigning %d clustered + %d noise faces",
             len(members), n_assigned, len(noise_face_ids))

    # 先 DELETE 旧 persons(reset 后已经空,日常重跑会清掉上次的)。
    # 这一刀让 persons 永远只反映最新一次聚类的状态。
    db.session.execute(text("DELETE FROM persons"))

    person_id_by_label = {}
    for label, mem_face_ids in members.items():
        idxs = np.array(member_idxs[label], dtype=np.int64)
        cover_face_id, _ = pick_cover(face_ids, areas, confs, idxs)
        res = db.session.execute(
            text(
                "INSERT INTO persons (face_count, cover_face_id, "
                "                     created_at, updated_at) "
                "VALUES (:fc, :cover, :ts, :ts)"
            ),
            {"fc": len(mem_face_ids), "cover": cover_face_id, "ts": now},
        )
        person_id_by_label[label] = int(res.lastrowid)

    # 回写 faces.person_id(cluster 成员 + noise→0)
    assignments = []
    for label, mem_face_ids in members.items():
        pid = person_id_by_label[label]
        assignments.extend(
            {"person_id": pid, "face_id": int(fid)} for fid in mem_face_ids
        )
    for fid in noise_face_ids:
        assignments.append({"person_id": 0, "face_id": fid})
    _update_face_person_ids(assignments)

    db.session.commit()
    log.info("clusters written")


def _iou(a, b):
    """两个 bbox (x,y,w,h) 的 IoU。"""
    ax1, ay1, aw, ah = a
    bx1, by1, bw, bh = b
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx2, by2 = bx1 + bw, by1 + bh
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter == 0:
        return 0.0
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def reconcile_real_people(iou_threshold=0.5):
    """write_clusters 之后把 real_people.anchor → 新 cluster 链接补回来。

    流程:
      1. 拉所有 real_people 的 anchor (file_id + bbox)
      2. 对每个 anchor,SELECT 该 file_id 下所有新 face 的 bbox + person_id
      3. 找 IoU 最大的那张 face,如果 > 阈值,把它的 person_id 视作 winner cluster
      4. UPDATE persons.real_person_id = real_people.id WHERE id = winner_cluster

    冲突:多个 real_people 的 anchor 落到同一个 winner cluster → 票数(IoU)大的赢,
    其他 real_people 留着 persons.real_person_id=NULL 表示这次聚类没找到家。

    安全:全用 SELECT/UPDATE,不动 faces 表。
    """
    rows = db.session.execute(
        text(
            "SELECT id, anchor_file_id, anchor_bbox_x, anchor_bbox_y, "
            "       anchor_bbox_w, anchor_bbox_h "
            "FROM real_people WHERE anchor_file_id IS NOT NULL"
        )
    ).all()
    if not rows:
        log.info("reconcile: real_people 表无 anchor,跳过")
        return

    log.info("reconcile: 处理 %d 个 real_people anchor", len(rows))

    # 候选 (iou, real_id, winner_cluster_pid)
    candidates = []
    miss = 0
    for r in rows:
        real_id = int(r[0])
        file_id = int(r[1])
        anchor_bbox = (int(r[2]), int(r[3]), int(r[4]), int(r[5]))

        face_rows = db.session.execute(
            text(
                "SELECT person_id, bbox_x, bbox_y, bbox_w, bbox_h "
                "FROM faces WHERE file_id = :fid AND person_id > 0"
            ),
            {"fid": file_id},
        ).all()

        best_iou = 0.0
        best_pid = None
        for fr in face_rows:
            pid = int(fr[0])
            bbox = (int(fr[1]), int(fr[2]), int(fr[3]), int(fr[4]))
            iou = _iou(anchor_bbox, bbox)
            if iou > best_iou:
                best_iou = iou
                best_pid = pid

        if best_pid and best_iou >= iou_threshold:
            candidates.append((best_iou, real_id, best_pid))
        else:
            miss += 1
            log.warning(
                "reconcile: real_people.id=%d anchor file=%d 没匹配上任何 face "
                "(best_iou=%.2f),real_person_id 留空",
                real_id, file_id, best_iou,
            )

    # 贪心:IoU 大的先,每个 cluster 只能被一个 real_people 占
    candidates.sort(key=lambda x: (-x[0], x[1], x[2]))
    used_pids = set()
    linked = 0
    for iou, real_id, pid in candidates:
        if pid in used_pids:
            log.warning(
                "reconcile: cluster %d 被多个 real_people 抢,real_people.id=%d "
                "(iou=%.2f) 让位,留空",
                pid, real_id, iou,
            )
            continue
        used_pids.add(pid)
        db.session.execute(
            text("UPDATE persons SET real_person_id = :rid WHERE id = :pid"),
            {"rid": real_id, "pid": pid},
        )
        linked += 1
    db.session.commit()
    log.info("reconcile: %d 个 real_people 成功链接 cluster, %d 个失败",
             linked, miss + (len(candidates) - linked))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD,
                   help=f"cosine 相似度阈值,默认 {DEFAULT_THRESHOLD}")
    p.add_argument("--algo", choices=["dbscan", "single"], default="dbscan",
                   help="算法:dbscan(默认,鲁棒) / single(连通分量,快但脆)")
    p.add_argument("--min-samples", type=int, default=3,
                   help="DBSCAN min_samples,默认 3(核心点需要 ≥3 个邻居)")
    p.add_argument("--min-conf-bp", type=int, default=DEFAULT_MIN_CONFIDENCE_BP,
                   help=f"入口过滤:confidence_bp 下限,默认 {DEFAULT_MIN_CONFIDENCE_BP}(det_score 0.70)")
    p.add_argument("--min-bbox-side", type=int, default=DEFAULT_MIN_BBOX_SIDE,
                   help=f"入口过滤:bbox 短边 px 下限,默认 {DEFAULT_MIN_BBOX_SIDE}")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--reset", action="store_true",
                   help="先清空现有 person_id 和 persons 再聚")
    p.add_argument("--verbose", action="store_true")
    args = p.parse_args()
    setup_logging(args.verbose)

    if not (0.0 < args.threshold < 1.0):
        log.error("threshold 必须在 (0,1) 之间")
        return 2

    app = create_app()
    with app.app_context():
        if args.reset and not args.dry_run:
            reset_person_ids()

        loaded = load_faces(args.min_conf_bp, args.min_bbox_side)
        if loaded is None:
            log.info("faces 表空或全被质量过滤掉了")
            return 0
        face_ids, embeddings, areas, confs, _skipped = loaded

        if args.algo == "dbscan":
            labels = cluster_dbscan(embeddings, args.threshold, args.min_samples)
        else:
            labels = cluster_single_linkage(embeddings, args.threshold)

        summarize(labels, face_ids, areas, confs)

        if args.dry_run:
            log.info("--dry-run,不写库")
            return 0

        write_clusters(labels, face_ids, areas, confs)
        # 写完 cluster 立刻把 real_people 链接补上,身份不会丢
        reconcile_real_people()
        # 自动 mirror / prune,见 run_clustering 里同步说明
        try:
            from scripts.mirror_cover_files import run_in_context as _mirror
            _mirror()
        except Exception:
            log.exception("post-cluster mirror_cover 失败(非致命)")

    return 0


def run_clustering(threshold=DEFAULT_THRESHOLD, algo="dbscan", min_samples=3,
                   min_conf_bp=DEFAULT_MIN_CONFIDENCE_BP,
                   min_bbox_side=DEFAULT_MIN_BBOX_SIDE,
                   reset=False, dry_run=False):
    """供 Flask CLI / scheduler 调用的纯函数入口。假定已经在 app context 里。
    返 (n_clusters, n_noise) 或 None(数据空)。
    """
    if reset and not dry_run:
        reset_person_ids()
    loaded = load_faces(min_conf_bp, min_bbox_side)
    if loaded is None:
        log.info("faces 表空或全被质量过滤掉了")
        return None
    face_ids, embeddings, areas, confs, _ = loaded
    if algo == "dbscan":
        labels = cluster_dbscan(embeddings, threshold, min_samples)
    else:
        labels = cluster_single_linkage(embeddings, threshold)
    summarize(labels, face_ids, areas, confs)
    if dry_run:
        log.info("--dry-run,不写库")
        return None
    write_clusters(labels, face_ids, areas, confs)
    # 写完 cluster 立刻把 real_people 链接补上,身份不会丢
    reconcile_real_people()
    # cluster 改了 cover_face_id → 自动 mirror 新 cover + prune 旧 cover,
    # 否则前端缩略图会拿不到从没 mirror 的文件;cron 04:00 跑也会带上这步
    try:
        from scripts.mirror_cover_files import run_in_context as _mirror
        _mirror()
    except Exception:
        log.exception("post-cluster mirror_cover 失败(非致命,下次 cluster 还会再试)")
    n_clusters = int(labels.max() + 1) if (labels >= 0).any() else 0
    n_noise = int((labels == -1).sum())
    return n_clusters, n_noise


def register_commands(app):
    """注册 `flask cluster-faces` CLI。给 scheduler 调用,也能手动跑。"""
    import click
    from flask.cli import with_appcontext

    @click.command("cluster-faces")
    @click.option("--threshold", type=float, default=DEFAULT_THRESHOLD)
    @click.option("--algo", type=click.Choice(["dbscan", "single"]), default="dbscan")
    @click.option("--min-samples", type=int, default=3)
    @click.option("--min-conf-bp", type=int, default=DEFAULT_MIN_CONFIDENCE_BP)
    @click.option("--min-bbox-side", type=int, default=DEFAULT_MIN_BBOX_SIDE)
    @click.option("--reset", is_flag=True)
    @click.option("--dry-run", is_flag=True)
    @click.option("--verbose", is_flag=True)
    @with_appcontext
    def cluster_faces_cli(threshold, algo, min_samples, min_conf_bp, min_bbox_side,
                          reset, dry_run, verbose):
        """DBSCAN 重整 person 簇 —— scheduler 凌晨 4 点自动跑,也可手动调"""
        setup_logging(verbose)
        run_clustering(
            threshold=threshold, algo=algo, min_samples=min_samples,
            min_conf_bp=min_conf_bp, min_bbox_side=min_bbox_side,
            reset=reset, dry_run=dry_run,
        )

    app.cli.add_command(cluster_faces_cli)


if __name__ == "__main__":
    sys.exit(main())
