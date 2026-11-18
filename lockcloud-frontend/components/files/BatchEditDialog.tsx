'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';
import { Thumb } from '@/components/media/Thumb';
import { filesApi, type FileUpdate } from '@/lib/api/files';
import { requestsApi } from '@/lib/api/media';
import { errorMessage } from '@/lib/api/client';
import type { FileItem } from '@/lib/api/types';
import { splitByPermission } from '@/lib/permissions';
import { isAudio, isImage, isVideo } from '@/lib/urls';
import { useAuthStore } from '@/stores/authStore';
import { ActivityFields, type ActivityMixed, type ActivityValue } from './ActivityFields';
import { useRefreshLibrary } from './useFileActions';

interface BatchEditDialogProps {
  open: boolean;
  onClose: () => void;
  files: FileItem[];
  onDone?: () => void;
}

/** 批量改活动信息。自己传的直接改，别人传的发修改申请 */
export function BatchEditDialog({ open, ...rest }: BatchEditDialogProps) {
  // 每次打开按当前选中的文件重新取初值
  return open ? <BatchEditForm {...rest} /> : null;
}

/** 所有文件这一项都一样就返回那个值，不一样返回 null */
function common(files: FileItem[], pick: (f: FileItem) => string | null | undefined): string | null {
  const first = pick(files[0]) ?? '';
  return files.every((f) => (pick(f) ?? '') === first) ? first : null;
}

function BatchEditForm({ onClose, files, onDone }: Omit<BatchEditDialogProps, 'open'>) {
  const user = useAuthStore((s) => s.user);
  const refresh = useRefreshLibrary();
  const [initial] = useState(() => ({
    activity_date: common(files, (f) => f.activity_date),
    activity_type: common(files, (f) => f.activity_type),
    activity_name: common(files, (f) => f.activity_name),
  }));
  const mixed: ActivityMixed = {
    date: initial.activity_date === null,
    type: initial.activity_type === null,
    name: initial.activity_name === null,
  };
  const [value, setValue] = useState<ActivityValue>({
    activity_date: initial.activity_date ?? '',
    activity_type: initial.activity_type ?? '',
    activity_name: initial.activity_name ?? '',
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { own, others } = splitByPermission(files, user);

  // 只交改过的项：原来一致的和原值比，原来不一致的填了才算
  const updates: FileUpdate = {};
  if (value.activity_date && value.activity_date !== initial.activity_date) updates.activity_date = value.activity_date;
  if (value.activity_type && value.activity_type !== initial.activity_type) updates.activity_type = value.activity_type;
  const name = value.activity_name.trim();
  if (name && name !== initial.activity_name) updates.activity_name = name;
  const empty = Object.keys(updates).length === 0;

  const submit = async () => {
    setBusy(true);
    // 自己的和别人的分开算：一边没成不耽误另一边，成了的先刷新出来
    const notes: string[] = [];
    let done = 0;
    try {
      if (own.length) {
        try {
          const res = await filesApi.batchUpdate(own.map((f) => f.id), updates);
          const ok = res.results?.succeeded.length ?? own.length;
          const failed = res.results?.failed ?? [];
          done += ok;
          if (ok) notes.push(`已更新 ${ok} 个文件`);
          if (failed.length) notes.push(`${failed.length} 个未能更新：${failed[0].error}`);
        } catch (e) {
          notes.push(`${own.length} 个未能更新：${errorMessage(e)}`);
        }
      }
      if (others.length) {
        try {
          const res = await requestsApi.batch(others.map((f) => f.id), updates, message.trim() || undefined);
          const ok = res.results?.succeeded.length ?? others.length;
          const failed = res.results?.failed ?? [];
          done += ok;
          if (ok) notes.push(`已为 ${ok} 个文件发送申请`);
          if (failed.length) notes.push(`${failed.length} 个申请发送失败：${failed[0].error}`);
        } catch (e) {
          notes.push(`${others.length} 个申请发送失败：${errorMessage(e)}`);
        }
      }
      refresh();
      if (done) {
        toast(notes.join('；'));
        onDone?.();
        onClose();
      } else {
        toast.error(notes.join('；'));
      }
    } finally {
      setBusy(false);
    }
  };

  const approval = others.length === 0
    ? null
    : others.length === files.length
      ? '这些文件由他人上传，改动会发给上传者，同意后生效。'
      : `其中 ${others.length} 个由他人上传，这部分会发给上传者，同意后生效；其余的直接保存。`;

  return (
    <Dialog
      open
      onClose={onClose}
      title="编辑活动信息"
      className="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={empty}>
            {own.length ? '保存' : '发送申请'}
          </Button>
        </>
      }
    >
      <div className="px-6 pb-2 pt-3">
        <FileStrip files={files} />
        <ActivityFields value={value} onChange={setValue} mixed={mixed} className="mt-5" />
        {approval && (
          <div className="mt-5 rounded-2xl bg-surface-2 p-3.5">
            <p className="flex gap-2 text-[12.5px] leading-relaxed text-fg-soft">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-faint" />
              {approval}
            </p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="给上传者留言（可选）"
              maxLength={500}
              className="mt-3 min-h-16 bg-surface"
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** 选中的文件叠成一摞，旁边写多少个 */
function FileStrip({ files }: { files: FileItem[] }) {
  const shown = files.slice(0, 4);
  const images = files.filter(isImage).length;
  const videos = files.filter(isVideo).length;
  const audios = files.filter(isAudio).length;
  const parts = [images && `${images} 张照片`, videos && `${videos} 段视频`, audios && `${audios} 段音频`].filter(Boolean);
  return (
    <div className="flex items-center gap-3">
      <div className="flex shrink-0 items-center">
        {shown.map((f, i) => (
          <Thumb
            key={f.id}
            file={f}
            width={40}
            height={40}
            scrub={false}
            showBadges={false}
            className="h-10 w-10 rounded-lg ring-2 ring-surface"
            style={{ marginLeft: i ? -14 : 0, zIndex: shown.length - i, transform: `rotate(${(i - (shown.length - 1) / 2) * 4}deg)` }}
          />
        ))}
      </div>
      <p className="min-w-0 text-[13px] text-fg-soft">
        <span className="font-medium text-fg tabular">{files.length} 个文件</span>
        {parts.length > 0 && <span className="ml-1.5 text-fg-faint">{parts.join('，')}</span>}
      </p>
    </div>
  );
}
