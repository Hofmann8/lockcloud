/**
 * Error message utilities for consistent error handling across the application
 */

export interface ApiErrorResponse {
  response?: {
    data?: {
      error?: {
        message?: string;
        code?: string;
      };
    };
    status?: number;
  };
  message?: string;
}

/**
 * Extract error message from API error response
 */
export function getErrorMessage(error: unknown, fallback: string = '操作失败，请重试'): string {
  if (!error) return fallback;

  // Handle API error response
  if (typeof error === 'object' && 'response' in error) {
    const apiError = error as ApiErrorResponse;
    const errorMessage = apiError.response?.data?.error?.message;
    if (errorMessage) return errorMessage;

    // Handle HTTP status codes
    const status = apiError.response?.status;
    if (status === 401) return '未授权，请重新登录';
    if (status === 403) return '没有权限执行此操作';
    if (status === 404) return '请求的资源不存在';
    if (status === 500) return '服务器错误，请稍后重试';
    if (status === 503) return '服务暂时不可用，请稍后重试';
  }

  // Handle Error object
  if (error instanceof Error) {
    return error.message || fallback;
  }

  // Handle string error
  if (typeof error === 'string') {
    return error;
  }

  return fallback;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: Record<string, string[]>): string {
  const messages = Object.entries(errors)
    .map(([field, fieldErrors]) => {
      const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
      return `${fieldName}: ${fieldErrors.join(', ')}`;
    })
    .join('\n');
  
  return messages || '验证失败';
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('fetch');
  }
  return false;
}

/**
 * Get user-friendly error title based on error type
 */
export function getErrorTitle(error: unknown): string {
  if (isNetworkError(error)) {
    return '网络连接失败';
  }

  if (typeof error === 'object' && error && 'response' in error) {
    const apiError = error as ApiErrorResponse;
    const status = apiError.response?.status;
    
    if (status === 401) return '认证失败';
    if (status === 403) return '权限不足';
    if (status === 404) return '资源未找到';
    if (status === 500) return '服务器错误';
  }

  return '操作失败';
}
