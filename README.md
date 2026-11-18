# LockCloud

浙江大学 DFM Locking 舞队 Funk & Love 的影像档案：把训练、比赛、团建的照片和视频按活动收好，能按人、按画面内容找到，视频带练舞用的节拍尺、慢放、镜像和并排对比。

线上地址：`https://cloud.funk-and.love`

## 组成

```
浏览器（Next.js）
   │  登录令牌                    │ 直传 / 签名下载
   ▼                              ▼
后端 FastAPI ───────────────► 阿里云 OSS lock-cloud（私有，杭州）
   │  SQLite + sqlite-vec              │ 新文件触发
   │                                   ▼
   ├─► LockAuth（登录、头像）       媒体 FC（转码、预览图、抽帧、节拍、打包）
   ├─► DashScope（图文向量）           │ 处理完回调后端
   └─► 人脸 FC（InsightFace）  ◄───────┘
```

服务器只做调度和查询。转码、人脸识别、节拍检测、打包下载都在阿里云函数计算里跑，向量模型用 DashScope 的接口，数据（包括向量）存在服务器本地的 SQLite 里。

| 目录 | 内容 |
|---|---|
| `backend/` | 后端接口（FastAPI、SQLAlchemy 2.0、SQLite + sqlite-vec） |
| `backend/fc/` | 两个函数计算镜像：`media/`（上传后的媒体处理和打包）、`face/`（人脸识别） |
| `lockcloud-frontend/` | 网页前端（Next.js 16、React 19、Tailwind v4） |
| `deploy.py`、`cutover.sh` | 打包脚本、从旧版切换到新版的一次性脚本 |

手机 App（Flutter）是单独的项目，在上一级的 `LockCloud-app/`，不在这个仓库里。后端保留了它和旧版 App 在用的接口。

## 文档

| 文件 | 讲什么 |
|---|---|
| [CONTRACT.md](./CONTRACT.md) | 接口契约：字段、错误码、行为约定。改接口先改这里和测试 |
| [FRONTEND_PLAN.md](./FRONTEND_PLAN.md) | 前端的设计方案：品牌、页面、播放器、组件清单 |
| [DEPLOY.md](./DEPLOY.md) | 上线手册：媒体 FC 部署、迁移、切换、回滚、待办 |
| [backend/README.md](./backend/README.md) | 后端结构、存储规则、测试、开发约定 |
| [backend/fc/media/README.md](./backend/fc/media/README.md) | 媒体 FC：产物、构建、部署 |
| [lockcloud-frontend/README.md](./lockcloud-frontend/README.md) | 前端结构和开发约定 |

## 本地开发

后端（Python 用 conda 的 `lockcloud` 环境，Python 3.10）：

```bash
conda activate lockcloud
cd backend
pip install -r requirements.txt
cp .env.example .env        # 按文件里的说明填
python app.py               # http://localhost:5000，开发环境 /docs 是接口文档
```

启动时会自动补表补列、起定时任务和后台队列。本地 `.env` 如果填的是线上的 OSS 密钥，这些后台任务读写的就是线上的桶，开发时可以设 `LOCKCLOUD_SCHEDULER_DISABLED=1` 关掉定时任务。

前端：

```bash
cd lockcloud-frontend
npm install
npm run dev                 # 默认连 http://localhost:5000
```

本地登录：后端 `.env` 里设 `DEV_LOGIN_ENABLED=true`，打开前端的 `/auth/dev-login`。这个开关只在本地用，线上不能开。

本机的库落后于线上时：在服务器上拿一份快照拷到本机，用 `backend/scripts/sync_local_db.py` 同步（先备份本机库，旧结构的快照会自动转成新结构；用法写在文件开头）。

检查：

```bash
cd backend && pytest                                   # 契约测试，不连任何外部服务
cd lockcloud-frontend && npx tsc --noEmit && npx eslint .
```

## 维护者

Hofmann，Funk & Love
