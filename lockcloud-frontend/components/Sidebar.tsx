'use client';

import { useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isActive = currentPath.includes(node.path);
  const fileCount = node.file_count || 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          isActive ? 'bg-orange-100 text-orange-600' : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
      >
        <Link href={`/files?directory=${encodeURIComponent(node.path)}`} className="flex-1 flex items-center space-x-2">
          {hasChildren && (
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsExpanded(!isExpanded);
              }}
              className="p-0.5 hover:bg-gray-200 rounded"
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
          )}
          {!hasChildren && <div className="w-5" />}
          
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          
          <span className="text-sm font-medium flex-1">{node.name}</span>
        </Link>
        
        {fileCount > 0 && (
          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
            {fileCount} 个文件
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <DirectoryItem key={child.path} node={child} level={level + 1} currentPath={currentPath} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  
  // Fetch directory structure
  const { data: directories, isLoading } = useQuery({
    queryKey: ['directories'],
    queryFn: filesApi.getDirectories,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Default directory structure with Chinese labels
  const defaultDirectories: DirectoryNode[] = [
    {
      name: '排练',
      path: '/rehearsals',
      file_count: 0,
      children: [],
    },
    {
      name: '活动',
      path: '/events',
      file_count: 0,
      children: [],
    },
    {
      name: '成员',
      path: '/members',
      file_count: 0,
      children: [],
    },
    {
      name: '资源',
      path: '/resources',
      file_count: 0,
      children: [],
    },
    {
      name: '管理',
      path: '/admin/stats',
      file_count: 0,
      children: [],
    },
  ];

  const directoryTree = Array.isArray(directories) ? directories : defaultDirectories;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-black mb-4">文件目录</h2>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          </div>
        ) : (
          <div className="space-y-1">
            {directoryTree.map((node) => (
              <DirectoryItem key={node.path} node={node} level={0} currentPath={pathname} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
