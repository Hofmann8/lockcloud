'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

/**
 * 开发环境快速登录页面
 * 
 * 访问 /auth/dev-login 自动登录测试账号
 * 
 * 关闭方法：删除此文件，或在生产构建时排除
 */
export default function DevLoginPage() {
  const router = useRouter();
  const { setUser, setToken, isAuthenticated } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/files');
      return;
    }

    const doDevLogin = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const response = await fetch(`${apiUrl}/api/auth/dev/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'dev@localhost.com', name: 'Dev User' }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || '开发登录失败');
        }

        setToken(data.token);
        setUser(data.user);

        if (typeof window !== 'undefined') {
          localStorage.setItem('lockcloud_token', data.token);
        }

        setStatus('success');
        setTimeout(() => router.push('/files'), 500);
      } catch (err: unknown) {
        setStatus('error');
        setErrorMessage((err as Error).message || '登录失败');
      }
    };

    doDevLogin();
  }, [isAuthenticated, router, setToken, setUser]);

  return (
    <div className="space-y-6 text-center">
      {status === 'loading' && (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-black mx-auto"></div>
          <p className="text-accent-gray">[开发模式] 正在自动登录...</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-4xl">✓</div>
          <p className="text-green-600 font-medium">登录成功，正在跳转...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-4xl text-red-500">✗</div>
          <p className="text-red-500 font-medium">开发登录失败</p>
          <p className="text-accent-gray text-sm">{errorMessage}</p>
          <p className="text-xs text-gray-400 mt-4">
            确保后端 .env 中设置了 DEV_LOGIN_ENABLED=true
          </p>
          <button
            onClick={() => router.push('/auth/login')}
            className="mt-4 px-4 py-2 bg-primary-black text-white rounded hover:bg-gray-800"
          >
            返回登录
          </button>
        </>
      )}
    </div>
  );
}
