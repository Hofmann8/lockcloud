'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { MobileMenuButton } from '@/components/MobileMenuButton';

export default function AdminPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.is_admin !== true) {
      router.push('/files');
    }
  }, [user, router]);

  // Don't render if not admin
  if (user?.is_admin !== true) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <MobileMenuButton />
          <h1 className="text-3xl font-bold text-primary-black">管理中心</h1>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={() => router.push('/admin/stats')}
          className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">文件统计</h3>
              <p className="text-sm text-gray-600">查看文件使用情况</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => router.push('/admin/tag-presets')}
          className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">标签预设</h3>
              <p className="text-sm text-gray-600">管理活动类型和带训老师</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => router.push('/admin/logs')}
          className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">操作日志</h3>
              <p className="text-sm text-gray-600">查看系统操作记录</p>
            </div>
          </div>
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-medium text-blue-900">用户管理已迁移</h3>
            <p className="text-sm text-blue-700 mt-1">
              用户账号管理现已统一由 Funk & Love Auth 服务处理，请前往{' '}
              <a 
                href="https://auth.funk-and.love/admin" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                统一认证管理后台
              </a>
              {' '}进行用户管理操作。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
