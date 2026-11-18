import { get, post } from './client';
import type { User } from './types';

interface TokenResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export const authApi = {
  ssoConfig: () =>
    get<{ sso_login_url: string; sso_frontend_url: string }>('/api/auth/sso/config'),

  /** LockAuth 回跳带来的 token 换成本站的 token */
  ssoLogin: (token: string) => post<TokenResponse>('/api/auth/sso/login', { token }),

  /** 本地开发用：后端开了 dev 登录时才有 */
  devLogin: (email: string, name: string) => post<TokenResponse>('/api/auth/dev/login', { email, name }),

  refresh: () => post<TokenResponse>('/api/auth/refresh'),

  me: async () => (await get<{ user: User }>('/api/auth/me')).user,
};
