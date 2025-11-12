'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

/**
 * Providers component that wraps the app with necessary context providers
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance with optimized default options
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
            // Don't refetch on window focus by default
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fafafa',
            color: '#1a1a1a',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            padding: '16px 20px',
            fontWeight: '500',
            maxWidth: '500px',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
            fontSize: '15px',
            lineHeight: '1.5',
          },
          success: {
            duration: 3000,
            style: {
              background: '#7bc96f',
              color: '#fff',
              border: '1px solid rgba(123, 201, 111, 0.3)',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#7bc96f',
            },
          },
          error: {
            duration: 5000,
            style: {
              background: '#e74c3c',
              color: '#fff',
              border: '1px solid rgba(231, 76, 60, 0.3)',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#e74c3c',
            },
          },
          loading: {
            style: {
              background: '#5fa8d3',
              color: '#fff',
              border: '1px solid rgba(95, 168, 211, 0.3)',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#5fa8d3',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}
