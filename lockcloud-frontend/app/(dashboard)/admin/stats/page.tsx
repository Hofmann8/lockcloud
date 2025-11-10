'use client';

import { useQuery } from '@tanstack/react-query';
import { getSummary } from '@/lib/api/logs';
import { zhCN } from '@/locales/zh-CN';
import { StatsGridSkeleton } from '@/components/SkeletonLoader';
import { Button } from '@/components/Button';
import { ErrorCard } from '@/components/ErrorCard';

export default function StatsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: getSummary,
    retry: false, // Don't retry on auth errors
  });

  // Check if error is permission denied
  const isPermissionError = error && (error as any).code === 'FORBIDDEN';

  const formatStorage = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} ${zhCN.units.bytes}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${zhCN.units.kb}`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} ${zhCN.units.mb}`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${zhCN.units.gb}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary-black">
          {zhCN.admin.stats}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = '/admin/logs'}
          >
            {zhCN.admin.logs}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <StatsGridSkeleton count={3} />
      ) : isPermissionError ? (
        <ErrorCard
          title="无权访问"
          message="您没有管理员权限，无法查看此页面。请联系管理员获取权限。"
          variant="warning"
        />
      ) : error ? (
        <ErrorCard
          title="加载统计数据失败"
          message={zhCN.errors.serverError}
          variant="error"
          action={{
            label: "重试",
            onClick: () => window.location.reload()
          }}
        />
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Storage */}
            <div className="card-functional p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-accent-gray mb-1">{zhCN.admin.totalStorage}</p>
                  <p className="text-3xl font-bold text-primary-black">
                    {formatStorage(data.total_storage)}
                  </p>
                </div>
                <div className="text-5xl">💾</div>
              </div>
            </div>

            {/* Upload Count */}
            <div className="card-functional p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-accent-gray mb-1">{zhCN.admin.uploadCount}</p>
                  <p className="text-3xl font-bold text-primary-black">{data.upload_count}</p>
                </div>
                <div className="text-5xl">📤</div>
              </div>
            </div>

            {/* Active Users */}
            <div className="card-functional p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-accent-gray mb-1">{zhCN.admin.activeUsers}</p>
                  <p className="text-3xl font-bold text-primary-black">{data.active_users}</p>
                </div>
                <div className="text-5xl">👥</div>
              </div>
            </div>
          </div>

          {/* Quarterly Statistics */}
          {data.quarterly_stats && data.quarterly_stats.length > 0 && (
            <div className="card-functional p-6">
              <h2 className="text-2xl font-bold text-primary-black mb-6">
                季度统计
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-primary-black">
                        季度
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-primary-black">
                        上传数量
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-primary-black">
                        存储空间
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.quarterly_stats.map((stat, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-primary-black">
                          {stat.quarter}
                        </td>
                        <td className="px-6 py-4 text-sm text-primary-black">{stat.uploads}</td>
                        <td className="px-6 py-4 text-sm text-primary-black">
                          {formatStorage(stat.storage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Visual Chart */}
          {data.quarterly_stats && data.quarterly_stats.length > 0 && (
            <div className="card-functional p-6">
              <h2 className="text-2xl font-bold text-primary-black mb-6">
                上传趋势
              </h2>

              <div className="space-y-4">
                {data.quarterly_stats.map((stat, index) => {
                  const maxUploads = Math.max(...data.quarterly_stats.map((s) => s.uploads));
                  const percentage = maxUploads > 0 ? (stat.uploads / maxUploads) * 100 : 0;

                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-primary-black">{stat.quarter}</span>
                        <span className="text-accent-gray">{stat.uploads} 次上传</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-accent-green h-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${percentage}%` }}
                        >
                          {percentage > 15 && (
                            <span className="text-xs font-medium text-primary-white">
                              {percentage.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Storage Chart */}
          {data.quarterly_stats && data.quarterly_stats.length > 0 && (
            <div className="card-functional p-6">
              <h2 className="text-2xl font-bold text-primary-black mb-6">
                存储增长
              </h2>

              <div className="space-y-4">
                {data.quarterly_stats.map((stat, index) => {
                  const maxStorage = Math.max(...data.quarterly_stats.map((s) => s.storage));
                  const percentage = maxStorage > 0 ? (stat.storage / maxStorage) * 100 : 0;

                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-primary-black">{stat.quarter}</span>
                        <span className="text-accent-gray">{formatStorage(stat.storage)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-accent-blue h-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${percentage}%` }}
                        >
                          {percentage > 15 && (
                            <span className="text-xs font-medium text-primary-white">
                              {percentage.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card-functional p-8 text-center">
          <p className="text-accent-gray">暂无统计数据</p>
        </div>
      )}
    </div>
  );
}
