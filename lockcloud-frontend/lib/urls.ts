'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { thumbHashToApproximateAspectRatio, thumbHashToDataURL } from 'thumbhash';
import { filesApi } from './api/files';
import type { FileItem, StylePreset } from './api/types';

/**
 * 私有桶的签名地址。
 * 网格里每张卡片各自要地址，这里把同一帧里的请求攒起来，按 100 个一批去换，
 * 结果按过期时间缓存（提前 5 分钟当作过期）。
 */

interface Entry {
  url: string;
  expiresAt: number;
  fetchedAt: number;
}

const cache = new Map<string, Entry>();
const queued = new Map<StylePreset, Set<number>>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let timer: number | null = null;

const key = (id: number, style: StylePreset) => `${id}:${style}`;
const fresh = (e?: Entry) => !!e && Date.now() < e.expiresAt - 5 * 60 * 1000;

function notify() {
  version++;
  for (const l of listeners) l();
}

async function flush() {
  timer = null;
  const batches = [...queued.entries()];
  queued.clear();
  await Promise.all(
    batches.map(async ([style, idSet]) => {
      const ids = [...idSet];
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        try {
          const res = await filesApi.signedUrls(chunk, style);
          const fetchedAt = Date.now();
          const expiresAt = fetchedAt + res.expires_in * 1000;
          for (const [id, v] of Object.entries(res.urls)) cache.set(key(Number(id), style), { url: v.signed_url, expiresAt, fetchedAt });
        } catch {
          // 失败的下次渲染再要
        } finally {
          for (const id of chunk) inflight.delete(key(id, style));
        }
      }
    }),
  );
  notify();
}

export function requestUrl(id: number, style: StylePreset) {
  const k = key(id, style);
  if (fresh(cache.get(k)) || inflight.has(k)) return;
  inflight.add(k);
  if (!queued.has(style)) queued.set(style, new Set());
  queued.get(style)!.add(id);
  if (timer == null) timer = window.setTimeout(flush, 16);
}

export function cachedUrl(id: number, style: StylePreset): string | null {
  const e = cache.get(key(id, style));
  return e ? e.url : null;
}

/**
 * 图片加载失败时调用。地址拿到手有一阵了，多半是签名过期，丢掉换个新的（换回来会自动重渲染），返回 true；
 * 刚换的地址还是失败，说明图本身有问题，返回 false，不再重试。
 */
export function refreshUrl(id: number, style: StylePreset): boolean {
  const k = key(id, style);
  const e = cache.get(k);
  if (!e || Date.now() - e.fetchedAt < 60 * 1000) return false;
  cache.delete(k);
  requestUrl(id, style);
  return true;
}

// 页面放在后台很久再切回来：让用着地址的地方都重新看一眼，快过期的会去换新的
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 拿一个文件某个用途的地址；没有就排队去换，换回来自动重渲染 */
export function useSignedUrl(id: number | null | undefined, style: StylePreset, enabled = true): string | null {
  useSyncExternalStore(subscribe, () => version, () => 0);
  useEffect(() => {
    if (id && enabled) requestUrl(id, style);
  }, [id, style, enabled]);
  if (!id || !enabled) return null;
  const e = cache.get(key(id, style));
  if (e && !fresh(e) && typeof window !== 'undefined') requestUrl(id, style);
  return e?.url ?? null;
}

/** 预热一批（比如打开灯箱前把左右两张的大图先要了） */
export function prefetchUrls(ids: number[], style: StylePreset) {
  for (const id of ids) requestUrl(id, style);
}

// ---------------------------------------------------------------- thumbhash 占位

const hashCache = new Map<string, string>();

export function thumbhashUrl(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const hit = hashCache.get(hash);
  if (hit) return hit;
  try {
    const bin = atob(hash);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = thumbHashToDataURL(bytes);
    hashCache.set(hash, url);
    return url;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- 文件的小工具

export const displayName = (f: Pick<FileItem, 'filename' | 'original_filename'>) => f.filename || f.original_filename || '';

// 类别以后端定的 Content-Type 为准（上传时按格式表 backend/services/formats.py 定好），扩展名只给老数据兜底
export function isVideo(f: Pick<FileItem, 'content_type' | 'filename'>): boolean {
  if (f.content_type?.startsWith('video/')) return true;
  return /\.(mp4|m4v|mov|avi|mkv|webm|flv|wmv|3gp|mts|m2ts|mpe?g)$/i.test(f.filename || '');
}

export function isImage(f: Pick<FileItem, 'content_type' | 'filename'>): boolean {
  if (f.content_type?.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|bmp|webp|heic|heif|avif|tiff?|dng|cr2|cr3|nef|arw|raf|orf|rw2)$/i.test(f.filename || '');
}

export function isAudio(f: Pick<FileItem, 'content_type' | 'filename'>): boolean {
  if (f.content_type?.startsWith('audio/')) return true;
  return /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|wma|aiff?|amr)$/i.test(f.filename || '');
}

/**
 * 网格缩略图用途：按设备像素挑一档。
 * 后端每档是「长边不超过 N」（m_lfit，N = 200 / 320 / 480 / 720 / 1280，见 backend/services/media.py），所以要按图片自己的比例算出铺满格子需要的长边：
 * 竖图放进横格子（cover）时，长边得是格子宽的 1/比例 倍，只看格子宽会小一大截、被放大发糊。
 */
export function thumbStyle(cssWidth: number, cssHeight?: number, aspect = 1, fit: 'cover' | 'contain' = 'cover'): StylePreset {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 2;
  // 长边记作 1 时，图的宽、高各占多少
  const [nw, nh] = aspect >= 1 ? [1, 1 / aspect] : [aspect, 1];
  const byW = cssWidth / nw;
  const byH = cssHeight ? cssHeight / nh : 0;
  const long = (fit === 'cover' ? Math.max(byW, byH) : cssHeight ? Math.min(byW, byH) : byW) * dpr;
  if (long <= 200) return 'thumbnav';
  if (long <= 320) return 'thumbnavdesktop';
  if (long <= 480) return 'thumbmobile';
  if (long <= 720) return 'thumbdesktop';
  return 'previewmobile';
}

export function previewStyle(): StylePreset {
  if (typeof window === 'undefined') return 'previewdesktop';
  const px = Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2);
  if (px <= 1400) return 'previewmobile';
  if (px <= 2100) return 'previewtablet';
  return 'previewdesktop';
}

/** 显示宽高比（宽 / 高）：有尺寸按尺寸（EXIF 5–8 对调），没有就看 thumbhash，再不行给个常见比例 */
export function aspectOf(f: Pick<FileItem, 'width' | 'height' | 'orientation' | 'thumbhash' | 'content_type' | 'filename'>): number {
  let w = f.width ?? 0;
  let h = f.height ?? 0;
  if (w > 0 && h > 0) {
    if ((f.orientation ?? 1) >= 5) [w, h] = [h, w];
    return Math.min(3, Math.max(0.42, w / h));
  }
  if (f.thumbhash) {
    try {
      const bin = atob(f.thumbhash);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return Math.min(3, Math.max(0.42, thumbHashToApproximateAspectRatio(bytes)));
    } catch {
      // 落到下面的默认值
    }
  }
  return isVideo(f) ? 16 / 9 : 4 / 3;
}
