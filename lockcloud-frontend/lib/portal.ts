'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}

function current(): HTMLElement {
  const el = document.fullscreenElement;
  return el instanceof HTMLElement && !(el instanceof HTMLVideoElement) ? el : document.body;
}

/**
 * 浮层（菜单、提示、通知）挂在哪。全屏时浏览器只画全屏元素里面的东西，
 * 挂在 body 上的看不见，所以全屏时挂到全屏元素里，平时挂 body。服务端渲染时是 null。
 */
export function usePortalRoot(): HTMLElement | null {
  return useSyncExternalStore(subscribe, current, () => null);
}
