import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError } from '@/types';
import { showToast, toastMessages } from '@/lib/utils/toast';
import { getApiBaseUrl } from '@/lib/config/api';

// Allow per-request opt-out of the global toast. Caller still gets the rejection
// and is expected to handle it (e.g. SSO config has a fallback URL).
declare module 'axios' {
  export interface AxiosRequestConfig {
    silentError?: boolean;
  }
}

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 0, // No timeout - allow infinite wait for AI responses
  headers: {
    'Content-Type': 'application/json',
  },
});

// Module-level guard so parallel 401s don't each fire toast + redirect.
// Reset on next page load (full nav clears the module).
let isHandlingAuthFailure = false;

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('lockcloud_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<ApiError>) => {
    const silentError = error.config?.silentError === true;

    // Handle different error scenarios
    if (error.response) {
      const { status, data } = error.response;

      // Handle 401 Unauthorized - token expired or invalid.
      // Guard against parallel requests all firing toast + redirect.
      // 401 cleanup always runs even if silent (session integrity), but toast may be suppressed.
      if (status === 401) {
        if (!isHandlingAuthFailure) {
          isHandlingAuthFailure = true;
          if (!silentError) {
            showToast.error(toastMessages.sessionExpired, { id: 'session-expired' });
          }

          if (typeof window !== 'undefined') {
            localStorage.removeItem('lockcloud_token');
            localStorage.removeItem('lockcloud_user');
            // Also clear zustand persisted auth so stale token doesn't get re-hydrated.
            localStorage.removeItem('lockcloud-auth');

            setTimeout(() => {
              window.location.href = '/auth/login';
            }, 1000);
          }
        }

        return Promise.reject({
          code: 'AUTH_EXPIRED',
          message: toastMessages.sessionExpired,
          details: {},
        });
      }

      // Handle 403 Forbidden - don't redirect, let the page handle it
      if (status === 403 && !silentError) {
        showToast.error(toastMessages.permissionDenied, { id: 'permission-denied' });
      }

      // Handle network timeout
      if ((status === 408 || error.code === 'ECONNABORTED') && !silentError) {
        showToast.error('请求超时，请重试', { id: 'request-timeout' });
      }

      // 后端约定 body 是 { error: { code, message, ...其他字段 } };
      // 老代码退化读 data.* 不到位,这里两层都看一下,优先 data.error.*
      const errBody = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error
        || (data as { code?: string; message?: string; details?: unknown } | null)
        || {};
      return Promise.reject({
        code: errBody.code || 'UNKNOWN_ERROR',
        message: errBody.message || '发生未知错误',
        // details 留 entire body,这样像 NAME_CONFLICT 里 existing 这种附加字段能透出
        details: errBody,
      });
    } else if (error.request) {
      // Network error - no response received. Dedupe so parallel failures don't spam.
      if (!silentError) {
        showToast.error(toastMessages.networkError, { id: 'network-error' });
      }

      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: toastMessages.networkError,
        details: {},
      });
    } else {
      // Something else happened
      return Promise.reject({
        code: 'REQUEST_ERROR',
        message: error.message || '请求失败',
        details: {},
      });
    }
  }
);

export default apiClient;
