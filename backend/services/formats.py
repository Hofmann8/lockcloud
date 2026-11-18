"""文件格式表：LockCloud 收哪些文件、各归哪一类、在库里和桶里记成什么 Content-Type。

全站只认这一份：上传校验（files/validators.py）、上传签名用的 Content-Type（浏览器报的不算数，HEIC、mts
这类浏览器常报空的或怪的）、要不要等媒体 FC（services/media.py）、前端上传前的检查（GET /api/files/formats）。
媒体 FC 单独部署、读不到这个文件，fc/media/handler.py 里有一份副本，tests/test_formats.py 保证两边一致。

kind：
  image  图片。媒体 FC 读尺寸、方向、拍摄时间。常见格式（OSS_IMAGE）的缩略图由 OSS 图片处理从原图现切；
         别的（HEIC、AVIF、TIFF、相机 RAW）OSS 切不了或切不准，FC 另存一张转正的 preview.jpg 给它切
  video  视频。FC 转 HLS、封面、抽帧、节拍（ffmpeg 什么都能解）
  audio  音频。FC 转成统一的 audio.m4a、波形、专辑封面、节拍
  other  只存不处理（文档、压缩包），没有缩略图和预览
"""
from __future__ import annotations

from typing import Optional

MAX_UPLOAD = 2 * 1024 * 1024 * 1024

# 扩展名（小写，不带点）→ (kind, Content-Type)
FORMATS: dict[str, tuple[str, str]] = {
    # 图片：常见格式
    'jpg': ('image', 'image/jpeg'),
    'jpeg': ('image', 'image/jpeg'),
    'png': ('image', 'image/png'),
    'gif': ('image', 'image/gif'),
    'bmp': ('image', 'image/bmp'),
    'webp': ('image', 'image/webp'),
    # 图片：手机的新格式和 TIFF
    'heic': ('image', 'image/heic'),
    'heif': ('image', 'image/heif'),
    'avif': ('image', 'image/avif'),
    'tif': ('image', 'image/tiff'),
    'tiff': ('image', 'image/tiff'),
    # 图片：相机 RAW（iPhone 的 ProRAW 是 DNG）
    'dng': ('image', 'image/x-adobe-dng'),
    'cr2': ('image', 'image/x-canon-cr2'),
    'cr3': ('image', 'image/x-canon-cr3'),
    'nef': ('image', 'image/x-nikon-nef'),
    'arw': ('image', 'image/x-sony-arw'),
    'raf': ('image', 'image/x-fuji-raf'),
    'orf': ('image', 'image/x-olympus-orf'),
    'rw2': ('image', 'image/x-panasonic-rw2'),
    # 视频
    'mp4': ('video', 'video/mp4'),
    'm4v': ('video', 'video/x-m4v'),
    'mov': ('video', 'video/quicktime'),
    'avi': ('video', 'video/x-msvideo'),
    'mkv': ('video', 'video/x-matroska'),
    'webm': ('video', 'video/webm'),
    'flv': ('video', 'video/x-flv'),
    'wmv': ('video', 'video/x-ms-wmv'),
    '3gp': ('video', 'video/3gpp'),
    'mts': ('video', 'video/mp2t'),
    'm2ts': ('video', 'video/mp2t'),
    'mpg': ('video', 'video/mpeg'),
    'mpeg': ('video', 'video/mpeg'),
    # 音频
    'mp3': ('audio', 'audio/mpeg'),
    'm4a': ('audio', 'audio/mp4'),
    'aac': ('audio', 'audio/aac'),
    'wav': ('audio', 'audio/wav'),
    'flac': ('audio', 'audio/flac'),
    'ogg': ('audio', 'audio/ogg'),
    'oga': ('audio', 'audio/ogg'),
    'opus': ('audio', 'audio/opus'),
    'wma': ('audio', 'audio/x-ms-wma'),
    'aiff': ('audio', 'audio/aiff'),
    'aif': ('audio', 'audio/aiff'),
    'amr': ('audio', 'audio/amr'),
    # 只存不处理
    'svg': ('other', 'image/svg+xml'),
    'pdf': ('other', 'application/pdf'),
    'doc': ('other', 'application/msword'),
    'docx': ('other', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    'xls': ('other', 'application/vnd.ms-excel'),
    'xlsx': ('other', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    'ppt': ('other', 'application/vnd.ms-powerpoint'),
    'pptx': ('other', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
    'txt': ('other', 'text/plain'),
    'zip': ('other', 'application/zip'),
    'rar': ('other', 'application/vnd.rar'),
    '7z': ('other', 'application/x-7z-compressed'),
    'tar': ('other', 'application/x-tar'),
    'gz': ('other', 'application/gzip'),
}

# OSS 图片处理直接从原图切缩略图的格式。它文档上也收 HEIC、AVIF、TIFF，但这几种的方向信息
# （HEIF 的 irot、EXIF）它怎么处理拿不准，统一由 FC 转正后另存 preview.jpg，结果可控
OSS_IMAGE = frozenset({'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'})

# 媒体 FC 会处理的类别（其余 skipped）
PROCESSED = frozenset({'image', 'video', 'audio'})


def ext_of(name: Optional[str]) -> str:
    """文件名或桶里的 key 的扩展名（小写，不带点）。没有扩展名返回 ''。"""
    base = (name or '').replace('\\', '/').rsplit('/', 1)[-1]
    return base.rsplit('.', 1)[-1].lower() if '.' in base else ''


def kind_of(name: Optional[str]) -> Optional[str]:
    """按扩展名归类；表里没有返回 None。"""
    entry = FORMATS.get(ext_of(name))
    return entry[0] if entry else None


def content_type_of(name: Optional[str]) -> Optional[str]:
    entry = FORMATS.get(ext_of(name))
    return entry[1] if entry else None


def extensions(kind: Optional[str] = None) -> set[str]:
    return {e for e, (k, _) in FORMATS.items() if kind is None or k == kind}


def public_list() -> list[dict]:
    """给前端：[{ext, kind}]，按类别、扩展名排好。"""
    order = {'image': 0, 'video': 1, 'audio': 2, 'other': 3}
    return [{'ext': e, 'kind': k} for e, (k, _) in sorted(FORMATS.items(), key=lambda x: (order[x[1][0]], x[0]))]
