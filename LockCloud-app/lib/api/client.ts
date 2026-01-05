/**
 * API Client
 * 
 * Axios-based HTTP client for communicating with the Flask backend.
 * Strictly follows the Web frontend implementation (lockcloud-frontend/lib/api/client.ts)
 * but uses expo-secure-store instead of localStorage for token storage.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 13.4
 */

import axios, { AxiosError, InternalAxiosRequestConfig, AxiosInstance } from 'axios';
import { ApiError } from '../../types';
import { getToken, clearAll } from '../storage/secureStore';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert } from 'react-native';

// Get API URL from environment variables
// In Expo, use Constants.expoConfig.extra or process.env
const getApiUrl = (): string => {
  // Try to get from Expo config first
  const expoApiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (expoApiUrl) {
    return expoApiUrl;
  }
  
  // Fallback to environment variable or default
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
};

// Error messages in Chinese (matching Web frontend)
const ERROR_MESSAGES = {
  sessionExpired: '登录已过期，请重新登录',
  permissionDenied: '没有权限执行此操作',
  networkError: '网络连接失败，请检查网络设置',
  requestTimeout: '请求超时，请重试',
  unknownError: '发生未知错误',
  requestFailed: '请求失败',
};

// Create axios instance with base configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: getApiUrl(),
  timeout: 30000, // 30 seconds timeout (Requirements: 2.4)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple logout redirects
let isLoggingOut = false;

/**
 * Handle logout flow
 * Clears credentials and redirects to login
 */
const handleLogout = async (): Promise<void> => {
  if (isLoggingOut) return;
  isLoggingOut = true;
  
  try {
    await clearAll();
    
    // Show alert and redirect
    Alert.alert(
      '登录已过期',
      ERROR_MESSAGES.sessionExpired,
      [
        {
          text: '确定',
          onPress: () => {
            router.replace('/auth/login');
          },
        },
      ]
    );
  } finally {
    // Reset flag after a delay to prevent rapid re-triggers
    setTimeout(() => {
      isLoggingOut = false;
    }, 2000);
  }
};

// Request interceptor to add JWT token (Requirements: 2.1)
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Get token from secure storage
    const token = await getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling (Requirements: 2.2, 2.3)
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    // Handle different error scenarios
    if (error.response) {
      const { status, data } = error.response;

      // Handle 401 Unauthorized - token expired or invalid (Requirements: 2.2)
      if (status === 401) {
        await handleLogout();
      }

      // Handle 403 Forbidden - don't redirect, let the page handle it
      if (status === 403) {
        Alert.alert('权限不足', ERROR_MESSAGES.permissionDenied);
      }

      // Handle network timeout
      if (status === 408 || error.code === 'ECONNABORTED') {
        Alert.alert('请求超时', ERROR_MESSAGES.requestTimeout);
      }

      // Return structured error (Requirements: 2.3)
      return Promise.reject({
        code: data?.code || 'UNKNOWN_ERROR',
        message: data?.message || ERROR_MESSAGES.unknownError,
        details: data?.details,
      });
    } else if (error.request) {
      // Network error - no response received (Requirements: 2.3)
      Alert.alert('网络错误', ERROR_MESSAGES.networkError);
      
      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: ERROR_MESSAGES.networkError,
        details: {},
      });
    } else {
      // Something else happened
      return Promise.reject({
        code: 'REQUEST_ERROR',
        message: error.message || ERROR_MESSAGES.requestFailed,
        details: {},
      });
    }
  }
);

export default apiClient;

/**
 * Export the API URL getter for use in other modules
 */
export { getApiUrl };
