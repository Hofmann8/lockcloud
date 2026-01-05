/**
 * Root Layout for LockCloud Mobile App
 * 
 * Configures:
 * - TanStack Query Provider for server state management
 * - Theme Provider for light/dark mode support
 * - Auth state initialization
 * - Animated splash screen with Lottie
 * 
 * Requirements: 12.1
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/authStore';
import { Providers } from '@/lib/providers';
import { AnimatedSplashScreen } from '@/components/SplashScreen';

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Root layout component that wraps the entire app
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { initialize, isLoading } = useAuthStore();
  const [appReady, setAppReady] = useState(false);

  // Initialize auth state on app startup
  useEffect(() => {
    const init = async () => {
      await initialize();
      setAppReady(true);
    };
    init();
  }, [initialize]);

  return (
    <Providers>
      <AnimatedSplashScreen isReady={appReady && !isLoading}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen 
              name="files/[id]" 
              options={{ 
                title: '文件详情',
                headerBackTitle: '返回',
                headerTitleStyle: {
                  fontWeight: '600',
                },
              }} 
            />
            <Stack.Screen 
              name="modal" 
              options={{ 
                presentation: 'modal', 
                title: '详情',
                headerTitleStyle: {
                  fontWeight: '600',
                },
              }} 
            />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </AnimatedSplashScreen>
    </Providers>
  );
}
