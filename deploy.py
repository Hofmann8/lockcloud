"""
LockCloud 部署打包脚本
生成两个 zip:
  - lockcloud-frontend.zip  (Next.js standalone + static + public)
  - lockcloud-backend.zip   (Flask 后端 + .env + db + 蓝图)
两个包内部都不套额外目录,解压即用。

后端打包**不**包含:
  - fc/   FC 容器单独 docker build & push,走另一条部署链
  - logs/、tmp_*/ 运行时产物
  - __pycache__ 之类的缓存
"""

import os
import sys
import zipfile
import shutil
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "lockcloud-frontend"
BACKEND_DIR = ROOT / "backend"
DIST_DIR = ROOT / "dist"

STANDALONE_DIR = FRONTEND_DIR / ".next" / "standalone"
STATIC_DIR = FRONTEND_DIR / ".next" / "static"
PUBLIC_DIR = FRONTEND_DIR / "public"

# 后端需要打包的顶层文件
BACKEND_FILES = [
    "app.py",
    "wsgi.py",
    "config.py",
    "extensions.py",
    "exceptions.py",
    "validators.py",
    "gunicorn.conf.py",
    "requirements.txt",
    ".env",
]

# 后端需要打包的目录(每一项是 backend/ 下的一个子目录)
# 不进包:
#   fc/    单独走 docker 部署链
#   models/  insightface ONNX(1.4 GB),只在 FC 镜像和 smoke 脚本用,主 Flask 不碰
# 注:logs/ 是 Python module(logs/models.py 装 FileLog ORM),要打包;
#     里面的运行时 .log 文件靠 EXCLUDE_PATTERNS 排除
BACKEND_DIRS = [
    "admin",
    "auth",
    "constants",
    "file_requests",
    "files",
    "instance",       # SQLite DB 放这,生产部署解压会覆盖,看你需求决定要不要保留
    "logs",           # Python module(含 FileLog ORM),不是单纯日志目录
    "migrations",
    "scripts",
    "services",
    "tags",
]

# 排除模式(子串匹配 path.parts)
EXCLUDE_PATTERNS = {
    "__pycache__",
    ".pytest_cache",
    ".pyc",
    ".log",                 # 运行时 gunicorn_*.log / app.log,别打进包覆盖生产
    ".db-wal",              # SQLite WAL 临时文件,目标机会自己重建
    ".db-shm",              # SQLite 共享内存索引,同上
    "tmp_face_diagnosis",   # 调试产物
    "_tmp_",
    "diagnose_",            # scripts/diagnose_*.html 这类一次性 debug 产物
}


def should_exclude(path: Path) -> bool:
    parts = path.parts
    for pattern in EXCLUDE_PATTERNS:
        if any(pattern in p for p in parts):
            return True
    return False


def add_directory_to_zip(zf: zipfile.ZipFile, src: Path, arc_prefix: str = ""):
    """递归添加目录到 zip,arc_prefix 为 zip 内的路径前缀"""
    for item in sorted(src.rglob("*")):
        if not item.is_file():
            continue
        if should_exclude(item):
            continue
        rel = item.relative_to(src)
        arcname = f"{arc_prefix}/{rel}" if arc_prefix else str(rel)
        arcname = arcname.replace("\\", "/")
        zf.write(item, arcname)


def count_files(zf: zipfile.ZipFile) -> int:
    return len(zf.namelist())


def format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def build_frontend_zip():
    """打包前端 standalone 产物"""
    out = DIST_DIR / "lockcloud-frontend.zip"

    if not STANDALONE_DIR.exists():
        print(f"[错误] standalone 目录不存在: {STANDALONE_DIR}")
        print("       请先运行: cd lockcloud-frontend && npm run build")
        sys.exit(1)

    print("[前端] 开始打包...")
    file_count = 0

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        # 1) standalone 目录内容 → zip 根目录
        #    包含 server.js, package.json, .env.production, node_modules/, .next/server/
        add_directory_to_zip(zf, STANDALONE_DIR)

        # 2) static 文件 → .next/static/
        if STATIC_DIR.exists():
            add_directory_to_zip(zf, STATIC_DIR, ".next/static")
        else:
            print("  [警告] static 目录不存在,跳过")

        # 3) public 文件 → public/
        if PUBLIC_DIR.exists():
            add_directory_to_zip(zf, PUBLIC_DIR, "public")
        else:
            print("  [警告] public 目录不存在,跳过")

        file_count = count_files(zf)

    size = out.stat().st_size
    print(f"[前端] 完成: {out.name} ({format_size(size)}, {file_count} 文件)")
    return out


def build_backend_zip():
    """打包后端文件"""
    out = DIST_DIR / "lockcloud-backend.zip"

    # 检查 .env 是否存在
    env_file = BACKEND_DIR / ".env"
    if not env_file.exists():
        print(f"[警告] 后端 .env 不存在: {env_file}")
        print("       打包将不包含 .env,部署时需手动创建")

    print("[后端] 开始打包...")

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        # 1) 顶层文件
        for fname in BACKEND_FILES:
            fpath = BACKEND_DIR / fname
            if fpath.exists():
                zf.write(fpath, fname)
            else:
                print(f"  [跳过] {fname} 不存在")

        # 2) 子目录
        for dirname in BACKEND_DIRS:
            dirpath = BACKEND_DIR / dirname
            if dirpath.exists():
                add_directory_to_zip(zf, dirpath, dirname)
            else:
                print(f"  [跳过] {dirname}/ 不存在")

        file_count = count_files(zf)

    size = out.stat().st_size
    print(f"[后端] 完成: {out.name} ({format_size(size)}, {file_count} 文件)")
    return out


def main():
    print(f"LockCloud 部署打包 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"项目根目录: {ROOT}")
    print()

    DIST_DIR.mkdir(exist_ok=True)

    fe = build_frontend_zip()
    print()
    be = build_backend_zip()

    print()
    print("=" * 50)
    print("打包完成,产物位于 dist/ 目录:")
    print(f"  前端: {fe.name} ({format_size(fe.stat().st_size)})")
    print(f"  后端: {be.name} ({format_size(be.stat().st_size)})")


if __name__ == "__main__":
    main()
