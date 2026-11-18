"""
媒体地址：客户端要的每一种图 / 视频地址都从这里出。

客户端只报“用途”（style 名，沿用迁移前的名字，App 老版本也能用），
这里把用途换成 OSS 的处理参数再签名。style 名不在白名单里的一律按原图处理，
客户端没法再拼任意参数。

视频：
  - 转码 FC 跑完之前（media_status != 'ready'）：封面用 OSS 视频截帧，播放直接给原文件；
  - 跑完之后：封面用 FC 生成的 poster.jpg，播放走 HLS。
音频：FC 转好的 audio.m4a（所有浏览器都能放）；有专辑封面的，封面是 FC 抽出来的 poster.jpg。
文件归哪一类看格式表（services/formats.py）。
HLS 的播放列表由后端改写：子播放列表指回后端（带短期 token，不需要登录头，
Safari 原生播放和 App 都能用），分片换成 OSS 签名地址。
"""
from __future__ import annotations

import hashlib
import hmac
import json
import threading
import time
from collections import OrderedDict
from typing import Optional

from config import settings
from services import formats
from services.storage import derived_key, is_file_key, storage

# ---------------------------------------------------------------- 用途 → 处理参数

def _image(width: int, quality: int = 80, fmt: str = 'webp') -> str:
    # auto-orient 先转正再缩放：前端人脸框的 CSS 裁切按“已转正的整图”算
    return f'image/auto-orient,1/resize,m_lfit,w_{width},h_{width}/quality,q_{quality}/format,{fmt}'


IMAGE_STYLES = {
    'thumbnav': _image(200, 70),
    'thumbnavdesktop': _image(320, 75),
    'thumbmobile': _image(480, 75),
    'thumbdesktop': _image(720, 78),
    'previewmobile': _image(1280, 82),
    'previewtablet': _image(1920, 82),
    'previewdesktop': _image(2560, 85),
    # embedding 用：转成 jpg、逐级降质量，直到小于 DashScope 的 5MB 限制
    'embedJpeg': 'image/auto-orient,1/resize,m_lfit,w_4096,h_4096/format,jpg/quality,q_90',
    **{f'embedQ{q}': f'image/auto-orient,1/resize,m_lfit,w_4096,h_4096/format,jpg/quality,q_{q}'
       for q in (85, 70, 55, 40, 25, 15)},
}

# 视频封面的宽度：图片用途 → 视频用途，两套名字都认
VIDEO_THUMB_WIDTH = {
    'videothumbnav': 200, 'thumbnav': 200,
    'videothumbnavdesktop': 320, 'thumbnavdesktop': 320,
    'videothumbmobile': 480, 'thumbmobile': 480,
    'videothumbdesktop': 720, 'thumbdesktop': 720,
    'videopreload': 1280, 'previewmobile': 1280, 'previewtablet': 1280, 'previewdesktop': 1920,
}

HLS_STYLE_PREFIX = 'hls:'

# App 老版本写死的播放列表名 → 新目录
LEGACY_HLS_PATHS = {
    'medium/auto_medium.m3u8': 'master.m3u8',
    'medium/1080p_medium.m3u8': '1080p/index.m3u8',
    'medium/720p_medium.m3u8': '720p/index.m3u8',
    'medium/480p_medium.m3u8': '720p/index.m3u8',
}

HLS_TOKEN_SECONDS = 6 * 3600


def initial_media_status(key: str) -> str:
    """图片、视频、音频等媒体 FC 处理（pending），其余不处理（skipped）。"""
    return 'pending' if formats.kind_of(key) in formats.PROCESSED else 'skipped'


def kind(file) -> str:
    """image / video / audio / other。

    以 Content-Type 为准（上传时已按格式表定好）；格式表说这个扩展名只存不处理的（svg 是 image/svg+xml）算 other。
    Content-Type 说不清的（老数据的 application/octet-stream）再按扩展名查表。
    """
    names = (getattr(file, 'original_filename', None), getattr(file, 'filename', None), getattr(file, 's3_key', None))
    by_name = next((k for k in map(formats.kind_of, names) if k), None)
    prefix = (file.content_type or '').split('/', 1)[0]
    if prefix in ('image', 'video', 'audio'):
        return 'other' if by_name == 'other' else prefix
    return by_name or 'other'


def is_video(file) -> bool:
    return kind(file) == 'video'


def is_image(file) -> bool:
    return kind(file) == 'image'


def is_audio(file) -> bool:
    return kind(file) == 'audio'


def oss_can_process(file) -> bool:
    """这张图能不能让 OSS 图片处理直接从原图切：常见格式而且不超过 20 MB。不能的要用 FC 存的 preview.jpg。"""
    return formats.ext_of(file.s3_key) in formats.OSS_IMAGE and (file.size or 0) <= OSS_IMAGE_LIMIT


def media_info(file) -> dict:
    try:
        return json.loads(file.media_info) if file.media_info else {}
    except (TypeError, ValueError):
        return {}


def hls_ready(file) -> bool:
    return is_video(file) and file.media_status == 'ready' and bool(media_info(file).get('renditions'))


# ---------------------------------------------------------------- 地址

def display_name(file) -> str:
    return file.filename or file.original_filename or file.s3_key.rsplit('/', 1)[-1]


def original_url(file, expires: int = 3600, download: bool = False) -> str:
    """原文件。浏览器另存为时用数据库里的文件名；download=True 时 attachment，直接存盘。"""
    return storage.sign_get(file.s3_key, expires, filename=display_name(file),
                            disposition='attachment' if download else 'inline')


# OSS 图片处理只收 20 MB 以内的原图。更大的由媒体 FC 另存一张缩小的 media/{uuid}/preview.jpg：
# 保持原始朝向、带原图的 EXIF 方向，所以 auto-orient、按 raw 坐标裁脸都照旧，坐标按比例缩放就行
OSS_IMAGE_LIMIT = 20 * 1024 * 1024


def image_source(s3_key: str, info, raw_w) -> tuple[str, float]:
    """做图片处理用的对象，和它相对原图的缩放比例。info 是 media_info（dict 或 JSON 字符串）。"""
    if isinstance(info, str):
        try:
            info = json.loads(info)
        except ValueError:
            info = None
    preview = info.get('preview') if isinstance(info, dict) else None
    if isinstance(preview, dict) and preview.get('width') and raw_w and is_file_key(s3_key):
        return derived_key(s3_key, 'preview.jpg'), preview['width'] / raw_w
    return s3_key, 1.0


def style_url(file, style: Optional[str], expires: int = 3600, base_url: str = '', download: bool = False) -> str:
    """按用途给地址。style 为空、'original' 或不认识 → 原文件。base_url 是后端对外的地址，拼 HLS 播放地址用。

    download 只对原文件有效。
    """
    style = (style or '').strip()
    if style.startswith(HLS_STYLE_PREFIX):
        return playback_url(file, base_url)
    if is_video(file) and style in VIDEO_THUMB_WIDTH:
        return video_poster_url(file, VIDEO_THUMB_WIDTH[style], expires)
    if is_audio(file) and style in VIDEO_THUMB_WIDTH and audio_cover(file):
        return storage.sign_get(derived_key(file.s3_key, 'poster.jpg'), expires,
                                process=f'image/resize,m_lfit,w_{VIDEO_THUMB_WIDTH[style]},h_{VIDEO_THUMB_WIDTH[style]}'
                                        '/quality,q_80/format,webp')
    if is_image(file) and style in IMAGE_STYLES:
        key, _ = image_source(file.s3_key, media_info(file), file.raw_w)
        return storage.sign_get(key, expires, process=IMAGE_STYLES[style])
    return original_url(file, expires, download=download)


def video_poster_url(file, width: int, expires: int = 3600) -> str:
    if file.media_status == 'ready' and media_info(file).get('poster'):
        return storage.sign_get(derived_key(file.s3_key, 'poster.jpg'), expires,
                                process=f'image/resize,m_lfit,w_{width},h_{width}/quality,q_80/format,webp')
    # 还没转码完：OSS 实时截第 1 秒，ar_auto 按旋转信息转正
    return storage.sign_get(file.s3_key, expires,
                            process=f'video/snapshot,t_1000,f_jpg,w_{width},m_fast,ar_auto')


def audio_cover(file) -> bool:
    """音频有没有专辑封面（FC 抽出来的 poster.jpg）。"""
    return file.media_status == 'ready' and bool(media_info(file).get('poster')) and is_file_key(file.s3_key)


def playback_url(file, base_url: str = '') -> str:
    """播放地址。视频：转码好了给 HLS（后端改写的播放列表），没好给原文件。
    音频：转好了给 audio.m4a，没好给原文件。

    HLS 地址带完整域名：开发时前端和后端不在一个端口。base_url 由 deps.external_base_url 按反代的
    X-Forwarded-* 头算出外部域名。
    """
    if hls_ready(file):
        return f'{base_url.rstrip("/")}/api/files/hls/{file.id}/{hls_token(file.id)}/master.m3u8'
    if is_audio(file) and file.media_status == 'ready' and media_info(file).get('playback') and is_file_key(file.s3_key):
        return storage.sign_get(derived_key(file.s3_key, 'audio.m4a'), 3600)
    return original_url(file)


# ---------------------------------------------------------------- 人脸裁剪

_ROTATE = {3: 180, 6: 90, 8: 270}


def face_crop_url(file_id: int, s3_key: str, bbox, raw_w=None, raw_h=None, orientation=1,
                  width: int = 200, expires: int = 3600, info=None) -> Optional[str]:
    """从原图裁出一张脸。bbox 是 raw 坐标（没应用 EXIF 的像素），裁完再按 EXIF 方向转正。
    info 是 media_info：原图太大时在缩小的 preview.jpg 上裁，坐标按比例缩。

    先 auto-orient,0 保证在原始像素上裁；输出 webp 不带 EXIF，浏览器不会再转一次。
    """
    if not bbox or not s3_key:
        return None
    s3_key, scale = image_source(s3_key, info, raw_w)
    x, y, w, h = (max(0, int(v * scale)) for v in bbox)
    if raw_w and raw_h:
        w = min(w, int(raw_w * scale) - x)
        h = min(h, int(raw_h * scale) - y)
    if w <= 0 or h <= 0:
        return None
    process = f'image/auto-orient,0/crop,x_{x},y_{y},w_{w},h_{h}'
    degrees = _ROTATE.get(int(orientation or 1))
    if degrees:
        process += f'/rotate,{degrees}'
    process += f'/resize,m_lfit,w_{width},h_{width}/quality,q_80/format,webp'
    return storage.sign_get(s3_key, expires, process=process)


# ---------------------------------------------------------------- HLS

def hls_token(file_id: int, ttl: int = HLS_TOKEN_SECONDS) -> str:
    expires = int(time.time()) + ttl
    msg = f'{file_id}.{expires}'.encode()
    sig = hmac.new(settings.secret_key.encode(), msg, hashlib.sha256).hexdigest()[:24]
    return f'{expires}.{sig}'


def check_hls_token(file_id: int, token: str) -> bool:
    try:
        expires_str, sig = token.split('.', 1)
        expires = int(expires_str)
    except ValueError:
        return False
    if expires < time.time():
        return False
    msg = f'{file_id}.{expires}'.encode()
    expected = hmac.new(settings.secret_key.encode(), msg, hashlib.sha256).hexdigest()[:24]
    return hmac.compare_digest(sig, expected)


def normalize_hls_path(file, path: str) -> Optional[str]:
    """客户端请求的路径 → hls/ 下的相对路径。老 App 的路径名在这里换成新的。"""
    path = LEGACY_HLS_PATHS.get(path, path)
    renditions = media_info(file).get('renditions') or []
    top = f'{max(renditions)}p' if renditions else None
    # 源视频不到 1080p 时没有 1080p 目录，老 App 点 1080p 给最高那档
    if path.startswith('1080p/') and 1080 not in renditions and top:
        path = f'{top}/' + path.split('/', 1)[1]
    if '..' in path or path.startswith('/') or not path.endswith('.m3u8'):
        return None
    return path


def rewrite_playlist(file, path: str, text: str, token: Optional[str]) -> str:
    """改写播放列表：子播放列表指回后端，分片换成签名地址。

    token 为空表示老 App 走的 JWT 路径（/hls-proxy/...），子列表也走那个路径。
    """
    directory = path.rsplit('/', 1)[0] + '/' if '/' in path else ''
    remaining = HLS_TOKEN_SECONDS
    if token:
        remaining = max(600, int(token.split('.', 1)[0]) - int(time.time()))
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            lines.append(line)
            continue
        target = directory + line
        if line.endswith('.m3u8'):
            if token:
                lines.append(f'/api/files/hls/{file.id}/{token}/{target}')
            else:
                lines.append(f'/api/files/hls-proxy/{file.id}/{target}')
        else:
            # 分片比播放列表多留一小时，看到一半不会断
            lines.append(storage.sign_get(derived_key(file.s3_key, 'hls/' + target), remaining + 3600))
    return '\n'.join(lines) + '\n'


# ---------------------------------------------------------------- 媒体 FC 的结果

def apply_media_result(file, result: dict) -> None:
    """把 media.json（或 FC 回调）的内容写进 files 行。不 commit。

    result: {status, kind, width, height, orientation, duration, renditions, poster, thumbhash, error}
    v2 起还有 taken_at、audio、sprite、frames、beats（摘要，全量在 beats.json）、errors、version，
    v3 起还有 live_id（Live Photo 的照片和视频共用的标识）、音频的 playback（audio.m4a）和 waveform，
    见 fc/media/handler.py。
    width / height 是原始像素尺寸（没应用 EXIF），orientation 是 EXIF 方向。
    """
    status = result.get('status')
    if status not in ('ready', 'failed'):
        return
    old = media_info(file)
    if result.get('frames') and result['frames'] != old.get('frames'):
        # 帧重新抽过：帧 embedding、帧人脸要重跑
        file.frame_embedding_status = 'pending'
        file.frame_face_status = 'pending'
    file.media_status = status
    keep = ('kind', 'width', 'height', 'duration', 'renditions', 'poster', 'hdr', 'error',
            'taken_at', 'audio', 'sprite', 'frames', 'beats', 'preview', 'errors', 'version',
            'live_id', 'playback', 'waveform')
    file.media_info = json.dumps({k: result[k] for k in keep if result.get(k) is not None}, ensure_ascii=False)
    if result.get('thumbhash'):
        file.thumbhash = result['thumbhash']
    if result.get('taken_at'):
        file.taken_at = str(result['taken_at'])[:40]
    forget_beats(file.s3_key)
    if result.get('kind') == 'image' and result.get('width') and not file.raw_w:
        file.raw_w = int(result['width'])
        file.raw_h = int(result['height'])
        file.orientation = int(result.get('orientation') or 1)
    live_id = str(result.get('live_id') or '')[:64] or None
    if live_id and live_id != file.live_id:
        file.live_id = live_id
        from services import live_photo
        live_photo.pair(file)


def read_media_json(file) -> Optional[dict]:
    """桶里 FC 写好的 media.json；没有或读不了返回 None。"""
    try:
        text = storage.get_text(derived_key(file.s3_key, 'media.json'))
        data = json.loads(text) if text else None
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def ingest_media_json(file) -> bool:
    """还在等结果的文件，桶里已经有 FC 写好的 media.json 就收下。返回是否收到了。"""
    if file.media_status not in ('pending', None):
        return False
    data = read_media_json(file)
    if data is None:
        return False
    apply_media_result(file, data)
    return True


def after_result(file, data: dict) -> None:
    """收下 FC 结果、提交之后：把等着这个结果的后台任务叫起来。回调和补收共用。"""
    from services import lockai
    if is_video(file) and file.lockai_status == 'queued':
        # 排着队等视频处理好的 LockAI 分析可以开跑了
        lockai.kick()
    if is_video(file) and data.get('frames') and file.lockai_status == 'ready':
        # LockAI 分析过的视频重新抽了帧：帧 embedding 和人脸重跑
        from services import embed_trigger, face_trigger
        embed_trigger.kick_videos()
        face_trigger.kick_videos()
    elif is_image(file) and file.embedding_status == 'pending' and not oss_can_process(file):
        # 大图、HEIC / RAW 这类的 embedding 一直在等 preview.jpg，见 scripts/embed_worker.py 的 fetch_pending
        from services import embed_trigger
        embed_trigger.kick_images()


# 回调没送到时的补收：列表、详情、播放器信息出结果前，替还在处理中的文件去桶里看一眼 media.json。
# 本机开发时 FC 的回调打到线上，只能靠这个；线上丢了回调也不用等到凌晨的补收任务。
CATCH_UP_AFTER = 30      # 上传后多少秒才去看（FC 一般会先回调）
CATCH_UP_EVERY = 30      # 同一个文件多少秒内不重复看
CATCH_UP_MAX = 12        # 一次请求最多看几个
_caught: 'OrderedDict[int, float]' = OrderedDict()
_caught_lock = threading.Lock()


def catch_up(db, files) -> int:
    """files 里还在处理中、桶里已经有结果的收下并提交，返回收到几个。读桶失败只当没有。"""
    from concurrent.futures import ThreadPoolExecutor
    from datetime import datetime, timedelta

    # uploaded_at 存的是不带时区的 UTC
    cutoff = datetime.utcnow() - timedelta(seconds=CATCH_UP_AFTER)
    now = time.monotonic()
    due = []
    with _caught_lock:
        for file in files:
            if file.media_status not in ('pending', None) or not is_file_key(file.s3_key or ''):
                continue
            uploaded = getattr(file, 'uploaded_at', None)
            if uploaded is not None and uploaded.replace(tzinfo=None) > cutoff:
                continue
            last = _caught.get(file.id)
            if last is not None and now - last < CATCH_UP_EVERY:
                continue
            _caught[file.id] = now
            _caught.move_to_end(file.id)
            due.append(file)
            if len(due) >= CATCH_UP_MAX:
                break
        while len(_caught) > 4096:
            _caught.popitem(last=False)
    if not due:
        return 0

    with ThreadPoolExecutor(min(8, len(due))) as pool:
        found = list(pool.map(read_media_json, due))
    got = []
    for file, data in zip(due, found):
        if data and data.get('status') in ('ready', 'failed'):
            apply_media_result(file, data)
            got.append((file, data))
    if got:
        db.commit()
        for file, data in got:
            after_result(file, data)
    return len(got)


# ---------------------------------------------------------------- 节拍（beats.json）

_BEATS_TTL = 600
_BEATS_MAX = 256
_beats_cache: 'OrderedDict[str, tuple[float, dict]]' = OrderedDict()
_beats_lock = threading.Lock()


def forget_beats(key: str) -> None:
    with _beats_lock:
        _beats_cache.pop(key, None)


def load_allin1(file) -> Optional[dict]:
    """桶里的 allin1.json（All-In-One 函数分析时写的：{beats, downbeats, …}）。没有返回 None。

    老的 LockAI 分析结果里只存了小节头，拍点从这里补。和 beats.json 共用缓存，没有也记着，不反复去桶里找。
    """
    key = file.s3_key
    if not is_file_key(key):
        return None
    slot = key + '#allin1'
    now = time.monotonic()
    with _beats_lock:
        hit = _beats_cache.get(slot)
        if hit and now - hit[0] < _BEATS_TTL:
            return hit[1] or None
    try:
        text = storage.get_text(derived_key(key, 'allin1.json'))
        data = json.loads(text) if text else None
    except Exception:  # noqa: BLE001 读不到就当没有，八拍只是少一个模型的意见
        data = None
    if not isinstance(data, dict) or not isinstance(data.get('downbeats'), list):
        data = None
    with _beats_lock:
        _beats_cache[slot] = (now, data or {})
        while len(_beats_cache) > _BEATS_MAX:
            _beats_cache.popitem(last=False)
    return data


def load_beats(file) -> Optional[dict]:
    """桶里的 beats.json：{bpm, times, sections, envelope_rate, envelope}。没有返回 None。

    进程内缓存 10 分钟（节拍尺、对齐会反复读同一个）；媒体 FC 回调时清掉。
    """
    if not media_info(file).get('beats'):
        return None
    key = file.s3_key
    now = time.monotonic()
    with _beats_lock:
        hit = _beats_cache.get(key)
        if hit and now - hit[0] < _BEATS_TTL:
            _beats_cache.move_to_end(key)
            return hit[1]
    try:
        text = storage.get_text(derived_key(key, 'beats.json'))
        data = json.loads(text) if text else None
    except (ValueError, TypeError):
        data = None
    if not isinstance(data, dict) or not isinstance(data.get('times'), list) or not isinstance(data.get('sections'), list):
        return None
    with _beats_lock:
        _beats_cache[key] = (now, data)
        while len(_beats_cache) > _BEATS_MAX:
            _beats_cache.popitem(last=False)
    return data
