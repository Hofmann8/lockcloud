'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { Footer } from '@/components/Footer';
import { LoadingAnimation } from '@/components/LoadingAnimation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const [initialized, setInitialized] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize auth state on mount - only once
    if (!initialized) {
      initialize().then(() => {
        setInitialized(true);
      });
    }
  }, [initialized, initialize]);

  useEffect(() => {
    // Redirect to login if not authenticated (but only after initialization)
    if (initialized && !isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [initialized, isAuthenticated, isLoading, router]);

  useEffect(() => {
    // Check if content is ready after it's rendered
    if (initialized && isAuthenticated && contentRef.current) {
      // Use requestAnimationFrame to ensure DOM is painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setContentReady(true);
        });
      });
    }
  }, [initialized, isAuthenticated, children]);

  // Compute showLoading based on conditions
  const shouldShowLoading = !minTimeElapsed || !contentReady;

  useEffect(() => {
    // Disable body scroll when loading overlay is shown
    if (shouldShowLoading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [shouldShowLoading]);

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated && initialized) {
    return null;
  }

  return (
    <>
      {/* Main content - renders immediately in background */}
      <div ref={contentRef} className="h-screen flex flex-col bg-white overflow-hidden">
        <Navbar />
        
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          
          <main className="flex-1 overflow-y-auto bg-gray-50 custom-scrollbar">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-6 md:py-8">
              {children}
            </div>
          </main>
        </div>
        
        <Footer />
      </div>

      {/* Loading overlay - stays on top until ready */}
      {shouldShowLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <LoadingAnimation 
            minDisplayTime={2000}
            onAnimationComplete={() => {
              setMinTimeElapsed(true);
            }}
          />
        </div>
      )}
    </>
  );
}
