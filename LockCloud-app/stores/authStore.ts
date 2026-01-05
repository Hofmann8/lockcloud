/**
 * Authentication State Management
 * 
 * Uses Zustand for global state management.
 * Strictly follows the Web frontend implementation (lockcloud-frontend/stores/authStore.ts)
 * but uses expo-secure-store instead of localStorage for secure token persistence.
 * 
 * Requirements: 1.1, 1.2, 1.4, 1.5
 */

import { create } from 'zustand';
import { User } from '../types';
import * as authApi from '../lib/api/auth';
import * as secureStore from '../lib/storage/secureStore';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (ssoToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Start with loading true until initialize completes

  /**
   * Login with SSO token
   * Exchanges SSO token for local JWT token via /api/auth/sso/login
   * 
   * Requirements: 1.1, 1.2
   */
  login: async (ssoToken: string) => {
    try {
      set({ isLoading: true });
      
      // Exchange SSO token for local JWT
      const response = await authApi.ssoLogin(ssoToken);
      
      console.log('[Auth] Login response:', { hasToken: !!response.token, hasUser: !!response.user });
      
      // Store credentials securely
      await secureStore.setToken(response.token);
      if (response.user) {
        await secureStore.setUser(response.user);
        console.log('[Auth] User stored successfully');
      } else {
        console.warn('[Auth] No user in login response');
      }
      
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('[Auth] Login error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Logout - Clear all stored credentials
   * 
   * Requirements: 1.5
   */
  logout: async () => {
    // Clear secure storage
    await secureStore.clearAll();
    
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  /**
   * Refresh JWT token
   * Calls /api/auth/refresh to get a new token
   * 
   * Requirements: 1.6
   */
  refreshToken: async () => {
    try {
      const response = await authApi.refreshToken();
      
      // Update token in secure storage
      await secureStore.setToken(response.token);
      await secureStore.setUser(response.user);
      
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
      });
    } catch (error) {
      // If refresh fails, logout
      await get().logout();
      throw error;
    }
  },

  /**
   * Set user data
   */
  setUser: (user: User | null) => {
    set({ user, isAuthenticated: !!user });
  },

  /**
   * Set token and persist to secure storage
   */
  setToken: async (token: string | null) => {
    set({ token, isAuthenticated: !!token });
    
    if (token) {
      await secureStore.setToken(token);
    } else {
      await secureStore.removeToken();
    }
  },

  /**
   * Initialize auth state from secure storage
   * Called on app startup to restore persisted credentials
   * 
   * Requirements: 1.3, 1.4
   */
  initialize: async () => {
    try {
      console.log('[Auth] Initializing...');
      
      // Get stored credentials
      const [token, user] = await Promise.all([
        secureStore.getToken(),
        secureStore.getUser(),
      ]);
      
      console.log('[Auth] Token found:', !!token);
      console.log('[Auth] User found:', !!user);
      
      if (token) {
        // We have a token, try to restore session
        set({
          token,
          user: user || null,
          isAuthenticated: true,
          isLoading: true,
        });
        
        console.log('[Auth] Verifying token...');
        
        // Verify token and get fresh user data
        try {
          const freshUser = await authApi.getMe();
          
          // Store user if we didn't have it
          await secureStore.setUser(freshUser);
          
          set({
            user: freshUser,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          console.log('[Auth] Token verified, user restored');
        } catch (error) {
          // Token is invalid, clear it
          console.error('[Auth] Token validation failed:', error);
          await get().logout();
        }
      } else {
        // No token found
        console.log('[Auth] No stored token found');
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch (error) {
      console.error('[Auth] Initialization error:', error);
      set({ isLoading: false, isAuthenticated: false });
    }
  },
}));

export default useAuthStore;
