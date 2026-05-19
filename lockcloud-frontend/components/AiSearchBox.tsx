'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * Navbar 里的 AI 搜索输入框。
 *
 *  - 实际就是一个 input,enter 之后 router.push('/files?ai=<q>')
 *  - 在 /files 页时与 URL 的 ai 参数双向同步;清空提交则去掉该参数回到普通浏览
 *  - 不弹模态、不开新页 —— AI 搜索是 /files 页的另一种 query 模式,
 *    结果直接落在主容器的 FileGrid 里
 *  - Cmd/Ctrl+K 全局聚焦
 */
export function AiSearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 仅在 /files 页时认 URL 的 ai 参数为"当前查询"
  const urlValue =
    pathname === '/files' ? searchParams.get('ai') || '' : '';

  const [q, setQ] = useState(urlValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL 变化(比如用户点 × 清掉)→ 同步到本地输入
  useEffect(() => {
    setQ(urlValue);
  }, [urlValue]);

  // Cmd/Ctrl+K 全局聚焦
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = q.trim();
      if (!trimmed) {
        if (urlValue) router.push('/files');
        return;
      }
      router.push(`/files?ai=${encodeURIComponent(trimmed)}`);
      inputRef.current?.blur();
    },
    [q, urlValue, router]
  );

  const handleClear = useCallback(() => {
    setQ('');
    if (urlValue) router.push('/files');
    inputRef.current?.focus();
  }, [urlValue, router]);

  const hasValue = q.trim().length > 0;
  const isActive = urlValue.length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className={`ai-search-box relative flex items-center w-full max-w-md border rounded-full transition-[background-color,border-color,box-shadow]
        ${isActive
          ? 'bg-orange-50 border-orange-500/50 hover:border-orange-500'
          : 'bg-gray-50 border-black/10 hover:border-orange-300'}
        hover:shadow-[0_0_0_3px_rgba(255,140,66,0.10)]
        focus-within:bg-white focus-within:border-orange-500 focus-within:shadow-[0_0_0_3px_rgba(255,140,66,0.16)]`}
      role="search"
    >
      <SparkleIcon
        className={`absolute left-3.5 w-4 h-4 shrink-0 transition-colors ${
          isActive ? 'text-orange-600' : 'text-orange-500'
        }`}
      />
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="AI 搜索"
        className="ai-search-box__input w-full pl-10 pr-32 py-2 text-sm bg-transparent rounded-full border-0 outline-none shadow-none focus:outline-none focus:shadow-none focus-visible:outline-none focus-visible:shadow-none focus-visible:border-transparent placeholder:text-gray-400"
        aria-label="AI 自然语言搜索"
      />
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-28 p-1 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
          aria-label="清空"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <span className="absolute right-4 text-[11px] text-gray-400 select-none pointer-events-none whitespace-nowrap">
        Powered by <span className="font-semibold text-orange-500">LockAI</span>
      </span>
    </form>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l1.8 5.4a3 3 0 0 0 1.9 1.9L21 11.5l-5.3 1.7a3 3 0 0 0-1.9 1.9L12 20.5l-1.8-5.4a3 3 0 0 0-1.9-1.9L3 11.5l5.3-1.7a3 3 0 0 0 1.9-1.9L12 2.5z" />
    </svg>
  );
}
