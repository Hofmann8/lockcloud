/**
 * TimelineNav Component
 * 
 * Displays a timeline navigation showing years and months with file counts.
 * Allows filtering files by year/month selection.
 * 
 * Features:
 * - Year list with expandable months
 * - File count display for each month
 * - Click to filter by time period
 * 
 * Requirements: 3.5, 10.1, 10.2, 10.3, 10.4
 */

import { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  useColorScheme,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Timeline } from '@/types';

interface TimelineNavProps {
  timeline?: Timeline;
  selectedYear?: number;
  selectedMonth?: number;
  onYearSelect: (year: number | undefined) => void;
  onMonthSelect: (year: number, month: number | undefined) => void;
  isVisible: boolean;
  onClose: () => void;
}

const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

/**
 * TimelineNav - Timeline navigation for filtering by year/month
 * 
 * Requirements:
 * - 3.5: Support filtering by year and month via timeline navigation
 * - 10.1: Fetch directory structure from API
 * - 10.2: Display timeline showing years and months
 * - 10.3: Expand to show months with file counts
 * - 10.4: Filter files when selecting month
 */
export function TimelineNav({
  timeline,
  selectedYear,
  selectedMonth,
  onYearSelect,
  onMonthSelect,
  isVisible,
  onClose,
}: TimelineNavProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [expandedYear, setExpandedYear] = useState<number | null>(selectedYear ?? null);

  // Parse timeline data into sorted years
  const years = useMemo(() => {
    if (!timeline) return [];
    return Object.keys(timeline)
      .map(Number)
      .sort((a, b) => b - a); // Sort descending (newest first)
  }, [timeline]);

  // Get months for a specific year
  const getMonthsForYear = useCallback((year: number) => {
    if (!timeline || !timeline[year]) return [];
    const yearData = timeline[year];
    return Object.keys(yearData)
      .map(Number)
      .sort((a, b) => b - a) // Sort descending (newest first)
      .map((month) => ({
        month,
        count: yearData[month]?.count ?? 0,
      }));
  }, [timeline]);

  // Calculate total count for a year
  const getYearTotalCount = useCallback((year: number) => {
    if (!timeline || !timeline[year]) return 0;
    const yearData = timeline[year];
    return Object.values(yearData).reduce((sum, monthData) => sum + (monthData?.count ?? 0), 0);
  }, [timeline]);

  // Handle year toggle
  const handleYearToggle = useCallback((year: number) => {
    if (expandedYear === year) {
      setExpandedYear(null);
    } else {
      setExpandedYear(year);
    }
  }, [expandedYear]);

  // Handle year selection (filter by entire year)
  const handleYearSelect = useCallback((year: number) => {
    if (selectedYear === year && !selectedMonth) {
      // Deselect if already selected
      onYearSelect(undefined);
    } else {
      onYearSelect(year);
    }
    onClose();
  }, [selectedYear, selectedMonth, onYearSelect, onClose]);

  // Handle month selection
  const handleMonthSelect = useCallback((year: number, month: number) => {
    if (selectedYear === year && selectedMonth === month) {
      // Deselect if already selected
      onMonthSelect(year, undefined);
    } else {
      onMonthSelect(year, month);
    }
    onClose();
  }, [selectedYear, selectedMonth, onMonthSelect, onClose]);

  // Clear all time filters
  const handleClearFilter = useCallback(() => {
    onYearSelect(undefined);
    onClose();
  }, [onYearSelect, onClose]);

  const backgroundColor = colorScheme === 'dark' ? '#1c1c1e' : '#fff';
  const borderColor = colorScheme === 'dark' ? '#3c3c3e' : '#e5e5e5';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';
  const highlightColor = '#f97316';

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={onClose}>
            <ThemedText style={styles.closeText}>关闭</ThemedText>
          </TouchableOpacity>
          <ThemedText style={[styles.title, { color: textColor }]}>时间线</ThemedText>
          <TouchableOpacity onPress={handleClearFilter}>
            <ThemedText style={styles.clearText}>清除</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Current Selection */}
        {(selectedYear || selectedMonth) && (
          <View style={[styles.selectionBanner, { backgroundColor: '#fff7ed' }]}>
            <ThemedText style={styles.selectionText}>
              当前筛选: {selectedYear}年{selectedMonth ? `${selectedMonth}月` : ''}
            </ThemedText>
          </View>
        )}

        {/* Timeline List */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {years.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                暂无时间线数据
              </ThemedText>
            </View>
          ) : (
            years.map((year) => {
              const isExpanded = expandedYear === year;
              const isYearSelected = selectedYear === year && !selectedMonth;
              const months = getMonthsForYear(year);
              const yearTotal = getYearTotalCount(year);

              return (
                <View key={year} style={styles.yearSection}>
                  {/* Year Header */}
                  <View style={styles.yearRow}>
                    <TouchableOpacity
                      style={styles.yearExpandButton}
                      onPress={() => handleYearToggle(year)}
                    >
                      <ThemedText style={[styles.expandIcon, { color: secondaryTextColor }]}>
                        {isExpanded ? '▼' : '▶'}
                      </ThemedText>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.yearButton,
                        isYearSelected && { backgroundColor: highlightColor },
                      ]}
                      onPress={() => handleYearSelect(year)}
                    >
                      <ThemedText
                        style={[
                          styles.yearText,
                          { color: isYearSelected ? '#fff' : textColor },
                        ]}
                      >
                        {year}年
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.yearCount,
                          { color: isYearSelected ? 'rgba(255,255,255,0.8)' : secondaryTextColor },
                        ]}
                      >
                        {yearTotal} 个文件
                      </ThemedText>
                    </TouchableOpacity>
                  </View>

                  {/* Months (when expanded) */}
                  {isExpanded && (
                    <View style={styles.monthsContainer}>
                      {months.map(({ month, count }) => {
                        const isMonthSelected = selectedYear === year && selectedMonth === month;
                        
                        return (
                          <TouchableOpacity
                            key={month}
                            style={[
                              styles.monthButton,
                              { borderColor },
                              isMonthSelected && { 
                                backgroundColor: highlightColor,
                                borderColor: highlightColor,
                              },
                            ]}
                            onPress={() => handleMonthSelect(year, month)}
                          >
                            <ThemedText
                              style={[
                                styles.monthText,
                                { color: isMonthSelected ? '#fff' : textColor },
                              ]}
                            >
                              {MONTH_NAMES[month - 1]}
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.monthCount,
                                { color: isMonthSelected ? 'rgba(255,255,255,0.8)' : secondaryTextColor },
                              ]}
                            >
                              {count}
                            </ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeText: {
    fontSize: 16,
    color: '#f97316',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  clearText: {
    fontSize: 16,
    color: '#f97316',
  },
  selectionBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selectionText: {
    fontSize: 14,
    color: '#f97316',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
  yearSection: {
    marginBottom: 4,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  yearExpandButton: {
    width: 32,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandIcon: {
    fontSize: 12,
  },
  yearButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  yearText: {
    fontSize: 17,
    fontWeight: '600',
  },
  yearCount: {
    fontSize: 14,
  },
  monthsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 48,
    paddingVertical: 8,
    gap: 8,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 90,
    justifyContent: 'space-between',
  },
  monthText: {
    fontSize: 14,
  },
  monthCount: {
    fontSize: 12,
    marginLeft: 8,
  },
});

export default TimelineNav;
