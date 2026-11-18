'use client';

import { Suspense, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpFromLine, Download, PencilLine } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState } from '@/components/brand/LuckyLocker';
import { PauseMark } from '@/components/brand/PauseMark';
import { ButtonLink, IconButton, IconLink } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { FileGrid } from '@/components/media/FileGrid';
import { SelectionBar } from '@/components/media/SelectionBar';
import { DensityToggle } from '@/components/library/FilterBar';
import { ActivityEditDialog } from '@/components/library/ActivityEditDialog';
import { FileViewerOverlay, useViewer } from '@/components/viewer/FileViewerOverlay';
import { useFileActions } from '@/components/files/useFileActions';
import { DropUpload } from '@/components/upload/DropUpload';
import { filesApi } from '@/lib/api/files';
import type { ActivityKey, FileItem, SortMode } from '@/lib/api/types';
import { activityTypeLabel } from '@/lib/constants/activityTypes';
import { formatDuration, splitDate, wallClock, weekday } from '@/lib/format';
import { useLoadMore, useQueryState } from '@/lib/hooks';
import { isAudio, isImage, isVideo } from '@/lib/urls';
import { useUi } from '@/stores/uiStore';

function ActivityPage() {
  const [params, set] = useQueryState();
  const viewer = useViewer();
  const density = useUi((s) => s.density);
  const setDensity = useUi((s) => s.setDensity);
  const { download } = useFileActions();
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const key: ActivityKey = {
    activity_date: params.get('date') ?? '',
    activity_type: params.get('type') ?? '',
    activity_name: params.get('name') ?? '',
  };
  const media = (params.get('media') as '' | 'image' | 'video') ?? '';
  const sort = (params.get('sort') as SortMode) || 'taken';
  const d = splitDate(key.activity_date);
  const title = key.activity_name || activityTypeLabel(key.activity_type);
  const scope = `activity:${key.activity_date}|${key.activity_type}|${key.activity_name}`;

  const info = useQuery({
    queryKey: ['activity', 'directory', key],
    queryFn: () => filesApi.activityDirectory(key),
    enabled: !!key.activity_date,
    meta: { silent: true },
  });

  const query = useInfiniteQuery({
    queryKey: ['files', 'activity', key, media, sort],
    queryFn: ({ pageParam, signal }) =>
      filesApi.list(
        { ...key, media_type: media || undefined, sort, page: pageParam, per_page: 100 },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.has_next ? last.pagination.page + 1 : undefined),
    enabled: !!key.activity_date,
  });
  const files = useMemo<FileItem[]>(() => query.data?.pages.flatMap((p) => p.files) ?? [], [query.data]);
  const total = query.data?.pages[0]?.pagination.total ?? 0;
  const more = useLoadMore(() => query.fetchNextPage(), !!query.hasNextPage && !query.isFetchingNextPage);

  const stats = useMemo(() => {
    const videos = files.filter(isVideo);
    const duration = videos.reduce((s, f) => s + (f.duration ?? 0), 0);
    const taken = files.map((f) => wallClock(f.taken_at)).filter(Boolean) as NonNullable<ReturnType<typeof wallClock>>[];
    const pad = (n: number) => String(n).padStart(2, '0');
    const span = taken.length
      ? (() => {
          const mins = taken.map((c) => c.h * 60 + c.mi);
          const a = Math.min(...mins);
          const b = Math.max(...mins);
          const f = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
          return a === b ? f(a) : `${f(a)}–${f(b)}`;
        })()
      : null;
    return { videos: videos.length, images: files.filter(isImage).length, audios: files.filter(isAudio).length, duration, span };
  }, [files]);

  if (!key.activity_date) {
    return <EmptyState quiet title="无法打开此活动" action={<ButtonLink href="/">返回资料库</ButtonLink>} />;
  }

  const uploadHref = `/upload?${new URLSearchParams({ date: key.activity_date, type: key.activity_type, name: key.activity_name })}`;

  return (
    <DropUpload activity={key}>
      <PageHeader
        leading={
          <IconLink href="/" label="返回资料库" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </IconLink>
        }
        title={<span className="truncate text-[15px] font-medium text-fg">{title}</span>}
        actions={
          <>
            <Tooltip label="上传到此活动">
              <IconLink href={uploadHref} label="上传到此活动">
                <ArrowUpFromLine className="h-4 w-4" />
              </IconLink>
            </Tooltip>
            <Tooltip label="全部下载">
              <IconButton
                label="全部下载"
                disabled={downloading || !files.length || !!query.hasNextPage}
                onClick={async () => {
                  setDownloading(true);
                  try {
                    await download(files, `${key.activity_date} ${title}`);
                  } finally {
                    setDownloading(false);
                  }
                }}
              >
                <Download className="h-4 w-4" />
              </IconButton>
            </Tooltip>
            <Tooltip label={info.data?.is_owner ? '编辑活动' : '申请编辑活动'}>
              <IconButton label="编辑活动" onClick={() => setEditing(true)}>
                <PencilLine className="h-4 w-4" />
              </IconButton>
            </Tooltip>
          </>
        }
      />

      <div className="px-4 pb-24 sm:px-6 lg:px-8">
        {/* 印样的抬头：大日期、活动名、负责人 */}
        <header className="flex flex-col gap-5 pb-7 pt-3 sm:flex-row sm:items-end sm:gap-8">
          {d && (
            <div className="flex items-end gap-3">
              <span
                className="font-display text-[64px] leading-[0.85] tracking-tight text-fg tabular sm:text-[76px]"
                style={{ fontVariationSettings: '"SOFT" 60, "WONK" 0, "opsz" 144' }}
              >
                {d.mm}
                <span className="mx-1 text-fg-faint/60">·</span>
                {d.dd}
              </span>
              <span className="mb-1.5 flex flex-col font-mono text-[11px] leading-tight text-fg-faint">
                <span>{d.y}</span>
                <span>{weekday(key.activity_date)}</span>
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1 pb-0.5">
            <h1 className="font-serif text-[24px] font-semibold leading-tight tracking-tight text-fg sm:text-[28px]">{title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-faint">
              <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-fg-soft">{activityTypeLabel(key.activity_type)}</span>
              {info.data && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={info.data.owner_name} seed={info.data.owner_id} size={18} />
                  负责人 {info.data.owner_name}
                </span>
              )}
              <span className="tabular">
                {[
                  stats.images ? `${stats.images} 张照片` : null,
                  stats.videos ? `${stats.videos} 段视频${stats.duration ? `（${formatDuration(stats.duration)}）` : ''}` : null,
                  stats.audios ? `${stats.audios} 段音频` : null,
                ].filter(Boolean).join(' · ') || `${total} 个文件`}
              </span>
              {stats.span && <span className="font-mono tabular">{stats.span}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Segmented<'' | 'image' | 'video'>
              size="sm"
              value={media}
              onChange={(v) => set({ media: v || null })}
              options={[
                { value: '', label: '全部' },
                { value: 'image', label: '照片' },
                { value: 'video', label: '视频' },
              ]}
            />
            <Segmented<SortMode>
              size="sm"
              value={sort}
              onChange={(v) => set({ sort: v === 'taken' ? null : v })}
              aria-label="排序"
              options={[
                { value: 'taken', label: '拍摄时间' },
                { value: 'uploaded', label: '最新上传' },
              ]}
              className="hidden md:inline-flex"
            />
            <DensityToggle value={density} onChange={setDensity} />
          </div>
        </header>

        {query.isPending ? (
          <div className="skeleton h-[50vh] rounded-2xl" />
        ) : files.length === 0 ? (
          <EmptyState
            title="还没有内容"
            description="将照片或视频拖到此处即可上传。"
            action={
              <ButtonLink href={uploadHref} variant="primary" icon={<ArrowUpFromLine className="h-4 w-4" />}>
                上传
              </ButtonLink>
            }
          />
        ) : (
          <FileGrid files={files} scope={scope} onOpen={(f) => viewer.open(f.id)} />
        )}
        <div ref={more} className="flex h-16 items-center justify-center">
          {query.isFetchingNextPage && <PauseMark size={22} state="busy" />}
        </div>
      </div>

      <SelectionBar scope={scope} files={files} zipName={`${key.activity_date} ${title}`} />
      <FileViewerOverlay files={files} hasMore={!!query.hasNextPage} onNeedMore={() => query.fetchNextPage()} total={total} />
      <ActivityEditDialog open={editing} onClose={() => setEditing(false)} activity={key} isOwner={!!info.data?.is_owner} />
    </DropUpload>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ActivityPage />
    </Suspense>
  );
}
