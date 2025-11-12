'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import * as adminApi from '@/lib/api/admin';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'users' | 'blacklist'>('users');
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [blacklistEmail, setBlacklistEmail] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [isAddingToBlacklist, setIsAddingToBlacklist] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.is_admin !== true) {
      router.push('/files');
    }
  }, [user, router]);

  // Fetch users
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers(),
    enabled: user?.is_admin === true,
  });

  // Fetch blacklist
  const { data: blacklistData, isLoading: loadingBlacklist } = useQuery({
    queryKey: ['admin', 'blacklist'],
    queryFn: () => adminApi.getBlacklist(),
    enabled: user?.is_admin === true,
  });

  // Don't render if not admin
  if (user?.is_admin !== true) {
    return null;
  }

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`确定要删除用户 "${userName}" 吗？此操作不可恢复。`)) {
      return;
    }

    setDeletingUserId(userId);
    try {
      await adminApi.deleteUser(userId);
      toast.success('用户删除成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (error) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err?.response?.data?.error?.message || '删除用户失败');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleAddToBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!blacklistEmail.trim()) {
      toast.error('请输入邮箱地址');
      return;
    }

    setIsAddingToBlacklist(true);
    try {
      await adminApi.addToBlacklist({
        email: blacklistEmail.trim(),
        reason: blacklistReason.trim() || undefined,
      });
      toast.success('已添加到黑名单');
      setBlacklistEmail('');
      setBlacklistReason('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (error) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err?.response?.data?.error?.message || '添加黑名单失败');
    } finally {
      setIsAddingToBlacklist(false);
    }
  };

  const handleRemoveFromBlacklist = async (id: number, email: string) => {
    if (!confirm(`确定要将 "${email}" 从黑名单移除吗？`)) {
      return;
    }

    try {
      await adminApi.removeFromBlacklist(id);
      toast.success('已从黑名单移除');
      queryClient.invalidateQueries({ queryKey: ['admin', 'blacklist'] });
    } catch (error) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err?.response?.data?.error?.message || '移除失败');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary-black">管理中心</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-accent-gray/20">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-accent-green border-b-2 border-accent-green'
              : 'text-accent-gray hover:text-primary-black'
          }`}
        >
          用户管理
        </button>
        <button
          onClick={() => setActiveTab('blacklist')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'blacklist'
              ? 'text-accent-green border-b-2 border-accent-green'
              : 'text-accent-gray hover:text-primary-black'
          }`}
        >
          邮箱黑名单
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <Card>
          {loadingUsers ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-green border-t-transparent mx-auto"></div>
              <p className="text-sm text-accent-gray mt-3">加载中...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-accent-gray/20">
                    <th className="text-left py-3 px-4 font-semibold text-primary-black">ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-primary-black">邮箱</th>
                    <th className="text-left py-3 px-4 font-semibold text-primary-black">姓名</th>
                    <th className="text-left py-3 px-4 font-semibold text-primary-black">角色</th>
                    <th className="text-left py-3 px-4 font-semibold text-primary-black">状态</th>
                    <th className="text-left py-3 px-4 font-semibold text-primary-black">注册时间</th>
                    <th className="text-right py-3 px-4 font-semibold text-primary-black">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData?.users.map((u) => (
                    <tr key={u.id} className="border-b border-accent-gray/10 hover:bg-accent-gray/5">
                      <td className="py-3 px-4 text-sm">{u.id}</td>
                      <td className="py-3 px-4 text-sm">{u.email}</td>
                      <td className="py-3 px-4 text-sm font-medium">{u.name}</td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-accent-orange/20 text-accent-orange'
                              : 'bg-accent-gray/20 text-accent-gray'
                          }`}
                        >
                          {u.role === 'admin' ? '管理员' : '用户'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            u.is_active
                              ? 'bg-accent-green/20 text-accent-green'
                              : 'bg-semantic-error/20 text-semantic-error'
                          }`}
                        >
                          {u.is_active ? '正常' : '已禁用'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-accent-gray">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {u.id !== user?.id && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            disabled={deletingUserId === u.id}
                          >
                            {deletingUserId === u.id ? '删除中...' : '删除'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Blacklist Tab */}
      {activeTab === 'blacklist' && (
        <div className="space-y-6">
          {/* Add to Blacklist Form */}
          <Card>
            <h2 className="text-lg font-semibold text-primary-black mb-4">添加到黑名单</h2>
            <form onSubmit={handleAddToBlacklist} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-black mb-2">
                  邮箱地址 <span className="text-semantic-error">*</span>
                </label>
                <input
                  type="email"
                  value={blacklistEmail}
                  onChange={(e) => setBlacklistEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-accent-gray/30 rounded-lg focus:outline-none focus:border-accent-green focus:ring-2 focus:ring-accent-green/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-black mb-2">
                  原因（可选）
                </label>
                <textarea
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  placeholder="封禁原因..."
                  rows={3}
                  className="w-full px-3 py-2 border border-accent-gray/30 rounded-lg focus:outline-none focus:border-accent-green focus:ring-2 focus:ring-accent-green/20"
                />
              </div>
              <Button
                type="submit"
                variant="danger"
                disabled={isAddingToBlacklist}
                loading={isAddingToBlacklist}
              >
                添加到黑名单
              </Button>
            </form>
          </Card>

          {/* Blacklist Table */}
          <Card>
            <h2 className="text-lg font-semibold text-primary-black mb-4">黑名单列表</h2>
            {loadingBlacklist ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-green border-t-transparent mx-auto"></div>
                <p className="text-sm text-accent-gray mt-3">加载中...</p>
              </div>
            ) : blacklistData?.blacklist.length === 0 ? (
              <p className="text-center text-accent-gray py-8">暂无黑名单记录</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-accent-gray/20">
                      <th className="text-left py-3 px-4 font-semibold text-primary-black">邮箱</th>
                      <th className="text-left py-3 px-4 font-semibold text-primary-black">原因</th>
                      <th className="text-left py-3 px-4 font-semibold text-primary-black">操作人</th>
                      <th className="text-left py-3 px-4 font-semibold text-primary-black">封禁时间</th>
                      <th className="text-right py-3 px-4 font-semibold text-primary-black">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blacklistData?.blacklist.map((entry) => (
                      <tr key={entry.id} className="border-b border-accent-gray/10 hover:bg-accent-gray/5">
                        <td className="py-3 px-4 text-sm font-medium">{entry.email}</td>
                        <td className="py-3 px-4 text-sm text-accent-gray">
                          {entry.reason || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm">{entry.blocker_name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-accent-gray">
                          {formatDate(entry.blocked_at)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRemoveFromBlacklist(entry.id, entry.email)}
                          >
                            移除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
