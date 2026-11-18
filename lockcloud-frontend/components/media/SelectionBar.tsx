'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Columns2, Download, Minus, PencilLine, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Confirm } from '@/components/ui/Dialog';
import { Popover } from '@/components/ui/Popover';
import { toast } from '@/components/ui/Toast';
import { TagInput } from '@/components/files/TagInput';
import { BatchEditDialog } from '@/components/files/BatchEditDialog';
import { useFileActions, useRefreshLibrary } from '@/components/files/useFileActions';
import { filesApi } from '@/lib/api/files';
import { errorMessage } from '@/lib/api/client';
import type { FileItem } from '@/lib/api/types';
import { splitByPermission } from '@/lib/permissions';
import { compareHref } from '@/lib/routes';
import { isVideo } from '@/lib/urls';
import { useAuthStore } from '@/stores/authStore';
import { useSelection } from '@/stores/selectionStore';

const NONE: number[] = [];

interface SelectionBarProps {
  scope: string;
  files: FileItem[];
  /** 打包下载的文件名 */
  zipName?: string;
}

interface TagCount {
  id: number;
  name: string;
  /** 选中的文件里有几个带这个标签 */
  n: number;
}

/** 选中文件后从底部浮起来的操作条：深色玻璃胶囊（和播放器同一套暗场色，深浅模式都是深色），压在照片上也看得清 */
export function SelectionBar({ scope, files, zipName = 'LockCloud' }: SelectionBarProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const ids = useSelection((s) => (s.scope === scope ? s.ids : NONE));
  const clear = useSelection((s) => s.clear);
  const setAll = useSelection((s) => s.setAll);
  const { trash, download } = useFileActions();
  const [editing, setEditing] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const tagAnchor = useRef<HTMLButtonElement>(null);

  const selected = useMemo(() => {
    const byId = new Map(files.map((f) => [f.id, f]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as FileItem[];
  }, [ids, files]);

  if (!selected.length) return null;
  const videos = selected.filter(isVideo);
  const canCompare = selected.length === 2 && videos.length === 2;
  const allSelected = selected.length >= files.length;
  const others = splitByPermission(selected, user).others.length;

  const trashCopy = () => {
    const n = selected.length;
    if (!others) return { title: `将 ${n} 个文件移到回收站？`, description: '30 天内可以在回收站恢复。', label: '移到回收站' };
    if (others === n) {
      return {
        title: n === 1 ? '向上传者申请删除？' : `向上传者申请删除这 ${n} 个文件？`,
        description: '这些文件由他人上传，上传者同意后才会移到回收站。',
        label: '发送申请',
      };
    }
    return {
      title: `将 ${n} 个文件移到回收站？`,
      description: `其中 ${others} 个由他人上传，会改为向上传者申请删除。其余的 30 天内可以在回收站恢复。`,
      label: '移到回收站',
    };
  };
  const copy = trashCopy();

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-40 flex justify-center px-3 md:bottom-6">
        <div
          role="toolbar"
          aria-label="已选文件的操作"
          className="stage pointer-events-auto flex h-12 items-center gap-0.5 rounded-full bg-stage/90 p-1.5 text-stage-fg shadow-pop ring-1 ring-stage-line backdrop-blur-xl animate-lock-in"
        >
          <button
            type="button"
            onClick={clear}
            aria-label="取消选择"
            title="取消选择（Esc）"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stage-soft transition-colors hover:bg-stage-fg/12 hover:text-stage-fg"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="pl-1 pr-2 text-[13px] font-medium tabular whitespace-nowrap">已选 {selected.length} 项</span>
          {!allSelected && (
            <button
              type="button"
              onClick={() => setAll(files.map((f) => f.id), scope)}
              className="mr-1 h-7 shrink-0 rounded-full px-2.5 text-[12.5px] text-stage-soft transition-colors hover:bg-stage-fg/12 hover:text-stage-fg"
            >
              全选
            </button>
          )}

          <span className="mx-1 h-5 w-px shrink-0 bg-stage-line" aria-hidden />

          <BarButton ref={tagAnchor} label="标签" active={tagOpen} onClick={() => setTagOpen((v) => !v)}>
            <TagIcon className="h-4 w-4" />
          </BarButton>
          <BarButton label="编辑" onClick={() => setEditing(true)}>
            <PencilLine className="h-4 w-4" />
          </BarButton>
          <BarButton
            label="下载"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await download(selected, zipName);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download className="h-4 w-4" />
          </BarButton>
          {canCompare && (
            <BarButton label="并排对比" onClick={() => router.push(compareHref(videos[0].id, videos[1].id))}>
              <Columns2 className="h-4 w-4" />
            </BarButton>
          )}

          <span className="mx-1 h-5 w-px shrink-0 bg-stage-line" aria-hidden />

          <BarButton label="删除" danger onClick={() => setConfirmTrash(true)}>
            <Trash2 className="h-4 w-4" />
          </BarButton>
        </div>
      </div>

      <Popover open={tagOpen} onOpenChange={setTagOpen} anchor={tagAnchor} placement="top" offset={14} className="w-80 p-0">
        <TagPanel files={selected} />
      </Popover>

      <BatchEditDialog open={editing} onClose={() => setEditing(false)} files={selected} onDone={clear} />

      <Confirm
        open={confirmTrash}
        onClose={() => setConfirmTrash(false)}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.label}
        danger={copy.label !== '发送申请'}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            const { moved, asked } = await trash(selected);
            if (moved || asked) clear();
          } finally {
            setBusy(false);
            setConfirmTrash(false);
          }
        }}
      />
    </>
  );
}

interface BarButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

/** 图标加文字；窄屏只留图标 */
function BarButton({ label, onClick, children, active, danger, disabled, ref }: BarButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors disabled:opacity-50 sm:px-3',
        danger
          ? 'text-[oklch(0.72_0.15_25)] hover:bg-[oklch(0.62_0.19_27/0.22)]'
          : active
            ? 'bg-stage-fg/16 text-stage-fg'
            : 'text-stage-soft hover:bg-stage-fg/12 hover:text-stage-fg',
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/**
 * 批量标签：上面加，下面是这些文件已经有的标签。
 * 全部都有的打勾，点一下从全部去掉；只有部分有的显示"1/3"，点一下补给其余的。
 */
function TagPanel({ files }: { files: FileItem[] }) {
  const refresh = useRefreshLibrary();
  const [pending, setPending] = useState<number | null>(null);
  const ids = files.map((f) => f.id);
  const total = files.length;

  const tags = useMemo(() => {
    const count = new Map<number, TagCount>();
    for (const f of files) for (const t of f.free_tags ?? []) {
      const c = count.get(t.id) ?? { id: t.id, name: t.name, n: 0 };
      c.n++;
      count.set(t.id, c);
    }
    return [...count.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'zh'));
  }, [files]);

  const add = async (name: string) => {
    try {
      await filesApi.batchAddTag(ids, name);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const toggle = async (t: TagCount) => {
    setPending(t.id);
    try {
      if (t.n === total) await filesApi.batchRemoveTag(ids, t.id);
      else await filesApi.batchAddTag(ids, t.name);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <div className="flex items-baseline justify-between px-4 pb-2 pt-3.5">
        <p className="text-[14px] font-semibold text-fg">标签</p>
        <p className="text-[12px] text-fg-faint tabular">{total} 个文件</p>
      </div>
      <div className="px-3 pb-3">
        <TagInput variant="field" onAdd={add} autoFocus placeholder="添加标签" exclude={tags.filter((t) => t.n === total).map((t) => t.name)} />
      </div>
      {tags.length > 0 ? (
        <ul className="max-h-64 overflow-y-auto border-t border-line p-1.5 thin-scrollbar">
          {tags.map((t) => {
            const all = t.n === total;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void toggle(t)}
                  disabled={pending === t.id}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-surface-2 disabled:opacity-60"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border',
                      all ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong text-fg-soft',
                    )}
                    aria-hidden
                  >
                    {all ? <Check className="h-3 w-3" strokeWidth={3} /> : <Minus className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-fg">{t.name}</span>
                  <span className="shrink-0 text-[11.5px] text-fg-faint tabular">
                    <span className="group-hover:hidden">{all ? '全部' : `${t.n}/${total}`}</span>
                    <span className="hidden text-fg-soft group-hover:inline">{all ? '全部移除' : '补给全部'}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border-t border-line px-4 py-4 text-center text-[12.5px] text-fg-faint">还没有标签</p>
      )}
    </div>
  );
}
