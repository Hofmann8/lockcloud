// 和 backend/tests/schema.py、CONTRACT.md 一一对应。契约改了两边一起改。

export interface User {
  id: number;
  email: string;
  name: string;
  /** 头像归 LockAuth，后端按邮箱问它要的公开地址；没有时显示名字首字 */
  avatar_url: string | null;
  created_at: string | null;
  last_login: string | null;
  is_active: boolean;
  is_admin: boolean;
}

export interface Uploader {
  id: number;
  name: string;
  email: string;
  /** 头像归 LockAuth，后端按邮箱问它要的公开地址；没有时显示名字首字 */
  avatar_url: string | null;
}

export interface Tag {
  id: number;
  name: string;
}

export interface TagWithCount extends Tag {
  count: number;
}

/** 媒体处理：pending 等处理 / ready 好了 / failed 失败 / skipped 不是图片视频 */
export type MediaStatus = 'pending' | 'ready' | 'failed' | 'skipped';

export interface FileItem {
  id: number;
  filename: string;
  original_filename: string | null;
  directory: string;
  s3_key: string;
  size: number;
  content_type: string | null;
  uploader_id: number;
  uploaded_at: string | null;
  activity_date: string | null;
  activity_type: string | null;
  activity_type_display?: string;
  activity_name: string | null;
  is_legacy: boolean;
  thumbhash: string | null;
  media_status: MediaStatus;
  /** LockAI 分析：null 没分析过 */
  lockai_status?: LockAIStatus | null;
  taken_at?: string | null;
  /** EXIF 方向 1–8；5–8 时 width / height 要对调才是显示尺寸 */
  orientation?: number;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  /** Live Photo：动态部分挂在这张照片名下，详情（MediaDetail.live）里有播放地址 */
  live?: boolean;
  /** 音频才有：有没有专辑封面（有的话缩略图就是封面） */
  cover?: boolean;
  /** 音频才有：波形，0–100 */
  waveform?: number[] | null;
  free_tags: Tag[];
  uploader?: Uploader;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export type Timeline = Record<string, Record<string, { count: number }> | { count: number }>;

export interface FileListResponse {
  files: FileItem[];
  pagination: Pagination;
  timeline?: Timeline;
}

export type SortMode = 'activity' | 'taken' | 'uploaded';

export interface FileFilters {
  activity_date?: string;
  activity_type?: string;
  activity_name?: string;
  date_from?: string;
  date_to?: string;
  uploader_id?: number;
  search?: string;
  media_type?: 'all' | 'image' | 'video';
  tags?: string[];
  year?: number;
  month?: number;
  sort?: SortMode;
  page?: number;
  per_page?: number;
}

export interface BatchResults {
  succeeded: number[];
  failed: Array<{ file_id: number; error: string }>;
}

export interface BatchResponse {
  success: boolean;
  code?: string;
  message?: string;
  results?: BatchResults;
}

// ---------------------------------------------------------------- 活动

export interface ActivityKey {
  activity_date: string;
  activity_type: string;
  activity_name: string;
}

export interface ActivityCover {
  id: number;
  thumbhash: string | null;
  is_video: boolean;
  width: number | null;
  height: number | null;
}

export interface Activity extends ActivityKey {
  activity_type_display: string;
  file_count: number;
  image_count: number;
  video_count: number;
  /** 2026-11 起有；老后端没有 */
  audio_count?: number;
  duration: number | null;
  owner: { id: number; name: string } | null;
  covers: ActivityCover[];
  taken_from: string | null;
  taken_to: string | null;
  updated_at: string | null;
}

export interface ActivityListResponse {
  activities: Activity[];
  pagination: Pagination;
  years: Array<{ year: number; count: number }>;
}

export interface ActivityDirectoryInfo extends ActivityKey {
  activity_type_display: string;
  file_count: number;
  owner_id: number;
  owner_name: string;
  created_at: string | null;
  is_owner: boolean;
}

// ---------------------------------------------------------------- 媒体

export interface SpriteInfo {
  sheets: string[];
  count: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  interval: number;
}

export interface BeatsSummary {
  bpm: number;
  count: number;
  source: 'auto' | 'manual';
}

export type LockAIStatus = 'queued' | 'processing' | 'ready' | 'failed';

/** LockAI 理解出的一段：一支舞，或两支舞之间的聊天、准备 */
export interface Chapter {
  start: number;
  end: number;
  kind: 'dance' | 'talk' | 'other';
  title: string;
  /** 同一支舞同一个字母（练了几遍） */
  piece: string | null;
  /** 串烧：这支舞里第 2、3…首歌开始的时刻；只有一首歌是 [] */
  songs?: number[];
}

export interface LockAIInfo {
  status: LockAIStatus;
  /** 发起分析的人，不一定是上传者 */
  requested_by: { id: number; name: string } | null;
  requested_at: string | null;
  finished_at: string | null;
  chapters: Chapter[];
}

export interface LockAIQuota {
  /** 管理员不限：null */
  limit: number | null;
  used: number;
  remaining: number | null;
  resets_at: string;
}

export interface MediaDetail {
  file_id: number;
  kind: 'video' | 'image' | 'audio' | 'other';
  status: MediaStatus;
  width: number | null;
  height: number | null;
  duration: number | null;
  hdr: boolean;
  /** 视频还在处理时可能还不知道 */
  audio: boolean | null;
  taken_at: string | null;
  playback: { url: string; hls: boolean; qualities: number[] } | null;
  poster_url: string | null;
  sprite: SpriteInfo | null;
  /** 卡片悬停预览的清晰帧：均匀挑的最多 60 张，times[i] 秒对应 urls[i] */
  preview_frames?: { times: number[]; urls: string[]; width: number; height: number } | null;
  beats: BeatsSummary | null;
  /** 视频才有；null 没分析过 */
  lockai?: LockAIInfo | null;
  /** 音频才有：波形，0–100 */
  waveform?: number[] | null;
  /** Live Photo 的照片才有：动态部分怎么放 */
  live?: { url: string; hls: boolean; duration: number | null } | null;
  errors: Record<string, string>;
  expires_in?: number;
}

/** 节拍和八拍网格。下标都是 times 的 */
export interface Beats {
  bpm: number;
  times: number[];
  /** 相位段 [这段第一拍的下标, 这段里一个"1"的下标]，段内每 8 拍一个"1" */
  sections: [number, number][];
  /** 段落（每支舞、串烧里的每首歌）第一拍的下标，第一个是 0；八拍按段落各自计数 */
  parts: number[];
  envelope_rate: number;
  envelope: string;
  /** 人改过的"1"的时刻（秒）；sections 已经套上了 */
  ones: number[];
  /** 套上人改的"1"之前，算法的数法 */
  base_sections: [number, number][];
  /** 改"1"时每一段（连续的一段音乐）第一拍的下标：标一个"1"，这一段都跟着数 */
  bounds: number[];
  /** 当前用户能不能直接改（上传者、管理员）；不能就发修改申请 */
  editable: boolean;
}

export interface Alignment {
  offset: number;
  confidence: number;
  method: string;
}

/** 用途名，后端换成 OSS 处理参数；hls:auto 是视频播放地址 */
export type StylePreset =
  | 'thumbnav'
  | 'thumbnavdesktop'
  | 'thumbmobile'
  | 'thumbdesktop'
  | 'previewmobile'
  | 'previewtablet'
  | 'previewdesktop'
  | 'videothumbnav'
  | 'videothumbnavdesktop'
  | 'videothumbmobile'
  | 'videothumbdesktop'
  | 'videopreload'
  | 'original'
  | 'hls:auto';

// ---------------------------------------------------------------- 人物

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Person {
  id: number;
  name: string | null;
  face_count: number;
  cover_face_id: number | null;
  cover_pinned: boolean;
  thumb_url: string | null;
  /** 链到的身份；同一个人被分成几份时几份的这个值一样。没起名字也没置顶头像的是 null */
  real_person_id: number | null;
}

export interface PersonInFile {
  id: number;
  name: string | null;
  face_count: number;
  thumb_url: string | null;
  best_face_in_file?: { face_id: number; bbox: BBox };
}

export interface FileDims {
  raw_w: number;
  raw_h: number;
  orientation: number;
}

export interface FilePeople {
  file_id: number;
  people: PersonInFile[];
  unidentified_count: number;
  file_dims: FileDims | null;
}

export interface FaceBox {
  face_id: number;
  person_id: number | null;
  bbox: BBox;
  confidence: number;
}

export interface Segment {
  start: number;
  end: number;
}

export interface Appearance {
  id: number;
  name: string | null;
  thumb_url: string | null;
  segments: Segment[];
  total: number;
}

// ---------------------------------------------------------------- 搜索

export interface SearchFilters {
  activity_type?: string;
  date_from?: string;
  date_to?: string;
  person_ids?: number[];
  tags?: string[];
  media_type?: 'all' | 'image' | 'video';
}

export interface SearchResponse {
  query: string;
  ms: number;
  matches: {
    people: Array<{ id: number; name: string | null; face_count: number; thumb_url: string | null }>;
    tags: TagWithCount[];
    activities: Array<ActivityKey & { file_count: number }>;
  };
  /** 只按条件筛（没有 q）时 score 是 null */
  photos: Array<{ file: FileItem; score: number | null }>;
  segments: Array<{ file: FileItem; start: number; end: number; at: number; frame_url: string; score: number }>;
}

// ---------------------------------------------------------------- 评论、回收站、下载

export interface Comment {
  id: number;
  file_id: number;
  body: string;
  t: number | null;
  user: { id: number; name: string; avatar_url: string | null };
  created_at: string;
  updated_at: string;
  can_delete: boolean;
}

export interface TrashedFile extends FileItem {
  deleted_at: string;
  deleted_by: { id: number; name: string } | null;
  purge_at: string;
}

export interface DownloadJob {
  id: string;
  /** zip 在桶里放 1 天，之后是 expired */
  status: 'pending' | 'running' | 'ready' | 'failed' | 'expired';
  file_count: number;
  size: number;
  name: string;
  url: string | null;
  expires_at: string | null;
  created_at: string;
  error: string | null;
}

// ---------------------------------------------------------------- 申请

export type RequestType = 'edit' | 'delete' | 'directory_edit' | 'beats';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface ProposedChanges {
  activity_date?: string;
  activity_type?: string;
  activity_name?: string;
  filename?: string;
  free_tags?: string[];
  new_activity_name?: string;
  new_activity_type?: string;
  /** 八拍修改申请：哪些时刻是"1"（秒） */
  ones?: number[];
}

export interface FileRequest {
  id: number;
  file_id: number | null;
  requester_id: number;
  owner_id: number;
  request_type: RequestType;
  status: RequestStatus;
  proposed_changes: ProposedChanges | null;
  directory_info: ActivityKey | null;
  message: string | null;
  response_message: string | null;
  created_at: string;
  updated_at: string;
  file?: { id: number; filename: string; activity_date: string | null; activity_type: string | null; activity_name: string | null };
  requester?: { id: number; name: string };
  owner?: { id: number; name: string };
}

// ---------------------------------------------------------------- 管理

export interface AdminStats {
  storage: { bytes: number; files: number; images: number; videos: number; others: number };
  growth: Array<{ month: string; files: number; bytes: number }>;
  by_type: Array<{ activity_type: string; display: string; files: number; activities: number }>;
  pipeline: {
    media: Record<MediaStatus, number>;
    embedding: { pending: number; done: number; failed: number };
    faces: { pending: number; done: number; failed: number };
    persons: number;
    named_persons: number;
  };
  trash: { files: number; bytes: number };
  users: { total: number; active_30d: number };
}

export interface MediaFailure {
  file: FileItem;
  status: MediaStatus;
  error: string | null;
  errors: Record<string, string>;
}

export interface LogEntry {
  id: number;
  user_id: number;
  file_id: number | null;
  operation: string;
  file_path: string | null;
  timestamp: string;
  ip_address: string | null;
  user_agent: string | null;
  user?: { id: number; name: string; email: string };
  file?: { id: number; filename: string; directory: string };
}
