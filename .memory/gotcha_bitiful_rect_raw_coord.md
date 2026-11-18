---
name: gotcha-bitiful-rect-raw-coord
description: "缤纷云 ?rect=x,y,w,h 用 raw(磁盘字节)坐标系,不读 EXIF。FC handler 必须把 EXIF-coord bbox 反变换回 raw 系再返回,DB 也按 raw 系存"
metadata:
  node_type: memory
  type: gotcha
  originSessionId: fc269b2e-85e1-4b6c-a68e-8621dd279de7
---

**坑(2026-05-21 调试确认)**:缤纷云图片处理 `?rect=x,y,w,h` 是在**原始磁盘字节**(raw)坐标系裁的,**不读 EXIF Orientation**。

iPhone / 单反竖拍照片 EXIF=6/8 表示物理传感器横着拍后让显示器扶正成竖的。raw 字节是横的,EXIF-applied 显示是竖的。InsightFace 检测必须在 EXIF-applied 图上跑(SCRFD 假设人脸正向);但 bbox 是 EXIF-applied 系的,直接 `?rect=` 上去会裁到 raw 字节系下完全不相关的位置 —— 通常是衣服 / 背景 / 黑色,不是脸。

**How to apply:**
- FC handler 检测完后必须做 `exif_to_raw_bbox(bbox, raw_w, raw_h, orient)` 反变换,返回 raw 系 bbox。代码在 [backend/fc/face/handler.py](backend/fc/face/handler.py) `exif_to_raw_bbox()`。
- DB `faces.bbox_x/y/w/h` 存 raw 系。前端 `?rect=` 直接喂这些字段。
- inspect / 可视化要叠在 EXIF-applied 显示图上时,反着用 `raw_to_exif_bbox()`(在 [backend/scripts/inspect_clusters.py](backend/scripts/inspect_clusters.py))转回 EXIF 系算 overlay 百分比。
- 8 个 orientation 全部用解析公式覆盖(1=identity, 2=mirror H, 3=180°, 4=mirror V, 5=transpose, 6=CW 90°, 7=anti-transpose, 8=CCW 90°),最常见的是 6(iPhone 竖拍)和 8(部分相机竖拍)。

**反例**:不要把 bbox 转换搬到前端做(前端不知道每文件的 EXIF orient,得多一次 metadata 查询)。也不要为了"看着自然"在 face_worker 里存 EXIF-coord 然后前端转 —— FC 已经知道 orient,在 FC 算完直接出 raw 最省事。

**2026-05-22 注:小明 file 2551 是反例**:DB orient=6,公开桶里的 mirror 文件 EXIF 仍在,Bitiful 对这一张确实按 EXIF/disp 系裁,raw_bbox 喂上去裁错。但全库 67 张 orient=6/8 cover,只有这一张这样;其余的(包括小雪 orient=8)Bitiful 都按 raw 系裁,raw_bbox 喂着对。还在查为什么 2551 是异类 —— 可能上传链路只剥了别人的 EXIF 没剥它的,也可能 Bitiful 边缘缓存对这个对象姿态不一样。see [[debug_file_2551_anomaly]](待写)。**修复别一刀切全局**:任何按 orient 做转换的改动都会把其余 66 张做对了的弄歪。

**2026-09 迁到阿里云 OSS 之后**:bbox 仍然存 raw 系,不用改 FC 和数据库。裁剪改成 OSS 处理参数 `image/auto-orient,0/crop,x_,y_,w_,h_/rotate,{90|180|270}/…`(`services/media.py` 的 `face_crop_url`):先关自动转正、在 raw 像素上裁,再按 `files.orientation` 转正(3→180,6→90,8→270;镜像类 2/4/5/7 没处理,实际没遇到)。缤纷云那边的公开 mirror 和 `?rect=` 都不用了。**待真机验证**:切换后挑 EXIF=6/8 的 cover 看人物 chip 方向对不对,特别是 1527、2551 这两张老异类。

