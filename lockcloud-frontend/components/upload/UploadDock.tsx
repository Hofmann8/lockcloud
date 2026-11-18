'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, RotateCw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PauseMark } from '@/components/brand/PauseMark';
import { LuckyLocker } from '@/components/brand/LuckyLocker';
import { formatBytes } from '@/lib/format';
import { activityHref } from '@/lib/routes';
import { isActive, useUploads, type UploadItem } from '@/stores/uploadStore';

/** 右下角的上传队列：切页面不中断；传完跳一个小人 */
export function UploadDock() {
  const qc = useQueryClient();
  const items = useUploads((s) => s.items);
  const retry = useUploads((s) => s.retry);
  const cancel = useUploads((s) => s.cancel);
  const clearFinished = useUploads((s) => s.clearFinished);
  const setOnDone = useUploads((s) => s.setOnDone);
  const [open, setOpen] = useState(false);
  const [doneKey, setDoneKey] = useState(0);

  useEffect(() => {
    setOnDone(() => {
      void qc.invalidateQueries({ queryKey: ['files'] });
      void qc.invalidateQueries({ queryKey: ['activities'] });
      void qc.invalidateQueries({ queryKey: ['activity'] });
      setDoneKey((k) => k + 1);
    });
    return () => setOnDone(null);
  }, [qc, setOnDone]);

  const summary = useMemo(() => {
    const total = items.reduce((s, i) => s + i.file.size, 0);
    const loaded = items.reduce((s, i) => s + (i.status === 'done' ? i.file.size : i.loaded), 0);
    return {
      busy: items.some(isActive),
      done: items.filter((i) => i.status === 'done').length,
      failed: items.filter((i) => i.status === 'failed').length,
      count: items.filter((i) => i.status !== 'canceled').length,
      pct: total ? loaded / total : 0,
      loaded,
      total,
    };
  }, [items]);

  // 还在传时关页面要提醒
  useEffect(() => {
    if (!summary.busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [summary.busy]);

  if (!items.length) return null;

  const last = items[items.length - 1];
  const finished = !summary.busy;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] md:bottom-5 md:right-5">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop animate-lock-in">
        <div className="flex items-center gap-3 px-3 py-2.5">
          {finished && summary.failed === 0 ? (
            <LuckyLocker key={doneKey} size={40} className="-my-1.5 -ml-1" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center text-fg">
              <PauseMark size={24} state={summary.busy ? 'busy' : 'idle'} clickKey={doneKey} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-fg">
              {summary.busy
                ? `正在上传 ${summary.done} / ${summary.count}`
                : summary.failed
                  ? `${summary.failed} 个文件上传失败`
                  : `已上传 ${summary.done} 个文件`}
            </p>
            <p className="truncate text-[11.5px] text-fg-faint tabular">
              {summary.busy
                ? `${formatBytes(summary.loaded)} / ${formatBytes(summary.total)}`
                : summary.failed
                  ? '展开查看详情'
                  : '上传完成'}
            </p>
          </div>
          {finished && summary.failed === 0 && last?.activity.activity_date && (
            <Link href={activityHref(last.activity)} className="shrink-0 rounded-lg px-2 py-1 text-[12.5px] font-medium text-accent-ink hover:bg-accent-soft">
              查看
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? '收起' : '展开'}
            className="rounded-lg p-1.5 text-fg-faint hover:bg-surface-2 hover:text-fg"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {finished && (
            <button type="button" onClick={clearFinished} aria-label="清除" className="rounded-lg p-1.5 text-fg-faint hover:bg-surface-2 hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {summary.busy && (
          <div className="h-[2px] bg-surface-2">
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${summary.pct * 100}%` }} />
          </div>
        )}
        {open && (
          <ul className="max-h-72 overflow-y-auto border-t border-line py-1 thin-scrollbar">
            {items.map((i) => (
              <UploadRow key={i.id} item={i} onRetry={() => retry(i.id)} onCancel={() => cancel(i.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function UploadRow({ item, onRetry, onCancel }: { item: UploadItem; onRetry: () => void; onCancel: () => void }) {
  const pct = item.status === 'done' ? 1 : item.file.size ? item.loaded / item.file.size : 0;
  return (
    <li className="group flex items-center gap-2.5 px-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[12.5px]', item.status === 'canceled' ? 'text-fg-faint line-through' : 'text-fg')}>
          {item.stem ?? item.file.name}
        </p>
        {item.status === 'failed' ? (
          <p className="truncate text-[11px] text-danger">{item.error}</p>
        ) : (
          <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn('h-full rounded-full transition-[width] duration-300', item.status === 'done' ? 'bg-ok' : 'bg-accent')}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        )}
      </div>
      <span className="w-12 shrink-0 text-right text-[11px] text-fg-faint tabular">
        {item.status === 'done' ? '完成' : item.status === 'confirming' ? '即将完成' : item.status === 'queued' ? '等待中' : item.status === 'uploading' ? `${Math.round(pct * 100)}%` : ''}
      </span>
      {item.status === 'failed' && (
        <button type="button" onClick={onRetry} aria-label="重试" className="rounded-md p-1 text-fg-soft hover:bg-surface-2">
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      )}
      {isActive(item) && (
        <button type="button" onClick={onCancel} aria-label="取消" className="rounded-md p-1 text-fg-faint opacity-0 hover:bg-surface-2 hover:text-fg group-hover:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
