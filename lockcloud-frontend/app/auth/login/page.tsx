'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { zhCN } from '@/locales/zh-CN';
import { useAuthStore } from '@/stores/authStore';
import { getSSOConfig } from '@/lib/api/auth';

/**
 * SSO Login Page
 * Redirects user to Funk & Love Auth Service for authentication
 */
export default function LoginPage() {
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
        setSsoUrl(config.sso_login_url);
      } catch (error) {
        console.error('Failed to fetch SSO config:', error);
        // Fallback to default SSO URL
        setSsoUrl('https://auth.funk-and.love/login');
      }
    };
    fetchSSOConfig();
  }, []);

  const handleSSOLogin = () => {
    setIsLoading(true);
    
    // Build redirect URI for SSO callback
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/auth/callback`
    );
    
    // Redirect to SSO login page
    const loginUrl = ssoUrl || 'https://auth.funk-and.love/login';
    window.location.href = `${loginUrl}?redirect_uri=${redirectUri}`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary-black mb-2">
          {zhCN.auth.login}
        </h1>
        <p className="text-accent-gray">
          欢迎回到 LockCloud
        </p>
      </div>

      <div className="space-y-4">
        <Button
          type="button"
          variant="primary"
          className="w-full"
          onClick={handleSSOLogin}
          disabled={isLoading || !ssoUrl}
        >
          {isLoading ? zhCN.common.loading : '使用 Funk & Love 账号登录'}
        </Button>

        <p className="text-center text-sm text-accent-gray">
          点击上方按钮将跳转到统一认证服务
        </p>
      </div>
    </div>
  );
}
