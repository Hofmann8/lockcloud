'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from '@/components/ui/Toast';
import { useRefreshLibrary } from '@/components/files/useFileActions';
import { lockaiApi } from '@/lib/api/media';
import { errorMessage } from '@/lib/api/client';
import type { FileItem, MediaDetail } from '@/lib/api/types';

/** 字标：LockAI。和 LockCloud 同一写法："Lock" 柔软的斜衬线，后半截收一点 */
export function LockAIMark({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'stage' }) {
  return (
    <span
      className={cn('font-display leading-none tracking-[-0.02em]', tone === 'stage' ? 'text-stage-fg' : 'text-fg', className)}
      style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 72' }}
    >
      <span className="italic">Lock</span>
      <span
        className={cn('ml-[1px]', tone === 'stage' ? 'text-stage-accent' : 'text-accent-ink')}
        style={{ fontVariationSettings: '"SOFT" 0, "WONK" 0, "opsz" 72' }}
      >
        AI
      </span>
    </span>
  );
}

/** 智能功能下面的一行小字 */
export function PoweredByLockAI({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-center gap-1 text-[11.5px] text-fg-faint', className)}>
      由 <LockAIMark className="text-[12.5px]" /> 提供支持
    </p>
  );
}

function resetDate(iso: string) {
  // 后端给的是 UTC 时间（北京时间下个月 1 日 0 点）
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/** 发起 LockAI 分析的确认框：说清楚能得到什么、本月还剩几次 */
export function AnalyzeDialog({ file, open, onClose }: { file: Pick<FileItem, 'id'>; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const refresh = useRefreshLibrary();
  const quota = useQuery({ queryKey: ['lockai-quota'], queryFn: lockaiApi.quota, enabled: open, staleTime: 0 });
  const left = quota.data?.remaining;
  const exhausted = left === 0;
  const run = useMutation({
    mutationFn: () => lockaiApi.analyze(file.id),
    onSuccess: (res) => {
      qc.setQueryData(['lockai-quota'], res.quota);
      qc.setQueryData<MediaDetail>(['media', file.id], (m) => (m ? { ...m, lockai: res.lockai } : m));
      qc.setQueryData<FileItem>(['file', file.id], (f) => (f ? { ...f, lockai_status: res.lockai.status } : f));
      refresh();
      toast('已加入分析队列');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
    meta: { silent: true },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      hideClose
      title={
        <span className="flex items-baseline gap-1.5">
          用 <LockAIMark className="text-[17px]" /> 分析此视频
        </span>
      }
      description="完成后，所有人都能使用节拍器、分段、画面搜索和人物识别。"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={() => run.mutate()} loading={run.isPending} disabled={exhausted || quota.isPending} data-autofocus>
            开始分析
          </Button>
        </>
      }
    >
      <p className={cn('px-6 pt-2 text-[13px] tabular', exhausted ? 'text-danger' : 'text-fg-faint')}>
        {quota.data
          ? left == null
            ? null
            : exhausted
              ? `本月的分析次数已用完，${resetDate(quota.data.resets_at)}恢复。`
              : `本月还可以分析 ${left} 个视频。`
          : ' '}
      </p>
    </Dialog>
  );
}
