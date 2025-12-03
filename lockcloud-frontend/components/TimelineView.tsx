'use client';

import { useState, useMemo } from 'react';
import { File } from '@/types';
import { FileCardSimple } from './FileCardSimple';
import { zhCN } from '@/locales/zh-CN';

interface TimelineGroup {
  year: number | null;
  months: {
    month: number | null;
    files: File[];
    count: number;
  }[];
}

interface TimelineViewProps {
  files: File[];
  onFileUpdate?: () => void;
  /** Render custom file card with selection support */
  renderFileCard?: (file: File) => React.ReactNode;
}

/**
 * TimelineView - Groups files by year and month in descending chronological order
 * 
 * Requirements:
 * - 1.1: Display files grouped by year and month in descending chronological order
 * - 1.2: Expand to show all months when a year is selected
 * - 1.3: Display all files from a selected month
 * - 1.4: Group files without activity_date under "Undated" category
 */
export function TimelineView({ files, onFileUpdate, renderFileCard }: TimelineViewProps) {
  const [expandedYears, setExpandedYears] = useState<Set<number | null>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Group files by year and month
  const timelineGroups = useMemo(() => {
    const groups: Map<number | null, Map<number | null, File[]>> = new Map();

    files.forEach((file) => {
      let year: number | null = null;
      let month: number | null = null;

      if (file.activity_date) {
        const date = new Date(file.activity_date);
        if (!isNaN(date.getTime())) {
          year = date.getFullYear();
          month = date.getMonth() + 1; // 1-12
        }
      }

      if (!groups.has(year)) {
        groups.set(year, new Map());
      }
      const yearGroup = groups.get(year)!;
      
      if (!yearGroup.has(month)) {
        yearGroup.set(month, []);
      }
      yearGroup.get(month)!.push(file);
    });

    // Convert to array and sort
    const result: TimelineGroup[] = [];
    
    // Sort years in descending order, with null (undated) at the end
    const sortedYears = Array.from(groups.keys()).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return b - a;
    });

    sortedYears.forEach((year) => {
      const yearGroup = groups.get(year)!;
      
      // Sort months in descending order, with null at the end
      const sortedMonths = Array.from(yearGroup.keys()).sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return b - a;
      });

      const months = sortedMonths.map((month) => ({
        month,
        files: yearGroup.get(month)!,
        count: yearGroup.get(month)!.length,
      }));

      result.push({ year, months });
    });

    return result;
  }, [files]);

  const toggleYear = (year: number | null) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  const toggleMonth = (year: number | null, month: number | null) => {
    const key = `${year}-${month}`;
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getYearLabel = (year: number | null): string => {
    return year === null ? '未标注日期' : `${year}${zhCN.units.year}`;
  };

  const getMonthLabel = (month: number | null): string => {
    return month === null ? '未知月份' : `${month}${zhCN.units.month}`;
  };

  const getYearFileCount = (group: TimelineGroup): number => {
    return group.months.reduce((sum, m) => sum + m.count, 0);
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-accent-gray">
        {zhCN.files.noFiles}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {timelineGroups.map((yearGroup) => {
        const isYearExpanded = expandedYears.has(yearGroup.year);
        const yearFileCount = getYearFileCount(yearGroup);

        return (
          <div key={yearGroup.year ?? 'undated'} className="border border-accent-gray/20 rounded-xl overflow-hidden">
            {/* Year Header */}
            <button
              onClick={() => toggleYear(yearGroup.year)}
              className="w-full flex items-center justify-between p-4 bg-accent-gray/5 hover:bg-accent-gray/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`w-5 h-5 text-accent-gray transition-transform ${isYearExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-lg font-semibold text-primary-black">
                  {getYearLabel(yearGroup.year)}
                </span>
              </div>
              <span className="text-sm text-accent-gray">
                {yearFileCount} {zhCN.files.fileCount}
              </span>
            </button>

            {/* Months */}
            {isYearExpanded && (
              <div className="border-t border-accent-gray/20">
                {yearGroup.months.map((monthGroup) => {
                  const monthKey = `${yearGroup.year}-${monthGroup.month}`;
                  const isMonthExpanded = expandedMonths.has(monthKey);

                  return (
                    <div key={monthGroup.month ?? 'unknown'}>
                      {/* Month Header */}
                      <button
                        onClick={() => toggleMonth(yearGroup.year, monthGroup.month)}
                        className="w-full flex items-center justify-between p-3 pl-8 bg-primary-white hover:bg-accent-gray/5 transition-colors border-b border-accent-gray/10"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 text-accent-gray transition-transform ${isMonthExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-medium text-primary-black">
                            {getMonthLabel(monthGroup.month)}
                          </span>
                        </div>
                        <span className="text-sm text-accent-gray">
                          {monthGroup.count} {zhCN.files.fileCount}
                        </span>
                      </button>

                      {/* Files Grid */}
                      {isMonthExpanded && (
                        <div className="p-4 bg-primary-white">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {monthGroup.files.map((file) => (
                              renderFileCard ? (
                                <div key={file.id}>{renderFileCard(file)}</div>
                              ) : (
                                <FileCardSimple
                                  key={file.id}
                                  file={file}
                                  onFileUpdate={onFileUpdate}
                                />
                              )
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
