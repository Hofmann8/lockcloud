# 小节头校正 FC（All-In-One）

beat_this 在有些放克曲子上把小节头放错半个小节（真"1"数成"3""7"）。All-In-One 先把鼓、贝斯、人声分开再判断
小节头，这类曲子上对得多，但它自己的拍点有时整体偏半拍、有的地方不出拍，所以只拿它的小节头给 beat_this 投票纠错。
LockAI 分析时由后端调用（`LOCKAI_ALLIN1_URL`，见 `services/lockai.py`、`services/beat_grid.py` 的 `fix_bars`）。
**独立函数**，不挂 OSS 触发器，不影响 `lockcloud-media`。2026-11 在 3899、3900 上试过：第二首小节头全部落回真"1""5"，第一首不误改。

- 代码：[openmirlab/all-in-one-infer](https://github.com/openmirlab/all-in-one-infer)（[原版](https://github.com/mir-aidj/all-in-one) 的重新打包，纯 PyTorch，不要 NATTEN），模型 `harmonix-all`
- 权重许可 CC-BY-NC-SA 4.0（非商业）
- `POST /analyze {"key": "files/{uuid}.mp4"}`，带 `X-Media-Token`。同步返回结果，同时写 `media/{uuid}/allin1.json`

## 构建和部署

1. 构建、推送（本机，先开 Docker Desktop；要能连 PyPI、download.pytorch.org、GitHub、huggingface.co）：
   ```powershell
   cd D:\日常事务\码农\funkandlove\lockcloud\backend\fc\allin1
   docker build --platform=linux/amd64 --provenance=false -t lockcloud-allin1:v1 .
   $REG = "crpi-erg46jo9l599ryzm.cn-hangzhou.personal.cr.aliyuncs.com/lock-service"
   docker tag lockcloud-allin1:v1 "$REG/lockcloud-allin1:v1"
   docker push "$REG/lockcloud-allin1:v1"
   ```
   构建日志里要有一行 `warmup ok`，说明权重下好了、能跑通。push 报仓库不存在就先在 ACR 控制台建私有仓库 `lockcloud-allin1`。
2. 建函数（FC 3.0，杭州）`lockcloud-allin1-test`：
   - 自定义镜像 `lock-service/lockcloud-allin1:v1`，端口 9000
   - 4 vCPU / 8 GB，磁盘 10 GB，超时 1800 秒，单实例并发 1
   - 环境变量和 `lockcloud-media` 一样：`ALIBABA_CLOUD_ACCESS_KEY_ID`、`ALIBABA_CLOUD_ACCESS_KEY_SECRET`、`MEDIA_CALLBACK_TOKEN`
   - HTTP 触发器，认证方式"无需认证"（函数自己核对 `X-Media-Token`），方法 GET、POST
3. 把 HTTP 触发器的公网地址填进后端 `.env` 的 `LOCKAI_ALLIN1_URL`（见下）。

## 接进后端

后端 `.env` 加 `LOCKAI_ALLIN1_URL=<HTTP 触发器地址>`，重启后端。之后新发起的 LockAI 分析会带上小节头；已经分析过的视频要重新分析才会校正。
