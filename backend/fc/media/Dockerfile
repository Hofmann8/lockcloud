# LockCloud 媒体 FC 镜像
# 目标：阿里云 FC 3.0 custom container，杭州
# 镜像大小：~1GB（python slim + 静态 ffmpeg + numpy + onnxruntime + 节拍模型 83MB + pillow-heif + rawpy）
# 节拍模型 beat_this.onnx 不进 git，build 前先跑一次 export_beat_model.py（见 README）
#
# ffmpeg 用 mwader/static-ffmpeg 的静态版：带 libx264 和 zimg（HDR 色调映射要用 zscale）
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

# crcmod 没有预编译包，slim 镜像里没有 gcc 会静默装成纯 Python 版，
# oss2 给几 GB 的视频算 CRC64 会慢到拖垮转码。所以在带 gcc 的完整镜像里先编好 wheel
FROM python:3.10 AS wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir -w /wheels -r requirements.txt

FROM python:3.10-slim

COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/

WORKDIR /app

COPY requirements.txt .
COPY --from=wheels /wheels /wheels
# 解码库缺了不会报错、只会让那种格式处理失败，所以构建时就检查：HEIC、RAW、AVIF 都要能解
RUN pip install --no-cache-dir --no-index --find-links /wheels -r requirements.txt \
    && python -c "import crcmod._crcfunext" \
    && python -c "import pillow_heif, rawpy; from PIL import features; assert features.check('avif'), 'Pillow 没带 AVIF'"

COPY beat_this.onnx ./
COPY thumbhash.py beats.py handler.py ./

ENV PORT=9000
EXPOSE 9000

CMD ["python", "-u", "handler.py"]
