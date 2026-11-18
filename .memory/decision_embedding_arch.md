---
name: decision-embedding-arch
description: embedding 检索功能(图文搜索 + 人脸识别 + 动作搜索)的架构决策结论
metadata: 
  node_type: memory
  type: project
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

**最终架构(2026-05-18 基于实际盘子重定)**:

```
入库 worker (LockCloud VPS, 不驻留模型)
  ├─ 图文 embedding  → 阿里云多模态 embedding API     → sqlite-vec(本地 lockcloud.db)
  └─ 人脸向量        → 阿里云 FC + InsightFace 容器    → sqlite-vec(本地 lockcloud.db)
查询:SQL JOIN + sqlite-vec 余弦距离
```

**实际盘子(2026-05-18 SQL 查的真实数据):**
3,770 文件 / 77GB,其中 3,474 图(28GB)+ 296 视频(49GB)。
预估首跑向量 ~9.4 万 image+frame + ~2.8 万 face = 10 万级别。

**Why 选 sqlite-vec 而不是 pgvector / DashVector:**
- 数据库现状是 SQLite(见 [[project-lockcloud]] 纠正条目),pgvector 直接不可用
- 全量首跑推理成本 ¥15-25(FC ~¥10 + 多模态 API ~¥7),token 不是瓶颈
- RDS PG 最小规格 ¥100+/月、DashVector ¥58+/月,纯为了向量空跑每年烧 ¥700-1800,而 sqlite-vec 这量级性能完全足够(100 万级 < 100ms)
- 单文件备份/JOIN 不跨库/VPS 2GB 内存友好

**How to apply:**
- 严格分离"模型(FC + 阿里云 API)"和"数据(本地 SQLite)":FC 必须无状态,只做 "image in → vector out"
- 反例:为了"都托管"把向量也丢上云 —— 那是把白送的本地存储成本翻成 ¥/月,毫无收益
- 视频动作搜索第一期降级为"抽帧塞多模态通道",scene + 2s 间隔兜底 + 30 帧上限/视频
- 阶段性优先级:多模态文搜图 > 人脸按人检索 > 视频动作(降级方案)
- 阶段性扩展点:如果未来量级冲到 500 万+ 向量或需要并发查询,再切 pgvector(schema 是兼容的,主要是迁存储引擎)

**敲定参数(2026-05-18)**:
- 图文 embedding 模型:`tongyi-embedding-vision-flash-2026-03-06`,`dim=768`
- API 接口:dashscope SDK,`MultiModalEmbedding.call`,`input` 是扁平 list `[{"text":...}|{"image":...}]`(不是嵌套 contents);**flash 不支持 image_resolution_level**,自动按图大小定 token
- 实测(smoke 2026-05-18):256×256 图 402 token,中文短语 33 token。响应形态 `output.embeddings[0].embedding` + `usage.input_tokens` 已对齐封装
- 视频处理:**绝不在 VPS 跑 ffmpeg**(2 核 CPU 扛不住)。改走缤纷云 S3 的 query 参数抽帧(类似 `video.mp4?vframe/jpg/offset/N`,具体语法实现时查),为每个时间戳生成 signed URL → 阿里云 fetch → embedding。视频 API 本身没用(50MB 上限 + 单一聚合向量、无时间戳)。scene 检测 + 2s 兜底 + 单视频 30 帧上限的策略保留,只是抽帧手段从 ffmpeg 换成 URL
- 人脸:阿里云 FC + InsightFace,ArcFace 512 维
- 全量首跑成本盘子(smoke 后修正):embedding ¥8-14(随图大小浮动) + 人脸 FC ¥10-15 = **~¥18-29 全量**
- **2026-05-19 实测全量入库**:3474/3474 张全成,247 秒 (32 并发),1,266,702 tokens,**¥0.19**(比原盘子估算低一个量级 —— 缤纷云压缩把大图 token 砍掉很多,平均 365 token/张)。零 failed,人脸还没跑
- **2026-05-19 AI 文搜图实测体感**:跑通了,大致可用但准确度一般。用户判断主因是:1) 舞队照片同质化严重(服装/背景/构图都接近),CLIP-style 通用 embedding 在 narrow domain 上类内距离压缩 → 排序信号弱;2) 通用多模态模型本身就这水平,不是工程 bug。**结论:文搜图作为入口够用,但"找某个人的照片"必须靠下一步的人脸向量补**(ArcFace 同身份/跨身份信噪比比 CLIP 高一个量级)。也是潜在 paper gap,见 [[research-dance-motion]]
- 表结构:image_embeddings(vec0 FLOAT[768] PK file_id)+ video_frame_embeddings(vec0 FLOAT[768] PK frame_id,带 timestamp_ms/is_keyframe)+ faces(vec0 FLOAT[512])+ persons(普通表,无 centroid)
- files 加 embedding_status / face_status 两个状态列驱动 worker

**待办**:迁移脚本、sqlite-vec 加载钩子、FC handler、入库 worker、查询 API + 前端搜索框。

**Why:**
- VPS 只有 2GB 内存,任何模型驻留都不可接受(见 [[project-lockcloud]])
- 用户反复确认"模型在 FC,数据在本地 PG",拒绝把人脸表也放云上
- 成本测算:1 万张图入库 ¥5(FC) + 几十(Jina),长期 ~¥10/月

**How to apply:**
- 严格分离"模型(FC)"和"数据(本地 PG)":FC 必须无状态,只做 "image in → vector out"
- 反例:把人脸向量表也放 FC 那边 —— 会破坏事务一致性、联合查询、备份策略
- 视频动作搜索第一期**降级为"抽帧塞 CLIP 通道"**,不上专用动作模型;后续不够再考虑 Twelve Labs Marengo 或自建(用户可能自己以论文方式做,见 [[research-dance-motion]])
- 阶段性优先级:CLIP 文本搜图 > 人脸按人检索 > 视频动作(降级方案)

**待办**:4 张表 schema 定稿、FC 镜像与 handler、入库 worker 串联、查询 API + 前端搜索框 —— 用户尚未让开始落地,下次推进时可直接从 schema 起。
