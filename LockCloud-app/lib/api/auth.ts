/**
 * Authentication API
 * 
 * Handles SSO authentication and token management.
 * Strictly follows the Web frontend implementation (lockcloud-frontend/lib/api/auth.ts)
 * and backend routes (backend/auth/routes.py).
 * 
 * Requirements: 1.1, 1.2, 1.6
 */

import apiClient from './client';
import { AuthResponse, SSOConfig, User } from '../../types';

// ============================================================
// SSO Authentication
// ============================================================

/**
 * Get SSO configuration from backend
 * Endpoint: GET /api/auth/sso/config
 * 
 * @returns SSO configuration with login URL and frontend URL
 */
export const getSSOConfig = async (): Promise<SSOConfig> => {
  const response = await apiClient.get('/api/auth/sso/config');
  return response.data;
};

/**
 * SSO Login - Verify SSO token and get local JWT token
 * Endpoint: POST /api/auth/sso/login
 * 
 * @param ssoToken - Token received from SSO service
 * @returns Authentication response with JWT token and user info
 */
export const ssoLogin = async (ssoToken: string): Promise<AuthResponse> => {
  const response = await apiClient.post('/api/auth/sso/login', { token: ssoToken });
  return response.data;
};

// ============================================================
// Token Management
// ============================================================

/**
 * Refresh JWT token
 * Endpoint: POST /api/auth/refresh
 * 
 * @returns New authentication response with refreshed token
 */
export const refreshToken = async (): Promise<AuthResponse> => {
  const response = await apiClient.post('/api/auth/refresh');
  return response.data;
};

/**
 * Get current user information
 * Endpoint: GET /api/auth/me
 * 
 * @returns Current authenticated user
 */
export const getMe = async (): Promise<User> => {
  const response = await apiClient.get('/api/auth/me');
  return response.data.user;
};
