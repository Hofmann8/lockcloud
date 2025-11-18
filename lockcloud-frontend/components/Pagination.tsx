'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  hasNext: boolean;
  hasPrev: boolean;
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
  // 计算显示的页码范围
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // 最多显示7个页码按钮

    if (totalPages <= maxVisible) {
      // 如果总页数少于最大显示数，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 总是显示第一页
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // 显示当前页附近的页码
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // 总是显示最后一页
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  // 计算当前显示的项目范围
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      {/* 显示项目范围信息 */}
      <div className="text-sm text-accent-gray">
        显示 <span className="font-medium text-primary-black">{startItem}</span> 到{' '}
        <span className="font-medium text-primary-black">{endItem}</span>，共{' '}
        <span className="font-medium text-primary-black">{totalItems}</span> 项
      </div>

      {/* 分页按钮 */}
      <div className="flex items-center gap-2">
        {/* 上一页按钮 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev}
          className={`
            px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${
              hasPrev
                ? 'bg-white border border-accent-gray/30 text-primary-black hover:bg-accent-gray/10'
                : 'bg-accent-gray/10 text-accent-gray/50 cursor-not-allowed'
            }
          `}
          aria-label="上一页"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 页码按钮 */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-3 py-2 text-accent-gray">
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`
                  min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? 'bg-accent-blue text-white'
                      : 'bg-white border border-accent-gray/30 text-primary-black hover:bg-accent-gray/10'
                  }
                `}
                aria-label={`第 ${pageNum} 页`}
                aria-current={isActive ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* 移动端：简单的页码显示 */}
        <div className="sm:hidden px-3 py-2 text-sm font-medium text-primary-black">
          {currentPage} / {totalPages}
        </div>

        {/* 下一页按钮 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
          className={`
            px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${
              hasNext
                ? 'bg-white border border-accent-gray/30 text-primary-black hover:bg-accent-gray/10'
                : 'bg-accent-gray/10 text-accent-gray/50 cursor-not-allowed'
            }
          `}
          aria-label="下一页"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 快速跳转（可选） */}
      {totalPages > 10 && (
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-sm text-accent-gray">跳转到</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            defaultValue={currentPage}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = parseInt((e.target as HTMLInputElement).value);
                if (value >= 1 && value <= totalPages) {
                  onPageChange(value);
                }
              }
            }}
            className="w-16 px-2 py-1 text-sm border border-accent-gray/30 rounded focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
          />
          <span className="text-sm text-accent-gray">页</span>
        </div>
      )}
    </div>
  );
}
