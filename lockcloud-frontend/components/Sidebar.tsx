'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as filesApi from '@/lib/api/files';
import { DirectoryNode } from '@/types';

// Activity type icon mapping
const activityTypeIcons: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  regular_training: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-blue-500',
    label: '例训',
  },
  competition: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    color: 'text-yellow-500',
    label: '比赛',
  },
  internal_training: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    color: 'text-purple-500',
    label: '内训',
  },
  master_class: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    color: 'text-amber-500',
    label: '大师课',
  },
  special_event: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    color: 'text-pink-500',
    label: '特殊活动',
  },
  team_building: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: 'text-green-500',
    label: '团建',
  },
  '未分类': {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    color: 'text-gray-400',
    label: '未分类',
  },
};

// Default icon for unknown activity types
const defaultActivityIcon = {
  icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  color: 'text-blue-400',
  label: '活动',
};

// Get icon config for activity type
function getActivityTypeIcon(activityType?: string) {
  if (!activityType) return defaultActivityIcon;
  return activityTypeIcons[activityType] || defaultActivityIcon;
}

// Format activity display name: "日期-活动名"
function formatActivityDisplayName(node: DirectoryNode): string {
  if (node.activity_date && node.activity_name) {
    // Extract day from date (YYYY-MM-DD -> DD)
    const day = node.activity_date.split('-')[2];
    return `${day}日-${node.activity_name}`;
  }
  return node.name;
}

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
  currentYear?: string | null;
  currentMonth?: string | null;
  currentActivityDate?: string | null;
  currentActivityName?: string | null;
  currentActivityType?: string | null;
  onNavigate: () => void;
}

function DirectoryItem({ 
  node, 
  level, 
  currentYear,
  currentMonth,
  currentActivityDate,
  currentActivityName,
  currentActivityType,
  onNavigate 
}: DirectoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [showTooltip, setShowTooltip] = useState(false);
  const hasChildren = node.subdirectories && node.subdirectories.length > 0;
  const fileCount = node.file_count || 0;
  
  // Determine if this node is active based on URL params
  let isActive = false;
  if (level === 0) {
    // Year level
    isActive = currentYear === node.name && !currentMonth;
  } else if (level === 1) {
    // Month level
    const monthNum = parseInt(node.name);
    isActive = currentMonth === String(monthNum) && !currentActivityDate;
  } else if (level === 2) {
    // Activity level - match by date, name, and type
    isActive = (
      currentActivityDate === node.activity_date &&
      currentActivityName === node.activity_name &&
      currentActivityType === node.activity_type
    );
  }
  
  // For level 2 (activity level), use activity type specific icon
  const isActivityLevel = level === 2;
  const activityIconConfig = isActivityLevel ? getActivityTypeIcon(node.activity_type) : null;
  
  // Display name: for activity level, show "日期-活动名"
  const displayName = isActivityLevel ? formatActivityDisplayName(node) : node.name;
  
  // Tooltip for activity level
  const tooltipText = isActivityLevel && activityIconConfig ? activityIconConfig.label : undefined;

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
          className="flex-1 flex items-center gap-1.5 min-w-0 py-0.5 relative group"
          onClick={onNavigate}
          onMouseEnter={() => tooltipText && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {level === 0 ? (
            // Year level - calendar icon
            <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ) : level === 1 ? (
            // Month level - folder icon
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          ) : activityIconConfig ? (
            // Activity level - activity type specific icon
            <span className={`shrink-0 ${activityIconConfig.color}`}>
              {activityIconConfig.icon}
            </span>
          ) : (
            // Fallback
            <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          )}
          <span className="truncate">{displayName}</span>
          
          {/* Custom Tooltip */}
          {tooltipText && showTooltip && (
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
              <div className="relative">
                {/* Arrow */}
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-800 rotate-45" />
                {/* Tooltip content */}
                <div className="bg-gray-800 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap">
                  {tooltipText}
                </div>
              </div>
            </div>
          )}
        </Link>
        
        {fileCount > 0 && (
          <span className="text-xs text-gray-400 shrink-0 ml-1">{fileCount}</span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.subdirectories!.map((child) => (
            <DirectoryItem 
              key={child.path} 
              node={child} 
              level={level + 1} 
              currentYear={currentYear}
              currentMonth={currentMonth}
              currentActivityDate={currentActivityDate}
              currentActivityName={currentActivityName}
              currentActivityType={currentActivityType}
              onNavigate={onNavigate} 
            />
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
  const searchParams = useSearchParams();
  
  // Get current filter values from URL
  const currentYear = searchParams.get('year');
  const currentMonth = searchParams.get('month');
  const currentActivityDate = searchParams.get('activity_date');
  const currentActivityName = searchParams.get('activity_name');
  const currentActivityType = searchParams.get('activity_type');
  
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
                <DirectoryItem 
                  key={node.path} 
                  node={node} 
                  level={0} 
                  currentYear={currentYear}
                  currentMonth={currentMonth}
                  currentActivityDate={currentActivityDate}
                  currentActivityName={currentActivityName}
                  currentActivityType={currentActivityType}
                  onNavigate={closeMobileSidebar} 
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
