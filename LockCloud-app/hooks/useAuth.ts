/**
 * Authentication Guard Hook
 * 
 * Provides authentication state checking and automatic redirection
 * to login page when user is not authenticated.
 * 
 * Requirements: 1.1, 1.4
 */

import { useEffect } from 'react';
import { router, useSegments, useRootNavigationState } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

/**
 * Hook to check authentication status and redirect if needed
 * 
 * @returns Authentication state and user info
 */
export function useAuth() {
  const { user, token, isAuthenticated, isLoading, initialize, logout } = useAuthStore();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  // Initialize auth state on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle authentication-based navigation
  useEffect(() => {
    // Wait for navigation to be ready
    if (!navigationState?.key) return;
    
    // Wait for auth initialization to complete
    if (isLoading) return;

    // Check if we're in the auth group
    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      // User is not authenticated and not on auth pages
      // Redirect to login
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      // User is authenticated but on auth pages
      // Redirect to main app
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading, navigationState?.key]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    logout,
  };
}

/**
 * Hook to protect routes that require authentication
 * Use this in screens that should only be accessible to authenticated users
 * 
 * @returns Authentication state
 */
export function useRequireAuth() {
  const auth = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for navigation to be ready
    if (!navigationState?.key) return;
    
    // Wait for auth initialization
    if (auth.isLoading) return;

    // If not authenticated, redirect to login
    if (!auth.isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [auth.isAuthenticated, auth.isLoading, navigationState?.key]);

  return auth;
}

/**
 * Hook to check if user is authenticated without redirecting
 * Useful for conditional rendering
 * 
 * @returns Authentication state without side effects
 */
export function useAuthStatus() {
  const { user, token, isAuthenticated, isLoading } = useAuthStore();

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
  };
}

export default useAuth;
