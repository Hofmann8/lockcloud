'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import { getAvatarSignedUrl } from '@/lib/api/auth';

interface UserAvatarProps {
  user?: User | null;
  /** Size in pixels */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Custom class name */
  className?: string;
  /** Show name tooltip on hover */
  showTooltip?: boolean;
}

const sizeMap = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg',
};

// 统一使用 avatarlg 尺寸，所有大小共用一个缓存
const AVATAR_STYLE = 'avatarlg';

// Avatar URL cache - 按 avatarKey 缓存，不再按尺寸
const avatarUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Generate consistent color from user id/name
function getAvatarColor(user?: User | null): string {
  if (!user) return 'bg-gray-400';
  
  const colors = [
    'bg-orange-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-cyan-500',
  ];
  
  const index = user.id % colors.length;
  return colors[index];
}

export function UserAvatar({ user, size = 'md', className = '', showTooltip = false }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const sizeClass = sizeMap[size];
  const initial = user?.name?.charAt(0).toUpperCase() || '?';
  const bgColor = getAvatarColor(user);
  const avatarKey = user?.avatar_key;
  
  const fetchAvatarUrl = useCallback(async () => {
    if (!avatarKey) return;
    
    const cached = avatarUrlCache.get(avatarKey);
    
    // Use cached URL if not expired (with 5min buffer)
    if (cached && cached.expiresAt > Date.now() + 300000) {
      setAvatarUrl(cached.url);
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await getAvatarSignedUrl(avatarKey, AVATAR_STYLE);
      const expiresAt = Date.now() + result.expires_in * 1000;
      avatarUrlCache.set(avatarKey, { url: result.signed_url, expiresAt });
      setAvatarUrl(result.signed_url);
      setImgError(false);
    } catch (err) {
      console.error('Failed to get avatar URL:', err);
    } finally {
      setIsLoading(false);
    }
  }, [avatarKey]);
  
  useEffect(() => {
    if (avatarKey) {
      fetchAvatarUrl();
    } else {
      setAvatarUrl(null);
    }
  }, [avatarKey, fetchAvatarUrl]);
  
  const handleImgError = useCallback(() => {
    setImgError(true);
  }, []);
  
  const showImage = avatarUrl && !imgError && !isLoading;
  
  return (
    <div
      className={`relative rounded-full overflow-hidden flex items-center justify-center font-bold text-white shrink-0 pointer-events-none ${sizeClass} ${!showImage ? bgColor : ''} ${className}`}
      title={showTooltip ? user?.name : undefined}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={user?.name || 'User avatar'}
          className="w-full h-full object-cover"
          onError={handleImgError}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

// Compact version for inline use (e.g., "上传者: [avatar] Name")
export function UserAvatarInline({ 
  user, 
  showName = true,
  size = 'xs',
  className = '' 
}: { 
  user?: User | null;
  showName?: boolean;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <UserAvatar user={user} size={size} />
      {showName && <span className="truncate">{user?.name || '未知用户'}</span>}
    </span>
  );
}
