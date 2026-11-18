"""/api/requests：修改申请。不是上传者想改、删文件或整个活动目录时，发申请给上传者（目录的最早上传者）处理。"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from auth.models import User
from constants.activity_types import ACTIVITY_TYPE_VALUES
from database import get_db
from deps import Body, arg, body, jwt_identity
from errors import ApiError, guarded, json_response
from files.models import File
from files.request_models import FileRequest
from services import beat_fix, file_cleanup
from services.tag_service import tag_service

router = APIRouter(prefix='/api/requests')
log = logging.getLogger(__name__)


def _pending_for(db: Session, file_id, requester_id: int):
    return db.query(FileRequest).filter_by(file_id=file_id, requester_id=requester_id, status='pending').first()


_BAD_FILENAME_CHARS = ('/', '\\', ':', '*', '?', '"', '<', '>', '|')


def _check_changes(changes) -> None:
    """修改申请的内容，规则和直接改（PATCH /api/files/{id}）一样。

    发申请时查一次；同意时再查一次（库里可能有以前没查就存进去的申请），不合规的申请只能拒绝。
    """
    if not isinstance(changes, dict):
        raise ApiError('VALIDATION_001', '修改内容格式不对')
    if 'activity_date' in changes:
        try:
            datetime.fromisoformat(changes['activity_date'].strip())
        except (AttributeError, ValueError):
            raise ApiError('FILE_007', '活动日期格式无效')
    activity_type = changes.get('activity_type')
    if activity_type is not None and activity_type != '' and activity_type not in ACTIVITY_TYPE_VALUES:
        raise ApiError('FILE_008', f'活动类型无效。有效选项: {", ".join(sorted(ACTIVITY_TYPE_VALUES))}')
    activity_name = changes.get('activity_name')
    if activity_name is not None and (not isinstance(activity_name, str) or len(activity_name.strip()) > 200):
        raise ApiError('VALIDATION_001', '活动名称不能超过 200 个字符')
    filename = changes.get('filename')
    if filename is not None and filename != '':
        if not isinstance(filename, str) or not filename.strip():
            raise ApiError('VALIDATION_001', '文件名不能为空')
        if len(filename.strip()) > 255:
            raise ApiError('VALIDATION_001', '文件名不能超过 255 个字符')
        if any(c in filename for c in _BAD_FILENAME_CHARS):
            raise ApiError('VALIDATION_001', f'文件名包含非法字符: {", ".join(_BAD_FILENAME_CHARS)}')
    tags = changes.get('free_tags')
    if tags is not None and (not isinstance(tags, list) or any(not isinstance(t, str) for t in tags)):
        raise ApiError('VALIDATION_001', 'free_tags 必须是数组')


@router.post('')
@guarded('创建请求失败')
def create_request(identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                   db: Session = Depends(get_db)):
    """对别人的文件发起修改（edit，带 proposed_changes）、删除（delete）或八拍修改（beats，
    proposed_changes = {"ones": [秒, …]}）申请。"""
    current_user_id = int(identity)
    data = payload.get_json()
    if not data:
        raise ApiError('VALIDATION_001', '请求数据不能为空')
    file_id = data.get('file_id')
    request_type = data.get('request_type')
    proposed_changes = data.get('proposed_changes')
    message = data.get('message', '').strip()
    if not file_id or not request_type:
        raise ApiError('VALIDATION_001', '缺少必填字段')
    if request_type not in ['edit', 'delete', 'beats']:
        raise ApiError('VALIDATION_001', '无效的请求类型')
    if request_type == 'edit' and proposed_changes is not None:
        _check_changes(proposed_changes)
    if request_type == 'beats':
        proposed_changes = {'ones': beat_fix.clean((proposed_changes or {}).get('ones')
                                                   if isinstance(proposed_changes, dict) else None)}

    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    if file.uploader_id == current_user_id:
        raise ApiError('REQUEST_001', '不能对自己的文件发起申请')
    if _pending_for(db, file_id, current_user_id):
        raise ApiError('REQUEST_002', '已有待处理的申请')
    if request_type == 'beats':
        beat_fix.check_file(file)

    file_request = FileRequest(
        file_id=file_id,
        requester_id=current_user_id,
        owner_id=file.uploader_id,
        request_type=request_type,
        proposed_changes=proposed_changes if request_type in ('edit', 'beats') else None,
        message=message or None,
    )
    db.add(file_request)
    db.commit()
    log.info(f'User {current_user_id} created {request_type} request for file {file_id}')
    return json_response({'success': True, 'message': '申请已发送', 'request': file_request.to_dict()}, 201)


def _list(db: Session, request: Request, **filters):
    status = arg(request, 'status', '').strip()
    query = db.query(FileRequest).filter_by(**filters)
    if status:
        query = query.filter_by(status=status)
    requests_list = query.order_by(FileRequest.created_at.desc()).all()
    return json_response({'success': True,
                          'requests': [r.to_dict(include_file=True, include_users=True) for r in requests_list]})


@router.get('/received')
@guarded('获取请求失败')
def get_received_requests(request: Request, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """别人发给我的申请，?status= 可筛。"""
    return _list(db, request, owner_id=int(identity))


@router.get('/sent')
@guarded('获取请求失败')
def get_sent_requests(request: Request, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """我发出的申请，?status= 可筛。"""
    return _list(db, request, requester_id=int(identity))


@router.get('/pending-count')
@guarded('获取数量失败')
def get_pending_count(identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    count = db.query(FileRequest).filter_by(owner_id=int(identity), status='pending').count()
    return json_response({'success': True, 'count': count})


def _load_for_decision(db: Session, request_id: int, current_user_id: int) -> FileRequest:
    """取申请并检查：存在、是上传者或管理员、还没处理。"""
    current_user = db.get(User, current_user_id)
    file_request = db.get(FileRequest, request_id)
    if not file_request:
        raise ApiError('REQUEST_003', '申请不存在', 404)
    is_admin = current_user and current_user.is_admin
    if file_request.owner_id != current_user_id and not is_admin:
        raise ApiError('REQUEST_004', '你没有处理此申请的权限', 403)
    if file_request.status != 'pending':
        raise ApiError('REQUEST_005', '此申请已处理')
    return file_request


def _response_message(payload: Body) -> str:
    # 不带请求体（或不是 JSON）当成 {}：Flask 版这里会 500
    data = payload.get_json(silent=True) or {}
    return data.get('response_message', '').strip()


@router.post('/{request_id:int}/approve')
@guarded('处理请求失败')
def approve_request(request_id: int, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                    db: Session = Depends(get_db)):
    """批准：改活动目录、改文件信息、改八拍或删文件。"""
    current_user_id = int(identity)
    file_request = _load_for_decision(db, request_id, current_user_id)
    response_message = _response_message(payload)

    if file_request.request_type == 'directory_edit':
        dir_info = file_request.directory_info or {}
        changes = file_request.proposed_changes or {}
        activity_date = datetime.fromisoformat(dir_info['activity_date']).date()
        files_to_update = db.query(File).filter(
            File.activity_date == activity_date,
            File.activity_name == dir_info['activity_name'],
            File.activity_type == dir_info['activity_type'],
        ).all()
        if not files_to_update:
            file_request.status = 'rejected'
            file_request.response_message = '活动已不存在'
            db.commit()
            raise ApiError('DIR_001', '活动已不存在', 404)

        updated_count = 0
        for file in files_to_update:
            if changes.get('new_activity_name'):
                file.activity_name = changes['new_activity_name']
            if changes.get('new_activity_type'):
                file.activity_type = changes['new_activity_type']
                file.refresh_directory()
            updated_count += 1
        file_request.status = 'approved'
        file_request.response_message = response_message or None
        db.commit()
        log.info(f'Directory request {request_id} approved by user {current_user_id}, updated {updated_count} files')
        return json_response({'success': True, 'message': f'申请已同意，已更新 {updated_count} 个文件',
                              'request': file_request.to_dict(), 'updated_count': updated_count})

    file = file_request.file
    if not file:
        file_request.status = 'rejected'
        file_request.response_message = '文件已不存在'
        db.commit()
        raise ApiError('FILE_001', '文件已不存在', 404)

    if file_request.request_type == 'delete':
        # 进回收站，申请留着（状态 approved）；30 天后彻底删除时这条申请的 file_id 置空
        file_cleanup.soft_delete(file, current_user_id)

    elif file_request.request_type == 'beats':
        beat_fix.save(db, file.id, beat_fix.clean((file_request.proposed_changes or {}).get('ones')), current_user_id)

    elif file_request.request_type == 'edit':
        changes = dict(file_request.proposed_changes or {})
        _check_changes(changes)
        location_changed = False
        if 'activity_date' in changes:
            new_date = datetime.fromisoformat(changes['activity_date'].strip()).date()
            if file.activity_date != new_date:
                file.activity_date = new_date
                location_changed = True
        if 'activity_type' in changes:
            new_type = changes['activity_type'] or None   # 空 = 未分类，和直接改一样
            if file.activity_type != new_type:
                file.activity_type = new_type
                location_changed = True
        if 'activity_name' in changes:
            file.activity_name = (changes['activity_name'] or '').strip() or None
        if 'filename' in changes and changes['filename']:
            new_filename = changes['filename'].strip()
            if file.filename != new_filename:
                file.filename = new_filename
                location_changed = True

        # 目录只是数据库里的分类，桶里的文件不动。
        # 查重必须在动标签之前：标签服务内部会提交，之后再回滚就撤不回前面改的文件名和活动了
        if location_changed:
            file.refresh_directory()
            if db.query(File).filter(File.directory == file.directory, File.filename == file.filename,
                                     File.id != file.id).first():
                conflicting = file.filename
                db.rollback()
                raise ApiError('FILE_005', f'已有同名文件「{conflicting}」')

        if 'free_tags' in changes:
            tag_service.sync_file_tags(db, file, changes['free_tags'] or [], current_user_id)

    file_request.status = 'approved'
    file_request.response_message = response_message or None
    db.commit()
    log.info(f'Request {request_id} approved by user {current_user_id}')
    return json_response({'success': True, 'message': '申请已同意', 'request': file_request.to_dict()})


@router.post('/{request_id:int}/reject')
@guarded('处理请求失败')
def reject_request(request_id: int, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                   db: Session = Depends(get_db)):
    current_user_id = int(identity)
    file_request = _load_for_decision(db, request_id, current_user_id)
    file_request.status = 'rejected'
    file_request.response_message = _response_message(payload) or None
    db.commit()
    log.info(f'Request {request_id} rejected by user {current_user_id}')
    return json_response({'success': True, 'message': '申请已拒绝', 'request': file_request.to_dict()})


@router.post('/directory')
@guarded('创建请求失败')
def create_directory_request(identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                             db: Session = Depends(get_db)):
    """对别人的活动目录发起改名 / 改类型申请（proposed_changes: new_activity_name、new_activity_type）。"""
    current_user_id = int(identity)
    data = payload.get_json()
    if not data:
        raise ApiError('VALIDATION_001', '请求数据不能为空')
    activity_date_str = data.get('activity_date', '').strip()
    activity_name = data.get('activity_name', '').strip()
    activity_type = data.get('activity_type', '').strip()
    proposed_changes = data.get('proposed_changes', {})
    message = data.get('message', '').strip()
    if not activity_date_str or not activity_name or not activity_type:
        raise ApiError('VALIDATION_001', '缺少必填字段')
    if not proposed_changes.get('new_activity_name') and not proposed_changes.get('new_activity_type'):
        raise ApiError('VALIDATION_001', '请提供要修改的内容')
    try:
        activity_date = datetime.fromisoformat(activity_date_str).date()
    except ValueError:
        raise ApiError('VALIDATION_001', '日期格式无效')
    if proposed_changes.get('new_activity_type') and proposed_changes['new_activity_type'] not in ACTIVITY_TYPE_VALUES:
        raise ApiError('VALIDATION_001', f'无效的活动类型。有效选项: {", ".join(sorted(ACTIVITY_TYPE_VALUES))}')

    first_file = db.query(File).filter(
        File.activity_date == activity_date, File.activity_name == activity_name, File.activity_type == activity_type,
    ).order_by(File.uploaded_at.asc()).first()
    if not first_file:
        raise ApiError('DIR_001', '活动不存在', 404)
    owner_id = first_file.uploader_id
    if owner_id == current_user_id:
        raise ApiError('REQUEST_001', '不能对自己的活动发起申请')

    pending = db.query(FileRequest).filter_by(requester_id=current_user_id, request_type='directory_edit',
                                              status='pending').all()
    for req in pending:
        info = req.directory_info or {}
        if (info.get('activity_date') == activity_date_str and info.get('activity_name') == activity_name
                and info.get('activity_type') == activity_type):
            raise ApiError('REQUEST_002', '此活动已有待处理的编辑申请')

    file_request = FileRequest(
        file_id=None,
        requester_id=current_user_id,
        owner_id=owner_id,
        request_type='directory_edit',
        proposed_changes=proposed_changes,
        directory_info={'activity_date': activity_date_str, 'activity_name': activity_name,
                        'activity_type': activity_type},
        message=message or None,
    )
    db.add(file_request)
    db.commit()
    log.info(f'User {current_user_id} created directory edit request for {activity_name}')
    return json_response({'success': True, 'message': '编辑申请已发送', 'request': file_request.to_dict()}, 201)


@router.post('/batch')
@guarded('批量创建请求失败')
def batch_create_requests(identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                          db: Session = Depends(get_db)):
    """对多个文件各发一条修改申请，同样的 proposed_changes。"""
    current_user_id = int(identity)
    data = payload.get_json()
    if not data:
        raise ApiError('VALIDATION_001', '请求数据不能为空')
    file_ids = data.get('file_ids', [])
    proposed_changes = data.get('proposed_changes', {})
    if not file_ids:
        raise ApiError('VALIDATION_001', '文件ID列表不能为空')
    if not proposed_changes:
        raise ApiError('VALIDATION_001', '修改内容不能为空')
    if len(file_ids) > 100:
        raise ApiError('BATCH_002', '单次最多操作 100 个文件')
    _check_changes(proposed_changes)
    message = data.get('message')
    message = message.strip() if isinstance(message, str) else ''

    succeeded, failed = [], []
    file_map = {f.id: f for f in db.query(File).filter(File.id.in_(file_ids)).all()}
    for file_id in file_ids:
        file = file_map.get(file_id)
        if not file:
            failed.append({'file_id': file_id, 'error': '文件不存在'})
            continue
        if file.uploader_id == current_user_id:
            failed.append({'file_id': file_id, 'error': '不能对自己的文件发起申请'})
            continue
        if _pending_for(db, file_id, current_user_id):
            failed.append({'file_id': file_id, 'error': '已有待处理的申请'})
            continue
        try:
            db.add(FileRequest(file_id=file_id, requester_id=current_user_id, owner_id=file.uploader_id,
                               request_type='edit', proposed_changes=proposed_changes, message=message or None))
            succeeded.append(file_id)
        except Exception as e:
            log.error(f'Error creating request for file {file_id}: {e}')
            failed.append({'file_id': file_id, 'error': str(e)})
    if succeeded:
        db.commit()

    results = {'succeeded': succeeded, 'failed': failed}
    if not failed:
        return json_response({'success': True, 'message': f'已发送 {len(succeeded)} 个编辑申请', 'results': results})
    if not succeeded:
        return json_response({'success': False, 'message': '申请均未发送成功', 'results': results}, 400)
    return json_response({'success': False, 'code': 'PARTIAL_SUCCESS',
                          'message': f'已发送 {len(succeeded)} 个，{len(failed)} 个失败', 'results': results}, 207)
