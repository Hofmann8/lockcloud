'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PauseMark } from '@/components/brand/PauseMark';
import { LuckyLocker } from '@/components/brand/LuckyLocker';
import { ButtonLink } from '@/components/ui/Button';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';
import { NEXT_KEY } from '@/lib/routes';
import { useAuthStore } from '@/stores/authStore';

function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const signIn = useAuthStore((s) => s.signIn);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const started = useRef(false);
  const token = params.get('token');
  const error = params.get('error') || (!token ? '登录信息缺失，请重新登录' : failed);

  useEffect(() => {
    if (started.current || !token || params.get('error')) return;
    started.current = true;
    authApi
      .ssoLogin(token)
      .then((res) => {
        signIn(res.token, res.user);
        setDone(true);
        const next = sessionStorage.getItem(NEXT_KEY);
        sessionStorage.removeItem(NEXT_KEY);
        window.setTimeout(() => router.replace(next?.startsWith('/') ? next : '/'), 380);
      })
      .catch((e) => setFailed(errorMessage(e, '登录失败')));
  }, [params, token, router, signIn]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center animate-fade">
        <LuckyLocker size={120} />
        <p className="mt-4 text-[15px] font-medium text-fg">登录失败</p>
        <p className="mt-1.5 max-w-sm text-[13px] text-fg-faint">{error}</p>
        <ButtonLink href="/auth/login" variant="primary" className="mt-6">
          重新登录
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3" role="status">
      <PauseMark size={36} state={done ? 'done' : 'busy'} />
      <p className="text-[13px] text-fg-faint">{done ? '已登录' : '正在登录…'}</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}
