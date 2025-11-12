'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { TagPresetManager } from '@/components/TagPresetManager';

export default function TagPresetsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    // Wait for auth to initialize
    if (!isLoading && user && !user.is_admin) {
      router.push('/files');
    }
  }, [user, isLoading, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-accent-gray">加载中...</div>
      </div>
    );
  }

  // Don't render if not admin
  if (!user?.is_admin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary-black">
          标签预设管理
        </h1>
      </div>

      <TagPresetManager />
    </div>
  );
}
