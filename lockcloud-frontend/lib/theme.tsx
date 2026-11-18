'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  /** origin 传点击位置时，新主题会从这个点圆形扩散开 */
  setTheme: (theme: Theme, origin?: { x: number; y: number }) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_KEY = 'lockcloud-theme';

// 默认亮色；只有用户选了"跟随系统"才看系统
const DEFAULT_THEME: Theme = 'light';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : DEFAULT_THEME;
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

/** 放进 <head> 的脚本：首帧前就把 class 定好，避免闪白 / 闪黑 */
export const themeBootstrap = `
(function() {
  try {
    var t = localStorage.getItem('${THEME_KEY}');
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.add(dark ? 'dark' : 'light');
  } catch (e) {}
})();
`;

type DocumentWithTransition = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    const t = getStoredTheme();
    return t === 'system' ? getSystemTheme() : t;
  });

  useEffect(() => {
    applyTheme(resolvedTheme);
    // 只在挂载时同步一次；之后由 setTheme / 系统变化负责
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const next = getSystemTheme();
      setResolvedTheme(next);
      applyTheme(next);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme, origin?: { x: number; y: number }) => {
    const resolved = next === 'system' ? getSystemTheme() : next;
    localStorage.setItem(THEME_KEY, next);
    setThemeState(next);

    const doc = document as DocumentWithTransition;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const changesLook = !document.documentElement.classList.contains(resolved);

    if (!origin || !doc.startViewTransition || reduceMotion || !changesLook) {
      setResolvedTheme(resolved);
      applyTheme(resolved);
      return;
    }

    const radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    );
    const transition = doc.startViewTransition(() => {
      setResolvedTheme(resolved);
      applyTheme(resolved);
    });
    void transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: 520,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
