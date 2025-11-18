'use client';

import { Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { listFiles } from '@/lib/api/files';
import { FileFilters } from '@/types';
import { FileGrid } from '@/components/FileGrid';
import { UnifiedSearch } from '@/components/UnifiedSearch';
import { FileGridSkeleton } from '@/components/SkeletonLoader';
import { Pagination } from '@/components/Pagination';
import { Card } from '@/components/Card';
import { ErrorCard } from '@/components/ErrorCard';
import { MobileMenuButton } from '@/components/MobileMenuButton';
import { zhCN } from '@/locales/zh-CN';

function FilesPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  
  // Derive filters directly from URL parameters (no state needed)
  const filters: FileFilters = {
    page: parseInt(searchParams.get('page') || '1', 10),
    per_page: parseInt(searchParams.get('per_page') || '12', 10),
    ...(searchParams.get('directory') && { directory: searchParams.get('directory')! }),
    ...(searchParams.get('activity_type') && { activity_type: searchParams.get('activity_type')! }),
    ...(searchParams.get('instructor') && { instructor: searchParams.get('instructor')! }),
    ...(searchParams.get('date_from') && { date_from: searchParams.get('date_from')! }),
    ...(searchParams.get('date_to') && { date_to: searchParams.get('date_to')! }),
    ...(searchParams.get('search') && { search: searchParams.get('search')! }),
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['files', filters],
    queryFn: () => listFiles(filters),
  });

  const handleFilterChange = (newFilters: Partial<FileFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Update or remove parameters
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
    
    // Reset to page 1 when filters change
    params.set('page', '1');
    
    // Update URL using Next.js router
    router.push(`/files?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`/files?${params.toString()}`);
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePerPageChange = (perPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('per_page', String(perPage));
    params.set('page', '1'); // 重置到第一页
    router.push(`/files?${params.toString()}`);
  };

  const handleFileUpdate = () => {
    // Refetch file list
    refetch();
    // Also invalidate directory tree to update file counts
    queryClient.invalidateQueries({ queryKey: ['directories'] });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <MobileMenuButton />
          <h1 className="text-2xl md:text-3xl font-sans font-bold text-primary-black">
            {zhCN.files.title}
          </h1>
        </div>
      </div>

      {/* Unified Search */}
      <UnifiedSearch filters={filters} onFilterChange={handleFilterChange} />

      {/* Loading State with Skeleton */}
      {isLoading && <FileGridSkeleton count={6} />}

      {/* Error State */}
      {error && (
        <ErrorCard
          title="加载失败"
          message={zhCN.errors.serverError}
          variant="error"
          action={{
            label: "重试",
            onClick: () => window.location.reload()
          }}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && data && data.files.length === 0 && (
        <Card variant="bordered" padding="lg">
          <div className="text-center">
            <p className="text-accent-gray text-lg">{zhCN.files.noFiles}</p>
          </div>
        </Card>
      )}

      {/* File Grid */}
      {!isLoading && !error && data && data.files.length > 0 && (
        <>
          {/* 每页显示数量选择器 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-accent-gray">每页显示</span>
              <select
                value={filters.per_page}
                onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                className="px-3 py-1.5 text-sm border border-accent-gray/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue/20 bg-white"
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
                <option value={96}>96</option>
              </select>
              <span className="text-sm text-accent-gray">项</span>
            </div>
            
            <div className="text-sm text-accent-gray">
              共 <span className="font-medium text-primary-black">{data.pagination.total}</span> 个文件
            </div>
          </div>

          <FileGrid files={data.files} onFileUpdate={handleFileUpdate} />
          
          {/* Pagination */}
          {data.pagination.total > data.pagination.per_page && (
            <Pagination
              currentPage={data.pagination.page}
              totalPages={data.pagination.pages}
              totalItems={data.pagination.total}
              itemsPerPage={data.pagination.per_page}
              onPageChange={handlePageChange}
              hasNext={data.pagination.has_next}
              hasPrev={data.pagination.has_prev}
            />
          )}
        </>
      )}
    </div>
  );
}


export default function FilesPage() {
  return (
    <Suspense fallback={<FileGridSkeleton count={6} />}>
      <FilesPageContent />
    </Suspense>
  );
}
