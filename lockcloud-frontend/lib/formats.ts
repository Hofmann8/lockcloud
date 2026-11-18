'use client';

import { useQuery, type QueryClient } from '@tanstack/react-query';
import { filesApi } from '@/lib/api/files';

/** 能上传的格式只有一份，在后端的格式表里（backend/services/formats.py），这里按需取一次 */
const KEY = ['formats'] as const;
const options = {
  queryKey: KEY,
  queryFn: async () => new Set((await filesApi.formats()).formats.map((f) => f.ext)),
  staleTime: Infinity,
  meta: { silent: true },
};

export const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

/** 能上传的扩展名；还没拿到时是 null */
export function useFormats(): Set<string> | null {
  return useQuery(options).data ?? null;
}

export function fetchFormats(qc: QueryClient): Promise<Set<string> | null> {
  return qc.fetchQuery(options).catch(() => null);
}

/** 格式表还没拿到（或拿不到）时先放行：后端签上传地址时还会再挡一次 */
export const isUploadable = (formats: Set<string> | null, name: string) => !formats || formats.has(extOf(name));
