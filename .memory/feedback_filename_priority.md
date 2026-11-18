---
name: feedback-filename-priority
description: "显示文件名时永远优先 filename(用户重命名后的),original_filename 只做 fallback"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

任何展示给用户看的文件名(列表、卡片、详情标题、tab title、alt、下载文件名、ZIP 包内文件名、分享名等),都必须用 `file.filename || file.original_filename`,**不能反过来**写成 `file.original_filename || file.filename`。

**Why:** 用户会主动把 `微信图片_2026-05-17_164708_409.jpg` 这种乱码原始名重命名成有意义的名字(比如"2026DFM专场-开场-林某某-001.jpg"),系统应当尊重并优先展示这个人类可读的命名。`original_filename` 是审计字段(记录"上传时它叫什么"),只在用户没改过 / 字段缺失时作为兜底,不能盖过用户的劳动成果。

**How to apply:**
- 任何新增显示文件名的 UI / 下载文件名 / aria-label / `<title>`:写 `filename || original_filename`,顺序固定
- 已有代码里看到反过来的(`original_filename || filename`)→ **立即翻转**,2026-05-19 已统一过一轮,见 [[gotcha-no-filename-parsing]] 配合
- 例外:**显式标着 "原始文件名:" / "源文件:" 的那一行**(FileMetadata.tsx 的源文件 subtitle、Flutter file_detail_screen 的 "原始文件名:" info item),那里就是要展示原始名,保留 `original_filename ?? filename`
- 上传 / 提交到后端的 confirmUpload payload 里的 `original_filename`:那是字面意思"用户本地选中的文件叫什么",直接用 `file.name`,跟显示无关
