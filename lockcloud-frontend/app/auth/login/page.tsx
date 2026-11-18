'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { PauseMark, Wordmark } from '@/components/brand/PauseMark';
import { FilmStrip } from '@/components/brand/LuckyLocker';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/lib/api/auth';
import { TOKEN_KEY } from '@/lib/api/client';
import { NEXT_KEY } from '@/lib/routes';

const FALLBACK_SSO = 'https://auth.funk-and.love';

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [leaving, setLeaving] = useState(false);
  const config = useQuery({
    queryKey: ['sso-config'],
    queryFn: authApi.ssoConfig,
    meta: { silent: true },
    retry: false,
  });

  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) router.replace(params.get('next') || '/');
  }, [router, params]);

  const ssoBase = config.data?.sso_login_url || (config.isError ? FALLBACK_SSO : null);

  const login = () => {
    if (!ssoBase) return;
    setLeaving(true);
    const next = params.get('next');
    if (next?.startsWith('/')) sessionStorage.setItem(NEXT_KEY, next);
    else sessionStorage.removeItem(NEXT_KEY);
    const redirect = encodeURIComponent(`${window.location.origin}/auth/callback`);
    window.location.assign(new URL(`?redirect_uri=${redirect}`, ssoBase).toString());
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-6 sm:px-10">
        <span className="flex items-center gap-2.5">
          <PauseMark size={26} />
          <Wordmark />
        </span>
      </header>

      <main className="flex flex-1 flex-col justify-center px-6 pb-10 sm:px-10">
        <div className="mx-auto w-full max-w-5xl animate-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-faint">Funk &amp; Love · 影像档案</p>
          <h1 className="mt-4 font-serif text-[clamp(2.1rem,5.4vw,3.6rem)] font-semibold leading-[1.18] tracking-tight text-fg">
            每一个定格，
            <br />
            都在这里。
          </h1>
          <p className="mt-5 max-w-lg text-pretty text-[15px] leading-relaxed text-fg-soft">
            训练、比赛与团建的照片和视频，集中收藏，随时找到。
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button
              variant="primary"
              size="lg"
              onClick={login}
              loading={leaving}
              disabled={!ssoBase}
              icon={leaving ? undefined : <ArrowRight className="order-last h-4 w-4" />}
            >
              使用 Funk &amp; Love 账号登录
            </Button>
            <a
              href={`${ssoBase || FALLBACK_SSO}/register`}
              className="text-[13px] text-fg-faint underline-offset-4 transition-colors hover:text-fg-soft hover:underline"
            >
              没有账号？立即注册
            </a>
          </div>
        </div>
      </main>

      <FilmStrip className="opacity-95" />

      <footer className="flex h-12 items-center px-6 text-[11px] text-fg-faint sm:px-10">
        浙江大学 DFM 街舞社 · Funk &amp; Love
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
