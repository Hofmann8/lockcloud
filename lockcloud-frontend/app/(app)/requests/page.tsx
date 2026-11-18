'use client';

import { Suspense, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState } from '@/components/brand/LuckyLocker';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';
import { useRefreshLibrary } from '@/components/files/useFileActions';
import { requestsApi } from '@/lib/api/media';
import type { FileRequest, ProposedChanges } from '@/lib/api/types';
import { activityTypeLabel } from '@/lib/constants/activityTypes';
import { formatDate, relativeTime } from '@/lib/format';
import { useQueryState } from '@/lib/hooks';
import { activityHref, beatsHref, fileHref } from '@/lib/routes';

const FIELD_LABEL: Record<string, string> = {
  filename: '文件名',
  activity_date: '日期',
  activity_type: '类型',
  activity_name: '活动名称',
  new_activity_name: '活动名称',
  new_activity_type: '类型',
  free_tags: '标签',
};

function valueText(key: string, v: unknown): string {
  if (v == null || v === '') return '无';
  if (key.endsWith('activity_type')) return activityTypeLabel(String(v));
  if (key === 'activity_date') return formatDate(String(v));
  if (Array.isArray(v)) return v.join('、') || '无';
  return String(v);
}

function Changes({ req }: { req: FileRequest }) {
  const changes = (req.proposed_changes ?? {}) as ProposedChanges & Record<string, unknown>;
  if (req.request_type === 'beats') {
    const n = changes.ones?.length ?? 0;
    return (
      <div className="mt-2.5 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
        <span className="text-fg-soft">{n ? `${n} 处改动` : '恢复成原来的数法'}</span>
        {req.file && (
          <Link href={beatsHref(req.file.id, req.id)} className="font-medium text-accent-ink hover:underline">查看</Link>
        )}
      </div>
    );
  }
  // 同意之后文件上已经是新值了，拿不到改之前的样子，就只显示改成了什么
  const before: Record<string, unknown> =
    req.status === 'approved'
      ? {}
      : req.request_type === 'directory_edit'
        ? { new_activity_name: req.directory_info?.activity_name, new_activity_type: req.directory_info?.activity_type }
        : { ...(req.file ?? {}) };
  const rows = Object.entries(changes).filter(([k]) => FIELD_LABEL[k]);
  if (!rows.length) return null;
  return (
    <dl className="mt-2.5 flex flex-col gap-1.5 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap items-center gap-x-2">
          <dt className="w-14 shrink-0 text-fg-faint">{FIELD_LABEL[k]}</dt>
          <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-fg-soft">
            {k in before && <span className="text-fg-faint line-through decoration-fg-faint/50">{valueText(k, before[k])}</span>}
            {k in before && <ArrowRight className="h-3 w-3 text-fg-faint" />}
            <span className="font-medium text-fg">{valueText(k, v)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Title({ req, mine }: { req: FileRequest; mine: boolean }) {
  const who = mine ? '你' : req.requester?.name ?? '成员';
  let what: ReactNode;
  if (req.request_type === 'directory_edit' && req.directory_info) {
    what = (
      <>
        编辑活动
        <Link href={activityHref(req.directory_info)} className="mx-1 font-medium text-fg hover:underline">
          {req.directory_info.activity_name || activityTypeLabel(req.directory_info.activity_type)}
        </Link>
        <span className="text-fg-faint">（{formatDate(req.directory_info.activity_date)}）</span>
      </>
    );
  } else {
    const name = req.file ? (
      <Link href={fileHref(req.file.id)} className="mx-1 font-medium text-fg hover:underline">{req.file.filename}</Link>
    ) : (
      <span className="mx-1 text-fg-faint">已删除的文件</span>
    );
    what = req.request_type === 'delete' ? <>删除{name}</> : req.request_type === 'beats' ? <>修改{name}的八拍</> : <>编辑{name}</>;
  }
  return (
    <p className="text-[14px] leading-relaxed text-fg-soft">
      <span className="font-medium text-fg">{who}</span> 申请{what}
    </p>
  );
}

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'bg-accent-soft text-accent-ink' },
  approved: { label: '已同意', className: 'bg-ok-soft text-ok' },
  rejected: { label: '已拒绝', className: 'bg-surface-2 text-fg-faint' },
};

function RequestCard({ req, mine }: { req: FileRequest; mine: boolean }) {
  const qc = useQueryClient();
  const refresh = useRefreshLibrary();
  const [reply, setReply] = useState('');
  const [open, setOpen] = useState(false);
  const act = useMutation({
    mutationFn: (approve: boolean) => (approve ? requestsApi.approve(req.id, reply || undefined) : requestsApi.reject(req.id, reply || undefined)),
    onSuccess: (_r, approve) => {
      void qc.invalidateQueries({ queryKey: ['requests'] });
      if (approve && req.request_type === 'beats' && req.file_id) void qc.invalidateQueries({ queryKey: ['beats', req.file_id] });
      if (approve) refresh();
      toast(approve ? '已同意，更改已生效' : '已拒绝');
    },
  });
  const status = STATUS[req.status];

  return (
    <li className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Title req={req} mine={mine} />
          <Changes req={req} />
          {req.message && <p className="mt-2 text-[13px] text-fg-soft">“{req.message}”</p>}
          {req.response_message && (
            <p className="mt-2 text-[13px] text-fg-faint">
              {mine ? `${req.owner?.name ?? '对方'}回复：` : '你回复：'}
              {req.response_message}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn('rounded-full px-2 py-0.5 text-[11.5px]', status?.className)}>{status?.label}</span>
          <span className="text-[11.5px] text-fg-faint">{relativeTime(req.created_at)}</span>
        </div>
      </div>
      {!mine && req.status === 'pending' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {open ? (
            <input
              autoFocus
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="回复（可选）"
              maxLength={500}
              className="h-8 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-[13px] text-fg focus:border-accent focus:outline-none"
            />
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="mr-auto text-[12.5px] text-fg-faint hover:text-fg-soft">
              回复
            </button>
          )}
          <Button size="sm" variant="ghost" onClick={() => act.mutate(false)} disabled={act.isPending}>拒绝</Button>
          <Button size="sm" variant="primary" onClick={() => act.mutate(true)} loading={act.isPending && act.variables}>同意</Button>
        </div>
      )}
    </li>
  );
}

function RequestsPage() {
  const [params, set] = useQueryState();
  const box = params.get('box') === 'sent' ? 'sent' : 'received';
  const status = params.get('status') === 'all' ? '' : 'pending';
  const query = useQuery({
    queryKey: ['requests', box, status],
    queryFn: () => (box === 'sent' ? requestsApi.sent(status || undefined) : requestsApi.received(status || undefined)),
  });

  return (
    <>
      <PageHeader
        title="申请"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<'received' | 'sent'>
              value={box}
              onChange={(v) => set({ box: v === 'received' ? null : v })}
              options={[
                { value: 'received', label: '收到的' },
                { value: 'sent', label: '已发出' },
              ]}
            />
            <Segmented<'pending' | 'all'>
              size="sm"
              value={status ? 'pending' : 'all'}
              onChange={(v) => set({ status: v === 'pending' ? null : v })}
              options={[
                { value: 'pending', label: '待处理' },
                { value: 'all', label: '全部' },
              ]}
            />
          </div>
        }
      />
      <div className="px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        {query.isPending ? (
          <div className="flex max-w-3xl flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        ) : query.data?.length ? (
          <ul className="flex max-w-3xl flex-col gap-3">
            {query.data.map((r) => <RequestCard key={r.id} req={r} mine={box === 'sent'} />)}
          </ul>
        ) : (
          <EmptyState
            title={box === 'sent' ? '没有已发出的申请' : status ? '没有待处理的申请' : '没有申请'}
            description={box === 'received' && status ? '其他成员申请编辑或删除你的内容时，会显示在这里。' : undefined}
          />
        )}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <RequestsPage />
    </Suspense>
  );
}
