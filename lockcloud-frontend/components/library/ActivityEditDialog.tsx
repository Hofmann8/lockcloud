'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Chip, Field, Input, Textarea } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';
import { useRefreshLibrary } from '@/components/files/useFileActions';
import { filesApi } from '@/lib/api/files';
import { requestsApi } from '@/lib/api/media';
import { errorMessage } from '@/lib/api/client';
import type { ActivityKey } from '@/lib/api/types';
import { ACTIVITY_TYPES } from '@/lib/constants/activityTypes';
import { activityHref } from '@/lib/routes';

interface Props {
  open: boolean;
  onClose: () => void;
  activity: ActivityKey;
  isOwner: boolean;
}

/** 改活动名 / 类型：整个活动里的文件一起改。负责人或管理员直接改，其他人发申请 */
export function ActivityEditDialog({ open, onClose, activity, isOwner }: Props) {
  return open ? <Form onClose={onClose} activity={activity} isOwner={isOwner} /> : null;
}

function Form({ onClose, activity, isOwner }: Omit<Props, 'open'>) {
  const router = useRouter();
  const refresh = useRefreshLibrary();
  const [name, setName] = useState(activity.activity_name);
  const [type, setType] = useState(activity.activity_type);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const changed = name.trim() !== activity.activity_name || type !== activity.activity_type;

  const submit = async () => {
    setBusy(true);
    try {
      const patch = {
        ...(name.trim() !== activity.activity_name ? { new_activity_name: name.trim() } : {}),
        ...(type !== activity.activity_type ? { new_activity_type: type } : {}),
      };
      if (isOwner) {
        const res = await filesApi.updateActivityDirectory({ ...activity, ...patch });
        refresh();
        toast(`已更新 ${res.updated_count} 个文件`);
        router.replace(activityHref({ activity_date: activity.activity_date, activity_type: res.new_activity_type, activity_name: res.new_activity_name }));
      } else {
        await requestsApi.createForDirectory({ ...activity, proposed_changes: patch, message: message.trim() || undefined });
        toast('申请已发送，负责人同意后生效');
      }
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={isOwner ? '编辑活动' : '申请编辑活动'}
      description={isOwner ? '更改将应用到活动中的所有文件。' : '更改需经活动负责人同意。'}
      className="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!changed || !name.trim()}>
            {isOwner ? '保存' : '发送申请'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-6 pb-2 pt-3">
        <Field label="活动名称">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} data-autofocus />
        </Field>
        <Field label="类型" as="div">
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_TYPES.map((t) => (
              <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>{t.label}</Chip>
            ))}
          </div>
        </Field>
        {!isOwner && (
          <Field label="给负责人的留言">
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="可选" maxLength={500} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}
