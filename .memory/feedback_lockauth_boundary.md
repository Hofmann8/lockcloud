---
name: feedback-lockauth-boundary
description: LockCloud 不碰 LockAuth 的库和头像；需要账号 / 头像数据就走 LockAuth 的接口，缺接口就在 lockauth/REQUESTS.md 提需求
metadata:
  type: feedback
---

2026-09-29 用户纠正：头像业务归 LockAuth，LockCloud 不要读写 LockAuth 的库、不要替它同步或搬头像，"管好你 LockCloud 自己"。
但 LockAuth 就是服务各产品的，**可以给它提要求**。

- LockCloud 显示头像：后端用 `LOCKAUTH_SERVICE_KEY` 调 LockAuth 的 `GET /api/auth/service/avatars`，按邮箱对上，整份缓存 5 分钟（`backend/services/avatars.py`）。LockCloud 不存 `avatar_key`。
- 需求写在 `lockauth/REQUESTS.md`（接入方提、LockAuth 做完标"已上线"）。只加需求文档，不改 LockAuth 的代码。

**Why:** 各产品边界清楚；之前迁移脚本读 LockAuth 库、`avatars` 子命令直接写它的库和桶，越界了。
**How to apply:** LockCloud 需要账号 / 头像 / 用户信息时，先看 LockAuth 现有接口（`lockauth/backend/README.md`），不够就提需求；不要 `sqlite3` 打开 LockAuth 的库，也不要写 `lock-publicfiles`。
