import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

const DEFAULT_DEV_API_URL = 'http://localhost:5000';
const DEFAULT_PROD_API_URL = 'https://cloud.funk-and.love';

export function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const base = configured || (process.env.NODE_ENV === 'production' ? DEFAULT_PROD_API_URL : DEFAULT_DEV_API_URL);
  return base.replace(/\/+$/, '');
}

export const TOKEN_KEY = 'lockcloud_token';
export const USER_KEY = 'lockcloud_user';

/** 后端统一的错误：{error: {code, message, ...}}。message 是中文，直接给人看 */
export class ApiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;

  constructor(code: string, message: string, status = 0, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function errorMessage(error: unknown, fallback = '出现问题，请重试'): string {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export const api = axios.create({
  baseURL: apiBaseUrl(),
  timeout: 0,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let redirecting = false;

/** 登录失效：清掉本地登录态，带着当前地址去登录页 */
export function goLogin() {
  if (typeof window === 'undefined' || redirecting) return;
  redirecting = true;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('lockcloud-auth');
  const here = window.location.pathname + window.location.search;
  const next = here.startsWith('/auth') ? '' : `?next=${encodeURIComponent(here)}`;
  window.location.replace(`/auth/login${next}`);
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { code?: string; message?: string } } & Record<string, unknown>>) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const res = error.response;
    if (!res) {
      return Promise.reject(new ApiError('NETWORK_ERROR', '无法连接服务器，请检查网络', 0));
    }
    const body = res.data?.error ?? (res.data as { code?: string; message?: string } | undefined) ?? {};
    const code = body.code || `HTTP_${res.status}`;
    if (res.status === 401 && !error.config?.url?.includes('/auth/sso/')) {
      goLogin();
    }
    const fallback =
      res.status === 403 ? '没有权限' :
      res.status === 404 ? '内容不存在或已被删除' :
      res.status === 429 ? '操作过于频繁，请稍后再试' :
      res.status >= 500 ? '服务器错误，请稍后再试' : '请求失败';
    return Promise.reject(new ApiError(code, body.message || fallback, res.status, body as Record<string, unknown>));
  },
);

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return (await api.get<T>(url, config)).data;
}

export async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return (await api.post<T>(url, data, config)).data;
}

export async function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return (await api.patch<T>(url, data, config)).data;
}

export async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return (await api.put<T>(url, data, config)).data;
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return (await api.delete<T>(url, config)).data;
}
