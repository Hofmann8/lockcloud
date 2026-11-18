---
name: project-lockcloud
description: LockCloud 项目背景、规模、相关产品 LockAI、当前痛点
metadata: 
  node_type: memory
  type: project
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

LockCloud 是浙大 DFM Locking 舞队私有云存储,生产域名 `cloud.funk-and.love`。本仓库是 Next.js Web + Flask 后端;对象存储 2026-09 从缤纷云迁阿里云 OSS(见 [[decision-oss-layout]])。Flutter App 2026-09-28 独立成单独项目 `funkandlove/LockCloud-app/`,不再属于本仓库,但后端仍要兼容它和旧版 App 调的接口。

**Why:** 给舞队管理排练视频、battle 录像、合影,需要按人/动作/事件快速检索 —— 这是后续 embedding 功能的真实需求来源。

**How to apply:**
- 用户提到"LockAI"指的是同作者另一个 AI 产品,规划与 LockCloud 联动(尤其想让 LockAI 承担 GPU 推理工作)
- 生产服务器是 **2GB 内存的 VPS**,极度内存敏感 —— 任何驻留模型(InsightFace 300MB 起)都不能放本地,必须外推到 FC / Jina API / LockAI
- 视频转码改由 OSS 触发的媒体 FC 做(`backend/fc/media/`),不再用缤纷云转码
- 数据库是 **SQLite**(`backend/.env` 里 `DATABASE_URL=sqlite:///lockcloud.db`),开发 = 生产同一份。2026-05-18 确认,纠正了之前错记成 Postgres 的版本。这条直接决定 [[decision-embedding-arch]] 的向量存储要重新选型 —— 因为 SQLite 跑不了 pgvector
