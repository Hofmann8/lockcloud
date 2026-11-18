# LockCloud 迁阿里云 OSS：上线手册和待办

LockCloud 从缤纷云迁到阿里云 OSS（杭州）。代码已经写完，还没上线。这份文件交代现状、上线步骤、回滚方法和剩下的事。服务器总体布局见仓库根目录的 `SERVERS.md`。

**2026-11-18 更新**：线上仍是旧版（Flask + 缤纷云）。媒体 FC 已经是 v5（新格式、音频、Live Photo），桶的 CORS 和生命周期规则齐了。
上线就是跑第三节的 `cutover.sh`（文件同步在脚本里，不用另外先同步），之后补跑节拍和大图两批。
线上 `.env` 缺的两把钥匙（`MEDIA_CALLBACK_TOKEN`、`LOCKAUTH_SERVICE_KEY`）放在本机 `dist/cutover.env`（不进 git），和 zip 一起传上去，脚本自动并进 `.env`。
切换时顺带从 tmux 换成 systemd：`lockcloud-backend`、`lockcloud-frontend` 两个服务，开机自启、挂了自动拉起，
`systemctl restart lockcloud-backend`、`journalctl -u lockcloud-backend -f`。停旧进程按端口找（不管它在 tmux 还是 nohup 里），
脚本中途出错会自动打印恢复命令（旧版用 nohup 起）。下文第三节第 2、7 步的 tmux 命令已经不用。

## 现状（2026-09-28）

**已完成**

- 后端、网页前端、媒体转码 FC（`backend/fc/media/`）、迁移脚本（`backend/scripts/migrate_to_oss.py`）都已写完，没有上线。
- 两个桶已建好并配置完（`scripts/setup_oss_buckets.py --apply` 已跑）：
  - `lock-cloud`：私有；有 CORS；生命周期规则是 `backups/` 30 天删、`tmp/` 1 天删、没传完的分片 7 天清。
  - `lock-publicfiles`：只有 `avatars/*` 公开可读。
- Lock001 上的迁移目录 `/srv/funkandlove/lockcloud-migrate/` 已建好。里面有 `.env`（缤纷云密钥 + `lock-service` 的 OSS 密钥 + 内网 endpoint），`lockcloud` 环境已装 `oss2`。
- LockAuth 2.0 已上线，头像归它管：
  - LockAuth 库的 `users.avatar_key` 记头像，图存在 `lock-publicfiles/avatars/{LockAuth 用户 id}/`。
  - 新版 LockCloud 不存任何头像信息，显示时按邮箱调 LockAuth 的 `GET /api/auth/service/avatars`（需求提在 `lockauth/REQUESTS.md`，
    LockAuth 做完后给一个服务密钥，填进后端 `.env` 的 `LOCKAUTH_SERVICE_KEY`）。没配或调不通时头像显示名字首字。
- 依赖已核对：`backend/requirements.txt` 的 57 个版本在服务器用的阿里云 pip 镜像上都有，Python 3.10 都能装。

**线上旧版现在缺的东西**

缤纷云的公共桶 `funkandlove-cloud-public` 已被整个删除（2026-09-28），线上旧版 LockCloud 里依赖它的三样东西都坏了：

1. 头像不显示，只显示首字母，也传不了新头像。老头像（4 张）已经没了，要本人去 LockAuth 重传。
2. 人物页的人脸小图没了（原来在 `covers/`）。
3. 每天的数据库备份传不上去。**切换之前隔几天手动备份一次**：
   ```bash
   sqlite3 /srv/funkandlove/lockcloud01/backend/instance/lockcloud.db ".backup /root/lockcloud.db.bak-$(date +%Y%m%d)"
   ```

切到 OSS 之后这三样都会恢复，所以切换宜早不宜迟。

## 这一版和线上旧版的差别

| | 旧版（线上） | 新版 |
|---|---|---|
| 存储 | 缤纷云 `funkandlove-cloud2` + 公共中转桶 | 阿里云 OSS `lock-cloud`（杭州，私有），服务器读写走内网 |
| 原文件 key | `活动类型/年/月/文件名`，改活动要搬对象 | `files/{uuid}{.ext}`，上传后永不变；目录只存在数据库 |
| 缩略图 | 缤纷云预设 style | 同样的 style 名（老 App 兼容），后端按白名单换成 OSS 图片处理参数 |
| 视频 | 缤纷云转码，慢 | 上传后 OSS 触发媒体 FC：HLS 1080p/720p、封面、thumbhash；转完之前直接播原文件 |
| 人脸小图 | 公共桶 mirror + `?rect=` | 私有桶签名裁剪，不再 mirror；`public_url`、`public_mirror_at` 两列删掉 |
| 上传 | 客户端给什么 key 就信什么 | 上传票据（`upload_tickets`）+ 确认时核对对象大小 |
| 删除 | 只删对象 | 先进回收站；30 天后原文件 + `media/{uuid}/` + 人脸、embedding、评论一起清 |
| 头像 | LockCloud 自己存 | LockAuth 管，LockCloud 显示时问它（不存） |
| 数据库备份 | 公共桶（可公开读，已删） | `lock-cloud/backups/db/`，30 天自动删 |

桶里的目录和规则见 `backend/README.md` 的"存储"一节，决策记录在 `.memory/decision_oss_layout.md`。

## 给接手会话的约定

- 会写库、写桶、调外部服务的命令（迁移、worker、scripts/ 下的脚本，连启动 app 也算：启动时会补表补列、起定时任务）只写好，**由用户自己跑**。
- ssh 远程操作被 hook 拦截，服务器上的命令写出来给用户执行。`rm -r` / `rm -f` 也会被拦，要逐个删文件。
- 本地 Python 用 conda 的 `lockcloud` 环境；临时文件放 D 盘，用完自己清掉。
- git 由用户执行；提交信息里不加 AI 署名。
- 不要在输出里打印 `.env` 里的密钥。密钥在这两处：本地 `backend/.env`（`OSS_*` 是 `lock-service` 的），服务器迁移目录的 `.env`。
- 界面文案：中文，简短，像 Apple。

## 一、部署媒体 FC（2026-09-28 已完成）

函数 `lockcloud-media` 已上线（镜像现在是 `lock-service/lockcloud-media:v5`，OSS 触发器 `oss-files`，异步重试 2 次），端到端测过。
切换前 FC 回调打到线上旧版会返回 404，这没关系：结果同时写在桶里的 `media.json`，切换时会读进来。
下面留作重建的参考；以后出新版本只需第 3 步推新标签，再改函数镜像（`lock-service` 有 `lock*` 函数的权限，本机 `aliyun --profile lock` 可以直接改）。

1. **函数专用的 RAM 用户**（2026-09-28 已建）：函数用这个用户的 AccessKey 读写桶，钥匙填在函数的环境变量里，不挂执行角色。这个用户只挂一条自定义策略 `lockcloud-media-oss`：
   ```json
   {
     "Version": "1",
     "Statement": [
       { "Effect": "Allow", "Action": "oss:GetObject", "Resource": "acs:oss:*:*:lock-cloud/files/*" },
       { "Effect": "Allow", "Action": ["oss:GetObject", "oss:PutObject", "oss:DeleteObject"], "Resource": "acs:oss:*:*:lock-cloud/media/*" },
       { "Effect": "Allow", "Action": "oss:ListObjects", "Resource": "acs:oss:*:*:lock-cloud",
         "Condition": { "StringLike": { "oss:Prefix": "media/*" } } }
     ]
   }
   ```
   原文件目录 `files/` 只读，函数改不了也删不掉原文件。以后 FC 要写新的目录，先在这里加。
2. **回调令牌**：一个随机值，FC 和 LockCloud 的 `.env` 都用它（2026-09-28 已生成，用户保管）。重新生成：
   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
3. **构建和推送镜像**（本机，先开 Docker Desktop；详见 `backend/fc/media/README.md`）：
   ```powershell
   cd D:\日常事务\码农\funkandlove\lockcloud\backend\fc\media
   docker build --platform=linux/amd64 --provenance=false -t lockcloud-media:v2 .
   $REG = "crpi-erg46jo9l599ryzm.cn-hangzhou.personal.cr.aliyuncs.com/lock-service"
   docker login crpi-erg46jo9l599ryzm.cn-hangzhou.personal.cr.aliyuncs.com
   docker tag lockcloud-media:v2 "$REG/lockcloud-media:v2"
   docker push "$REG/lockcloud-media:v2"
   docker manifest inspect "$REG/lockcloud-media:v2"   # 只应有 amd64 / linux
   ```
   - ACR 个人版（杭州），命名空间 `lock-service`，私有仓库 `lockcloud-media`；人脸 FC 的 `lockcloud-face` 也在这里。push 报仓库不存在时，先在 ACR 控制台建仓库（私有、本地仓库）。
   - `--provenance=false` 一定要加，不然 FC 部署会卡在 Pending。
   - 标签用版本号（v1、v2…），不要用 `latest`：FC 可能不重新拉同名标签。
   - 构建里有一步 `import crcmod._crcfunext`，失败说明 CRC 的 C 扩展没编进去，不要推这个镜像。
4. **建函数**（FC 3.0，杭州）
   - 自定义镜像，端口 9000。
   - 4 vCPU / 8 GB，**磁盘 10 GB**，超时 7200 秒，单实例并发 1。
   - 选"事件函数"（OSS 事件投递到 `POST /invoke`）。函数角色留空：代码先读角色发的临时凭据，没有才读环境变量里的钥匙。
   - 环境变量：
     - `ALIBABA_CLOUD_ACCESS_KEY_ID`、`ALIBABA_CLOUD_ACCESS_KEY_SECRET`：第 1 步那个用户的钥匙
     - `MEDIA_CALLBACK_URL=https://cloud.funk-and.love/api/files/internal/media-result`
     - `MEDIA_CALLBACK_TOKEN=<第 2 步的值>`
   - 异步调用：最大重试 2 次。
5. **触发器**：OSS 触发器，桶 `lock-cloud`，前缀 `files/`，后缀留空。事件选 `oss:ObjectCreated:PutObject`、`PostObject`、`CompleteMultipartUpload`、`CopyObject`。触发用的角色选系统的 `AliyunOSSEventNotificationRole`（让 OSS 能调用函数，和函数读写桶的身份是两回事）。
6. **试一下**：在 OSS 控制台往 `lock-cloud` 传一个短视频，路径写成 `files/<随便 32 位十六进制>.mp4`。一分钟内 `media/<同一串>/` 下应该有 `hls/`、`poster.jpg`、`sprite/`、`frames/`、`beats.json`、`media.json`。看完把这两处都删掉。

## 二、先搬文件（不停服）

约 3,800 个文件、78 GB，从缤纷云拷到 `lock-cloud`，要跑一段时间，放在 tmux 里跑。每个文件进桶都会触发 FC；图片几乎不花钱，约 300 个视频的转码费估计几十元。

1. **把迁移目录的代码更新到最新**：脚本在 2026-09-28 之后还改过。本机打包上传：
   ```powershell
   cd D:\日常事务\码农\funkandlove\lockcloud\backend
   tar -czf D:\lockcloud-migrate.tgz --exclude=instance --exclude=.env --exclude=logs --exclude=models --exclude=fc --exclude=__pycache__ .
   scp D:\lockcloud-migrate.tgz lock001:/srv/funkandlove/
   ```
   在 Lock001 上（迁移目录里的 `.env` 保留不动）：
   ```bash
   cd /srv/funkandlove/lockcloud-migrate && tar -xzf ../lockcloud-migrate.tgz && rm -f ../lockcloud-migrate.tgz
   ```
2. **先查环境**（在 Lock001 上）：
   ```bash
   PY=/root/miniconda3/envs/lockcloud/bin/python
   $PY -c "import crcmod._crcfunext; print('crcmod C 扩展 OK')"
   $PY -c "import sqlite3; print('SQLite', sqlite3.sqlite_version)"
   df -h /srv
   sqlite3 /srv/funkandlove/lockcloud01/backend/instance/lockcloud.db "SELECT size/1048576 FROM files ORDER BY size DESC LIMIT 5"
   ```
   - crcmod 报错：oss2 会用纯 Python 算 CRC，拷 78 GB 时会吃满一个核、拖慢线上服务。先装上 C 扩展：`dnf install -y gcc` 后 `$PY -m pip install --force-reinstall --no-binary crcmod crcmod`，再查一次。
   - SQLite 要 ≥ 3.35（切换时 `rewrite-db` 删列要用）。
   - 磁盘：每个线程先把整个文件下到本地再传，最多同时占"线程数 × 最大文件"。默认 8 个线程；剩余空间不到"8 × 最大文件 × 1.5"就加 `--workers 4`。
3. **拿一份生产库快照，先试算再复制**（真复制用 nohup 放后台，断线不怕）：
   ```bash
   sqlite3 /srv/funkandlove/lockcloud01/backend/instance/lockcloud.db ".backup /root/lc-snapshot.db"
   cd /srv/funkandlove/lockcloud-migrate
   /root/miniconda3/envs/lockcloud/bin/python scripts/migrate_to_oss.py copy --db /root/lc-snapshot.db   # 试算
   nohup /root/miniconda3/envs/lockcloud/bin/python -u scripts/migrate_to_oss.py copy --db /root/lc-snapshot.db --apply \
     > migrate-copy.log 2>&1 & echo $! > migrate-copy.pid
   tail -f migrate-copy.log          # 看进度，Ctrl-C 只退出 tail，不影响复制
   ```
   停下：`kill -INT $(cat migrate-copy.pid)`，会等正在传的几个结束后退出。
   脚本可以反复跑，已经拷过的会跳过。缤纷云上找不到的、拷坏的会写进 `migrate_problems_*.csv`。
   2026-09-28 试算：3,884 个文件、90 GB。
4. （可选）`scripts/migrate_to_oss.py orphans --db /root/lc-snapshot.db`：列出缤纷云里有、数据库里没有的对象，只读。

## 三、切换当天（用 `cutover.sh`，停服几分钟）

**媒体 FC 已是 v5**（2026-11-18 换上；含 beat_this 节拍、新格式、音频、Live Photo，以及 11-10 那处"补跑失败不整个记 failed"的修复）。
以后出新版本照 `backend/fc/media/README.md` 的「构建」，标签往上加（v6…），推上去后在控制台改函数镜像。

**切换后马上让 FC 补跑两批**（Lock001，`cutover.sh` 跑完之后；FC 异步处理，几分钟到十几分钟）：
```bash
cd /srv/funkandlove/lockcloud01/backend
PY=/root/miniconda3/envs/lockcloud/bin/python
$PY scripts/reprocess_media.py --steps beats            # 先看数量（约 350 个视频）
$PY scripts/reprocess_media.py --steps beats --apply    # 重算节拍
$PY scripts/reprocess_media.py --large-images           # 先看数量（约 283 张）
$PY scripts/reprocess_media.py --large-images --apply   # 超过 20 MB 的图片补一张缩小版
```
- 节拍重算完之前，播放器里没有节拍尺（旧格式的 `beats.json` 后端当作没有）。
- OSS 图片处理只收 20 MB 以内的原图（超过报 `ImageTooLarge`），这批大图补完缩小版之前缩略图、大图预览、从它们裁的人脸都显示不出来。

直接用仓库根目录的 `cutover.sh` 一次跑完，下面 1–7 步是它做的事，留作对照和手动排错：
```powershell
# 本机（先关掉本地的 npm run dev）
cd D:\日常事务\码农\funkandlove\lockcloud\lockcloud-frontend; npm run build; cd ..; E:\conda\envs\lockcloud\python.exe deploy.py
scp dist\lockcloud-frontend.zip dist\lockcloud-backend.zip dist\cutover.env cutover.sh lock001:/srv/funkandlove/lockcloud01/
```
```bash
# Lock001：脱离 ssh 会话在后台跑（中途停服，ssh 断了不能让脚本跟着停），看日志
cd /srv/funkandlove/lockcloud01 && setsid nohup bash cutover.sh > cutover.log 2>&1 < /dev/null &
tail -f /srv/funkandlove/lockcloud01/cutover.log     # Ctrl-C 只退出 tail
```
它先在不停服的情况下装依赖、补拷一轮增量，再停服（确认 5001、3001 端口空出来）、备份、补拷最后一点、换代码、改 `.env`、改库、
写 systemd 服务并启动、自检，最后打印回滚命令和补跑命令。
注意：迁移目录里的是旧版 `migrate_to_oss.py`（`rewrite-db` 还要 `--auth-db`），脚本改库用的是新后端自带的版本。


1. **本机打包**：
   ```powershell
   cd D:\日常事务\码农\funkandlove\lockcloud; python deploy.py
   scp dist\lockcloud-frontend.zip dist\lockcloud-backend.zip lock001:/srv/funkandlove/lockcloud01/
   ```
   后端包不带 `.env`、`instance/` 和日志；前端包的 `npm start` 已经是 `node server.js`（监听 127.0.0.1:3001）。构建里如果是 localhost 地址，`deploy.py` 会直接报错。
2. **停服**：
   ```bash
   tmux send-keys -t lockcloud-backend C-c
   tmux send-keys -t lockcloud-frontend C-c
   ```
3. **备份**：
   ```bash
   cd /srv/funkandlove/lockcloud01
   STAMP=$(date +%Y%m%d-%H%M); echo "备份标记: $STAMP"
   sqlite3 backend/instance/lockcloud.db ".backup backend/instance/lockcloud.db.bak-$STAMP"
   cp -a backend backend.bitiful-$STAMP
   mv frontend frontend.bitiful-$STAMP
   ```
4. **补增量、改库**（在迁移目录里；每条都先不加 `--apply` 看一遍）：
   ```bash
   cd /srv/funkandlove/lockcloud-migrate
   PY=/root/miniconda3/envs/lockcloud/bin/python
   DB=/srv/funkandlove/lockcloud01/backend/instance/lockcloud.db
   $PY scripts/migrate_to_oss.py copy --db $DB --apply
   $PY scripts/migrate_to_oss.py rewrite-db --db $DB --apply
   ```
   `rewrite-db` 会做这些事：
   - 先在同目录备份一份；
   - 建新列和 `upload_tickets` 表；
   - 把 `s3_key` 换成新 key，按"活动类型/年/月"重算目录；
   - 删掉 `public_url` 和 `public_mirror_at`；
   - 读入已经写好的 `media.json`。

   头像不在这里处理：归 LockAuth 管，LockCloud 不碰它的库。

   如果提示 OSS 上还缺文件，先把 `migrate_problems_*.csv` 发出来看，确认那些文件本来就丢了，再加 `--allow-missing`。
5. **换代码**：
   ```bash
   cd /srv/funkandlove/lockcloud01
   unzip -oq lockcloud-backend.zip -d backend
   rm -f backend/services/s3_service.py backend/services/s3_public_service.py backend/scripts/preheat_videos.py backend/scripts/mirror_cover_files.py backend/scripts/restore_avatars_from_bucket.py
   # Flask 版留下的文件（新版是 FastAPI，路由都在 routers/）
   rm -f backend/extensions.py backend/validators.py backend/auth/routes.py backend/auth/decorators.py backend/files/routes.py backend/logs/routes.py backend/migrations/add_email_blacklist.py
   rm -rf backend/admin backend/tags backend/file_requests
   /root/miniconda3/envs/lockcloud/bin/pip install -r backend/requirements.txt
   mkdir frontend && unzip -oq lockcloud-frontend.zip -d frontend
   rm -f lockcloud-*.zip
   grep -n -E "proxy_pass|X-Forwarded-Proto" /etc/nginx/conf.d/cloud.funk-and.love.conf
   ```
   前端第 3 步已经整个挪成 `frontend.bitiful-$STAMP`，新包解压进空目录，不和旧的 `.next/`、`node_modules` 混。
   最后一条看 nginx：
   - 前端的 `proxy_pass` 要指向 `127.0.0.1:3001`。新前端只听 127.0.0.1，写成 `localhost` 可能解析到 IPv6 连不上，要改掉后 `nginx -t && systemctl reload nginx`。
   - `/api` 那段要有 `proxy_set_header X-Forwarded-Proto $scheme;`，否则后端给的 HLS 地址会是 `http://`，https 页面会拦下。
   - 后端现在只听 `127.0.0.1:5001`（原来是 `0.0.0.0:5001`），`/api` 的 `proxy_pass` 要是 `127.0.0.1:5001`，不能是公网 IP 或 `localhost`。
6. **改 `.env`**（`backend/.env`）：
   ```bash
   grep '^OSS_' /srv/funkandlove/lockcloud-migrate/.env >> backend/.env
   echo "MEDIA_CALLBACK_TOKEN=<和 FC 一样的值>" >> backend/.env
   ```
   然后删掉老的 `S3_ENDPOINT`、`S3_BUCKET`、`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`、`AWS_REGION`。其余 `OSS_*` 的默认值就是 `lock-cloud`、杭州，不用写。`PUBLIC_FILES_URL` 不用了，有的话删掉。
7. **启动**：
   ```bash
   tmux send-keys -t lockcloud-backend "cd /srv/funkandlove/lockcloud01/backend && /root/miniconda3/envs/lockcloud/bin/gunicorn -c gunicorn.conf.py asgi:app" Enter
   tmux send-keys -t lockcloud-frontend "cd /srv/funkandlove/lockcloud01/frontend && npm start" Enter
   ```
   后端是 FastAPI，gunicorn 用 uvicorn worker、1 个进程（配置在 `gunicorn.conf.py`）。老命令 `wsgi:app` 也还能起（`wsgi.py` 转到 `asgi:app`）。
   gunicorn 自己的日志在 `backend/logs/gunicorn_*.log`，应用日志在 `backend/logs/app.log`。
   有问题时用 `tmux capture-pane -pt lockcloud-backend | tail -30` 看日志。

## 四、上线后检查

- 文件列表的缩略图、大图预览、原图下载（文件名是数据库里的名字）。
- 老视频：已转完的走 HLS，能切清晰度；还没转完的直接播原文件。
- 上传一张图、一个视频：确认成功；几分钟后视频变成 HLS，封面换成 FC 生成的。
- 人物页的人脸小图，特别是竖拍照（EXIF 6/8）。重点看文件 1527、2551，这两张以前是异类（见 `.memory/gotcha_bitiful_rect_raw_coord.md`）。
- 头像：配了 `LOCKAUTH_SERVICE_KEY` 后，在 LockAuth 换过的头像 5 分钟内出现在 LockCloud（不用重新登录）。
- 改名、移动、改活动类型之后文件都还能打开（新版不搬对象）。
- 删除一个文件后它进了回收站；在回收站里彻底删除后，`media/{uuid}/` 也一起没了。
- 第二天 `lock-cloud/backups/db/` 里有备份；03:00 的清理任务日志里有 `stale tickets` 和 `pending media` 两行。

## 回滚

缤纷云的 `funkandlove-cloud2` 在收尾之前都不动，所以随时能退回：

```bash
cd /srv/funkandlove/lockcloud01
mv backend backend.oss-broken && cp -a backend.bitiful-<STAMP> backend
mv frontend frontend.oss-broken && cp -a frontend.bitiful-<STAMP> frontend
# backend.bitiful-<STAMP> 里的库是切换前的；切换后新传的文件会丢（它们只在 lock-cloud 里）
# 重启两个 tmux 会话：backend.bitiful-<STAMP> 是 Flask 版，要用 gunicorn -c gunicorn.conf.py wsgi:app（它的配置绑 0.0.0.0:5001）；前端 npm start
```

## 五、切换后收尾（观察一两周后）

- [ ] 删掉 Lock001 上的 `backend.bitiful-*`、`frontend.bitiful-*`、`/root/lc-snapshot.db`、迁移目录 `/srv/funkandlove/lockcloud-migrate/`。
- [ ] 清空并删除缤纷云 `funkandlove-cloud2`。
- [ ] 删掉 `backend/scripts/migrate_to_oss.py`，以及 `requirements.txt` 里的 `boto3`（只有它在用）。
- [ ] 更新 `SERVERS.md`："LockCloud 迁阿里云 OSS"一节改成已上线，数据备份一行、待收尾里的相关条目也一并更新。

## 六、2026-09 重构的新功能上线（回收站、活动、播放器、搜索、评论、打包下载、管理页）

接口见 `CONTRACT.md`。后端代码随 `deploy.py` 一起打包（新文件都在已有的 `routers/`、`services/`、`scripts/` 里）。

1. **备份库**（启动时 `migrate()` 会给 `files` 补 8 列、建 `comments` / `downloads` 两张表，并从 `media_info` 里补 `taken_at`；
   2026-11 起还会建 `real_people_anchors` 表、给 `real_people` 补 `anchor_frame_id` 列，用来让合并过的人物和置顶头像在每晚重新聚类后留得住）：
   ```bash
   sqlite3 /srv/funkandlove/lockcloud01/backend/instance/lockcloud.db ".backup /root/lockcloud.db.bak-v2-$(date +%Y%m%d)"
   ```
2. **媒体 FC 出新镜像**（`handler.py` 加了 `/jobs/process`、`/jobs/zip`，`/invoke` 不变）：按第一段第 3 步构建推送 `lockcloud-media:v3`，
   改函数镜像。环境变量不用加（打包回调地址从 `MEDIA_CALLBACK_URL` 推出来，是同目录的 `/api/files/internal/job-result`）。
3. **给媒体函数加 HTTP 触发器**：认证方式"无需认证"（代码里用 `X-Media-Token` 鉴权，令牌不对 401），请求方法 POST。
   后端带 `X-Fc-Invocation-Type: Async` 走异步调用，沿用"最大重试 2 次"的异步配置。
   RAM 策略不用改：zip 写在 `media/_downloads/`，已在 `media/*` 的读写权限里（分片上传用的也是 `oss:PutObject`）。
4. **桶的生命周期规则**：`scripts/setup_oss_buckets.py` 已加上 `media/_downloads/` 1 天删（`downloads-1d`）。先不加参数看一遍，再 `--apply`
   （会整体覆盖 `lock-cloud` 的生命周期规则，脚本里已经包含原有的几条）。或者在控制台手动加一条：前缀 `media/_downloads/`，1 天后删除。
5. **后端 `.env`** 加：
   ```bash
   MEDIA_FC_ENDPOINT=https://<第 3 步触发器的公网地址>    # 不带路径
   ```
   没配时打包下载会直接返回 `failed`，管理页重跑全部 `skipped`，其他功能不受影响。
6. **重启后端**。定时任务表多了 `purge_trash`（每天 03:00 彻底删除回收站里超过 30 天的文件），`logs/scheduler/purge_trash.log` 看结果。
7. **视频的抽帧入库改由 LockAI 分析驱动**（2026-11）：不再整库跑。成员在视频上发起 LockAI 分析（每人每月 3 次，管理员不限），
   分析完成后这个视频的帧 embedding 和帧人脸自动排队；`embed_worker.py` / `face_worker.py --kind video` 也只处理分析过的视频。
   `.env` 里的 `LOCKCLOUD_AUTO_VIDEO_FRAMES` 已经没用了，可以删。老视频没抽帧的要先在管理页补跑 `frames` 步骤。
   第二天 04:00 的聚类会把视频里的脸一起聚进人物。

8. **LockAI 分析**（2026-11）：启动时 `migrate()` 给 `files` 补 `lockai_status` 列，建 `lockai_jobs` 表。
   队列在后端进程里，用 `.env` 已有的 `DASHSCOPE_API_KEY`；可选 `DASHSCOPE_BASE_URL`（百炼专属地址）、`LOCKAI_MODEL`
   （默认 `qwen3.8-omni-flash`）、`LOCKAI_MONTHLY_QUOTA`（默认 3）、`LOCKAI_CONCURRENCY`（默认 3）。
   `LOCKAI_ALLIN1_URL` 填 All-In-One 函数的 HTTP 触发器地址（部署见 `backend/fc/allin1/README.md`）：分析时顺带测小节头，
   校正八拍把"1"数成"3""7"的地方。不填就不校正，其余照常。
   模型自己下载视频原文件（OSS 签名地址，外网），一个 8 分钟的视频大约 15 万 token、两三分钟。
   要把本地试验跑过的结果带上线：把 `backend/instance/segment_trial/` 拷到服务器同一位置，
   `python scripts/lockai_import_trial.py --user <管理员的 users.id> --apply`。

上线后看：删一个文件后出现在回收站、能恢复；资料库首页的活动卡片；视频播放页的拖动预览图和节拍尺；
打包下载一个活动（看 `media/_downloads/` 里的 zip 和文件夹结构）；管理页统计。

## 代码待办

- [x] **头像交还 LockAuth**：`/sso-internal/avatar*`、`/avatar/signed-url` 已删；LockCloud 不再存 `avatar_key`（老库里这一列留着不用），
  迁移脚本的 `avatars` 子命令和 `rewrite-db` 读 LockAuth 库的部分已删。
  - `/avatar/upload-url`、`/avatar/confirm`、`DELETE /avatar` 还返回 410 `AVATAR_MOVED`，给旧版 App 看的，等新版 App 发布后再删。
- [x] LockAuth 已上线 `GET /api/auth/service/avatars`（2026-09-29）。密钥已写进本机 `backend/.env` 的 `LOCKAUTH_SERVICE_KEY`；**切换时把这一行也抄进 Lock001 上新后端的 `.env`**。
  - 同时确认线上 `.env` 的 `SSO_AUTH_API_URL=https://auth.funk-and.love`。`auth-api.funk-and.love` 已经连不上（2026-09-29 实测），代码里的默认值也改成了 `auth.funk-and.love`。
- [x] 网页端 `npx eslint .` 清零（前端重构时一并处理）。
- [x] `lockcloud-frontend/.env*` 里的 `NEXT_PUBLIC_S3_MAIN_URL` 已删（前端重构后动作表情放在 `public/moves/`，不再从静态桶取）。静态桶本身按决定继续留在缤纷云，以后新的公共静态资源放 `lock-publicfiles`。
- [ ] `.kiro/specs/` 里的旧设计文档还写着缤纷云，要么更新，要么标注已过时。

## 上线后要用真实数据验证的

- 人脸裁剪的方向（EXIF 6/8，文件 1527、2551）。新版做法：先在 raw 像素上裁，再按 `orientation` 旋转（`services/media.py` 的 `face_crop_url`）；镜像类的方向（2/4/5/7）没有处理。
- iPhone HDR（HLG / PQ）视频转成 SDR 后的颜色。本地只用合成的假 HDR 测过，只能证明流程能跑通。
- 旧版 App 走 `/api/files/hls-proxy/…` 播放时，会把登录头也带给 OSS 的分片地址，OSS 可能因此拒绝。如果播不了，要么在改写播放列表时让分片也走后端，要么尽快发新版 App。
- `face_worker` 让人脸 FC 用内网签名地址取图，确认 FC 能访问 `oss-cn-hangzhou-internal`；`embed_worker` 给 DashScope 的是外网签名地址，确认它能拉到带 `x-oss-process` 的图。
- 网页端直传（PUT 到 `lock-cloud`）的 CORS：线上域名 `cloud.funk-and.love`，本地 `localhost:3000`。
- OSS 图片处理对原图大小有上限（印象中是 20 MB，没核实）。挑几张库里超过 20 MB 的大图看缩略图能不能出来。
- 第一轮 copy 之后、切换之前在旧版里被删掉的文件，会在 `files/` 下留一份没人引用的对象。切换稳定后列一下 `files/` 里数据库没有的 key，清掉。

## Flutter App

2026-09-28 起独立成单独的项目，在 `funkandlove/LockCloud-app/`，不再属于这个仓库。它还在调的旧接口（`hls-proxy`、返回 410 的头像接口）见上面的"代码待办"和"上线后要用真实数据验证的"。
