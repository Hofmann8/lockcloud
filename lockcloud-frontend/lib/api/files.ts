import { inBatches } from './batch';
import { del, get, patch, post } from './client';
import type {
  ActivityDirectoryInfo,
  ActivityKey,
  BatchResponse,
  FileFilters,
  FileItem,
  FileListResponse,
  ProposedChanges,
  StylePreset,
  Tag,
  TagWithCount,
} from './types';

/**
 * 要上传地址时报的 Content-Type。后端按格式表重新定一个签进地址里（upload-url 返回的 content_type），
 * PUT 和确认用后端那个；这里只是老后端没返回时的退路。
 */
export function uploadContentType(file: File): string {
  return file.type || 'application/octet-stream';
}

function listParams(filters: FileFilters = {}) {
  const params: Record<string, unknown> = { ...filters };
  if (filters.tags?.length) params.tags = filters.tags.join(',');
  else delete params.tags;
  if (filters.media_type === 'all') delete params.media_type;
  return params;
}

export interface FileUpdate {
  activity_date?: string;
  activity_type?: string;
  activity_name?: string;
  filename?: string;
  free_tags?: string[];
}

export const filesApi = {
  list: (filters?: FileFilters, signal?: AbortSignal) =>
    get<FileListResponse>('/api/files', { params: listParams(filters), signal }),

  get: async (id: number) => (await get<{ file: FileItem }>(`/api/files/${id}`)).file,

  update: async (id: number, data: FileUpdate) =>
    (await patch<{ file: FileItem; message: string }>(`/api/files/${id}`, data)).file,

  /** 进回收站，30 天内能恢复 */
  remove: (id: number) => del<{ message: string }>(`/api/files/${id}`),

  adjacent: (id: number, limit = 1) =>
    get<{ previous: FileItem | null; next: FileItem | null; previous_files: FileItem[]; next_files: FileItem[] }>(
      `/api/files/${id}/adjacent`,
      { params: { limit } },
    ),

  // ------------------------------------------------ 上传
  uploadUrl: (data: {
    original_filename: string;
    content_type: string;
    size: number;
    activity_date: string;
    activity_type: string;
    activity_name?: string;
    custom_filename?: string;
  }) =>
    // content_type 是后端按格式表定的、签进地址里的那个，PUT 和确认都用它
    post<{ upload_url: string; s3_key: string; content_type?: string; generated_filename: string; expires_in: number }>(
      '/api/files/upload-url',
      data,
    ),

  /** 能上传的格式（后端的格式表） */
  formats: () => get<{ formats: Array<{ ext: string; kind: 'image' | 'video' | 'audio' | 'other' }>; max_size: number }>('/api/files/formats'),

  confirm: async (data: {
    s3_key: string;
    size: number;
    content_type: string;
    original_filename: string;
    activity_date: string;
    activity_type: string;
    activity_name?: string;
  }) => (await post<{ file: FileItem }>('/api/files/confirm', data)).file,

  checkFilenames: (data: { filenames: string[]; activity_date: string; activity_type: string; activity_name?: string }) =>
    post<{ existing_files: string[]; available_files: string[] }>('/api/files/check-filenames', data),

  activityNames: (date: string) =>
    get<{
      date: string;
      activity_names: Array<{ name: string; activity_type: string; activity_type_display: string; file_count: number }>;
    }>('/api/files/activity-names', { params: { date } }),

  // ------------------------------------------------ 批量（后端一次最多 100 个，多了自动分批）
  batchDelete: (ids: number[]) =>
    inBatches(ids, (chunk) => post<BatchResponse>('/api/files/batch/delete', { file_ids: chunk })),

  batchAddTag: (ids: number[], tagName: string) =>
    inBatches(ids, (chunk) => post<BatchResponse & { tag?: Tag }>('/api/files/batch/tags', { file_ids: chunk, tag_name: tagName })),

  batchRemoveTag: (ids: number[], tagId: number) =>
    inBatches(ids, (chunk) => del<BatchResponse>('/api/files/batch/tags', { data: { file_ids: chunk, tag_id: tagId } })),

  batchUpdate: (ids: number[], updates: FileUpdate & { tag_mode?: 'add' | 'replace' }) =>
    inBatches(ids, (chunk) => post<BatchResponse>('/api/files/batch/update', { file_ids: chunk, updates })),

  // ------------------------------------------------ 标签
  addTag: async (id: number, tagName: string) =>
    (await post<{ tag: Tag }>(`/api/files/${id}/tags`, { tag_name: tagName })).tag,

  removeTag: (id: number, tagId: number) => del<unknown>(`/api/files/${id}/tags/${tagId}`),

  // ------------------------------------------------ 活动目录
  activityDirectory: async (key: ActivityKey) =>
    (await get<{ directory: ActivityDirectoryInfo }>('/api/files/activity-directory', { params: key })).directory,

  updateActivityDirectory: (key: ActivityKey & { new_activity_name?: string; new_activity_type?: string }) =>
    patch<{ message: string; updated_count: number; new_activity_name: string; new_activity_type: string }>(
      '/api/files/activity-directory',
      key,
    ),

  // ------------------------------------------------ 地址
  signedUrl: (id: number, style?: StylePreset, expiration?: number) =>
    get<{ signed_url: string; expires_in: number; hls_ready: boolean }>(`/api/files/signed-url/${id}`, {
      params: { ...(style ? { style } : {}), ...(expiration ? { expiration } : {}) },
    }),

  signedUrls: (ids: number[], style: StylePreset, videoStyle?: StylePreset) =>
    post<{ urls: Record<string, { signed_url: string; s3_key: string; content_type: string }>; expires_in: number }>(
      '/api/files/signed-urls',
      { file_ids: ids, style, video_style: videoStyle },
    ),
};

export const tagsApi = {
  all: async () => (await get<{ tags: TagWithCount[] }>('/api/tags')).tags,
  search: async (q: string, limit = 8) =>
    (await get<{ tags: TagWithCount[] }>('/api/tags/search', { params: { q, limit } })).tags,
};

export type { ProposedChanges };
