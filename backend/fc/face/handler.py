"""LockCloud Face FC handler.

FC 3.0 custom container 模式：容器自带 HTTP server，FC 把 /invoke 转发过来。
本地 docker run 后用 curl localhost:9000/invoke 测试，跟 FC 行为一致。

请求:
  POST /invoke
  Content-Type: application/json
  body: {"image_url": "<S3 signed URL>"}

响应:
  200 {
    "faces": [
      {"bbox": [x, y, w, h], "det_score": 0.87, "embedding": [512 floats, L2=1]},
      ...
    ],
    "image_size": [width, height],
    "infer_ms": 660
  }
  400 {"error": "..."}  参数 / 解码错
  502 {"error": "..."}  下载图失败
  500 {"error": "..."}  推理失败

说明:
  - bbox 用 xywh 整数像素值,跟 backend faces 表的 +bbox_x/y/w/h aux 列对齐
  - embedding 已 L2 归一化,余弦相似度直接点乘
  - 模块级初始化 FACE_APP,容器热复用时只跑一次(冷启动 ~30s,热请求 sub-second)
"""
import io
import os
import time

import cv2
import numpy as np
import requests
from flask import Flask, jsonify, request
from insightface.app import FaceAnalysis
from PIL import Image, ImageOps

INSIGHTFACE_ROOT = os.environ.get("INSIGHTFACE_ROOT", "/opt/models")
PORT = int(os.environ.get("FC_SERVER_PORT", os.environ.get("PORT", "9000")))
FETCH_TIMEOUT = int(os.environ.get("FETCH_TIMEOUT", "30"))
# 升级到 antelopev2:ArcFace R100 backbone + Glint360K 训练集
# (3600 万张人脸,比 buffalo_l 的 MS1MV2 大 6 倍,IJB-C TAR@FAR=1e-4 ~97.7%)
# embedding 维度仍 512,跟 vec0 schema 兼容,faces 表不用动
# 副作用:模型权重比 buffalo_l 大,镜像增长 ~250MB,冷启慢 ~10-15s
MODEL_NAME = "antelopev2"

print(f"[init] loading {MODEL_NAME} from {INSIGHTFACE_ROOT}", flush=True)
t0 = time.monotonic()
FACE_APP = FaceAnalysis(
    name=MODEL_NAME,
    root=INSIGHTFACE_ROOT,
    providers=["CPUExecutionProvider"],
)
FACE_APP.prepare(ctx_id=-1, det_size=(640, 640))
print(f"[init] ready in {time.monotonic() - t0:.2f}s, listening on port {PORT}", flush=True)

app = Flask(__name__)


def exif_to_raw_bbox(x, y, w, h, raw_w, raw_h, orient):
    """把 EXIF-applied 坐标系下的 bbox 反变换回 raw(磁盘字节)坐标系。

    为什么需要:DB 里统一存 raw 字节系 bbox,避免同一张原图在不同显示端
    对 EXIF Orientation 的处理差异污染数据。
    handler 内部为了检测质量必须先 apply EXIF 把图扶正再喂 InsightFace,
    但出库的 bbox 要回到 raw 系。公开桶 ?rect= 默认直接使用 raw 系,
    后端只对少数已确认异常的文件做兼容转换。

    raw_w, raw_h:磁盘上原图尺寸(未 apply EXIF)
    orient:EXIF Orientation 标签值 1-8(getexif().get(274, 1))
    EXIF-applied 尺寸:1-4 维持 (raw_w, raw_h);5-8 互换为 (raw_h, raw_w)
    """
    if orient == 1:
        return (x, y, w, h)
    if orient == 2:                      # mirror H
        return (raw_w - x - w, y, w, h)
    if orient == 3:                      # 180°
        return (raw_w - x - w, raw_h - y - h, w, h)
    if orient == 4:                      # mirror V
        return (x, raw_h - y - h, w, h)
    if orient == 5:                      # transpose (对角翻)
        return (y, x, h, w)
    if orient == 6:                      # 90° CW (常见 iPhone 竖拍)
        return (y, raw_h - x - w, h, w)
    if orient == 7:                      # anti-transpose
        return (raw_w - y - h, raw_h - x - w, h, w)
    if orient == 8:                      # 90° CCW (常见相机竖拍)
        return (raw_w - y - h, x, h, w)
    return (x, y, w, h)


@app.post("/invoke")
def invoke():
    body = request.get_json(force=True, silent=True) or {}
    url = body.get("image_url")
    if not url:
        return jsonify({"error": "missing image_url"}), 400

    # ---- fetch ----
    try:
        resp = requests.get(url, timeout=FETCH_TIMEOUT)
        resp.raise_for_status()
    except Exception as e:
        return jsonify({"error": f"fetch failed: {e}"}), 502

    # 用 PIL 解码:推理需要 EXIF-applied 的图(扶正)否则 SCRFD 检测质量差。
    # 出库 bbox 统一回到 raw(磁盘字节)系;公开桶 ?rect= 默认也用 raw 系。
    # 少数已确认的公开桶裁剪异常由后端 URL 拼接层兼容。
    # 所以:记下 raw 尺寸 + orientation,推理用 EXIF 系,最后 exif_to_raw_bbox 反变换。
    try:
        pil_raw = Image.open(io.BytesIO(resp.content))
        raw_w, raw_h = pil_raw.size
        orient = 1
        try:
            orient = int(pil_raw.getexif().get(274, 1) or 1)
        except Exception:
            pass
        pil_exif = ImageOps.exif_transpose(pil_raw)
        if pil_exif.mode != "RGB":
            pil_exif = pil_exif.convert("RGB")
        img = cv2.cvtColor(np.array(pil_exif), cv2.COLOR_RGB2BGR)
    except Exception as e:
        return jsonify({"error": f"image decode failed: {e}"}), 400

    # ---- inference ----
    try:
        t1 = time.monotonic()
        faces = FACE_APP.get(img)
        infer_ms = int((time.monotonic() - t1) * 1000)
    except Exception as e:
        return jsonify({"error": f"inference failed: {e}"}), 500

    h, w = img.shape[:2]
    out = []
    for f in faces:
        x1, y1, x2, y2 = [int(v) for v in f.bbox]
        # InsightFace 在图像边缘检测的脸,bbox 可能超出图像范围(x1<0 或 y2>h)。
        # 缤纷云 ?rect= 不接受负坐标,clamp 到 [0, w/h]
        x1c = max(0, min(x1, w - 1))
        y1c = max(0, min(y1, h - 1))
        x2c = max(0, min(x2, w))
        y2c = max(0, min(y2, h))
        bw, bh = x2c - x1c, y2c - y1c
        # clamp 后太小的丢掉(< 40px),通常是图像边缘的误检
        if bw < 40 or bh < 40:
            continue
        # 反变换回 raw 坐标系 —— 这是落库 bbox 的最终形式
        rx, ry, rw_b, rh_b = exif_to_raw_bbox(x1c, y1c, bw, bh, raw_w, raw_h, orient)
        out.append({
            "bbox": [rx, ry, rw_b, rh_b],  # xywh in RAW coords
            "det_score": float(f.det_score),
            "embedding": f.normed_embedding.astype("float32").tolist(),
        })

    return jsonify({
        "faces": out,                       # bbox 在 raw 坐标系
        "image_size": [w, h],               # EXIF-applied 尺寸(给检测看的)
        "raw_size": [raw_w, raw_h],         # 磁盘字节尺寸(?rect= 参考的系)
        "orientation": orient,
        "infer_ms": infer_ms,
        "model": MODEL_NAME,
    })


@app.get("/healthz")
def healthz():
    return jsonify({"ok": True, "model": MODEL_NAME, "dim": 512})


if __name__ == "__main__":
    # 单进程单线程:CPU 8C16G 实例一次只算一张图,不要 multi-worker
    # InsightFace 内部 onnxruntime 已经会用满 CPU
    app.run(host="0.0.0.0", port=PORT, threaded=False)
