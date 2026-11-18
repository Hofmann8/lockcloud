---
name: gotcha-docker-provenance
description: "Docker 24+ buildx 默认加 provenance 层,阿里云 FC / ACI 等严格校验环境会拒,报 \"platform unknown/unknown\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

Docker Desktop 24+(包括 Windows / Mac / Linux)默认启用 buildx 的 **Provenance Attestations**,会在镜像 manifest list 里塞一层 `platform = unknown/unknown` 的元数据 layer。

阿里云 FC、ECI、部分 K8s 准入控制器都会校验 manifest 平台合法性,看到 `unknown/unknown` 直接拒,错误信息:
```
invalid image, platform of image is unknown/unknown
```

部署后表现为函数永远 Pending,调用 412 `function is pending state`。

**How to apply**:
- LockCloud FC 系列镜像 build **必须**加 `--provenance=false`:
  ```bash
  docker build --platform=linux/amd64 --provenance=false -t <name>:<tag> .
  ```
- 若用 buildx 推送:`docker buildx build --platform linux/amd64 --provenance=false ...`
- CI/CD 不便改命令:`export BUILDX_NO_DEFAULT_ATTESTATIONS=1`
- 验证用 `docker manifest inspect <name>:<tag>`,看到只有 `architecture: amd64 / os: linux`,没有 unknown 才 OK
- **不能用同一个 tag 修复后覆盖** —— 用过的 tag 容易触发 FC 缓存机制不重新拉,改个新 tag(v2、v3...)最稳

**Why:**
- Provenance 是供应链安全证明,本意是好(SLSA 标准),但元数据是用 "unknown/unknown" 占位的 separate manifest entry,严格的 image runtime 解析时找不到对应平台的 layer 就报错
- 这是 buildkit 1.x 之后的默认行为变更,网上很多老教程没提
