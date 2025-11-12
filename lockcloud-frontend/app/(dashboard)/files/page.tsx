'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { listFiles } from '@/lib/api/files';
import { FileFilters } from '@/types';
import { FileGrid } from '@/components/FileGrid';
import { UnifiedSearch } from '@/components/UnifiedSearch';
import { FileGridSkeleton } from '@/components/SkeletonLoader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorCard } from '@/components/ErrorCard';
import { zhCN } from '@/locales/zh-CN';

export default function FilesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  
  // Derive filters directly from URL parameters (no state needed)
  const filters: FileFilters = {
    page: parseInt(searchParams.get('page') || '1', 10),
    per_page: 50,
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
        <h1 className="text-2xl md:text-3xl font-sans font-bold text-primary-black">
          {zhCN.files.title}
        </h1>
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
          <FileGrid files={data.files} onFileUpdate={handleFileUpdate} />
          
          {/* Pagination */}
          {data.pagination.total > data.pagination.per_page && (
            <div className="flex justify-center items-center gap-3 md:gap-4 mt-6 md:mt-8">
              <Button
                variant="secondary"
                onClick={() => handlePageChange(data.pagination.page - 1)}
                disabled={!data.pagination.has_prev}
              >
                {zhCN.common.previous}
              </Button>
              <span className="text-sm md:text-base text-primary-black font-medium">
                {data.pagination.page} / {data.pagination.pages}
              </span>
              <Button
                variant="secondary"
                onClick={() => handlePageChange(data.pagination.page + 1)}
                disabled={!data.pagination.has_next}
              >
                {zhCN.common.next}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
