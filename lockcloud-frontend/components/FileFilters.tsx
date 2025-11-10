'use client';

import { useState } from 'react';
import { FileFilters as FileFiltersType } from '@/types';
import { Button } from './Button';
import { Input } from './Input';
import { zhCN } from '@/locales/zh-CN';

interface FileFiltersProps {
  filters: FileFiltersType;
  onFilterChange: (filters: Partial<FileFiltersType>) => void;
}

export function FileFilters({ filters, onFilterChange }: FileFiltersProps) {
  const [localFilters, setLocalFilters] = useState<Partial<FileFiltersType>>({
    directory: filters.directory || '',
    start_date: filters.start_date || '',
    end_date: filters.end_date || '',
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const handleApply = () => {
    const cleanFilters: Partial<FileFiltersType> = {};
    
    if (localFilters.directory) cleanFilters.directory = localFilters.directory;
    if (localFilters.start_date) cleanFilters.start_date = localFilters.start_date;
    if (localFilters.end_date) cleanFilters.end_date = localFilters.end_date;
    
    onFilterChange(cleanFilters);
  };

  const handleReset = () => {
    setLocalFilters({
      directory: '',
      start_date: '',
      end_date: '',
    });
    onFilterChange({
      directory: undefined,
      start_date: undefined,
      end_date: undefined,
    });
  };

  const hasActiveFilters = filters.directory || filters.start_date || filters.end_date;

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
          {/* Directory Filter */}
          <div>
            <label className="block text-sm md:text-sm font-medium text-primary-black mb-2">
              {zhCN.filters.directory}
            </label>
            <select
              value={localFilters.directory || ''}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, directory: e.target.value })
              }
              className="input-functional w-full px-4 py-3 md:py-2 text-base md:text-base text-primary-black min-h-[44px]"
            >
              <option value="">{zhCN.filters.all}</option>
              <option value="/rehearsals/">{zhCN.directories.rehearsals}</option>
              <option value="/events/">{zhCN.directories.events}</option>
              <option value="/members/">{zhCN.directories.members}</option>
              <option value="/resources/">{zhCN.directories.resources}</option>
              <option value="/admin/">{zhCN.directories.admin}</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <Input
              type="date"
              label={zhCN.filters.startDate}
              value={localFilters.start_date || ''}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, start_date: e.target.value })
              }
            />
            <Input
              type="date"
              label={zhCN.filters.endDate}
              value={localFilters.end_date || ''}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, end_date: e.target.value })
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
              {zhCN.common.filter}: {filters.directory && `${zhCN.filters.directory} `}
              {filters.start_date && `${zhCN.filters.startDate}: ${filters.start_date} `}
              {filters.end_date && `${zhCN.filters.endDate}: ${filters.end_date}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
