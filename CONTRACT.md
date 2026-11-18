# LockCloud 接口契约

> 以 `backend/tests/` 的契约测试为准；这里写约定和新增接口。改接口先改这里和测试，再改实现。
> 旧接口（Flask 时代的全部路径）原样保留：老 Flutter 包、旧前端还在调。

---

## 0. 通用约定

- 基址：`https://cloud.funk-and.love`，接口都在 `/api/` 下。
- 鉴权：`Authorization: Bearer <jwt>`。JWT 由 `/api/auth/sso/login` 签发，格式兼容 flask-jwt-extended
  （`sub` 为字符串用户 id，`type: "access"`，HS256，密钥和 LockAuth 相同）。
- 请求、响应都是 JSON（上传直传 OSS 除外）。时间是 ISO 8601；日期 `YYYY-MM-DD`；时长、时刻单位是秒（浮点）。
- 错误统一：

  ```json
  {"error": {"code": "FILE_001", "message": "文件不存在", "details": {}}}
  ```

  `message` 是给人看的中文，前端直接显示；按 `code` 做分支。未登录 `401 AUTH_001`，令牌无效或过期 `401 AUTH_004`，
  没有权限 `403`，参数不对 `400 VALIDATION_*`，找不到 `404`，冲突 `409`，限流 `429`。
- 限流：每 IP 每分钟 100 次；`/api/tags/search`、`POST /api/search` 30 次；FC 回调不限。
- 显示名永远是 `filename || original_filename`；任何接口都不从文件名里解析日期、序号、活动。

---

## 1. 行为修正（2026-09 重构时改的）

| 接口 | 以前 | 现在 |
|---|---|---|
| `POST /api/requests/{id}/approve`、`/reject` 不带 body | 500 | 当作 `{}` |
| 改名冲突（`PATCH /api/files/{id}`、同意改名申请） | 报的是旧文件名 | 报冲突的新文件名 |
| 同意删除申请 | 申请记录跟着文件被级联删掉 | 申请留着，状态 `approved`；文件进回收站 |
| 删除文件（单个、批量、同意删除申请） | 立即删库删对象 | 进回收站，30 天后自动清理，见 §3 |
| 用户、上传者对象里的头像 | `avatar_key` + 用它拼的 `avatar_url`，本人登录时才更新 | 只有 `avatar_url`，后端按邮箱问 LockAuth（缓存 5 分钟），可能是 `null`；`avatar_key` 不再返回 |
| `GET /api/auth/avatar/signed-url`、`/api/auth/sso-internal/avatar*` | 可用 | 删除（404）。头像归 LockAuth 管 |

没改的"怪"行为照旧：批量删除的错误码是 `TAG_004`；任何登录用户都能给任何文件打标签。

---

## 2. 文件对象的新增字段

`File` 在原有字段上加（旧客户端忽略未知字段即可）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `taken_at` | `string \| null` | 拍摄时间，来自 EXIF / 视频 `creation_time`。带时区就带，不带就是拍摄地本地时间 |
| `orientation` | `int` | EXIF 方向 1–8，默认 1。`width` / `height` 是原始像素（没转正），5–8 时显示宽高要对调；视频永远是 1。HEIC / AVIF / TIFF / RAW 的宽高是转正后的，方向 1 |
| `live` | `bool` | 2026-11：Live Photo。动态部分（同一次拍的那段视频）挂在这张照片名下，不单独出现在任何列表、搜索、人物里；播放地址见 `GET /api/files/{id}/media` 的 `live` |
| `cover` | `bool` | 2026-11，音频才有：有没有专辑封面。有的话缩略图（`signed-url` 的缩略图用途）是封面 |
| `waveform` | `int[] \| null` | 2026-11，音频才有：波形，120 个 0–100，处理完才有 |

### 能上传的格式（2026-11）

只有一份格式表：`backend/services/formats.py`。

- `GET /api/files/formats` → `{"formats": [{"ext": "heic", "kind": "image"}, …], "max_size": 2147483648}`，要登录。
  `kind` 是 `image` / `video` / `audio` / `other`（只存不处理，没有缩略图和预览）。
- 图片：jpg jpeg png gif bmp webp heic heif avif tif tiff，相机 RAW（dng cr2 cr3 nef arw raf orf rw2）；
  视频：mp4 m4v mov avi mkv webm flv wmv 3gp mts m2ts mpg mpeg；音频：mp3 m4a aac wav flac ogg oga opus wma aiff aif amr；
  其他：svg pdf doc docx xls xlsx ppt pptx txt zip rar 7z tar gz。表外的 `400 VALIDATION_001`（`不支持的文件类型: .exe`）。
- `POST /api/files/upload-url` 多返回 `content_type`：后端按格式表定的、签进上传地址的那个（浏览器对 HEIC、mts 常报空的或怪的，
  不照搬）。PUT 和 `/confirm` 都用它。

列表 `GET /api/files` 新增参数：

| 参数 | 说明 |
|---|---|
| `sort` | `activity`（默认，同以前：活动日期倒序、上传时间倒序）/ `taken`（拍摄时间正序，没有的排后面，同时刻按显示名）/ `uploaded`（上传时间倒序） |
| `activity_date` + `activity_name` + `activity_type` | 同以前，三个一起用就是"一个活动里的全部文件" |

`sort` 给了别的值 `400 VALIDATION_001`。

已进回收站的文件在所有列表、详情、搜索、相邻、签名地址接口里都当不存在（`404 FILE_001`）。
几个老接口对不存在的文件本来就用别的码，照旧：相邻文件 `404 FILE_NOT_FOUND`，单个文件的标签 `404 FILE_010`，
`/api/files/{id}/faces`、`/people` 返回空列表。目录树、活动名、活动目录、查重、标签计数、人物的文件列表也都不算回收站里的。

---

## 3. 回收站

删除（`DELETE /api/files/{id}`、`POST /api/files/batch/delete`、同意删除申请）都改成软删除：
写 `deleted_at`、`deleted_by`，对象不动。每天 03:00 清理 `deleted_at` 超过 30 天的：删 `files/{uuid}`、`media/{uuid}/`、
人脸和向量行、数据库行。响应体和以前一样。

### `GET /api/trash`

参数 `page`、`per_page`（默认 50，最多 100）。管理员看到全部；其他人看到自己上传的和自己删除的。按删除时间倒序。

```json
{
  "files": [{"...File": "...", "deleted_at": "2026-09-28T12:00:00", "deleted_by": {"id": 2, "name": "..."}, "purge_at": "2026-10-28T12:00:00"}],
  "pagination": {"page": 1, "per_page": 50, "total": 3, "pages": 1, "has_next": false, "has_prev": false}
}
```

### `POST /api/trash/{id}/restore`

上传者、删除者、管理员可以。同一目录（活动类型/年/月，和上传、改名查重同一条规则；同一活动一定在同一目录）
里已有同名文件时 `409 TRASH_002`，`message` 里写冲突的名字，
`details.existing_id` 是现存文件 id。成功返回 `{"file": File}`。

### `DELETE /api/trash/{id}`

立即彻底删除。上传者、管理员可以。成功 `{"success": true}`。

### `POST /api/trash/empty`

管理员。彻底删除回收站里全部文件，返回 `{"purged": n}`。

错误码：`TRASH_001` 不在回收站里（404），`TRASH_002` 恢复冲突（409），`TRASH_003` 没有权限（403）。

- 列表里 `deleted_by` 在删除者账号不存在时是 `null`；`purge_at` = `deleted_at` + 30 天。
- 彻底删除（手动、清空、每日任务）同时删掉评论和标签关联；批准过的删除申请留下，`file_id` 置空。
  桶里删失败时 `500 S3_001`，行留着；清空时删失败的留在回收站，不算进 `purged`。

---

## 4. 活动

### `GET /api/activities`

资料库首页用。一个活动 = 同一 `(activity_date, activity_type, activity_name)`。

参数：`year`、`month`、`activity_type`、`media_type`（`image` / `video`）、`q`（活动名包含）、`page`、`per_page`（默认 30，最多 100）。
按活动日期倒序。

```json
{
  "activities": [{
    "activity_date": "2026-03-15",
    "activity_type": "regular_training",
    "activity_type_display": "例训",
    "activity_name": "春季例训",
    "file_count": 42, "image_count": 30, "video_count": 12, "audio_count": 0,
    "duration": 1840.5,
    "owner": {"id": 1, "name": "..."},
    "covers": [{"id": 101, "thumbhash": "...", "is_video": false, "width": 4032, "height": 3024}],
    "taken_from": "2026-03-15T19:02:11", "taken_to": "2026-03-15T21:40:03",
    "updated_at": "2026-03-16T10:00:00"
  }],
  "pagination": {"...": "同上"},
  "years": [{"year": 2026, "count": 12}]
}
```

- `covers` 最多 4 个，优先横图和视频封面，按拍摄时间均匀取，不够再用竖图补；前端再用 `/api/files/signed-urls` 换缩略图地址。
  `width` / `height` 是转正后的显示尺寸（EXIF 5–8 已对调），不知道时 `null`。
- `owner` 是这个活动最早上传的人（和 `activity-directory` 的 owner 一致）。
- `years` 是去掉 `year` / `month` 之后、其余条件下每年的活动数，给时间轴用（选中某年时其他年份照样显示）。
- `month` 要和 `year` 一起才生效（同 `/api/files`）。`media_type` 只决定哪些活动出现（含这类文件的）；
  卡片上的数量、封面、`owner` 都按整个活动算。`media_type` 不是 `image` / `video` / `all` 时 `400 VALIDATION_001`。
- `duration` 是活动里视频时长之和（秒）；`owner` 的账号不存在时 `null`；`updated_at` 是最后一次上传的时间。
- 未分类（`activity_date` 为空）的文件不算活动，用 `GET /api/files?...` 看。

---

## 5. 媒体

### `GET /api/files/{id}/media`

播放器一次拿齐。图片也能调（没有视频字段）。音频和视频一样有播放地址（2026-11，见下面）。

```json
{
  "file_id": 12,
  "kind": "video",
  "status": "ready",
  "width": 720, "height": 1280, "duration": 61.77,
  "hdr": false, "audio": true,
  "taken_at": "2025-10-20T14:25:26+00:00",
  "playback": {"url": "https://.../api/files/hls/12/<token>/master.m3u8", "hls": true, "qualities": [1080, 720]},
  "poster_url": "https://...",
  "sprite": {"sheets": ["https://.../sprite/0.jpg"], "count": 62, "cols": 10, "rows": 10, "width": 90, "height": 160, "interval": 1.0},
  "preview_frames": {"times": [0.0, 2.0, 4.0], "urls": ["https://.../frames/00000.jpg?x-oss-process=..."], "width": 432, "height": 768},
  "beats": {"bpm": 115.04, "count": 119},
  "errors": {}
}
```

- `status`：`pending` 处理中 / `ready` / `failed` / `skipped`。`pending`、`failed` 时 `playback.url` 是原文件签名地址，`hls: false`。
- `sprite`、`beats` 没有就是 `null`（老视频没补跑、没音轨）。`beats.count` 为 0 表示有音轨但没听出音乐的节拍。第 i 张预览小图在第 `i // (cols*rows)` 张大图的
  列 `i % cols`、行 `(i % (cols*rows)) // cols`，对应时刻 `i * interval`。
- `preview_frames`：卡片悬停预览用的清晰帧（媒体 FC 的检索抽帧，长边 768，转 webp），均匀挑最多 60 张，`times[i]` 秒对应 `urls[i]`；
  没有抽帧时为 `null`。雪碧图小图只有长边 160，只适合进度条上的小预览。
- 签名地址 1 小时有效；`expires_in` 给秒数。
- `errors` 是非转码步骤的失败原因（`{"beats": "..."}`），给管理页看。

### `GET /api/files/signed-url/{id}` 新增参数

`download=1`（只对原文件有效）：签名里的 `response-content-disposition` 用 `attachment`，浏览器直接存盘，文件名是显示名。
不带时和以前一样是 `inline`。

图片和其他文件（`kind` 是 `image` / `other`）只有：`file_id`、`kind`、`status`、`width`、`height`（原始像素）、
`orientation`、`taken_at`、`errors`、`expires_in`。视频还没处理完时 `audio`、`width`、`height`、`duration` 可能是 `null`，
`poster_url` 是 OSS 实时截帧。回收站里的文件 `404 FILE_001`。

Live Photo 的照片多一个 `live: {"url": "...", "hls": true, "duration": 2.9}`（动态部分的播放地址，转好了是 HLS）。

音频（`kind: "audio"`）的字段和视频一样：`playback.url` 是转好的 `audio.m4a`（没处理完是原文件），`hls: false`、`qualities: []`；
`poster_url` 是专辑封面（没有是 `null`）；多一个 `waveform`；`width`、`height`、`sprite`、`preview_frames`、`lockai` 都是 `null`。
音频处理时就算好节拍，不用 LockAI 分析，`beats` 有值就能拉节拍全量、改八拍。

### `GET /api/files/{id}/beats`

节拍全量，分析过的视频、音频打开时拉，给节拍器用。

```json
{
  "bpm": 115.04,
  "times": [13.29, 13.81, "..."],
  "sections": [[0, 0], [48, 51], [87, 90]],
  "parts": [0, 87],
  "envelope_rate": 43.07,
  "envelope": "<base64 uint8>",
  "ones": [31.272],
  "base_sections": [[0, 4], [48, 51], [87, 90]],
  "bounds": [0, 87],
  "editable": false
}
```

- 只在有音乐的地方有拍。`times` 是整理过的拍点：节拍算法在一首歌中间跳到反拍、拍长乱掉的地方换成了等距格子
  （`services/beat_grid.py` 的 `regularize`）；分析时 All-In-One 的拍点连贯、而节拍算法自己滑了半拍或没跟上新歌的那一段，
  换成了 All-In-One 的拍点（`reconcile`）。所以和 `media/{uuid}/beats.json` 里的原始拍点不一定一一对应。`sections` 是相位段 `[这段第一拍在 times 里的下标, 这段里一个"1"的下标]`，按第一拍升序，
  段内每 8 拍一个"1"，段首"1"之前的几拍数成上一个八拍的尾巴。一段连续的音乐只定一个小节位置（两个模型一起定）；
  音乐停顿、变速、剪辑接口处另起一段。
- `parts` 是段落（一个视频里的每支舞、串烧里的每首歌）第一拍的下标，第一个是 0，每个都是某个相位段的起点；八拍按段落各自从 1 数。
  算法默认在音乐停了一阵（≥ 4 拍且 ≥ 2 秒没有拍点）的地方分段落。
- 人可以改"哪一拍是 1"：`ones` 是改过的时刻（秒），`sections` 已经套上了；`base_sections` 是没套之前算法的数法；
  `bounds` 是每一段连续音乐第一拍的下标，一段里标一个"1"整段跟着数，同一段再标一个就从那一拍起按新的数
  （前端 `components/beats/ones.ts` 和后端 `apply_ones` 同一套规则）。`editable` 是当前用户能不能直接改。
- `PUT /api/files/{id}/beats/ones`，body `{"ones": [秒, …]}`：上传者、管理员直接改，整份替换，空数组回到算法的数法，返回新的节拍全量。
  别人 `403 FILE_002`；视频没经过 LockAI 分析 `400 BEATS_001`（音频不用分析）；格式不对 `400 VALIDATION_001`。
  别人改走修改申请：`POST /api/requests`，`request_type: "beats"`、`proposed_changes: {"ones": [秒, …]}`，上传者或管理员同意后生效。
  只存时刻不存下标，重新分析、算法升级后改动还在（`beat_fixes` 表）。
- 没有节拍数据 `404 MEDIA_002`。

### LockAI 分析（2026-11）

成员挑视频交给 LockAI 分析，一次分析所有人共享：分段（每支舞）、八拍按段计数、画面搜索、人物识别。播放器只对分析过的视频显示节拍器和分段；
镜像、循环、逐帧、变速是播放器本身的，所有视频都有。

`GET /api/files/{id}/media` 的视频多一个 `lockai`，没分析过是 `null`：

```json
{"status": "ready", "requested_by": {"id": 2, "name": "..."}, "requested_at": "...", "finished_at": "...",
 "chapters": [{"start": 0.0, "end": 117.6, "kind": "dance", "title": "红衣女生组跳舞", "piece": "A"},
              {"start": 117.6, "end": 121.1, "kind": "other", "title": "换场走位", "piece": null}]}
```

- `status`：`queued` 排队 / `processing` 分析中 / `ready` 完成 / `failed` 失败。`chapters` 只在 `ready` 时有，按 `start` 升序首尾相接；
  `kind` 是 `dance` / `talk` / `other`；同一支舞（练了几遍）`piece` 相同，非舞蹈段 `null`。
- `songs`：串烧时这支舞里第 2、3…首歌开始的时刻（秒），只有一首歌是 `[]`。只听模型的，精度约半秒。
- 文件对象（列表、详情）多一个 `lockai_status`（同上，没分析过 `null`）。
- 分析过的视频，`/beats` 的 `parts` 按每支舞的开头和串烧里每首歌的开头分，第一支舞前面单独一段。
  舞的开头吸附到 2 秒内最近的拍（没有就取这支舞里的第一拍），"1"用算法的；
  换歌处新歌从它的第一个小节头数"1"：2 秒内有算法测到的小节位置突变就取突变后的第一个小节头，没有就取最近的小节头。

`POST /api/files/{id}/lockai` 发起分析，任何成员都能对任何视频发起（发起人记成自己）。管理员可以带 `{"force": true}` 重新分析已完成的。
返回 `201 {"lockai": <同上>, "quota": <同下>}`。错误：不是视频 `400 LOCKAI_001`；视频处理失败 `400 LOCKAI_002`；
正在排队或分析 `409 LOCKAI_003`；已经分析过 `409 LOCKAI_004`；本月额度用完 `403 LOCKAI_005`；文件不存在 `404 FILE_001`。

`GET /api/lockai/quota`：`{"limit": 3, "used": 1, "remaining": 2, "resets_at": "2026-11-30T16:00:00"}`。按北京时间自然月计，
`resets_at` 是 UTC；失败的不算；管理员 `limit`、`remaining` 是 `null`。

### `GET /api/compare/align?a={id}&b={id}`

两段视频按音乐对齐。用两边的起音包络做互相关。

```json
{"offset": 1.24, "confidence": 0.82, "method": "onset"}
```

`offset` 的含义：`b` 的第 `t + offset` 秒对应 `a` 的第 `t` 秒。`confidence` < 0.3 时前端提示"没对上，手动调一下"。
任一边没有节拍数据 `404 MEDIA_002`；同一个视频或缺 `a` / `b` `400 VALIDATION_001`；文件不存在 `404 FILE_001`。
只在 ±60 秒内找，重叠部分至少 4 秒（且不少于短的那段的 30%）；`confidence` 是峰值处重叠部分的相关系数。

---

## 6. 搜索

### `POST /api/search`

统一搜索：照片 + 视频片段。旧的 `/api/files/ai-search` 保留。

```json
{
  "q": "蓝色队服在舞台上",
  "limit": 40,
  "filters": {"activity_type": "competition", "date_from": "2025-01-01", "date_to": "2025-12-31",
              "person_ids": [3], "tags": ["比赛"], "media_type": "all"}
}
```

`q` 可以为空（只按条件筛）。`q` 和 `filters` 至少有一个。

```json
{
  "query": "蓝色队服在舞台上",
  "ms": 180,
  "matches": {
    "people": [{"id": 3, "name": "...", "face_count": 120, "thumb_url": "..."}],
    "tags": [{"id": 5, "name": "比赛", "count": 88}],
    "activities": [{"activity_date": "2025-05-20", "activity_type": "competition", "activity_name": "...", "file_count": 30}]
  },
  "photos": [{"file": "File", "score": 0.083}],
  "segments": [{"file": "File", "start": 34.0, "end": 42.0, "at": 38.0, "frame_url": "https://...", "score": 0.079}]
}
```

- `matches` 是名字精确或前缀命中的人物、标签、活动，前端做成"你是不是要找"。
- `photos` 走图片向量；`segments` 走视频帧向量：同一视频里相邻命中帧（间隔 ≤ 4 秒）合成一段，`at` 是最像的那帧，
  `frame_url` 是那一帧的签名地址。
- 只给条件没有 `q` 时，`photos` 按拍摄时间倒序，`segments` 为空。
- 向量模型没配时 `503 SEARCH_001`，`message` 说明原因；调模型失败 `502 SEARCH_002`；向量检索出错 `500 SEARCH_003`。
- `limit` 默认 40，最多 100（`photos`、`segments` 各自最多这么多）。
- 只返回相关的：照片和视频帧的 `score` 都要不低于同一条线（默认 0.05，环境变量 `SEARCH_FLOOR`），不相关的帧不参与合并成段。
  库里没有的东西，`photos`、`segments` 就是空数组，不拿"最像的前几十个"充数。
- `score` 是"比一般搜索词多像多少"：和搜索词的余弦相似度减去和一批通用搜索词平均向量的相似度，过线的一般在 0.05–0.2，
  只用来排序，不要当百分比显示。参照向量在 `backend/services/search_centroid.json`，换向量模型后用
  `scripts/build_search_centroid.py` 重建；和当前模型对不上时不卡线，`score` 退回余弦相似度（0–1）。
- `filters.person_ids` 是"这些人同时出现"，链到同一个真人的几个 cluster 算一个人；`filters.tags` 是"带任一标签"（同 `/api/files`）；
  日期、`media_type`、`person_ids` 格式不对 `400 VALIDATION_001`。`q` 和有效条件都没有也是 `400 VALIDATION_001`。
- 只给条件没有 `q` 时，`photos` 放符合条件的文件（按 `media_type`，可以是视频），`score` 为 `null`，`matches` 各项为空。
- `matches` 每类最多 5 个，精确命中在前。`people[].id` 是那个真人脸最多的 cluster（可以直接用于 `/api/files/persons/{id}`），
  `face_count` 是这个真人所有 cluster 的合计。
- 段的 `end` 是最后一个命中帧再加一个抽帧间隔（不超过视频时长）。

---

## 7. 人物

原有 `/api/files/persons*`、`/api/files/{id}/faces`、`/api/files/{id}/people` 不变。新增：

### `GET /api/files/{id}/appearances`

视频里谁在什么时候出现（来自抽帧的人脸）。

```json
{
  "file_id": 12,
  "people": [{"id": 3, "name": "...", "thumb_url": "...", "segments": [{"start": 4.0, "end": 18.0}], "total": 14.0}],
  "unidentified_count": 2
}
```

相邻出现帧间隔 ≤ 6 秒合成一段，段尾是最后一帧再加一个抽帧间隔（不超过视频时长），`total` 是各段之和。
按出场总时长倒序。不是视频或还没处理时 `people` 为空。`id` / `name` / `thumb_url` 和 `/api/files/{id}/people` 一样
（cluster → 真人）；`thumb_url` 是抽帧里的脸时从 `frames/` 那张图裁。`unidentified_count` 是没归到人的抽帧脸的个数。
文件不存在或在回收站里 `404 FILE_001`。

### `GET /api/files/persons/{id}/appearances`

一个人出现过的视频和时刻：`{"person": {...}, "videos": [{"file": File, "segments": [...], "total": 14.0}], "pagination": {...}}`。
`person` 同 `/api/files/persons/{id}`（`{id, name, face_count}`）；按 `total` 倒序；`page`、`per_page`（默认 24，最多 200）；
人不存在 `404 NOT_FOUND`。

---

## 8. 评论

### `GET /api/files/{id}/comments`

```json
{"comments": [{"id": 1, "file_id": 12, "body": "这里第二个八拍手没到位", "t": 34.5,
               "user": {"id": 2, "name": "...", "avatar_url": "..."},
               "created_at": "...", "updated_at": "...", "can_delete": true}]}
```

按 `t` 正序（`null` 排最后），同 `t` 按时间正序。

### `POST /api/files/{id}/comments`

`{"body": "...", "t": 34.5}`。`body` 1–2000 字；`t` 可省，给了必须在 `[0, duration]`。返回 `{"comment": ...}`，201。

### `DELETE /api/comments/{id}`

作者或管理员。`{"success": true}`。

错误码：`COMMENT_001` 不存在（404），`COMMENT_002` 没有权限（403）。文件进回收站时评论跟着隐藏，彻底删除时一起删。
文件不存在或在回收站里 `404 FILE_001`；删回收站里文件的评论 `404 COMMENT_001`。
`t` 只有视频能带（别的文件带了 `400 VALIDATION_001`）；视频还没处理完、不知道时长时只要求 `t ≥ 0`。

---

## 9. 打包下载

交给媒体 FC 打 zip（不压缩，媒体本身压过），放到 `media/_downloads/{id}.zip`，桶生命周期 1 天后删。

### `POST /api/downloads`

`{"file_ids": [1, 2, 3], "name": "2026-03-15 春季例训"}`，最多 500 个、合计最多 8 GB（`400 DOWNLOAD_002`）。
zip 里的文件名用显示名，按活动分文件夹，重名加 ` (2)`。

```json
{"download": {"id": "d_8f3a...", "status": "pending", "file_count": 3, "size": 104857600, "name": "...",
              "url": null, "expires_at": null, "created_at": "..."}}
```

### `GET /api/downloads/{id}`

同上结构。`status`：`pending` → `running` → `ready`（`url` 是签名地址，`expires_at` 之前可下）/ `failed`（带 `error`）。
只有发起人能查。前端每 2 秒轮询一次。

只有一个文件时前端直接用原文件签名地址，不走这里。

- `POST` 成功返回 `201`。`file_ids` 不是非空整数数组 `400 VALIDATION_001`；有不存在（含回收站里）的 `404 FILE_001`，
  `details.missing` 是那些 id。重复的 id 只算一次。`name` 省略时是 `LockCloud YYYY-MM-DD`，非法字符换成 `_`。
- 文件夹名是 `活动日期 活动名`（没有活动名用类型显示名），没有日期的放 `未分类/`；重名不分大小写。
- 响应里总有 `error` 键（不是 `failed` 时为 `null`）。`size` 在 `ready` 之前是原文件大小之和，`ready` 之后是 zip 的实际大小。
- 桶里的 zip 1 天后被删，之后 `status` 变成 `expired`、`url` 为 `null`。`url` 有效 1 小时（不超过删除时间），每次查询重新签。
- 调不通媒体 FC 时任务直接是 `failed`（`error` 写原因），仍然 `201`。
- 错误码：`DOWNLOAD_001` 任务不存在（404），`DOWNLOAD_002` 超过 500 个或 8 GB（400），`DOWNLOAD_003` 不是发起人（403）。

---

## 10. 管理

都要管理员（`403 ADMIN_001`）。原有 `/api/admin/users`、`/api/logs*` 不变。

### `GET /api/admin/stats`

```json
{
  "storage": {"bytes": 96636764160, "files": 3884, "images": 3100, "videos": 700, "others": 84},
  "growth": [{"month": "2026-09", "files": 120, "bytes": 5368709120}],
  "by_type": [{"activity_type": "regular_training", "display": "例训", "files": 1200, "activities": 40}],
  "pipeline": {
    "media": {"pending": 3, "ready": 3800, "failed": 2, "skipped": 79},
    "embedding": {"pending": 0, "done": 3100, "failed": 0},
    "faces": {"pending": 0, "done": 3100, "failed": 0},
    "persons": 88, "named_persons": 40
  },
  "trash": {"files": 5, "bytes": 1073741824},
  "users": {"total": 60, "active_30d": 22}
}
```

`growth` 是最近 24 个月（按上传时间，旧的在前，没有上传的月份也列出来是 0）。`by_type` 含未分类（`activity_type: null`，
`display: "未分类"`），`activities` 只数有日期的。`embedding` / `faces` 是图片加上抽过帧的视频（帧向量、帧人脸的进度）；
`faces.done` 含"没有脸"。回收站里的文件只算在 `trash` 里。

### `GET /api/admin/media/failures`

处理失败或有步骤失败的文件：`{"files": [{"file": File, "status": "failed", "error": "...", "errors": {"beats": "..."}}]}`。

### `POST /api/admin/media/reprocess`

`{"file_ids": [1, 2], "steps": ["sprite", "beats"]}`。`steps` 省略就全跑。异步调媒体 FC，
返回 `{"queued": [1, 2], "skipped": [{"file_id": 3, "reason": "不是视频"}]}`。一次最多 200 个。
`steps` 是 `transcode` / `sprite` / `frames` / `beats` 的非空子集，只对视频有效；省略时图片、视频都能全跑。
其他 `reason`：`文件不存在`、`不是图片或视频`、`媒体 FC 调用失败: ...`。参数不对 `400 VALIDATION_001`。

`media/failures` 最多 500 个，新传的在前；`error` 是整体失败的原因（没有是 `null`），`errors` 是分步骤的。

---

## 11. FC 回调

- `POST /api/files/internal/media-result`：同以前，`X-Media-Token` 鉴权。结果里新增 `taken_at` 会写进 `files.taken_at`。
  回调没送到时，`GET /api/files`、`GET /api/files/{id}`、`GET /api/files/{id}/media` 会替上传超过 30 秒、还在 `pending` 的文件
  去桶里读 `media.json`，读到就在这次响应里给出处理好的状态。
- `POST /api/files/internal/job-result`：打包任务结果，同一个令牌。
  `{"job": "zip", "id": "d_...", "status": "ready", "size": 123, "error": ""}`。
  `status` 是 `running` / `ready` / `failed`；`ready` / `failed` 之后迟到的 `running` 忽略。
  任务不存在 `404 DOWNLOAD_001`，`job` / `status` 不认识 `400 VALIDATION_001`。

后端调 FC 走媒体函数的 HTTP 触发器（`MEDIA_FC_ENDPOINT`），`X-Media-Token` 鉴权，`X-Fc-Invocation-Type: Async`：

| 路径 | body |
|---|---|
| `POST /jobs/process` | `{"key": "files/...", "steps": [...]}`（同 OSS 触发的 `/invoke`） |
| `POST /jobs/zip` | `{"id": "d_...", "items": [{"key": "files/...", "name": "活动/显示名.mp4"}], "out": "media/_downloads/d_....zip"}` |

FC 的 `/jobs/*` 令牌不对 `401`。打包失败也回 200（结果已经回调给后端，FC 不重试）；`/invoke`（OSS 触发）不变、不要令牌。
