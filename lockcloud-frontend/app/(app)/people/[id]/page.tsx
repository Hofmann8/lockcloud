'use client';

import { Suspense, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ImageIcon, PencilLine } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState } from '@/components/brand/LuckyLocker';
import { PauseMark } from '@/components/brand/PauseMark';
import { Avatar } from '@/components/ui/Avatar';
import { Button, IconLink } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Segmented } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';
import { FileGrid } from '@/components/media/FileGrid';
import { SelectionBar } from '@/components/media/SelectionBar';
import { Thumb } from '@/components/media/Thumb';
import { FileViewerOverlay, useViewer } from '@/components/viewer/FileViewerOverlay';
import { ApiError, errorMessage } from '@/lib/api/client';
import { peopleApi } from '@/lib/api/media';
import type { FileItem, PersonInFile } from '@/lib/api/types';
import { formatDate, formatTimecode } from '@/lib/format';
import { useLoadMore, useQueryState } from '@/lib/hooks';
import { displayName, isImage } from '@/lib/urls';

function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const personId = Number(id);
  const qc = useQueryClient();
  const viewer = useViewer();
  const [params, set] = useQueryState();
  const tab = params.get('tab') === 'videos' ? 'videos' : 'photos';
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [conflict, setConflict] = useState<PersonInFile | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const all = useQuery({ queryKey: ['people', 'all'], queryFn: () => peopleApi.list({ limit: 1000 }), meta: { silent: true } });
  const self = all.data?.persons.find((p) => p.id === personId);

  const photos = useInfiniteQuery({
    queryKey: ['person', personId, 'files'],
    queryFn: ({ pageParam }) => peopleApi.files(personId, pageParam, 60),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.has_next ? last.pagination.page + 1 : undefined),
  });
  const videos = useQuery({
    queryKey: ['person', personId, 'appearances'],
    queryFn: () => peopleApi.appearances(personId),
    enabled: tab === 'videos',
    meta: { silent: true },
  });

  const files = useMemo<FileItem[]>(() => photos.data?.pages.flatMap((p) => p.files) ?? [], [photos.data]);
  const images = useMemo(() => files.filter(isImage), [files]);
  const person = photos.data?.pages[0]?.person;
  const displayed = person?.name ?? self?.name ?? null;
  const more = useLoadMore(() => photos.fetchNextPage(), tab === 'photos' && !!photos.hasNextPage && !photos.isFetchingNextPage);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['people'] });
    void qc.invalidateQueries({ queryKey: ['person', personId] });
  };

  const rename = async () => {
    const clean = name.trim();
    if (!clean || clean === displayed) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    try {
      await peopleApi.rename(personId, clean);
      refresh();
      setRenaming(false);
      toast(`已命名为「${clean}」`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NAME_CONFLICT' && e.details.existing) {
        setConflict(e.details.existing as PersonInFile);
      } else {
        toast.error(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const merge = async () => {
    if (!conflict) return;
    setBusy(true);
    try {
      // conflict.id 是那个名字的身份 id。合并后这一份还是这个页面，只是名字跟着走，所以留在原地刷新
      await peopleApi.merge(personId, conflict.id);
      setConflict(null);
      setRenaming(false);
      refresh();
      toast(`已合并到「${conflict.name}」`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        leading={
          <IconLink href="/people" label="返回人物" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </IconLink>
        }
        title={<span className="truncate text-[15px] font-medium text-fg">{displayed || '未命名'}</span>}
      />
      <div className="px-4 pb-24 sm:px-6 lg:px-8">
        <header className="flex flex-col items-start gap-5 pb-8 pt-3 sm:flex-row sm:items-center">
          <button type="button" onClick={() => setPicking(true)} className="group relative rounded-full" aria-label="更换头像">
            <Avatar src={self?.thumb_url} name={displayed || '?'} seed={personId} size={96} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[12px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              更换头像
            </span>
          </button>
          <div className="min-w-0 flex-1">
            {renaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void rename();
                }}
                className="flex max-w-sm items-center gap-2"
              >
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="名字" maxLength={50} />
                <Button type="submit" variant="primary" loading={busy} icon={<Check className="h-4 w-4" />}>完成</Button>
                <Button variant="ghost" onClick={() => setRenaming(false)}>取消</Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setName(displayed ?? '');
                  setRenaming(true);
                }}
                className="group flex items-center gap-2"
              >
                <h1 className={displayed ? 'font-serif text-[28px] font-semibold tracking-tight text-fg' : 'text-[22px] text-fg-faint'}>
                  {displayed || '添加名字'}
                </h1>
                <PencilLine className="h-4 w-4 text-fg-faint opacity-60 group-hover:opacity-100" />
              </button>
            )}
            <p className="mt-1.5 text-[13px] text-fg-faint tabular">
              出现 {person?.face_count ?? self?.face_count ?? 0} 次
            </p>
          </div>
          <Segmented<'photos' | 'videos'>
            value={tab}
            onChange={(v) => set({ tab: v === 'photos' ? null : v })}
            options={[
              { value: 'photos', label: '照片' },
              { value: 'videos', label: '视频' },
            ]}
          />
        </header>

        {tab === 'photos' ? (
          photos.isPending ? (
            <div className="skeleton h-[50vh] rounded-2xl" />
          ) : files.length ? (
            <>
              <FileGrid files={files} scope={`person:${personId}`} onOpen={(f) => viewer.open(f.id)} />
              <div ref={more} className="flex h-16 items-center justify-center">
                {photos.isFetchingNextPage && <PauseMark size={22} state="busy" />}
              </div>
            </>
          ) : (
            <EmptyState quiet title="暂无照片" />
          )
        ) : videos.isPending ? (
          <div className="flex justify-center py-16"><PauseMark size={26} state="busy" /></div>
        ) : videos.data?.videos.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {videos.data.videos.map((v) => (
              <li key={v.file.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-2.5">
                <button type="button" onClick={() => viewer.open(v.file.id, v.segments[0]?.start)} className="w-36 shrink-0">
                  <Thumb file={v.file} width={144} className="aspect-video w-full rounded-xl" />
                </button>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="truncate text-[13.5px] text-fg">{displayName(v.file)}</p>
                  <p className="truncate text-[11.5px] text-fg-faint">
                    {v.file.activity_name} · {formatDate(v.file.activity_date)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.segments.slice(0, 10).map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        onClick={() => viewer.open(v.file.id, s.start)}
                        className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-soft hover:bg-accent-soft hover:text-accent-ink tabular"
                      >
                        {formatTimecode(s.start)}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState quiet title="暂无视频" />
        )}
      </div>

      <SelectionBar scope={`person:${personId}`} files={files} zipName={displayed || '人物'} />
      <FileViewerOverlay files={files} hasMore={!!photos.hasNextPage} onNeedMore={() => photos.fetchNextPage()} />

      <Dialog
        open={!!conflict}
        onClose={() => setConflict(null)}
        title={`已有名为「${conflict?.name}」的人物`}
        description="是同一个人吗？合并后，照片将归入同一人物。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConflict(null)}>换个名字</Button>
            <Button variant="primary" onClick={merge} loading={busy} data-autofocus>合并</Button>
          </>
        }
      >
        {conflict && (
          <div className="flex items-center justify-center gap-6 px-6 py-5">
            <div className="flex flex-col items-center gap-1.5">
              <Avatar src={self?.thumb_url} name={displayed || '?'} seed={personId} size={64} />
              <span className="text-xs text-fg-faint">当前</span>
            </div>
            <span className="text-fg-faint">=</span>
            <div className="flex flex-col items-center gap-1.5">
              <Avatar src={conflict.thumb_url} name={conflict.name} seed={conflict.id} size={64} />
              <span className="text-xs text-fg-faint tabular">{conflict.name} · 出现 {conflict.face_count} 次</span>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={picking} onClose={() => setPicking(false)} title="选择头像" description="从此人的照片中选择一张。" className="max-w-2xl">
        <ul className="grid grid-cols-3 gap-1.5 px-6 pb-6 pt-2 sm:grid-cols-5">
          {images.slice(0, 60).map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await peopleApi.setCover(personId, f.id);
                    refresh();
                    setPicking(false);
                    toast('头像已更新');
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
                className="block w-full overflow-hidden rounded-lg outline-none ring-accent focus-visible:ring-2"
              >
                <Thumb file={f} width={120} scrub={false} showBadges={false} className="aspect-square w-full transition-transform hover:scale-[1.04]" />
              </button>
            </li>
          ))}
          {!images.length && (
            <li className="col-span-full flex flex-col items-center gap-2 py-8 text-fg-faint">
              <ImageIcon className="h-6 w-6" />
              <span className="text-[13px]">暂无照片</span>
            </li>
          )}
        </ul>
      </Dialog>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <PersonPage />
    </Suspense>
  );
}
