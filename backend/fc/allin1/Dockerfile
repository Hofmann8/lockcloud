# LockCloud 节拍结构试验 FC（All-In-One），独立函数，不影响 lockcloud-media
# 目标：阿里云 FC 3.0 custom container，杭州。镜像约 2–3 GB（CPU 版 PyTorch + 权重）
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM python:3.10-slim

COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/

# git：装 GitHub 上的包；build-essential：madmom 的 Cython 扩展要编译；libsndfile1：soundfile
RUN apt-get update \
    && apt-get install -y --no-install-recommends git build-essential libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# 镜像自带的 pip 太旧，认不了 PyTorch 源上的包名写法，先升级。普通包走阿里云 PyPI 镜像（国内快）
ARG PYPI=https://mirrors.aliyun.com/pypi/simple
RUN pip install --no-cache-dir -U pip -i $PYPI

# 先装 CPU 版 PyTorch，不然会拉 CUDA 版（几个 GB）
RUN pip install --no-cache-dir "torch==2.14.1+cpu" \
    --index-url https://download.pytorch.org/whl/cpu --extra-index-url $PYPI

RUN pip install --no-cache-dir -i $PYPI oss2==2.19.1 flask==3.0.3 soundfile \
    "all-in-one-infer @ git+https://github.com/openmirlab/all-in-one-infer.git"

# 权重下载到固定位置，build 时就下好（FC 运行时不连外网）
ENV TORCH_HOME=/opt/torch XDG_CACHE_HOME=/opt/cache HF_HOME=/opt/hf

WORKDIR /app
COPY warmup.py ./
RUN python warmup.py

COPY handler.py ./

ENV PORT=9000
EXPOSE 9000

CMD ["python", "-u", "handler.py"]
