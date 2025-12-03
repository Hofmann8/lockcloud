'use client';

import { useState } from 'react';
import { FileFilters as FileFiltersType } from '@/types';
import { Button } from './Button';
import { Input } from './Input';
import { zhCN } from '@/locales/zh-CN';
import { useActivityTypes } from '@/lib/hooks/useTagPresets';

interface FileFiltersProps {
  filters: FileFiltersType;
  onFilterChange: (filters: Partial<FileFiltersType>) => void;
}

export function FileFilters({ filters, onFilterChange }: FileFiltersProps) {
  const [localFilters, setLocalFilters] = useState<Partial<FileFiltersType>>({
    activity_type: filters.activity_type || '',
    date_from: filters.date_from || '',
    date_to: filters.date_to || '',
    search: filters.search || '',
  });

  const [isExpanded, setIsExpanded] = useState(false);

  // Load tag presets
  const { data: activityTypes, isLoading: loadingActivityTypes } = useActivityTypes();

  const handleApply = () => {
    const cleanFilters: Partial<FileFiltersType> = {};
    
    if (localFilters.activity_type) cleanFilters.activity_type = localFilters.activity_type;
    if (localFilters.date_from) cleanFilters.date_from = localFilters.date_from;
    if (localFilters.date_to) cleanFilters.date_to = localFilters.date_to;
    if (localFilters.search) cleanFilters.search = localFilters.search;
    
    onFilterChange(cleanFilters);
  };

  const handleReset = () => {
    setLocalFilters({
      activity_type: '',
      date_from: '',
      date_to: '',
      search: '',
    });
    onFilterChange({
      activity_type: undefined,
      date_from: undefined,
      date_to: undefined,
      search: undefined,
    });
  };

  const hasActiveFilters = filters.activity_type || filters.date_from || filters.date_to || filters.search;

  return (
    <div className="card-functional bg-primary-white p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h3 className="text-lg md:text-xl font-semibold text-primary-black">
          {zhCN.common.filter}
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-accent-blue hover:text-accent-orange transition-colors font-medium min-h-[44px] px-3 flex items-center"
        >
          {isExpanded ? '收起 ▲' : '展开 ▼'}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4 md:space-y-5">
          {/* Search Input */}
          <Input
            type="text"
            label={zhCN.common.search}
            placeholder="搜索文件名..."
            value={localFilters.search || ''}
            onChange={(e) =>
              setLocalFilters({ ...localFilters, search: e.target.value })
            }
          />

          {/* Activity Type Filter */}
          <div>
            <label className="block text-sm md:text-sm font-medium text-primary-black mb-2">
              活动类型
            </label>
            <select
              value={localFilters.activity_type || ''}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, activity_type: e.target.value })
              }
              className="input-functional w-full px-4 py-3 md:py-2 text-base md:text-base text-primary-black min-h-[44px]"
              disabled={loadingActivityTypes}
            >
              <option value="">{zhCN.filters.all}</option>
              {activityTypes?.filter(preset => preset.is_active).map((preset) => (
                <option key={preset.id} value={preset.value}>
                  {preset.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <Input
              type="date"
              label={zhCN.filters.startDate}
              value={localFilters.date_from || ''}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, date_from: e.target.value })
              }
            />
            <Input
              type="date"
              label={zhCN.filters.endDate}
              value={localFilters.date_to || ''}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, date_to: e.target.value })
              }
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="primary" onClick={handleApply} fullWidth>
              {zhCN.filters.apply}
            </Button>
            <Button variant="secondary" onClick={handleReset} fullWidth>
              {zhCN.filters.reset}
            </Button>
          </div>

          {/* Active Filters Indicator */}
          {hasActiveFilters && (
            <div className="text-xs md:text-sm text-accent-blue font-medium">
              {zhCN.common.filter}: 
              {filters.search && ` 搜索: ${filters.search}`}
              {filters.activity_type && ` 活动类型: ${activityTypes?.find(p => p.value === filters.activity_type)?.display_name || filters.activity_type}`}
              {filters.date_from && ` ${zhCN.filters.startDate}: ${filters.date_from}`}
              {filters.date_to && ` ${zhCN.filters.endDate}: ${filters.date_to}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
