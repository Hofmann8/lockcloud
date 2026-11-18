---
name: gotcha-soft-delete-trash
description: 删除是软删到回收站；ORM 查询自动藏掉 deleted_at 非空的行，要看得加 include_deleted，裸 SQL 必须自己过滤
metadata:
  type: project
---

2026-09 重构后删除文件（单个、批量、同意删除申请）只写 `files.deleted_at` / `deleted_by`，30 天后 `scripts/purge_trash.py`（定时任务 `purge_trash`，03:00）才删对象和行。

- 藏行靠 `files/models.py` 末尾的 `do_orm_execute` + `with_loader_criteria` 钩子：所有 ORM 查询默认看不到回收站里的文件。
- 要看回收站里的行（回收站接口、按 `s3_key` 找文件的上传确认 / 媒体回调 / `cleanup_uploads.py`）加 `execution_options(include_deleted=True)`（常量 `INCLUDE_DELETED`）。
- 裸 SQL（sqlite-vec 的 vec0 查询、faces 聚合）钩子管不到，要拼 `VISIBLE_FILES_SQL` / `TRASHED_FILES_SQL`。

**Why:** 漏过滤会让回收站里的照片出现在搜索、人物、统计里。
**How to apply:** 新写查询 `files` 的代码时先想它该不该看到回收站；写裸 SQL 一定带过滤，并在 `tests/test_api_v2_trash.py` 里补一条"回收站里的不出现"的用例。
