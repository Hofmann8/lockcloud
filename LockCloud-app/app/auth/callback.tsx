/**
 * SSO Callback Page
 * 
 * Handles the redirect from Funk & Love Auth Service.
 * Extracts token from URL, exchanges it for local JWT, and navigates to main app.
 * 
 * Requirements: 1.2
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/authStore';

type CallbackStatus = 'loading' | 'success' | 'error';

export default function CallbackPage() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const { login } = useAuthStore();
  
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      // Get token from URL params (sent by SSO service)
      const { token, error } = params;

      if (error) {
        setStatus('error');
        setErrorMessage(decodeURIComponent(error));
        return;
      }

      if (!token) {
        setStatus('error');
        setErrorMessage('未收到认证信息');
        return;
      }

      try {
        // Exchange SSO token for local JWT via authStore.login
        await login(token);
        
        setStatus('success');
        
        // Redirect to main app after brief delay
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
      } catch (err) {
        setStatus('error');
        const message = (err as { message?: string })?.message || '登录验证失败';
        setErrorMessage(message);
      }
    };

    handleCallback();
  }, [params, login]);

  const handleReturnToLogin = () => {
    router.replace('/auth/login');
  };

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <View style={styles.statusContainer}>
          <ActivityIndicator 
            size="large" 
            color={isDark ? '#ffffff' : '#1a1a1a'} 
          />
          <Text style={[styles.statusText, { color: isDark ? '#888888' : '#666666' }]}>
            正在验证登录信息...
          </Text>
        </View>
      )}

      {status === 'success' && (
        <View style={styles.statusContainer}>
          <View style={[styles.iconContainer, styles.successIcon]}>
            <Ionicons name="checkmark" size={32} color="#ffffff" />
          </View>
          <Text style={[styles.statusText, styles.successText]}>
            登录成功
          </Text>
          <Text style={[styles.hintText, { color: isDark ? '#888888' : '#666666' }]}>
            正在跳转...
          </Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.statusContainer}>
          <View style={[styles.iconContainer, styles.errorIcon]}>
            <Ionicons name="close" size={32} color="#ffffff" />
          </View>
          <Text style={[styles.statusText, styles.errorText]}>
            登录失败
          </Text>
          <Text style={[styles.errorMessage, { color: isDark ? '#888888' : '#666666' }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleReturnToLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>返回登录</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    backgroundColor: '#22c55e',
  },
  errorIcon: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
  },
  successText: {
    color: '#22c55e',
  },
  errorText: {
    color: '#ef4444',
  },
  hintText: {
    fontSize: 14,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
