# LockCloud 媒体 FC

文件传进 `lock-cloud` 桶的 `files/` 后由 OSS 触发，做上传后的预处理：

处理哪些格式看 `handler.py` 开头的扩展名集合，它是后端格式表 `backend/services/formats.py` 的副本
（`tests/test_formats.py` 保证两边一致）。加格式先改格式表，再改这里，再重新构建镜像。

- **图片**：原始尺寸、EXIF 方向、拍摄时间、thumbhash、Live Photo 标识（`live_id`，Apple MakerNote 的 ContentIdentifier）。
  缩略图不预生成，OSS 图片处理按需现算。
  OSS 图片处理只收 20 MB 以内的原图，更大的另存一张 `preview.jpg`（长边 6144，保持原始朝向、带 EXIF 方向），
  `media.json` 里记 `"preview": {"width", "height"}`，后端的缩略图、大图预览、裁脸、embedding 都改用它（坐标按比例缩）。
  HEIC / HEIF（pillow-heif）、AVIF（Pillow 自带）、TIFF、相机 RAW（rawpy）不管多大都另存一张 **转正的** `preview.jpg`，
  这时 `width` / `height` 是转正后的、`orientation` 是 1。HEIF 的旋转解码时已经做了，EXIF 方向不再用。
- **音频**两步：`transcode` 转成 `audio.m4a`（AAC 192k）、波形（`waveform`，120 个 0–100）、有内嵌专辑封面的抽成 `poster.jpg`；
  `beats` 同视频。
- iPhone 的 Live Photo 视频从 QuickTime 元数据读 `live_id`（`com.apple.quicktime.content.identifier`），后端和照片配对。
- **视频**分四步，默认全跑，拍摄时间每次都读：

  | 步骤 | 产物 | 用途 |
  |---|---|---|
  | `transcode` | `hls/`（短边 ≥1080 出 1080p + 720p，否则只出 720p 且不放大）、`poster.jpg`、thumbhash | 播放、封面 |
  | `sprite` | `sprite/0.jpg …`：每 `interval` 秒一张小图（长边 160），10×10 拼一张 | 拖进度条预览 |
  | `frames` | `frames/00000.jpg …`：每 2 秒一帧（长边 768），第 i 张在 i × interval 秒 | 视频片段搜索、视频里找人 |
  | `beats` | `beats.json`：拍点、bpm、八拍分段、起音包络 | 八拍标注、并排对比自动对齐 |

  iPhone 的 HDR（HLG / PQ）色调映射成 SDR；竖拍视频的旋转由 ffmpeg 自动处理；帧率超过 60 的降到 60。
  `transcode` 失败整体记 `failed`；其余步骤失败只记进 `errors`，整体仍是 `ready`。

产物都写在 `media/{uuid}/` 下（不在触发前缀里，不会触发自己）。`media.json` 最后写，写完回调后端
`POST /api/files/internal/media-result`。回调没送到也不要紧：后端确认上传时、每天 03:00 的清理任务都会去读 `media.json`；
文件列表、文件详情、播放器信息遇到上传超过 30 秒还在处理中的文件，也会顺手去读（同一个文件 30 秒内只读一次，见 `services/media.py` 的 `catch_up`）。
本机开发时回调打到线上，靠的就是这个。

`media.json`（v2）示例：

```json
{"status": "ready", "kind": "video", "version": 2, "width": 720, "height": 1280, "duration": 61.766,
 "hdr": false, "audio": true, "taken_at": "2025-10-20T14:25:26+00:00", "thumbhash": "...",
 "renditions": [720], "poster": true,
 "sprite": {"count": 62, "sheets": 1, "cols": 10, "width": 90, "height": 160, "interval": 1.0},
 "frames": {"count": 31, "interval": 2.0, "width": 432, "height": 768},
 "beats": {"bpm": 115.04, "count": 119},
 "key": "files/{uuid}.mp4", "elapsed": 12.5}
```

- `taken_at`：带时区就带（iPhone、EXIF 有 OffsetTime 的），不带就是拍摄地本地时间；读不到是空串。
  微信转发过的视频 `creation_time` 是转发时间，不可全信。
- 第 i 张预览小图在第 `i // 100` 张大图的列 `i % 10`、行 `(i % 100) // 10`。
- `beats` 为 `null` 表示没音轨。

`beats.json`：`{"bpm": 114.0, "times": [13.29, 13.81, ...], "sections": [[0, 0], [48, 49], [87, 90]], "envelope_rate": 43.0664, "envelope": "..."}`

- 拍点来自 beat_this 神经网络（ISMIR 2024，final0 权重导成 ONNX），只在有音乐的地方出拍；速度折进 75–150 BPM。
- `sections` 是 `[这段第一拍在 times 里的下标, 这段第一个"1"的下标]`，段内每 8 拍一个"1"。换歌、音乐停了、
  剪辑过的音乐在接口处出现两拍三拍的小节，都会另起一段。
- 小节位置（1/3/5/7 在哪）是模型给的，比较准；"1"和"5"是看哪组小节头前后频谱变化大猜的，不一定对，
  前端让用户点一下改（只改那一段）。

## 后端调用的任务（HTTP 触发器）

后端经函数的 **HTTP 触发器** 异步调用（请求头 `X-Fc-Invocation-Type: Async`），都要带
`X-Media-Token: <MEDIA_CALLBACK_TOKEN>`，不对返回 401。OSS 触发的 `/invoke` 不变、不要令牌。

| 路径 | body | 做什么 |
|---|---|---|
| `POST /jobs/process` | `{"key": "files/{uuid}.mp4", "steps": ["sprite", "beats"]}` | 同 `/invoke` 的手动重跑（管理页的"重跑"），`steps` 可省 |
| `POST /jobs/zip` | `{"id": "d_{32 位十六进制}", "items": [{"key": "files/...", "name": "活动/显示名.mp4"}], "out": "media/_downloads/{id}.zip"}` | 打包下载 |

打包：逐个从桶里（内网）流式读进本地的不压缩 zip（`ZIP_STORED`，单个超过 4 GB 自动 zip64），写完用分片上传
（64 MB 一片）传到 `out`。开始时回调一次 `running`，结束回调 `ready`（带 zip 大小）或 `failed`（带原因），地址是
`MEDIA_CALLBACK_URL` 同目录的 `/api/files/internal/job-result`（可以用 `JOB_CALLBACK_URL` 单独指定）。
桶里找不到的文件跳过，全都找不到算失败。失败也返回 200：结果已经回调了，不让 FC 重试。
后端限制每次最多 500 个文件、合计 8 GB，本地磁盘要 10 GB（zip 落盘后再传）。`media/_downloads/` 靠桶的生命周期规则 1 天后删。

## 文件

- `handler.py`：入口（Flask，`POST /invoke`、`POST /jobs/process`、`POST /jobs/zip`、`GET /healthz`）
- `beats.py`：节拍检测，onnxruntime 跑 beat_this，其余只用 numpy（不用 librosa / torch，冷启动快、镜像小）
- `export_beat_model.py`：把 beat_this 权重导成 `beat_this.onnx`（不进 git，build 前跑一次）
- `thumbhash.py`：ThumbHash 编码，结果和前端 npm `thumbhash` 逐字节一致
- `Dockerfile`：python 3.10 slim + 静态 ffmpeg 7.1（带 libx264、zimg）

## 构建

```powershell
cd backend\fc\media
# 第一次 build（或者没有 beat_this.onnx）时先导出节拍模型，要装了 beat_this + torch 的环境
E:\conda\envs\music_analysis\python.exe export_beat_model.py
# --provenance=false 必须加，不然 FC 部署卡在 Pending（platform unknown/unknown）
docker build --platform=linux/amd64 --provenance=false -t lockcloud-media:latest .
```

## 本地试

```powershell
docker run --rm -p 9000:9000 `
  -e ALIBABA_CLOUD_ACCESS_KEY_ID=... -e ALIBABA_CLOUD_ACCESS_KEY_SECRET=... `
  -e OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com `
  lockcloud-media:latest

# 另开一个窗口，对桶里已有的文件重跑一遍
curl -X POST http://localhost:9000/invoke -H "Content-Type: application/json" `
     -d '{"key": "files/<uuid>.mp4"}'
```

本地没有内网，要把 `OSS_ENDPOINT` 换成外网地址（会产生流出流量费）。

## 部署（FC 3.0，杭州）

1. 推镜像到 ACR 个人版（和人脸 FC 同一个命名空间）。
2. 建函数：
   - 运行环境：自定义镜像，端口 9000，启动命令用镜像默认
   - 规格：4 vCPU / 8 GB，**磁盘 10 GB**（默认 512 MB 放不下视频）
   - 超时：7200 秒
   - 单实例并发：1（转码吃满 CPU）
   - 类型：事件函数（OSS 事件投递到 `POST /invoke`）
   - 凭据：用函数专用 RAM 用户的 AccessKey，写在环境变量里，函数角色留空。代码先读请求头里角色发的临时凭据，
     没有才读环境变量。那个用户的策略见 `lockcloud/DEPLOY.md` 第一段：`files/` 只读，`media/` 可读写删。
3. 环境变量：

   | 变量 | 值 |
   |---|---|
   | `ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 函数专用 RAM 用户的钥匙 |
   | `MEDIA_CALLBACK_URL` | `https://cloud.funk-and.love/api/files/internal/media-result` |
   | `MEDIA_CALLBACK_TOKEN` | 和后端 `.env` 里同一个值（也是 `/jobs/*` 的鉴权令牌） |
   | `JOB_CALLBACK_URL` | 可选，默认是 `MEDIA_CALLBACK_URL` 同目录的 `job-result` |

   `OSS_BUCKET`、`OSS_REGION`、`OSS_ENDPOINT` 默认就是 `lock-cloud`、杭州、内网，不用配。
4. 触发器：OSS 触发器，桶 `lock-cloud`，前缀 `files/`，后缀留空，事件选
   `oss:ObjectCreated:PutObject`、`oss:ObjectCreated:PostObject`、
   `oss:ObjectCreated:CompleteMultipartUpload`、`oss:ObjectCreated:CopyObject`。
5. 异步调用配置：最大重试 2 次。OSS 或网络出错时函数返回 500，FC 会自动重试；
   文件本身坏了（解不了码）记成 `failed`，不重试。
6. HTTP 触发器（打包下载、管理页重跑用）：认证方式选"无需认证"（靠 `X-Media-Token` 鉴权），方法 POST，
   把触发器的公网地址（`https://lockcloud-media-xxxx.cn-hangzhou.fcapp.run`）填进后端 `.env` 的 `MEDIA_FC_ENDPOINT`。
   后端带 `X-Fc-Invocation-Type: Async`，走上面第 5 步的异步调用配置。

## 费用参考

4 vCPU + 8 GB ≈ 5.2 CU/秒。`veryfast` 预设下 1080p 源转两档大约 1 倍速，
3 分钟的视频约 180 秒 × 5.2 CU × 0.00011 元 ≈ 0.1 元。图片每张 1 秒以内。

## 重跑和补跑

- 全部重跑：`POST /invoke {"key": "files/<uuid>.mp4"}`（控制台“测试函数”也行）。会先清掉旧产物再上传。
- 只补某几步：`{"key": "...", "steps": ["sprite", "frames", "beats"]}`。结果合并进已有的 `media.json`；
  已有 HLS 时直接拉最低一档来抽帧、取音轨，原片只 ffprobe 读个文件头，不下载。60 秒的视频 2.5 秒。
  原来没有成功的 `media.json` 时照全跑处理。
- 本机调：`aliyun --profile lock fc POST /2023-03-30/functions/lockcloud-media/invocations --body '{...}'`
  （Git Bash 里先 `export MSYS_NO_PATHCONV=1`）。

## 已部署

函数 `lockcloud-media`（杭州），镜像 `lock-service/lockcloud-media:v5`（2026-11-18），OSS 触发器 `oss-files`，异步最多重试 2 次。
没开日志（SLS），出问题先看桶里的 `media.json` 的 `error` / `errors`。
