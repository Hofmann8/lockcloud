"""
LockCloud 部署打包脚本
生成两个 zip：
  - lockcloud-frontend.zip  (Next.js standalone + static + public)
  - lockcloud-backend.zip   (FastAPI 后端代码，不含 .env / instance / 日志)
两个包内部都不套额外目录，解压即用。

用法：
    cd lockcloud-frontend && npm run build   # 先构建前端
    python deploy.py

线上已经有数据库和 .env，所以后端包永远不带 instance/ 和 .env，
解压覆盖时不会碰到线上数据。第一次在新机器部署时再手动放 .env。

后端包不含：
  fc/      FC 镜像单独 docker build & push
  models/  insightface ONNX（1.4 GB），只在 FC 镜像里用
"""

import json
import sys
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "lockcloud-frontend"
BACKEND_DIR = ROOT / "backend"
DIST_DIR = ROOT / "dist"

STANDALONE_DIR = FRONTEND_DIR / ".next" / "standalone"
STATIC_DIR = FRONTEND_DIR / ".next" / "static"
PUBLIC_DIR = FRONTEND_DIR / "public"

# 线上前端监听的地址。standalone 的 server.js 读 PORT / HOSTNAME；
# HOSTNAME 在 shell 里通常是机器名，必须显式覆盖，否则会绑到别的网卡上。
FRONTEND_PORT = 3001
FRONTEND_HOST = "127.0.0.1"

# 后端需要打包的顶层文件
BACKEND_FILES = [
    "app.py",
    "asgi.py",
    "wsgi.py",
    "config.py",
    "database.py",
    "deps.py",
    "errors.py",
    "exceptions.py",
    "middleware.py",
    "ratelimit.py",
    "security.py",
    "gunicorn.conf.py",
    "requirements.txt",
    ".env.example",
]

# 后端需要打包的目录
# logs/ 是 Python 包（FileLog 模型在 logs/models.py），要打包；里面的 .log 文件靠排除模式去掉
BACKEND_DIRS = [
    "auth",
    "constants",
    "files",
    "logs",
    "migrations",
    "routers",
    "scripts",
    "services",
]

# 排除模式（子串匹配路径的每一段）
EXCLUDE_PATTERNS = {
    "__pycache__",
    ".pytest_cache",
    ".pyc",
    ".log",
    ".bak",
    "-journal",
    "-wal",
    "-shm",
    "tmp_face_diagnosis",
    "_tmp_",
    "diagnose_",
}


def should_exclude(path: Path) -> bool:
    return any(pattern in part for part in path.parts for pattern in EXCLUDE_PATTERNS)


def add_directory_to_zip(zf: zipfile.ZipFile, src: Path, arc_prefix: str = "", skip: set[str] | None = None):
    """递归添加目录到 zip，arc_prefix 为 zip 内的路径前缀；skip 是要跳过的相对路径"""
    for item in sorted(src.rglob("*")):
        if not item.is_file() or should_exclude(item):
            continue
        rel = item.relative_to(src).as_posix()
        if skip and rel in skip:
            continue
        arcname = f"{arc_prefix}/{rel}" if arc_prefix else rel
        zf.write(item, arcname)


def format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"


def standalone_package_json() -> str:
    """把 standalone 里的 package.json 的 start 改成 node server.js。

    线上 tmux 里一直用 `npm start` 启动前端；standalone 包里没有 next 命令行，
    原来的 `next start` 跑不起来，这里改掉，线上命令就不用变。
    """
    data = json.loads((STANDALONE_DIR / "package.json").read_text(encoding="utf-8"))
    data["scripts"] = {"start": f"PORT={FRONTEND_PORT} HOSTNAME={FRONTEND_HOST} node server.js"}
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def _built_with_localhost() -> bool:
    """构建产物里写死了本地后端地址，说明是拿开发配置构建的"""
    chunks = STATIC_DIR / "chunks"
    if not chunks.exists():
        return False
    return any("localhost:5000" in js.read_text(encoding="utf-8", errors="ignore") for js in chunks.rglob("*.js"))


def build_frontend_zip() -> Path:
    out = DIST_DIR / "lockcloud-frontend.zip"

    if not (STANDALONE_DIR / "server.js").exists():
        print(f"[错误] standalone 产物不存在: {STANDALONE_DIR}")
        print("       请先运行: cd lockcloud-frontend && npm run build")
        sys.exit(1)

    if _built_with_localhost():
        print("[错误] 前端构建里的 API 地址是 localhost:5000，这是本地开发地址")
        print("       检查 lockcloud-frontend/.env.local 后重新 npm run build")
        sys.exit(1)

    print("[前端] 开始打包...")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        # 1) standalone 目录内容 → zip 根目录（server.js、node_modules/、.next/server/ ...）
        #    本地 .env* 不带上去：NEXT_PUBLIC_* 已经在构建时写进产物了
        skip = {"package.json"} | {p.name for p in STANDALONE_DIR.glob(".env*")}
        add_directory_to_zip(zf, STANDALONE_DIR, skip=skip)
        zf.writestr("package.json", standalone_package_json())

        # 2) static 文件 → .next/static/
        if STATIC_DIR.exists():
            add_directory_to_zip(zf, STATIC_DIR, ".next/static")
        else:
            print("  [警告] static 目录不存在，跳过")

        # 3) public 文件 → public/
        if PUBLIC_DIR.exists():
            add_directory_to_zip(zf, PUBLIC_DIR, "public")

        file_count = len(zf.namelist())

    print(f"[前端] 完成: {out.name} ({format_size(out.stat().st_size)}, {file_count} 文件)")
    return out


def build_backend_zip() -> Path:
    out = DIST_DIR / "lockcloud-backend.zip"

    print("[后端] 开始打包...")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for fname in BACKEND_FILES:
            fpath = BACKEND_DIR / fname
            if fpath.exists():
                zf.write(fpath, fname)
            else:
                print(f"  [跳过] {fname} 不存在")

        for dirname in BACKEND_DIRS:
            dirpath = BACKEND_DIR / dirname
            if dirpath.exists():
                add_directory_to_zip(zf, dirpath, dirname)
            else:
                print(f"  [跳过] {dirname}/ 不存在")

        file_count = len(zf.namelist())

    print(f"[后端] 完成: {out.name} ({format_size(out.stat().st_size)}, {file_count} 文件)")
    return out


def main():
    print(f"LockCloud 部署打包 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    DIST_DIR.mkdir(exist_ok=True)

    fe = build_frontend_zip()
    be = build_backend_zip()

    print()
    print("打包完成，产物在 dist/：")
    print(f"  前端: {fe.name} ({format_size(fe.stat().st_size)})")
    print(f"  后端: {be.name} ({format_size(be.stat().st_size)})")


if __name__ == "__main__":
    main()
