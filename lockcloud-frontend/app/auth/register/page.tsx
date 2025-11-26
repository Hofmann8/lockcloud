'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { zhCN } from '@/locales/zh-CN';
import { useAuthStore } from '@/stores/authStore';
import { getSSOConfig } from '@/lib/api/auth';
import Link from 'next/link';

/**
 * SSO Register Page
 * Redirects user to Funk & Love Auth Service for registration
 */
export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [ssoUrl, setSsoUrl] = useState<string | null>(null);

  // If already authenticated, redirect to files
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/files');
    }
  }, [isAuthenticated, router]);

  // Fetch SSO config on mount
  useEffect(() => {
    const fetchSSOConfig = async () => {
      try {
        const config = await getSSOConfig();
        // Use register URL instead of login
        setSsoUrl(config.sso_frontend_url);
      } catch (error) {
        console.error('Failed to fetch SSO config:', error);
        setSsoUrl('https://auth.funk-and.love');
      }
    };
    fetchSSOConfig();
  }, []);

  const handleSSORegister = () => {
    setIsLoading(true);
    
    // Build redirect URI for SSO callback
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/auth/callback`
    );
    
    // Redirect to SSO register page
    const registerUrl = ssoUrl || 'https://auth.funk-and.love';
    window.location.href = `${registerUrl}/register?redirect_uri=${redirectUri}`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary-black mb-2">
          {zhCN.auth.register}
        </h1>
        <p className="text-accent-gray">
          创建 Funk & Love 统一账号
        </p>
      </div>

      <div className="space-y-4">
        <Button
          type="button"
          variant="primary"
          className="w-full"
          onClick={handleSSORegister}
          disabled={isLoading || !ssoUrl}
        >
          {isLoading ? zhCN.common.loading : '前往注册 Funk & Love 账号'}
        </Button>

        <p className="text-center text-sm text-accent-gray">
          点击上方按钮将跳转到统一认证服务进行注册
        </p>
      </div>

      <div className="text-center text-sm">
        <span className="text-accent-gray">已有账号？</span>
        {' '}
        <Link
          href="/auth/login"
          className="text-accent-blue hover:underline font-medium"
        >
          {zhCN.auth.login}
        </Link>
      </div>
    </div>
  );
}
