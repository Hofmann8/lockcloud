'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState } from '@/components/brand/LuckyLocker';
import { PauseMark } from '@/components/brand/PauseMark';
import { Button } from '@/components/ui/Button';
import { Confirm } from '@/components/ui/Dialog';
import { toast } from '@/components/ui/Toast';
import { Thumb } from '@/components/media/Thumb';
import { useRefreshLibrary } from '@/components/files/useFileActions';
import { errorMessage } from '@/lib/api/client';
import { trashApi } from '@/lib/api/media';
import type { TrashedFile } from '@/lib/api/types';
import { formatBytes, parseServerTime, relativeTime } from '@/lib/format';
import { useLoadMore } from '@/lib/hooks';
import { displayName } from '@/lib/urls';
import { useIsAdmin, useUser } from '@/stores/authStore';

function daysLeft(purgeAt: string): number {
  const d = parseServerTime(purgeAt);
  return d ? Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000)) : 0;
}

export default function TrashPage() {
  const qc = useQueryClient();
  const refresh = useRefreshLibrary();
  const isAdmin = useIsAdmin();
  const user = useUser();
  const [purging, setPurging] = useState<TrashedFile | null>(null);
  const [emptying, setEmptying] = useState(false);
  const [busy, setBusy] = useState<number | 'all' | null>(null);

  const query = useInfiniteQuery({
    queryKey: ['trash'],
    queryFn: ({ pageParam }) => trashApi.list(pageParam, 60),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.has_next ? last.pagination.page + 1 : undefined),
  });
  const files = useMemo(() => query.data?.pages.flatMap((p) => p.files) ?? [], [query.data]);
  const total = query.data?.pages[0]?.pagination.total ?? 0;
  const more = useLoadMore(() => query.fetchNextPage(), !!query.hasNextPage && !query.isFetchingNextPage);

  const restore = async (f: TrashedFile) => {
    setBusy(f.id);
    try {
      await trashApi.restore(f.id);
      refresh();
      toast(`已恢复「${displayName(f)}」`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="回收站"
        subtitle={total ? `${total} 个文件，保留 30 天后永久删除` : '删除的文件保留 30 天'}
        actions={
          isAdmin && files.length > 0 ? (
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setEmptying(true)}>
              清空回收站
            </Button>
          ) : undefined
        }
      />
      <div className="px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        {query.isPending ? (
          <div className="flex max-w-4xl flex-col gap-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
        ) : !files.length ? (
          <EmptyState title="回收站为空" description="删除的文件会在此保留 30 天，期间可随时恢复。" />
        ) : (
          <ul className="flex max-w-4xl flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {files.map((f) => {
              const left = daysLeft(f.purge_at);
              const canPurge = isAdmin || f.uploader_id === user?.id;
              return (
                <li key={f.id} className="flex items-center gap-3.5 px-3 py-2.5">
                  <Thumb file={f} width={72} scrub={false} className="h-14 w-14 shrink-0 rounded-lg" showBadges={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-fg">{displayName(f)}</p>
                    <p className="truncate text-[11.5px] text-fg-faint">
                      {f.activity_name || f.activity_type_display} · {formatBytes(f.size)} ·{' '}
                      {f.deleted_by?.name ?? '成员'} 删除于 {relativeTime(f.deleted_at)}
                    </p>
                  </div>
                  <span className={left <= 3 ? 'shrink-0 text-[12px] text-danger tabular' : 'shrink-0 text-[12px] text-fg-faint tabular'}>
                    {left > 0 ? `剩余 ${left} 天` : '今天删除'}
                  </span>
                  <Button size="sm" onClick={() => restore(f)} loading={busy === f.id} icon={<RotateCcw className="h-3.5 w-3.5" />}>
                    恢复
                  </Button>
                  {canPurge && (
                    <button
                      type="button"
                      onClick={() => setPurging(f)}
                      aria-label="永久删除"
                      className="rounded-lg p-2 text-fg-faint transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div ref={more} className="flex h-16 items-center justify-center">
          {query.isFetchingNextPage && <PauseMark size={22} state="busy" />}
        </div>
      </div>

      <Confirm
        open={!!purging}
        onClose={() => setPurging(null)}
        title="永久删除？"
        description={`「${purging ? displayName(purging) : ''}」将被永久删除，此操作无法撤销。`}
        confirmLabel="永久删除"
        danger
        busy={busy === purging?.id}
        onConfirm={async () => {
          if (!purging) return;
          setBusy(purging.id);
          try {
            await trashApi.purge(purging.id);
            void qc.invalidateQueries({ queryKey: ['trash'] });
            toast('已永久删除');
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(null);
            setPurging(null);
          }
        }}
      />
      <Confirm
        open={emptying}
        onClose={() => setEmptying(false)}
        title={`永久删除全部 ${total} 个文件？`}
        description="此操作无法撤销。"
        confirmLabel="全部删除"
        danger
        busy={busy === 'all'}
        onConfirm={async () => {
          setBusy('all');
          try {
            const res = await trashApi.empty();
            void qc.invalidateQueries({ queryKey: ['trash'] });
            toast(`已永久删除 ${res.purged} 个文件`);
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(null);
            setEmptying(false);
          }
        }}
      />
    </>
  );
}
