---
name: gotcha_oss_image_20mb
description: 阿里云 OSS 图片处理只收 20 MB 以内的原图（ImageTooLarge），大图走 FC 存的 preview.jpg；容器里 os.cpu_count 报宿主机核数
metadata:
  type: project
---

- OSS `x-oss-process=image/...` 原图超过 20 MB 直接 400 `ImageTooLarge`（缤纷云没这个限制，迁移后 283 张相机大图的缩略图、预览、裁脸全坏）。
  媒体 FC 给超过 20 MB 的图片另存 `media/{uuid}/preview.jpg`（长边 6144、原始朝向、只带 EXIF 方向），`media_info.preview` 记尺寸；
  后端 `services/media.image_source()` 统一换成它并按比例缩 raw 坐标。新加对原图做 OSS 图片处理的地方都要走 `image_source`。
- FC / Docker 容器里 `os.cpu_count()` 报的是宿主机核数，onnxruntime 等按它开线程会在 4 核配额里抢死（实测慢 8 倍）；按 cgroup `cpu.max` 定线程数，见 `fc/media/beats.py::_cpu_limit`。

**Why:** 迁移到 OSS 后才暴露；都是"本地看着没问题、上云才坏"的限制。
**How to apply:** 碰图片处理参数、给 FC 加 CPU 密集的库时先想这两条。相关 [[gotcha_bitiful_rect_raw_coord]]、[[decision_oss_layout]]。
