import apiClient from './client';
import { AuthResponse, User } from '@/types';
import axios from 'axios';

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

// ============================================================
// Avatar Methods
// ============================================================

/**
 * Get presigned URL for avatar upload
 */
export const getAvatarUploadUrl = async (contentType: string): Promise<{
  upload_url: string;
  avatar_key: string;
}> => {
  const response = await apiClient.post('/api/auth/avatar/upload-url', { content_type: contentType });
  return response.data;
};

/**
 * Upload avatar file to S3
 */
export const uploadAvatarToS3 = async (
  uploadUrl: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> => {
  await axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        onProgress(progress);
      }
    },
  });
};

/**
 * Confirm avatar upload and update user profile
 */
export const confirmAvatarUpload = async (avatarKey: string): Promise<{
  avatar_key: string;
  avatar_url: string;
}> => {
  const response = await apiClient.post('/api/auth/avatar/confirm', { avatar_key: avatarKey });
  return response.data;
};

/**
 * Delete current user's avatar
 */
export const deleteAvatar = async (): Promise<void> => {
  await apiClient.delete('/api/auth/avatar');
};

/**
 * Get signed URL for avatar with style
 */
export const getAvatarSignedUrl = async (
  avatarKey: string,
  style: string = 'avatarmd'
): Promise<{ signed_url: string; expires_in: number }> => {
  const response = await apiClient.get('/api/auth/avatar/signed-url', {
    params: { avatar_key: avatarKey, style }
  });
  return response.data;
};
