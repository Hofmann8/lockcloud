'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLogs } from '@/lib/api/logs';
import { zhCN } from '@/locales/zh-CN';
import { TableSkeleton } from '@/components/SkeletonLoader';
import { Button } from '@/components/Button';
import { ErrorCard } from '@/components/ErrorCard';

function LogsPageContent() {
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    user_id: undefined as number | undefined,
    operation: undefined as 'upload' | 'delete' | 'access' | undefined,
    page: 1,
    per_page: 50,
  });

  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['logs', filters],
    queryFn: () => getLogs(filters),
    retry: false, // Don't retry on auth errors
  });

  // Check if error is permission denied
  const isPermissionError = error && (error as any).code === 'FORBIDDEN';

  const handleFilterChange = (key: string, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  const handleReset = () => {
    setFilters({
      start_date: '',
      end_date: '',
      user_id: undefined,
      operation: undefined,
      page: 1,
      per_page: 50,
    });
    setSearchTerm('');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const getOperationLabel = (operation: string): string => {
    switch (operation) {
      case 'upload':
        return '上传';
      case 'delete':
        return '删除';
      case 'access':
        return '访问';
      default:
        return operation;
    }
  };

  const getOperationColor = (operation: string): string => {
    switch (operation) {
      case 'upload':
        return 'text-accent-green';
      case 'delete':
        return 'text-semantic-error';
      case 'access':
        return 'text-accent-blue';
      default:
        return 'text-accent-gray';
    }
  };

  // Filter logs by search term
  const filteredLogs = data?.logs?.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.file_path.toLowerCase().includes(term) ||
      log.user?.name.toLowerCase().includes(term) ||
      log.user?.email.toLowerCase().includes(term) ||
      log.operation.toLowerCase().includes(term)
    );
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary-black">
          {zhCN.admin.logs}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = '/admin/stats'}
          >
            {zhCN.admin.stats}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card-functional p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-primary-black mb-2">
              {zhCN.filters.startDate}
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="input-functional w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-black mb-2">
              {zhCN.filters.endDate}
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="input-functional w-full px-3 py-2"
            />
          </div>

          {/* Operation Type */}
          <div>
            <label className="block text-sm font-medium text-primary-black mb-2">
              {zhCN.admin.operation}
            </label>
            <select
              value={filters.operation || ''}
              onChange={(e) =>
                handleFilterChange(
                  'operation',
                  e.target.value ? (e.target.value as 'upload' | 'delete' | 'access') : undefined
                )
              }
              className="input-functional w-full px-3 py-2"
            >
              <option value="">{zhCN.filters.all}</option>
              <option value="upload">上传</option>
              <option value="delete">删除</option>
              <option value="access">访问</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-primary-black mb-2">
              {zhCN.common.search}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索文件或用户..."
              className="input-functional w-full px-3 py-2"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleReset}>
            {zhCN.filters.reset}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {isPermissionError ? (
        <ErrorCard
          title="无权访问"
          message="您没有管理员权限，无法查看此页面。请联系管理员获取权限。"
          variant="warning"
        />
      ) : error ? (
        <ErrorCard
          title="加载日志失败"
          message={zhCN.errors.serverError}
          variant="error"
          action={{
            label: "重试",
            onClick: () => window.location.reload()
          }}
        />
      ) : null}

      {/* Logs Table */}
      {!error && !isPermissionError && (
        <div className="card-functional overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton rows={10} columns={5} />
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-primary-black">
                    {zhCN.admin.time}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-primary-black">
                    {zhCN.admin.user}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-primary-black">
                    {zhCN.admin.operation}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-primary-black">
                    {zhCN.admin.file}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-primary-black">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-primary-black whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-black">
                      <div>
                        <div className="font-medium">{log.user?.name || 'Unknown'}</div>
                        <div className="text-xs text-accent-gray">{log.user?.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`font-medium ${getOperationColor(log.operation)}`}>
                        {getOperationLabel(log.operation)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-black">
                      <div className="max-w-md truncate" title={log.file_path}>
                        {log.file_path}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-accent-gray whitespace-nowrap">
                      {log.ip_address}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-accent-gray">{searchTerm ? '未找到匹配的日志' : '暂无日志'}</p>
          </div>
        )}

        {/* Pagination Info */}
        {data && data.total > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center text-sm text-accent-gray">
              <span>
                共 {data.total} 条记录，第 {data.page} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleFilterChange('page', filters.page - 1)}
                  disabled={filters.page <= 1}
                >
                  {zhCN.common.previous}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleFilterChange('page', filters.page + 1)}
                  disabled={filters.page >= Math.ceil(data.total / filters.per_page)}
                >
                  {zhCN.common.next}
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}


export default function LogsPage() {
  return (
    <Suspense fallback={<div className="p-6"><TableSkeleton rows={10} columns={5} /></div>}>
      <LogsPageContent />
    </Suspense>
  );
}
