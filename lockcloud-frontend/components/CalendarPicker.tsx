'use client';

import { useState, useRef, useEffect } from 'react';

interface CalendarPickerProps {
  label: string;
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function CalendarPicker({
  label,
  value,
  onChange,
  required = false,
  error,
  disabled = false,
  icon,
}: CalendarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date for display
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  };

  // Get days in month
  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days: (number | null)[] = [];

    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const handleDayClick = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    onChange(`${year}-${month}-${dayStr}`);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    onChange(`${year}-${month}-${day}`);
    setIsOpen(false);
  };

  const isSelectedDay = (day: number): boolean => {
    if (!value) return false;
    const selectedDate = new Date(value + 'T00:00:00');
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === currentMonth.getMonth() &&
      selectedDate.getFullYear() === currentMonth.getFullYear()
    );
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getFullYear() === currentMonth.getFullYear()
    );
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const calendarDays = generateCalendarDays();

  return (
    <div className="w-full relative">
      <label className="block text-sm font-medium text-primary-black mb-2 flex items-center gap-1.5">
        {icon}
        {label}
        {required && <span className="text-semantic-error">*</span>}
      </label>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          input-functional
          w-full
          px-4
          py-2.5
          text-base
          text-left
          flex items-center justify-between
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'error' : ''}
        `}
      >
        <span className={value ? 'text-primary-black' : 'text-accent-gray'}>
          {value ? formatDate(value) : '选择日期'}
        </span>
        <svg
          className={`w-5 h-5 text-accent-gray transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Calendar dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-accent-gray/20 rounded-lg shadow-lg p-4"
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 hover:bg-accent-gray/10 active:bg-accent-gray/20 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="上个月"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="text-base font-semibold text-primary-black">
              {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 hover:bg-accent-gray/10 active:bg-accent-gray/20 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="下个月"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Week days header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-accent-gray py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days - Mobile: larger touch targets */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <div key={index}>
                {day ? (
                  <button
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={`
                      w-full aspect-square min-h-[36px] sm:min-h-[32px] flex items-center justify-center text-sm rounded-lg transition-colors
                      ${isSelectedDay(day)
                        ? 'bg-accent-green text-white font-semibold'
                        : isToday(day)
                        ? 'bg-accent-green/10 text-accent-green font-medium'
                        : 'hover:bg-accent-gray/10 active:bg-accent-gray/20 text-primary-black'
                      }
                    `}
                    aria-label={`${currentMonth.getMonth() + 1}月${day}日`}
                  >
                    {day}
                  </button>
                ) : (
                  <div className="w-full aspect-square min-h-[36px] sm:min-h-[32px]" />
                )}
              </div>
            ))}
          </div>

          {/* Today button */}
          <div className="mt-3 pt-3 border-t border-accent-gray/20">
            <button
              type="button"
              onClick={handleToday}
              className="w-full px-3 py-3 text-base text-accent-green hover:bg-accent-green/10 active:bg-accent-green/20 rounded-lg transition-colors font-medium min-h-[44px]"
            >
              今天
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-1.5">
          <svg
            className="w-4 h-4 text-semantic-error shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-semantic-error leading-relaxed">{error}</p>
        </div>
      )}
    </div>
  );
}
