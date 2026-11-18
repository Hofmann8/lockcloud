---
name: gotcha-persons-rebuilt-nightly
description: persons（人脸聚类）每晚清空重建、id 会变；名字、合并、置顶头像只有记在 real_people 的锚点上才留得住
metadata:
  type: project
---

`scripts/cluster_faces.py`（定时任务 `cluster_faces`，每天凌晨）把 `persons` 整表清空重新聚类，`persons.id` 每晚都会变。留得住的只有身份层 `real_people`，靠锚点（某个文件里的一个人脸框）在新聚类里按 IoU 找回对应的 cluster（`reconcile_real_people`）。

- 主锚点在 `real_people.anchor_file_id / anchor_frame_id / anchor_bbox_*`，附加锚点在 `real_people_anchors` 表（2026-11 加的），读写都走 `services/person_anchors.py`。
- 合并（`/persons/{id}/merge`）要把被合并 cluster 的代表脸记成目标身份的附加锚点；只改 `persons.real_person_id` 第二天就散了。
- 置顶头像要写到主锚点上，聚类后再把 `persons.cover_face_id` 指回去。
- 锚点所在文件被彻底删除时用 `person_anchors.forget_file` 换锚点，不能只把锚点置空（名字会丢）。
- 视频抽帧里的脸要带 `frame_id` 一起匹配，同一个文件不同帧的框会重叠。

**Why:** 2026-11 之前合并和置顶头像只写在 `persons` 上，过一晚就没了；锚点文件被清掉后名字也跟着丢。
**How to apply:** 任何"给人物记点什么"的新功能都落在 `real_people` 或锚点上，不要存 `persons.id`（包括前端的链接、收藏）；改完在 `tests/test_fixes_2026_11.py` 里照着补一条"重新聚类后还在"的用例。
