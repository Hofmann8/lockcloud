---
name: decision-refactor-2026-09
description: LockCloud 2026-09 大重构的定案：先迁 OSS 再重构、亮色默认暗色可选、功能往大做且重计算走 FC
metadata:
  type: project
---

2026-09-28 用户定下 LockCloud 重构方向（继 LockAI、LockAuth 之后）：

- 顺序：先按 `DEPLOY.md` 迁 OSS（现有 Flask 代码），再重构。OSS 布局（`files/{uuid}` 不变、目录只在库、派生放 `media/{uuid}/`）与重构无关，新功能的产物都放进这套布局，不搬对象。
- 后端 Flask→FastAPI，照 LockAuth 骨架、保接口兼容；先用 LockAI `tests/test_api_contract.py` 的双框架客户端写契约测试。生产启动改为 `gunicorn -c gunicorn.conf.py asgi:app`（uvicorn worker，绑 127.0.0.1:5001，nginx 要跟着指过去）；接口契约写在 `CONTRACT.md`。
- 主题：**默认亮色，暗色可选**，做法同 LockAI（`lib/theme.tsx`）；LockAuth 只有暗色是它自己的选择。强调色定为**钴蓝** `oklch(0.56 0.16 262)`（暗色 0.7 0.135 262），避开琥珀（LockAI）、铜绿、黄铜（LockAuth）。看片区域（查看器、播放器、对比页）用常暗的 `.stage` 色板。
- 功能：用户欢迎加更复杂有用的功能，"乱七八糟的都走 FC，钱都一样"——重计算放 FC，服务器只调度和查询。
- 功能清单用户交给我定（"你能写就都上"）：视频片段搜索、视频里找人、组合搜索、拍摄时间 taken_at、拖动预览雪碧图、并排同步对比、八拍节拍、带时间点评论、云端打包下载、管理后台、回收站全做；能自己测的自己测，不再逐项请示。
- 媒体 FC 升级时要支持只跑指定步骤、合并已有 `media.json`，这样迁移后补跑新处理不用重新转码。

**Why:** 用户把三个产品统一到同一栈和同一视觉家族；服务器 2C2G 扛不住计算。
**How to apply:** 动动作检索相关的功能前先问，见 [[research-dance-motion]]；OSS 细节见 [[decision-oss-layout]]。
