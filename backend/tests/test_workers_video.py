"""worker 的视频抽帧部分（离线：embedding 用 FakeEmbedding，人脸 FC 用假的 requests.Session）。

只测写库的逻辑：帧号 → 时刻、以文件为单位整体替换、失败不写半截、状态列。
"""
import database
from tests.conftest import unit_vector

FRAMES = {'duration': 6.0, 'frames': {'count': 3, 'interval': 2.0, 'width': 432, 'height': 768}}


def _video(seed, uid, **kw):
    """抽好帧、LockAI 分析过的视频（抽帧 embedding / 人脸只跑分析过的，没分析过的见 test_lockai.py）。"""
    fid = seed.file(uid, content_type='video/mp4', media_status='ready', media_info=FRAMES, **kw)
    seed.exec("UPDATE files SET lockai_status = 'ready' WHERE id = ?", (fid,))
    return fid


def _status(seed, fid, col):
    return seed.one(f'SELECT {col} FROM files WHERE id = ?', (fid,))[0]


def test_embed_worker_video_frames(seed, embedding):
    from scripts import embed_worker
    uid = seed.user()
    vid = _video(seed, uid)
    pending = seed.file(uid, content_type='video/mp4')          # 还没抽帧：不跑
    trashed = _video(seed, uid)
    seed.trash(trashed, uid)                                   # 回收站里的不跑
    img = seed.file(uid)

    with database.session() as db:
        assert embed_worker.run_in_session(db, kind='video', workers=2) == 0
    rows = seed.all('SELECT file_id, timestamp_ms FROM video_frame_embeddings ORDER BY timestamp_ms')
    assert rows == [(vid, 0), (vid, 2000), (vid, 4000)]
    assert _status(seed, vid, 'frame_embedding_status') == 'ok'
    assert _status(seed, pending, 'frame_embedding_status') == 'pending'
    assert _status(seed, trashed, 'frame_embedding_status') == 'pending'
    assert _status(seed, img, 'embedding_status') == 'pending'   # kind=video 不碰图片
    assert any(f'media/{seed.s3_key(vid)[6:38]}/frames/00002.jpg' in c for c in embedding.calls)

    # 重跑：整体替换，不重复
    seed.exec("UPDATE files SET frame_embedding_status = 'pending' WHERE id = ?", (vid,))
    with database.session() as db:
        embed_worker.run_in_session(db, kind='all', workers=2)
    assert seed.one('SELECT COUNT(*) FROM video_frame_embeddings')[0] == 3
    assert _status(seed, img, 'embedding_status') == 'ok'


def test_embed_worker_video_failure_writes_nothing(seed, embedding):
    from scripts import embed_worker
    uid = seed.user()
    vid = _video(seed, uid)
    embedding.fail = RuntimeError('quota')
    with database.session() as db:
        assert embed_worker.run_in_session(db, kind='video', workers=2) == 1
    assert seed.one('SELECT COUNT(*) FROM video_frame_embeddings')[0] == 0
    assert _status(seed, vid, 'frame_embedding_status') == 'failed'


class _FaceResp:
    ok = True
    status_code = 200

    def __init__(self, faces):
        self._faces = faces

    def json(self):
        return {'faces': self._faces, 'model': 'antelopev2', 'raw_size': [432, 768], 'orientation': 1, 'infer_ms': 5}


class _FaceSession:
    """frame 0 和 2 各有一张脸，frame 1 没有。"""

    def __init__(self):
        self.urls = []

    def post(self, url, headers=None, json=None, timeout=None):
        self.urls.append(json['image_url'])
        frame = json['image_url'].split('?', 1)[0]
        if frame.endswith('00001.jpg'):
            return _FaceResp([])
        return _FaceResp([{'bbox': [10, 20, 30, 40], 'det_score': 0.9, 'embedding': unit_vector(0, 512)}])


def test_face_worker_video_frames(seed, monkeypatch):
    from scripts import face_worker
    monkeypatch.setenv('FACE_FC_ENDPOINT', 'https://face.test')
    session = _FaceSession()
    monkeypatch.setattr(face_worker.requests, 'Session', lambda: session)
    uid = seed.user()
    vid = _video(seed, uid)
    seed.face(vid, frame_id=None)   # 以前按图片检测出来的脸（frame_id 为空）不动

    with database.session() as db:
        assert face_worker.run_in_session(db, kind='video', workers=2) == 0
    rows = seed.all('SELECT file_id, frame_id, bbox_w FROM faces ORDER BY face_id')
    assert rows == [(vid, None, 30), (vid, 0, 30), (vid, 2, 30)]
    assert _status(seed, vid, 'frame_face_status') == 'ok'
    assert len(session.urls) == 3 and 'frames/00000.jpg' in session.urls[0]

    seed.exec("UPDATE files SET frame_face_status = 'pending' WHERE id = ?", (vid,))
    with database.session() as db:
        face_worker.run_in_session(db, kind='video', workers=2, frame_step=2)   # 隔一帧：只测 0、2
    assert [r[0] for r in seed.all('SELECT frame_id FROM faces ORDER BY face_id')] == [None, 0, 2]
    assert len(session.urls) == 5


def test_media_result_resets_frame_status(client, seed):
    from tests.conftest import MEDIA_TOKEN
    uid = seed.user()
    vid = _video(seed, uid)
    seed.exec("UPDATE files SET frame_embedding_status = 'ok', frame_face_status = 'ok' WHERE id = ?", (vid,))
    body = {'status': 'ready', 'kind': 'video', 'key': seed.s3_key(vid), **FRAMES}
    client.post('/api/files/internal/media-result', json_body=body, headers={'X-Media-Token': MEDIA_TOKEN})
    assert _status(seed, vid, 'frame_embedding_status') == 'ok'     # 帧没变
    body['frames'] = {**FRAMES['frames'], 'count': 4}
    client.post('/api/files/internal/media-result', json_body=body, headers={'X-Media-Token': MEDIA_TOKEN})
    assert (_status(seed, vid, 'frame_embedding_status'), _status(seed, vid, 'frame_face_status')) == \
        ('pending', 'pending')
