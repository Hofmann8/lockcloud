'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, PencilLine, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PauseMark } from '@/components/brand/PauseMark';
import { LockAIMark } from '@/components/lockai/LockAI';
import { Chip } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';
import { TagInput } from '@/components/files/TagInput';
import { useRefreshLibrary } from '@/components/files/useFileActions';
import { filesApi } from '@/lib/api/files';
import { commentsApi, peopleApi } from '@/lib/api/media';
import { errorMessage } from '@/lib/api/client';
import type { Comment, FileItem, FilePeople, LockAIInfo } from '@/lib/api/types';
import { formatBytes, formatDate, formatDateTime, formatDuration, formatTakenAt, formatTimecode, relativeTime } from '@/lib/format';
import { activityHref, personHref } from '@/lib/routes';
import { displayName, isVideo } from '@/lib/urls';
import { useAuthStore } from '@/stores/authStore';

interface InfoPanelProps {
  file: FileItem;
  editable: boolean;
  people?: FilePeople;
  onHoverPerson: (id: number | null) => void;
  comments: Comment[];
  /** 视频：当前播放到哪（评论挂时间点用） */
  getTime?: () => number;
  onSeek?: (t: number) => void;
  onEdit: () => void;
  /** 视频的 LockAI 分析；图片不传 */
  lockai?: LockAIInfo | null;
  onAnalyze?: () => void;
}

function Section({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[11px] font-medium tracking-wide text-fg-faint">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-[13px]">
      <dt className="w-16 shrink-0 text-fg-faint">{label}</dt>
      <dd className="min-w-0 flex-1 text-fg-soft">{children}</dd>
    </div>
  );
}

export function InfoPanel({ file, editable, people, onHoverPerson, comments, getTime, onSeek, onEdit, lockai, onAnalyze }: InfoPanelProps) {
  const video = isVideo(file);
  let w = file.width ?? 0;
  let h = file.height ?? 0;
  if ((file.orientation ?? 1) >= 5) [w, h] = [h, w];

  return (
    <div className="pb-8">
      <div className="px-5 pb-4 pt-5">
        <button type="button" onClick={onEdit} className="group flex w-full items-start gap-2 text-left">
          <h2 className="min-w-0 flex-1 break-all text-[16px] font-semibold leading-snug text-fg">{displayName(file)}</h2>
          <PencilLine className="mt-1 h-3.5 w-3.5 shrink-0 text-fg-faint opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
        {file.activity_date && (
          <Link
            href={activityHref({ activity_date: file.activity_date, activity_type: file.activity_type ?? '', activity_name: file.activity_name ?? '' })}
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-accent-ink hover:underline"
          >
            {file.activity_name || file.activity_type_display}
            <span className="text-fg-faint">· {formatDate(file.activity_date)}</span>
          </Link>
        )}
        {!editable && <p className="mt-2 text-xs text-fg-faint">此文件由他人上传，更改需经上传者同意。</p>}
      </div>

      <Section title="信息">
        <dl>
          {file.taken_at && <Row label="拍摄">{formatTakenAt(file.taken_at)}</Row>}
          {w > 0 && h > 0 && (
            <Row label="尺寸">
              <span className="tabular">{w} × {h}</span>
            </Row>
          )}
          {video && file.duration ? (
            <Row label="时长">
              <span className="tabular">{formatDuration(file.duration)}</span>
            </Row>
          ) : null}
          <Row label="大小">
            <span className="tabular">{formatBytes(file.size)}</span>
          </Row>
          {file.uploader && (
            <Row label="上传">
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={file.uploader.name} src={file.uploader.avatar_url} seed={file.uploader.id} size={18} />
                {file.uploader.name}
                <span className="text-fg-faint" title={formatDateTime(file.uploaded_at)}>· {relativeTime(file.uploaded_at)}</span>
              </span>
            </Row>
          )}
          {file.original_filename && file.original_filename !== file.filename && (
            <Row label="原始文件名">
              <span className="break-all text-fg-faint">{file.original_filename}</span>
            </Row>
          )}
        </dl>
      </Section>

      {lockai !== undefined && <LockAISection info={lockai} onAnalyze={onAnalyze} onSeek={onSeek} />}

      <TagsSection file={file} />

      {video ? (
        <AppearancesSection fileId={file.id} onSeek={onSeek} />
      ) : (
        people && (people.people.length > 0 || people.unidentified_count > 0) && (
          <Section title="人物">
            <ul className="flex flex-col gap-0.5">
              {people.people.map((p) => (
                <li key={p.id}>
                  <Link
                    href={personHref(p.id)}
                    onMouseEnter={() => onHoverPerson(p.id)}
                    onMouseLeave={() => onHoverPerson(null)}
                    className="-mx-2 flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-2"
                  >
                    <Avatar src={p.thumb_url} name={p.name || '?'} seed={p.id} size={30} />
                    <span className={cn('flex-1 truncate text-[13px]', p.name ? 'text-fg' : 'text-fg-faint')}>{p.name || '未命名'}</span>
                    <span className="text-[11px] text-fg-faint tabular">{p.face_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {people.unidentified_count > 0 && (
              <p className="mt-2 text-xs text-fg-faint">另有 {people.unidentified_count} 张面孔未识别</p>
            )}
          </Section>
        )
      )}

      <CommentsSection fileId={file.id} comments={comments} getTime={getTime} onSeek={onSeek} />
    </div>
  );
}

function LockAISection({ info, onAnalyze, onSeek }: { info: LockAIInfo | null; onAnalyze?: () => void; onSeek?: (t: number) => void }) {
  const who = info?.requested_by;
  const title = <LockAIMark className="text-[13px] tracking-normal" />;
  if (!info || info.status === 'failed') {
    return (
      <Section title={title}>
        <p className="text-[13px] leading-relaxed text-fg-soft">
          {info ? '上次分析未完成。' : '分析后，所有人都能使用节拍器、分段、画面搜索和人物识别。'}
        </p>
        {onAnalyze && (
          <Button size="sm" variant="secondary" className="mt-3" onClick={onAnalyze}>
            {info ? '重新分析' : '分析此视频'}
          </Button>
        )}
      </Section>
    );
  }
  if (info.status !== 'ready') {
    return (
      <Section title={title}>
        <p className="flex items-center gap-2 text-[13px] text-fg-soft" role="status">
          <PauseMark size={12} framed={false} state="busy" />
          {info.status === 'queued' ? '排队中' : '正在分析'}
          {who && <span className="text-fg-faint">由 {who.name} 发起</span>}
        </p>
      </Section>
    );
  }
  const dances = new Set(info.chapters.filter((c) => c.kind === 'dance').map((c) => c.piece ?? c.start)).size;
  return (
    <Section title={title} aside={dances > 0 ? <span className="text-[11px] text-fg-faint tabular">{dances} 支舞</span> : undefined}>
      <ol className="-mx-2 flex flex-col">
        {info.chapters.map((c) => (
          <li key={c.start}>
            <button
              type="button"
              onClick={() => onSeek?.(c.start)}
              className="flex w-full items-baseline gap-2.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-2"
            >
              <span className="w-10 shrink-0 font-mono text-[11.5px] text-fg-faint tabular">{formatTimecode(c.start)}</span>
              <span className={cn('min-w-0 flex-1 truncate text-[13px]', c.kind === 'dance' ? 'text-fg' : 'text-fg-faint')}>
                {c.title || (c.kind === 'dance' ? '舞蹈' : '间歇')}
              </span>
              {c.piece && <span className="shrink-0 text-[11px] text-fg-faint">{c.piece}</span>}
            </button>
            {(c.songs ?? []).map((t, k) => (
              <button
                key={t}
                type="button"
                onClick={() => onSeek?.(t)}
                className="flex w-full items-baseline gap-2.5 rounded-lg px-2 py-0.5 text-left transition-colors hover:bg-surface-2"
              >
                <span className="w-10 shrink-0 font-mono text-[11.5px] text-fg-faint tabular">{formatTimecode(t)}</span>
                <span className="min-w-0 flex-1 truncate pl-3 text-[12.5px] text-fg-soft">第 {k + 2} 首</span>
              </button>
            ))}
          </li>
        ))}
      </ol>
      {who && <p className="mt-2.5 text-[11.5px] text-fg-faint">由 {who.name} 发起分析</p>}
    </Section>
  );
}

function TagsSection({ file }: { file: FileItem }) {
  const qc = useQueryClient();
  const refresh = useRefreshLibrary();
  const tags = file.free_tags ?? [];

  const update = (next: FileItem['free_tags']) =>
    qc.setQueryData<FileItem>(['file', file.id], (f) => (f ? { ...f, free_tags: next } : f));

  const add = async (name: string) => {
    if (tags.some((t) => t.name === name)) return;
    try {
      const tag = await filesApi.addTag(file.id, name);
      update([...tags, tag]);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const remove = async (id: number) => {
    const before = tags;
    update(tags.filter((t) => t.id !== id));
    try {
      await filesApi.removeTag(file.id, id);
      refresh();
    } catch (e) {
      update(before);
      toast.error(errorMessage(e));
    }
  };

  return (
    <Section title="标签">
      {tags.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Chip key={t.id} onRemove={() => remove(t.id)}>
              <Link href={`/search?tag=${encodeURIComponent(t.name)}`} className="hover:text-fg">{t.name}</Link>
            </Chip>
          ))}
        </div>
      )}
      <TagInput onAdd={add} exclude={tags.map((t) => t.name)} />
    </Section>
  );
}

function AppearancesSection({ fileId, onSeek }: { fileId: number; onSeek?: (t: number) => void }) {
  const q = useQuery({
    queryKey: ['appearances', fileId],
    queryFn: () => peopleApi.inVideo(fileId),
    meta: { silent: true },
  });
  const list = q.data?.people ?? [];
  if (!list.length) return null;
  return (
    <Section title="人物">
      <ul className="flex flex-col gap-2.5">
        {list.map((p) => (
          <li key={p.id} className="flex items-start gap-2.5">
            <Link href={personHref(p.id)} className="shrink-0">
              <Avatar src={p.thumb_url} name={p.name || '?'} seed={p.id} size={30} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={personHref(p.id)} className={cn('block truncate text-[13px] hover:underline', p.name ? 'text-fg' : 'text-fg-faint')}>
                {p.name || '未命名'}
              </Link>
              <div className="mt-1 flex flex-wrap gap-1">
                {p.segments.slice(0, 8).map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => onSeek?.(s.start)}
                    className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-soft transition-colors hover:bg-accent-soft hover:text-accent-ink tabular"
                  >
                    {formatTimecode(s.start)}
                  </button>
                ))}
                {p.segments.length > 8 && <span className="text-[11px] text-fg-faint">…</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function CommentsSection({
  fileId,
  comments,
  getTime,
  onSeek,
}: {
  fileId: number;
  comments: Comment[];
  getTime?: () => number;
  onSeek?: (t: number) => void;
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [body, setBody] = useState('');
  const [anchor, setAnchor] = useState(true);
  const [anchorTime, setAnchorTime] = useState<number | null>(null);

  const create = useMutation({
    mutationFn: () => commentsApi.create(fileId, body.trim(), getTime && anchor ? anchorTime ?? getTime() : null),
    onSuccess: (c) => {
      qc.setQueryData<Comment[]>(['comments', fileId], (list) =>
        [...(list ?? []), c].sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity) || a.created_at.localeCompare(b.created_at)),
      );
      setBody('');
      setAnchorTime(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => commentsApi.remove(id),
    onSuccess: (_r, id) => qc.setQueryData<Comment[]>(['comments', fileId], (list) => (list ?? []).filter((c) => c.id !== id)),
  });

  return (
    <Section title={comments.length ? `评论 ${comments.length}` : '评论'}>
      {comments.length > 0 && (
        <ul className="mb-3 flex flex-col gap-3.5">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-2.5">
              <Avatar src={c.user.avatar_url} name={c.user.name} seed={c.user.id} size={24} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-fg-faint">
                  <span className="font-medium text-fg-soft">{c.user.name}</span> · {relativeTime(c.created_at)}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-fg">
                  {c.t != null && (
                    <button
                      type="button"
                      onClick={() => onSeek?.(c.t!)}
                      className="mr-1.5 rounded-md bg-accent-soft px-1.5 py-px font-mono text-[11.5px] text-accent-ink tabular hover:brightness-95"
                    >
                      {formatTimecode(c.t)}
                    </button>
                  )}
                  {c.body}
                </p>
              </div>
              {c.can_delete && (
                <button
                  type="button"
                  onClick={() => remove.mutate(c.id)}
                  aria-label="删除评论"
                  className="h-7 w-7 shrink-0 rounded-lg text-fg-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-danger group-hover:opacity-100"
                >
                  <Trash2 className="mx-auto h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {user && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) create.mutate();
          }}
          className="rounded-2xl border border-line-strong bg-surface transition-colors focus-within:border-accent"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => getTime && anchorTime == null && setAnchorTime(getTime())}
            // 没写字就走开了，下次聚焦重新取当前时间
            onBlur={() => !body.trim() && setAnchorTime(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (body.trim()) create.mutate();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder="添加评论"
            className="block w-full resize-none bg-transparent px-3 pt-2.5 text-[13.5px] text-fg placeholder:text-fg-faint focus:outline-none"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            {getTime ? (
              <label className="flex cursor-pointer items-center gap-1.5 px-1 text-[12px] text-fg-faint">
                <input type="checkbox" checked={anchor} onChange={(e) => setAnchor(e.target.checked)} className="accent-[var(--accent)]" />
                标记于{' '}
                <span className={cn('text-fg-soft', anchorTime != null && 'font-mono tabular')}>
                  {anchorTime != null ? formatTimecode(anchorTime) : '当前时间'}
                </span>
              </label>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={!body.trim() || create.isPending}
              aria-label="发送"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-fg transition-opacity disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </Section>
  );
}
