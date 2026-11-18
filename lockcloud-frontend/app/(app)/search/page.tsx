'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, History, Search as SearchIcon, X } from 'lucide-react';
import { EmptyState } from '@/components/brand/LuckyLocker';
import { PauseMark } from '@/components/brand/PauseMark';
import { Avatar } from '@/components/ui/Avatar';
import { Chip, Segmented } from '@/components/ui/Field';
import { FileGrid } from '@/components/media/FileGrid';
import { SelectionBar } from '@/components/media/SelectionBar';
import { FileViewerOverlay, useViewer } from '@/components/viewer/FileViewerOverlay';
import { ApiError } from '@/lib/api/client';
import { searchApi } from '@/lib/api/media';
import type { FileItem, SearchFilters, SearchResponse } from '@/lib/api/types';
import { ACTIVITY_TYPES, activityTypeLabel } from '@/lib/constants/activityTypes';
import { formatDate, formatTimecode } from '@/lib/format';
import { useQueryState } from '@/lib/hooks';
import { activityHref, personHref } from '@/lib/routes';
import { displayName } from '@/lib/urls';
import { useUi } from '@/stores/uiStore';
import { PoweredByLockAI } from '@/components/lockai/LockAI';

const EXAMPLES = ['舞台上的大合照', '比赛候场', '团建吃饭', '穿蓝色队服', '夜里的街头'];

function SearchPage() {
  const [params, set] = useQueryState();
  const viewer = useViewer();
  const recent = useUi((s) => s.recentSearches);
  const pushSearch = useUi((s) => s.pushSearch);
  const clearSearches = useUi((s) => s.clearSearches);
  const input = useRef<HTMLInputElement>(null);

  const q = params.get('q') ?? '';
  const type = params.get('type') ?? '';
  const media = (params.get('media') as '' | 'image' | 'video') ?? '';
  const tag = params.get('tag') ?? '';
  const person = params.get('person') ?? '';
  const year = params.get('year') ?? '';
  const [draft, setDraft] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setDraft(q);
  }

  const filters: SearchFilters = useMemo(
    () => ({
      activity_type: type || undefined,
      media_type: media || undefined,
      tags: tag ? [tag] : undefined,
      person_ids: person ? [Number(person)] : undefined,
      date_from: year ? `${year}-01-01` : undefined,
      date_to: year ? `${year}-12-31` : undefined,
    }),
    [type, media, tag, person, year],
  );
  const active = !!(q || type || tag || person || year);

  const result = useQuery({
    queryKey: ['search', q, filters],
    queryFn: ({ signal }) => searchApi.search(q, filters, 60, signal),
    enabled: active,
    staleTime: 5 * 60 * 1000,
    meta: { silent: true },
  });

  useEffect(() => {
    if (!q) input.current?.focus();
  }, [q]);

  const submit = (text: string) => {
    const clean = text.trim();
    if (clean) pushSearch(clean);
    set({ q: clean || null }, { push: true });
  };

  const photos = useMemo<FileItem[]>(() => result.data?.photos.map((p) => p.file) ?? [], [result.data]);
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(now - i));
  }, []);

  return (
    <div className="px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="relative mx-auto max-w-3xl"
      >
        <SearchIcon className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-fg-faint" />
        <input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="描述画面，或输入人物、标签、活动"
          aria-label="搜索"
          enterKeyHint="search"
          className="h-14 w-full rounded-2xl border border-line-strong bg-surface pl-13 pr-14 text-[16px] text-fg shadow-soft transition-[border-color,box-shadow] placeholder:text-fg-faint focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft"
        />
        {draft ? (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              set({ q: null });
              input.current?.focus();
            }}
            aria-label="清空"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-fg-faint hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </form>

      <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center gap-1.5">
        {ACTIVITY_TYPES.map((t) => (
          <Chip key={t.value} active={type === t.value} onClick={() => set({ type: type === t.value ? null : t.value })}>
            {t.label}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        {years.map((y) => (
          <Chip key={y} active={year === y} onClick={() => set({ year: year === y ? null : y })}>
            <span className="tabular">{y}</span>
          </Chip>
        ))}
        <Segmented<'' | 'image' | 'video'>
          size="sm"
          className="ml-auto"
          value={media}
          onChange={(v) => set({ media: v || null })}
          options={[
            { value: '', label: '全部' },
            { value: 'image', label: '照片' },
            { value: 'video', label: '视频' },
          ]}
        />
        {tag && <Chip active onRemove={() => set({ tag: null })}># {tag}</Chip>}
        {person && <Chip active onRemove={() => set({ person: null })}>人物 {result.data?.matches.people.find((p) => String(p.id) === person)?.name ?? ''}</Chip>}
      </div>

      <div className="mt-8">
        {!active ? (
          <div className="mx-auto max-w-3xl">
            {recent.length > 0 && (
              <section className="mb-8">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[11px] font-medium tracking-wide text-fg-faint">最近搜索</h2>
                  <button type="button" onClick={clearSearches} className="text-[11px] text-fg-faint hover:text-fg-soft">清除</button>
                </div>
                <ul className="flex flex-col">
                  {recent.map((r) => (
                    <li key={r}>
                      <button
                        type="button"
                        onClick={() => submit(r)}
                        className="-mx-2 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[14px] text-fg-soft hover:bg-surface-2 hover:text-fg"
                      >
                        <History className="h-4 w-4 text-fg-faint" />
                        {r}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h2 className="mb-2 text-[11px] font-medium tracking-wide text-fg-faint">搜索建议</h2>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => submit(e)}
                    className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-fg-soft transition-colors hover:border-line-strong hover:text-fg"
                  >
                    {e}
                  </button>
                ))}
              </div>
              <p className="mt-6 text-[13px] leading-relaxed text-fg-faint">
                用一句话描述画面，即可找到相关的照片和视频片段。
              </p>
              <PoweredByLockAI className="mt-2" />
            </section>
          </div>
        ) : result.isPending ? (
          <div className="flex flex-col items-center gap-3 py-20 text-fg">
            <PauseMark size={30} state="busy" />
            <p className="text-[13px] text-fg-faint">正在搜索…</p>
          </div>
        ) : result.isError ? (
          <EmptyState
            quiet
            title={result.error instanceof ApiError && result.error.code === 'SEARCH_001' ? '搜索暂不可用' : '搜索失败'}
            description={result.error instanceof Error ? result.error.message : undefined}
          />
        ) : result.data ? (
          <Results data={result.data} photos={photos} onOpen={(f, t) => viewer.open(f.id, t)} onPerson={(id) => set({ person: String(id) })} />
        ) : null}
      </div>

      <SelectionBar scope="search" files={photos} zipName={`搜索 ${q}`} />
      <FileViewerOverlay files={photos} />
    </div>
  );
}

function Results({
  data,
  photos,
  onOpen,
  onPerson,
}: {
  data: SearchResponse;
  photos: FileItem[];
  onOpen: (f: FileItem, t?: number) => void;
  onPerson: (id: number) => void;
}) {
  const { matches, segments } = data;
  const hasMatches = matches.people.length + matches.tags.length + matches.activities.length > 0;
  if (!hasMatches && !photos.length && !segments.length) {
    return <EmptyState quiet title="没有结果" description="请尝试其他描述，或减少筛选条件。" />;
  }
  return (
    <div className="flex flex-col gap-10">
      {hasMatches && (
        <section className="mx-auto w-full max-w-3xl">
          <h2 className="mb-3 text-[11px] font-medium tracking-wide text-fg-faint">你可能在找</h2>
          <div className="flex flex-wrap gap-2">
            {matches.people.map((p) => (
              <span key={`p${p.id}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pl-1 pr-1">
                <Link href={personHref(p.id)} className="flex items-center gap-2 pr-1.5 text-[13px] text-fg hover:underline">
                  <Avatar src={p.thumb_url} name={p.name} seed={p.id} size={24} />
                  {p.name}
                </Link>
                <button type="button" onClick={() => onPerson(p.id)} className="rounded-full px-2 py-0.5 text-[11.5px] text-accent-ink hover:bg-accent-soft">
                  仅看此人
                </button>
              </span>
            ))}
            {matches.tags.map((t) => (
              <Link key={`t${t.id}`} href={`/search?tag=${encodeURIComponent(t.name)}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] text-fg hover:border-line-strong">
                # {t.name}
                <span className="text-fg-faint tabular">{t.count}</span>
              </Link>
            ))}
            {matches.activities.map((a) => (
              <Link key={`a${a.activity_date}${a.activity_type}${a.activity_name}`} href={activityHref(a)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] text-fg hover:border-line-strong">
                <CalendarDays className="h-3.5 w-3.5 text-fg-faint" />
                {a.activity_name || activityTypeLabel(a.activity_type)}
                <span className="text-fg-faint">{formatDate(a.activity_date)}</span>
                <ArrowRight className="h-3 w-3 text-fg-faint" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {segments.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-baseline gap-2 text-fg">
            <span className="text-[15px] font-semibold">视频片段</span>
            <span className="text-xs text-fg-faint tabular">{segments.length}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {segments.map((s) => (
              <li key={`${s.file.id}-${s.start}`}>
                <button type="button" onClick={() => onOpen(s.file, s.at)} className="group block w-full text-left">
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.frame_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10.5px] text-white backdrop-blur-sm tabular">
                      {formatTimecode(s.start)}–{formatTimecode(s.end)}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[13px] text-fg">{displayName(s.file)}</p>
                  <p className="truncate text-[11.5px] text-fg-faint">
                    {s.file.activity_name || activityTypeLabel(s.file.activity_type)} · {formatDate(s.file.activity_date)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {photos.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-baseline gap-2 text-fg">
            <span className="text-[15px] font-semibold">照片</span>
            <span className="text-xs text-fg-faint tabular">{photos.length}</span>
          </h2>
          <FileGrid files={photos} scope="search" onOpen={(f) => onOpen(f)} />
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}
