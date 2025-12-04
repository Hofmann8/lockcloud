'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileFilters as FileFiltersType } from '@/types';
import { MediaTypeFilter, MediaType } from './MediaTypeFilter';
import { FreeTagFilter } from './FreeTagFilter';
import { Button } from './Button';
import { useActivityTypes } from '@/lib/hooks/useTagPresets';
import { useIsMobile } from '@/lib/hooks/useMediaQuery';

interface FilterPanelProps {
  filters: FileFiltersType;
  onFilterChange: (filters: Partial<FileFiltersType>) => void;
  showSystemTags?: boolean; // Deprecated - kept for compatibility but defaults to false
  showMediaType?: boolean;
  showFreeTags?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  /** Display mode: 'inline' for normal, 'bottomSheet' for mobile overlay */
  displayMode?: 'inline' | 'bottomSheet';
}

/**
 * FilterPanel component - Unified filter panel combining all filter types
 * Requirements: 8.1, 8.2, 8.3, 8.4
 * Mobile: Collapsible panel with vertical stacking, optimized touch targets
 */
export function FilterPanel({
  filters,
  onFilterChange,
  showSystemTags = false, // Disabled by default - new system uses year/month + free tags
  showMediaType = true,
  showFreeTags = true,
  collapsible = true,
  defaultExpanded = false,
  displayMode = 'inline',
}: FilterPanelProps) {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const currentTranslateY = useRef<number>(0);

  // Local state for filters before applying
  const [localFilters, setLocalFilters] = useState<Partial<FileFiltersType>>({
    media_type: filters.media_type || 'all',
    activity_type: filters.activity_type || '',
    tags: filters.tags || [],
  });

  // Load tag presets
  const { data: activityTypes, isLoading: loadingActivityTypes } = useActivityTypes();

  // Sync local filters when external filters change
  useEffect(() => {
    setLocalFilters({
      media_type: filters.media_type || 'all',
      activity_type: filters.activity_type || '',
      tags: filters.tags || [],
    });
  }, [filters.media_type, filters.activity_type, filters.tags]);

  const handleMediaTypeChange = useCallback((value: MediaType) => {
    setLocalFilters((prev) => ({ ...prev, media_type: value }));
  }, []);

  const handleActivityTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalFilters((prev) => ({ ...prev, activity_type: e.target.value }));
  }, []);

  const handleFreeTagsChange = useCallback((tags: string[]) => {
    setLocalFilters((prev) => ({ ...prev, tags }));
  }, []);

  const handleApply = useCallback(() => {
    const cleanFilters: Partial<FileFiltersType> = {};

    if (localFilters.media_type && localFilters.media_type !== 'all') {
      cleanFilters.media_type = localFilters.media_type;
    }
    if (localFilters.activity_type) {
      cleanFilters.activity_type = localFilters.activity_type;
    }
    if (localFilters.tags && localFilters.tags.length > 0) {
      cleanFilters.tags = localFilters.tags;
    }

    onFilterChange(cleanFilters);
    
    // Close bottom sheet on mobile after applying
    if (isMobile && displayMode === 'bottomSheet') {
      setIsBottomSheetOpen(false);
    }
  }, [localFilters, onFilterChange, isMobile, displayMode]);

  const handleReset = useCallback(() => {
    setLocalFilters({
      media_type: 'all',
      activity_type: '',
      tags: [],
    });
    onFilterChange({
      media_type: undefined,
      activity_type: undefined,
      tags: undefined,
    });
  }, [onFilterChange]);

  const hasActiveFilters =
    (filters.media_type && filters.media_type !== 'all') ||
    filters.activity_type ||
    (filters.tags && filters.tags.length > 0);

  const activeFilterCount = [
    filters.media_type && filters.media_type !== 'all',
    filters.activity_type,
    filters.tags && filters.tags.length > 0,
  ].filter(Boolean).length;

  // Handle swipe down to close bottom sheet
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    currentTranslateY.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - dragStartY.current;
    if (deltaY > 0 && bottomSheetRef.current) {
      currentTranslateY.current = deltaY;
      bottomSheetRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (bottomSheetRef.current) {
      if (currentTranslateY.current > 100) {
        // Close if dragged down more than 100px
        setIsBottomSheetOpen(false);
      }
      bottomSheetRef.current.style.transform = '';
      currentTranslateY.current = 0;
    }
  }, []);

  // Close bottom sheet when clicking backdrop
  const handleBackdropClick = useCallback(() => {
    setIsBottomSheetOpen(false);
  }, []);

  const renderContent = () => (
    <div className="space-y-4 md:space-y-5">
      {/* Media Type Filter - Vertical stack on mobile */}
      {showMediaType && (
        <div className="w-full">
          <MediaTypeFilter
            value={localFilters.media_type || 'all'}
            onChange={handleMediaTypeChange}
          />
        </div>
      )}

      {/* System Tags Section */}
      {showSystemTags && (
        <div className="space-y-3 md:space-y-4">
          <h4 className="text-sm font-medium text-accent-gray uppercase tracking-wide">
            系统标签
          </h4>

          {/* Activity Type Filter */}
          <div className="w-full">
            <label className="block text-sm font-medium text-primary-black mb-2">
              活动类型
            </label>
            <select
              value={localFilters.activity_type || ''}
              onChange={handleActivityTypeChange}
              className="input-functional w-full px-4 py-3 md:py-2.5 text-base text-primary-black min-h-[44px] rounded-lg"
              disabled={loadingActivityTypes}
              aria-label="选择活动类型"
            >
              <option value="">全部</option>
              {activityTypes?.filter((preset) => preset.is_active).map((preset) => (
                <option key={preset.id} value={preset.value}>
                  {preset.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Free Tags Section - Full width on mobile */}
      {showFreeTags && (
        <div className="space-y-3 md:space-y-4 w-full">
          <h4 className="text-sm font-medium text-accent-gray uppercase tracking-wide">
            自由标签
          </h4>
          <FreeTagFilter
            selectedTags={localFilters.tags || []}
            onChange={handleFreeTagsChange}
          />
        </div>
      )}

      {/* Action Buttons - Always vertical stack on mobile */}
      <div className="flex flex-col gap-3 pt-2 w-full">
        <Button variant="primary" onClick={handleApply} fullWidth>
          应用筛选
        </Button>
        <Button variant="secondary" onClick={handleReset} fullWidth>
          重置
        </Button>
      </div>
    </div>
  );

  // Bottom Sheet mode for mobile
  if (isMobile && displayMode === 'bottomSheet') {
    return (
      <>
        {/* Trigger Button */}
        <button
          onClick={() => setIsBottomSheetOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-white border border-accent-gray/30 rounded-lg text-sm font-medium text-primary-black hover:border-accent-blue transition-colors min-h-[44px]"
          aria-label="打开筛选面板"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>筛选</span>
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-accent-blue text-primary-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Bottom Sheet Overlay */}
        {isBottomSheetOpen && (
          <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 transition-opacity"
              onClick={handleBackdropClick}
              aria-hidden="true"
            />
            
            {/* Bottom Sheet */}
            <div
              ref={bottomSheetRef}
              className="absolute bottom-0 left-0 right-0 bg-primary-white rounded-t-2xl shadow-xl max-h-[85vh] overflow-hidden transition-transform duration-300 ease-out"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              role="dialog"
              aria-modal="true"
              aria-label="筛选面板"
            >
              {/* Drag Handle */}
              <div className="flex justify-center py-3">
                <div className="w-10 h-1 bg-accent-gray/30 rounded-full" />
              </div>
              
              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-3 border-b border-accent-gray/20">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-primary-black">
                    筛选
                  </h3>
                  {hasActiveFilters && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-accent-blue text-primary-white rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsBottomSheetOpen(false)}
                  className="p-2 -mr-2 text-accent-gray hover:text-primary-black transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="关闭筛选面板"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)]">
                {renderContent()}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Standard inline mode
  return (
    <div className="card-functional bg-primary-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg md:text-xl font-semibold text-primary-black">
            筛选
          </h3>
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-accent-blue text-primary-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {collapsible && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-accent-blue hover:text-accent-orange active:text-accent-orange/80 transition-colors font-medium min-h-[44px] min-w-[44px] px-3 flex items-center justify-center rounded-lg hover:bg-accent-blue/5"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? '收起筛选面板' : '展开筛选面板'}
          >
            {isExpanded ? '收起 ▲' : '展开 ▼'}
          </button>
        )}
      </div>

      {/* Content */}
      {(!collapsible || isExpanded) && renderContent()}

      {/* Active Filters Summary (when collapsed) */}
      {collapsible && !isExpanded && hasActiveFilters && (
        <div className="text-sm text-accent-gray flex flex-wrap gap-1">
          <span className="font-medium">已应用筛选: </span>
          {filters.media_type && filters.media_type !== 'all' && (
            <span className="inline-flex items-center px-2 py-0.5 bg-accent-blue/10 text-accent-blue rounded-full text-xs">
              媒体类型: {filters.media_type === 'image' ? '图片' : '视频'}
            </span>
          )}
          {filters.activity_type && (
            <span className="inline-flex items-center px-2 py-0.5 bg-accent-blue/10 text-accent-blue rounded-full text-xs">
              活动类型: {activityTypes?.find((p) => p.value === filters.activity_type)?.display_name || filters.activity_type}
            </span>
          )}
          {filters.tags && filters.tags.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 bg-accent-blue/10 text-accent-blue rounded-full text-xs">
              标签: {filters.tags.join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
