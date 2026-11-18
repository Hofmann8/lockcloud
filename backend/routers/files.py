"""/api/files：上传、登记、列表、详情、编辑、删除、目录树、文件名检查、相邻文件、标签、批量操作、活动目录。

地址（签名、HLS、媒体回调）在 routers/media.py，AI 搜索和人物在 routers/people.py。
"""
import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import extract, func, or_, select
from sqlalchemy.orm import Session

from auth.models import User
from constants.activity_types import ACTIVITY_TYPE_DISPLAY, ACTIVITY_TYPE_VALUES, display_name_for
from database import get_db, paginate
from deps import Body, arg, body, client_ip, jwt_identity, user_agent
from errors import ApiError, error_response, guarded, json_response
from files.models import INCLUDE_DELETED, File, FileTag, Tag, UploadTicket
from files.validators import validate_file_extension
from logs.models import FileLog, OperationType
from services import file_cleanup, formats, media
from services.file_naming_service import file_naming_service
from services.storage import is_file_key, new_file_key, storage
from services.tag_service import tag_service

router = APIRouter(prefix='/api/files')
log = logging.getLogger(__name__)

_TYPE_OPTIONS = ", ".join(sorted(ACTIVITY_TYPE_VALUES))
_MAX_UPLOAD = formats.MAX_UPLOAD  # 2GB


def _is_admin(db: Session, user_id: int) -> bool:
    user = db.get(User, user_id)
    return bool(user and user.is_admin)


def with_display(file: File) -> dict:
    """列表、详情里的文件：to_dict 之外补 activity_type_display（没有类型就不给这个键）。"""
    data = file.to_dict(include_uploader=True)
    if file.activity_type:
        data['activity_type_display'] = ACTIVITY_TYPE_DISPLAY.get(file.activity_type, file.activity_type)
    return data


_with_display = with_display


def _log(db: Session, request: Request, user_id: int, operation: OperationType, file_id, file_path) -> None:
    db.add(FileLog.create_log(user_id=user_id, operation=operation, file_id=file_id, file_path=file_path,
                              ip_address=client_ip(request), user_agent=user_agent(request)))


def _batch_result(succeeded: list, failed: list, ok_message: str, all_failed: str, partial_code: str | None,
                  partial_message: str, **extra):
    results = {'succeeded': succeeded, 'failed': failed}
    if not failed:
        return json_response({'success': True, 'message': ok_message, **extra, 'results': results})
    body = {'success': False}
    if not succeeded:
        if partial_code == 'TAG_004':
            body['code'] = 'TAG_004'
        return json_response({**body, 'message': all_failed, **extra, 'results': results}, 400)
    if partial_code:
        body['code'] = partial_code
    return json_response({**body, 'message': partial_message, **extra, 'results': results}, 207)


# ---------------------------------------------------------------- 上传


@router.get('/formats')
def get_formats(identity: str = Depends(jwt_identity)):
    """能上传的格式：[{ext, kind}]（kind = image / video / audio / other），前端选文件时就挡掉不支持的。"""
    int(identity)
    return json_response({'formats': formats.public_list(), 'max_size': formats.MAX_UPLOAD})


@router.post('/upload-url')
@guarded('无法开始上传，请稍后再试，请稍后重试')
def get_upload_url(request: Request, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                   db: Session = Depends(get_db)):
    """签一个直传 OSS 的 PUT 地址，记一张上传票据。文件名只存数据库，桶里的 key 是 files/{uuid}{.ext}。"""
    current_user_id = int(identity)
    data = payload.get_json()
    for field in ['original_filename', 'content_type', 'size', 'activity_date', 'activity_type']:
        if not data or field not in data:
            raise ApiError('VALIDATION_001', f'缺少必填字段: {field}')

    original_filename = data['original_filename'].strip()
    content_type = data['content_type'].strip()
    size = data['size']
    activity_date_str = data['activity_date'].strip()
    activity_type = data['activity_type'].strip()
    activity_name = data.get('activity_name', '').strip() if data.get('activity_name') else None
    custom_filename = data.get('custom_filename', '').strip() if data.get('custom_filename') else None

    try:
        activity_date = datetime.fromisoformat(activity_date_str).date()
    except ValueError:
        raise ApiError('FILE_007', '活动日期格式无效')
    if activity_type not in ACTIVITY_TYPE_VALUES:
        raise ApiError('FILE_008', f'活动类型无效。有效选项: {_TYPE_OPTIONS}')
    if activity_name and len(activity_name) > 200:
        raise ApiError('VALIDATION_001', '活动名称不能超过 200 个字符')

    try:
        file_extension = file_naming_service.extract_extension(original_filename)
    except ValueError as e:
        raise ApiError('VALIDATION_001', str(e))
    extension_validation = validate_file_extension(original_filename)
    if not extension_validation['valid']:
        log.warning(f'File extension validation failed: {extension_validation["message"]}')
        raise ApiError('VALIDATION_001', extension_validation['message'])

    if custom_filename:
        if re.search(r'[<>:"/\\|?*\x00-\x1f]', custom_filename):
            raise ApiError('VALIDATION_001', '文件名包含不支持的字符')
        if len(custom_filename) > 200:
            raise ApiError('VALIDATION_001', '文件名不能超过 200 个字符')

    if size > _MAX_UPLOAD:
        raise ApiError('VALIDATION_001', '文件不能超过 2 GB')

    # 显示用的文件名：有自定义名用自定义名，否则用原文件名。只存数据库，不进桶里的路径
    if custom_filename:
        generated_filename = f"{custom_filename}{file_extension}"
    else:
        generated_filename = original_filename.split('/')[-1].split('\\')[-1]

    existing_file = db.query(File).filter_by(activity_type=activity_type).filter(
        func.extract('year', File.activity_date) == activity_date.year,
        func.extract('month', File.activity_date) == activity_date.month,
        File.filename == generated_filename,
    ).first()
    if existing_file:
        log.warning(f'File already exists: {generated_filename}')
        raise ApiError('FILE_005', f'此活动中已有同名文件「{generated_filename}」')

    # 桶里和库里的 Content-Type 按格式表定：浏览器对 HEIC、mts 这类常报空的或怪的，不能照搬
    content_type = formats.content_type_of(original_filename) or content_type
    s3_key = new_file_key(file_extension)
    try:
        upload_url = storage.sign_put(s3_key, content_type, expires=3600)
    except Exception as e:
        log.error(f'Failed to generate upload URL: {e}')
        raise ApiError('S3_001', '无法开始上传，请稍后再试', 500)

    db.add(UploadTicket(s3_key=s3_key, user_id=current_user_id, filename=generated_filename,
                        content_type=content_type, size=int(size)))
    db.commit()
    log.info(f'Generated upload URL for user {current_user_id}: {s3_key} ({generated_filename})')
    # content_type 是签进地址里的那个，PUT 时必须带它
    return json_response({'success': True, 'upload_url': upload_url, 's3_key': s3_key, 'content_type': content_type,
                          'generated_filename': generated_filename, 'expires_in': 3600})


@router.post('/confirm', status_code=201)
@guarded('保存文件信息失败，请稍后重试', code='FILE_004')
def confirm_upload(request: Request, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                   db: Session = Depends(get_db)):
    """上传完成后登记文件。s3_key 必须是本人通过 /upload-url 拿到的，且对象确实已经在桶里。

    缩略图、thumbhash、视频转码都由 OSS 触发的媒体 FC 异步完成，这里不等。
    """
    current_user_id = int(identity)
    data = payload.get_json()
    for field in ['s3_key', 'size', 'content_type', 'original_filename', 'activity_date', 'activity_type']:
        if not data or field not in data:
            raise ApiError('VALIDATION_001', f'缺少必填字段: {field}')

    s3_key = data['s3_key'].strip()
    original_filename = data['original_filename'].strip()
    activity_date_str = data['activity_date'].strip()
    activity_type = data['activity_type'].strip()
    activity_name = data.get('activity_name', '').strip() if data.get('activity_name') else None

    try:
        activity_date = datetime.fromisoformat(activity_date_str).date()
    except ValueError:
        raise ApiError('FILE_007', '活动日期格式无效')
    if activity_type not in ACTIVITY_TYPE_VALUES:
        raise ApiError('FILE_008', '活动类型无效')
    if db.query(File).execution_options(**INCLUDE_DELETED).filter_by(s3_key=s3_key).first():
        raise ApiError('FILE_005', '已有同名文件')

    ticket = db.get(UploadTicket, s3_key) if is_file_key(s3_key) else None
    if not ticket or ticket.user_id != current_user_id:
        raise ApiError('FILE_009', '上传凭据无效，请重新上传')

    actual_size = storage.head(s3_key)
    if actual_size is None:
        raise ApiError('FILE_010', '文件尚未上传完成')
    # 签名只约束了 Content-Type，大小要在这里核对，否则 2GB 上限可以绕过
    if actual_size != ticket.size:
        raise ApiError('FILE_010', '文件上传不完整，请重新上传')

    file = File(
        filename=ticket.filename,
        directory=f"{activity_type}/{activity_date.year}/{activity_date.month:02d}",
        s3_key=s3_key,
        size=actual_size,
        content_type=ticket.content_type,
        uploader_id=current_user_id,
        uploaded_at=datetime.utcnow(),
        original_filename=original_filename,
        activity_date=activity_date,
        activity_type=activity_type,
        activity_name=activity_name,
        is_legacy=False,
        media_status=media.initial_media_status(s3_key),
    )
    db.add(file)
    db.delete(ticket)
    db.flush()

    # 媒体 FC 可能比确认先跑完（小图片），结果已经在桶里了就直接收下
    media.ingest_media_json(file)

    _log(db, request, current_user_id, OperationType.UPLOAD, file.id, file.filename)
    db.commit()
    log.info(f'File uploaded by user {current_user_id}: {s3_key} ({file.filename}, type: {activity_type})')

    file_dict = file.to_dict(include_uploader=True)
    file_dict['activity_type_display'] = display_name_for(activity_type)
    return json_response({'success': True, 'message': '文件上传成功', 'file': file_dict}, 201)


# ---------------------------------------------------------------- 列表、详情


def _filter_directory(query, directory: str):
    # 精确匹配或子目录（带斜杠），"测试目录" 不会匹配到 "测试目录2"
    normalized = directory.strip('/')
    return query.filter(or_(File.directory == normalized, File.directory.startswith(normalized + '/')))


def _tag_subquery(db: Session, tag_names: list):
    return select(FileTag.file_id).join(Tag, FileTag.tag_id == Tag.id).where(Tag.name.in_(tag_names)).distinct()


def _search(query, search: str):
    pattern = f'%{search}%'
    return query.filter(or_(File.filename.ilike(pattern), File.original_filename.ilike(pattern),
                            File.activity_type.ilike(pattern)))


def _parse_date(value: str, message: str):
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        raise ApiError('VALIDATION_001', message)


def display_name_sql():
    """显示名 filename || original_filename 的 SQL 表达式。"""
    return func.coalesce(func.nullif(File.filename, ''), File.original_filename)


# sort 参数 → 排序。taken：拍摄时间正序，没有的排后面，同一时刻按显示名
_SORTS = {
    'activity': lambda: (File.activity_date.desc().nullslast(), File.uploaded_at.desc()),
    'taken': lambda: (File.taken_at.is_(None), File.taken_at.asc(), display_name_sql().asc(), File.id.asc()),
    'uploaded': lambda: (File.uploaded_at.desc(), File.id.desc()),
}


@router.get('')
@guarded('获取文件列表失败，请稍后重试')
def list_files(request: Request, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """文件列表：筛选、分页，另附按年月分组的数量（timeline）。"""
    current_user_id = int(identity)
    directory = arg(request, 'directory', '').strip()
    uploader_id = arg(request, 'uploader_id', type=int)
    activity_type = arg(request, 'activity_type', '').strip()
    activity_name = arg(request, 'activity_name', '').strip()
    activity_date_exact = arg(request, 'activity_date', '').strip()
    date_from = arg(request, 'date_from', '').strip()
    date_to = arg(request, 'date_to', '').strip()
    search = arg(request, 'search', '').strip()
    media_type = arg(request, 'media_type', '').strip().lower()
    tags_param = arg(request, 'tags', '').strip()
    year = arg(request, 'year', type=int)
    month = arg(request, 'month', type=int)
    page = arg(request, 'page', 1, type=int)
    per_page = arg(request, 'per_page', 50, type=int)
    sort = arg(request, 'sort', 'activity').strip().lower() or 'activity'
    if page < 1:
        page = 1
    if per_page < 1 or per_page > 100:
        per_page = 50
    if sort not in _SORTS:
        raise ApiError('VALIDATION_001', 'sort 只能是 activity、taken、uploaded')
    tag_names = [t.strip() for t in tags_param.split(',') if t.strip()] if tags_param else []

    query = db.query(File)
    if directory:
        query = _filter_directory(query, directory)
    if uploader_id:
        query = query.filter(File.uploader_id == uploader_id)
    if activity_type:
        query = query.filter(File.activity_type == activity_type)
    if activity_name:
        query = query.filter(File.activity_name == activity_name)
    if activity_date_exact:
        query = query.filter(File.activity_date == _parse_date(
            activity_date_exact, '活动日期格式无效。请使用 ISO 格式 (YYYY-MM-DD)'))
    if media_type and media_type != 'all':
        if media_type == 'image':
            query = query.filter(or_(File.content_type.startswith('image/'), File.content_type.like('image/%')))
        elif media_type == 'video':
            query = query.filter(or_(File.content_type.startswith('video/'), File.content_type.like('video/%')))
    if tag_names:
        query = query.filter(File.id.in_(_tag_subquery(db, tag_names)))
    if year:
        query = query.filter(extract('year', File.activity_date) == year)
    if month and year:
        query = query.filter(extract('month', File.activity_date) == month)
    if search:
        query = _search(query, search)
    if date_from:
        query = query.filter(File.activity_date >= _parse_date(
            date_from, '日期格式无效 (date_from)。请使用 ISO 格式 (YYYY-MM-DD)'))
    if date_to:
        query = query.filter(File.activity_date <= _parse_date(
            date_to, '日期格式无效 (date_to)。请使用 ISO 格式 (YYYY-MM-DD)'))

    query = query.order_by(*_SORTS[sort]())
    pagination = paginate(query, page, per_page)
    media.catch_up(db, pagination.items)
    files = [_with_display(f) for f in pagination.items]

    # timeline 用同样的筛选但不分页；现状：不按活动名、确切日期、年月筛
    timeline_query = db.query(File)
    if directory:
        timeline_query = _filter_directory(timeline_query, directory)
    if uploader_id:
        timeline_query = timeline_query.filter(File.uploader_id == uploader_id)
    if activity_type:
        timeline_query = timeline_query.filter(File.activity_type == activity_type)
    if media_type and media_type != 'all':
        if media_type == 'image':
            timeline_query = timeline_query.filter(File.content_type.like('image/%'))
        elif media_type == 'video':
            timeline_query = timeline_query.filter(File.content_type.like('video/%'))
    if tag_names:
        timeline_query = timeline_query.filter(File.id.in_(_tag_subquery(db, tag_names)))
    if search:
        timeline_query = _search(timeline_query, search)
    if date_from:
        timeline_query = timeline_query.filter(File.activity_date >= datetime.fromisoformat(date_from).date())
    if date_to:
        timeline_query = timeline_query.filter(File.activity_date <= datetime.fromisoformat(date_to).date())

    timeline_stats = db.query(
        extract('year', File.activity_date).label('year'),
        extract('month', File.activity_date).label('month'),
        func.count(File.id).label('count'),
    ).filter(
        File.id.in_(timeline_query.with_entities(File.id))
    ).group_by(
        extract('year', File.activity_date), extract('month', File.activity_date)
    ).all()

    timeline = {}
    undated_count = 0
    for year_val, month_val, count in timeline_stats:
        if year_val is None:
            undated_count += count
        else:
            year_str = str(int(year_val))
            timeline.setdefault(year_str, {})
            month_str = str(int(month_val)) if month_val else 'undated'
            timeline[year_str][month_str] = {'count': count}
    if undated_count > 0:
        timeline['undated'] = {'count': undated_count}

    log.info(f'User {current_user_id} listed {len(files)} files (page {page})')
    return json_response({'success': True, 'files': files, 'pagination': pagination.meta(), 'timeline': timeline})


@router.get('/{file_id:int}')
@guarded('获取文件信息失败，请稍后重试')
def get_file(file_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    int(identity)
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    media.catch_up(db, [file])
    return json_response({'success': True, 'file': _with_display(file)})


@router.delete('/{file_id:int}')
@guarded('删除文件失败，请稍后重试')
def delete_file(file_id: int, request: Request, identity: str = Depends(jwt_identity),
                db: Session = Depends(get_db)):
    """删文件：上传者或管理员。进回收站（对象、人脸、embedding 都留着），30 天后每日任务彻底清掉。"""
    current_user_id = int(identity)
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    if file.uploader_id != current_user_id and not _is_admin(db, current_user_id):
        raise ApiError('FILE_002', '你没有删除此文件的权限', 403)

    file_cleanup.soft_delete(file, current_user_id)
    _log(db, request, current_user_id, OperationType.DELETE, file.id, f"{file.directory}/{file.filename}")
    db.commit()
    log.info(f'User {current_user_id} moved file {file_id} to trash: {file.s3_key}')
    return json_response({'success': True, 'message': '文件删除成功'})


# ---------------------------------------------------------------- 目录树


@router.get('/directories')
@guarded('获取目录结构失败，请稍后重试')
def get_directories(identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """年 → 月 → 活动（日期 + 活动名 + 类型）三层，带文件数，新的在前。"""
    int(identity)
    file_stats = db.query(
        extract('year', File.activity_date).label('year'),
        extract('month', File.activity_date).label('month'),
        File.activity_date, File.activity_name, File.activity_type,
        func.count(File.id).label('file_count'),
    ).filter(
        File.activity_date.isnot(None)
    ).group_by(
        extract('year', File.activity_date), extract('month', File.activity_date),
        File.activity_date, File.activity_name, File.activity_type,
    ).all()

    year_tree = {}
    for year, month, activity_date, activity_name, activity_type, count in file_stats:
        year_str = str(int(year)) if year else 'unknown'
        month_str = f"{int(month):02d}" if month else 'unknown'
        year_node = year_tree.setdefault(year_str, {'count': 0, 'months': {}})
        year_node['count'] += count
        month_node = year_node['months'].setdefault(month_str, {'count': 0, 'activities': {}})
        month_node['count'] += count

        date_str = activity_date.strftime('%m-%d') if activity_date else ''
        type_display = ACTIVITY_TYPE_DISPLAY.get(activity_type, activity_type) if activity_type else ''
        if activity_name:
            activity_key = f"{date_str}_{activity_name}_{activity_type or 'unknown'}"
            activity_display = f"{date_str} {activity_name}" + (f" ({type_display})" if type_display else "")
        else:
            # 没有活动名的老文件归到"未分类"
            activity_key = f"{date_str}_未分类"
            activity_display = f"{date_str} 未分类"
        activity = month_node['activities'].setdefault(activity_key, {
            'display': activity_display,
            'date': activity_date.isoformat() if activity_date else '',
            'activity_name': activity_name or '',
            'activity_type': activity_type or '',
            'count': 0,
        })
        activity['count'] += count

    directories = []
    for year, year_data in year_tree.items():
        year_obj = {'value': year, 'name': f'{year}年', 'path': year, 'file_count': year_data['count'],
                    'subdirectories': []}
        for month_str, month_data in year_data['months'].items():
            month_obj = {'name': f'{int(month_str)}月', 'path': f'{year}/{month_str}',
                         'file_count': month_data['count'], 'subdirectories': []}
            for activity_key, a in month_data['activities'].items():
                month_obj['subdirectories'].append({
                    'name': a['display'],
                    'path': f"{year}/{month_str}/{activity_key}",
                    'file_count': a['count'],
                    'activity_date': a['date'],
                    'activity_name': a['activity_name'],
                    'activity_type': a['activity_type'],
                })
            month_obj['subdirectories'].sort(key=lambda x: x.get('activity_date', ''), reverse=True)
            year_obj['subdirectories'].append(month_obj)
        year_obj['subdirectories'].sort(key=lambda x: int(x['name'].replace('月', '')), reverse=True)
        directories.append(year_obj)
    directories.sort(key=lambda x: x['value'], reverse=True)
    return json_response({'success': True, 'directories': directories})


# ---------------------------------------------------------------- 编辑


@router.patch('/{file_id:int}')
@guarded('更新文件信息失败，请稍后重试')
def update_file(file_id: int, request: Request, identity: str = Depends(jwt_identity),
                payload: Body = Depends(body), db: Session = Depends(get_db)):
    """改活动日期、类型、名称、文件名、标签：上传者或管理员。目录跟着重算，桶里的对象不动。"""
    current_user_id = int(identity)
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    if file.uploader_id != current_user_id and not _is_admin(db, current_user_id):
        raise ApiError('FILE_002', '你没有编辑此文件的权限', 403)

    data = payload.get_json()
    if not data:
        raise ApiError('VALIDATION_001', '请求数据不能为空')

    if 'free_tags' in data and (not isinstance(data['free_tags'], list)
                                or any(not isinstance(t, str) for t in data['free_tags'])):
        raise ApiError('VALIDATION_001', 'free_tags 必须是数组')

    changes_made = False
    old_directory = file.directory

    if 'activity_date' in data:
        try:
            new_activity_date = datetime.fromisoformat(data['activity_date'].strip()).date()
        except ValueError:
            raise ApiError('FILE_007', '活动日期格式无效')
        if file.activity_date != new_activity_date:
            file.activity_date = new_activity_date
            changes_made = True

    # None 表示未分类
    if 'activity_type' in data:
        raw = data['activity_type']
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            activity_type = None
        elif isinstance(raw, str):
            activity_type = raw.strip()
            if activity_type not in ACTIVITY_TYPE_VALUES:
                raise ApiError('FILE_008', f'活动类型无效。有效选项: {_TYPE_OPTIONS}')
        else:
            raise ApiError('FILE_008', '活动类型必须是字符串或 null')
        if file.activity_type != activity_type:
            file.activity_type = activity_type
            changes_made = True

    if 'activity_name' in data:
        activity_name = data['activity_name'].strip() if data['activity_name'] else None
        if activity_name and len(activity_name) > 200:
            raise ApiError('VALIDATION_001', '活动名称不能超过 200 个字符')
        if file.activity_name != activity_name:
            file.activity_name = activity_name
            changes_made = True

    filename_changed = False
    if 'filename' in data:
        new_filename = data['filename'].strip() if data['filename'] else None
        if not new_filename:
            raise ApiError('VALIDATION_001', '文件名不能为空')
        if len(new_filename) > 255:
            raise ApiError('VALIDATION_001', '文件名不能超过 255 个字符')
        invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
        if any(c in new_filename for c in invalid_chars):
            raise ApiError('VALIDATION_001', f'文件名包含非法字符: {", ".join(invalid_chars)}')
        if file.filename != new_filename:
            file.filename = new_filename
            filename_changed = True
            changes_made = True

    # 目录只是数据库里的分类（活动类型/年/月），桶里的路径永远不变。
    # 查重必须在动标签之前：标签服务内部会提交，之后再回滚就撤不回前面改的文件名和活动了
    if (changes_made or 'free_tags' in data) and file.activity_date and file.activity_type:
        file.directory = f"{file.activity_type}/{file.activity_date.year}/{file.activity_date.month:02d}"
    if file.directory != old_directory or filename_changed:
        duplicate = db.query(File).filter(File.directory == file.directory, File.filename == file.filename,
                                          File.id != file_id).first()
        if duplicate:
            conflicting = file.filename
            db.rollback()
            raise ApiError('FILE_005', f'已有同名文件「{conflicting}」')

    if 'free_tags' in data and tag_service.sync_file_tags(db, file, data['free_tags'], current_user_id):
        changes_made = True

    if not changes_made:
        # 现状：没改动时 file 里没有 activity_type_display
        db.rollback()
        return json_response({'success': True, 'message': '没有需要更新的内容',
                              'file': file.to_dict(include_uploader=True)})

    _log(db, request, current_user_id, OperationType.UPDATE, file.id, f"{file.directory}/{file.filename}")
    db.commit()
    log.info(f'User {current_user_id} updated file {file_id}: {file.directory}/{file.filename}')

    file_dict = file.to_dict(include_uploader=True)
    file_dict['activity_type_display'] = display_name_for(file.activity_type)
    return json_response({'success': True, 'message': '文件信息更新成功', 'file': file_dict})


# ---------------------------------------------------------------- 文件名检查、相邻文件


@router.post('/check-filenames')
@guarded('检查文件名失败，请稍后重试')
def check_filenames(identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                    db: Session = Depends(get_db)):
    """上传前查重：同一目录（活动类型/年/月）下哪些文件名已经有了。"""
    int(identity)
    data = payload.get_json()
    if not data:
        raise ApiError('INVALID_INPUT', '请求数据不能为空')
    filenames = data.get('filenames', [])
    activity_date_str = data.get('activity_date')
    activity_type = data.get('activity_type')
    if not filenames or not isinstance(filenames, list):
        raise ApiError('INVALID_INPUT', '文件名列表不能为空')
    if not activity_date_str or not activity_type:
        raise ApiError('INVALID_INPUT', '活动日期和活动类型不能为空')
    try:
        activity_date = datetime.strptime(activity_date_str, '%Y-%m-%d').date()
    except ValueError:
        raise ApiError('INVALID_DATE', '活动日期格式无效，应为YYYY-MM-DD')

    existing = db.query(File).filter(
        File.activity_type == activity_type,
        func.extract('year', File.activity_date) == activity_date.year,
        func.extract('month', File.activity_date) == activity_date.month,
        File.filename.in_(filenames),
    ).all()
    existing_filenames = [f.filename for f in existing]
    available_filenames = [f for f in filenames if f not in existing_filenames]
    return json_response({'success': True, 'existing_files': existing_filenames,
                          'available_files': available_filenames})


@router.get('/{file_id:int}/adjacent')
@guarded('获取相邻文件失败，请稍后重试')
def get_adjacent_files(file_id: int, request: Request, identity: str = Depends(jwt_identity),
                       db: Session = Depends(get_db)):
    """同一目录里的前后文件（活动日期新的在前，同日按文件名）；到目录边界时跨到相邻目录。"""
    int(identity)
    limit = max(1, min(arg(request, 'limit', 3, type=int), 20))

    current_file = db.get(File, file_id)
    if not current_file:
        raise ApiError('FILE_NOT_FOUND', '文件不存在', 404)

    same_directory_files = db.query(File).filter(File.directory == current_file.directory).order_by(
        File.activity_date.desc(), File.filename.asc()).all()
    current_index = next((i for i, f in enumerate(same_directory_files) if f.id == file_id), None)
    if current_index is None:
        raise ApiError('FILE_NOT_FOUND', '文件不存在', 404)

    previous_files = [same_directory_files[current_index - i] for i in range(limit, 0, -1)
                      if current_index - i >= 0]
    next_files = [same_directory_files[current_index + i] for i in range(1, limit + 1)
                  if current_index + i < len(same_directory_files)]
    previous_file = same_directory_files[current_index - 1] if current_index > 0 else None
    next_file = (same_directory_files[current_index + 1]
                 if current_index < len(same_directory_files) - 1 else None)

    if previous_file is None or next_file is None:
        dir_parts = current_file.directory.split('/')
        if len(dir_parts) >= 3:  # 例如 "regular_training/2025/11"
            all_dirs = [d[0] for d in db.query(File.directory).filter(
                File.directory.like(f"{dir_parts[0]}/%")).distinct().order_by(File.directory.desc()).all()]
            try:
                current_dir_index = all_dirs.index(current_file.directory)
            except ValueError:
                current_dir_index = -1
            if previous_file is None and current_dir_index > 0:
                previous_file = db.query(File).filter(File.directory == all_dirs[current_dir_index - 1]).order_by(
                    File.activity_date.desc(), File.filename.desc()).first()
            if next_file is None and current_dir_index < len(all_dirs) - 1:
                next_file = db.query(File).filter(File.directory == all_dirs[current_dir_index + 1]).order_by(
                    File.activity_date.desc(), File.filename.asc()).first()

    return json_response({
        'previous': previous_file.to_dict() if previous_file else None,
        'next': next_file.to_dict() if next_file else None,
        'previous_files': [f.to_dict() for f in previous_files],
        'next_files': [f.to_dict() for f in next_files],
    })


# ---------------------------------------------------------------- 单个文件的标签（现状：谁都能给任何文件打标签）


@router.get('/{file_id:int}/tags')
@guarded('获取文件标签失败，请稍后重试')
def get_file_tags(file_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    int(identity)
    try:
        tags = tag_service.get_file_tags(db, file_id)
    except LookupError:
        raise ApiError('FILE_010', '文件不存在', 404)
    return json_response({'success': True, 'tags': [{'id': t.id, 'name': t.name} for t in tags]})


@router.post('/{file_id:int}/tags', status_code=201)
@guarded('添加标签失败，请稍后重试')
def add_file_tag(file_id: int, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                 db: Session = Depends(get_db)):
    current_user_id = int(identity)
    data = payload.get_json()
    if not data or 'tag_name' not in data:
        raise ApiError('VALIDATION_001', '缺少必填字段: tag_name')
    tag_name = data['tag_name']
    if not tag_name or not tag_name.strip():
        raise ApiError('TAG_003', '标签不能为空')
    if len(tag_name.strip()) > 100:
        raise ApiError('TAG_003', '标签不能超过 100 个字符')
    try:
        file_tag = tag_service.add_tag_to_file(db, file_id, tag_name, current_user_id)
    except LookupError:
        raise ApiError('FILE_010', '文件不存在', 404)
    except ValueError as e:
        raise ApiError('TAG_003', str(e))
    tag = db.get(Tag, file_tag.tag_id)
    return json_response({'success': True, 'message': '标签添加成功', 'tag': {'id': tag.id, 'name': tag.name}}, 201)


@router.delete('/{file_id:int}/tags/{tag_id:int}')
@guarded('移除标签失败，请稍后重试')
def remove_file_tag(file_id: int, tag_id: int, identity: str = Depends(jwt_identity),
                    db: Session = Depends(get_db)):
    try:
        int(identity)
        if not db.get(File, file_id):
            raise ApiError('FILE_010', '文件不存在', 404)
        removed = tag_service.remove_tag_from_file(db, file_id, tag_id)
    except ValueError as e:
        raise ApiError('VALIDATION_001', str(e))
    if not removed:
        raise ApiError('TAG_001', '该文件没有此标签', 404)
    return json_response({'success': True, 'message': '标签移除成功'})


# ---------------------------------------------------------------- 批量操作


@router.post('/batch/delete')
@guarded('批量删除失败，请稍后重试')
def batch_delete_files(request: Request, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                       db: Session = Depends(get_db)):
    current_user_id = int(identity)
    data = payload.get_json()
    if not data or 'file_ids' not in data:
        raise ApiError('BATCH_001', '缺少必填字段: file_ids')
    file_ids = data['file_ids']
    if not file_ids or not isinstance(file_ids, list):
        raise ApiError('BATCH_001', '文件ID列表不能为空')
    if len(file_ids) > 100:
        raise ApiError('BATCH_002', '单次最多操作 100 个文件')

    is_admin = _is_admin(db, current_user_id)
    succeeded, failed = [], []
    for file_id in file_ids:
        try:
            file = db.get(File, file_id)
            if not file or file.deleted_at:  # 同一批里重复的 id
                failed.append({'file_id': file_id, 'error': '文件不存在'})
                continue
            if file.uploader_id != current_user_id and not is_admin:
                failed.append({'file_id': file_id, 'error': '没有删除权限'})
                continue
            # 进回收站，对象不动
            file_cleanup.soft_delete(file, current_user_id)
            _log(db, request, current_user_id, OperationType.DELETE, file.id, f"{file.directory}/{file.filename}")
            succeeded.append(file_id)
        except Exception as e:
            log.error(f'Error deleting file {file_id}: {e}')
            failed.append({'file_id': file_id, 'error': '删除失败'})
    db.commit()

    # 现状：删除也用 TAG_004
    return _batch_result(succeeded, failed, f'成功删除 {len(succeeded)} 个文件', '所有文件删除失败', 'TAG_004',
                         f'部分操作失败: 成功 {len(succeeded)}, 失败 {len(failed)}')


def _check_tag_name(tag_name) -> None:
    if not tag_name or not tag_name.strip():
        raise ApiError('TAG_003', '标签不能为空')
    if len(tag_name.strip()) > 100:
        raise ApiError('TAG_003', '标签不能超过 100 个字符')


@router.post('/batch/tags')
@guarded('批量添加标签失败，请稍后重试')
def batch_add_tag(identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                  db: Session = Depends(get_db)):
    current_user_id = int(identity)
    data = payload.get_json()
    if not data:
        raise ApiError('BATCH_001', '请求数据不能为空')
    file_ids = data.get('file_ids')
    tag_name = data.get('tag_name')
    if not file_ids or not isinstance(file_ids, list):
        raise ApiError('BATCH_001', '文件ID列表不能为空')
    _check_tag_name(tag_name)
    if len(file_ids) > 100:
        raise ApiError('BATCH_002', '单次最多操作 100 个文件')

    try:
        tag = tag_service.get_or_create_tag(db, tag_name, current_user_id)
    except ValueError as e:
        raise ApiError('TAG_003', str(e))

    succeeded, failed = [], []
    for file_id in file_ids:
        try:
            if not db.get(File, file_id):
                failed.append({'file_id': file_id, 'error': '文件不存在'})
                continue
            # 已经有这个标签的也算成功
            if not db.query(FileTag).filter_by(file_id=file_id, tag_id=tag.id).first():
                db.add(FileTag(file_id=file_id, tag_id=tag.id))
            succeeded.append(file_id)
        except Exception as e:
            log.error(f'Error adding tag to file {file_id}: {e}')
            failed.append({'file_id': file_id, 'error': '添加标签失败'})
    db.commit()

    return _batch_result(succeeded, failed, f'成功为 {len(succeeded)} 个文件添加标签', '所有文件添加标签失败',
                         'TAG_004', f'部分操作失败: 成功 {len(succeeded)}, 失败 {len(failed)}',
                         tag={'id': tag.id, 'name': tag.name})


@router.delete('/batch/tags')
@guarded('批量移除标签失败，请稍后重试')
def batch_remove_tag(identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                     db: Session = Depends(get_db)):
    int(identity)
    data = payload.get_json()
    if not data:
        raise ApiError('BATCH_001', '请求数据不能为空')
    file_ids = data.get('file_ids')
    tag_id = data.get('tag_id')
    if not file_ids or not isinstance(file_ids, list):
        raise ApiError('BATCH_001', '文件ID列表不能为空')
    if not tag_id:
        raise ApiError('VALIDATION_001', '缺少必填字段: tag_id')
    if len(file_ids) > 100:
        raise ApiError('BATCH_002', '单次最多操作 100 个文件')
    if not db.get(Tag, tag_id):
        raise ApiError('TAG_001', '标签不存在', 404)

    succeeded, failed = [], []
    for file_id in file_ids:
        try:
            if not db.get(File, file_id):
                failed.append({'file_id': file_id, 'error': '文件不存在'})
                continue
            # 文件上本来就没有这个标签也算成功
            file_tag = db.query(FileTag).filter_by(file_id=file_id, tag_id=tag_id).first()
            if file_tag:
                db.delete(file_tag)
            succeeded.append(file_id)
        except Exception as e:
            log.error(f'Error removing tag from file {file_id}: {e}')
            failed.append({'file_id': file_id, 'error': '移除标签失败'})
    db.commit()

    return _batch_result(succeeded, failed, f'成功从 {len(succeeded)} 个文件移除标签', '所有文件移除标签失败',
                         'TAG_004', f'部分操作失败: 成功 {len(succeeded)}, 失败 {len(failed)}')


@router.post('/batch/update')
@guarded('批量更新失败，请稍后重试')
def batch_update_files(identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                       db: Session = Depends(get_db)):
    """批量改活动信息和标签：上传者或管理员。tag_mode=replace 先清掉原有标签。"""
    current_user_id = int(identity)
    is_admin = _is_admin(db, current_user_id)
    data = payload.get_json()
    if not data:
        raise ApiError('BATCH_001', '请求数据不能为空')
    file_ids = data.get('file_ids', [])
    updates = data.get('updates', {})
    if not file_ids:
        raise ApiError('BATCH_001', '文件ID列表不能为空')
    if not updates:
        raise ApiError('BATCH_001', '更新内容不能为空')
    if not isinstance(file_ids, list) or not isinstance(updates, dict):
        raise ApiError('BATCH_001', '请求格式不对')
    if len(file_ids) > 100:
        raise ApiError('BATCH_002', '单次最多操作 100 个文件')
    # 标签先查清楚：标签服务内部会提交，改到一半才发现格式不对的话，前面的改动已经入库了
    tags = updates.get('free_tags')
    if tags is not None and (not isinstance(tags, list) or any(not isinstance(t, str) for t in tags)):
        raise ApiError('VALIDATION_001', 'free_tags 必须是数组')
    if updates.get('activity_date') is not None and not isinstance(updates['activity_date'], str):
        raise ApiError('FILE_007', '活动日期格式无效')
    if updates.get('activity_name') is not None and (
            not isinstance(updates['activity_name'], str) or len(updates['activity_name']) > 200):
        raise ApiError('VALIDATION_001', '活动名称不能超过 200 个字符')
    if 'activity_type' in updates and updates['activity_type']:
        if updates['activity_type'] not in ACTIVITY_TYPE_VALUES:
            raise ApiError('FILE_008', f'活动类型无效。有效选项: {_TYPE_OPTIONS}')
    new_activity_date = None
    if 'activity_date' in updates and updates['activity_date']:
        try:
            new_activity_date = datetime.fromisoformat(updates['activity_date']).date()
        except ValueError:
            raise ApiError('FILE_007', '活动日期格式无效')

    tag_mode = updates.get('tag_mode', 'add')  # add / replace
    new_tags = updates.get('free_tags') or []

    succeeded, failed = [], []
    file_map = {f.id: f for f in db.query(File).filter(File.id.in_(file_ids)).all()}
    for file_id in file_ids:
        file = file_map.get(file_id)
        if not file:
            failed.append({'file_id': file_id, 'error': '文件不存在'})
            continue
        if file.uploader_id != current_user_id and not is_admin:
            failed.append({'file_id': file_id, 'error': '没有编辑权限'})
            continue
        try:
            # 先算出改完后的目录并查重，没问题再动：不靠回滚撤销（标签服务内部会提交）
            target_date = new_activity_date or file.activity_date
            target_type = updates['activity_type'] if updates.get('activity_type') else file.activity_type
            target_directory = file.directory
            if target_date and target_type:
                target_directory = f"{target_type}/{target_date.year}/{target_date.month:02d}"
            if target_directory != file.directory and db.query(File).filter(
                    File.directory == target_directory, File.filename == file.filename, File.id != file.id).first():
                failed.append({'file_id': file_id, 'error': f'已有同名文件「{file.filename}」'})
                continue

            if new_activity_date:
                file.activity_date = new_activity_date
            if 'activity_type' in updates and updates['activity_type']:
                file.activity_type = updates['activity_type']
            if 'activity_name' in updates:
                file.activity_name = updates['activity_name'] if updates['activity_name'] else None
            # 目录只是数据库里的分类，桶里的文件不动
            file.directory = target_directory

            if new_tags:
                if tag_mode == 'replace':
                    for tag in list(file.tags):
                        tag_service.remove_tag_from_file(db, file.id, tag.id)
                current_tag_names = set(t.name for t in file.tags)
                for tag_name in new_tags:
                    tag_name = tag_name.strip()
                    if tag_name and tag_name not in current_tag_names:
                        tag_service.add_tag_to_file(db, file.id, tag_name, current_user_id)
            succeeded.append(file_id)
        except Exception as e:
            log.error(f'Error updating file {file_id}: {e}')
            failed.append({'file_id': file_id, 'error': str(e)})

    if succeeded:
        db.commit()
    return _batch_result(succeeded, failed, f'成功更新 {len(succeeded)} 个文件', '所有文件更新失败',
                         'PARTIAL_SUCCESS', f'已发送 {len(succeeded)} 个，{len(failed)} 个失败')


# ---------------------------------------------------------------- 活动名、活动目录


@router.get('/activity-names')
@guarded('获取活动名称失败，请稍后重试')
def get_activity_names_by_date(request: Request, identity: str = Depends(jwt_identity),
                               db: Session = Depends(get_db)):
    """某一天已有的活动名（带类型和文件数），上传时给用户选。"""
    int(identity)
    date_str = arg(request, 'date', '').strip()
    if not date_str:
        raise ApiError('VALIDATION_001', '缺少必填参数: date')
    activity_date = _parse_date(date_str, '日期格式无效，请使用 ISO 格式 (YYYY-MM-DD)')
    results = db.query(
        File.activity_name, File.activity_type, func.count(File.id).label('file_count')
    ).filter(
        File.activity_date == activity_date, File.activity_name.isnot(None), File.activity_name != ''
    ).group_by(File.activity_name, File.activity_type).order_by(File.activity_name).all()
    activity_names = [{
        'name': name,
        'activity_type': activity_type,
        'activity_type_display': ACTIVITY_TYPE_DISPLAY.get(activity_type, activity_type),
        'file_count': count,
    } for name, activity_type, count in results]
    return json_response({'success': True, 'date': date_str, 'activity_names': activity_names})


def _directory_files(db: Session, activity_date, activity_name, activity_type):
    return db.query(File).filter(File.activity_date == activity_date, File.activity_name == activity_name,
                                 File.activity_type == activity_type)


@router.get('/activity-directory')
@guarded('获取目录信息失败，请稍后重试')
def get_activity_directory_info(request: Request, identity: str = Depends(jwt_identity),
                                db: Session = Depends(get_db)):
    """活动目录的信息。目录的"所有者"是最早上传的人。"""
    current_user_id = int(identity)
    activity_date_str = arg(request, 'activity_date', '').strip()
    activity_name = arg(request, 'activity_name', '').strip()
    activity_type = arg(request, 'activity_type', '').strip()
    if not activity_date_str or not activity_name or not activity_type:
        raise ApiError('VALIDATION_001', '缺少必填参数: activity_date, activity_name, activity_type')
    activity_date = _parse_date(activity_date_str, '日期格式无效，请使用 ISO 格式 (YYYY-MM-DD)')

    query = _directory_files(db, activity_date, activity_name, activity_type)
    first_file = query.order_by(File.uploaded_at.asc()).first()
    if not first_file:
        raise ApiError('DIR_001', '活动不存在', 404)
    file_count = _directory_files(db, activity_date, activity_name, activity_type).count()
    owner = db.get(User, first_file.uploader_id)
    current_user = db.get(User, current_user_id)
    # 现状：当前用户不在库里时是 null
    is_owner_or_admin = current_user_id == first_file.uploader_id or (current_user and current_user.is_admin)
    return json_response({'success': True, 'directory': {
        'activity_date': activity_date_str,
        'activity_name': activity_name,
        'activity_type': activity_type,
        'activity_type_display': ACTIVITY_TYPE_DISPLAY.get(activity_type, activity_type),
        'file_count': file_count,
        'owner_id': first_file.uploader_id,
        'owner_name': owner.name if owner else str(first_file.uploader_id),
        'created_at': first_file.uploaded_at.isoformat() if first_file.uploaded_at else None,
        'is_owner': is_owner_or_admin,
    }})


@router.patch('/activity-directory')
@guarded('更新目录失败，请稍后重试')
def update_activity_directory(request: Request, identity: str = Depends(jwt_identity),
                              payload: Body = Depends(body), db: Session = Depends(get_db)):
    """改活动目录的名称或类型：所有者或管理员直接改，别人要走修改申请（403 DIR_002）。"""
    current_user_id = int(identity)
    data = payload.get_json()
    for field in ['activity_date', 'activity_name', 'activity_type']:
        if not data or field not in data:
            raise ApiError('VALIDATION_001', f'缺少必填字段: {field}')

    activity_date_str = data['activity_date'].strip()
    activity_name = data['activity_name'].strip()
    activity_type = data['activity_type'].strip()
    new_activity_name = data.get('new_activity_name', '').strip() if data.get('new_activity_name') else None
    new_activity_type = data.get('new_activity_type', '').strip() if data.get('new_activity_type') else None
    if not new_activity_name and not new_activity_type:
        raise ApiError('VALIDATION_001', '请提供要修改的内容 (new_activity_name 或 new_activity_type)')
    activity_date = _parse_date(activity_date_str, '日期格式无效')
    if new_activity_type and new_activity_type not in ACTIVITY_TYPE_VALUES:
        raise ApiError('VALIDATION_001', f'无效的活动类型。有效选项: {_TYPE_OPTIONS}')

    first_file = _directory_files(db, activity_date, activity_name, activity_type).order_by(
        File.uploaded_at.asc()).first()
    if not first_file:
        raise ApiError('DIR_001', '活动不存在', 404)
    if not (current_user_id == first_file.uploader_id or _is_admin(db, current_user_id)):
        raise ApiError('DIR_002', '你不是此活动的负责人，请提交编辑申请', 403,
                       owner_id=first_file.uploader_id, need_request=True)

    updated_count = 0
    for file in _directory_files(db, activity_date, activity_name, activity_type).all():
        if new_activity_name:
            file.activity_name = new_activity_name
        if new_activity_type:
            file.activity_type = new_activity_type
            file.refresh_directory()
        updated_count += 1
    db.commit()

    _log(db, request, current_user_id, OperationType.UPDATE, first_file.id,
         f"目录更新: {activity_name} -> {new_activity_name or activity_name}")
    db.commit()
    log.info(f'User {current_user_id} updated activity directory: {activity_name} ({updated_count} files)')
    return json_response({'success': True, 'message': f'已更新 {updated_count} 个文件', 'updated_count': updated_count,
                          'new_activity_name': new_activity_name or activity_name,
                          'new_activity_type': new_activity_type or activity_type})
