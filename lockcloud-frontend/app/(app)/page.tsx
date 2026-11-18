'use client';

import { Suspense, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowUpFromLine } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { FilterBar, type LibraryFilters } from '@/components/library/FilterBar';
import { ActivityCard, ActivityCardSkeleton } from '@/components/library/ActivityCard';
import { EmptyState } from '@/components/brand/LuckyLocker';
import { PauseMark } from '@/components/brand/PauseMark';
import { ButtonLink } from '@/components/ui/Button';
import { FileGrid } from '@/components/media/FileGrid';
import { SelectionBar } from '@/components/media/SelectionBar';
import { useViewer, FileViewerOverlay } from '@/components/viewer/FileViewerOverlay';
import { activitiesApi } from '@/lib/api/media';
import { filesApi } from '@/lib/api/files';
import type { Activity, FileItem } from '@/lib/api/types';
import { useLoadMore, useQueryState } from '@/lib/hooks';

function useFilters(): [LibraryFilters, (patch: Partial<LibraryFilters>) => void] {
  const [params, set] = useQueryState();
  const value: LibraryFilters = {
    type: params.get('type') ?? '',
    media: (params.get('media') as LibraryFilters['media']) ?? '',
    year: params.get('year') ?? '',
    view: params.get('view') === 'all' ? 'all' : 'activities',
  };
  return [value, (patch) => set({ ...patch, view: patch.view === 'activities' ? null : patch.view })];
}

function groupByMonth(list: Activity[]) {
  const groups: Array<{ key: string; label: string; items: Activity[] }> = [];
  for (const a of list) {
    const key = a.activity_date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const [y, m] = key.split('-');
      g = { key, label: `${y} 年 ${Number(m)} 月`, items: [] };
      groups.push(g);
    }
    g.items.push(a);
  }
  return groups;
}

function ActivitiesView({ filters }: { filters: LibraryFilters }) {
  const query = useInfiniteQuery({
    queryKey: ['activities', 'library', filters.type, filters.media, filters.year],
    queryFn: ({ pageParam, signal }) =>
      activitiesApi.list(
        {
          page: pageParam,
          per_page: 30,
          activity_type: filters.type || undefined,
          media_type: filters.media || undefined,
          year: filters.year ? Number(filters.year) : undefined,
        },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.has_next ? last.pagination.page + 1 : undefined),
  });
  const list = useMemo(() => query.data?.pages.flatMap((p) => p.activities) ?? [], [query.data]);
  const groups = useMemo(() => groupByMonth(list), [list]);
  const more = useLoadMore(() => query.fetchNextPage(), !!query.hasNextPage && !query.isFetchingNextPage);

  if (query.isPending) {
    return (
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <ActivityCardSkeleton key={i} />)}
      </div>
    );
  }

  if (!list.length) {
    const filtered = filters.type || filters.media || filters.year;
    return filtered ? (
      <EmptyState quiet title="没有匹配的活动" description="请尝试其他筛选条件。" />
    ) : (
      <EmptyState
        title="还没有照片"
        description="上传的照片和视频会按活动整理在这里。"
        action={
          <ButtonLink href="/upload" variant="primary" icon={<ArrowUpFromLine className="h-4 w-4" />}>
            上传
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`m-${g.key}`}>
          <h2 id={`m-${g.key}`} className="mb-4 flex items-baseline gap-3 text-fg">
            <span className="font-serif text-[19px] font-semibold tracking-tight">{g.label}</span>
            <span className="text-xs text-fg-faint tabular">{g.items.length} 个活动</span>
          </h2>
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {g.items.map((a) => (
              <ActivityCard key={`${a.activity_date}|${a.activity_type}|${a.activity_name}`} activity={a} />
            ))}
          </div>
        </section>
      ))}
      <div ref={more} className="flex h-16 items-center justify-center">
        {query.isFetchingNextPage && <PauseMark size={22} state="busy" />}
      </div>
    </div>
  );
}

function AllFilesView({ filters }: { filters: LibraryFilters }) {
  const viewer = useViewer();
  const query = useInfiniteQuery({
    queryKey: ['files', 'library', filters.type, filters.media, filters.year],
    queryFn: ({ pageParam, signal }) =>
      filesApi.list(
        {
          page: pageParam,
          per_page: 100,
          activity_type: filters.type || undefined,
          media_type: filters.media || undefined,
          year: filters.year ? Number(filters.year) : undefined,
        },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.has_next ? last.pagination.page + 1 : undefined),
  });
  const files = useMemo<FileItem[]>(() => query.data?.pages.flatMap((p) => p.files) ?? [], [query.data]);
  const more = useLoadMore(() => query.fetchNextPage(), !!query.hasNextPage && !query.isFetchingNextPage);

  if (query.isPending) return <div className="skeleton h-[60vh] rounded-2xl" />;
  if (!files.length) return <EmptyState quiet title="没有匹配的文件" />;

  return (
    <>
      <FileGrid files={files} scope="library" onOpen={(f) => viewer.open(f.id)} />
      <div ref={more} className="flex h-16 items-center justify-center">
        {query.isFetchingNextPage && <PauseMark size={22} state="busy" />}
      </div>
      <SelectionBar scope="library" files={files} />
      <FileViewerOverlay
        files={files}
        hasMore={!!query.hasNextPage}
        onNeedMore={() => query.fetchNextPage()}
      />
    </>
  );
}

function Library() {
  const [filters, setFilters] = useFilters();
  const years = useQuery({
    queryKey: ['activities', 'years'],
    queryFn: () => activitiesApi.list({ per_page: 1 }),
    select: (d) => d.years,
    staleTime: 5 * 60 * 1000,
    meta: { silent: true },
  });

  return (
    <>
      <PageHeader title="资料库" toolbar={<FilterBar value={filters} onChange={setFilters} years={years.data ?? []} />} />
      <div className="px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        {filters.view === 'all' ? <AllFilesView filters={filters} /> : <ActivitiesView filters={filters} />}
      </div>
    </>
  );
}

export default function LibraryPage() {
  return (
    <Suspense>
      <Library />
    </Suspense>
  );
}
