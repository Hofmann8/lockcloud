/**
 * Providers component that wraps the app with necessary context providers
 * 
 * Follows the Web frontend implementation (lockcloud-frontend/lib/providers.tsx)
 * Configures TanStack Query with optimized settings for mobile
 * 
 * Requirements: 12.1
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef, ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Providers component that wraps the app with TanStack Query
 */
export function Providers({ children }: ProvidersProps) {
  // Create QueryClient instance with optimized default options for mobile
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Cache data for 10 minutes (gcTime replaces cacheTime in v5)
            gcTime: 10 * 60 * 1000,
            // Retry failed requests once
            retry: 1,
            // Don't refetch on window focus (not applicable on mobile, but good default)
            refetchOnWindowFocus: false,
            // Don't refetch on reconnect for better performance
            refetchOnReconnect: false,
            // Don't refetch on mount if data is fresh
            refetchOnMount: false,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  // Track user changes and clear cache when user switches
  const currentUser = useAuthStore((state) => state.user);
  const userIdRef = useRef<number | null>(null);

  useEffect(() => {
    const currentUserId = currentUser?.id || null;
    
    // If user changed (including logout), clear all queries
    if (userIdRef.current !== null && userIdRef.current !== currentUserId) {
      console.log('User changed, clearing React Query cache');
      queryClient.clear();
    }
    
    userIdRef.current = currentUserId;
  }, [currentUser?.id, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export default Providers;
