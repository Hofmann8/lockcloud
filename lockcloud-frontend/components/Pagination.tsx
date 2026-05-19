'use client';

import { useState, useEffect } from 'react';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { Select } from '@/components/Select';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  hasNext: boolean;
  hasPrev: boolean;
}

// 根据 currentPage 在 totalPages 中的位置和 siblingCount，
// 生成形如 [1, '...', 4, 5, 6, '...', 99] 的页码序列。
// siblingCount = 当前页两侧各显示多少个页码。
function buildPageRange(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): (number | 'ellipsis-l' | 'ellipsis-r')[] {
  // 显示首+末+当前+两侧+最多两个省略号
  const totalVisible = siblingCount * 2 + 5;

  if (totalPages <= totalVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  // 靠左：[1,2,3,...,k, '...', last]
  if (!showLeftEllipsis && showRightEllipsis) {
    const leftCount = 3 + 2 * siblingCount;
    const left = Array.from({ length: leftCount }, (_, i) => i + 1);
    return [...left, 'ellipsis-r', totalPages];
  }

  // 靠右：[1, '...', last-k, ..., last]
  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + 2 * siblingCount;
    const right = Array.from(
      { length: rightCount },
      (_, i) => totalPages - rightCount + 1 + i,
    );
    return [1, 'ellipsis-l', ...right];
  }

  // 中间：[1, '...', c-s, ..., c+s, '...', last]
  const middle = Array.from(
    { length: 2 * siblingCount + 1 },
    (_, i) => leftSibling + i,
  );
  return [1, 'ellipsis-l', ...middle, 'ellipsis-r', totalPages];
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  hasNext,
  hasPrev,
}: PaginationProps) {
  // 响应式 sibling count：屏幕越大，显示页码越多。
  const isMd = useMediaQuery('(min-width: 768px)');
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isXl = useMediaQuery('(min-width: 1280px)');
  const is2xl = useMediaQuery('(min-width: 1536px)');

  let siblingCount = 1; // 默认 md：5 个数字按钮
  if (is2xl) siblingCount = 4;       // [1] ... [c-4..c+4] ... [last] → 11 个数字
  else if (isXl) siblingCount = 3;   // 9 个
  else if (isLg) siblingCount = 2;   // 7 个
  else if (isMd) siblingCount = 1;   // 5 个

  const pages = buildPageRange(currentPage, totalPages, siblingCount);

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // 跳转输入：受控，输入时跟随，但提交时再 onPageChange。
  const [jumpValue, setJumpValue] = useState<string>(String(currentPage));
  useEffect(() => {
    setJumpValue(String(currentPage));
  }, [currentPage]);

  const submitJump = () => {
    const v = parseInt(jumpValue, 10);
    if (!isNaN(v) && v >= 1 && v <= totalPages && v !== currentPage) {
      onPageChange(v);
    } else {
      setJumpValue(String(currentPage));
    }
  };

  const arrowBase =
    'inline-flex items-center justify-center min-w-[40px] h-10 sm:h-9 px-2 rounded-lg text-sm font-medium transition-all';
  const arrowEnabled =
    'bg-white border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 active:scale-95';
  const arrowDisabled = 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed';

  return (
    <div className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
      {/* 项目范围信息 */}
      <div className="text-sm text-gray-500 text-center lg:text-left">
        显示 <span className="font-semibold text-gray-900">{startItem}</span>
        {' - '}
        <span className="font-semibold text-gray-900">{endItem}</span>
        {' 共 '}
        <span className="font-semibold text-gray-900">{totalItems}</span>
        {' 项'}
      </div>

      {/* 分页按钮区 */}
      <div className="flex items-center justify-center gap-1.5">
        {/* 上一页 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev}
          className={`${arrowBase} ${hasPrev ? arrowEnabled : arrowDisabled}`}
          aria-label="上一页"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 页码 - 桌面 */}
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p) => {
            if (p === 'ellipsis-l' || p === 'ellipsis-r') {
              return (
                <span
                  key={p}
                  className="inline-flex items-center justify-center w-9 h-9 text-gray-400 select-none"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                aria-label={`第 ${p} 页`}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  inline-flex items-center justify-center
                  min-w-9 h-9 px-2.5 rounded-lg text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-orange-500 text-white shadow-sm hover:bg-orange-600'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50'
                  }
                `}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* 页码 - 移动端紧凑 */}
        <div className="sm:hidden inline-flex items-center px-3 h-10 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg">
          <span className="text-orange-600">{currentPage}</span>
          <span className="text-gray-400 mx-1">/</span>
          <span>{totalPages}</span>
        </div>

        {/* 下一页 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
          className={`${arrowBase} ${hasNext ? arrowEnabled : arrowDisabled}`}
          aria-label="下一页"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 跳转 - 页数足够多时显示 */}
      {totalPages > 10 && (
        <div className="hidden md:flex items-center justify-center gap-2 text-sm text-gray-500">
          <span>跳转</span>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={jumpValue}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '');
                setJumpValue(v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitJump();
                }
              }}
              onBlur={submitJump}
              aria-label="跳转到指定页"
              className="
                w-14 h-9 px-2 text-center text-sm font-medium text-gray-900
                bg-white border border-gray-200 rounded-lg
                focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30
                transition-all
              "
            />
          </div>
          <span>页</span>
        </div>
      )}
    </div>
  );
}

// 暴露给文件列表那种"每页 N 条"的选择器使用；导出统一封装的样式。
export function PerPageSelect({
  value,
  onChange,
  options = [12, 24, 48, 96],
  className = '',
}: {
  value: number;
  onChange: (n: number) => void;
  options?: number[];
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 text-sm text-gray-500 ${className}`}>
      <span className="hidden sm:inline">每页</span>
      <Select
        size="sm"
        value={String(value)}
        onChange={(v) => onChange(parseInt(v, 10))}
        options={options.map((n) => ({ value: String(n), label: `${n} 条` }))}
        ariaLabel="每页显示数量"
        className="w-24"
      />
    </div>
  );
}
