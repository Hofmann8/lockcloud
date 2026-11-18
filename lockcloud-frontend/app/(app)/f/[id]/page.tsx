'use client';

import { Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileViewer } from '@/components/viewer/FileViewer';
import { filesApi } from '@/lib/api/files';
import type { FileItem } from '@/lib/api/types';
import { activityHref, fileHref } from '@/lib/routes';

/** 直接打开的文件页（分享出去的链接）。上一个 / 下一个按同一活动里的顺序 */
function FilePage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const fileId = Number(id);
  const t = params.get('t');

  const adjacent = useQuery({
    queryKey: ['adjacent', fileId],
    queryFn: () => filesApi.adjacent(fileId, 1),
    meta: { silent: true },
  });
  const prev = adjacent.data?.previous ?? null;
  const next = adjacent.data?.next ?? null;

  const go = (f: FileItem | null) => {
    if (!f) return null;
    return () => {
      qc.setQueryData(['file', f.id], (old: FileItem | undefined) => old ?? f);
      router.replace(fileHref(f.id));
    };
  };

  const close = () => {
    const f = qc.getQueryData<FileItem>(['file', fileId]);
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else if (f?.activity_date) router.replace(activityHref({ activity_date: f.activity_date, activity_type: f.activity_type ?? '', activity_name: f.activity_name ?? '' }));
    else router.replace('/');
  };

  return (
    <FileViewer
      key={fileId}
      fileId={fileId}
      mode="page"
      onClose={close}
      onPrev={go(prev)}
      onNext={go(next)}
      prevId={prev?.id}
      nextId={next?.id}
      startAt={t ? Number(t) : null}
    />
  );
}

export default function Page() {
  return (
    <Suspense>
      <FilePage />
    </Suspense>
  );
}
