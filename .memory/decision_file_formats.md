---
name: decision-file-formats
description: 2026-11-18 定案：格式支持是 LockCloud 的事，只有一张格式表（services/formats.py，FC 留副本靠测试对齐）；补了 HEIC/AVIF/TIFF/RAW、更多视频、音频流程、Live Photo；文档/压缩包预览用户明确不做
metadata:
  type: project
---

2026-11-18 用户看了 LockAI 的文件预览后说"格式支持本应该是 LockCloud 的事"，同意我的 1–4，**明确说第 5 项（PDF / Office 预览、压缩包列目录）没必要**。

- **一张格式表**：`backend/services/formats.py`（扩展名 → kind + Content-Type）。上传校验、上传签名的 Content-Type（不信浏览器报的）、
  要不要等媒体 FC、前端上传前检查（`GET /api/files/formats`）都从它来。媒体 FC 单独部署读不到，`fc/media/handler.py` 开头留副本，
  `tests/test_formats.py` 断言两边一致。加格式：改格式表 → 改 FC 副本 → 用户重建 FC 镜像。
- **照片**：OSS 只从原图切常见格式（`OSS_IMAGE`：jpg/png/gif/bmp/webp）。HEIC/HEIF/AVIF/TIFF/RAW 一律由 FC 存**转正的** `preview.jpg`，
  宽高记转正后的、方向记 1（OSS 对 HEIF irot + EXIF 方向的处理拿不准，所以不让它碰原图）。HEIF 解码时已转正，不能再按 EXIF 转。
  embedding / 人脸 worker 对这些格式等 preview、在 preview 上算，人脸框按比例换回原图坐标。解码库缺了只会让那种格式失败，Dockerfile 构建时检查。
- **Live Photo**：只靠苹果的内容标识配对（照片 MakerNote 0x0011 = 视频 `com.apple.quicktime.content.identifier`），同一上传者，
  只和还没配上的另一半配；**不靠文件名**（见 [[gotcha-no-filename-parsing]]）。视频挂在照片下（`live_photo_id`），ORM 钩子和
  `HIDDEN_FILES_SQL` 把它藏起来，回收站 / 恢复 / 彻底删除跟着照片走。
- **音频**：FC 转 `audio.m4a`、波形、专辑封面、节拍。**音频不用 LockAI 分析就有节拍器、能改八拍**（我按"练舞的人对着歌看八拍"的提议做的，
  用户同意了提议；视频仍是分析过才有，见 [[decision-lockai-analysis]]）。
  音频的八拍只用媒体 FC 的 beat_this，**不加 All-In-One**（用户 2026-11-18："干净的音频 beat_this 是绝对够用的"）；
  All-In-One 只在视频的 LockAI 分析时调，也不进上传流程（全库跑一遍才约 9 元，但没分析的视频用不上）。

**Why:** 用户要的是"成员拍出来、录出来的东西都能收、都能看"，不是 LockAI 那种什么文件都能预览；LockAI 的预览器是给 AI 产出物用的，不搬。

**How to apply:** 有人提新格式先问"是不是成员拍摄/录音设备会产出的"，是就走格式表 + FC 副本；文档类只存不处理，别主动加预览。
