import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError } from '@/types';
import { showToast, toastMessages } from '@/lib/utils/toast';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  timeout: 0, // No timeout - allow infinite wait for AI responses
  headers: {
    'Content-Type': 'application/json',
  },
});

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
    // Handle different error scenarios
    if (error.response) {
      const { status, data } = error.response;

      // Handle 401 Unauthorized - token expired or invalid
      if (status === 401) {
        showToast.error(toastMessages.sessionExpired);
        
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lockcloud_token');
          localStorage.removeItem('lockcloud_user');
          
          // Delay redirect to show toast
          setTimeout(() => {
            window.location.href = '/auth/login';
          }, 1000);
        }
      }

      // Handle 403 Forbidden - don't redirect, let the page handle it
      if (status === 403) {
        showToast.error(toastMessages.permissionDenied);
        // Don't redirect, just return the error
      }

      // Handle network timeout
      if (status === 408 || error.code === 'ECONNABORTED') {
        showToast.error('请求超时，请重试');
      }

      // Return structured error
      return Promise.reject({
        code: data?.code || 'UNKNOWN_ERROR',
        message: data?.message || '发生未知错误',
        details: data?.details,
      });
    } else if (error.request) {
      // Network error - no response received
      showToast.error(toastMessages.networkError);
      
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
