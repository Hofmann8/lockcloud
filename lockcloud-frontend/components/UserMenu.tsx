'use client';

import { useState, useRef, useEffect } from 'react';
import { User } from '@/types';
import { UserAvatar } from './UserAvatar';

interface UserMenuProps {
  user: User | null;
  onLogout: () => void;
  onChangeAvatar: () => void;
}

export function UserMenu({ user, onLogout, onChangeAvatar }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerHover, setTriggerHover] = useState(false);
  const [avatarBtnHover, setAvatarBtnHover] = useState(false);
  const [logoutBtnHover, setLogoutBtnHover] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ESC 关闭菜单
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setTriggerHover(true)}
        onMouseLeave={() => setTriggerHover(false)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid rgba(0,0,0,0.2)',
          backgroundColor: triggerHover ? '#f3f4f6' : 'transparent',
          cursor: 'pointer',
          transition: 'background-color 150ms ease',
          minHeight: '44px',
        }}
      >
        <UserAvatar user={user} size="md" />
        <span 
          className="hidden lg:inline"
          style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}
        >
          {user?.name || '用户'}
        </span>
        <svg
          style={{
            width: '16px',
            height: '16px',
            transition: 'transform 200ms ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            marginTop: '8px',
            width: '200px',
            backgroundColor: '#fff',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          {/* 用户信息 */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <UserAvatar user={user} size="lg" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ 
                fontSize: '14px', 
                fontWeight: 500, 
                color: '#1a1a1a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user?.name}
              </p>
              <p style={{ 
                fontSize: '12px', 
                color: '#6b7280',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user?.email}
              </p>
            </div>
          </div>

          {/* 更换头像按钮 */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onChangeAvatar();
            }}
            onMouseEnter={() => setAvatarBtnHover(true)}
            onMouseLeave={() => setAvatarBtnHover(false)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              fontSize: '14px',
              color: '#1a1a1a',
              backgroundColor: avatarBtnHover ? '#f3f4f6' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 150ms ease',
            }}
          >
            <svg style={{ width: '16px', height: '16px', color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            更换头像
          </button>

          {/* 退出登录按钮 */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            onMouseEnter={() => setLogoutBtnHover(true)}
            onMouseLeave={() => setLogoutBtnHover(false)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              fontSize: '14px',
              color: logoutBtnHover ? '#dc2626' : '#1a1a1a',
              backgroundColor: logoutBtnHover ? '#fef2f2' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 150ms ease, color 150ms ease',
            }}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
