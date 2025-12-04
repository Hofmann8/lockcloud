'use client';

import React from 'react';

export type MediaType = 'all' | 'image' | 'video';

interface MediaTypeFilterProps {
  value: MediaType;
  onChange: (value: MediaType) => void;
  disabled?: boolean;
}

const mediaTypeOptions: { value: MediaType; label: string; icon: React.ReactNode }[] = [
  {
    value: 'all',
    label: '全部',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    value: 'image',
    label: '图片',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'video',
    label: '视频',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
];

/**
 * MediaTypeFilter component - Radio buttons for filtering by media type
 * Requirements: 2.1, 2.2, 2.3, 8.4
 * Mobile: Larger touch targets, full-width buttons on small screens
 */
export function MediaTypeFilter({ value, onChange, disabled = false }: MediaTypeFilterProps) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-primary-black mb-2">
        媒体类型
      </label>
      {/* Mobile: Full width buttons stacked, Desktop: Inline flex */}
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        {mediaTypeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`
              flex items-center justify-center sm:justify-start gap-2 
              px-4 py-3 sm:px-3 sm:py-2 rounded-lg border transition-all
              min-h-[44px] text-sm font-medium w-full sm:w-auto
              ${value === option.value
                ? 'bg-accent-blue text-primary-white border-accent-blue'
                : 'bg-primary-white text-primary-black border-accent-gray/30 hover:border-accent-blue hover:text-accent-blue active:bg-accent-blue/5'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            aria-pressed={value === option.value}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
