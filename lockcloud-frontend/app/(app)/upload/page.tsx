'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpFromLine, FileIcon, FolderUp, ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { LuckyLocker } from '@/components/brand/LuckyLocker';
import { ActivityFields, type ActivityValue } from '@/components/files/ActivityFields';
import { useStartUpload, type PendingFile } from '@/components/upload/useStartUpload';
import { extOf, isUploadable, useFormats } from '@/lib/formats';
import { activityTypeLabel } from '@/lib/constants/activityTypes';
import { filesFromDrop } from '@/lib/dropFiles';
import { formatBytes } from '@/lib/format';
import { useQueryState } from '@/lib/hooks';

interface Picked extends PendingFile {
  id: string;
  preview: string | null;
}

let pickSeq = 0;
const IMAGE_PREVIEW = /\.(jpe?g|png|gif|webp|bmp)$/i;
const MAX_PREVIEWS = 240;

/** 从文件的修改时间猜活动日期：取出现最多的那一天 */
function guessDate(files: File[]): string | null {
  const count = new Map<string, number>();
  for (const f of files) {
    if (!f.lastModified) continue;
    const d = new Date(f.lastModified);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of count) if (v > n) [best, n] = [k, v];
  return best;
}

function UploadPage() {
  const [params] = useQueryState();
  const { start, dialog } = useStartUpload();
  const formats = useFormats();
  const [activity, setActivity] = useState<ActivityValue>({
    activity_date: params.get('date') ?? '',
    activity_type: params.get('type') ?? '',
    activity_name: params.get('name') ?? '',
  });
  const [guessed, setGuessed] = useState(false);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);

  // 离开页面时释放预览
  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);
  useEffect(() => () => pickedRef.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), []);

  const addFiles = (list: File[]) => {
    const fresh = list
      .filter((f) => !f.name.startsWith('.'))
      .map((file, i) => ({
        id: `p${++pickSeq}`,
        file,
        stem: null,
        preview: IMAGE_PREVIEW.test(file.name) && picked.length + i < MAX_PREVIEWS ? URL.createObjectURL(file) : null,
      }));
    const bad = fresh.filter((f) => !isUploadable(formats, f.file.name));
    if (bad.length) toast.error(`${bad.length} 个文件的格式不受支持，已跳过`);
    const good = fresh.filter((f) => isUploadable(formats, f.file.name));
    setPicked((p) => [...p, ...good]);
    if (!activity.activity_date && good.length) {
      const d = guessDate(good.map((g) => g.file));
      if (d) {
        setActivity((a) => ({ ...a, activity_date: d }));
        setGuessed(true);
      }
    }
  };

  const remove = (id: string) =>
    setPicked((p) => {
      const hit = p.find((x) => x.id === id);
      if (hit?.preview) URL.revokeObjectURL(hit.preview);
      return p.filter((x) => x.id !== id);
    });

  const total = useMemo(() => picked.reduce((s, p) => s + p.file.size, 0), [picked]);
  const ready = picked.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(activity.activity_date) && !!activity.activity_type;
  const target = activity.activity_name || (activity.activity_type ? activityTypeLabel(activity.activity_type) : '');

  const submit = async () => {
    setBusy(true);
    const ok = await start(picked, activity);
    setBusy(false);
    if (ok) {
      picked.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      setPicked([]);
      toast('已开始上传，完成后会通知你');
    }
  };

  return (
    <>
      <PageHeader title="上传" />
      <div
        className="grid gap-8 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void filesFromDrop(e.dataTransfer).then(addFiles);
        }}
      >
        <section className="min-w-0">
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
          <input
            ref={dirInput}
            type="file"
            multiple
            hidden
            {...({ webkitdirectory: '' } as Record<string, string>)}
            onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }}
          />

          {picked.length === 0 ? (
            <div
              className={cn(
                'flex min-h-[46vh] flex-col items-center justify-center rounded-[28px] border-2 border-dashed px-6 py-12 text-center transition-colors',
                over ? 'border-accent bg-accent-soft/40' : 'border-line-strong bg-surface',
              )}
            >
              <LuckyLocker size={104} />
              <p className="mt-4 text-[16px] font-medium text-fg">将照片和视频拖到这里</p>
              <p className="mt-1.5 text-[13px] text-fg-faint">也可以拖入整个文件夹。</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button variant="primary" icon={<ImagePlus className="h-4 w-4" />} onClick={() => fileInput.current?.click()}>选择文件</Button>
                <Button icon={<FolderUp className="h-4 w-4" />} onClick={() => dirInput.current?.click()} className="hidden sm:inline-flex">选择文件夹</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] text-fg-soft tabular">
                  {picked.length} 个文件 · {formatBytes(total)}
                </p>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" icon={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => fileInput.current?.click()}>添加</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      picked.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
                      setPicked([]);
                    }}
                  >
                    全部移除
                  </Button>
                </div>
              </div>
              <ul
                className={cn(
                  'grid grid-cols-3 gap-2 rounded-2xl transition-colors sm:grid-cols-4 xl:grid-cols-6',
                  over && 'bg-accent-soft/40 outline-2 outline-dashed outline-accent',
                )}
              >
                {picked.map((p) => (
                  <li key={p.id} className="group relative">
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-frame">
                      {p.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.preview} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-1 text-fg-faint">
                          <FileIcon className="h-6 w-6" strokeWidth={1.5} />
                          <span className="font-mono text-[10px] uppercase">{extOf(p.file.name)}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        aria-label="移除"
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      value={p.stem ?? p.file.name.replace(/\.[^.]+$/, '')}
                      onChange={(e) => setPicked((list) => list.map((x) => (x.id === p.id ? { ...x, stem: e.target.value } : x)))}
                      onBlur={(e) => {
                        // 改完再收拾：清空了或者和原名一样，就算没改
                        const v = e.target.value.trim();
                        const same = !v || v === p.file.name.replace(/\.[^.]+$/, '');
                        setPicked((list) => list.map((x) => (x.id === p.id ? { ...x, stem: same ? null : v } : x)));
                      }}
                      aria-label="文件名"
                      className="mt-1 w-full truncate rounded-md bg-transparent px-1 py-0.5 text-[11.5px] text-fg-soft hover:bg-surface-2 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="mb-4 text-[15px] font-semibold text-fg">上传到</h2>
            <ActivityFields
              value={activity}
              onChange={(v) => {
                setActivity(v);
                if (v.activity_date !== activity.activity_date) setGuessed(false);
              }}
            />
            {guessed && <p className="mt-2 text-xs text-fg-faint">已根据文件时间填写日期，请确认。</p>}
          </div>
        </aside>
      </div>

      {picked.length > 0 && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-30 border-t border-line bg-bg/92 backdrop-blur-xl md:bottom-0">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="min-w-0 flex-1 truncate text-[13px] text-fg-soft">
              {ready ? (
                <>
                  将 <span className="font-medium text-fg tabular">{picked.length}</span> 个文件上传到
                  <span className="font-medium text-fg">「{target}」</span>
                  <span className="text-fg-faint tabular"> · {activity.activity_date}</span>
                </>
              ) : (
                '请选择活动日期和类型'
              )}
            </p>
            <Button variant="primary" size="lg" disabled={!ready} loading={busy} onClick={submit} icon={<ArrowUpFromLine className="h-4 w-4" />}>
              开始上传
            </Button>
          </div>
        </div>
      )}
      {dialog}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <UploadPage />
    </Suspense>
  );
}
