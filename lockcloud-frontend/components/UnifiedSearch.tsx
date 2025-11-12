'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { FileFilters } from '@/types';
import { useActivityTypes, useInstructors } from '@/lib/hooks/useTagPresets';

interface UnifiedSearchProps {
  filters: FileFilters;
  onFilterChange: (filters: Partial<FileFilters>) => void;
}

interface SearchSuggestion {
  type: 'activity_type' | 'instructor' | 'date' | 'filename';
  label: string;
  value: string;
  display: string;
}

export function UnifiedSearch({ filters, onFilterChange }: UnifiedSearchProps) {
  const [searchInput, setSearchInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: activityTypes } = useActivityTypes();
  const { data: instructors } = useInstructors();

  // Generate suggestions based on input (memoized)
  const suggestions = useMemo(() => {
    if (!searchInput.trim()) {
      return [];
    }

    const input = searchInput.toLowerCase().trim();
    const newSuggestions: SearchSuggestion[] = [];

    // Match activity types
    activityTypes?.filter(preset => preset.is_active).forEach(preset => {
      if (preset.display_name.toLowerCase().includes(input) || 
          preset.value.toLowerCase().includes(input)) {
        newSuggestions.push({
          type: 'activity_type',
          label: '活动类型',
          value: preset.value,
          display: preset.display_name
        });
      }
    });

    // Match instructors
    instructors?.filter(preset => preset.is_active).forEach(preset => {
      if (preset.display_name.toLowerCase().includes(input) || 
          preset.value.toLowerCase().includes(input)) {
        newSuggestions.push({
          type: 'instructor',
          label: '带训老师',
          value: preset.value,
          display: preset.display_name
        });
      }
    });

    // Match date patterns (YYYY-MM-DD, YYYY-MM, YYYY)
    const datePatterns = [
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,  // YYYY-MM-DD
      /^(\d{4})-(\d{1,2})$/,             // YYYY-MM
      /^(\d{4})$/                        // YYYY
    ];

    for (const pattern of datePatterns) {
      const match = input.match(pattern);
      if (match) {
        const year = match[1];
        const month = match[2] ? match[2].padStart(2, '0') : null;
        const day = match[3] ? match[3].padStart(2, '0') : null;

        if (day) {
          const dateStr = `${year}-${month}-${day}`;
          newSuggestions.push({
            type: 'date',
            label: '日期',
            value: dateStr,
            display: `${year}年${parseInt(month!)}月${parseInt(day)}日`
          });
        } else if (month) {
          const startDate = `${year}-${month}-01`;
          const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
          const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;
          newSuggestions.push({
            type: 'date',
            label: '月份',
            value: `${startDate}|${endDate}`,
            display: `${year}年${parseInt(month)}月`
          });
        } else {
          const startDate = `${year}-01-01`;
          const endDate = `${year}-12-31`;
          newSuggestions.push({
            type: 'date',
            label: '年份',
            value: `${startDate}|${endDate}`,
            display: `${year}年`
          });
        }
        break;
      }
    }

    // If no specific matches, treat as filename search
    if (newSuggestions.length === 0) {
      newSuggestions.push({
        type: 'filename',
        label: '文件名',
        value: searchInput,
        display: searchInput
      });
    }

    return newSuggestions;
  }, [searchInput, activityTypes, instructors]);

  // Handle suggestion selection
  const selectSuggestion = (suggestion: SearchSuggestion) => {
    const newFilters: Partial<FileFilters> = {};

    switch (suggestion.type) {
      case 'activity_type':
        newFilters.activity_type = suggestion.value;
        break;
      case 'instructor':
        newFilters.instructor = suggestion.value;
        break;
      case 'date':
        if (suggestion.value.includes('|')) {
          const [start, end] = suggestion.value.split('|');
          newFilters.date_from = start;
          newFilters.date_to = end;
        } else {
          newFilters.date_from = suggestion.value;
          newFilters.date_to = suggestion.value;
        }
        break;
      case 'filename':
        newFilters.search = suggestion.value;
        break;
    }

    onFilterChange(newFilters);
    setSearchInput('');
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && searchInput.trim()) {
        // Direct search on Enter
        onFilterChange({ search: searchInput });
        setSearchInput('');
        setShowSuggestions(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          selectSuggestion(suggestions[selectedIndex]);
        } else if (suggestions.length > 0) {
          selectSuggestion(suggestions[0]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Clear all filters
  const clearFilters = () => {
    onFilterChange({
      activity_type: undefined,
      instructor: undefined,
      date_from: undefined,
      date_to: undefined,
      search: undefined
    });
    setSearchInput('');
  };

  // Get active filter tags
  const getActiveFilters = () => {
    const tags: Array<{ label: string; key: string }> = [];

    if (filters.search) {
      tags.push({ label: `文件名: ${filters.search}`, key: 'search' });
    }

    if (filters.activity_type) {
      const preset = activityTypes?.find(p => p.value === filters.activity_type);
      tags.push({ 
        label: `活动: ${preset?.display_name || filters.activity_type}`, 
        key: 'activity_type' 
      });
    }

    if (filters.instructor) {
      const preset = instructors?.find(p => p.value === filters.instructor);
      tags.push({ 
        label: `老师: ${preset?.display_name || filters.instructor}`, 
        key: 'instructor' 
      });
    }

    if (filters.date_from || filters.date_to) {
      const from = filters.date_from || '...';
      const to = filters.date_to || '...';
      if (from === to) {
        tags.push({ label: `日期: ${from}`, key: 'date' });
      } else {
        tags.push({ label: `日期: ${from} ~ ${to}`, key: 'date' });
      }
    }

    return tags;
  };

  const activeFilters = getActiveFilters();
  const hasActiveFilters = activeFilters.length > 0;

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => searchInput && setShowSuggestions(true)}
            placeholder="搜索文件名、活动类型、老师、日期 (如: 2025-03 或 常规训练)..."
            className="w-full px-4 py-3 pr-10 text-base border-2 border-accent-gray/30 rounded-lg 
                     focus:border-accent-blue focus:outline-none transition-colors
                     placeholder:text-accent-gray/60"
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-accent-gray"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-2 bg-white border-2 border-accent-gray/30 rounded-lg shadow-lg max-h-80 overflow-y-auto"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.value}`}
                onClick={() => selectSuggestion(suggestion)}
                className={`w-full px-4 py-3 text-left hover:bg-accent-blue/5 transition-colors
                          ${index === selectedIndex ? 'bg-accent-blue/10' : ''}
                          ${index > 0 ? 'border-t border-accent-gray/20' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-accent-blue bg-accent-blue/10 px-2 py-1 rounded">
                    {suggestion.label}
                  </span>
                  <span className="text-base text-primary-black">
                    {suggestion.display}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-accent-gray">当前筛选:</span>
          {activeFilters.map((tag) => (
            <button
              key={tag.key}
              onClick={() => {
                const clearFilter: Partial<FileFilters> = {};
                if (tag.key === 'date') {
                  clearFilter.date_from = undefined;
                  clearFilter.date_to = undefined;
                } else {
                  clearFilter[tag.key as keyof FileFilters] = undefined;
                }
                onFilterChange(clearFilter);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue/10 
                       text-accent-blue text-sm rounded-full hover:bg-accent-blue/20 
                       transition-colors group"
            >
              <span>{tag.label}</span>
              <svg
                className="w-4 h-4 group-hover:text-accent-orange transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          ))}
          <button
            onClick={clearFilters}
            className="text-sm text-accent-orange hover:text-accent-orange/80 
                     font-medium transition-colors"
          >
            清除全部
          </button>
        </div>
      )}
    </div>
  );
}
