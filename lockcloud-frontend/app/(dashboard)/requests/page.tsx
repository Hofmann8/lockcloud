'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReceivedRequests, getSentRequests, approveRequest, rejectRequest, FileRequestData } from '@/lib/api/requests';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import toast from 'react-hot-toast';

type TabType = 'received' | 'sent';
type StatusFilter = '' | 'pending' | 'approved' | 'rejected';

function RequestCard({ 
  request, 
  isReceived,
  onApprove,
  onReject,
  isProcessing,
}: { 
  request: FileRequestData;
  isReceived: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  isProcessing?: boolean;
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const statusLabels = {
    pending: '待处理',
    approved: '已批准',
    rejected: '已拒绝',
  };

  const typeLabels = {
    delete: '删除请求',
    edit: '编辑请求',
    directory_edit: '目录编辑',
  };

  const typeColors = {
    delete: 'bg-red-50 text-red-600',
    edit: 'bg-blue-50 text-blue-600',
    directory_edit: 'bg-purple-50 text-purple-600',
  };

  // Get display name for the request target
  const getTargetName = () => {
    if (request.request_type === 'directory_edit' && request.directory_info) {
      return `📁 ${request.directory_info.activity_name}`;
    }
    return request.file?.filename || '文件已删除';
  };

  return (
    <Card variant="bordered" padding="md" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeColors[request.request_type]}`}>
              {typeLabels[request.request_type]}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[request.status]}`}>
              {statusLabels[request.status]}
            </span>
          </div>
          <p className="mt-2 font-medium text-sm text-primary-black truncate">
            {getTargetName()}
          </p>
          {request.request_type === 'directory_edit' && request.directory_info && (
            <p className="text-xs text-accent-gray mt-0.5">
              {request.directory_info.activity_date} · {request.directory_info.activity_type}
            </p>
          )}
          <p className="text-xs text-accent-gray mt-1">
            {isReceived ? `来自: ${request.requester?.name}` : `发送给: ${request.owner?.name}`}
            <span className="mx-2">·</span>
            {formatDate(request.created_at)}
          </p>
        </div>
      </div>

      {/* Proposed changes for edit requests */}
      {request.request_type === 'edit' && request.proposed_changes && (
        <div className="text-xs bg-gray-50 rounded-lg p-2 space-y-1">
          <p className="font-medium text-accent-gray">修改内容:</p>
          {request.proposed_changes.filename && (
            <p>文件名: {request.proposed_changes.filename}</p>
          )}
          {request.proposed_changes.activity_date && (
            <p>活动日期: {request.proposed_changes.activity_date}</p>
          )}
          {request.proposed_changes.activity_type && (
            <p>活动类型: {request.proposed_changes.activity_type}</p>
          )}
          {request.proposed_changes.activity_name && (
            <p>活动名称: {request.proposed_changes.activity_name}</p>
          )}
          {request.proposed_changes.instructor && (
            <p>带训老师: {request.proposed_changes.instructor}</p>
          )}
          {request.proposed_changes.free_tags && request.proposed_changes.free_tags.length > 0 && (
            <p>标签: {request.proposed_changes.free_tags.join(', ')}</p>
          )}
        </div>
      )}

      {/* Proposed changes for directory edit requests */}
      {request.request_type === 'directory_edit' && request.proposed_changes && (
        <div className="text-xs bg-gray-50 rounded-lg p-2 space-y-1">
          <p className="font-medium text-accent-gray">修改内容:</p>
          {request.proposed_changes.new_activity_name && (
            <p>新活动名称: {request.proposed_changes.new_activity_name}</p>
          )}
          {request.proposed_changes.new_activity_type && (
            <p>新活动类型: {request.proposed_changes.new_activity_type}</p>
          )}
        </div>
      )}

      {/* Message */}
      {request.message && (
        <p className="text-xs text-accent-gray bg-gray-50 rounded-lg p-2">
          留言: {request.message}
        </p>
      )}

      {/* Response message */}
      {request.response_message && (
        <p className="text-xs text-accent-gray bg-gray-50 rounded-lg p-2">
          回复: {request.response_message}
        </p>
      )}

      {/* Actions for pending received requests */}
      {isReceived && request.status === 'pending' && onApprove && onReject && (
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onApprove(request.id)}
            disabled={isProcessing}
            className="flex-1"
          >
            批准
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onReject(request.id)}
            disabled={isProcessing}
            className="flex-1"
          >
            拒绝
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('received');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  const { data: receivedRequests, isLoading: loadingReceived } = useQuery({
    queryKey: ['requests', 'received', statusFilter],
    queryFn: () => getReceivedRequests(statusFilter || undefined),
    enabled: activeTab === 'received',
  });

  const { data: sentRequests, isLoading: loadingSent } = useQuery({
    queryKey: ['requests', 'sent', statusFilter],
    queryFn: () => getSentRequests(statusFilter || undefined),
    enabled: activeTab === 'sent',
  });

  const invalidateAllRelatedQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['requests'] });
    queryClient.invalidateQueries({ queryKey: ['files'] });
    queryClient.invalidateQueries({ queryKey: ['directories'] });
    queryClient.invalidateQueries({ queryKey: ['activity-directory'] });
  };

  const approveMutation = useMutation({
    mutationFn: (requestId: number) => approveRequest(requestId),
    onSuccess: () => {
      toast.success('请求已批准');
      invalidateAllRelatedQueries();
    },
    onError: () => toast.error('操作失败'),
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: number) => rejectRequest(requestId),
    onSuccess: () => {
      toast.success('请求已拒绝');
      invalidateAllRelatedQueries();
    },
    onError: () => toast.error('操作失败'),
  });

  const isLoading = activeTab === 'received' ? loadingReceived : loadingSent;
  const requests = activeTab === 'received' ? receivedRequests : sentRequests;
  const isProcessing = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary-black">请求管理</h1>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('received')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'received'
              ? 'border-orange-500 text-orange-500'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          收到的请求
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sent'
              ? 'border-orange-500 text-orange-500'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          发出的请求
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-accent-gray">状态:</span>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {[
            { value: '' as StatusFilter, label: '全部' },
            { value: 'pending' as StatusFilter, label: '待处理' },
            { value: 'approved' as StatusFilter, label: '已批准' },
            { value: 'rejected' as StatusFilter, label: '已拒绝' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === value
                  ? 'bg-white shadow-sm text-black'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!requests || requests.length === 0) && (
        <Card variant="bordered" padding="lg">
          <p className="text-center text-accent-gray">暂无请求</p>
        </Card>
      )}

      {/* Request List */}
      {!isLoading && requests && requests.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {requests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              isReceived={activeTab === 'received'}
              onApprove={activeTab === 'received' ? (id) => approveMutation.mutate(id) : undefined}
              onReject={activeTab === 'received' ? (id) => rejectMutation.mutate(id) : undefined}
              isProcessing={isProcessing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
