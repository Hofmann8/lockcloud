'use client';

import { useEffect, useState } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/theme';
import { Toaster, toast } from '@/components/ui/Toast';
import { ApiError, errorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { silent?: boolean };
    mutationMeta: { silent?: boolean };
  }
}

function report(error: unknown, silent?: boolean) {
  if (silent) return;
  // 401 已经在跳登录页了，不再提示
  if (error instanceof ApiError && error.status === 401) return;
  toast.error(errorMessage(error), { key: error instanceof ApiError ? error.code : undefined });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => report(error, query.meta?.silent),
        }),
        mutationCache: new MutationCache({
          onError: (error, _v, _c, mutation) => report(error, mutation.meta?.silent),
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );

  // 换了人就把缓存清掉
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [lastUser, setLastUser] = useState<number | null>(userId);
  if (userId !== lastUser) {
    setLastUser(userId);
    if (lastUser !== null) queryClient.clear();
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LegacyServiceWorkerCleanup />
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// 很早以前注册过 Service Worker，用户浏览器里可能还留着，会拦请求。每次打开主动卸掉。
function LegacyServiceWorkerCleanup() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);
  return null;
}
