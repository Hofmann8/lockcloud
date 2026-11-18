#!/usr/bin/env bash
# LockCloud 切换到新版（阿里云 OSS + FastAPI + 新前端），在 Lock001 上一次跑完。
# 顺带把运行方式从 tmux 换成 systemd（lockcloud-backend / lockcloud-frontend 两个服务，开机自启、挂了自动拉起）。
#
# 用法（本机先 npm run build、python deploy.py，再把下面四个文件传到 /srv/funkandlove/lockcloud01/）：
#   lockcloud-backend.zip  lockcloud-frontend.zip  cutover.sh  cutover.env
#   脚本中途停服，ssh 断了不能让它跟着停，所以脱离会话在后台跑、看日志：
#   cd /srv/funkandlove/lockcloud01 && setsid nohup bash cutover.sh > cutover.log 2>&1 < /dev/null &
#   tail -f /srv/funkandlove/lockcloud01/cutover.log      # Ctrl-C 只退出 tail，不影响脚本
#
# cutover.env 是本机 dist/cutover.env：要合并进线上 backend/.env 的钥匙（KEY=VALUE 一行一个），不进 git。
#
# 分两段：
#   一、不停服：装依赖、先补拷一轮增量（大头在这里，线上照常用）
#   二、停服：停 → 备份 → 再补拷最后一点 → 换代码 → 改 .env → 改库 → 用 systemd 启动 → 自检
# 第二段通常几分钟。任何一步出错脚本立即停下，按最后的提示回滚。
set -euo pipefail

ROOT=/srv/funkandlove/lockcloud01
MIG=/srv/funkandlove/lockcloud-migrate
PY=/root/miniconda3/envs/lockcloud/bin/python
PIP=/root/miniconda3/envs/lockcloud/bin/pip
GUNICORN=/root/miniconda3/envs/lockcloud/bin/gunicorn
DB=$ROOT/backend/instance/lockcloud.db
ENVF=$ROOT/backend/.env
SECRETS=$ROOT/cutover.env
MEDIA_FC_ENDPOINT=https://lockcloud-media-eaetezykyz.cn-hangzhou.fcapp.run
SSO_AUTH_API_URL=https://auth.funk-and.love
UNIT_DIR=/etc/systemd/system

say() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m[停下] %s\033[0m\n' "$*"; exit 1; }
has_env() { grep -q "^$1=." "$ENVF"; }
port_busy() { ss -ltn "sport = :$1" | grep -q LISTEN; }

STOPPED=   # 停服之后置 1：再出错就要告诉人网站是停着的、怎么恢复
STAMP=     # 备份之后才有
old_start() {  # 起旧版（backend/、frontend/ 里是旧代码时）
  cat <<EOF
  cd $ROOT/backend && setsid nohup $GUNICORN -c gunicorn.conf.py wsgi:app >> $ROOT/rollback-backend.log 2>&1 < /dev/null &
  cd $ROOT/frontend && setsid nohup npm start >> $ROOT/rollback-frontend.log 2>&1 < /dev/null &
EOF
}
rollback_hint() {
  if [ -n "$STAMP" ]; then
    cat <<EOF
回滚到旧版（备份标记 $STAMP）：
  systemctl disable --now lockcloud-backend lockcloud-frontend 2>/dev/null
  cd $ROOT && mv backend backend.new-$STAMP && mv backend.bitiful-$STAMP backend
  if [ -d frontend.bitiful-$STAMP ]; then [ ! -d frontend ] || mv frontend frontend.new-$STAMP; mv frontend.bitiful-$STAMP frontend; fi
  cp $DB.bak-$STAMP $DB
EOF
    old_start
  else
    echo "代码和库都还没动，直接起旧版："
    old_start
  fi
}
on_exit() {
  local rc=$?
  if [ "$rc" -ne 0 ] && [ -n "$STOPPED" ]; then
    printf '\n\033[1;31m脚本中途退出（rc=%s），网站现在是停着的。\033[0m\n' "$rc"
    rollback_hint
  fi
}
trap on_exit EXIT

cd "$ROOT"
[ -f lockcloud-backend.zip ] && [ -f lockcloud-frontend.zip ] || die "缺 lockcloud-backend.zip / lockcloud-frontend.zip"
[ -f "$MIG/.env" ] || die "找不到迁移目录的 .env：$MIG/.env"
[ -f "$SECRETS" ] || die "缺 $SECRETS（本机 dist/cutover.env，和 zip 一起传上来）"
command -v systemctl >/dev/null || die "这台机器没有 systemctl"
NODE=$(command -v node || true)
[ -n "$NODE" ] || die "找不到 node（前端要用），先确认 node 在 PATH 里"
NODE=$(readlink -f "$NODE")
echo "node: $NODE ($("$NODE" -v))"

# ---------------------------------------------------------------- 一、不停服
say "1/9 预先解压新代码到临时目录、装依赖（线上照常）"
STAGE=$(mktemp -d /tmp/lc-cutover.XXXX)
unzip -oq lockcloud-backend.zip -d "$STAGE/backend"
unzip -oq lockcloud-frontend.zip -d "$STAGE/frontend"
$PIP install -q -r "$STAGE/backend/requirements.txt"

say "2/9 先补拷一轮增量（线上照常，已拷过的跳过）"
(cd "$MIG" && $PY scripts/migrate_to_oss.py copy --db "$DB" --apply)

# ---------------------------------------------------------------- 二、停服
say "3/9 停服（按端口找旧进程，不管它是在 tmux 还是 nohup 里起的）"
STOPPED=1
for p in 5001 3001; do
  pids=$(ss -ltnp "sport = :$p" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u | tr '\n' ' ')
  if [ -n "$pids" ]; then echo "停 $p 端口的进程: $pids"; kill $pids || true; else echo "$p 端口本来就没有进程"; fi
done
for _ in $(seq 1 40); do
  port_busy 5001 || port_busy 3001 || break
  sleep 1
done
port_busy 5001 && die "5001 端口 40 秒后还有进程在听（旧后端没停掉）：ss -ltnp 'sport = :5001'"
port_busy 3001 && die "3001 端口 40 秒后还有进程在听（旧前端没停掉）：ss -ltnp 'sport = :3001'"

say "4/9 备份（库 + 整个旧后端 + 旧前端）"
STAMP=$(date +%Y%m%d-%H%M)
sqlite3 "$DB" ".backup $DB.bak-$STAMP"
cp -a backend "backend.bitiful-$STAMP"
mv frontend "frontend.bitiful-$STAMP"
echo "备份标记: $STAMP"

say "5/9 补拷停服前最后几分钟的新文件"
(cd "$MIG" && $PY scripts/migrate_to_oss.py copy --db "$DB" --apply)

say "6/9 换代码"
cp -a "$STAGE/backend/." backend/
# Flask 版和缤纷云时代留下的文件（新版不用）
rm -f backend/services/s3_service.py backend/services/s3_public_service.py backend/scripts/preheat_videos.py \
      backend/scripts/mirror_cover_files.py backend/scripts/restore_avatars_from_bucket.py \
      backend/extensions.py backend/validators.py backend/auth/routes.py backend/auth/decorators.py \
      backend/files/routes.py backend/logs/routes.py backend/migrations/add_email_blacklist.py
rm -rf backend/admin backend/tags backend/file_requests
mv "$STAGE/frontend" frontend
rm -rf "$STAGE"

say "7/9 改 .env"
# 最后一行没换行的话，追加的键会接在那一行后面
[ -z "$(tail -c1 "$ENVF")" ] || echo >> "$ENVF"
set_env() {  # 有就改，没有就加
  if grep -q "^$1=" "$ENVF"; then sed -i "s|^$1=.*|$1=$2|" "$ENVF"; else echo "$1=$2" >> "$ENVF"; fi
}
while IFS='=' read -r k v; do set_env "$k" "$v"; done < <(grep '^OSS_' "$MIG/.env")
while IFS='=' read -r k v; do set_env "$k" "$v"; done < <(grep -E '^[A-Z_]+=.' "$SECRETS")
set_env MEDIA_FC_ENDPOINT "$MEDIA_FC_ENDPOINT"
set_env SSO_AUTH_API_URL "$SSO_AUTH_API_URL"
sed -i -E '/^(S3_ENDPOINT|S3_BUCKET|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_REGION|PUBLIC_FILES_URL|FLASK_ENV)=/d' "$ENVF"
# 新后端靠 APP_ENV（没有再看 FLASK_ENV）判断环境，两个都没有就当开发环境：/docs 公开、报错带异常原文。
# 上面删了 FLASK_ENV，这里必须写明是生产。
set_env APP_ENV production
# 免密登录只给本地开发用，线上不许开
if grep -q -i '^DEV_LOGIN_ENABLED=true' "$ENVF"; then
  set_env DEV_LOGIN_ENABLED false
  echo "注意：线上 .env 里 DEV_LOGIN_ENABLED 原来是 true，已改成 false"
fi
missing=
for k in MEDIA_CALLBACK_TOKEN LOCKAUTH_SERVICE_KEY DASHSCOPE_API_KEY FACE_FC_ENDPOINT FACE_FC_TOKEN; do
  has_env "$k" || missing="$missing $k"
done
[ -z "$missing" ] || echo "注意：.env 里还缺$missing，对应功能先不可用，补上后 systemctl restart lockcloud-backend"
echo ".env 里现在的键：$(grep -o '^[A-Z_][A-Z0-9_]*' "$ENVF" | tr '\n' ' ')"

say "8/9 改库（s3_key 换成 OSS 新 key，收下已处理好的媒体结果；先自动备份）"
(cd backend && $PY scripts/migrate_to_oss.py rewrite-db --db "$DB" --apply)

say "9/9 用 systemd 启动并自检"
cat > "$UNIT_DIR/lockcloud-backend.service" <<EOF
[Unit]
Description=LockCloud backend (FastAPI, gunicorn)
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$ROOT/backend
ExecStart=$GUNICORN -c gunicorn.conf.py asgi:app
Environment=PYTHONUNBUFFERED=1
Restart=always
RestartSec=3
KillMode=mixed
TimeoutStopSec=40

[Install]
WantedBy=multi-user.target
EOF
cat > "$UNIT_DIR/lockcloud-frontend.service" <<EOF
[Unit]
Description=LockCloud frontend (Next.js standalone)
After=network-online.target lockcloud-backend.service
Wants=network-online.target

[Service]
WorkingDirectory=$ROOT/frontend
ExecStart=$NODE server.js
Environment=NODE_ENV=production PORT=3001 HOSTNAME=127.0.0.1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now lockcloud-backend lockcloud-frontend

ok_backend=; ok_frontend=
for _ in $(seq 1 60); do
  [ -z "$ok_backend" ] && curl -fs http://127.0.0.1:5001/health >/dev/null && ok_backend=1
  [ -z "$ok_frontend" ] && curl -fs -o /dev/null http://127.0.0.1:3001/auth/login && ok_frontend=1
  [ -n "$ok_backend" ] && [ -n "$ok_frontend" ] && break
  sleep 2
done
[ -n "$ok_backend" ] || die "后端 2 分钟没起来：journalctl -u lockcloud-backend -n 50；tail -50 $ROOT/backend/logs/gunicorn_error.log"
[ -n "$ok_frontend" ] || die "前端 2 分钟没起来：journalctl -u lockcloud-frontend -n 50"
curl -s -o /dev/null -w "新接口 /api/activities（未登录应为 401）: %{http_code}\n" http://127.0.0.1:5001/api/activities || true

say "nginx 指向（前端应为 127.0.0.1:3001，/api 应为 127.0.0.1:5001，且有 X-Forwarded-Proto）"
grep -n -E "proxy_pass|X-Forwarded-Proto" /etc/nginx/conf.d/cloud.funk-and.love.conf || true

cat <<EOF

完成。备份标记 $STAMP。
现在由 systemd 管：
  systemctl status lockcloud-backend lockcloud-frontend
  systemctl restart lockcloud-backend          # 改了 .env 之后
  journalctl -u lockcloud-backend -f            # 进程输出；应用日志仍在 $ROOT/backend/logs/
旧的 tmux 会话如果还在，已经空了，可以关掉：tmux kill-session -t lockcloud-backend; tmux kill-session -t lockcloud-frontend
钥匙已经并进 .env，$SECRETS 可以删掉：rm $SECRETS

出问题时：
EOF
rollback_hint
cat <<EOF

网站打开正常后，让媒体 FC 补跑两批（异步，几分钟到十几分钟；先不加 --apply 看数量）：
  cd $ROOT/backend
  $PY scripts/reprocess_media.py --steps beats --apply     # 9 月搬过来的视频节拍还是旧格式，不重算没有节拍尺
  $PY scripts/reprocess_media.py --large-images --apply    # 超过 20 MB 的图片补缩小版，不补缩略图出不来
EOF
