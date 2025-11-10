import { AxiosError } from 'axios'
import { showToast, toastMessages } from './toast'
import { ApiError } from '@/types'

/**
 * Handle API errors and show appropriate toast messages
 */
export function handleApiError(error: unknown): void {
  // Check if it's an Axios error
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>

    if (axiosError.response) {
      const { status, data } = axiosError.response

      // Handle 401 Unauthorized - token expired or invalid
      if (status === 401) {
        showToast.error(toastMessages.sessionExpired)
        
        // Clear auth data and redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lockcloud_token')
          localStorage.removeItem('lockcloud_user')
          
          // Delay redirect slightly to show toast
          setTimeout(() => {
            window.location.href = '/auth/login'
          }, 1000)
        }
        return
      }

      // Handle 403 Forbidden
      if (status === 403) {
        showToast.error(toastMessages.permissionDenied)
        return
      }

      // Handle 404 Not Found
      if (status === 404) {
        showToast.error(data?.message || '请求的资源不存在')
        return
      }

      // Handle 429 Too Many Requests
      if (status === 429) {
        showToast.error('请求过于频繁，请稍后再试')
        return
      }

      // Handle 500 Server Error
      if (status >= 500) {
        showToast.error('服务器错误，请稍后再试')
        return
      }

      // Handle other errors with message from backend
      if (data?.message) {
        showToast.error(data.message)
        return
      }
    } else if (axiosError.request) {
      // Network error - no response received
      showToast.error(toastMessages.networkError)
      return
    }
  }

  // Check if it's our custom ApiError format
  if (isApiError(error)) {
    const apiError = error as ApiError
    
    // Handle specific error codes
    switch (apiError.code) {
      case 'AUTH_001':
        showToast.error('用户名或密码错误')
        break
      case 'AUTH_002':
        showToast.error('邮箱必须是浙江大学邮箱 (@zju.edu.cn)')
        break
      case 'AUTH_003':
        showToast.error('验证码已过期')
        break
      case 'AUTH_004':
        showToast.error(toastMessages.sessionExpired)
        break
      case 'FILE_001':
        showToast.error('文件不存在')
        break
      case 'FILE_002':
        showToast.error('无权访问此文件')
        break
      case 'FILE_003':
        showToast.error('文件名格式不正确')
        break
      case 'FILE_004':
        showToast.error(toastMessages.uploadError)
        break
      case 'S3_001':
        showToast.error('存储服务错误')
        break
      case 'VALIDATION_001':
        showToast.error(toastMessages.invalidInput)
        break
      case 'NETWORK_ERROR':
        showToast.error(toastMessages.networkError)
        break
      default:
        showToast.error(apiError.message || toastMessages.unknownError)
    }
    return
  }

  // Handle generic errors
  if (error instanceof Error) {
    showToast.error(error.message || toastMessages.unknownError)
    return
  }

  // Fallback for unknown error types
  showToast.error(toastMessages.unknownError)
}

/**
 * Type guard to check if error is an Axios error
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  )
}

/**
 * Type guard to check if error is our ApiError format
 */
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  )
}

/**
 * Handle errors for specific operations with custom messages
 */
export const errorHandlers = {
  login: (error: unknown) => {
    handleApiError(error)
  },

  register: (error: unknown) => {
    handleApiError(error)
  },

  upload: (error: unknown) => {
    if (isApiError(error) && error.code === 'FILE_003') {
      // File naming error - already handled with specific message
      handleApiError(error)
    } else {
      // Generic upload error
      showToast.error(toastMessages.uploadError)
    }
  },

  delete: (error: unknown) => {
    if (isApiError(error) && error.code === 'FILE_002') {
      // Permission error - already handled
      handleApiError(error)
    } else {
      showToast.error(toastMessages.deleteError)
    }
  },

  fetch: (error: unknown) => {
    // Silent error for fetch operations, just log to console
    console.error('Fetch error:', error)
  },
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  errorHandler?: (error: unknown) => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      if (errorHandler) {
        errorHandler(error)
      } else {
        handleApiError(error)
      }
      throw error
    }
  }) as T
}
