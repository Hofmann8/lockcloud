"""LockCloud 媒体 FC：文件传进 lock-cloud 桶后做预处理。

阿里云 FC 3.0 custom container，挂 OSS 触发器（前缀 files/）。自己的产物全写在 media/ 下，
不会再触发自己。

  图片：原始尺寸、EXIF 方向、拍摄时间、thumbhash、Live Photo 标识。缩略图不用做，OSS 图片处理现算；
        原图超过 20 MB（OSS 图片处理的上限）时另存一张缩小的 preview.jpg 给它现算。
        HEIC / HEIF / AVIF / TIFF / 相机 RAW（OSS 不切的格式）一律另存一张转正的 preview.jpg，
        这时尺寸是转正后的、方向记 1。HEIC 靠 pillow-heif，RAW 靠 rawpy，AVIF Pillow 自带。
  视频分几步（steps），默认全跑：
    transcode  ffprobe → HLS（1080p + 720p，源不到 1080 只出 720p 一档，不放大）→ 封面 → thumbhash。
               HDR（iPhone 的 HLG / PQ）先色调映射成 SDR；手机竖拍的旋转交给 ffmpeg 自动处理。
    sprite     拖进度条的预览图：每隔 interval 秒一张小图，10×10 拼成一张
    frames     每 2 秒一帧 768px 的图，给视频片段搜索、视频里找人用
    beats      节拍、bpm、八拍分段、起音包络（并排对比自动对齐用），见 beats.py
  拍摄时间每次都读（ffprobe 顺带的）。transcode 以外的步骤失败只记进 errors，整体仍是 ready。
  iPhone 的 Live Photo 视频还读出 live_id（和照片的配对，见后端 services/live_photo.py）。
  音频分两步：
    transcode  转成统一的 audio.m4a（AAC 192k，所有浏览器都能放）、波形（waveform，WAVE_POINTS 个 0–100）、
               有专辑封面的抽成 poster.jpg
    beats      同视频

产物：
  media/{uuid}/hls/master.m3u8
  media/{uuid}/hls/{1080p,720p}/index.m3u8 + seg_00000.ts …
  media/{uuid}/poster.jpg
  media/{uuid}/sprite/0.jpg, 1.jpg …
  media/{uuid}/frames/00000.jpg …   第 i 张在 i × interval 秒
  media/{uuid}/beats.json
  media/{uuid}/preview.jpg     超过 20 MB 的图片的缩小版（长边 6144，原始朝向，带 EXIF 方向）；
                               OSS 不切的格式是转正的（方向 1）
  media/{uuid}/audio.m4a       音频转好的播放文件
  media/{uuid}/media.json      结果，最后写。后端确认上传时和每天的补收都读它
  media/_downloads/{id}.zip    打包下载（/jobs/zip），桶的生命周期规则 1 天后删

写完 media.json 回调后端 POST {MEDIA_CALLBACK_URL}（X-Media-Token），后端据此更新 files 行。

请求：
  POST /invoke（OSS 触发器投递，不鉴权）
    OSS 触发器：{"events": [{"oss": {"bucket": {"name": ...}, "object": {"key": ..., "size": ...}}}]}
    手动重跑：  {"key": "files/{uuid}.mp4"}
    只补某几步：{"key": "files/{uuid}.mp4", "steps": ["sprite", "beats"]}
               结果合并进已有的 media.json；原来没有成功的 media.json 就照全跑处理
  后端经 HTTP 触发器异步调用（X-Fc-Invocation-Type: Async），要带 X-Media-Token（= MEDIA_CALLBACK_TOKEN）：
  POST /jobs/process  {"key": "files/...", "steps": [...]}，同 /invoke（管理页的"重跑"）
  POST /jobs/zip      {"id": "d_...", "items": [{"key": "files/...", "name": "活动/显示名.mp4"}],
                       "out": "media/_downloads/d_....zip"}
                      逐个从桶里流式读进本地的不压缩 zip（媒体本身压过），分片传到 out，
                      开始和结束各回调一次后端 /api/files/internal/job-result。后端限制合计 ≤ 8 GB（磁盘 10 GB）。

环境变量：
  OSS_BUCKET              默认 lock-cloud
  OSS_REGION              默认 cn-hangzhou
  OSS_ENDPOINT            默认杭州内网 https://oss-cn-hangzhou-internal.aliyuncs.com
  MEDIA_CALLBACK_URL      https://cloud.funk-and.love/api/files/internal/media-result
                          打包任务回调同目录的 job-result（JOB_CALLBACK_URL 可以单独指定）
  MEDIA_CALLBACK_TOKEN    跟后端 .env 同一个值；/jobs/* 也用它鉴权
  X264_PRESET             默认 veryfast
  LOCAL_LIMIT_MB          原视频大于这个就不下载，ffmpeg 直接读签名地址。默认 3000
  访问 OSS 用函数角色的临时凭据（FC 放在请求头里），没配角色时读
  ALIBABA_CLOUD_ACCESS_KEY_ID / ALIBABA_CLOUD_ACCESS_KEY_SECRET。
"""
import hmac
import io
import json
import math
import os
import re
import shutil
import struct
import subprocess
import tempfile
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import numpy as np
import oss2
import requests
from flask import Flask, jsonify, request
from oss2.credentials import StaticCredentialsProvider
from PIL import Image, ImageOps

import beats
from thumbhash import image_to_thumbhash

try:  # HEIC / HEIF。镜像里一定有（Dockerfile 构建时检查），这里容错是为了本地跑测试
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:  # pragma: no cover
    pass
try:  # 相机 RAW
    import rawpy
except ImportError:  # pragma: no cover
    rawpy = None

PORT = int(os.environ.get('FC_SERVER_PORT', os.environ.get('PORT', '9000')))
BUCKET = os.environ.get('OSS_BUCKET', 'lock-cloud')
REGION = os.environ.get('OSS_REGION', 'cn-hangzhou')
ENDPOINT = os.environ.get('OSS_ENDPOINT', 'https://oss-cn-hangzhou-internal.aliyuncs.com')
CALLBACK_URL = os.environ.get('MEDIA_CALLBACK_URL', '')
CALLBACK_TOKEN = os.environ.get('MEDIA_CALLBACK_TOKEN', '')
JOB_CALLBACK_URL = os.environ.get('JOB_CALLBACK_URL', '')
PRESET = os.environ.get('X264_PRESET', 'veryfast')
LOCAL_LIMIT = int(os.environ.get('LOCAL_LIMIT_MB', '3000')) * 1024 * 1024
OSS_IMAGE_LIMIT = 20 * 1024 * 1024  # OSS 图片处理只收这么大以内的原图
PREVIEW_EDGE = 6144  # 大图另存的缩小版的长边
# 比函数超时（7200 秒）短，留时间上传和写 media.json；超时记成 failed，不会卡在 pending
TRANSCODE_TIMEOUT = 6600

# 格式表 backend/services/formats.py 的副本（FC 单独部署读不到它），tests/test_formats.py 保证一致
OSS_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
HEIF_EXTENSIONS = {'.heic', '.heif'}
RAW_EXTENSIONS = {'.dng', '.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rw2'}
IMAGE_EXTENSIONS = OSS_IMAGE_EXTENSIONS | HEIF_EXTENSIONS | RAW_EXTENSIONS | {'.avif', '.tif', '.tiff'}
VIDEO_EXTENSIONS = {'.mp4', '.m4v', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.3gp', '.mts', '.m2ts',
                    '.mpg', '.mpeg'}
AUDIO_EXTENSIONS = {'.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.oga', '.opus', '.wma', '.aiff', '.aif',
                    '.amr'}
FILE_KEY = re.compile(r'^files/([0-9a-f]{32})(\.[a-z0-9]{1,8})?$')

# 清晰度档位：短边像素、码率上限、H.264 level（写进 CODECS）
RENDITIONS = {
    1080: {'maxrate': 6000, 'crf': 21, 'level': '4.2', 'codec': 'avc1.64002a'},
    720: {'maxrate': 3500, 'crf': 22, 'level': '4.0', 'codec': 'avc1.640028'},
}
SEGMENT_SECONDS = 4
MAX_FPS = 60
HDR_TRANSFERS = {'smpte2084', 'arib-std-b67'}

VIDEO_STEPS = ('transcode', 'sprite', 'frames', 'beats')
AUDIO_STEPS = ('transcode', 'beats')
MEDIA_VERSION = 3
WAVE_POINTS = 120      # 音频波形的点数（卡片、播放器上画）
COVER_LONG = 1024      # 专辑封面长边
SPRITE_LONG = 160      # 预览小图长边
SPRITE_GRID = 10       # 每张拼 10×10
SPRITE_MAX = 400       # 最多多少张小图，超过就拉长间隔
FRAME_LONG = 768
FRAME_EVERY = 2.0
FRAME_MAX = 1800

ZIP_PREFIX = 'media/_downloads/'
ZIP_ID = re.compile(r'^d_[0-9a-f]{32}$')
ZIP_CHUNK = 8 * 1024 * 1024
ZIP_PART = 64 * 1024 * 1024    # 分片上传的片大小，8 GB 约 128 片

Image.MAX_IMAGE_PIXELS = 400_000_000

app = Flask(__name__)


class Permanent(Exception):
    """文件本身的问题（坏文件、解不了码），重试没用，记成 failed。"""


# ---------------------------------------------------------------- OSS

def _bucket() -> oss2.Bucket:
    h = request.headers
    key_id = h.get('x-fc-access-key-id') or os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_ID')
    secret = h.get('x-fc-access-key-secret') or os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
    token = h.get('x-fc-security-token') or os.environ.get('ALIBABA_CLOUD_SECURITY_TOKEN')
    if not key_id or not secret:
        raise RuntimeError('没有 OSS 凭据：环境变量填 ALIBABA_CLOUD_ACCESS_KEY_ID / SECRET，或给函数配角色')
    auth = oss2.ProviderAuthV4(StaticCredentialsProvider(key_id, secret, token))
    return oss2.Bucket(auth, ENDPOINT, BUCKET, region=REGION, connect_timeout=30)


def _content_type(name: str) -> str:
    if name.endswith('.m3u8'):
        return 'application/vnd.apple.mpegurl'
    if name.endswith('.ts'):
        return 'video/mp2t'
    if name.endswith('.jpg'):
        return 'image/jpeg'
    if name.endswith('.json'):
        return 'application/json'
    return 'application/octet-stream'


def _upload_dir(bucket, local_dir: str, prefix: str) -> None:
    files = []
    for root, _, names in os.walk(local_dir):
        for name in names:
            path = os.path.join(root, name)
            rel = os.path.relpath(path, local_dir).replace(os.sep, '/')
            files.append((path, prefix + rel))

    def put(item):
        path, key = item
        oss2.resumable_upload(bucket, key, path, headers={'Content-Type': _content_type(key)})

    with ThreadPoolExecutor(8) as pool:
        list(pool.map(put, files))


def _clear_prefix(bucket, prefix: str) -> None:
    """重跑时先清掉上一次的 HLS，分片数量变了也不会留残片。"""
    keys = [o.key for o in oss2.ObjectIterator(bucket, prefix=prefix)]
    for i in range(0, len(keys), 1000):
        bucket.batch_delete_objects(keys[i:i + 1000])


# ---------------------------------------------------------------- 工具

def _run(cmd: list, timeout: int = None) -> str:
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
    if proc.returncode != 0:
        tail = (proc.stderr or '').strip().splitlines()[-8:]
        raise Permanent(f'{os.path.basename(cmd[0])} 失败: ' + ' | '.join(tail))
    return proc.stdout


def _even(v: float) -> int:
    return max(2, int(round(v / 2)) * 2)


def _fps(stream: dict) -> float:
    for field in ('avg_frame_rate', 'r_frame_rate'):
        num, _, den = (stream.get(field) or '0/0').partition('/')
        try:
            if float(den or 1):
                return float(num) / float(den or 1)
        except ValueError:
            pass
    return 0.0


def _taken_at(value, offset: str = '') -> str:
    """各种拍摄时间写法 → ISO 8601。带时区就带上，不带就是拍摄地本地时间。认不出或明显是占位值返回空串。
      EXIF：'2025:10:21 01:39:15' + OffsetTimeOriginal '+08:00'
      iPhone 视频：'2025-10-21T01:39:15+0800'
      其他视频的 creation_time：'2025-10-20T17:39:15.000000Z'（UTC）"""
    text = str(value or '').strip().rstrip('\x00')
    if not text:
        return ''
    if re.match(r'^\d{4}:\d{2}:\d{2} ', text):
        text = text[:10].replace(':', '-') + 'T' + text[11:]
    text = text.replace('Z', '+00:00')
    text = re.sub(r'([+-]\d{2})(\d{2})$', r'\1:\2', text)
    if offset and re.fullmatch(r'[+-]\d{2}:\d{2}', offset.strip()) and not re.search(r'[+-]\d{2}:\d{2}$', text[10:]):
        text += offset.strip()
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return ''
    if not 2000 <= dt.year <= 2100:  # 1904 / 1970 这类没设时间的默认值
        return ''
    return dt.replace(microsecond=0).isoformat()


def _rotation(stream: dict) -> int:
    for item in stream.get('side_data_list') or []:
        if 'rotation' in item:
            return int(float(item['rotation']))
    try:
        return int(stream.get('tags', {}).get('rotate', 0))
    except ValueError:
        return 0


# ---------------------------------------------------------------- 图片

def apple_content_id(sub) -> str:
    """Live Photo 的标识：Apple MakerNote（Exif 子目录 0x927C）里的 ContentIdentifier（0x0011）。
    MakerNote 开头是 "Apple iOS" 加一个 0 字节、2 字节版本、字节序（MM / II），偏移 14 起是一个 IFD，
    偏移量从 MakerNote 开头算。"""
    note = sub.get(0x927C) if sub else None
    if not isinstance(note, bytes) or not note.startswith(b'Apple iOS\0') or len(note) < 16:
        return ''
    order = {b'MM': '>', b'II': '<'}.get(note[12:14])
    if not order:
        return ''
    try:
        (count,) = struct.unpack(order + 'H', note[14:16])
        for i in range(min(count, 512)):
            at = 16 + 12 * i
            tag, typ, n, value = struct.unpack(order + 'HHII', note[at:at + 12])
            if tag == 0x0011 and typ == 2:
                raw = note[at + 8:at + 8 + n] if n <= 4 else note[value:value + n]
                return raw.split(b'\0', 1)[0].decode('ascii', 'ignore').strip()[:64]
    except struct.error:
        return ''
    return ''


def _rgb(img: Image.Image) -> Image.Image:
    """16 位、浮点的 TIFF 直接转 RGB 会过曝成一片白，先按比例压到 8 位。"""
    if img.mode in ('I;16', 'I;16B', 'I;16L', 'I'):
        img = img.convert('I').point(lambda v: v * (1 / 256)).convert('L')
    elif img.mode == 'F':
        img = img.point(lambda v: v * 255).convert('L')
    return img


def _exif_fields(exif) -> tuple:
    sub = exif.get_ifd(0x8769)  # Exif 子目录：DateTimeOriginal、OffsetTimeOriginal、MakerNote
    taken_at = _taken_at(sub.get(0x9003) or exif.get(0x0132), sub.get(0x9011) or sub.get(0x9010) or '')
    return taken_at, apple_content_id(sub)


def process_image(path: str, bucket, uid: str, work: str) -> dict:
    ext = os.path.splitext(path)[1].lower()
    if ext in RAW_EXTENSIONS:
        return process_raw(path, bucket, uid, work)
    out = os.path.join(work, 'preview.jpg')
    try:
        with Image.open(path) as img:
            exif = img.getexif()
            taken_at, live_id = _exif_fields(exif)
            preview = None
            if ext in OSS_IMAGE_EXTENSIONS:
                raw_w, raw_h = img.size
                orientation = int(exif.get(0x0112, 1) or 1)
                orientation = orientation if 1 <= orientation <= 8 else 1
                img.seek(0)
                upright = ImageOps.exif_transpose(img)
                thumbhash = image_to_thumbhash(upright)
                if os.path.getsize(path) > OSS_IMAGE_LIMIT:
                    preview = make_preview(img, orientation, out)
            else:
                # HEIF 的旋转（irot）解码时已经转好了，EXIF 方向只是参考（规范如此），不能再转一次；
                # AVIF、TIFF 解出来是原始像素，按 EXIF 转正
                img.seek(0)
                upright = _rgb(img if ext in HEIF_EXTENSIONS else ImageOps.exif_transpose(img))
                raw_w, raw_h = upright.size
                orientation = 1
                thumbhash = image_to_thumbhash(upright)
                preview = make_preview(upright, 1, out)
    except (OSError, SyntaxError, ValueError, Image.DecompressionBombError) as e:
        raise Permanent(f'图片读不了: {e}')
    if preview:
        bucket.put_object_from_file(f'media/{uid}/preview.jpg', out, headers={'Content-Type': 'image/jpeg'})
    return {
        'status': 'ready',
        'kind': 'image',
        'width': raw_w,
        'height': raw_h,
        'orientation': orientation,
        'taken_at': taken_at,
        'thumbhash': thumbhash,
        **({'preview': preview} if preview else {}),
        **({'live_id': live_id} if live_id else {}),
    }


def _raw_exif(path: str, raw) -> tuple:
    """RAW 的拍摄时间：DNG、CR2、NEF、ARW 这些是 TIFF 结构，Pillow 能直接读 EXIF；读不了再看内嵌的 JPEG 预览。"""
    try:
        with Image.open(path) as im:
            return _exif_fields(im.getexif())
    except Exception:  # noqa: BLE001
        pass
    try:
        thumb = raw.extract_thumb()
        if thumb.format == rawpy.ThumbFormat.JPEG:
            with Image.open(io.BytesIO(thumb.data)) as im:
                return _exif_fields(im.getexif())
    except Exception:  # noqa: BLE001
        pass
    return None, ''


def process_raw(path: str, bucket, uid: str, work: str) -> dict:
    """相机 RAW：rawpy（LibRaw）按相机白平衡解成转正的 8 位 RGB，存 preview.jpg。原图原样留着给人下载。"""
    if rawpy is None:
        raise Permanent('RAW 解码库没装')
    try:
        with rawpy.imread(path) as raw:
            rgb = raw.postprocess(use_camera_wb=True, output_bps=8)
            taken_at, live_id = _raw_exif(path, raw)
    except Exception as e:  # noqa: BLE001  LibRawError 等
        raise Permanent(f'RAW 读不了: {e}')
    upright = Image.fromarray(rgb)
    out = os.path.join(work, 'preview.jpg')
    preview = make_preview(upright, 1, out)
    bucket.put_object_from_file(f'media/{uid}/preview.jpg', out, headers={'Content-Type': 'image/jpeg'})
    return {
        'status': 'ready',
        'kind': 'image',
        'width': upright.width,
        'height': upright.height,
        'orientation': 1,
        'taken_at': taken_at,
        'thumbhash': image_to_thumbhash(upright),
        'preview': preview,
        **({'live_id': live_id} if live_id else {}),
    }


def make_preview(img: Image.Image, orientation: int, out: str) -> dict:
    """OSS 图片处理切不了原图时（超过 20 MB、不是常见格式），存一张缩小的 JPEG 给缩略图、大图预览、裁脸用。
    和 raw 坐标同一个朝向，只带 EXIF 方向这一项：后端照旧 auto-orient、按 raw 坐标乘比例裁脸。"""
    img.seek(0)
    im = img.convert('RGBA') if img.mode in ('RGBA', 'LA', 'P', 'PA') else img.convert('RGB')
    if im.mode == 'RGBA':  # 透明的地方铺白
        base = Image.new('RGB', im.size, (255, 255, 255))
        base.paste(im, mask=im.getchannel('A'))
        im = base
    im.thumbnail((PREVIEW_EDGE, PREVIEW_EDGE), Image.LANCZOS)
    exif = Image.Exif()
    exif[0x0112] = orientation
    for quality in (90, 80, 70):
        im.save(out, 'JPEG', quality=quality, optimize=True, exif=exif.tobytes())
        if os.path.getsize(out) < OSS_IMAGE_LIMIT:
            break
    return {'width': im.width, 'height': im.height}


# ---------------------------------------------------------------- 视频

def probe(src: str) -> dict:
    out = _run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', src],
               timeout=300)
    data = json.loads(out)
    video = next((s for s in data.get('streams', []) if s.get('codec_type') == 'video'
                  and not (s.get('disposition') or {}).get('attached_pic')), None)
    if not video:
        raise Permanent('没有视频流')
    audio = any(s.get('codec_type') == 'audio' for s in data.get('streams', []))
    w, h = int(video.get('width') or 0), int(video.get('height') or 0)
    if not w or not h:
        raise Permanent('读不到视频尺寸')
    if abs(_rotation(video)) % 180 == 90:
        w, h = h, w
    try:
        duration = float(data.get('format', {}).get('duration') or video.get('duration') or 0)
    except ValueError:
        duration = 0.0
    # iPhone 的 creationdate 是拍摄地本地时间带时区，优先；creation_time 是 UTC，微信转发过的会变成转发时间
    tags = {k.lower(): v for k, v in (data.get('format', {}).get('tags') or {}).items()}
    vtags = {k.lower(): v for k, v in (video.get('tags') or {}).items()}
    taken_at = (_taken_at(tags.get('com.apple.quicktime.creationdate'))
                or _taken_at(tags.get('creation_time')) or _taken_at(vtags.get('creation_time')))
    return {
        'width': w,  # 转正后的显示尺寸
        'height': h,
        'duration': round(duration, 3),
        'fps': _fps(video),
        'audio': audio,
        'transfer': video.get('color_transfer') or '',
        'taken_at': taken_at,
        # Live Photo 的视频：和照片 MakerNote 里的 ContentIdentifier 是同一个值
        'live_id': str(tags.get('com.apple.quicktime.content.identifier') or '').strip()[:64],
    }


def _tonemap(transfer: str) -> str:
    # HLG / PQ → 线性 → BT.709 SDR。源文件常常没标全色彩信息，这里按探测到的传递函数写死输入参数
    return (f'zscale=tin={transfer}:min=bt2020nc:pin=bt2020:t=linear:npl=100,format=gbrpf32le,'
            'zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv')


def plan_renditions(width: int, height: int) -> list:
    """返回 [(档位, 输出宽, 输出高)]，从高到低。按短边定档，竖屏视频同样适用。"""
    short = min(width, height)
    tiers = [1080, 720] if short >= 1080 else [720]
    plan = []
    for tier in tiers:
        target = min(tier, short)  # 不放大
        scale = target / short
        plan.append((tier, _even(width * scale), _even(height * scale)))
    return plan


def transcode(src: str, info: dict, out_dir: str) -> list:
    plan = plan_renditions(info['width'], info['height'])
    hdr = info['transfer'] in HDR_TRANSFERS

    # 先缩到最高档再做色调映射（4K 直接映射太慢），然后一路分几份
    top_w, top_h = plan[0][1], plan[0][2]
    chain = [f'scale={top_w}:{top_h}']
    if hdr:
        chain.append(_tonemap(info['transfer']))
    if info['fps'] > MAX_FPS:
        chain.append(f'fps={MAX_FPS}')
    chain.append('format=yuv420p')
    labels = [f'v{i}' for i in range(len(plan))]
    graph = f'[0:v]{",".join(chain)},split={len(plan)}' + ''.join(f'[s{i}]' for i in range(len(plan)))
    for i, (_, w, h) in enumerate(plan):
        graph += f';[s{i}]' + ('null' if i == 0 else f'scale={w}:{h}') + f'[{labels[i]}]'

    cmd = ['ffmpeg', '-hide_banner', '-nostdin', '-y', '-i', src, '-filter_complex', graph]
    for i, (tier, _, _) in enumerate(plan):
        spec = RENDITIONS[tier]
        rdir = os.path.join(out_dir, f'{tier}p')
        os.makedirs(rdir, exist_ok=True)
        cmd += ['-map', f'[{labels[i]}]']
        if info['audio']:
            cmd += ['-map', '0:a:0?', '-c:a', 'aac', '-b:a', '128k', '-ac', '2']
        cmd += [
            '-c:v', 'libx264', '-preset', PRESET, '-profile:v', 'high', '-level:v', spec['level'],
            '-crf', str(spec['crf']), '-maxrate', f"{spec['maxrate']}k", '-bufsize', f"{spec['maxrate'] * 2}k",
            '-force_key_frames', f'expr:gte(t,n_forced*{SEGMENT_SECONDS})',
            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
            '-f', 'hls', '-hls_time', str(SEGMENT_SECONDS), '-hls_playlist_type', 'vod',
            '-hls_flags', 'independent_segments', '-hls_segment_type', 'mpegts',
            '-hls_segment_filename', os.path.join(rdir, 'seg_%05d.ts'),
            os.path.join(rdir, 'index.m3u8'),
        ]
    _run(cmd, timeout=TRANSCODE_TIMEOUT)
    write_master(out_dir, plan, info['audio'])
    return plan


def _bandwidth(rdir: str) -> tuple:
    """按实际分片算码率：(峰值, 平均)，单位 bit/s。"""
    text = open(os.path.join(rdir, 'index.m3u8'), encoding='utf-8').read()
    peak, total_bits, total_secs, duration = 0, 0, 0.0, None
    for line in text.splitlines():
        if line.startswith('#EXTINF:'):
            duration = float(line[8:].split(',')[0])
        elif line and not line.startswith('#') and duration:
            bits = os.path.getsize(os.path.join(rdir, line)) * 8
            peak = max(peak, bits / duration)
            total_bits += bits
            total_secs += duration
            duration = None
    avg = total_bits / total_secs if total_secs else 0
    return int(peak * 1.1) or 1, int(avg) or 1


def write_master(out_dir: str, plan: list, audio: bool) -> None:
    lines = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-INDEPENDENT-SEGMENTS']
    for tier, w, h in plan:
        peak, avg = _bandwidth(os.path.join(out_dir, f'{tier}p'))
        codecs = RENDITIONS[tier]['codec'] + (',mp4a.40.2' if audio else '')
        lines.append(f'#EXT-X-STREAM-INF:BANDWIDTH={peak},AVERAGE-BANDWIDTH={avg},'
                     f'RESOLUTION={w}x{h},CODECS="{codecs}"')
        lines.append(f'{tier}p/index.m3u8')
    with open(os.path.join(out_dir, 'master.m3u8'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')


def make_poster(src: str, info: dict, plan: list, path: str) -> str:
    """封面取第 1 秒（短视频取中间），尺寸同最高档。返回 thumbhash。"""
    at = min(1.0, info['duration'] / 2) if info['duration'] else 0
    _, w, h = plan[0]
    chain = [f'scale={w}:{h}']
    if info['transfer'] in HDR_TRANSFERS:
        chain.append(_tonemap(info['transfer']))
    chain.append('format=yuvj420p')
    _run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-ss', f'{at:.3f}', '-i', src,
          '-frames:v', '1', '-vf', ','.join(chain), '-q:v', '3', path], timeout=300)
    with Image.open(path) as img:
        return image_to_thumbhash(img)


def _fit(width: int, height: int, long_side: int) -> tuple:
    scale = min(1.0, long_side / max(width, height))
    return _even(width * scale), _even(height * scale)


def extract_stills(src: str, info: dict, hdr: bool, work: str, sprite: bool, frames: bool) -> dict:
    """一次解码同时出预览小图和检索用帧。src 可以是原片，也可以是刚转好的 720p HLS（已经是 SDR）。"""
    duration = info['duration']
    if not duration:
        raise Permanent('没有时长，抽不了帧')
    outputs, result = [], {}
    if sprite:
        interval = max(1.0, math.ceil(duration / SPRITE_MAX * 2) / 2)
        w, h = _fit(info['width'], info['height'], SPRITE_LONG)
        outputs.append(('sprite', interval, w, h, 5))
    if frames:
        interval = max(FRAME_EVERY, float(math.ceil(duration / FRAME_MAX)))
        w, h = _fit(info['width'], info['height'], FRAME_LONG)
        outputs.append(('frames', interval, w, h, 4))

    graph = f'[0:v]split={len(outputs)}' + ''.join(f'[in{i}]' for i in range(len(outputs)))
    cmd = ['ffmpeg', '-hide_banner', '-nostdin', '-y', '-i', src]
    maps = []
    for i, (name, interval, w, h, q) in enumerate(outputs):
        chain = [f'fps=1/{interval}', f'scale={w}:{h}']
        if hdr:
            chain.append(_tonemap(info['transfer']))
        chain.append('format=yuvj420p')
        graph += f';[in{i}]{",".join(chain)}[out{i}]'
        out_dir = os.path.join(work, name + '_raw')
        os.makedirs(out_dir, exist_ok=True)
        maps += ['-map', f'[out{i}]', '-q:v', str(q), os.path.join(out_dir, '%05d.jpg')]
    _run(cmd + ['-filter_complex', graph] + maps, timeout=TRANSCODE_TIMEOUT)

    for name, interval, w, h, _ in outputs:
        raw_dir = os.path.join(work, name + '_raw')
        # ffmpeg 的 %05d 从 1 开始，改成从 0 开始：第 i 张就在 i × interval 秒
        names = sorted(os.listdir(raw_dir))
        if not names:
            raise Permanent(f'{name} 一帧都没抽出来')
        if name == 'frames':
            out_dir = os.path.join(work, 'frames')
            os.makedirs(out_dir, exist_ok=True)
            for i, n in enumerate(names):
                os.replace(os.path.join(raw_dir, n), os.path.join(out_dir, f'{i:05d}.jpg'))
            result['frames'] = {'interval': interval, 'count': len(names), 'width': w, 'height': h}
        else:
            result['sprite'] = _tile(raw_dir, names, os.path.join(work, 'sprite'), w, h)
            result['sprite']['interval'] = interval
    return result


def _tile(raw_dir: str, names: list, out_dir: str, w: int, h: int) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    per = SPRITE_GRID * SPRITE_GRID
    sheets = math.ceil(len(names) / per)
    for s in range(sheets):
        chunk = names[s * per:(s + 1) * per]
        rows = math.ceil(len(chunk) / SPRITE_GRID)
        sheet = Image.new('RGB', (w * SPRITE_GRID, h * rows))
        for i, n in enumerate(chunk):
            with Image.open(os.path.join(raw_dir, n)) as im:
                sheet.paste(im.convert('RGB').resize((w, h)), ((i % SPRITE_GRID) * w, (i // SPRITE_GRID) * h))
        sheet.save(os.path.join(out_dir, f'{s}.jpg'), quality=72, optimize=True)
    # 第 i 张小图：第 i // 100 张大图，列 i % 10，行 (i % 100) // 10
    return {'count': len(names), 'sheets': sheets, 'cols': SPRITE_GRID, 'width': w, 'height': h}


def analyze_beats(src: str) -> dict:
    proc = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', src, '-vn', '-ac', '1',
                           '-ar', str(beats.SR), '-f', 'f32le', '-'], capture_output=True, timeout=1800)
    if proc.returncode != 0:
        raise Permanent('音轨解不开: ' + proc.stderr.decode(errors='replace').strip()[-300:])
    y = np.frombuffer(proc.stdout, dtype=np.float32)
    if len(y) < beats.SR * 4:
        raise Permanent('音轨太短')
    return beats.analyze(y)


def _download_rendition(bucket, uid: str, tier: int, work: str) -> str:
    """补跑时把桶里已有的最低一档 HLS 拉到本地，抽帧不用再解原片（4K 原片解码比 720p 慢十几倍）。"""
    prefix = f'media/{uid}/hls/{tier}p/'
    local = os.path.join(work, 'existing', f'{tier}p')
    os.makedirs(local, exist_ok=True)
    keys = [o.key for o in oss2.ObjectIterator(bucket, prefix=prefix)]
    if not any(k.endswith('index.m3u8') for k in keys):
        return ''

    def get(key):
        bucket.get_object_to_file(key, os.path.join(local, key[len(prefix):]))

    with ThreadPoolExecutor(8) as pool:
        list(pool.map(get, keys))
    return os.path.join(local, 'index.m3u8')


def process_video(bucket, src: str, work: str, uid: str, steps: set, hls_local: str = '') -> dict:
    """src 是原片（本地路径或签名地址）。hls_local 是补跑时拉下来的已有 720p HLS，
    有它时 src 只拿来 ffprobe（只读文件头），抽帧、节拍都用 HLS，不碰原片。"""
    info = probe(src)
    hdr = info['transfer'] in HDR_TRANSFERS
    prefix = f'media/{uid}/'
    out = {
        'status': 'ready',
        'kind': 'video',
        'width': info['width'],
        'height': info['height'],
        'duration': info['duration'],
        'hdr': hdr,
        'audio': info['audio'],
        'taken_at': info['taken_at'],
        **({'live_id': info['live_id']} if info.get('live_id') else {}),
    }
    errors = {}

    # 已经转正、已经是 SDR 的 HLS 解码比原片快得多，有就用它
    decode_src, decode_hdr = (hls_local, False) if hls_local else (src, hdr)
    if 'transcode' in steps:
        hls_dir = os.path.join(work, 'hls')
        plan = transcode(src, info, hls_dir)
        poster = os.path.join(work, 'poster.jpg')
        out['thumbhash'] = make_poster(src, info, plan, poster)
        _clear_prefix(bucket, prefix + 'hls/')
        _upload_dir(bucket, hls_dir, prefix + 'hls/')
        bucket.put_object_from_file(prefix + 'poster.jpg', poster, headers={'Content-Type': 'image/jpeg'})
        out['renditions'] = [tier for tier, _, _ in plan]
        out['poster'] = True
        decode_src, decode_hdr = os.path.join(hls_dir, f'{plan[-1][0]}p', 'index.m3u8'), False

    wanted = [s for s in ('sprite', 'frames') if s in steps]
    if wanted:
        try:
            stills = extract_stills(decode_src, info, decode_hdr, work, 'sprite' in wanted, 'frames' in wanted)
            for name in wanted:
                _clear_prefix(bucket, prefix + name + '/')
                _upload_dir(bucket, os.path.join(work, name), prefix + name + '/')
                out[name] = stills[name]
        except (Permanent, subprocess.TimeoutExpired) as e:
            for name in wanted:
                errors[name] = str(e)[:300] or 'timeout'

    if 'beats' in steps:
        if not info['audio']:
            out['beats'] = None
        else:
            try:
                result = analyze_beats(decode_src)
                bucket.put_object(prefix + 'beats.json', json.dumps(result).encode(),
                                  headers={'Content-Type': 'application/json'})
                out['beats'] = {'bpm': result['bpm'], 'count': len(result['times'])}
            except (Permanent, subprocess.TimeoutExpired) as e:
                errors['beats'] = str(e)[:300] or 'timeout'

    if errors:
        out['errors'] = errors
    return out


# ---------------------------------------------------------------- 音频

def probe_audio(src: str) -> dict:
    out = _run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', src],
               timeout=300)
    data = json.loads(out)
    streams = data.get('streams', [])
    if not any(s.get('codec_type') == 'audio' for s in streams):
        raise Permanent('没有音轨')
    try:
        duration = float(data.get('format', {}).get('duration') or 0)
    except ValueError:
        duration = 0.0
    tags = {k.lower(): v for k, v in (data.get('format', {}).get('tags') or {}).items()}
    return {
        'duration': round(duration, 3),
        # mp3 / m4a / flac 里内嵌的专辑封面是一个 attached_pic 的"视频流"
        'cover': any(s.get('codec_type') == 'video' and (s.get('disposition') or {}).get('attached_pic')
                     for s in streams),
        'taken_at': _taken_at(tags.get('com.apple.quicktime.creationdate')) or _taken_at(tags.get('creation_time')),
    }


def waveform(src: str, points: int = WAVE_POINTS) -> list:
    """波形：解成单声道 8 kHz，切成 points 段，每段的均方根按最响的一段归一到 0–100。"""
    proc = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', src, '-vn', '-ac', '1', '-ar', '8000',
                           '-f', 'f32le', '-'], capture_output=True, timeout=600)
    if proc.returncode != 0:
        raise Permanent('音轨解不开: ' + proc.stderr.decode(errors='replace').strip()[-300:])
    y = np.frombuffer(proc.stdout, dtype=np.float32)
    if len(y) < points:
        return []
    rms = np.array([float(np.sqrt(np.mean(c.astype(np.float64) ** 2))) for c in np.array_split(y, points)])
    top = rms.max()
    return [int(round(v / top * 100)) for v in rms] if top > 0 else [0] * points


def process_audio(bucket, src: str, work: str, uid: str, steps: set) -> dict:
    info = probe_audio(src)
    prefix = f'media/{uid}/'
    out = {'status': 'ready', 'kind': 'audio', 'duration': info['duration'], 'audio': True,
           'taken_at': info['taken_at']}
    errors = {}
    beats_src = src
    if 'transcode' in steps:
        m4a = os.path.join(work, 'audio.m4a')
        _run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-i', src, '-map', '0:a:0', '-vn',
              '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-movflags', '+faststart', m4a], timeout=TRANSCODE_TIMEOUT)
        bucket.put_object_from_file(prefix + 'audio.m4a', m4a, headers={'Content-Type': 'audio/mp4'})
        out['playback'] = True
        out['waveform'] = waveform(m4a)
        beats_src = m4a
        if info['cover']:
            try:
                poster = os.path.join(work, 'poster.jpg')
                _run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-i', src, '-map', '0:v:0', '-frames:v', '1',
                      '-vf', f'scale={COVER_LONG}:{COVER_LONG}:force_original_aspect_ratio=decrease',
                      '-q:v', '3', poster], timeout=300)
                with Image.open(poster) as img:
                    out['thumbhash'] = image_to_thumbhash(img)
                bucket.put_object_from_file(prefix + 'poster.jpg', poster, headers={'Content-Type': 'image/jpeg'})
                out['poster'] = True
            except (Permanent, OSError, subprocess.TimeoutExpired) as e:
                errors['cover'] = str(e)[:300] or 'timeout'

    if 'beats' in steps:
        try:
            result = analyze_beats(beats_src)
            bucket.put_object(prefix + 'beats.json', json.dumps(result).encode(),
                              headers={'Content-Type': 'application/json'})
            out['beats'] = {'bpm': result['bpm'], 'count': len(result['times'])}
        except (Permanent, subprocess.TimeoutExpired) as e:
            errors['beats'] = str(e)[:300] or 'timeout'

    if errors:
        out['errors'] = errors
    return out


# ---------------------------------------------------------------- 入口

STEPS = {'image': (), 'video': VIDEO_STEPS, 'audio': AUDIO_STEPS}


def kind_of(ext: str):
    if ext in IMAGE_EXTENSIONS:
        return 'image'
    if ext in VIDEO_EXTENSIONS:
        return 'video'
    if ext in AUDIO_EXTENSIONS:
        return 'audio'
    return None


def _existing(bucket, uid: str) -> dict:
    try:
        data = json.loads(bucket.get_object(f'media/{uid}/media.json').read())
        return data if isinstance(data, dict) else {}
    except (oss2.exceptions.NotFound, ValueError):
        return {}


def handle(key: str, steps=None) -> dict:
    m = FILE_KEY.match(key)
    if not m:
        return {'skipped': key}
    uid, ext = m.group(1), (m.group(2) or '')
    kind = kind_of(ext)
    if not kind:
        return {'skipped': key}

    bucket = _bucket()
    t0 = time.monotonic()
    work = tempfile.mkdtemp(prefix='media-')
    try:
        try:
            size = bucket.head_object(key).content_length
        except oss2.exceptions.NotFound:
            return {'skipped': key, 'reason': 'gone'}

        # 只补几步时要合并到已有结果上；原来没成功过就全跑
        base = {}
        run = set(STEPS[kind])
        if steps:
            base = _existing(bucket, uid)
            if base.get('status') == 'ready' and kind in ('video', 'audio'):
                run = set(steps) & set(STEPS[kind])
            else:
                base = {}
        try:
            hls_local = ''
            if base and 'transcode' not in run and base.get('renditions'):
                hls_local = _download_rendition(bucket, uid, min(base['renditions']), work)
            if kind == 'video' and (hls_local or size > LOCAL_LIMIT):
                # 不落盘，ffmpeg 边读边转（内网签名地址，不收流量费）；补跑时只 ffprobe 读个文件头
                src = bucket.sign_url('GET', key, 24 * 3600, slash_safe=True)
            else:
                src = os.path.join(work, 'original' + ext)
                oss2.resumable_download(bucket, key, src)
            if kind == 'image':
                result = process_image(src, bucket, uid, work)
            elif kind == 'audio':
                result = process_audio(bucket, src, work, uid, run)
            else:
                result = process_video(bucket, src, work, uid, run, hls_local)
        except (Permanent, subprocess.TimeoutExpired) as e:
            reason = 'timeout' if isinstance(e, subprocess.TimeoutExpired) else str(e)[:500]
            if base and 'transcode' not in run:
                # 只是补跑几步（HLS 没动）：原来处理好的结果留着，这几步记成失败。
                # 整个记成 failed 的话，后端会丢掉清晰度档位，能播 HLS 的视频退回去播原片
                result = {'errors': {step: reason for step in run}}
            else:
                result = {'status': 'failed', 'kind': kind, 'error': reason}
                base = {}

        if base:
            errors = {k: v for k, v in (base.get('errors') or {}).items() if k not in run}
            errors.update(result.pop('errors', {}))
            base.update(result)
            base.pop('errors', None)
            if errors:
                base['errors'] = errors
            result = base
        result['version'] = MEDIA_VERSION
        result['key'] = key
        result['elapsed'] = round(time.monotonic() - t0, 1)
        bucket.put_object(f'media/{uid}/media.json', json.dumps(result, ensure_ascii=False).encode(),
                          headers={'Content-Type': 'application/json'})
        notify(result)
        print(f'[done] {key} {result["status"]} {sorted(run)} {result["elapsed"]}s '
              f'{result.get("error", "")} {result.get("errors", "")}', flush=True)
        return result
    finally:
        shutil.rmtree(work, ignore_errors=True)


def notify(result: dict) -> None:
    """回调后端。送不到也没关系：桶里有 media.json，后端确认上传和每天补收时会读。"""
    if not CALLBACK_URL or not CALLBACK_TOKEN:
        return
    for attempt in range(3):
        try:
            r = requests.post(CALLBACK_URL, json=result, headers={'X-Media-Token': CALLBACK_TOKEN}, timeout=15)
            if r.status_code < 500:
                return
        except requests.RequestException:
            pass
        time.sleep(2 ** attempt)


# ---------------------------------------------------------------- 打包下载

def job_callback_url() -> str:
    """打包任务的回调：默认是 MEDIA_CALLBACK_URL 同目录的 job-result。"""
    if JOB_CALLBACK_URL:
        return JOB_CALLBACK_URL
    if CALLBACK_URL:
        return CALLBACK_URL.rsplit('/', 1)[0] + '/job-result'
    return ''


def notify_job(result: dict) -> None:
    url = job_callback_url()
    if not url or not CALLBACK_TOKEN:
        return
    for attempt in range(3):
        try:
            r = requests.post(url, json=result, headers={'X-Media-Token': CALLBACK_TOKEN}, timeout=15)
            if r.status_code < 500:
                return
        except requests.RequestException:
            pass
        time.sleep(2 ** attempt)


def _zip_name(name: str) -> str:
    """zip 里的路径：去掉开头的斜杠和 . / .. 段，反斜杠当分隔符。"""
    parts = [p for p in str(name or '').replace('\\', '/').split('/') if p not in ('', '.', '..')]
    return '/'.join(parts) or 'file'


def zip_job(job_id: str, items: list, out: str) -> dict:
    """items 逐个流式读进本地 zip（ZIP_STORED，大于 4 GB 的自动 zip64），再分片传到 out。
    桶里找不到的文件跳过；一个都没有时算失败。"""
    notify_job({'job': 'zip', 'id': job_id, 'status': 'running'})
    t0 = time.monotonic()
    work = tempfile.mkdtemp(prefix='zip-')
    path = os.path.join(work, 'out.zip')
    missing = []
    try:
        bucket = _bucket()
        with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as zf:
            for item in items:
                try:
                    obj = bucket.get_object(item['key'])
                except oss2.exceptions.NotFound:
                    missing.append(item['key'])
                    continue
                info = zipfile.ZipInfo(_zip_name(item.get('name') or item['key']),
                                       date_time=time.localtime(time.time())[:6])
                info.compress_type = zipfile.ZIP_STORED
                info.file_size = int(getattr(obj, 'content_length', 0) or 0)  # 超过 4 GB 时 zipfile 据此写 zip64
                with zf.open(info, 'w') as dst:
                    shutil.copyfileobj(obj, dst, ZIP_CHUNK)
        if missing and len(missing) == len(items):
            raise Permanent('要打包的文件都不在桶里')
        size = os.path.getsize(path)
        oss2.resumable_upload(bucket, out, path, headers={'Content-Type': 'application/zip'},
                              multipart_threshold=ZIP_PART, part_size=ZIP_PART, num_threads=4)
        result = {'job': 'zip', 'id': job_id, 'status': 'ready', 'size': size, 'error': ''}
    except Exception as e:
        result = {'job': 'zip', 'id': job_id, 'status': 'failed', 'size': 0, 'error': str(e)[:500] or type(e).__name__}
    finally:
        shutil.rmtree(work, ignore_errors=True)
    notify_job(result)
    print(f'[zip] {job_id} {result["status"]} {len(items)} items, {len(missing)} missing, '
          f'{result["size"]} bytes, {time.monotonic() - t0:.1f}s {result["error"]}', flush=True)
    return {**result, 'missing': missing}


def _authorized() -> bool:
    token = request.headers.get('X-Media-Token', '')
    return bool(CALLBACK_TOKEN) and hmac.compare_digest(token, CALLBACK_TOKEN)


def _json_body():
    raw = request.get_data()
    try:
        body = json.loads(raw) if raw else {}
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


def _keys(body: dict) -> list:
    if body.get('key'):
        return [body['key']]
    keys = []
    for event in body.get('events') or []:
        obj = (event.get('oss') or {}).get('object') or {}
        bucket = ((event.get('oss') or {}).get('bucket') or {}).get('name')
        if obj.get('key') and bucket in (None, BUCKET):
            keys.append(obj['key'])
    return keys


@app.get('/healthz')
def healthz():
    return jsonify({'ok': True})


@app.post('/invoke')
def invoke():
    raw = request.get_data()
    try:
        body = json.loads(raw) if raw else {}
    except ValueError:
        return jsonify({'error': 'body 不是 JSON'}), 400
    keys = _keys(body)
    if not keys:
        return jsonify({'error': '没有要处理的 key'}), 400
    steps = body.get('steps')
    if steps is not None and (not isinstance(steps, list) or not set(steps) <= set(VIDEO_STEPS)):
        return jsonify({'error': f'steps 只能是 {list(VIDEO_STEPS)} 里的'}), 400
    # OSS / 网络出错直接抛 500，FC 异步调用会自动重试
    return jsonify({'results': [handle(k, steps) for k in keys]})


@app.post('/jobs/process')
def jobs_process():
    """后端管理页的"重跑"：同 /invoke 的手动重跑，要令牌。"""
    if not _authorized():
        return jsonify({'error': 'invalid token'}), 401
    body = _json_body()
    if body is None:
        return jsonify({'error': 'body 不是 JSON 对象'}), 400
    key = body.get('key')
    if not isinstance(key, str) or not FILE_KEY.match(key):
        return jsonify({'error': 'key 必须是 files/{uuid}.ext'}), 400
    steps = body.get('steps')
    if steps is not None and (not isinstance(steps, list) or not set(steps) <= set(VIDEO_STEPS)):
        return jsonify({'error': f'steps 只能是 {list(VIDEO_STEPS)} 里的'}), 400
    return jsonify({'results': [handle(key, steps)]})


@app.post('/jobs/zip')
def jobs_zip():
    """打包下载。打包失败（文件都没了、磁盘满）也返回 200：结果已经回调给后端，FC 不用重试。"""
    if not _authorized():
        return jsonify({'error': 'invalid token'}), 401
    body = _json_body()
    if body is None:
        return jsonify({'error': 'body 不是 JSON 对象'}), 400
    job_id, items, out = body.get('id'), body.get('items'), body.get('out')
    if not isinstance(job_id, str) or not ZIP_ID.match(job_id):
        return jsonify({'error': 'id 格式不对'}), 400
    if out != f'{ZIP_PREFIX}{job_id}.zip':
        return jsonify({'error': f'out 必须是 {ZIP_PREFIX}{{id}}.zip'}), 400
    if not isinstance(items, list) or not items or not all(
            isinstance(i, dict) and isinstance(i.get('key'), str) and i['key'] and not i['key'].startswith('media/')
            for i in items):
        return jsonify({'error': 'items 必须是 [{"key", "name"}]，key 是原文件'}), 400
    return jsonify(zip_job(job_id, items, out))


if __name__ == '__main__':
    print(f'[init] media fc listening on {PORT}', flush=True)
    app.run(host='0.0.0.0', port=PORT, threaded=False)
