---
name: feedback-no-execute-without-permission
description: "写库 / 调外部 API / 跑 worker 这类有副作用的脚本,我只写不跑,等用户自己执行"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

**别擅自执行会写库或调外部服务的命令** —— 写代码可以,但跑 worker、跑 migration、调 FC/dashscope/S3 写操作等,要等用户在自己机器上手动跑。

**Why:**
- 用户机器可能开了 Clash 之类代理把流量劫持掉,我这边 bash 跑出来的结果跟用户实际环境不一样(已经踩过:我跑 face_worker 时 SSL 失败把 5 行 face_status 错标 failed,用户自己跑就一切正常)
- 写库脚本失败会污染数据,需要 reset 才能再跑
- 用户明说过 "这种数据库敏感的指令我肯定不让你动的"(见前序会话)
- 用户的 PowerShell 环境跟我的 bash 子进程不共享 conda env / 代理设置 / .env 加载等

**How to apply:**
- worker 脚本(`face_worker.py` / `embed_worker.py` / migration scripts)→ 写完告诉用户执行命令,**不要**自己 `python xxx.py` 跑
- 同理:`copy_object` / `delete_object` / `INSERT/UPDATE/DELETE` 系列脚本写完先停手
- **Flask CLI smoke / `--help` 也算"跑"** —— 即使 `flask cluster-faces --help` 这种看似无副作用的命令,会跑 `create_app()` 触发 embed_trigger / face_trigger / 日志初始化,在用户机器上是一次完整 boot。用户没明说"测一下"就不要执行,2026-05-21 因为这条挨过批("让你跑了吗")
- 用户说"测一下"/"看看报错没"也**不一定**等于"你来跑",大部分时候是叫我 code review 一遍看代码层面的错。先 review,如果真的需要执行才能验证(比如运行时环境/网络相关),再问明白
- 只读探查(`SELECT`、`git status`、`Glob`、`Grep`、读文件、读 git log)可以放心跑
- 如果不确定算不算"有副作用",问一句再动手

参考 [[gotcha_no_filename_parsing]] [[feedback_python_thread_concurrency]] 都是踩过坑学到的边界。
