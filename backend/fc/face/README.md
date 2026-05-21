# LockCloud Face FC

阿里云 FC 3.0 custom container,提供 `POST /invoke` 接收 `{image_url}`,返回检测到的人脸 + 512-dim ArcFace embedding。

## 文件
- `Dockerfile` 镜像构建定义
- `handler.py` 业务入口(Flask app)
- `requirements.txt` Python 依赖
- `prepare.ps1` 把 `../../models/insightface` 复制到本目录(docker context 不能跨目录引用)
- `insightface/` 模型权重,**gitignore**,prepare 后生成

## 本地 build + run

```powershell
# 1) 准备模型(只需做一次,或权重更新后重新做)
cd backend\fc\face
.\prepare.ps1

# 2) build 镜像
# 必须加 --provenance=false 关闭 Docker 24+ buildx 的供应链证明 attestation,
# 否则镜像 manifest 含 platform=unknown/unknown 层,阿里云 FC 部署会卡 Pending
# (报错 "invalid image, platform of image is unknown/unknown")
# 第一次会装 ~500MB Python 依赖,耐心等;之后改 handler.py 只重建最后一层
docker build --platform=linux/amd64 --provenance=false -t lockcloud-face:latest .

# 3) 跑容器,映射 9000 端口
docker run --rm -p 9000:9000 lockcloud-face:latest

# 看日志输出 [init] ready in xx.xx 秒,就 ready 了
```

## 本地测试

另开一个 PowerShell:

```powershell
# 健康检查
curl http://localhost:9000/healthz

# 业务调用(URL 用 backend smoke 里那个签名 URL,或重新签一个)
$body = @{ image_url = "<S3 签名 URL>" } | ConvertTo-Json
curl -X POST http://localhost:9000/invoke `
     -H "Content-Type: application/json" `
     -d $body
```

应当返回:
```json
{
  "faces": [
    {"bbox": [x, y, w, h], "det_score": 0.87, "embedding": [...512 floats...]},
    ...
  ],
  "image_size": [width, height],
  "infer_ms": 660,
  "model": "buffalo_l"
}
```

## 接下来(阶段 3)
- ACR(阿里云容器镜像服务,个人版免费)推镜像
- FC 控制台建 Custom Container 函数,挂 HTTP 触发器
- 拿到 endpoint URL 写回 backend 的 `.env`,worker 调起来
