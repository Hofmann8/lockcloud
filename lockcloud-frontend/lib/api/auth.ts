import apiClient from './client';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
} from '@/types';

/**
 * Send verification code to email
 */
export const sendCode = async (email: string): Promise<{ message: string }> => {
  const response = await apiClient.post('/api/auth/send-code', { email });
  return response.data;
};

/**
 * Register new user with verification code
 */
export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
  const response = await apiClient.post('/api/auth/register', data);
  return response.data;
};

/**
 * Login user and get JWT token
 */
export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await apiClient.post('/api/auth/login', data);
  return response.data;
};

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
