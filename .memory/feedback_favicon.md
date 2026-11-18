---
name: feedback-favicon
description: LockCloud 重构不许动 favicon，沿用现在这个（和 LockAI 一套）
metadata:
  type: feedback
---

2026-09-28 用户明确：LockCloud 的 favicon 不许改，重构、换主题、换强调色都不碰 `lockcloud-frontend/app/favicon.ico`
和其他图标文件。LockAuth 重构时自己换了 favicon，用户不满意但暂时不管。

**Why:** 用户要三个产品的图标保持原样（LockAI 那套），不想让重构会话按新配色重做图标。
**How to apply:** 设计稿、主题 token、manifest 改动里都不出现新图标；要动图标必须用户先开口。另见 [[decision-refactor-2026-09]]。
