---
name: gotcha-no-filename-parsing
description: "别从文件名正则抓元数据(时间/序号/活动等),用数据库字段"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

**永远不要**用正则去 parse `file.filename` / `file.original_filename` 里嵌的时间戳、序号、活动名之类的元数据。哪怕原始名长得很规整(比如 `微信图片_2026-05-17_164708_409.jpg` 看起来稳定可抓),也不允许。

**Why:** 用户原话"这是最傻逼的行为"。理由:
1. 文件名是会被用户重命名的(参见 [[feedback-filename-priority]]),正则一改名就废
2. 不同来源(微信导出 / 相机 / iOS 截图 / 重命名后)格式完全不一致,正则只对一种 happy path 工作,其它静默返回错值
3. 元数据应该有正经字段承载,正则是"凑活"思维

**How to apply:**
- 想展示"几点拍的"→ 加 `taken_at` 字段,在 upload worker 里读 EXIF 写库;短期没这字段就用 `uploaded_at`(上传时间)兜底,接受它不是真拍摄时间
- 想展示"序号"→ 数据库存 `seq` 字段或用 `id` 排序
- 想区分活动 → 用 `activity_name` / `activity_type` 字段,这些是用户在 UI 上选好存进 DB 的
- 已经写下的文件名正则 parser 一律删,不留 fallback 链(2026-05-19 在 PreviewContainer 的 `formatAdjacentTime` 里被我提过一次,被立刻打回)
