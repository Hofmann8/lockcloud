#!/usr/bin/env python3
"""
Database Backup Script for LockCloud
Backs up the database and uploads to the private OSS bucket (lock-cloud, backups/db/)

Usage:
    python scripts/backup_database.py [--keep-local] [--type full|incremental]

Environment Variables Required:
    - DATABASE_URL: Database connection string
    - OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET / OSS_ENDPOINT (OSS_INTERNAL_ENDPOINT 线上填内网)

30 天前的备份由桶的生命周期规则自动删除（backups/ 前缀），脚本不再自己清。

Cron Example (daily at 3 AM):
    0 3 * * * cd /path/to/backend && /path/to/venv/bin/python scripts/backup_database.py >> /var/log/lockcloud_backup.log 2>&1
"""

import os
import sys
import argparse
import subprocess
import gzip
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from services.storage import BACKUP_PREFIX, storage


def backup_sqlite(db_path: str, output_dir: Path) -> Path:
    """Backup SQLite database"""
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    backup_name = f"lockcloud_sqlite_{timestamp}.db"
    backup_path = output_dir / backup_name
    
    # Resolve db_path
    db_file = Path(db_path)
    backend_dir = Path(__file__).parent.parent
    
    if not db_file.is_absolute():
        # Flask puts SQLite in instance/ folder by default
        # Try instance/ first, then backend root
        instance_path = backend_dir / 'instance' / db_path
        root_path = backend_dir / db_path
        
        if instance_path.exists():
            db_file = instance_path
        elif root_path.exists():
            db_file = root_path
        else:
            db_file = instance_path  # Will fail with clear error
    
    if not db_file.exists():
        raise FileNotFoundError(f"Database file not found: {db_file}")
    
    print(f"[...] Backing up: {db_file}")
    
    # 库开着 WAL，直接复制文件会漏掉还在 -wal 里的提交；用 SQLite 的备份接口拿一致的快照
    src = sqlite3.connect(str(db_file))
    dst = sqlite3.connect(str(backup_path))
    src.backup(dst)
    dst.close()
    src.close()
    
    # Compress
    compressed_path = Path(str(backup_path) + '.gz')
    with open(backup_path, 'rb') as f_in:
        with gzip.open(compressed_path, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    
    # Remove uncompressed temp file
    backup_path.unlink()
    
    print(f"[OK] SQLite backup created: {compressed_path}")
    return compressed_path


def backup_postgresql(db_url: str, output_dir: Path) -> Path:
    """Backup PostgreSQL database using pg_dump"""
    from urllib.parse import urlparse
    
    parsed = urlparse(db_url)
    
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    backup_name = f"lockcloud_postgres_{timestamp}.sql.gz"
    backup_path = output_dir / backup_name
    
    # Build pg_dump command
    env = os.environ.copy()
    env['PGPASSWORD'] = parsed.password or ''
    
    cmd = [
        'pg_dump',
        '-h', parsed.hostname or 'localhost',
        '-p', str(parsed.port or 5432),
        '-U', parsed.username or 'postgres',
        '-d', parsed.path.lstrip('/'),
        '--no-owner',
        '--no-acl',
        '-F', 'p'  # Plain text format
    ]
    
    # Run pg_dump and compress output
    with gzip.open(backup_path, 'wt') as f_out:
        result = subprocess.run(
            cmd,
            env=env,
            stdout=f_out,
            stderr=subprocess.PIPE,
            text=True
        )
    
    if result.returncode != 0:
        raise Exception(f"pg_dump failed: {result.stderr}")
    
    print(f"[OK] PostgreSQL backup created: {backup_path}")
    return backup_path


def backup_mysql(db_url: str, output_dir: Path) -> Path:
    """Backup MySQL database using mysqldump"""
    from urllib.parse import urlparse
    
    parsed = urlparse(db_url)
    
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    backup_name = f"lockcloud_mysql_{timestamp}.sql.gz"
    backup_path = output_dir / backup_name
    
    cmd = [
        'mysqldump',
        '-h', parsed.hostname or 'localhost',
        '-P', str(parsed.port or 3306),
        '-u', parsed.username or 'root',
        f'-p{parsed.password or ""}',
        '--single-transaction',
        '--routines',
        '--triggers',
        parsed.path.lstrip('/')
    ]
    
    # Run mysqldump and compress output
    with gzip.open(backup_path, 'wt') as f_out:
        result = subprocess.run(
            cmd,
            stdout=f_out,
            stderr=subprocess.PIPE,
            text=True
        )
    
    if result.returncode != 0:
        raise Exception(f"mysqldump failed: {result.stderr}")
    
    print(f"[OK] MySQL backup created: {backup_path}")
    return backup_path


def upload_backup(file_path: Path) -> str:
    """传到私有桶 backups/db/{YYYY}/{MM}/ 下"""
    key = f"{BACKUP_PREFIX}{datetime.utcnow().strftime('%Y/%m')}/{file_path.name}"
    print(f"[...] Uploading to oss://{storage.bucket_name}/{key}")
    storage.put_file(key, str(file_path), content_type='application/gzip')
    print(f"[OK] Uploaded: {key}")
    return key


def main():
    parser = argparse.ArgumentParser(description='Backup LockCloud database to S3')
    parser.add_argument('--keep-local', action='store_true', help='Keep local backup file after upload')
    args = parser.parse_args()
    
    print("=" * 60)
    print(f"LockCloud Database Backup - {datetime.utcnow().isoformat()}")
    print("=" * 60)
    
    # Get database URL
    db_url = os.environ.get('DATABASE_URL', '')
    if not db_url:
        print("[ERROR] DATABASE_URL not set")
        sys.exit(1)
    
    # Create temp directory for backups (cross-platform)
    import tempfile
    output_dir = Path(tempfile.gettempdir()) / 'lockcloud_backups'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Determine database type and backup
        if db_url.startswith('sqlite'):
            # Extract path from sqlite:///path or sqlite:////abs/path
            if db_url.startswith('sqlite:////'):
                # Absolute path (4 slashes on Unix)
                db_path = db_url[10:]
            elif db_url.startswith('sqlite:///'):
                # Relative path or Windows absolute (3 slashes)
                db_path = db_url[10:]
            else:
                db_path = db_url.replace('sqlite://', '')
            
            backup_path = backup_sqlite(db_path, output_dir)
        elif db_url.startswith('postgresql'):
            backup_path = backup_postgresql(db_url, output_dir)
        elif db_url.startswith('mysql'):
            backup_path = backup_mysql(db_url, output_dir)
        else:
            print(f"[ERROR] Unsupported database type: {db_url.split(':')[0]}")
            sys.exit(1)
        
        s3_key = upload_backup(backup_path)
        
        # Remove local file unless --keep-local
        if not args.keep_local:
            backup_path.unlink()
            print(f"[OK] Removed local backup file")
        
        print("=" * 60)
        print(f"[SUCCESS] Backup completed: {s3_key}")
        print("=" * 60)
        
    except Exception as e:
        print(f"[ERROR] Backup failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
