---
name: feedback-python-thread-concurrency
description: "Python ThreadPoolExecutor 调外部 HTTP API 的并发上限,256 是错的,32-64 才是甜点"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

**Python ThreadPoolExecutor 调外部 HTTP API,并发数甜点是 32-64,不要超过。**

**Why:**
- 2026-05-19 第一次接 dashscope embedding 一把梭,我推荐 `--workers 256`,
  理由是"I/O bound 不怕开多"。结果用户跑了之后 CPU 直接 100%,Ctrl+C 都
  杀不掉,只能关终端
- 真实原因:Python GIL 同时只允许 1 个线程执行字节码;HTTP SDK
  (dashscope / requests / boto)每次调用内部 CPU 活不少(签名、JSON
  序列化、向量数组 marshaling)。256 线程时绝大部分时间耗在内核 context
  switch + GIL 抢占上,真正干活的线程极少
- 而且服务端通常有租户级并发限,客户端开 256 也是在自己机器上排队,没意义

**How to apply:**
- 默认给 32,需要快一点给 64,**不要给 128 以上**,即使是 "dev 一把梭"
  也别贪
- 涉及向量(几百到几千维 float)、签名、SDK 包装层的 API,CPU 单调用成本
  更高,32 反而比 64 稳
- 真要冲吞吐就上 asyncio + aiohttp(单线程协程,无 GIL 切换费),而不是
  继续加线程
- I/O bound 在 Python 里依然受 GIL 限制 —— 这条直觉不要扩展到 ≫64 线程
