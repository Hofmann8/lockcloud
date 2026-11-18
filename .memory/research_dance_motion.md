---
name: research-dance-motion
description: "用户提到等科研空了自己做舞蹈动作检索方向并投会议,记录可发掘的论文 gap"
metadata: 
  node_type: memory
  type: project
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

用户(见 [[user-profile]])2026-05-08 半玩笑表示等本职科研忙完后想自己做"舞蹈动作 embedding"方向并投会议。后续若提及该方向,可直接展开这些 gap:

- **街舞专项数据集稀缺**:Kinetics 里只有粗类 `breakdancing` / `krumping`,Locking/Popping/Waacking 子风格几乎无标注。舞队自有数据可作为现成标注源,够 ACM MM Workshop 一篇
- **中文舞蹈语境 gap**:TMR / MotionCLIP 全英文,中文术语(8拍/上肩/Roger Rabbit/Scoo B Doo)无人做
- **音乐节拍-动作联合 embedding**:现有方法只看视觉/姿势,未融入节拍 phase
- **遮挡鲁棒多人 pose**:舞台多人交叠场景的姿态估计是真硬骨头(CVPR 级)

**How to apply:** 用户主动提"自己科研空了再做"时,不要劝阻或抢做,而是顺势讨论可能的实验设计 / 数据收集策略;LockCloud 中已存的舞队视频是潜在数据池,数据治理时可顺手考虑后续可用性。
