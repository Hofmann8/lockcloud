---
name: decision-oss-layout
description: "2026-09 LockCloud 从缤纷云迁阿里云 OSS（杭州）后的桶布局和几条硬规则：原文件 key 永不变、目录只在数据库、派生文件单独前缀、style 名白名单"
metadata:
  type: project
---

**2026-09-28**：`funkandlove-cloud-public` 已被用户整桶删除（旧头像、covers/、公开的库备份一起没了），迁移脚本的 `avatars` 子命令后来已删（头像不归 Cloud 管）。

**决策（2026-09-27）**：LockCloud 全量迁到阿里云 OSS `lock-cloud` 桶（杭州，私有），取代缤纷云 `funkandlove-cloud2` + 公开中转桶 `funkandlove-cloud-public`（后者整个废弃，`public_url` / `public_mirror_at` 列已删）。

- `files/{uuid}{.ext}`：原文件，上传时定下永不改。文件名、活动、日期、目录（`活动类型/年/月`）只存在数据库，改名 / 移动不动对象。
- `media/{uuid}/`：媒体 FC 的产物（`hls/`、`poster.jpg`、`media.json`）。**和原文件分前缀**：OSS 触发器只能按前缀过滤，FC 挂在 `files/` 上，写 `media/` 不会再触发自己。
- `backups/db/`（30 天）、`tmp/`（1 天）靠桶生命周期规则清。
- 头像归 LockAuth，在 `lock-publicfiles/avatars/`，Cloud 不存，显示时问 LockAuth，见 [[feedback-lockauth-boundary]]。

**Why:** OSS 私有桶签名能把任意 `x-oss-process` 一起签进去，缤纷云"私有桶只能用预设 style、动态参数得去公开桶"的限制没了，中转桶和 mirror 逻辑整套不需要。原先按目录存对象导致改活动要搬对象、批量改失败会桶和库不一致。

**How to apply:**
- 客户端仍只报 style 名（老 App 兼容），后端在 `services/media.py` 白名单里换成处理参数；不认识的 style 按原图，不许客户端拼参数。
- 上传必须走 `upload_tickets`：confirm 时核对票据归属 + HEAD 对象大小，不信任客户端给的 key。
- 删文件用 `services/file_cleanup.py`（原文件 + `media/{uuid}/` + 人脸 / embedding 行一起清）。
- 迁移用 `backend/scripts/migrate_to_oss.py`（新 key = uuid5(老 key)，可重跑）；迁完删 boto3 依赖和这个脚本。
- 上线手册、回滚、代码待办和待验证清单在 `lockcloud/DEPLOY.md`，接手时先看它。
- 人脸裁剪的坐标规则见 [[gotcha_bitiful_rect_raw_coord]]。
