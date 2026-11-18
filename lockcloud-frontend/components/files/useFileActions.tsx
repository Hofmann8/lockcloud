'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/Toast';
import { PauseMark } from '@/components/brand/PauseMark';
import { filesApi } from '@/lib/api/files';
import { requestsApi, trashApi } from '@/lib/api/media';
import { errorMessage } from '@/lib/api/client';
import type { FileItem } from '@/lib/api/types';
import { downloadOriginal, downloadZip } from '@/lib/download';
import { formatBytes } from '@/lib/format';
import { splitByPermission } from '@/lib/permissions';
import { useAuthStore } from '@/stores/authStore';

/** 所有列表类数据都失效，让网格、活动卡、侧栏一起刷新 */
export function useRefreshLibrary() {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['files'] });
    void qc.invalidateQueries({ queryKey: ['activities'] });
    void qc.invalidateQueries({ queryKey: ['activity'] });
    void qc.invalidateQueries({ queryKey: ['trash'] });
    void qc.invalidateQueries({ queryKey: ['person'] });
    void qc.invalidateQueries({ queryKey: ['search'] });
  }, [qc]);
}

export function useFileActions() {
  const user = useAuthStore((s) => s.user);
  const refresh = useRefreshLibrary();
  const qc = useQueryClient();

  /**
   * 移到回收站；自己的直接删，别人的发删除申请。结果自己提示，不往外抛错：
   * 有一部分没成也把成了的先刷新出来。返回真正移走的和发了申请的个数。
   */
  const trash = useCallback(
    async (files: FileItem[]) => {
      const { own, others } = splitByPermission(files, user);
      let moved: number[] = [];
      let error: unknown = null;
      try {
        if (own.length === 1) {
          await filesApi.remove(own[0].id);
          moved = [own[0].id];
        } else if (own.length > 1) {
          const ids = own.map((f) => f.id);
          moved = (await filesApi.batchDelete(ids)).results?.succeeded ?? ids;
        }
      } catch (e) {
        error = e;
      }
      let asked = 0;
      for (const f of others) {
        try {
          await requestsApi.create({ file_id: f.id, request_type: 'delete' });
          asked++;
        } catch (e) {
          error ??= e;
        }
      }
      refresh();
      for (const id of moved) qc.removeQueries({ queryKey: ['file', id] });
      const parts = [];
      if (moved.length) parts.push(`已将 ${moved.length} 个文件移到回收站`);
      if (asked) parts.push(`已为 ${asked} 个他人上传的文件发送删除申请`);
      const missed = files.length - moved.length - asked;
      if (missed) parts.push(`${missed} 个未能完成${error ? `：${errorMessage(error)}` : ''}`);
      if (moved.length) {
        const ids = moved;
        toast(parts.join('；'), {
          action: {
            label: '撤销',
            onClick: async () => {
              try {
                // 一次几个，别一下发几百个请求
                for (let i = 0; i < ids.length; i += 6) await Promise.all(ids.slice(i, i + 6).map((id) => trashApi.restore(id)));
                toast('已恢复');
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                refresh();
              }
            },
          },
          duration: 6000,
        });
      } else if (asked) {
        toast(parts.join('；'));
      } else if (parts.length) {
        toast.error(parts.join('；'));
      }
      return { moved: moved.length, asked };
    },
    [user, refresh, qc],
  );

  const download = useCallback(async (files: FileItem[], name: string) => {
    if (files.length === 1) {
      try {
        await downloadOriginal(files[0]);
      } catch (e) {
        toast.error(errorMessage(e));
      }
      return;
    }
    const total = files.reduce((s, f) => s + (f.size || 0), 0);
    const id = toast(
      <span className="flex items-center gap-2">
        <PauseMark size={14} framed={false} state="busy" />
        正在准备 {files.length} 个文件（{formatBytes(total)}）
      </span>,
      { duration: 10 * 60 * 1000, key: 'zip' },
    );
    try {
      const job = await downloadZip(files, name);
      if (job.status === 'ready') toast.ok('下载已开始', { key: 'zip' });
      else toast.error(job.error || '打包失败', { key: 'zip' });
    } catch (e) {
      toast.error(errorMessage(e), { key: 'zip' });
    }
    return id;
  }, []);

  return { trash, download };
}
