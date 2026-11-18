'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState } from '@/components/brand/LuckyLocker';
import { PauseMark } from '@/components/brand/PauseMark';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { Thumb } from '@/components/media/Thumb';
import { adminApi } from '@/lib/api/media';
import type { AdminStats } from '@/lib/api/types';
import { formatBytes, relativeTime } from '@/lib/format';
import { fileHref } from '@/lib/routes';
import { displayName } from '@/lib/urls';
import { useIsAdmin } from '@/stores/authStore';

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <p className="text-[12px] text-fg-faint">{label}</p>
      <p className="mt-1 font-display text-[28px] leading-none tracking-tight text-fg tabular" style={{ fontVariationSettings: '"opsz" 72' }}>
        {value}
      </p>
      {note && <p className="mt-1.5 text-[11.5px] text-fg-faint">{note}</p>}
    </div>
  );
}

function Growth({ data }: { data: AdminStats['growth'] }) {
  const max = Math.max(1, ...data.map((d) => d.bytes));
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 pb-3 pt-3.5">
      <p className="text-[12px] text-fg-faint">每月新增</p>
      <div className="mt-3 flex h-32 items-end gap-[3px]">
        {data.map((d) => (
          <div key={d.month} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[3px] bg-accent/70 transition-colors group-hover:bg-accent"
              style={{ height: `${Math.max(2, (d.bytes / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[11px] text-ink-fg group-hover:block tabular">
              {d.month} · {d.files} 个 · {formatBytes(d.bytes)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-fg-faint">
        <span>{data[0]?.month}</span>
        <span>{data[data.length - 1]?.month}</span>
      </div>
    </div>
  );
}

function Pipeline({ stats }: { stats: AdminStats }) {
  const rows: Array<{ label: string; done: number; pending: number; failed: number }> = [
    { label: '视频与图片处理', done: stats.pipeline.media.ready, pending: stats.pipeline.media.pending, failed: stats.pipeline.media.failed },
    { label: '搜索索引', ...stats.pipeline.embedding },
    { label: '人物识别', ...stats.pipeline.faces },
  ];
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <p className="text-[12px] text-fg-faint">处理进度</p>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((r) => {
          const total = Math.max(1, r.done + r.pending + r.failed);
          return (
            <li key={r.label}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-fg-soft">{r.label}</span>
                <span className="text-[11.5px] text-fg-faint tabular">
                  已完成 {r.done}{r.pending ? ` · 等待中 ${r.pending}` : ''}
                  {r.failed ? <span className="text-danger"> · 失败 {r.failed}</span> : null}
                </span>
              </div>
              <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="bg-ok" style={{ width: `${(r.done / total) * 100}%` }} />
                <div className="bg-warn" style={{ width: `${(r.pending / total) * 100}%` }} />
                <div className="bg-danger" style={{ width: `${(r.failed / total) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11.5px] text-fg-faint tabular">
        识别出 {stats.pipeline.persons} 位人物，已命名 {stats.pipeline.named_persons} 位
      </p>
    </div>
  );
}

export default function AdminPage() {
  const isAdmin = useIsAdmin();
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats, enabled: isAdmin });
  const failures = useQuery({ queryKey: ['admin', 'failures'], queryFn: adminApi.failures, enabled: isAdmin });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: adminApi.allUsers, enabled: isAdmin });
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const reprocess = useMutation({
    mutationFn: (ids: number[]) => adminApi.reprocess(ids),
    onSuccess: (r) => {
      toast(`已重新提交 ${r.queued.length} 个文件${r.skipped.length ? `，跳过 ${r.skipped.length} 个` : ''}`);
      setPicked(new Set());
      void failures.refetch();
    },
  });

  if (!isAdmin) return <EmptyState quiet title="仅限管理员访问" />;

  const s = stats.data;
  return (
    <>
      <PageHeader title="管理" />
      <div className="flex flex-col gap-8 px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        {!s ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="已用空间" value={formatBytes(s.storage.bytes)} note={`${s.storage.files.toLocaleString()} 个文件`} />
              <Stat label="照片" value={s.storage.images.toLocaleString()} />
              <Stat label="视频" value={s.storage.videos.toLocaleString()} note={s.storage.others ? `另有 ${s.storage.others} 个其他文件` : undefined} />
              <Stat label="成员" value={String(s.users.total)} note={`近 30 天活跃 ${s.users.active_30d} 人`} />
            </div>
            <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
              <Growth data={s.growth} />
              <Pipeline stats={s} />
            </div>
            <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
              <p className="text-[12px] text-fg-faint">活动类型</p>
              <ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {s.by_type.map((t) => {
                  const max = Math.max(1, ...s.by_type.map((x) => x.files));
                  return (
                    <li key={t.activity_type} className="text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-fg-soft">{t.display}</span>
                        <span className="text-[11.5px] text-fg-faint tabular">{t.activities} 个活动 · {t.files} 个文件</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-fg-faint/60" style={{ width: `${(t.files / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-fg">处理失败的文件</h2>
            {(failures.data?.length ?? 0) > 0 && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(failures.data!.map((f) => f.file.id)))}>全选</Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!picked.size}
                  loading={reprocess.isPending}
                  icon={<RotateCw className="h-3.5 w-3.5" />}
                  onClick={() => reprocess.mutate([...picked])}
                >
                  重新处理{picked.size ? ` ${picked.size} 个` : ''}
                </Button>
              </div>
            )}
          </div>
          {failures.isPending ? (
            <div className="flex justify-center py-8"><PauseMark size={24} state="busy" /></div>
          ) : !failures.data?.length ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-faint">所有文件均已处理</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {failures.data.map((f) => (
                <li key={f.file.id} className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={picked.has(f.file.id)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(f.file.id);
                      else next.delete(f.file.id);
                      setPicked(next);
                    }}
                    className="accent-[var(--accent)]"
                    aria-label="选择"
                  />
                  <Thumb file={f.file} width={64} scrub={false} showBadges={false} className="h-11 w-11 shrink-0 rounded-lg" />
                  <a href={fileHref(f.file.id)} className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-fg hover:underline">{displayName(f.file)}</p>
                    <p className="truncate text-[11.5px] text-danger">
                      {f.error || Object.entries(f.errors).map(([k, v]) => `${k}: ${v}`).join('；')}
                    </p>
                  </a>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px]', f.status === 'failed' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-fg-faint')}>
                    {f.status === 'failed' ? '失败' : '部分失败'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-fg">成员</h2>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(users.data ?? []).map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5">
                <Avatar src={u.avatar_url} name={u.name} seed={u.id} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-fg">
                    {u.name}
                    {u.is_admin && <span className="ml-1.5 rounded bg-accent-soft px-1 py-px text-[10.5px] text-accent-ink">管理员</span>}
                  </p>
                  <p className="truncate text-[11.5px] text-fg-faint">{u.email}</p>
                </div>
                <span className="shrink-0 text-[11px] text-fg-faint">{u.last_login ? relativeTime(u.last_login) : '从未登录'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
