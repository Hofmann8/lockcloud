---
name: project-hardware-arch
description: "开发机和部署目标的硬件架构,影响所有 Docker / native binary 相关决策"
metadata: 
  node_type: memory
  type: project
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

**开发机 / 部署目标的架构差异**:

| 角色 | 架构 |
|---|---|
| Windows 主力开发机(当前 `cwd` 所在) | x86_64 (amd64) |
| Mac Mini(冷盘存储 + 偶尔开发) | Apple Silicon **M4**(ARM64) |
| 阿里云 FC 实例(人脸推理) | x86_64 (amd64) Linux |
| LockCloud VPS(backend Flask) | x86_64 (amd64) Linux,2 核 / 2GB |

**Why:**
- FC 目标永远是 amd64 Linux,Mac M4 build 容器要走 QEMU 跨架构,实测慢 3-5 倍(本地 5 min 的 build 拖到 20-30 min,风扇拉满)
- Mac 上构建 amd64 镜像可以但费劲;Win 直接原生 amd64,顺
- backend Python 代码两边都跑得动(纯 Python + sqlite),但任何牵涉 native binary(onnxruntime、opencv、libgomp)的就要分平台

**How to apply:**
- **Docker build 默认在 Win 干**,don't 让用户在 Mac 上 build 然后 push FC 镜像
- 如果某天非要在 Mac build,记得 `docker build --platform linux/amd64 ...`,并接受时长翻倍
- pip 装 native 依赖时,Mac 装的 `.dylib` 完全不能进 Linux 容器,zip 上传 FC 那种"代码包"方案在跨平台开发场景下基本就死路
- VPS 部署用同一个 amd64 wheel,跟 Win 开发机大体兼容(除非用了 Windows-only 库)
