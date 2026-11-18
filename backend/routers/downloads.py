"""/api/downloads：打包下载。交给媒体 FC（/jobs/zip）打不压缩的 zip，放到 media/_downloads/{id}.zip，
桶的生命周期规则 1 天后删。FC 做完回调 /api/files/internal/job-result（X-Media-Token）。

zip 里按活动分文件夹（"日期 活动名"，没有日期的放"未分类"），文件名用显示名，重名加 " (2)"。
只有一个文件时前端直接用原文件签名地址，不走这里。
"""
import hmac
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from config import settings
from constants.activity_types import display_name_for
from database import get_db
from deps import Body, body, jwt_identity
from errors import ApiError, guarded, json_response
from files.models import Download, File
from services import fc_jobs, media
from services.storage import storage

router = APIRouter()
log = logging.getLogger(__name__)

MAX_FILES = 500
MAX_BYTES = 8 * 1024 ** 3        # FC 磁盘 10 GB，留余量
ZIP_PREFIX = 'media/_downloads/'
ZIP_TTL = timedelta(days=1)      # 和桶的生命周期规则一致
URL_SECONDS = 3600
_UNSAFE = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def zip_key(download_id: str) -> str:
    return f'{ZIP_PREFIX}{download_id}.zip'


def _clean(name: str, fallback: str) -> str:
    name = _UNSAFE.sub('_', name or '').strip().strip('.')
    return name[:150] or fallback


def folder_name(f: File) -> str:
    if not f.activity_date:
        return '未分类'
    return _clean(f'{f.activity_date.isoformat()} {f.activity_name or display_name_for(f.activity_type)}',
                  f.activity_date.isoformat())


def zip_items(files: list) -> list:
    """[{"key", "name"}]：按活动分文件夹，显示名，同一文件夹里重名（不分大小写）加 " (2)"、" (3)"。"""
    used, items = set(), []
    for f in files:
        folder = folder_name(f)
        stem, ext = os.path.splitext(_clean(media.display_name(f), f'file-{f.id}'))
        name, n = f'{folder}/{stem}{ext}', 2
        while name.lower() in used:
            name = f'{folder}/{stem} ({n}){ext}'
            n += 1
        used.add(name.lower())
        items.append({'key': f.s3_key, 'name': name})
    return items


def download_json(d: Download) -> dict:
    status, url, expires_at = d.status, None, None
    if status == 'ready' and d.finished_at:
        gone_at = d.finished_at + ZIP_TTL
        left = int((gone_at - datetime.utcnow()).total_seconds())
        if left <= 60:
            status = 'expired'
        else:
            seconds = min(URL_SECONDS, left)
            url = storage.sign_get(zip_key(d.id), seconds, filename=f'{d.name}.zip', disposition='attachment')
            expires_at = (datetime.utcnow() + timedelta(seconds=seconds)).replace(microsecond=0).isoformat()
    return {
        'id': d.id, 'status': status, 'file_count': d.file_count,
        'size': d.zip_size if d.zip_size is not None else d.size,
        'name': d.name, 'url': url, 'expires_at': expires_at,
        'created_at': d.created_at.isoformat(),
        'error': d.error if status == 'failed' else None,
    }


@router.post('/api/downloads', status_code=201)
@guarded('创建打包任务失败，请稍后重试')
def create_download(identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                    db: Session = Depends(get_db)):
    user_id = int(identity)
    data = payload.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    ids = data.get('file_ids')
    if not isinstance(ids, list) or not ids or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
        raise ApiError('VALIDATION_001', 'file_ids 必须是非空的整数数组')
    ids = list(dict.fromkeys(ids))
    if len(ids) > MAX_FILES:
        raise ApiError('DOWNLOAD_002', f'单次最多下载 {MAX_FILES} 个文件')

    found = {f.id: f for f in db.query(File).filter(File.id.in_(ids)).all()}
    missing = [i for i in ids if i not in found]
    if missing:
        raise ApiError('FILE_001', '文件不存在', 404, details={'missing': missing})
    total = sum(int(f.size or 0) for f in found.values())
    if total > MAX_BYTES:
        raise ApiError('DOWNLOAD_002', '单次下载不能超过 8 GB，请分批下载')

    files = sorted(found.values(), key=lambda f: (f.activity_date is None, f.activity_date or datetime.min.date(),
                                                  f.activity_name or '', media.display_name(f).lower(), f.id))
    name = _clean(data.get('name') if isinstance(data.get('name'), str) else '',
                  f'LockCloud {datetime.now().strftime("%Y-%m-%d")}')[:100]
    d = Download(id='d_' + uuid.uuid4().hex, user_id=user_id, name=name, status='pending',
                 file_ids=json.dumps(ids), file_count=len(ids), size=total)
    db.add(d)
    db.commit()

    try:
        fc_jobs.invoke('/jobs/zip', {'id': d.id, 'items': zip_items(files), 'out': zip_key(d.id)})
    except Exception as e:
        log.error(f'Zip job {d.id} not started: {e}')
        d.status = 'failed'
        d.error = f'打包服务暂时不可用: {e}'
        d.finished_at = datetime.utcnow()
        db.commit()
    return json_response({'download': download_json(d)}, 201)


@router.get('/api/downloads/{download_id}')
@guarded('获取打包任务失败，请稍后重试')
def get_download(download_id: str, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """前端每 2 秒轮询一次。只有发起人能查。"""
    d = db.get(Download, download_id)
    if not d:
        raise ApiError('DOWNLOAD_001', '下载不存在或已过期', 404)
    if d.user_id != int(identity):
        raise ApiError('DOWNLOAD_003', '无法查看此下载', 403)
    return json_response({'download': download_json(d)})


@router.post('/api/files/internal/job-result')
def job_result(request: Request, payload: Body = Depends(body), db: Session = Depends(get_db)):
    """媒体 FC 的任务回调（X-Media-Token，不限流）：{"job": "zip", "id", "status", "size", "error"}。"""
    expected = settings.media_callback_token or ''
    token = request.headers.get('X-Media-Token', '')
    if not expected or not hmac.compare_digest(token, expected):
        raise ApiError('UNAUTHORIZED', 'invalid token', 401)
    data = payload.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    if data.get('job') != 'zip':
        raise ApiError('VALIDATION_001', '不认识的任务类型')
    status = data.get('status')
    if status not in ('running', 'ready', 'failed'):
        raise ApiError('VALIDATION_001', 'status 只能是 running、ready、failed')
    d = db.get(Download, str(data.get('id') or ''))
    if not d:
        raise ApiError('DOWNLOAD_001', '下载不存在或已过期', 404)
    if d.status in ('ready', 'failed') and status == 'running':
        return json_response({'success': True})   # 迟到的 running 不回退
    d.status = status
    if status == 'ready':
        d.zip_size = int(data.get('size') or 0) or None
        d.error = None
        d.finished_at = datetime.utcnow()
    elif status == 'failed':
        d.error = str(data.get('error') or '打包失败')[:1000]
        d.finished_at = datetime.utcnow()
    db.commit()
    log.info(f'Zip job {d.id}: {status}')
    return json_response({'success': True})
