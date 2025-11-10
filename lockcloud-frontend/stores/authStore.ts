import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import * as authApi from '@/lib/api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false, // Will be set by initialize

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login({ email, password });
          
          // Store token in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('lockcloud_token', response.token);
          }
          
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        // Clear localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lockcloud_token');
          localStorage.removeItem('lockcloud_user');
        }
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      refreshToken: async () => {
        try {
          const response = await authApi.refreshToken();
          
          // Update token in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('lockcloud_token', response.token);
          }
          
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
          });
        } catch (error) {
          // If refresh fails, logout
          get().logout();
          throw error;
        }
      },

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },

      setToken: (token: string | null) => {
        set({ token, isAuthenticated: !!token });
        
        // Update localStorage
        if (typeof window !== 'undefined') {
          if (token) {
            localStorage.setItem('lockcloud_token', token);
          } else {
            localStorage.removeItem('lockcloud_token');
          }
        }
      },

      initialize: async () => {
        // Check if token exists in localStorage or persisted state
        if (typeof window !== 'undefined') {
          const currentState = get();
          const token = currentState.token || localStorage.getItem('lockcloud_token');
          const user = currentState.user;
          
          if (token && user) {
            // We have persisted auth data, set as authenticated immediately
            // Don't set isLoading to true - let the UI render immediately
            set({ 
              token, 
              user,
              isAuthenticated: true, 
              isLoading: false  // Changed: allow immediate rendering
            });
            
            // Verify token is still valid in background (silently)
            try {
              const freshUser = await authApi.getMe();
              set({
                user: freshUser,
                token,
                isAuthenticated: true,
                isLoading: false,
              });
            } catch (error) {
              // Token is invalid, clear it
              console.error('Token validation failed:', error);
              get().logout();
            }
          } else {
            // No token found, set loading to false
            set({ isLoading: false, isAuthenticated: false });
          }
        }
      },
    }),
    {
      name: 'lockcloud-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);
