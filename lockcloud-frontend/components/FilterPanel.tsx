'use client';

import React, { useState, useCallback } from 'react';
import { FileFilters as FileFiltersType } from '@/types';
import { MediaTypeFilter, MediaType } from './MediaTypeFilter';
import { FreeTagFilter } from './FreeTagFilter';
import { Button } from './Button';
import { useActivityTypes, useInstructors } from '@/lib/hooks/useTagPresets';

interface FilterPanelProps {
  filters: FileFiltersType;
  onFilterChange: (filters: Partial<FileFiltersType>) => void;
  showSystemTags?: boolean; // Deprecated - kept for compatibility but defaults to false
  showMediaType?: boolean;
  showFreeTags?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

/**
 * FilterPanel component - Unified filter panel combining all filter types
 * Requirements: 8.4
 */
export function FilterPanel({
  filters,
  onFilterChange,
  showSystemTags = false, // Disabled by default - new system uses year/month + free tags
  showMediaType = true,
  showFreeTags = true,
  collapsible = true,
  defaultExpanded = false,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Local state for filters before applying
  const [localFilters, setLocalFilters] = useState<Partial<FileFiltersType>>({
    media_type: filters.media_type || 'all',
    activity_type: filters.activity_type || '',
    instructor: filters.instructor || '',
    tags: filters.tags || [],
  });

  // Load tag presets
  const { data: activityTypes, isLoading: loadingActivityTypes } = useActivityTypes();
  const { data: instructors, isLoading: loadingInstructors } = useInstructors();

  const handleMediaTypeChange = useCallback((value: MediaType) => {
    setLocalFilters((prev) => ({ ...prev, media_type: value }));
  }, []);

  const handleActivityTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalFilters((prev) => ({ ...prev, activity_type: e.target.value }));
  }, []);

  const handleInstructorChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalFilters((prev) => ({ ...prev, instructor: e.target.value }));
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
    if (localFilters.instructor) {
      cleanFilters.instructor = localFilters.instructor;
    }
    if (localFilters.tags && localFilters.tags.length > 0) {
      cleanFilters.tags = localFilters.tags;
    }

    onFilterChange(cleanFilters);
  }, [localFilters, onFilterChange]);

  const handleReset = useCallback(() => {
    setLocalFilters({
      media_type: 'all',
      activity_type: '',
      instructor: '',
      tags: [],
    });
    onFilterChange({
      media_type: undefined,
      activity_type: undefined,
      instructor: undefined,
      tags: undefined,
    });
  }, [onFilterChange]);

  const hasActiveFilters =
    (filters.media_type && filters.media_type !== 'all') ||
    filters.activity_type ||
    filters.instructor ||
    (filters.tags && filters.tags.length > 0);

  const activeFilterCount = [
    filters.media_type && filters.media_type !== 'all',
    filters.activity_type,
    filters.instructor,
    filters.tags && filters.tags.length > 0,
  ].filter(Boolean).length;

  const renderContent = () => (
    <div className="space-y-5">
      {/* Media Type Filter */}
      {showMediaType && (
        <MediaTypeFilter
          value={localFilters.media_type || 'all'}
          onChange={handleMediaTypeChange}
        />
      )}

      {/* System Tags Section */}
      {showSystemTags && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-accent-gray uppercase tracking-wide">
            系统标签
          </h4>

          {/* Activity Type Filter */}
          <div>
            <label className="block text-sm font-medium text-primary-black mb-2">
              活动类型
            </label>
            <select
              value={localFilters.activity_type || ''}
              onChange={handleActivityTypeChange}
              className="input-functional w-full px-4 py-2.5 text-base text-primary-black min-h-[44px]"
              disabled={loadingActivityTypes}
            >
              <option value="">全部</option>
              {activityTypes?.filter((preset) => preset.is_active).map((preset) => (
                <option key={preset.id} value={preset.value}>
                  {preset.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Instructor Filter */}
          <div>
            <label className="block text-sm font-medium text-primary-black mb-2">
              带训老师
            </label>
            <select
              value={localFilters.instructor || ''}
              onChange={handleInstructorChange}
              className="input-functional w-full px-4 py-2.5 text-base text-primary-black min-h-[44px]"
              disabled={loadingInstructors}
            >
              <option value="">全部</option>
              {instructors?.filter((preset) => preset.is_active).map((preset) => (
                <option key={preset.id} value={preset.value}>
                  {preset.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Free Tags Section */}
      {showFreeTags && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-accent-gray uppercase tracking-wide">
            自由标签
          </h4>
          <FreeTagFilter
            selectedTags={localFilters.tags || []}
            onChange={handleFreeTagsChange}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button variant="primary" onClick={handleApply} fullWidth>
          应用筛选
        </Button>
        <Button variant="secondary" onClick={handleReset} fullWidth>
          重置
        </Button>
      </div>
    </div>
  );

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
            className="text-accent-blue hover:text-accent-orange transition-colors font-medium min-h-[44px] px-3 flex items-center"
          >
            {isExpanded ? '收起 ▲' : '展开 ▼'}
          </button>
        )}
      </div>

      {/* Content */}
      {(!collapsible || isExpanded) && renderContent()}

      {/* Active Filters Summary (when collapsed) */}
      {collapsible && !isExpanded && hasActiveFilters && (
        <div className="text-sm text-accent-gray">
          <span className="font-medium">已应用筛选: </span>
          {filters.media_type && filters.media_type !== 'all' && (
            <span className="inline-block mr-2">
              媒体类型: {filters.media_type === 'image' ? '图片' : '视频'}
            </span>
          )}
          {filters.activity_type && (
            <span className="inline-block mr-2">
              活动类型: {activityTypes?.find((p) => p.value === filters.activity_type)?.display_name || filters.activity_type}
            </span>
          )}
          {filters.instructor && (
            <span className="inline-block mr-2">
              带训老师: {instructors?.find((p) => p.value === filters.instructor)?.display_name || filters.instructor}
            </span>
          )}
          {filters.tags && filters.tags.length > 0 && (
            <span className="inline-block">
              标签: {filters.tags.join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
