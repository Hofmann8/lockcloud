'use client';

import { useEffect } from 'react';

// 历史遗留的 Service Worker(sw.js)在用户浏览器里持久存在,
// 即使当前代码已不再注册它,旧 SW 仍会拦截请求 / 报 cache.put POST 错。
// 这个组件挂在 RootLayout,每次访问主动卸载所有 SW 并清空 caches。
// 全量用户清理后可移除此组件。
export function UnregisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          if (registrations.length === 0) return;
          registrations.forEach((registration) => {
            registration.unregister().then((success) => {
              if (success) {
                console.info('[SW] Unregistered legacy service worker:', registration.scope);
              }
            });
          });
        })
        .catch(() => {});
    }

    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => {
          keys.forEach((key) => {
            caches.delete(key).then((deleted) => {
              if (deleted) console.info('[SW] Deleted legacy cache:', key);
            });
          });
        })
        .catch(() => {});
    }
  }, []);

  return null;
}
