"""/api/files 下的访问地址：签名地址（用途 → OSS 处理参数）、HLS 播放列表、播放器信息、节拍（只读）、媒体 FC 回调。
规则见 services/media.py。"""
import hmac
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import Body, arg, body, external_base_url, jwt_identity
from errors import ApiError, error_response, guarded, json_response
from auth.models import User
from files.models import INCLUDE_DELETED, File
from services import beat_fix, beat_grid, live_photo, lockai, media
from services.storage import MAX_SIGN_SECONDS, derived_key, is_file_key, storage

router = APIRouter(prefix='/api/files')
log = logging.getLogger(__name__)

SIGNED_URL_DEFAULT_SECONDS = 3600


def _requested_expiration(value) -> int:
    """客户端要的有效期：只能在 1 分钟到 24 小时之间。"""
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        seconds = SIGNED_URL_DEFAULT_SECONDS
    return max(60, min(seconds, MAX_SIGN_SECONDS))


@router.get('/signed-url/{file_id:int}')
@guarded('生成访问地址失败')
def get_signed_url(file_id: int, request: Request, identity: str = Depends(jwt_identity),
                   db: Session = Depends(get_db)):
    """单个文件的访问地址。style 是用途名（缩略图、预览、视频封面、hls:… 播放、original 原文件）。

    视频的 hls: 用途：转码好了返回 HLS 播放列表地址，没好返回原文件地址（hls_ready 标明是哪种）。
    """
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    style = arg(request, 'style', '').strip()
    expiration = _requested_expiration(arg(request, 'expiration'))
    # download=1：原文件用 attachment，浏览器直接存盘（别的用途不管这个参数）
    download = arg(request, 'download', '').strip().lower() in ('1', 'true')
    return json_response({
        'success': True,
        'signed_url': media.style_url(file, style, expiration, external_base_url(request), download=download),
        'expires_in': expiration,
        'hls_ready': media.hls_ready(file),
    })


@router.post('/signed-urls')
@guarded('批量生成访问地址失败')
def get_signed_urls_batch(request: Request, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                          db: Session = Depends(get_db)):
    """批量地址。视频用 video_style；没给时用 style，图片用途会换成同尺寸的视频封面。不存在的文件不返回。"""
    data = payload.get_json()
    if not data or 'file_ids' not in data:
        raise ApiError('VALIDATION_001', '缺少 file_ids 参数')
    file_ids = data['file_ids']
    if not isinstance(file_ids, list) or len(file_ids) == 0:
        raise ApiError('VALIDATION_001', 'file_ids 必须是非空数组')
    if len(file_ids) > 100:
        raise ApiError('VALIDATION_001', '单次最多请求 100 个文件')

    style = (data.get('style') or '').strip()
    video_style = (data.get('video_style') or '').strip() or style
    expiration = _requested_expiration(data.get('expiration'))
    base_url = external_base_url(request)

    result = {}
    for file in db.query(File).filter(File.id.in_(file_ids)).all():
        file_style = video_style if media.is_video(file) else style
        result[file.id] = {'signed_url': media.style_url(file, file_style, expiration, base_url),
                           's3_key': file.s3_key, 'content_type': file.content_type}
    return json_response({'success': True, 'urls': result, 'expires_in': expiration})


@router.get('/hls-qualities/{file_id:int}')
def get_hls_qualities(file_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """视频有哪几档清晰度（转码 FC 的结果里记着）。"""
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    if not media.is_video(file):
        raise ApiError('VALIDATION_001', '只能对比视频')
    renditions = sorted(media.media_info(file).get('renditions') or [], reverse=True)
    return json_response({
        'success': True,
        'qualities': [{'height': h, 'label': f'{h}p', 'playlist': f'{h}p/index.m3u8'} for h in renditions],
        'default_quality': renditions[0] if renditions else None,
        'hls_ready': media.hls_ready(file),
    })


def _hls_response(file, path: str, token):
    """读桶里的播放列表（内网），改写后返回。"""
    hls_path = media.normalize_hls_path(file, path)
    if not hls_path or not media.hls_ready(file):
        return error_response('HLS_001', '视频正在处理，请稍后再试', 404)
    text = storage.get_text(derived_key(file.s3_key, 'hls/' + hls_path))
    if text is None:
        return error_response('HLS_001', '播放列表不存在', 404)
    return Response(media.rewrite_playlist(file, hls_path, text, token).encode('utf-8'), headers={
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
    })


@router.get('/hls/{file_id:int}/{token}/{hls_path:path}')
def get_hls_playlist(file_id: int, token: str, hls_path: str, db: Session = Depends(get_db)):
    """HLS 播放列表：不需要登录头，地址里带 /signed-url 的 hls: 用途签的短期 token。子播放列表同样带 token。"""
    if not media.check_hls_token(file_id, token):
        raise ApiError('AUTH_INVALID_TOKEN', '播放地址已过期，请刷新页面', 403)
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    try:
        return _hls_response(file, hls_path, token)
    except Exception as e:
        log.error(f'Error serving HLS playlist: {e}')
        return error_response('INTERNAL_ERROR', '无法加载视频', 500)


@router.get('/hls-proxy/{file_id:int}/{hls_path:path}')
def proxy_hls_content(file_id: int, hls_path: str, identity: str = Depends(jwt_identity),
                      db: Session = Depends(get_db)):
    """老版本 App 的播放路径（带登录头），路径名在 media.normalize_hls_path 里换成新目录。"""
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    try:
        return _hls_response(file, hls_path, None)
    except Exception as e:
        log.error(f'Error proxying HLS content: {e}')
        return error_response('INTERNAL_ERROR', '无法加载视频', 500)


@router.post('/internal/media-result')
def media_result_callback(request: Request, payload: Body = Depends(body), db: Session = Depends(get_db)):
    """媒体 FC 回调（X-Media-Token）。请求体是 media.json 的内容外加 key（原文件的 key）。不限流。

    文件还没确认登记时找不到行，返回 202：确认上传时会自己去读桶里的 media.json。
    """
    expected = settings.media_callback_token or ''
    token = request.headers.get('X-Media-Token', '')
    if not expected or not hmac.compare_digest(token, expected):
        raise ApiError('UNAUTHORIZED', 'invalid token', 401)
    data = payload.get_json(silent=True) or {}
    key = data.get('key') or ''
    # 回收站里的也收：恢复后结果是对的
    file = (db.query(File).execution_options(**INCLUDE_DELETED).filter_by(s3_key=key).first()
            if is_file_key(key) else None)
    if not file:
        return json_response({'success': True, 'pending': True}, 202)
    media.apply_media_result(file, data)
    db.commit()
    log.info(f'Media result for file {file.id}: {file.media_status}')
    media.after_result(file, data)
    return json_response({'success': True})


# ---------------------------------------------------------------- 播放器信息


MEDIA_URL_SECONDS = 3600


def _get_file(db: Session, file_id: int) -> File:
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    return file


def _beats_summary(info: dict):
    beats = info.get('beats')
    if not isinstance(beats, dict):
        return None
    return {'bpm': beats.get('bpm'), 'count': beats.get('count')}


def _sprite(file, info: dict):
    sprite = info.get('sprite')
    if not isinstance(sprite, dict) or not sprite.get('count') or not is_file_key(file.s3_key):
        return None
    cols = int(sprite.get('cols') or 10)
    per = cols * cols  # FC 拼的是 cols × cols 的方阵
    sheets = int(sprite.get('sheets') or -(-int(sprite['count']) // per))
    return {
        'sheets': [storage.sign_get(derived_key(file.s3_key, f'sprite/{n}.jpg'), MEDIA_URL_SECONDS)
                   for n in range(sheets)],
        'count': int(sprite['count']), 'cols': cols, 'rows': cols,
        'width': sprite.get('width'), 'height': sprite.get('height'),
        'interval': float(sprite.get('interval') or 1.0),
    }


# 卡片上悬停预览：雪碧图的小图只有长边 160，铺满卡片会糊成马赛克。媒体 FC 本来就给片段搜索
# 抽了帧（每 2 秒左右一张、长边 768、已转正），均匀挑最多这么多张给前端，加载好了盖在雪碧图上
PREVIEW_FRAMES = 60


def _preview_frames(file, info: dict):
    frames = info.get('frames')
    if not isinstance(frames, dict) or not frames.get('count') or not is_file_key(file.s3_key):
        return None
    count, interval = int(frames['count']), float(frames.get('interval') or 2.0)
    n = min(count, PREVIEW_FRAMES)
    picks = sorted({round(k * (count - 1) / max(n - 1, 1)) for k in range(n)})
    return {
        'times': [round(i * interval, 2) for i in picks],
        'urls': [storage.sign_get(derived_key(file.s3_key, f'frames/{i:05d}.jpg'), MEDIA_URL_SECONDS,
                                  process='image/format,webp/quality,q_75') for i in picks],
        'width': frames.get('width'), 'height': frames.get('height'),
    }


@router.get('/{file_id:int}/media')
@guarded('获取媒体信息失败')
def get_media(file_id: int, request: Request, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """播放器一次拿齐：播放地址、封面、拖动预览图、节拍摘要。
    图片也能调（尺寸、方向、拍摄时间；Live Photo 还有动态部分的播放地址）。音频和视频一样有播放地址和节拍。"""
    file = _get_file(db, file_id)
    media.catch_up(db, [file])
    info = media.media_info(file)
    kind = media.kind(file)
    video = kind == 'video'
    out = {'file_id': file.id, 'kind': kind, 'status': file.media_status}
    if kind in ('image', 'other'):
        out.update({
            'width': file.raw_w or info.get('width'), 'height': file.raw_h or info.get('height'),
            'orientation': int(file.orientation or 1), 'taken_at': file.taken_at or None,
            'errors': info.get('errors') or {}, 'expires_in': MEDIA_URL_SECONDS,
        })
        motion = live_photo.motion_of(db, file) if kind == 'image' else None
        if motion is not None and motion.deleted_at is None:
            out['live'] = {'url': media.playback_url(motion, external_base_url(request)), 'hls': media.hls_ready(motion),
                           'duration': media.media_info(motion).get('duration')}
        return json_response(out)

    if kind == 'audio':
        cover = media.audio_cover(file)
        out.update({
            'width': None, 'height': None, 'duration': info.get('duration'), 'hdr': False, 'audio': True,
            'taken_at': file.taken_at or None,
            'playback': {'url': media.playback_url(file), 'hls': False, 'qualities': []},
            'poster_url': storage.sign_get(derived_key(file.s3_key, 'poster.jpg'), MEDIA_URL_SECONDS) if cover else None,
            'sprite': None, 'preview_frames': None,
            'beats': _beats_summary(info),
            'waveform': info.get('waveform') or None,
            'lockai': None,
            'errors': info.get('errors') or {},
            'expires_in': MEDIA_URL_SECONDS,
        })
        return json_response(out)

    hls = media.hls_ready(file)
    renditions = sorted(info.get('renditions') or [], reverse=True)
    if file.media_status == 'ready' and info.get('poster') and is_file_key(file.s3_key):
        poster = storage.sign_get(derived_key(file.s3_key, 'poster.jpg'), MEDIA_URL_SECONDS)
    else:
        poster = media.video_poster_url(file, 1280, MEDIA_URL_SECONDS)
    out.update({
        'width': info.get('width'), 'height': info.get('height'), 'duration': info.get('duration'),
        'hdr': bool(info.get('hdr')), 'audio': info.get('audio'),
        'taken_at': file.taken_at or None,
        'playback': {'url': media.playback_url(file, external_base_url(request)), 'hls': hls,
                     'qualities': renditions if hls else []},
        'poster_url': poster,
        'sprite': _sprite(file, info),
        'preview_frames': _preview_frames(file, info),
        'beats': _beats_summary(info),
        'lockai': lockai.info(db, file),
        'errors': info.get('errors') or {},
        'expires_in': MEDIA_URL_SECONDS,
    })
    return json_response(out)


# ---------------------------------------------------------------- 节拍


def _beats_or_404(file) -> dict:
    data = media.load_beats(file)
    if not data:
        raise ApiError('MEDIA_002', '此视频没有节拍信息', 404)
    return data


def _can_fix_beats(db: Session, file, user_id: int) -> bool:
    user = db.get(User, user_id)
    return file.uploader_id == user_id or bool(user and user.is_admin)


def _beats_body(db: Session, file, data: dict, user_id: int) -> dict:
    result = lockai.result_for(db, file)
    ones = beat_fix.ones(db, file.id)
    grid = beat_grid.grid(data, result.get('chapters'), lockai.allin1_of(file, result), ones)
    return {
        'bpm': data.get('bpm'),
        'times': grid['times'],
        'sections': grid['sections'],
        'parts': grid['parts'],
        'envelope_rate': data.get('envelope_rate'),
        'envelope': data.get('envelope'),
        'ones': ones,
        'base_sections': grid['base_sections'],
        'bounds': grid['bounds'],
        'editable': _can_fix_beats(db, file, user_id),
    }


@router.get('/{file_id:int}/beats')
@guarded('获取节拍失败')
def get_beats(file_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    file = _get_file(db, file_id)
    return json_response(_beats_body(db, file, _beats_or_404(file), int(identity)))


@router.put('/{file_id:int}/beats/ones')
@guarded('保存八拍失败')
def put_beat_ones(file_id: int, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                  db: Session = Depends(get_db)):
    """上传者、管理员直接改八拍：{"ones": [秒, …]}，整份替换，空数组回到算法的数法。别人走修改申请。"""
    user_id = int(identity)
    file = _get_file(db, file_id)
    data = _beats_or_404(file)
    beat_fix.check_file(file)
    if not _can_fix_beats(db, file, user_id):
        raise ApiError('FILE_002', '只有上传者可以直接修改，请发起修改申请', 403)
    ones = beat_fix.clean((payload.get_json(silent=True) or {}).get('ones'))
    beat_fix.save(db, file.id, ones, user_id)
    db.commit()
    log.info(f'User {user_id} set {len(ones)} beat ones on file {file_id}')
    return json_response(_beats_body(db, file, data, user_id))
