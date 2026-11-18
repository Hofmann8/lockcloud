'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/shell/PageHeader';
import { PoweredByLockAI } from '@/components/lockai/LockAI';
import { EmptyState } from '@/components/brand/LuckyLocker';
import { Avatar } from '@/components/ui/Avatar';
import { peopleApi } from '@/lib/api/media';
import type { Person } from '@/lib/api/types';
import { personHref } from '@/lib/routes';

function PersonTile({ p }: { p: Person }) {
  return (
    <li>
      <Link href={personHref(p.id)} className="group flex flex-col items-center gap-2 rounded-2xl p-2 text-center outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <span className="rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-bg transition-[box-shadow] duration-200 group-hover:ring-line-strong">
          <Avatar src={p.thumb_url} name={p.name || '?'} seed={p.id} size={88} />
        </span>
        <span className="w-full">
          <span className={cn('block truncate text-[13.5px]', p.name ? 'font-medium text-fg' : 'text-fg-faint')}>{p.name || '未命名'}</span>
          <span className="block text-[11.5px] text-fg-faint tabular">出现 {p.face_count} 次</span>
        </span>
      </Link>
    </li>
  );
}

export default function PeoplePage() {
  const [q, setQ] = useState('');
  const [showUnnamed, setShowUnnamed] = useState(false);
  const query = useQuery({ queryKey: ['people', 'all'], queryFn: () => peopleApi.list({ limit: 1000 }) });

  const { named, unnamed } = useMemo(() => {
    const list = query.data?.persons ?? [];
    const needle = q.trim().toLowerCase();
    const hit = needle ? list.filter((p) => p.name?.toLowerCase().includes(needle)) : list;
    return {
      named: hit.filter((p) => p.name).sort((a, b) => b.face_count - a.face_count),
      unnamed: needle ? [] : list.filter((p) => !p.name).sort((a, b) => b.face_count - a.face_count),
    };
  }, [query.data, q]);

  return (
    <>
      <PageHeader
        title="人物"
        subtitle={query.data ? `已命名 ${named.length} 位${unnamed.length ? `，未命名 ${unnamed.length} 位` : ''}` : undefined}
        actions={
          <label className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索人物"
              className="h-8 w-48 rounded-xl border border-line bg-surface pl-8 pr-3 text-[13px] text-fg placeholder:text-fg-faint focus:border-accent focus:outline-none"
            />
          </label>
        }
      />
      <div className="px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        {query.isPending ? (
          <ul className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-7 2xl:grid-cols-9">
            {Array.from({ length: 14 }, (_, i) => (
              <li key={i} className="flex flex-col items-center gap-2 p-2">
                <div className="skeleton h-[88px] w-[88px] rounded-full" />
                <div className="skeleton h-3 w-14 rounded" />
              </li>
            ))}
          </ul>
        ) : !named.length && !unnamed.length ? (
          <EmptyState
            title={q ? '没有找到此人' : '还没有人物'}
            description={q ? undefined : '照片中识别出的人物会显示在这里。为他们命名后，即可按名字查找。'}
            quiet={!!q}
          />
        ) : (
          <>
            <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-5 lg:grid-cols-7 2xl:grid-cols-9">
              {named.map((p) => <PersonTile key={p.id} p={p} />)}
            </ul>
            {unnamed.length > 0 && (
              <section className="mt-12">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-[15px] font-semibold text-fg">未命名</h2>
                  <button type="button" onClick={() => setShowUnnamed((v) => !v)} className="text-[13px] text-accent-ink hover:underline">
                    {showUnnamed ? '收起' : `显示全部 ${unnamed.length} 位`}
                  </button>
                </div>
                <p className="mb-4 text-[13px] text-fg-faint">为认识的人命名。同一个人若被识别为多位，取相同的名字即可合并。</p>
                <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-5 lg:grid-cols-7 2xl:grid-cols-9">
                  {(showUnnamed ? unnamed : unnamed.slice(0, 14)).map((p) => <PersonTile key={p.id} p={p} />)}
                </ul>
              </section>
            )}
            <PoweredByLockAI className="mt-12" />
          </>
        )}
      </div>
    </>
  );
}
