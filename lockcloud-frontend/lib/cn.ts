/** 拼接 className，忽略假值 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** 快捷键展示：Mac 显示 ⌘，其他显示 Ctrl */
export const modKey = () => (isMac() ? '⌘' : 'Ctrl');

/** 焦点在输入框里时不响应单键快捷键 */
export function isTyping(event: KeyboardEvent): boolean {
  const el = event.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
