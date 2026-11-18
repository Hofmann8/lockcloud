'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { FileItem } from '@/lib/api/types';
import { useQueryState } from '@/lib/hooks';
import { FileViewer } from './FileViewer';

// 这一次会话里是不是我们自己推了 ?f=：是的话关闭时后退，否则去掉参数
let pushedHere = false;

/** 网格上打开文件：地址栏带 ?f=id，后退能关、链接能分享 */
export function useViewer() {
  const [params, set] = useQueryState();
  const router = useRouter();
  const id = Number(params.get('f')) || null;
  const t = params.get('t');

  const open = useCallback(
    (fileId: number, at?: number) => {
      pushedHere = true;
      set({ f: fileId, t: at != null ? Math.floor(at) : null }, { push: true });
    },
    [set],
  );
  const replace = useCallback((fileId: number) => set({ f: fileId, t: null }), [set]);
  const close = useCallback(() => {
    if (pushedHere) {
      pushedHere = false;
      router.back();
    } else set({ f: null, t: null });
  }, [router, set]);

  return { id, startAt: t ? Number(t) : null, open, replace, close };
}

interface OverlayProps {
  files: FileItem[];
  /** 列表后面还有，快翻到底时要下一页 */
  hasMore?: boolean;
  onNeedMore?: () => void;
  total?: number | null;
}

export function FileViewerOverlay({ files, hasMore, onNeedMore, total }: OverlayProps) {
  const viewer = useViewer();
  const index = viewer.id ? files.findIndex((f) => f.id === viewer.id) : -1;
  const prev = index > 0 ? files[index - 1] : null;
  const next = index >= 0 && index < files.length - 1 ? files[index + 1] : null;
  const asked = useRef(-1);

  useEffect(() => {
    if (index >= 0 && hasMore && files.length - index < 6 && asked.current !== files.length) {
      asked.current = files.length;
      onNeedMore?.();
    }
  }, [index, files.length, hasMore, onNeedMore]);

  // 打开时锁住页面滚动
  useEffect(() => {
    if (!viewer.id) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [viewer.id]);

  if (!viewer.id) return null;

  return (
    <FileViewer
      fileId={viewer.id}
      initial={index >= 0 ? files[index] : undefined}
      onClose={viewer.close}
      onPrev={prev ? () => viewer.replace(prev.id) : null}
      onNext={next ? () => viewer.replace(next.id) : null}
      prevId={prev?.id}
      nextId={next?.id}
      position={index >= 0 ? { index, total: total ?? (hasMore ? null : files.length) } : undefined}
      startAt={viewer.startAt}
    />
  );
}
