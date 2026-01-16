#!/usr/bin/env python3
"""
Database Backup Script for LockCloud
Backs up the database and uploads to S3 public bucket

Usage:
    python scripts/backup_database.py [--keep-local] [--type full|incremental]

Environment Variables Required:
    - DATABASE_URL: Database connection string
    - AWS_ACCESS_KEY_ID: S3 access key
    - AWS_SECRET_ACCESS_KEY: S3 secret key
    - S3_PUBLIC_BUCKET: Public bucket name (default: funkandlove-cloud-public)

Cron Example (daily at 3 AM):
    0 3 * * * cd /path/to/backend && /path/to/venv/bin/python scripts/backup_database.py >> /var/log/lockcloud_backup.log 2>&1
"""

import os
import sys
import argparse
import subprocess
import gzip
import shutil
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import boto3
from botocore.client import Config as BotoConfig


def get_s3_client():
    """Create S3 client"""
    return boto3.client(
        's3',
        endpoint_url=os.environ.get('S3_ENDPOINT', 'https://s3.bitiful.net'),
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
        region_name=os.environ.get('AWS_REGION', 'us-east-1'),
        config=BotoConfig(
            signature_version='s3v4',
            s3={'addressing_style': 'virtual'}
        )
    )


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
    
    # Copy database file
    shutil.copy2(db_file, backup_path)
    
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


def upload_to_s3(file_path: Path, s3_client, bucket: str) -> str:
    """Upload backup file to S3"""
    date_folder = datetime.utcnow().strftime('%Y/%m')
    s3_key = f"backups/database/{date_folder}/{file_path.name}"
    
    print(f"[...] Uploading to s3://{bucket}/{s3_key}")
    
    s3_client.upload_file(
        str(file_path),
        bucket,
        s3_key,
        ExtraArgs={
            'ContentType': 'application/gzip'
        }
    )
    
    print(f"[OK] Uploaded to S3: {s3_key}")
    return s3_key


def cleanup_old_backups(s3_client, bucket: str, keep_days: int = 30):
    """Delete backups older than keep_days"""
    from datetime import timedelta
    
    prefix = "backups/database/"
    cutoff_date = datetime.utcnow() - timedelta(days=keep_days)
    
    print(f"[...] Cleaning up backups older than {keep_days} days")
    
    paginator = s3_client.get_paginator('list_objects_v2')
    deleted_count = 0
    
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        if 'Contents' not in page:
            continue
        
        for obj in page['Contents']:
            if obj['LastModified'].replace(tzinfo=None) < cutoff_date:
                s3_client.delete_object(Bucket=bucket, Key=obj['Key'])
                deleted_count += 1
                print(f"  Deleted: {obj['Key']}")
    
    print(f"[OK] Cleaned up {deleted_count} old backups")


def main():
    parser = argparse.ArgumentParser(description='Backup LockCloud database to S3')
    parser.add_argument('--keep-local', action='store_true', help='Keep local backup file after upload')
    parser.add_argument('--keep-days', type=int, default=30, help='Days to keep old backups (default: 30)')
    parser.add_argument('--no-cleanup', action='store_true', help='Skip cleanup of old backups')
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
        
        # Upload to S3
        s3_client = get_s3_client()
        bucket = os.environ.get('S3_PUBLIC_BUCKET', 'funkandlove-cloud-public')
        
        s3_key = upload_to_s3(backup_path, s3_client, bucket)
        
        # Cleanup old backups
        if not args.no_cleanup:
            cleanup_old_backups(s3_client, bucket, args.keep_days)
        
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
