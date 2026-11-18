"""2026-11 修的几处缺陷的回归测试。

- 人物身份的锚点（services/person_anchors.py）：合并、置顶头像要撑得过每晚的重新聚类；
  锚点所在的文件彻底删除后要换一个锚点。
- 改文件信息 / 同意修改申请：同时带标签和撞名的文件名时，冲突了就什么都不能改。
- 修改申请的内容要校验。
- 超过 20 MB 的图片：媒体 FC 存好缩小版之前不算 embedding。
"""
import database
from tests.schema import assert_error


# ---------------------------------------------------------------- 人物锚点


def _recluster(seed, groups):
    """模拟每晚的重新聚类：persons 清空重建（id 全变），faces.person_id 指到新 cluster。

    groups: [[face_id, ...], ...]，每组一个新 cluster，代表脸先随便用第一张。返回新 cluster 的 id 列表。
    """
    from scripts import cluster_faces
    seed.exec('DELETE FROM persons')
    new_ids = []
    for faces in groups:
        pid = seed.person(face_count=len(faces), cover_face_id=faces[0])
        for face_id in faces:
            seed.exec('UPDATE faces SET person_id = ? WHERE face_id = ?', (pid, face_id))
        new_ids.append(pid)
    with database.session() as db:
        cluster_faces.reconcile_real_people(db)
    return new_ids


def _real_of(seed, person_id):
    return seed.one('SELECT real_person_id FROM persons WHERE id = ?', (person_id,))[0]


def test_merge_survives_reclustering(client, seed):
    uid = seed.user()
    a, b = seed.file(uid), seed.file(uid)
    p1, p2 = seed.person(), seed.person()
    fa = seed.face(a, person_id=p1, bbox=(10, 10, 100, 100))
    fb = seed.face(b, person_id=p2, bbox=(300, 40, 80, 80))
    seed.set_person(p1, cover_face_id=fa)
    seed.set_person(p2, cover_face_id=fb)
    assert client.patch(f'/api/files/persons/{p1}', json_body={'name': '阿伟'}, user=uid).status == 200
    rp = _real_of(seed, p1)

    # 第二个 cluster 其实也是阿伟：合并过去
    r = client.post(f'/api/files/persons/{p2}/merge', json_body={'target_id': rp}, user=uid)
    assert r.status == 200 and r.json()['merged_into_real_id'] == rp
    assert seed.all('SELECT real_person_id, file_id, frame_id, bbox_x, bbox_w FROM real_people_anchors') == \
        [(rp, b, None, 300, 80)]
    # 再合并一次不重复记
    client.post(f'/api/files/persons/{p2}/merge', json_body={'target_id': rp}, user=uid)
    assert seed.one('SELECT COUNT(*) FROM real_people_anchors')[0] == 1

    n1, n2 = _recluster(seed, [[fa], [fb]])
    assert n1 not in (p1, p2) and n2 not in (p1, p2)
    assert (_real_of(seed, n1), _real_of(seed, n2)) == (rp, rp)   # 两个 cluster 都还叫阿伟


def test_merge_moves_anchors_of_absorbed_identity(client, seed):
    """被合并掉的那个真人，以前合并进来的 cluster 也一起归到目标名下。"""
    uid = seed.user()
    a, b, c = seed.file(uid), seed.file(uid), seed.file(uid)
    p1, p2, p3 = seed.person(), seed.person(), seed.person()
    fa = seed.face(a, person_id=p1, bbox=(0, 0, 100, 100))
    fb = seed.face(b, person_id=p2, bbox=(0, 0, 90, 90))
    fc = seed.face(c, person_id=p3, bbox=(0, 0, 80, 80))
    for p, f in ((p1, fa), (p2, fb), (p3, fc)):
        seed.set_person(p, cover_face_id=f)
    client.patch(f'/api/files/persons/{p1}', json_body={'name': '甲'}, user=uid)
    client.patch(f'/api/files/persons/{p2}', json_body={'name': '乙'}, user=uid)
    target, old = _real_of(seed, p1), _real_of(seed, p2)
    client.post(f'/api/files/persons/{p3}/merge', json_body={'target_id': old}, user=uid)   # p3 先并进乙

    r = client.post(f'/api/files/persons/{p2}/merge', json_body={'target_id': target}, user=uid)
    # 乙名下还有 p3，所以乙留着；它指着 p2 的主锚点换到了 p3 上
    assert r.json()['orphan_real_id_deleted'] is None
    assert seed.one('SELECT anchor_file_id FROM real_people WHERE id = ?', (old,))[0] == c

    n1, n2, n3 = _recluster(seed, [[fa], [fb], [fc]])
    assert (_real_of(seed, n1), _real_of(seed, n2), _real_of(seed, n3)) == (target, target, old)


def test_pinned_cover_survives_reclustering(client, seed):
    uid = seed.user()
    a, b = seed.file(uid), seed.file(uid)
    p = seed.person()
    big = seed.face(a, person_id=p, bbox=(0, 0, 400, 400))
    small = seed.face(b, person_id=p, bbox=(50, 50, 80, 80))
    seed.set_person(p, cover_face_id=big)
    # 用户挑了 b 里那张小的做头像
    assert client.put(f'/api/files/persons/{p}/cover', json_body={'file_id': b}, user=uid).status == 200
    rp = _real_of(seed, p)

    (new,) = _recluster(seed, [[big, small]])   # 重新聚类后代表脸又成了 big
    assert seed.one('SELECT cover_face_id, real_person_id FROM persons WHERE id = ?', (new,)) == (small, rp)


def test_purge_moves_anchor_to_another_face(client, seed, storage):
    uid = seed.user()
    a, b = seed.file(uid), seed.file(uid)
    storage.objects.update({seed.s3_key(a): b'1', seed.s3_key(b): b'2'})
    p = seed.person()
    fa = seed.face(a, person_id=p, bbox=(10, 10, 200, 200))
    fb = seed.face(b, person_id=p, bbox=(30, 40, 50, 60))
    seed.set_person(p, cover_face_id=fa)
    client.patch(f'/api/files/persons/{p}', json_body={'name': '阿伟'}, user=uid)
    rp = _real_of(seed, p)
    assert seed.one('SELECT anchor_file_id FROM real_people WHERE id = ?', (rp,))[0] == a

    seed.trash(a, uid)
    assert client.delete(f'/api/trash/{a}', user=uid).status == 200
    # 锚点换到了这个人剩下的那张脸上，名字还在
    assert seed.one('SELECT name, anchor_file_id, anchor_bbox_x, anchor_bbox_y, anchor_bbox_w, anchor_bbox_h '
                    'FROM real_people WHERE id = ?', (rp,)) == ('阿伟', b, 30, 40, 50, 60)

    (new,) = _recluster(seed, [[fb]])
    assert _real_of(seed, new) == rp


def test_trashed_anchor_is_not_reused(client, seed, storage):
    """换锚点时不挑回收站里的文件。"""
    uid = seed.user()
    a, b, c = seed.file(uid), seed.file(uid), seed.file(uid)
    storage.objects.update({seed.s3_key(a): b'1'})
    p = seed.person()
    fa = seed.face(a, person_id=p, bbox=(0, 0, 100, 100))
    seed.face(b, person_id=p, bbox=(0, 0, 300, 300))   # 最大，但在回收站里
    seed.face(c, person_id=p, bbox=(5, 5, 60, 60))
    seed.set_person(p, cover_face_id=fa)
    client.patch(f'/api/files/persons/{p}', json_body={'name': '阿伟'}, user=uid)
    seed.trash(b, uid)
    seed.trash(a, uid)
    client.delete(f'/api/trash/{a}', user=uid)
    assert seed.one('SELECT anchor_file_id FROM real_people')[0] == c


def test_video_frame_anchor_matches_only_its_frame(client, seed):
    """视频里不同帧的同一个位置可能是不同的人：锚点带帧号。"""
    uid = seed.user()
    vid = seed.file(uid, content_type='video/mp4')
    p1, p2 = seed.person(), seed.person()
    f1 = seed.face(vid, person_id=p1, bbox=(100, 100, 80, 80), frame_id=3)
    f2 = seed.face(vid, person_id=p2, bbox=(100, 100, 80, 80), frame_id=7)   # 同一位置，另一帧，另一个人
    seed.set_person(p1, cover_face_id=f1)
    seed.set_person(p2, cover_face_id=f2)
    client.patch(f'/api/files/persons/{p2}', json_body={'name': '阿伟'}, user=uid)
    rp = _real_of(seed, p2)
    assert seed.one('SELECT anchor_frame_id FROM real_people WHERE id = ?', (rp,))[0] == 7

    n1, n2 = _recluster(seed, [[f1], [f2]])
    assert (_real_of(seed, n1), _real_of(seed, n2)) == (None, rp)


def test_rename_conflict_thumb_when_anchor_touches_left_edge(client, seed):
    uid = seed.user()
    fid = seed.file(uid)
    seed.real_person('阿伟', anchor_file_id=fid, anchor_bbox=(0, 5, 50, 50))   # x = 0
    p = seed.person()
    seed.set_person(p, cover_face_id=seed.face(fid, person_id=p))
    err = assert_error(client.patch(f'/api/files/persons/{p}', json_body={'name': '阿伟'}, user=uid), 409,
                       'NAME_CONFLICT')
    from urllib.parse import unquote
    assert 'crop,x_0,y_5' in unquote(err['existing']['thumb_url'] or '')


# ---------------------------------------------------------------- 标签 + 撞名


def _tags(seed, fid):
    return sorted(r[0] for r in seed.all(
        'SELECT t.name FROM tags t JOIN file_tags ft ON ft.tag_id = t.id WHERE ft.file_id = ?', (fid,)))


def test_patch_conflict_with_tags_changes_nothing(client, seed):
    uid = seed.user()
    a = seed.file(uid, 'a.jpg')
    seed.file(uid, 'b.jpg')
    assert_error(client.patch(f'/api/files/{a}', json_body={'filename': 'b.jpg', 'free_tags': ['新标签']}, user=uid),
                 400, 'FILE_005')
    assert seed.one('SELECT filename FROM files WHERE id = ?', (a,))[0] == 'a.jpg'
    assert _tags(seed, a) == []
    # 不撞名时两样都改
    r = client.patch(f'/api/files/{a}', json_body={'filename': 'c.jpg', 'free_tags': ['新标签']}, user=uid)
    assert r.status == 200
    assert seed.one('SELECT filename FROM files WHERE id = ?', (a,))[0] == 'c.jpg'
    assert _tags(seed, a) == ['新标签']


def test_approve_conflict_with_tags_changes_nothing(client, seed):
    owner, me = seed.user(), seed.user()
    a = seed.file(owner, 'a.jpg')
    seed.file(owner, 'b.jpg')
    rid = seed.request(me, owner, file_id=a, proposed_changes={'filename': 'b.jpg', 'free_tags': ['新标签']})
    assert_error(client.post(f'/api/requests/{rid}/approve', json_body={}, user=owner), 400, 'FILE_005')
    assert seed.one('SELECT filename FROM files WHERE id = ?', (a,))[0] == 'a.jpg'
    assert _tags(seed, a) == []
    assert seed.one('SELECT status FROM file_requests WHERE id = ?', (rid,))[0] == 'pending'


# ---------------------------------------------------------------- 修改申请的内容校验


def test_request_changes_are_validated(client, seed):
    owner, me = seed.user(), seed.user()
    fid = seed.file(owner)
    url = '/api/requests'

    def create(changes):
        return client.post(url, json_body={'file_id': fid, 'request_type': 'edit', 'proposed_changes': changes},
                           user=me)

    assert_error(create({'activity_type': 'xyz'}), 400, 'FILE_008')
    assert_error(create({'activity_date': '2026-13-45'}), 400, 'FILE_007')
    assert_error(create({'filename': 'a/b.jpg'}), 400, 'VALIDATION_001')
    assert_error(create({'filename': 'x' * 256}), 400, 'VALIDATION_001')
    assert_error(create({'free_tags': '比赛'}), 400, 'VALIDATION_001')
    assert_error(create('改个名'), 400, 'VALIDATION_001')
    assert_error(client.post('/api/requests/batch', user=me, json_body={
        'file_ids': [fid], 'proposed_changes': {'activity_type': 'xyz'}}), 400, 'FILE_008')
    assert seed.one('SELECT COUNT(*) FROM file_requests')[0] == 0
    assert create({'activity_type': 'competition', 'filename': '新名字.jpg'}).status == 201


def test_approving_a_bad_stored_request_is_a_400_not_a_500(client, seed):
    """以前没校验就存进去的申请：同意时报 400，文件不动，申请还能拒绝。"""
    owner, me = seed.user(), seed.user()
    fid = seed.file(owner, 'a.jpg')
    rid = seed.request(me, owner, file_id=fid, proposed_changes={'activity_date': '2026-13-45', 'filename': 'z.jpg'})
    assert_error(client.post(f'/api/requests/{rid}/approve', json_body={}, user=owner), 400, 'FILE_007')
    assert seed.one('SELECT filename FROM files WHERE id = ?', (fid,))[0] == 'a.jpg'
    assert client.post(f'/api/requests/{rid}/reject', json_body={}, user=owner).status == 200


def test_batch_request_keeps_message(client, seed):
    owner, me = seed.user(), seed.user()
    fid = seed.file(owner)
    r = client.post('/api/requests/batch', user=me, json_body={
        'file_ids': [fid], 'proposed_changes': {'activity_name': '新名字'}, 'message': ' 这批是比赛的 '})
    assert r.status == 200
    assert seed.one('SELECT message FROM file_requests')[0] == '这批是比赛的'


def test_batch_update_rejects_bad_tags_before_touching_anything(client, seed):
    uid = seed.user()
    fid = seed.file(uid, activity_name='旧名字')
    assert_error(client.post('/api/files/batch/update', user=uid, json_body={
        'file_ids': [fid], 'updates': {'activity_name': '新名字', 'free_tags': ['比赛', 5]}}), 400, 'VALIDATION_001')
    assert_error(client.post('/api/files/batch/update', user=uid, json_body={
        'file_ids': [fid], 'updates': {'activity_name': '新名字', 'free_tags': '比赛'}}), 400, 'VALIDATION_001')
    assert seed.one('SELECT activity_name FROM files WHERE id = ?', (fid,))[0] == '旧名字'
    assert _tags(seed, fid) == []


# ---------------------------------------------------------------- 大图的 embedding 等缩小版


def test_embed_worker_waits_for_preview_of_large_images(seed, embedding):
    from scripts import embed_worker
    from services import media
    uid = seed.user()
    big = media.OSS_IMAGE_LIMIT + 1
    waiting = seed.file(uid, size=big)                              # 媒体 FC 还没跑完
    info = {'kind': 'image', 'width': 9000, 'height': 6000, 'preview': {'width': 6144, 'height': 4096}}
    ready = seed.file(uid, size=big, media_status='ready', media_info=info, raw_w=9000, raw_h=6000)
    small = seed.file(uid, size=1000)                               # 小图不用等

    with database.session() as db:
        embed_worker.run_in_session(db, kind='image', workers=2)
    status = dict(seed.all('SELECT id, embedding_status FROM files'))
    assert status == {waiting: 'pending', ready: 'ok', small: 'ok'}
    assert any(f'media/{seed.s3_key(ready)[6:38]}/preview.jpg' in c for c in embedding.calls)
    assert not any(seed.s3_key(waiting) in c for c in embedding.calls)

    # FC 跑完（这里直接改状态）之后就轮到它了
    seed.exec("UPDATE files SET media_status = 'ready', media_info = ?, raw_w = 9000, raw_h = 6000 WHERE id = ?",
              (__import__('json').dumps(info), waiting))
    with database.session() as db:
        embed_worker.run_in_session(db, kind='image', workers=2)
    assert seed.one('SELECT embedding_status FROM files WHERE id = ?', (waiting,))[0] == 'ok'


# ---------------------------------------------------------------- 媒体 FC：补跑几步失败不能毁掉原结果


def test_fc_partial_rerun_failure_keeps_ready_result(monkeypatch):
    import json
    import os
    import sys
    fc_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'fc', 'media')
    if fc_dir not in sys.path:
        sys.path.insert(0, fc_dir)
    import handler

    uid = 'c' * 32
    key = f'files/{uid}.mp4'
    old = {'status': 'ready', 'kind': 'video', 'renditions': [720], 'poster': True,
           'beats': {'bpm': 100.0, 'count': 8}, 'errors': {'sprite': '上次就没成'}}

    class _Obj:
        def __init__(self, data):
            self.data, self.content_length = data, len(data)

        def read(self):
            return self.data

    class Bucket:
        objects = {key: b'x' * 10, f'media/{uid}/media.json': json.dumps(old).encode()}

        def head_object(self, k):
            return _Obj(self.objects[k])

        def get_object(self, k):
            return _Obj(self.objects[k])

        def put_object(self, k, data, headers=None):
            self.objects[k] = data

        def sign_url(self, *a, **kw):
            return 'https://oss.test/signed'

    bucket = Bucket()
    sent = []

    def broken(*a, **kw):
        raise handler.Permanent('ffprobe 读不了')

    monkeypatch.setattr(handler, '_bucket', lambda: bucket)
    monkeypatch.setattr(handler, '_download_rendition', lambda *a: 'local.ts')
    monkeypatch.setattr(handler, 'process_video', broken)
    monkeypatch.setattr(handler, 'notify', sent.append)
    monkeypatch.setattr(handler.oss2, 'resumable_download', lambda *a, **kw: None)

    # 只补节拍：HLS 没动，原结果留着，只把这一步记成失败
    result = handler.handle(key, steps=['beats'])
    assert result['status'] == 'ready' and result['renditions'] == [720] and result['beats'] == old['beats']
    assert result['errors'] == {'sprite': '上次就没成', 'beats': 'ffprobe 读不了'}
    assert json.loads(bucket.objects[f'media/{uid}/media.json'])['status'] == 'ready'
    assert sent[-1]['status'] == 'ready'

    # 全部重跑时失败，还是整体记 failed
    result = handler.handle(key)
    assert result['status'] == 'failed' and result['error'] == 'ffprobe 读不了' and 'renditions' not in result
