import apiClient from './client';
import { AuthResponse, User } from '@/types';

// ============================================================
// SSO Authentication (New)
// ============================================================

/**
 * Get SSO configuration from backend
 */
export const getSSOConfig = async (): Promise<{
  sso_login_url: string;
  sso_frontend_url: string;
}> => {
  const response = await apiClient.get('/api/auth/sso/config');
  return response.data;
};

/**
 * SSO Login - Verify SSO token and get local JWT token
 */
export const ssoLogin = async (ssoToken: string): Promise<AuthResponse> => {
  const response = await apiClient.post('/api/auth/sso/login', { token: ssoToken });
  return response.data;
};

// ============================================================
// Preserved Methods (Still used)
// ============================================================

/**
 * Refresh JWT token
 */
export const refreshToken = async (): Promise<AuthResponse> => {
  const response = await apiClient.post('/api/auth/refresh');
  return response.data;
};

/**
 * Get current user information
 */
export const getMe = async (): Promise<User> => {
  const response = await apiClient.get('/api/auth/me');
  return response.data.user;
};
