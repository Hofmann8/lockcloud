"""/api/trash：回收站。删除文件先进这里，30 天后每日任务彻底清掉（services/file_cleanup.py）。

- 列表：管理员看全部，其他人看自己上传的和自己删的；
- 恢复：上传者、删除者、管理员；同目录已有同名文件时 409 TRASH_002；
- 彻底删除：上传者、管理员；清空：管理员。
"""
import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth.models import User
from database import get_db, paginate
from deps import arg, jwt_identity
from errors import ApiError, guarded, json_response
from files.models import INCLUDE_DELETED, File
from routers.files import with_display
from services import file_cleanup

router = APIRouter(prefix='/api/trash')
log = logging.getLogger(__name__)


def _trashed_query(db: Session):
    # Live Photo 的动态部分不单列：跟着照片恢复、删除
    return db.query(File).execution_options(**INCLUDE_DELETED).filter(File.deleted_at.isnot(None),
                                                                      File.live_photo_id.is_(None))


def _load(db: Session, file_id: int) -> File:
    file = _trashed_query(db).filter(File.id == file_id).first()
    if not file:
        raise ApiError('TRASH_001', '文件不在回收站中', 404)
    return file


def _user(db: Session, identity: str) -> User | None:
    return db.get(User, int(identity))


def trash_item(db: Session, file: File, users: dict | None = None) -> dict:
    data = with_display(file)
    deleter = (users or {}).get(file.deleted_by) if users is not None else db.get(User, file.deleted_by or 0)
    data['deleted_at'] = file.deleted_at.isoformat()
    data['deleted_by'] = {'id': deleter.id, 'name': deleter.name} if deleter else None
    data['purge_at'] = file_cleanup.purge_at(file).isoformat()
    return data


@router.get('')
@guarded('获取回收站失败，请稍后重试')
def list_trash(request: Request, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    user = _user(db, identity)
    page = max(1, arg(request, 'page', 1, type=int))
    per_page = max(1, min(arg(request, 'per_page', 50, type=int), 100))
    query = _trashed_query(db)
    if not (user and user.is_admin):
        uid = int(identity)
        query = query.filter(or_(File.uploader_id == uid, File.deleted_by == uid))
    pagination = paginate(query.order_by(File.deleted_at.desc(), File.id.desc()), page, per_page)
    ids = {f.deleted_by for f in pagination.items if f.deleted_by}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(ids)).all()} if ids else {}
    return json_response({'files': [trash_item(db, f, users) for f in pagination.items],
                          'pagination': pagination.meta()})


@router.post('/{file_id:int}/restore')
@guarded('恢复文件失败，请稍后重试')
def restore(file_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    user = _user(db, identity)
    uid = int(identity)
    file = _load(db, file_id)
    if not (file.uploader_id == uid or file.deleted_by == uid or (user and user.is_admin)):
        raise ApiError('TRASH_003', '你没有操作此文件的权限', 403)
    # 查重和上传、改名同一规则：同一目录（活动类型/年/月）里不能有同名文件
    existing = db.query(File).filter(File.directory == file.directory, File.filename == file.filename,
                                     File.id != file.id).first()
    if existing:
        raise ApiError('TRASH_002', f'已有同名文件「{file.filename}」', 409, details={'existing_id': existing.id})
    file_cleanup.restore(file)
    db.commit()
    log.info(f'User {uid} restored file {file_id}')
    return json_response({'file': with_display(file)})


@router.delete('/{file_id:int}')
@guarded('彻底删除失败，请稍后重试')
def purge_one(file_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    user = _user(db, identity)
    file = _load(db, file_id)
    if file.uploader_id != int(identity) and not (user and user.is_admin):
        raise ApiError('TRASH_003', '你没有操作此文件的权限', 403)
    try:
        file_cleanup.purge(db, file)
    except Exception as e:
        db.rollback()
        log.error(f'Purge of file {file_id} failed: {e}')
        raise ApiError('S3_001', '删除文件失败', 500)
    db.commit()
    log.info(f'User {identity} purged file {file_id}')
    return json_response({'success': True})


@router.post('/empty')
@guarded('清空回收站失败，请稍后重试')
def empty_trash(identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    user = _user(db, identity)
    if not (user and user.is_admin):
        raise ApiError('TRASH_003', '仅管理员可清空回收站', 403)
    purged, failed = file_cleanup.purge_expired(db, days=0)
    log.info(f'Admin {identity} emptied trash: {purged} purged, {failed} failed')
    return json_response({'purged': purged})
