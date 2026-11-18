---
name: gotcha-sqlite-vec-aux-real
description: "sqlite-vec 0.1.9 vec0 在 aux REAL 列上有 chunk_size bug,必须用 INTEGER basis points 替代"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

**sqlite-vec 0.1.9 的 vec0 虚拟表不能用 `+xxx REAL` 类型的 aux 列。**

报错:`vec0 constructor error: chunk_size must be a non-zero positive integer`,出现在 CREATE VIRTUAL TABLE 时。0.1.6 和 0.1.9 都有此 bug。

**Why:**
2026-05-18 在做 [[decision-embedding-arch]] 的 faces 表 migration 时撞上。bisect 验证(`_debug_faces_schema.py`,已删):
- A/B/C/E/G 都 OK,只要不含 `+xxx REAL` aux 列就过
- D(只 1 个 REAL aux)、F(完整 schema 含 REAL)、H(去掉别的但保留 REAL)全部 FAIL
- 跟 aux 列总数无关,只跟"有无 REAL 类型 aux"相关

**How to apply:**
- 任何要在 vec0 表里存浮点数(置信度、概率、归一化距离等)的字段,改用 INTEGER basis points(value × 10000)。读出来除回去即可
- 还有副作用收益:避免浮点比较精度问题、范围查询更可靠
- 若后续 sqlite-vec 升到新版本修了这个 bug,可以考虑切回 REAL,但要先用类似 bisect 验证
- 例外:metadata 列(无 `+` 前缀)的 REAL 是否同样受影响,未验证 —— 当前需求里没必要走这条路
