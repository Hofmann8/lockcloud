---
name: feedback-refactor-scope
description: LockCloud 重构的边界：原地改不开新目录、动作 emoji GIF 要留、团建视频多所以练舞工具别喧宾夺主
metadata:
  type: feedback
---

2026-09-28 用户对 LockCloud 前后端重构的要求：

- **原地重构**，不新建 `lockcloud-web/` 之类的目录（再装一份 node 麻烦）。照 LockAI 的做法：先重写 globals.css / layout / theme 和基础、品牌组件，
  再把旧组件里值得留的逻辑搬出来、逐个替换，替换期间 tsc 报错正常，全部换完删旧组件恢复通过。后端也在 `backend/` 里原地 Flask→FastAPI，路径不变。
- **动作 emoji GIF 要留**（`public/` 里那些 locking 动作 emoji 动图），用户很喜欢，想办法用在新界面里（空状态、加载、彩蛋都行）。
- **团建视频很多**：播放器的练舞工具（节拍尺、AB 循环、镜像、逐帧）要有功能边界，不能让看团建录像的人觉得复杂。2026-11-12 起没有展开页：镜像、循环放进普通控制条，节拍器只在 LockAI 分析过的视频上有，见 [[decision-lockai-analysis]]。
- 其他细节用户放权："你都自己拿捏""注意技术品味和审美品味""一直到做完为止"。

**Why:** 用户看过 LockAI、LockAuth 两次重构，认可原地替换的节奏；LockCloud 的视频不全是练舞。
**How to apply:** 设计和实现都按上面执行；拿不准的产品细节自己定，写进 FRONTEND_PLAN.md / CONTRACT.md，不再逐项请示。另见 [[decision-refactor-2026-09]]、[[feedback-favicon]]。
