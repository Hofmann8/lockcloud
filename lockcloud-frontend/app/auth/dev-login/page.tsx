'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PauseMark } from '@/components/brand/PauseMark';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';

/** 本地开发用：后端开了 dev 登录（非生产环境）时，直接用测试账号进来 */
export default function DevLoginPage() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    authApi
      .devLogin('dev@localhost.com', 'Dev User')
      .then((res) => {
        signIn(res.token, res.user);
        router.replace('/');
      })
      .catch((e) => setError(errorMessage(e, '开发登录未开启')));
  }, [router, signIn]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3" role="status">
      <PauseMark size={36} state={error ? 'idle' : 'busy'} />
      <p className="text-[13px] text-fg-faint">{error ?? '正在登录…'}</p>
    </div>
  );
}
