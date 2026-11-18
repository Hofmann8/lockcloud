'use client';

import { get } from './api/client';
import { downloadsApi } from './api/media';
import type { DownloadJob, FileItem } from './api/types';

/** 让浏览器去下一个地址（签名里带了 attachment，不会在新标签页打开） */
export function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadOriginal(file: Pick<FileItem, 'id'>) {
  const res = await get<{ signed_url: string }>(`/api/files/signed-url/${file.id}`, {
    params: { style: 'original', download: 1 },
  });
  triggerDownload(res.signed_url);
}

/**
 * 多个文件交给 FC 打包，轮询到好了再下。
 * onProgress 每次轮询回调一次，给界面显示状态。
 */
export async function downloadZip(
  files: Array<Pick<FileItem, 'id'>>,
  name: string,
  onProgress?: (job: DownloadJob) => void,
  signal?: AbortSignal,
): Promise<DownloadJob> {
  let job = await downloadsApi.create(files.map((f) => f.id), name);
  onProgress?.(job);
  while (job.status === 'pending' || job.status === 'running') {
    await new Promise((r) => window.setTimeout(r, 2000));
    if (signal?.aborted) return job;
    job = await downloadsApi.get(job.id);
    onProgress?.(job);
  }
  if (job.status === 'ready' && job.url) triggerDownload(job.url);
  return job;
}
