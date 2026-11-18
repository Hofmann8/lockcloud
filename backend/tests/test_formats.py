"""2026-11 格式补齐：格式表和媒体 FC 副本一致；HEIC / AVIF / TIFF / RAW 的预览图；Live Photo 标识；音频流程。

媒体 FC 部分直接调 fc/media/handler.py 里的函数（不连 OSS），音频用本机的 ffmpeg 现做测试文件。
HEIC 要 pillow-heif、RAW 要 rawpy：本机没装时 HEIC 跳过、RAW 换成假的解码器（真解码在镜像构建时检查）。
"""
import io
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from PIL import Image

from services import formats

FC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'fc', 'media')


@pytest.fixture
def handler():
    if FC_DIR not in sys.path:
        sys.path.insert(0, FC_DIR)
    import handler as h
    return h


@pytest.fixture
def work():
    with tempfile.TemporaryDirectory() as d:
        yield Path(d)


class _Bucket:
    def __init__(self):
        self.objects = {}

    def put_object_from_file(self, key, path, headers=None):
        self.objects[key] = open(path, 'rb').read()

    def put_object(self, key, data, headers=None):
        self.objects[key] = data


# ---------------------------------------------------------------- 格式表


def test_fc_copy_matches_format_table(handler):
    dotted = lambda kind: {'.' + e for e in formats.extensions(kind)}   # noqa: E731
    assert handler.IMAGE_EXTENSIONS == dotted('image')
    assert handler.VIDEO_EXTENSIONS == dotted('video')
    assert handler.AUDIO_EXTENSIONS == dotted('audio')
    assert handler.OSS_IMAGE_EXTENSIONS == {'.' + e for e in formats.OSS_IMAGE}
    assert all(handler.kind_of(e) is None for e in dotted('other'))


def test_format_table_helpers():
    assert formats.kind_of('files/abc.HEIC') == 'image' and formats.content_type_of('a.HEIC') == 'image/heic'
    assert formats.kind_of('x.mts') == 'video' and formats.kind_of('x.flac') == 'audio'
    assert formats.kind_of('x.svg') == 'other' and formats.kind_of('x.exe') is None and formats.kind_of('noext') is None
    from files.validators import validate_file_extension
    assert validate_file_extension('IMG.DNG')['valid'] and not validate_file_extension('a.exe')['valid']
    from services import media
    assert media.initial_media_status('files/a.mp3') == 'pending'
    assert media.initial_media_status('files/a.heic') == 'pending'
    assert media.initial_media_status('files/a.pdf') == 'skipped'


# ---------------------------------------------------------------- 图片


def _exif(orientation=None, note=None):
    exif = Image.Exif()
    if orientation:
        exif[0x0112] = orientation
    if note is not None:
        exif.get_ifd(0x8769)[0x927C] = note
    return exif.tobytes()


def apple_note(content_id: str, order: str = 'MM') -> bytes:
    """造一段 Apple MakerNote：一个 IFD，0x0011 是 ContentIdentifier（ASCII，偏移从 MakerNote 开头算）。"""
    bo = '>' if order == 'MM' else '<'
    value = content_id.encode() + b'\0'
    entries = [(0x0001, 9, 1, 14), (0x0011, 2, len(value), 0)]
    head = b'Apple iOS\0' + struct.pack('>H', 1) + order.encode()
    ifd_len = 2 + 12 * len(entries) + 4
    offset = len(head) + ifd_len
    body = struct.pack(bo + 'H', len(entries))
    for tag, typ, n, v in entries:
        body += struct.pack(bo + 'HHII', tag, typ, n, offset if tag == 0x0011 else v)
    return head + body + struct.pack(bo + 'I', 0) + value


def test_apple_content_id(handler):
    cid = '5F3B1C2A-1111-2222-3333-444455556666'
    assert handler.apple_content_id({0x927C: apple_note(cid)}) == cid
    assert handler.apple_content_id({0x927C: apple_note(cid, 'II')}) == cid
    assert handler.apple_content_id({0x927C: b'Nikon\0garbage'}) == ''
    assert handler.apple_content_id({0x927C: b'Apple iOS\0\0\x01MM\xff'}) == ''   # 截断的不报错
    assert handler.apple_content_id({}) == ''


def test_jpeg_keeps_raw_orientation_and_reads_live_id(handler, work):
    cid = 'AAAA-BBBB'
    src = work / 'live.jpg'
    Image.new('RGB', (40, 30), (10, 20, 30)).save(src, exif=_exif(6, apple_note(cid)))
    bucket = _Bucket()
    r = handler.process_image(str(src), bucket, 'a' * 32, str(work))
    assert (r['width'], r['height'], r['orientation']) == (40, 30, 6)   # 常见格式：原样，OSS 自己转正
    assert r['live_id'] == cid and 'preview' not in r and bucket.objects == {}


def _upright_preview(bucket, uid):
    with Image.open(io.BytesIO(bucket.objects[f'media/{uid}/preview.jpg'])) as p:
        return p.size, p.getexif().get(0x0112), p.convert('RGB').getpixel((2, 2))


def test_tiff_gets_upright_preview(handler, work):
    """TIFF：OSS 不切，FC 按 EXIF 转正后存 preview.jpg，尺寸是转正后的、方向 1。"""
    src = work / 'scan.tif'
    im = Image.new('RGB', (60, 20), (0, 0, 255))
    im.paste((255, 0, 0), (0, 0, 10, 20))   # 左边一条红
    im.save(src, exif=_exif(6))
    bucket = _Bucket()
    r = handler.process_image(str(src), bucket, 'b' * 32, str(work))
    assert (r['width'], r['height'], r['orientation']) == (20, 60, 1)
    size, orientation, corner = _upright_preview(bucket, 'b' * 32)
    assert size == (20, 60) and orientation == 1
    assert corner[0] > 200 and corner[2] < 60   # 转 90° 后红条在上面


def test_16bit_tiff_is_not_blown_out(handler, work):
    src = work / 'gray16.tif'
    Image.new('I;16', (16, 16), 30000).save(src)
    bucket = _Bucket()
    handler.process_image(str(src), bucket, 'c' * 32, str(work))
    _, _, corner = _upright_preview(bucket, 'c' * 32)
    assert 100 < corner[0] < 140   # 30000 / 256 ≈ 117，不是一片白


def test_avif_gets_upright_preview(handler, work):
    from PIL import features
    if not features.check('avif'):
        pytest.skip('本机 Pillow 没带 AVIF')
    src = work / 'photo.avif'
    Image.new('RGB', (60, 20), (0, 200, 0)).save(src, exif=_exif(6))
    bucket = _Bucket()
    r = handler.process_image(str(src), bucket, 'd' * 32, str(work))
    assert (r['width'], r['height'], r['orientation']) == (20, 60, 1)
    assert _upright_preview(bucket, 'd' * 32)[0] == (20, 60)


def test_heic_trusts_decoded_rotation(handler, work):
    """HEIF 的旋转解码时已经转好了，EXIF 方向不能再用一次。"""
    pillow_heif = pytest.importorskip('pillow_heif')
    src = work / 'IMG_0001.HEIC'
    pillow_heif.from_pillow(Image.new('RGB', (64, 32), (200, 50, 50))).save(src, quality=90)
    bucket = _Bucket()
    r = handler.process_image(str(src), bucket, 'e' * 32, str(work))
    assert (r['width'], r['height'], r['orientation']) == (64, 32, 1)
    assert _upright_preview(bucket, 'e' * 32)[0] == (64, 32)


def test_raw_goes_through_rawpy(handler, work, monkeypatch):
    """RAW：rawpy 解出来的已经转正，存 preview.jpg；拍摄时间读内嵌的 JPEG 预览。"""
    import numpy as np

    thumb = io.BytesIO()
    exif = Image.Exif()
    exif.get_ifd(0x8769)[0x9003] = '2025:05:20 19:30:00'
    Image.new('RGB', (8, 8)).save(thumb, 'JPEG', exif=exif.tobytes())

    class Raw:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def postprocess(self, **kw):
            assert kw.get('use_camera_wb') and kw.get('output_bps') == 8
            return np.full((30, 50, 3), 128, dtype=np.uint8)

        def extract_thumb(self):
            return type('Thumb', (), {'format': 'jpeg', 'data': thumb.getvalue()})()

    fake = type('rawpy', (), {'imread': staticmethod(lambda p: Raw()),
                              'ThumbFormat': type('TF', (), {'JPEG': 'jpeg'})})
    monkeypatch.setattr(handler, 'rawpy', fake)
    src = work / 'DSC0001.ARW'
    src.write_bytes(b'not really a raw file')
    bucket = _Bucket()
    r = handler.process_image(str(src), bucket, 'f' * 32, str(work))
    assert (r['width'], r['height'], r['orientation']) == (50, 30, 1)
    assert r['taken_at'] == '2025-05-20T19:30:00' and r['preview'] == {'width': 50, 'height': 30}
    assert f'media/{"f" * 32}/preview.jpg' in bucket.objects

    monkeypatch.setattr(handler, 'rawpy', None)
    with pytest.raises(handler.Permanent):
        handler.process_image(str(src), bucket, 'f' * 32, str(work))


# ---------------------------------------------------------------- 音频

needs_ffmpeg = pytest.mark.skipif(not shutil.which('ffmpeg'), reason='本机没有 ffmpeg')


@needs_ffmpeg
def test_audio_pipeline(handler, work, monkeypatch):
    cover = work / 'cover.png'
    Image.new('RGB', (1600, 1600), (240, 120, 0)).save(cover)
    src = work / 'song.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
                    '-i', str(cover), '-map', '0', '-map', '1', '-c:a', 'libmp3lame', '-c:v', 'mjpeg',
                    '-disposition:v', 'attached_pic', str(src)], check=True)
    monkeypatch.setattr(handler, 'analyze_beats', lambda path: {'bpm': 120.0, 'times': [0.5, 1.0, 1.5]})
    bucket = _Bucket()
    uid = 'a' * 32
    r = handler.process_audio(bucket, str(src), str(work), uid, set(handler.AUDIO_STEPS))
    assert r['status'] == 'ready' and r['kind'] == 'audio' and 5.9 < r['duration'] < 6.2
    assert r['playback'] is True and r['poster'] is True and r['thumbhash']
    assert len(r['waveform']) == handler.WAVE_POINTS and max(r['waveform']) == 100
    assert r['beats'] == {'bpm': 120.0, 'count': 3} and 'errors' not in r
    assert bucket.objects[f'media/{uid}/audio.m4a'][4:8] == b'ftyp'
    with Image.open(io.BytesIO(bucket.objects[f'media/{uid}/poster.jpg'])) as p:
        assert p.size == (1024, 1024)   # 封面缩到长边 1024


@needs_ffmpeg
def test_audio_without_cover_and_only_beats(handler, work, monkeypatch):
    src = work / 'voice.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=5', str(src)],
                   check=True)
    monkeypatch.setattr(handler, 'analyze_beats', lambda path: {'bpm': 90.0, 'times': [1.0]})
    bucket = _Bucket()
    r = handler.process_audio(bucket, str(src), str(work), 'b' * 32, {'beats'})   # 只补节拍：不转码
    assert 'playback' not in r and 'poster' not in r and r['beats']['bpm'] == 90.0
    assert list(bucket.objects) == [f'media/{"b" * 32}/beats.json']
    r = handler.process_audio(bucket, str(src), str(work), 'b' * 32, set(handler.AUDIO_STEPS))
    assert r['playback'] and 'poster' not in r


@needs_ffmpeg
def test_audio_without_audio_track_fails(handler, work):
    src = work / 'silent.m4a'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=16x16:d=1',
                    '-c:v', 'libx264', '-f', 'mp4', str(src)], check=True)
    with pytest.raises(handler.Permanent):
        handler.process_audio(_Bucket(), str(src), str(work), 'c' * 32, set(handler.AUDIO_STEPS))


def test_video_probe_reads_live_id(handler, monkeypatch):
    import json
    probe = {'streams': [{'codec_type': 'video', 'width': 1920, 'height': 1080, 'r_frame_rate': '30/1'}],
             'format': {'duration': '2.9', 'tags': {'com.apple.quicktime.content.identifier': 'AAAA-BBBB'}}}
    monkeypatch.setattr(handler, '_run', lambda cmd, timeout=0: json.dumps(probe))
    assert handler.probe('x.mov')['live_id'] == 'AAAA-BBBB'
