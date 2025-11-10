'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listFiles } from '@/lib/api/files';
import { FileFilters } from '@/types';
import { FileGrid } from '@/components/FileGrid';
import { FileFilters as FileFiltersComponent } from '@/components/FileFilters';
import { FileGridSkeleton } from '@/components/SkeletonLoader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorCard } from '@/components/ErrorCard';
import { zhCN } from '@/locales/zh-CN';

export default function FilesPage() {
  const [filters, setFilters] = useState<FileFilters>({
    page: 1,
    per_page: 50,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['files', filters],
    queryFn: () => listFiles(filters),
  });

  const handleFilterChange = (newFilters: Partial<FileFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-sans font-bold text-primary-black">
          {zhCN.files.title}
        </h1>
      </div>

      {/* Filters */}
      <FileFiltersComponent filters={filters} onFilterChange={handleFilterChange} />

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
          <FileGrid files={data.files} />
          
          {/* Pagination */}
          {data.total > data.per_page && (
            <div className="flex justify-center items-center gap-3 md:gap-4 mt-6 md:mt-8">
              <Button
                variant="secondary"
                onClick={() => handlePageChange(data.page - 1)}
                disabled={data.page === 1}
              >
                {zhCN.common.previous}
              </Button>
              <span className="text-sm md:text-base text-primary-black font-medium">
                {data.page} / {Math.ceil(data.total / data.per_page)}
              </span>
              <Button
                variant="secondary"
                onClick={() => handlePageChange(data.page + 1)}
                disabled={data.page >= Math.ceil(data.total / data.per_page)}
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
