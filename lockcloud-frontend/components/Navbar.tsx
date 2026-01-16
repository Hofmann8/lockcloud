'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getPendingCount } from '@/lib/api/requests';
import { useIsMobile, useIsTablet } from '@/lib/hooks/useMediaQuery';
import { useTransferQueueStore } from '@/stores/transferQueueStore';
import { UserAvatar } from './UserAvatar';
import { UserMenu } from './UserMenu';
import { AvatarUploadDialog } from './AvatarUploadDialog';
import toast from 'react-hot-toast';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  
  // Responsive hooks
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // Close mobile menu when route changes
  // Using a ref to track previous pathname to avoid unnecessary state updates
  useEffect(() => {
    // Only close if menu is open and pathname changed
    if (showMobileMenu) {
      setShowMobileMenu(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (showMobileMenu && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMobileMenu, isMobile]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showMobileMenu) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showMobileMenu]);

  const handleLogout = useCallback(() => {
    logout();
    toast.success('已退出登录');
    setShowMobileMenu(false);
    router.push('/auth/login');
  }, [logout, router]);

  const handleMobileMenuToggle = useCallback(() => {
    setShowMobileMenu(prev => !prev);
  }, []);

  const handleMobileLinkClick = useCallback(() => {
    setShowMobileMenu(false);
  }, []);

  // Get pending request count
  const { data: pendingCount } = useQuery({
    queryKey: ['requests', 'pending-count'],
    queryFn: getPendingCount,
    refetchInterval: 60000, // Refresh every minute
  });

  // Transfer queue state
  const tasks = useTransferQueueStore((state) => state.tasks);
  const pausedTasks = useTransferQueueStore((state) => state.pausedTasks);

  const { uploadingCount, downloadingCount, totalActive } = useMemo(() => {
    let uploading = 0;
    let downloading = 0;
    tasks.forEach((task) => {
      const isActive = task.status === 'processing' || (task.status === 'pending' && !pausedTasks.has(task.id));
      if (isActive) {
        if (task.type === 'upload') uploading++;
        else downloading++;
      }
    });
    return { uploadingCount: uploading, downloadingCount: downloading, totalActive: uploading + downloading };
  }, [tasks, pausedTasks]);

  // Carousel for transfer label - cycle through: 传输 -> 上传 X -> 下载 X -> 传输...
  const [transferLabelIndex, setTransferLabelIndex] = useState(0);
  
  // Build labels array based on active tasks
  const transferLabels = useMemo(() => {
    const labels: { text: string; color?: string }[] = [{ text: '传输' }];
    if (uploadingCount > 0) labels.push({ text: `上传 ${uploadingCount}`, color: 'text-accent-blue' });
    if (downloadingCount > 0) labels.push({ text: `下载 ${downloadingCount}`, color: 'text-accent-green' });
    return labels;
  }, [uploadingCount, downloadingCount]);

  useEffect(() => {
    if (transferLabels.length > 1) {
      const interval = setInterval(() => {
        setTransferLabelIndex((prev) => (prev + 1) % transferLabels.length);
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setTransferLabelIndex(0);
    }
  }, [transferLabels.length]);

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname?.startsWith('/admin');
    }
    return pathname === path;
  };

  // Only show admin link for admin users
  const navLinks = [
    { href: '/files', label: '文件' },
    { href: '/upload', label: '传输' },
    { href: '/requests', label: '请求', badge: pendingCount || undefined },
    { href: '/changelog', label: '更新日志' },
    ...(user?.is_admin ? [{ href: '/admin', label: '管理' }] : []),
  ];

  // Tablet: show only essential links
  const tabletNavLinks = isTablet 
    ? navLinks.filter(link => ['/files', '/upload', '/requests'].includes(link.href) || link.href === '/admin')
    : navLinks;

  return (
    <>
      <nav className="bg-white border-b border-black/10 sticky top-0 z-50">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo + Team Name */}
            <div className="flex items-center">
              <Link href="/files" className="flex items-center space-x-3">
                <img 
                  src="https://funkandlove-main.s3.bitiful.net/public/icon.png" 
                  alt="Funk & Love Logo" 
                  className="w-10 h-10 object-contain"
                />
                <h1 className="text-2xl font-handwritten font-bold text-black hover:text-orange-500 transition-colors">
                  Funk & Love
                </h1>
              </Link>
            </div>

            {/* Right: Navigation Links + User Menu (Desktop & Tablet) */}
            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
              {/* Navigation Links - Use tabletNavLinks for responsive display */}
              {tabletNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative text-base font-medium text-black transition-colors group py-1"
                >
                  {/* Special handling for Transfer link */}
                  {link.href === '/upload' ? (
                    <span className={`flex items-center gap-1.5 ${isActive(link.href) ? 'text-orange-500' : 'group-hover:text-orange-500'}`}>
                      {/* Pulse indicator - only show when active */}
                      {totalActive > 0 && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-blue opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-blue"></span>
                        </span>
                      )}
                      {/* Fixed width container with fade animation */}
                      <span className="relative w-[3.5em] h-6 flex items-center justify-center overflow-hidden">
                        {transferLabels.map((label, idx) => (
                          <span
                            key={label.text}
                            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                              label.color || (isActive(link.href) ? 'text-orange-500' : '')
                            } ${idx === transferLabelIndex ? 'opacity-100' : 'opacity-0'}`}
                          >
                            {label.text}
                          </span>
                        ))}
                      </span>
                    </span>
                  ) : (
                    <span className={`${isActive(link.href) ? 'text-orange-500' : 'group-hover:text-orange-500'}`}>
                      {link.label}
                    </span>
                  )}
                  {/* Badge for pending count */}
                  {'badge' in link && link.badge && link.badge > 0 && (
                    <span className="absolute -top-1 -right-3 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                      {link.badge > 99 ? '99+' : link.badge}
                    </span>
                  )}
                  {/* Active/Hover Underline */}
                  <span
                    className={`absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 transition-transform origin-left ${
                      isActive(link.href) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                    }`}
                    style={{ transform: isActive(link.href) ? 'scaleX(1)' : undefined }}
                  />
                </Link>
              ))}

              {/* User Menu (Desktop & Tablet) */}
              <UserMenu 
                user={user} 
                onLogout={handleLogout}
                onChangeAvatar={() => setShowAvatarDialog(true)}
              />
            </div>

            {/* Mobile Menu Button - Hamburger */}
            <div className="md:hidden flex items-center gap-2">
              {/* Mobile Transfer Status - compact version */}
              {totalActive > 0 && (
                <Link
                  href="/upload"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent-blue/10"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-blue opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-blue"></span>
                  </span>
                  <span className="text-xs font-medium text-accent-blue">{totalActive}</span>
                </Link>
              )}
              
              <button
                onClick={handleMobileMenuToggle}
                className="p-3 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={showMobileMenu ? '关闭菜单' : '打开菜单'}
                aria-expanded={showMobileMenu}
                aria-controls="mobile-menu"
              >
                <svg
                  className="w-6 h-6 transition-transform duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {showMobileMenu ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Full-Screen Navigation Menu */}
      <div
        id="mobile-menu"
        className={`md:hidden fixed inset-0 z-40 transition-all duration-300 ease-in-out ${
          showMobileMenu ? 'visible' : 'invisible'
        }`}
        aria-hidden={!showMobileMenu}
      >
        {/* Backdrop overlay */}
        <div 
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
            showMobileMenu ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={handleMobileLinkClick}
          aria-hidden="true"
        />
        
        {/* Menu panel - slides in from right */}
        <div 
          className={`absolute top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl transition-transform duration-300 ease-out ${
            showMobileMenu ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ paddingTop: 'var(--safe-area-inset-top)' }}
        >
          {/* Menu Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-black/10">
            <div className="flex items-center space-x-3">
              <img 
                src="https://funkandlove-main.s3.bitiful.net/public/icon.png" 
                alt="Funk & Love Logo" 
                className="w-8 h-8 object-contain"
              />
              <span className="text-lg font-handwritten font-bold text-black">
                Funk & Love
              </span>
            </div>
            <button
              onClick={handleMobileLinkClick}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="关闭菜单"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-4 py-4">
            <ul className="space-y-2">
              {navLinks.map((link, index) => (
                <li 
                  key={link.href}
                  style={{ 
                    animationDelay: showMobileMenu ? `${index * 50}ms` : '0ms',
                    opacity: showMobileMenu ? 1 : 0,
                    transform: showMobileMenu ? 'translateX(0)' : 'translateX(20px)',
                    transition: `opacity 200ms ease-out ${index * 50}ms, transform 200ms ease-out ${index * 50}ms`
                  }}
                >
                  <Link
                    href={link.href}
                    onClick={handleMobileLinkClick}
                    className={`flex items-center justify-between px-4 py-4 text-lg font-medium rounded-xl transition-colors min-h-[56px] ${
                      isActive(link.href)
                        ? 'bg-orange-50 text-orange-500 border-l-4 border-orange-500'
                        : 'text-black hover:bg-gray-50 active:bg-gray-100'
                    }`}
                  >
                    {/* Special handling for Transfer link in mobile menu */}
                    {link.href === '/upload' ? (
                      <span className="flex items-center gap-2">
                        {totalActive > 0 && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-blue opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-blue"></span>
                          </span>
                        )}
                        <span className="relative w-[4em] h-7 flex items-center overflow-hidden">
                          {transferLabels.map((label, idx) => (
                            <span
                              key={label.text}
                              className={`absolute inset-0 flex items-center transition-opacity duration-300 ${
                                label.color || ''
                              } ${idx === transferLabelIndex ? 'opacity-100' : 'opacity-0'}`}
                            >
                              {label.text}
                            </span>
                          ))}
                        </span>
                      </span>
                    ) : (
                      <span>{link.label}</span>
                    )}
                    {'badge' in link && link.badge && link.badge > 0 && (
                      <span className="min-w-[24px] h-[24px] flex items-center justify-center px-2 text-sm font-bold text-white bg-red-500 rounded-full">
                        {link.badge > 99 ? '99+' : link.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* User Info & Logout - Fixed at bottom */}
          <div 
            className="border-t border-black/10 px-4 py-4"
            style={{ paddingBottom: 'calc(var(--safe-area-inset-bottom) + 1rem)' }}
          >
            <div className="flex items-center space-x-3 px-4 py-3 bg-gray-50 rounded-xl">
              <UserAvatar user={user} size="xl" className="!w-12 !h-12" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-black truncate">{user?.name}</p>
                <p className="text-sm text-gray-600 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowMobileMenu(false);
                setShowAvatarDialog(true);
              }}
              className="w-full flex items-center justify-center px-4 py-4 mt-3 text-base font-medium text-black bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 rounded-xl transition-colors min-h-[56px]"
            >
              <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              更换头像
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-4 mt-3 text-base font-medium text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-xl transition-colors min-h-[56px]"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              退出登录
            </button>
          </div>
        </div>
      </div>

      {/* Avatar Upload Dialog */}
      <AvatarUploadDialog 
        isOpen={showAvatarDialog} 
        onClose={() => setShowAvatarDialog(false)} 
      />
    </>
  );
}
