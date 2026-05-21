# LockCloud Face FC image
# 目标:阿里云 FC 3.0 custom container,CPU 8C16G 实例
# 镜像大小:~850MB-1GB(antelopev2 权重 ~570MB + python + onnxruntime)
FROM python:3.10-slim

# - libgomp1: onnxruntime / insightface 运行期依赖
# - g++:     insightface 0.7.3 source dist 里有个 cython mesh_core 扩展
#            (face3d 形变模型用,我们其实跑不到),但 setup.py 强行编译,缺 g++ 直接挂
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
        g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先装依赖,利用 docker layer cache(改代码不重新装)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 模型权重内置:build 前 prepare.ps1/sh 会把 ../../models/insightface 复制到本目录
# 容器里走 INSIGHTFACE_ROOT=/opt/models,handler.py 读这个环境变量
COPY insightface /opt/models
ENV INSIGHTFACE_ROOT=/opt/models

# 业务代码放最后,改代码只重建这一层
COPY handler.py .

# FC 3.0 custom container 期望容器监听 $FC_SERVER_PORT(默认 9000)
# 健康检查 GET /healthz,业务 POST /invoke
ENV PORT=9000
EXPOSE 9000

CMD ["python", "-u", "handler.py"]
