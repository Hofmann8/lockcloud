"""超过 20 MB 的图片：OSS 图片处理不收，媒体 FC 另存缩小的 preview.jpg，后端的缩略图、裁脸都改用它。"""
import io
import json
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from PIL import Image

from services import media

FC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'fc', 'media')


@pytest.fixture
def tmp_path():
    with tempfile.TemporaryDirectory() as d:
        yield Path(d)


class _Bucket:
    def __init__(self):
        self.objects = {}

    def put_object_from_file(self, key, path, headers=None):
        self.objects[key] = open(path, 'rb').read()


def test_fc_preview_keeps_raw_orientation(tmp_path, monkeypatch):
    if FC_DIR not in sys.path:
        sys.path.insert(0, FC_DIR)
    import handler
    monkeypatch.setattr(handler, 'OSS_IMAGE_LIMIT', 1000)
    monkeypatch.setattr(handler, 'PREVIEW_EDGE', 400)
    exif = Image.Exif()
    exif[0x0112] = 6   # 竖拍：像素是横的，EXIF 说要转 90°
    src = tmp_path / 'big.jpg'
    Image.new('RGB', (1200, 800), (200, 30, 30)).save(src, quality=95, exif=exif.tobytes())
    bucket = _Bucket()

    result = handler.process_image(str(src), bucket, 'a' * 32, str(tmp_path))
    assert (result['width'], result['height'], result['orientation']) == (1200, 800, 6)
    assert result['preview'] == {'width': 400, 'height': 267}
    with Image.open(io.BytesIO(bucket.objects[f'media/{"a" * 32}/preview.jpg'])) as p:
        assert p.size == (400, 267) and p.getexif().get(0x0112) == 6   # 没转正，方向留给 OSS auto-orient


def test_fc_small_image_has_no_preview(tmp_path):
    if FC_DIR not in sys.path:
        sys.path.insert(0, FC_DIR)
    import handler
    src = tmp_path / 'small.png'
    Image.new('RGBA', (64, 48), (0, 0, 0, 0)).save(src)
    bucket = _Bucket()
    assert 'preview' not in handler.process_image(str(src), bucket, 'b' * 32, str(tmp_path))
    assert bucket.objects == {}


def _key_and_process(url):
    u = urlparse(url)
    return u.path.lstrip('/'), parse_qs(u.query).get('x-oss-process', [''])[0]


def test_backend_uses_preview_for_styles_and_face_crops(seed):
    uid = seed.user()
    info = {'kind': 'image', 'width': 9000, 'height': 6000, 'preview': {'width': 6144, 'height': 4096}}
    fid = seed.file(uid, '大合影.jpg', media_status='ready', media_info=info, raw_w=9000, raw_h=6000, orientation=6)
    key = seed.s3_key(fid)
    hexid = key[6:38]

    class F:
        id, s3_key, content_type, filename, media_status = fid, key, 'image/jpeg', '大合影.jpg', 'ready'
        media_info, raw_w, raw_h = json.dumps(info), 9000, 6000

    path, process = _key_and_process(media.style_url(F, 'thumbdesktop'))
    assert path.endswith(f'media/{hexid}/preview.jpg') and 'resize' in process
    # 原图下载还是原图
    assert _key_and_process(media.style_url(F, 'original'))[0].endswith(key)

    path, process = _key_and_process(media.face_crop_url(fid, key, (900, 600, 300, 300), 9000, 6000, 6, info=info))
    scale = 6144 / 9000
    assert path.endswith(f'media/{hexid}/preview.jpg')
    assert f'crop,x_{int(900 * scale)},y_{int(600 * scale)},w_{int(300 * scale)},h_{int(300 * scale)}' in process
    assert '/rotate,90' in process

    # 没有 preview 的照旧裁原图
    path, process = _key_and_process(media.face_crop_url(fid, key, (900, 600, 300, 300), 9000, 6000, 6))
    assert path.endswith(key) and 'crop,x_900,y_600,w_300,h_300' in process


def test_workers_wait_for_preview_of_heic(seed, monkeypatch, embedding):
    """HEIC / RAW 这类：embedding 和人脸都要等媒体 FC 的 preview.jpg，在它上面算，人脸框按比例换回原图坐标。"""
    import database
    from scripts import embed_worker, face_worker
    from tests.test_workers_video import _FaceSession

    uid = seed.user()
    info = {'kind': 'image', 'width': 8064, 'height': 6048, 'preview': {'width': 6144, 'height': 4608}}
    waiting = seed.file(uid, 'IMG_1.HEIC', content_type='image/heic', ext='.heic', size=3_000_000)
    ready = seed.file(uid, 'IMG_2.HEIC', content_type='image/heic', ext='.heic', size=3_000_000,
                      media_status='ready', media_info=info, raw_w=8064, raw_h=6048)
    small_jpg = seed.file(uid, 'a.jpg', size=1000)
    with database.session() as db:
        assert {f.id for f in embed_worker.fetch_pending(db, None)} == {ready, small_jpg}
        assert {f.id for f in face_worker.fetch_pending(db, None)} == {ready, small_jpg}
        f = db.get(database_file(), ready)
        urls = embed_worker.build_url_ladder(embed_worker.storage, f)
        assert all(f'media/{seed.s3_key(ready)[6:38]}/preview.jpg' in u for u in urls)   # 小也不送原图

    monkeypatch.setenv('FACE_FC_ENDPOINT', 'https://face.test')
    session = _FaceSession()
    monkeypatch.setattr(face_worker.requests, 'Session', lambda: session)
    with database.session() as db:
        face_worker.run_in_session(db, kind='image', workers=1)
    heic_url = next(u for u in session.urls if seed.s3_key(ready)[6:38] in u)
    assert '/preview.jpg' in heic_url
    scale = 6144 / 8064
    box = seed.one('SELECT bbox_x, bbox_w FROM faces WHERE file_id = ?', (ready,))
    assert box == (int(10 / scale), int(30 / scale))
    # 原图尺寸是媒体 FC 写的，人脸 FC 量的预览图尺寸不覆盖它
    assert seed.one('SELECT raw_w, raw_h FROM files WHERE id = ?', (ready,)) == (8064, 6048)
    assert seed.one('SELECT face_status FROM files WHERE id = ?', (waiting,))[0] == 'pending'


def database_file():
    from files.models import File
    return File
