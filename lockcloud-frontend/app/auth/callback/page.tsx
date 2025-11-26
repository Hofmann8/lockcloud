'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { ssoLogin } from '@/lib/api/auth';
import { toast } from 'react-hot-toast';

/**
 * SSO Callback Page
 * Handles the redirect from Funk & Love Auth Service
 * Verifies the SSO token and creates local session
 */
function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setToken } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      // Get token from URL params (sent by SSO service)
      const token = searchParams.get('token');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setErrorMessage(decodeURIComponent(error));
        toast.error('登录失败: ' + decodeURIComponent(error));
        return;
      }

      if (!token) {
        setStatus('error');
        setErrorMessage('未收到认证信息');
        toast.error('登录失败: 未收到认证信息');
        return;
      }

      try {
        // Verify SSO token with our backend and get local token
        const response = await ssoLogin(token);
        
        // Store auth data
        setToken(response.token);
        setUser(response.user);
        
        // Also store in localStorage for persistence
        if (typeof window !== 'undefined') {
          localStorage.setItem('lockcloud_token', response.token);
        }

        setStatus('success');
        toast.success('登录成功！');
        
        // Redirect to files page
        setTimeout(() => {
          router.push('/files');
        }, 500);
      } catch (err: unknown) {
        setStatus('error');
        const message = (err as { message?: string })?.message || '登录验证失败';
        setErrorMessage(message);
        toast.error(message);
      }
    };

    handleCallback();
  }, [searchParams, router, setUser, setToken]);

  return (
    <div className="space-y-6 text-center">
      {status === 'loading' && (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-black mx-auto"></div>
          <p className="text-accent-gray">正在验证登录信息...</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-4xl">✓</div>
          <p className="text-accent-green font-medium">登录成功，正在跳转...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-4xl text-red-500">✗</div>
          <p className="text-red-500 font-medium">登录失败</p>
          <p className="text-accent-gray text-sm">{errorMessage}</p>
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

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-black mx-auto"></div>
        <p className="text-accent-gray">正在验证登录信息...</p>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
