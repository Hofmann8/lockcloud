'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { filesApi } from '@/lib/api/files';
import { errorMessage } from '@/lib/api/client';
import type { ActivityKey } from '@/lib/api/types';
import { fetchFormats, isUploadable } from '@/lib/formats';
import { useUploads } from '@/stores/uploadStore';

export { extOf } from '@/lib/formats';

export interface PendingFile {
  file: File;
  /** 改过的文件名（不含扩展名）；没改是 null */
  stem?: string | null;
}

const stemOf = (p: PendingFile) => p.stem?.trim() || null;
const finalName = (p: PendingFile) => {
  const stem = stemOf(p);
  return stem ? `${stem}${p.file.name.slice(p.file.name.lastIndexOf('.'))}` : p.file.name;
};

/**
 * 加进上传队列。这一批里自己重名的（不同文件夹里各有一个 IMG_0001.jpg）从第二个起加 (2)、(3)，
 * 不然后面的会因为重名传不上去。
 */
function queueItems(files: PendingFile[], autoRename: boolean) {
  const seen = new Map<string, number>();
  return files.map((f) => {
    const name = finalName(f);
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    if (n === 1) return { file: f.file, stem: stemOf(f), autoRename };
    const dot = name.lastIndexOf('.');
    return { file: f.file, stem: `${dot > 0 ? name.slice(0, dot) : name} (${n})`, autoRename: true };
  });
}

/**
 * 开始上传前的检查：挑掉不支持的类型，查一下活动里有没有重名，有就问一次"跳过还是都留"。
 * 返回 start 和要渲染的确认框。start 等人选完才有结果：true 是加进队列了，false 是没传（取消、出错、没有新文件）。
 */
export function useStartUpload() {
  const qc = useQueryClient();
  const add = useUploads((s) => s.add);
  const [conflict, setConflict] = useState<{
    files: PendingFile[];
    existing: Set<string>;
    activity: ActivityKey;
    done: (queued: boolean) => void;
  } | null>(null);

  const start = useCallback(
    async (files: PendingFile[], activity: ActivityKey) => {
      const formats = await fetchFormats(qc);
      const ok = files.filter((f) => isUploadable(formats, f.file.name));
      const bad = files.length - ok.length;
      if (bad) toast.error(`${bad} 个文件的格式不受支持，已跳过`);
      if (!ok.length) return false;
      try {
        const names = ok.map(finalName);
        const existing: string[] = [];
        for (let i = 0; i < names.length; i += 100) {
          const res = await filesApi.checkFilenames({
            filenames: names.slice(i, i + 100),
            activity_date: activity.activity_date,
            activity_type: activity.activity_type,
            activity_name: activity.activity_name,
          });
          existing.push(...res.existing_files);
        }
        if (existing.length) {
          return await new Promise<boolean>((done) => setConflict({ files: ok, existing: new Set(existing), activity, done }));
        }
      } catch (e) {
        toast.error(errorMessage(e));
        return false;
      }
      add(queueItems(ok, false), activity);
      return true;
    },
    [add, qc],
  );

  const resolve = (mode: 'skip' | 'keep' | 'cancel') => {
    if (!conflict) return;
    const list =
      mode === 'cancel' ? [] : mode === 'skip' ? conflict.files.filter((f) => !conflict.existing.has(finalName(f))) : conflict.files;
    if (list.length) add(queueItems(list, mode === 'keep'), conflict.activity);
    else if (mode !== 'cancel') toast('这些文件都已上传过');
    conflict.done(list.length > 0);
    setConflict(null);
  };

  const dialog = (
    <Dialog
      open={!!conflict}
      onClose={() => resolve('cancel')}
      title={`此活动中已有 ${conflict?.existing.size ?? 0} 个同名文件`}
      description="可以跳过这些文件，或全部上传并自动重命名。"
      footer={
        <>
          <Button variant="ghost" onClick={() => resolve('cancel')}>取消</Button>
          <Button onClick={() => resolve('keep')}>全部上传</Button>
          <Button variant="primary" onClick={() => resolve('skip')} data-autofocus>跳过同名文件</Button>
        </>
      }
    >
      <ul className="mx-6 mb-2 mt-2 max-h-48 overflow-y-auto rounded-xl bg-surface-2 px-3 py-2 font-mono text-[12px] text-fg-soft thin-scrollbar">
        {[...(conflict?.existing ?? [])].map((n) => (
          <li key={n} className="truncate py-0.5">{n}</li>
        ))}
      </ul>
    </Dialog>
  );

  return { start, dialog };
}
