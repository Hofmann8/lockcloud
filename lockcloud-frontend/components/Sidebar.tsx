'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as filesApi from '@/lib/api/files';
import { DirectoryNode } from '@/types';

// Build link for directory based on path (year/month/activity structure)
function buildDirectoryLink(path: string, node?: DirectoryNode): string {
  const parts = path.split('/');
  if (parts.length === 1) {
    return `/files?year=${parts[0]}`;
  } else if (parts.length === 2) {
    return `/files?year=${parts[0]}&month=${parseInt(parts[1])}`;
  } else if (parts.length >= 3 && node) {
    const params = new URLSearchParams();
    params.set('year', parts[0]);
    params.set('month', parseInt(parts[1]).toString());
    if (node.activity_date) {
      params.set('activity_date', node.activity_date);
    }
    if (node.activity_name) {
      params.set('activity_name', node.activity_name);
    }
    if (node.activity_type) {
      params.set('activity_type', node.activity_type);
    }
    return `/files?${params.toString()}`;
  }
  return '/files';
}

interface DirectoryItemProps {
  node: DirectoryNode;
  level: number;
  currentPath: string;
  onNavigate: () => void;
}

function DirectoryItem({ node, level, currentPath, onNavigate }: DirectoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = node.subdirectories && node.subdirectories.length > 0;
  const isActive = currentPath.includes(node.path);
  const fileCount = node.file_count || 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 py-1.5 rounded-lg transition-colors text-sm ${
          isActive 
            ? 'bg-orange-50 text-orange-500' 
            : 'text-black hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px`, paddingRight: '8px' }}
      >
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-black/5 rounded transition-colors shrink-0"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-5 shrink-0" />
        )}
        
        <Link 
          href={buildDirectoryLink(node.path, node)} 
          className="flex-1 flex items-center gap-1.5 min-w-0 py-0.5"
          onClick={onNavigate}
        >
          {level === 0 ? (
            <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ) : level === 1 ? (
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          )}
          <span className="truncate">{node.name}</span>
        </Link>
        
        {fileCount > 0 && (
          <span className="text-xs text-gray-400 shrink-0 ml-1">{fileCount}</span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.subdirectories!.map((child) => (
            <DirectoryItem key={child.path} node={child} level={level + 1} currentPath={currentPath} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export function Sidebar({ isOpen, onClose, onOpen }: SidebarProps) {
  const pathname = usePathname();
  
  const { data: directoriesResponse, isLoading, error } = useQuery({
    queryKey: ['directories'],
    queryFn: filesApi.getDirectories,
    staleTime: 5 * 60 * 1000,
  });

  const directories = directoriesResponse?.directories || [];
  
  useEffect(() => {
    const handleClose = () => onClose();
    const handleOpen = () => onOpen();
    window.addEventListener('closeSidebar', handleClose);
    window.addEventListener('openSidebar', handleOpen);
    return () => {
      window.removeEventListener('closeSidebar', handleClose);
      window.removeEventListener('openSidebar', handleOpen);
    };
  }, [onClose, onOpen]);

  const closeMobileSidebar = useCallback(() => {
    if (window.innerWidth < 1024) onClose();
  }, [onClose]);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-black/10 h-full flex flex-col overflow-hidden
        transform transition-transform duration-300 lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-black/10">
          <span className="font-medium text-black">目录</span>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar-nav">
          <Link 
            href="/files" 
            className="flex items-center gap-2 px-2 py-2 mb-2 rounded-lg text-black hover:text-orange-500 hover:bg-gray-50 font-medium text-sm transition-colors"
            onClick={closeMobileSidebar}
          >
            <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>全部文件</span>
          </Link>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent" />
            </div>
          ) : error ? (
            <p className="text-sm text-gray-400 text-center py-4">加载失败</p>
          ) : directories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">暂无文件</p>
          ) : (
            <div className="space-y-0.5">
              {directories.map((node) => (
                <DirectoryItem key={node.path} node={node} level={0} currentPath={pathname} onNavigate={closeMobileSidebar} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
