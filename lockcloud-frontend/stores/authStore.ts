import { create } from 'zustand';
import { authApi } from '@/lib/api/auth';
import { ApiError, TOKEN_KEY, USER_KEY } from '@/lib/api/client';
import type { User } from '@/lib/api/types';

interface AuthState {
  user: User | null;
  token: string | null;
  /** 首次读本地登录态之前是 false，避免一进来就被踢去登录页 */
  ready: boolean;
  initialize: () => Promise<void>;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
}

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw) as User;
    // 旧版前端用 zustand persist 存在 lockcloud-auth 里
    const legacy = localStorage.getItem('lockcloud-auth');
    return legacy ? (JSON.parse(legacy).state?.user ?? null) : null;
  } catch {
    return null;
  }
}

let initializing: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  ready: false,

  initialize: () => {
    if (initializing) return initializing;
    initializing = (async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const cached = readUser();
      if (!token) {
        set({ ready: true, token: null, user: null });
        return;
      }
      // 有缓存的用户信息就先放进去，后台再核对一次
      set({ token, user: cached, ready: !!cached });
      try {
        const user = await authApi.me();
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        set({ user, ready: true });
      } catch (error) {
        // 401 由 client 统一跳登录；网络问题时保留缓存的登录态
        if (error instanceof ApiError && error.status === 401) get().signOut();
        set({ ready: true });
      }
    })();
    return initializing;
  },

  signIn: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.removeItem('lockcloud-auth');
    set({ token, user, ready: true });
  },

  signOut: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('lockcloud-auth');
    initializing = null;
    set({ token: null, user: null });
  },
}));

export const useUser = () => useAuthStore((s) => s.user);
export const useIsAdmin = () => useAuthStore((s) => !!s.user?.is_admin);
