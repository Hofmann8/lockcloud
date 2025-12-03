'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('已退出登录');
    router.push('/auth/login');
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname?.startsWith('/admin');
    }
    return pathname === path;
  };

  // Only show admin link for admin users
  const navLinks = [
    { href: '/files', label: '文件' },
    { href: '/upload', label: '上传' },
    { href: '/changelog', label: '更新日志' },
    ...(user?.is_admin ? [{ href: '/admin', label: '管理' }] : []),
  ];

  return (
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

          {/* Right: Navigation Links + User Menu (Desktop) */}
          <div className="hidden md:flex items-center space-x-8">
            {/* Navigation Links */}
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative text-base font-medium text-black transition-colors group py-1"
              >
                <span className={`${isActive(link.href) ? 'text-orange-500' : 'group-hover:text-orange-500'}`}>
                  {link.label}
                </span>
                {/* Active/Hover Underline */}
                <span
                  className={`absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 transition-transform origin-left ${
                    isActive(link.href) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  }`}
                  style={{ transform: isActive(link.href) ? 'scaleX(1)' : undefined }}
                />
              </Link>
            ))}

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-black/20 hover:bg-gray-50 transition-colors min-h-[44px]"
              >
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-medium text-black">
                  {user?.name || '用户'}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-white border border-black/10 rounded-lg overflow-hidden animate-fade-in-down"
                  style={{
                    boxShadow: 'var(--shadow-lg)',
                    animation: 'fadeInDown 200ms cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <div className="py-2">
                    <div className="px-4 py-2 border-b border-black/10">
                      <p className="text-sm font-medium text-black">{user?.name}</p>
                      <p className="text-xs text-gray-600 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm text-black hover:bg-red-50 hover:text-red-600 transition-colors min-h-[44px]"
                    >
                      退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-3 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
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

      {/* Mobile Navigation Menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          showMobileMenu ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
        style={{
          transform: showMobileMenu ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), max-height 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <div className="px-4 py-3 space-y-2 border-t border-black/10 bg-white">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setShowMobileMenu(false)}
              className={`flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors min-h-[44px] ${
                isActive(link.href)
                  ? 'bg-orange-50 text-orange-500'
                  : 'text-black hover:bg-gray-100'
              }`}
            >
              {link.label}
            </Link>
          ))}
          
          {/* Mobile User Info */}
          <div className="pt-2 mt-2 border-t border-black/10">
            <div className="px-3 py-2 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black truncate">{user?.name}</p>
                <p className="text-xs text-gray-600 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center text-left px-4 py-3 mt-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px]"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
