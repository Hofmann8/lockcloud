'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as filesApi from '@/lib/api/files';
import { DirectoryNode } from '@/types';

interface DirectoryItemProps {
  node: DirectoryNode;
  level: number;
  currentPath: string;
}

function DirectoryItem({ node, level, currentPath }: DirectoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = node.subdirectories && node.subdirectories.length > 0;
  const isActive = currentPath.includes(node.path);
  const fileCount = node.file_count || 0;

  // Choose icon based on level
  const getIcon = () => {
    if (level === 0) {
      // Activity type - use tag icon
      return (
        <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      );
    } else if (level === 1) {
      // Year - use calendar icon
      return (
        <svg className="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    } else {
      // Month - use folder icon
      return (
        <svg className="w-5 h-5 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    }
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center justify-between rounded-lg transition-colors ${
          isActive ? 'bg-accent-green/10 text-accent-green' : 'hover:bg-accent-gray/10'
        }`}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-2 hover:bg-accent-gray/20 rounded shrink-0"
            aria-label={isExpanded ? '收起' : '展开'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-8 shrink-0" />
        )}
        
        {/* Directory Link */}
        <Link 
          href={`/files?directory=${encodeURIComponent(node.path)}`} 
          className="flex-1 flex items-center space-x-2 text-primary-black py-2 pr-3 min-w-0"
          onClick={(e) => {
            // Close sidebar on mobile when clicking a link
            if (window.innerWidth < 1024) {
              const event = new CustomEvent('closeSidebar');
              window.dispatchEvent(event);
            }
          }}
        >
          {getIcon()}
          <span className="text-sm font-medium flex-1 truncate">{node.name}</span>
        </Link>
        
        {/* File Count Badge */}
        {fileCount > 0 && (
          <span className="text-xs bg-accent-gray/20 text-accent-gray px-2 py-0.5 rounded-full font-medium shrink-0 mr-3">
            {fileCount}
          </span>
        )}
      </div>

      {/* Subdirectories */}
      {hasChildren && isExpanded && (
        <div>
          {node.subdirectories!.map((child) => (
            <DirectoryItem key={child.path} node={child} level={level + 1} currentPath={currentPath} />
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
  
  // Fetch directory structure from API (based on tag presets)
  const { data: directoriesResponse, isLoading, error } = useQuery({
    queryKey: ['directories'],
    queryFn: filesApi.getDirectories,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract directories array from response
  const directories = directoriesResponse?.directories || [];
  
  // Listen for custom close/open events
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

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-accent-gray/20 h-full flex flex-col overflow-hidden
        transform transition-transform duration-300 ease-in-out lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile Close Button */}
        <div className="lg:hidden flex justify-end p-4 border-b border-accent-gray/20">
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent-gray/10 rounded-lg transition-colors"
            aria-label="关闭侧边栏"
          >
            <svg className="w-6 h-6 text-primary-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar-nav">
        <Link 
          href="/files" 
          className="flex items-center gap-2 mb-4 px-2 py-2 rounded-lg hover:bg-accent-gray/10 transition-colors text-primary-black group"
          onClick={() => {
            if (window.innerWidth < 1024) {
              onClose();
            }
          }}
        >
          <svg className="w-5 h-5 text-accent-green group-hover:text-accent-orange transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <h2 className="text-lg font-semibold text-primary-black group-hover:text-accent-orange transition-colors">文件目录</h2>
        </Link>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-green border-t-transparent"></div>
            <p className="text-sm text-accent-gray">加载中...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <svg className="w-12 h-12 text-semantic-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-accent-gray text-center">加载目录失败</p>
          </div>
        ) : directories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <svg className="w-12 h-12 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm text-accent-gray text-center">暂无文件</p>
            <p className="text-xs text-accent-gray text-center px-4">上传文件后将自动生成目录结构</p>
          </div>
        ) : (
          <div className="space-y-1">
            {directories.map((node) => (
              <DirectoryItem key={node.path} node={node} level={0} currentPath={pathname} />
            ))}
          </div>
        )}
      </div>
      </aside>
    </>
  );
}
