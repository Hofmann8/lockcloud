'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  listPersons,
  renamePerson,
  mergePerson,
  Person,
  PersonNameConflict,
} from '@/lib/api/files';
import { Card } from '@/components/Card';
import toast from 'react-hot-toast';

/**
 * 人物列表页 —— 把脸聚类后的 person 都列出来,卡片样式。
 *
 * 分两段显示:
 *   - 已命名:有 name 字段,显示真名;通常已被用户对上号
 *   - 未命名:没起过名字,以 #id 占位,可在卡片上点字段直接命名
 *
 * 改名撞同名 → 后端 409 + 带 existing,这里弹"是否合并"对话框,确认走 mergePerson。
 * 缩略图来自公开桶 + ?rect=,见 [[decision_public_mirror_bucket]]。
 * 换代表头像不在这页改,去 /files?person=<id> 在某张图上点"设为代表"。
 */
export default function PersonsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['persons'],
    queryFn: () => listPersons({ limit: 1000 }),
    // 全局 default 是 refetchOnMount:false,但人物的 cover 在 /files 那边改完
    // 标 stale 后不会自动拉;这里强制每次进页面都刷,保证看到最新代表头像。
    refetchOnMount: 'always',
  });

  const { named, unnamed } = useMemo(() => {
    const list = data?.persons ?? [];
    const named = list.filter((p) => (p.name ?? '').trim() !== '');
    const unnamed = list.filter((p) => !(p.name ?? '').trim());
    return { named, unnamed };
  }, [data]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">人物</h1>
        {data && (
          <span className="text-gray-400 text-sm">({data.total} 个)</span>
        )}
      </div>

      {error && (
        <Card variant="bordered" padding="lg">
          <p className="text-red-500">加载失败:{(error as Error).message}</p>
        </Card>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {data && data.persons.length === 0 && (
        <Card variant="bordered" padding="lg">
          <p className="text-gray-500 text-center">
            还没有聚类完成的人物。
            <br />
            <span className="text-xs text-gray-400">
              管理员需要先跑 cluster_faces.py + mirror_cover_files.py
            </span>
          </p>
        </Card>
      )}

      {data && data.persons.length > 0 && (
        <>
          <PersonSection
            title="已命名"
            hint="已对上具体的人"
            persons={named}
          />
          <PersonSection
            title="未命名"
            hint="还没起名字,点姓名行可命名"
            persons={unnamed}
          />
        </>
      )}
    </div>
  );
}

function PersonSection({
  title,
  hint,
  persons,
}: {
  title: string;
  hint: string;
  persons: Person[];
}) {
  if (persons.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm text-gray-400">({persons.length})</span>
        <span className="text-xs text-gray-400">— {hint}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {persons.map((p) => (
          <PersonCard key={p.id} person={p} />
        ))}
      </div>
    </section>
  );
}

function PersonCard({ person }: { person: Person }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(person.name || '');
  // 撞名时把 existing 暂存,弹合并对话框
  const [mergeTarget, setMergeTarget] = useState<{
    existing: PersonNameConflict;
    attemptedName: string;
  } | null>(null);

  const renameMut = useMutation({
    mutationFn: (name: string) => renamePerson(person.id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      setIsEditing(false);
    },
    onError: (err: { code?: string; message?: string; details?: { existing?: PersonNameConflict } }) => {
      if (err.code === 'NAME_CONFLICT' && err.details?.existing) {
        // 把当前 input 状态固定下来,弹合并确认
        setMergeTarget({
          existing: err.details.existing,
          attemptedName: nameInput.trim(),
        });
      } else {
        toast.error(err.message || '改名失败');
      }
    },
  });

  const mergeMut = useMutation({
    mutationFn: (targetId: number) => mergePerson(person.id, targetId),
    onSuccess: (_data, targetId) => {
      const targetName = mergeTarget?.existing.name || `#${targetId}`;
      toast.success(`已合并到「${targetName}」`);
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['people-in-file'] });
      setMergeTarget(null);
      setIsEditing(false);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || '合并失败');
    },
  });

  const display = person.name || `#${person.id}`;

  return (
    <>
      <div className="group relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-orange-300 hover:shadow-md transition-all">
        <Link href={`/files?person=${person.id}`} className="block">
          <div className="aspect-square bg-gradient-to-br from-orange-100 to-orange-200 relative overflow-hidden">
            {person.thumb_url ? (
              <img
                src={person.thumb_url}
                alt={display}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-orange-600/70">
                  {display.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {person.cover_pinned && (
              <span
                className="absolute top-1 left-1 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm"
                title="封面已被手动指定,聚类不会覆盖"
              >
                已锁定
              </span>
            )}
            <span className="absolute bottom-1 right-1 bg-black/55 text-white text-[11px] px-1.5 py-0.5 rounded">
              {person.face_count}
            </span>
          </div>
        </Link>

        <div className="px-2 py-1.5">
          {isEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                renameMut.mutate(nameInput.trim());
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => {
                  if (nameInput.trim() === (person.name || '')) {
                    setIsEditing(false);
                  } else {
                    renameMut.mutate(nameInput.trim());
                  }
                }}
                className="w-full text-xs px-1.5 py-0.5 border border-orange-400 rounded outline-none"
                placeholder="起个名字…"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="w-full text-left text-xs text-gray-700 truncate hover:text-orange-600"
              title="点击重命名"
            >
              {display}
            </button>
          )}
        </div>
      </div>

      {mergeTarget && (
        <MergeConfirmDialog
          source={person}
          existing={mergeTarget.existing}
          attemptedName={mergeTarget.attemptedName}
          isPending={mergeMut.isPending}
          onCancel={() => {
            setMergeTarget(null);
            setNameInput(person.name || '');
          }}
          onConfirm={() => mergeMut.mutate(mergeTarget.existing.id)}
        />
      )}
    </>
  );
}

function MergeConfirmDialog({
  source,
  existing,
  attemptedName,
  isPending,
  onCancel,
  onConfirm,
}: {
  source: Person;
  existing: PersonNameConflict;
  attemptedName: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">
          已存在「{attemptedName}」
        </h3>
        <p className="text-sm text-gray-600">
          要把当前 person 合并到下面这个吗?合并后当前条目会被删除,所有照片归到对方名下。
        </p>

        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
          <PreviewThumb name="待合并" person={source} />
          <span className="text-2xl text-orange-500">→</span>
          <PreviewThumb name="已存在" thumb={existing.thumb_url} faceCount={existing.face_count} displayName={existing.name} />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-1.5 text-sm rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {isPending ? '合并中…' : '确认合并'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewThumb({
  name,
  person,
  thumb,
  faceCount,
  displayName,
}: {
  name: string;
  person?: Person;
  thumb?: string | null;
  faceCount?: number;
  displayName?: string | null;
}) {
  const url = person?.thumb_url ?? thumb ?? null;
  const label = displayName ?? person?.name ?? (person ? `#${person.id}` : '');
  const count = person?.face_count ?? faceCount ?? 0;
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-[10px] text-gray-400">{name}</span>
      <div className="w-16 h-16 rounded bg-gray-200 overflow-hidden flex items-center justify-center">
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl font-bold text-gray-400">
            {(label || '?').charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-xs text-gray-700 truncate max-w-full">{label}</span>
      <span className="text-[10px] text-gray-400">{count} 张</span>
    </div>
  );
}
