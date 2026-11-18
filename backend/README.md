# LockCloud Backend

浙江大学 DFM Locking 舞队私有云存储服务 - 后端 API

## 技术栈

- **FastAPI** - Python Web 框架（uvicorn 跑 ASGI，生产由 gunicorn + uvicorn worker 管进程）
- **SQLite + sqlite-vec** - 数据库和向量检索
- **SQLAlchemy 2.0** - ORM
- **JWT (PyJWT)** - 身份认证（登录走 LockAuth）
- **oss2** - 阿里云 OSS 对象存储
- **APScheduler** - 进程内定时任务

## 项目结构

```
backend/
├── app.py                 # FastAPI 应用：中间件、错误处理、启动时迁库和起后台任务
├── asgi.py               # gunicorn / uvicorn 入口（asgi:app）
├── wsgi.py               # 兼容旧启动命令 wsgi:app，转到 asgi
├── config.py             # 环境配置（settings）
├── database.py           # 引擎、会话、分页、补表补列
├── deps.py               # 依赖：登录身份、管理员、请求体、查询参数
├── errors.py             # 统一的 JSON 错误格式
├── middleware.py         # 安全头、CORS、限流、兜底 500
├── ratelimit.py          # 进程内限流
├── security.py           # JWT 签发和校验
├── exceptions.py         # 自定义异常
├── requirements.txt      # Python 依赖
├── routers/              # 路由：auth、files、media、people、logs、admin、tags、file_requests，
│                         #   2026-09 新增 trash、activities、search、compare、comments、downloads
├── auth/models.py        # 用户模型
├── files/                # 文件、标签、申请模型
├── logs/                 # 操作日志模型和查询
├── services/             # 外部服务和业务逻辑
│   ├── storage.py    # OSS 读写和签名，桶里的目录规则
│   ├── media.py      # 缩略图 / 播放地址、HLS 改写、媒体 FC 结果
│   ├── file_cleanup.py # 回收站：软删除、30 天后彻底删除时连带清理
│   ├── fc_jobs.py    # 调媒体 FC 的 HTTP 触发器（打包下载、重跑）
│   ├── align.py      # 并排对比：起音包络互相关
│   ├── embed_trigger.py / face_trigger.py # 新文件自动排队算 embedding、人脸
│   └── scheduler.py  # 每日任务：清理上传、清回收站、备份、人脸聚类
├── scripts/           # 命令行脚本（worker、聚类、备份、重置）
├── fc/                # 阿里云函数计算
│   ├── face/         # 人脸识别
│   └── media/        # 上传后预处理（HLS、封面、预览图、抽帧、节拍）+ 打包下载
└── migrations/        # 数据库迁移脚本
```

## 快速开始

### 1. 环境要求

- Python 3.10（conda 的 `lockcloud` 环境）
- SQLite（Python 自带，向量检索靠 `sqlite-vec` 这个 pip 包，不用另装数据库）
- 阿里云 OSS（杭州）：`lock-cloud` 桶

### 2. 安装依赖

```bash
conda activate lockcloud
pip install -r requirements.txt
```

### 3. 配置环境变量

复制示例文件并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下关键参数：

```bash
# 运行环境（APP_ENV 或 FLASK_ENV；production 关掉报错详情和 /docs）
FLASK_ENV=development
SECRET_KEY=your-secret-key-here

# 数据库：相对路径的 SQLite 会放进 instance/
DATABASE_URL=sqlite:///lockcloud.db

# 登录令牌的密钥，和 LockAuth 用同一个
JWT_SECRET_KEY=your-jwt-secret-key
SSO_AUTH_API_URL=https://auth.funk-and.love
SSO_AUTH_FRONTEND_URL=https://auth.funk-and.love
LOCKAUTH_SERVICE_KEY=               # 向 LockAuth 要头像用，不配就显示名字首字

# 对象存储（完整说明见 .env.example）
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_BUCKET=lock-cloud
OSS_INTERNAL_ENDPOINT=              # 本地开发留空，线上填杭州内网 endpoint
MEDIA_CALLBACK_TOKEN=your-media-callback-token
MEDIA_FC_ENDPOINT=                  # 媒体 FC 的 HTTP 触发器地址（打包下载、管理页重跑）
LOCKAI_MONTHLY_QUOTA=3              # LockAI 分析：每人每月发起几次（管理员不限），另有 LOCKAI_MODEL、LOCKAI_CONCURRENCY、DASHSCOPE_BASE_URL、LOCKAI_ALLIN1_URL（All-In-One 函数地址，校正八拍用）

# 图文向量（DashScope）和人脸 FC，不配时搜索和人物功能不可用，其他不受影响
DASHSCOPE_API_KEY=
FACE_FC_ENDPOINT=

# CORS 配置：前端的地址
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://cloud.funk-and.love

# 本地免密登录（前端 /auth/dev-login），线上不能开
DEV_LOGIN_ENABLED=false
```

### 4. 数据库和管理员

不用手动建表：启动时 `database.migrate()` 会建缺的表、补缺的列。人脸、向量、人物这几张表由
`migrations/add_vector_tables.py`、`migrations/add_real_people.py` 建。

账号归 LockAuth 管，用户第一次登录时在本地 `users` 表里建一行。设管理员直接改库：

```bash
sqlite3 instance/lockcloud.db "UPDATE users SET is_admin = 1 WHERE email = 'someone@example.com'"
```

### 5. 启动开发服务器

```bash
python app.py                                   # 或 uvicorn asgi:app --port 5000 --reload
```

服务器将在 `http://localhost:5000` 启动。启动时会补表补列、起定时任务和 embedding / 人脸的后台线程；
不想起定时任务设 `LOCKCLOUD_SCHEDULER_DISABLED=1`。开发环境 `/docs` 是自动生成的接口文档。

## 存储

`lock-cloud` 桶（私有）：

```
files/{uuid}{.ext}        原文件，上传时定下永远不变
media/{uuid}/poster.jpg   视频封面
media/{uuid}/hls/…        HLS：master.m3u8 + 1080p/ 720p/
media/{uuid}/sprite/      拖进度条的预览小图（10×10 拼一张）
media/{uuid}/frames/      每 2 秒一帧，给片段搜索、找人用
media/{uuid}/beats.json   节拍、八拍起点、起音包络
media/{uuid}/media.json   媒体 FC 的结果
media/_downloads/{id}.zip 打包下载，1 天后自动删（生命周期规则）
backups/db/{YYYY}/{MM}/   数据库备份，30 天后自动删
tmp/                      1 天后自动删
```

- 文件名、活动、日期、目录只存在数据库里。改名、移动、改活动都不动桶里的对象。
- 上传：`upload-url` 发签名 PUT 并记一张上传票据，`confirm` 核对票据和对象大小后才登记。
  没确认的票据和对象每天 03:00 清掉。
- 缩略图不预生成：客户端报 style 名（`thumbdesktop` 等），后端换成 OSS 图片处理参数再签名。
- 视频上传后 OSS 触发媒体 FC（`fc/media/`），转好 HLS 回调后端；之前先播原文件。
- 头像归 LockAuth，LockCloud 不存；显示时用 `LOCKAUTH_SERVICE_KEY` 调 LockAuth 的 `/api/auth/service/avatars`，按邮箱对上，整份缓存 5 分钟（`services/avatars.py`）。
- 删除先进回收站（`files.deleted_at`），对象不动；每天 03:00 `scripts/purge_trash.py` 彻底删掉超过 30 天的。
  回收站里的文件对所有 ORM 查询不可见（`files/models.py` 的 `do_orm_execute` 钩子），要看到它们加
  `execution_options(include_deleted=True)`；人脸、向量这些原生 SQL 要自己排除（`VISIBLE_FILES_SQL`）。
- 打包下载、管理页重跑由后端异步调媒体 FC 的 HTTP 触发器（`services/fc_jobs.py`），FC 做完回调
  `/api/files/internal/job-result` / `media-result`。

桶的 CORS、生命周期、公共读策略用 `scripts/setup_oss_buckets.py` 配。
从缤纷云迁过来用 `scripts/migrate_to_oss.py`，步骤写在脚本开头。

## 测试

`tests/` 是 HTTP 契约测试：每条路由的状态码、JSON 结构、错误码和提示文案。后端从 Flask 换成 FastAPI 时
就是靠这套测试保证接口没变，改路由要同时改测试。

```bash
pip install -r requirements-dev.txt
pytest                                   # app 从 LOCKCLOUD_ASGI_APP（默认 asgi:app）导入
```

- 不读 `.env`，不连 OSS、DashScope、LockAuth：这些在 `tests/fakes.py` 里换成了桩。库是临时 SQLite，
  表结构来自 `tests/db_schema.sql`；模型或迁移改了就跑 `python tests/build_schema.py` 重新生成。
- 测试数据用 sqlite3 直接写库，登录令牌用 PyJWT 按 LockAuth 的格式（flask-jwt-extended 格式）签。
- 限流在测试里关掉（`RATELIMIT_ENABLED=false`）；TestClient 不进 lifespan，所以不迁库、不起后台任务。
- 注释写着"现状"的断言记的是现在的怪行为，要改就同时改测试。
- 桩是按模块打补丁的：`services.storage.storage` 上的方法、`EmbeddingClient.from_env`、
  `routers.auth` 里的 `requests.post`、`services.fc_jobs.invoke`（`fc` 夹具记下调了 FC 的哪个路径）。
  换了这些入口要同步改 `tests/fakes.py`。
- `test_api_v2_*.py` 是 2026-09 新接口（见上一级的 `CONTRACT.md`）；`test_fc_media_jobs.py` 用假桶测媒体 FC 的
  `/jobs/*` 路由；`test_workers_video.py` 测 worker 的视频抽帧入库；`test_migrate_v2.py` 在老结构的库上跑 `migrate()`。

## 接口

完整的字段、错误码和行为约定在上一级的 `CONTRACT.md`，以 `tests/` 的契约测试为准。开发环境打开 `/docs` 能看到全部路由。
除了登录和 FC 回调，所有接口都要 `Authorization: Bearer <令牌>`。

### 沿用下来的接口

| 路由文件 | 前缀 | 内容 |
|---|---|---|
| `routers/auth.py` | `/api/auth` | `POST /sso/login`（用 LockAuth 的令牌换本地令牌）、`GET /sso/config`、`POST /refresh`、`GET /me`、`POST /dev/login`（本地免密登录） |
| `routers/files.py` | `/api/files` | 上传（`POST /upload-url` 拿直传地址，传完 `POST /confirm` 登记）、列表、详情、改信息、删除、查重名、相邻文件、标签、批量操作、活动目录 |
| `routers/media.py` | `/api/files` | 签名地址（`GET /signed-url/{id}`、`POST /signed-urls`）、HLS 播放列表、媒体 FC 回调 |
| `routers/people.py` | `/api/files` | 人物列表、命名、合并、换头像，文件里的人脸，旧的 `POST /ai-search` |
| `routers/file_requests.py` | `/api/requests` | 修改 / 删除申请：发起、收到的、发出的、同意、拒绝 |
| `routers/tags.py` | `/api/tags` | 标签列表和补全 |
| `routers/logs.py`、`routers/admin.py` | `/api/logs`、`/api/admin` | 操作日志、成员列表（管理员） |

### 2026-09 新接口（详细字段、错误码见上一级的 `CONTRACT.md`）

| 接口 | 说明 |
|---|---|
| `GET /api/files?sort=activity\|taken\|uploaded` | 文件对象多了 `taken_at`、`orientation` |
| `GET /api/trash`、`POST /api/trash/{id}/restore`、`DELETE /api/trash/{id}`、`POST /api/trash/empty` | 回收站 |
| `GET /api/activities` | 资料库首页的活动卡片 |
| `GET /api/files/{id}/media` | 播放器信息：播放地址、封面、拖动预览图、节拍摘要 |
| `GET /api/files/signed-url/{id}?download=1` | 原文件 attachment 下载 |
| `GET /api/files/{id}/beats` | 节拍全量和八拍段落（只读） |
| `GET /api/compare/align?a=&b=` | 两段视频按音乐对齐 |
| `POST /api/search` | 统一搜索（照片 + 视频片段 + 你是不是要找），每分钟 30 次 |
| `GET /api/files/{id}/appearances`、`GET /api/files/persons/{id}/appearances` | 视频里谁在什么时候出现 |
| `GET / POST /api/files/{id}/comments`、`DELETE /api/comments/{id}` | 评论 |
| `POST /api/downloads`、`GET /api/downloads/{id}` | 打包下载（媒体 FC 打 zip） |
| `POST /api/files/internal/job-result` | 媒体 FC 的任务回调（`X-Media-Token`） |
| `GET /api/admin/stats`、`GET /api/admin/media/failures`、`POST /api/admin/media/reprocess` | 管理页 |

### 日志接口（管理员）

#### 获取操作日志
```http
GET /api/logs?page=1&per_page=50&operation=upload
Authorization: Bearer <admin-token>
```

## 数据库

完整结构见 `tests/db_schema.sql`（由 `tests/build_schema.py` 从模型和迁移生成）。

| 表 | 内容 | 定义在 |
|---|---|---|
| `users` | LockAuth 账号在本地的一份：邮箱、名字、是否管理员。不存密码和头像 | `auth/models.py` |
| `files` | 文件：显示名 `filename`、上传时的名字 `original_filename`、桶里的 key `s3_key`、活动（日期、类型、名称）、拍摄时间、媒体处理状态和结果 `media_info`、回收站标记 `deleted_at`、手动纠正的八拍、向量和人脸的入库进度 | `files/models.py` |
| `tags`、`file_tags` | 自由标签 | `files/models.py` |
| `upload_tickets` | 上传票据：签发直传地址时记一笔，确认时核对 | `files/models.py` |
| `comments` | 评论，可以挂在视频的某一秒 | `files/models.py` |
| `downloads` | 打包下载任务 | `files/models.py` |
| `file_requests` | 修改 / 删除申请 | `files/request_models.py` |
| `file_logs` | 操作日志 | `logs/models.py` |
| `image_embeddings`、`video_frame_embeddings` | 图片、视频抽帧的向量（sqlite-vec 虚表，768 维） | `migrations/add_vector_tables.py` |
| `faces` | 人脸向量（512 维）和位置；`person_id = 0` 表示还没聚类 | `migrations/add_vector_tables.py` |
| `persons`、`real_people` | 聚类出来的人脸簇；多个簇可以链到同一个真人，名字挂在真人上 | `migrations/add_real_people.py` |

sqlite-vec 的虚表只能按主键一行一行改和删，不能 `WHERE id IN (...)` 批量写。

## 安全

- 登录令牌是 JWT，密钥和 LockAuth 共用；账号、密码、注册都在 LockAuth。
- 桶是私有的，所有文件地址都是限时签名；客户端只报用途名，处理参数由后端按白名单决定。
- 上传先领票据，登记时核对票据归属和对象大小。
- 每个接口每个 IP 每分钟 100 次（`ratelimit.py`）；安全响应头和 CORS 在 `middleware.py`。
- 生产环境（`APP_ENV=production`）关掉 `/docs` 和报错里的异常原文。`DEV_LOGIN_ENABLED` 只在本地开。

## 部署

### 生产环境配置

```bash
# .env 里 APP_ENV=production（没有 APP_ENV 时看 FLASK_ENV；两个都没有就是开发环境）

# gunicorn + uvicorn worker，绑 127.0.0.1:5001、1 个 worker（限流、定时任务、后台队列都在进程内）
gunicorn -c gunicorn.conf.py asgi:app
```

线上部署步骤见上一级目录的 `DEPLOY.md`。

### Nginx 反向代理

前端和后端同一个域名，`/api` 转给后端，其余转给前端：

```nginx
server {
    server_name cloud.funk-and.love;

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # 没有它，后端给的 HLS 地址会是 http://
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }
}
```

## 工具脚本

### 数据库迁移
启动时 `database.migrate()` 自动补表补列（只加不删，可以反复跑）。

### 回收站清理
```bash
python scripts/purge_trash.py --dry-run     # 每天 03:00 定时任务会跑，一般不用手动
```

### LockAI 分析
成员在视频上发起分析（每人每月 `LOCKAI_MONTHLY_QUOTA` 次，管理员不限），进后端进程里的队列（`services/lockai.py`）：
先由能看画面、听声音的模型把视频按"一支舞"分段，完成后自动放行这个视频的抽帧 embedding（画面搜索）和抽帧人脸。
播放器只对分析过的视频显示节拍器和分段。没配 `DASHSCOPE_API_KEY` 时队列不开。
配了 `LOCKAI_ALLIN1_URL` 时，同时调 All-In-One 函数（`fc/allin1/`）测小节头，存进分析结果；读八拍时
（`services/beat_grid.py` 的 `fix_bars`）只看和节拍算法拍点对得上的小节头，按多数票把"1"挪回小节头上。
只纠正落在"3""7"这类小节内的错位，"1"和"5"分不出来，不管。函数调失败不影响分析，只是不校正。

#### 节拍标注试验（只在本地用）
小节头两个模型都会错，改规则之前先攒人工标注：挑一批视频按现在最好的办法打拍子，在前端 `/lab/beats` 逐个看，
哪拍才是"1"、哪里换歌、哪里拍点不准直接标在时间上。数据都在 `instance/beat_lab/`（不进库、不上线，没有这个目录时接口 404）：
`raw/` 是取回来的原料，`labels/{文件 id}.json` 是标注，`labels/history.jsonl` 每次保存留一行底。
```bash
python scripts/beat_lab_prepare.py --no-fc   # 取样本的拍点（只读桶，几秒）
python scripts/beat_lab_prepare.py           # 缺 All-In-One 结果的调函数补上（15 个视频约 15–20 分钟），断了重跑接着来
```
打拍子用的就是线上那一套（`services/beat_grid.py` 的 `analyze`：两个模型的拍点互相校验，同一段连续的音乐只定一个小节位置），
网格在请求时现算，改算法不用重新取原料。标注回来后的做法：算法定不了的交给人，见 CONTRACT.md 的 `/beats/ones` 和八拍修改申请。

抽帧入库只处理分析过的视频，自动触发；要手动补跑：
```bash
python scripts/embed_worker.py --kind video      # 帧 embedding → video_frame_embeddings（/api/search 的视频片段）
python scripts/face_worker.py --kind video       # 帧人脸 → faces.frame_id（/appearances）
```

## 开发指南

### 添加新的 API 端点

1. 在 `routers/` 对应文件里加路由，数据库会话用 `db: Session = Depends(get_db)`
2. 需要登录的加 `identity: str = Depends(jwt_identity)`；管理员接口用 `deps.admin_only` / `deps.logs_admin`
3. 单独的限流写进 `ratelimit.ROUTE_LIMITS`（默认每 IP 每接口 100 次/分钟）
4. 返回统一的 JSON 格式：成功 `json_response(...)`，失败 `raise ApiError(code, message, status)`
5. 要把未知异常包成固定文案的 500，用 `@guarded('xxx失败')`

### 错误处理

所有错误使用自定义异常类：

```python
from errors import ApiError

raise ApiError('FILE_001', '文件不存在', 404)
```

### 日志记录

```python
from logs.service import log_file_operation

log_file_operation(
    db,
    user_id=user.id,
    file_id=file.id,
    operation='upload',
    ip_address=client_ip(request),      # deps.client_ip / deps.user_agent
    user_agent=user_agent(request),
)
```

## 许可证

内部项目 - 仅供 Funk & Love 使用

## 维护者

Hofmann - Funk & Love
