import axios from 'axios';
import { create } from 'zustand';
import { ApiError, errorMessage } from '@/lib/api/client';
import { filesApi, uploadContentType } from '@/lib/api/files';
import type { ActivityKey } from '@/lib/api/types';

export type UploadStatus = 'queued' | 'uploading' | 'confirming' | 'done' | 'failed' | 'canceled';

export interface UploadItem {
  id: string;
  file: File;
  /** 最后存进库里的文件名（不含扩展名时用原名） */
  stem: string | null;
  /** 重名时自动加 (2)、(3) */
  autoRename: boolean;
  activity: ActivityKey;
  status: UploadStatus;
  loaded: number;
  error?: string;
  fileId?: number;
  startedAt?: number;
}

interface UploadState {
  items: UploadItem[];
  /** 上传完一批后调用（让列表刷新） */
  onDone: (() => void) | null;
  add: (files: Array<{ file: File; stem?: string | null; autoRename?: boolean }>, activity: ActivityKey) => void;
  retry: (id: string) => void;
  cancel: (id: string) => void;
  clearFinished: () => void;
  setOnDone: (cb: (() => void) | null) => void;
}

const CONCURRENCY = 3;
const controllers = new Map<string, AbortController>();
let seq = 0;

const splitName = (name: string) => {
  const i = name.lastIndexOf('.');
  return i > 0 ? { stem: name.slice(0, i), ext: name.slice(i) } : { stem: name, ext: '' };
};

export const useUploads = create<UploadState>()((set, get) => {
  const patch = (id: string, p: Partial<UploadItem>) =>
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...p } : it)) }));

  const pump = () => {
    const { items } = get();
    const active = items.filter((i) => i.status === 'uploading' || i.status === 'confirming').length;
    const next = items.filter((i) => i.status === 'queued').slice(0, Math.max(0, CONCURRENCY - active));
    for (const item of next) void run(item);
  };

  const run = async (item: UploadItem) => {
    const controller = new AbortController();
    controllers.set(item.id, controller);
    patch(item.id, { status: 'uploading', loaded: 0, error: undefined, startedAt: Date.now() });
    const contentType = uploadContentType(item.file);
    const base = splitName(item.file.name);
    try {
      // 要上传地址；重名且允许自动改名时加 (2)、(3)……
      let ticket: Awaited<ReturnType<typeof filesApi.uploadUrl>> | null = null;
      let stem = item.stem;
      for (let n = 2; !ticket; n++) {
        try {
          ticket = await filesApi.uploadUrl({
            original_filename: item.file.name,
            content_type: contentType,
            size: item.file.size,
            ...item.activity,
            custom_filename: stem ?? undefined,
          });
        } catch (e) {
          if (e instanceof ApiError && e.code === 'FILE_005' && item.autoRename && n < 50) {
            stem = `${item.stem ?? base.stem} (${n})`;
            continue;
          }
          throw e;
        }
      }
      const signedType = ticket.content_type || contentType;
      await axios.put(ticket.upload_url, item.file, {
        headers: { 'Content-Type': signedType },
        signal: controller.signal,
        onUploadProgress: (ev) => patch(item.id, { loaded: ev.loaded }),
      });
      patch(item.id, { status: 'confirming', loaded: item.file.size });
      const saved = await filesApi.confirm({
        s3_key: ticket.s3_key,
        size: item.file.size,
        content_type: signedType,
        original_filename: item.file.name,
        ...item.activity,
      });
      patch(item.id, { status: 'done', fileId: saved.id });
    } catch (e) {
      if (axios.isCancel(e) || controller.signal.aborted) patch(item.id, { status: 'canceled' });
      else patch(item.id, { status: 'failed', error: errorMessage(e, '上传失败') });
    } finally {
      controllers.delete(item.id);
      const s = get();
      const busy = s.items.some((i) => i.status === 'queued' || i.status === 'uploading' || i.status === 'confirming');
      if (!busy) s.onDone?.();
      pump();
    }
  };

  return {
    items: [],
    onDone: null,

    add: (files, activity) => {
      const fresh: UploadItem[] = files.map(({ file, stem, autoRename }) => ({
        id: `u${++seq}`,
        file,
        stem: stem ?? null,
        autoRename: !!autoRename,
        activity,
        status: 'queued',
        loaded: 0,
      }));
      set((s) => ({ items: [...s.items, ...fresh] }));
      pump();
    },

    retry: (id) => {
      patch(id, { status: 'queued', error: undefined, loaded: 0 });
      pump();
    },

    cancel: (id) => {
      const c = controllers.get(id);
      if (c) c.abort();
      else patch(id, { status: 'canceled' });
    },

    clearFinished: () =>
      set((s) => ({ items: s.items.filter((i) => i.status !== 'done' && i.status !== 'canceled') })),

    setOnDone: (cb) => set({ onDone: cb }),
  };
});

export const isActive = (i: UploadItem) => i.status === 'queued' || i.status === 'uploading' || i.status === 'confirming';
