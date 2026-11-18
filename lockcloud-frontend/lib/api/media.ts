import { chunked, inBatches } from './batch';
import { del, get, patch, post, put } from './client';
import type {
  ActivityListResponse,
  AdminStats,
  Alignment,
  Appearance,
  BatchResponse,
  Beats,
  Comment,
  DownloadJob,
  FaceBox,
  FileItem,
  FilePeople,
  FileRequest,
  LockAIInfo,
  LockAIQuota,
  LogEntry,
  MediaDetail,
  MediaFailure,
  Pagination,
  Person,
  ProposedChanges,
  SearchFilters,
  SearchResponse,
  Segment,
  TrashedFile,
  User,
} from './types';

// ---------------------------------------------------------------- 活动

export interface ActivityQuery {
  year?: number;
  month?: number;
  activity_type?: string;
  media_type?: 'image' | 'video';
  q?: string;
  page?: number;
  per_page?: number;
}

export const activitiesApi = {
  list: (query: ActivityQuery = {}, signal?: AbortSignal) =>
    get<ActivityListResponse>('/api/activities', { params: query, signal }),
};

// ---------------------------------------------------------------- 媒体

export const mediaApi = {
  detail: (id: number) => get<MediaDetail>(`/api/files/${id}/media`),
  beats: (id: number) => get<Beats>(`/api/files/${id}/beats`),
  /** 上传者、管理员直接改八拍：整份替换，空数组回到算法的数法 */
  saveBeatOnes: (id: number, ones: number[]) => put<Beats>(`/api/files/${id}/beats/ones`, { ones }),
  align: (a: number, b: number) => get<Alignment>('/api/compare/align', { params: { a, b } }),
};

// ---------------------------------------------------------------- LockAI

export const lockaiApi = {
  quota: () => get<LockAIQuota>('/api/lockai/quota'),
  /** 发起分析；管理员 force 可以重新分析 */
  analyze: (fileId: number, force = false) =>
    post<{ lockai: LockAIInfo; quota: LockAIQuota }>(`/api/files/${fileId}/lockai`, force ? { force } : {}),
};

// ---------------------------------------------------------------- 人物

export const peopleApi = {
  list: (params?: { limit?: number }) => get<{ persons: Person[]; total: number }>('/api/files/persons', { params }),

  files: (id: number, page = 1, per_page = 60) =>
    get<{ person: { id: number; name: string | null; face_count: number }; files: FileItem[]; pagination: Pagination }>(
      `/api/files/persons/${id}`,
      { params: { page, per_page } },
    ),

  appearances: (id: number, page = 1) =>
    get<{
      person: { id: number; name: string | null; face_count: number };
      videos: Array<{ file: FileItem; segments: Segment[]; total: number }>;
      pagination: Pagination;
    }>(`/api/files/persons/${id}/appearances`, { params: { page } }),

  rename: (id: number, name: string) => patch<{ id: number; name: string | null }>(`/api/files/persons/${id}`, { name }),

  /**
   * 把这一份（sourceId）归到另一个人名下。targetRealId 是那个人的身份 id（改名撞名时 existing.id 给的），
   * 不是人物页的 id；合并后这一份还在原来的页面，只是名字、头像跟着那个人走。
   */
  merge: (sourceId: number, targetRealId: number) =>
    post<{ merged_into_real_id: number; source_cluster_id: number; orphan_real_id_deleted: number | null; noop?: boolean }>(
      `/api/files/persons/${sourceId}/merge`,
      { target_id: targetRealId },
    ),

  setCover: (id: number, fileId: number) =>
    put<{ id: number; cover_face_id: number; cover_pinned: boolean }>(`/api/files/persons/${id}/cover`, { file_id: fileId }),

  inFile: (fileId: number) => get<FilePeople>(`/api/files/${fileId}/people`),
  faces: (fileId: number) => get<{ file_id: number; faces: FaceBox[] }>(`/api/files/${fileId}/faces`),
  inVideo: (fileId: number) =>
    get<{ file_id: number; people: Appearance[]; unidentified_count: number }>(`/api/files/${fileId}/appearances`),
};

// ---------------------------------------------------------------- 搜索

export const searchApi = {
  search: (q: string, filters: SearchFilters = {}, limit = 40, signal?: AbortSignal) =>
    post<SearchResponse>('/api/search', { q, filters, limit }, { signal }),
};

// ---------------------------------------------------------------- 评论

export const commentsApi = {
  list: async (fileId: number) => (await get<{ comments: Comment[] }>(`/api/files/${fileId}/comments`)).comments,
  create: async (fileId: number, body: string, t?: number | null) =>
    (await post<{ comment: Comment }>(`/api/files/${fileId}/comments`, { body, ...(t != null ? { t } : {}) })).comment,
  remove: (id: number) => del<{ success: boolean }>(`/api/comments/${id}`),
};

// ---------------------------------------------------------------- 回收站

export const trashApi = {
  list: (page = 1, per_page = 60) =>
    get<{ files: TrashedFile[]; pagination: Pagination }>('/api/trash', { params: { page, per_page } }),
  restore: async (id: number) => (await post<{ file: FileItem }>(`/api/trash/${id}/restore`)).file,
  purge: (id: number) => del<{ success: boolean }>(`/api/trash/${id}`),
  empty: () => post<{ purged: number }>('/api/trash/empty'),
};

// ---------------------------------------------------------------- 打包下载

export const downloadsApi = {
  create: async (fileIds: number[], name: string) =>
    (await post<{ download: DownloadJob }>('/api/downloads', { file_ids: fileIds, name })).download,
  get: async (id: string) => (await get<{ download: DownloadJob }>(`/api/downloads/${id}`)).download,
};

// ---------------------------------------------------------------- 申请

export const requestsApi = {
  create: async (data: { file_id: number; request_type: 'edit' | 'delete' | 'beats'; proposed_changes?: ProposedChanges; message?: string }) =>
    (await post<{ request: FileRequest }>('/api/requests', data)).request,

  createForDirectory: async (data: {
    activity_date: string;
    activity_name: string;
    activity_type: string;
    proposed_changes: { new_activity_name?: string; new_activity_type?: string };
    message?: string;
  }) => (await post<{ request: FileRequest }>('/api/requests/directory', data)).request,

  batch: (fileIds: number[], proposed: ProposedChanges, message?: string) =>
    inBatches(fileIds, (chunk) =>
      post<BatchResponse>('/api/requests/batch', { file_ids: chunk, proposed_changes: proposed, message }),
    ),

  received: async (status?: string) =>
    (await get<{ requests: FileRequest[] }>('/api/requests/received', { params: status ? { status } : {} })).requests,

  sent: async (status?: string) =>
    (await get<{ requests: FileRequest[] }>('/api/requests/sent', { params: status ? { status } : {} })).requests,

  pendingCount: async () => (await get<{ count: number }>('/api/requests/pending-count')).count,

  approve: async (id: number, response_message?: string) =>
    (await post<{ request: FileRequest }>(`/api/requests/${id}/approve`, { response_message })).request,

  reject: async (id: number, response_message?: string) =>
    (await post<{ request: FileRequest }>(`/api/requests/${id}/reject`, { response_message })).request,
};

// ---------------------------------------------------------------- 管理

export const adminApi = {
  stats: () => get<AdminStats>('/api/admin/stats'),
  failures: async () => (await get<{ files: MediaFailure[] }>('/api/admin/media/failures')).files,
  /** 后端一次最多 200 个，多了分批发 */
  reprocess: async (fileIds: number[], steps?: string[]) => {
    const out: { queued: number[]; skipped: Array<{ file_id: number; reason: string }> } = { queued: [], skipped: [] };
    for (const chunk of chunked(fileIds, 200)) {
      const res = await post<typeof out>('/api/admin/media/reprocess', { file_ids: chunk, ...(steps ? { steps } : {}) });
      out.queued.push(...res.queued);
      out.skipped.push(...res.skipped);
    }
    return out;
  },
  users: (page = 1, per_page = 100) =>
    get<{ users: User[]; pagination: Pagination }>('/api/admin/users', { params: { page, per_page } }),
  /** 全部成员：一页最多 100 个，翻到头 */
  allUsers: async () => {
    const all: User[] = [];
    for (let page = 1; page <= 50; page++) {
      const res = await get<{ users: User[]; pagination: Pagination }>('/api/admin/users', { params: { page, per_page: 100 } });
      all.push(...res.users);
      if (!res.pagination.has_next) break;
    }
    return all;
  },
  logs: async (params: { page?: number; per_page?: number; operation?: string; user_id?: number } = {}) =>
    (await get<{ data: { logs: LogEntry[]; total: number; page: number; per_page: number; pages: number } }>(
      '/api/logs',
      { params },
    )).data,
};
