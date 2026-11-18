'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';
import { filesApi, type FileUpdate } from '@/lib/api/files';
import { requestsApi } from '@/lib/api/media';
import { ApiError, errorMessage } from '@/lib/api/client';
import type { FileItem } from '@/lib/api/types';
import { beatsHref } from '@/lib/routes';
import { displayName, isAudio, isVideo } from '@/lib/urls';
import { ActivityFields, type ActivityValue } from './ActivityFields';
import { useRefreshLibrary } from './useFileActions';

interface FileEditDialogProps {
  open: boolean;
  onClose: () => void;
  file: FileItem;
  editable: boolean;
}

export function FileEditDialog({ open, onClose, file, editable }: FileEditDialogProps) {
  return open ? <EditForm onClose={onClose} file={file} editable={editable} /> : null;
}

// 每次打开重新从文件取初值
function EditForm({ onClose, file, editable }: Omit<FileEditDialogProps, 'open'>) {
  const qc = useQueryClient();
  const refresh = useRefreshLibrary();
  const [name, setName] = useState(displayName(file));
  const [activity, setActivity] = useState<ActivityValue>({
    activity_date: file.activity_date ?? '',
    activity_type: file.activity_type ?? '',
    activity_name: file.activity_name ?? '',
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changes: FileUpdate = {};
  if (name.trim() && name.trim() !== displayName(file)) changes.filename = name.trim();
  if (activity.activity_date && activity.activity_date !== (file.activity_date ?? '')) changes.activity_date = activity.activity_date;
  if (activity.activity_type && activity.activity_type !== (file.activity_type ?? '')) changes.activity_type = activity.activity_type;
  if (activity.activity_name.trim() !== (file.activity_name ?? '')) changes.activity_name = activity.activity_name.trim();
  const empty = Object.keys(changes).length === 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editable) {
        const updated = await filesApi.update(file.id, changes);
        qc.setQueryData(['file', file.id], updated);
        refresh();
        toast('已保存');
      } else {
        await requestsApi.create({ file_id: file.id, request_type: 'edit', proposed_changes: changes, message: message.trim() || undefined });
        toast('申请已发送，上传者同意后生效');
      }
      onClose();
    } catch (e) {
      // 重名（FILE_005）写在名字框下面，别的错误弹提示
      if (e instanceof ApiError && (e.code === 'FILE_005' || e.status === 409)) setError(e.message);
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={editable ? '编辑信息' : '申请编辑'}
      description={editable ? undefined : '此文件由他人上传，更改需经上传者同意。'}
      className="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={empty}>
            {editable ? '保存' : '发送申请'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-6 pb-2 pt-3">
        <Field label="文件名" error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} data-autofocus invalid={!!error} />
        </Field>
        <ActivityFields value={activity} onChange={setActivity} />
        {/* 分析过的视频；音频处理好就有节拍，不用分析 */}
        {((isVideo(file) && file.lockai_status === 'ready') || (isAudio(file) && file.media_status === 'ready')) && (
          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
            <span className="text-fg-soft">八拍</span>
            <Link href={beatsHref(file.id)} onClick={onClose} className="font-medium text-accent-ink hover:underline">
              {editable ? '修改' : '申请修改'}
            </Link>
          </div>
        )}
        {!editable && (
          <Field label="给上传者的留言">
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="可选" maxLength={500} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}
