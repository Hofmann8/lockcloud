'use client';

import { useState } from 'react';

interface InlineCalendarProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function InlineCalendar({
  value,
  onChange,
  disabled = false,
}: InlineCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      return new Date(value + 'T00:00:00');
    }
    return new Date();
  });

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
    if (disabled) return;
    
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    onChange(`${year}-${month}-${dayStr}`);
  };

  const handlePrevYear = () => {
    if (disabled) return;
    setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth()));
  };

  const handleNextYear = () => {
    if (disabled) return;
    setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth()));
  };

  const handlePrevMonth = () => {
    if (disabled) return;
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    if (disabled) return;
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleToday = () => {
    if (disabled) return;
    const today = new Date();
    setCurrentMonth(today);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    onChange(`${year}-${month}-${day}`);
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
    <div className={`bg-white rounded-lg border border-accent-gray/20 p-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevYear}
            className="p-1.5 hover:bg-accent-gray/10 rounded-lg transition-colors"
            title="上一年"
          >
            <svg className="w-5 h-5 text-primary-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-accent-gray/10 rounded-lg transition-colors"
            title="上一月"
          >
            <svg className="w-5 h-5 text-primary-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="text-base font-semibold text-primary-black">
          {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-accent-gray/10 rounded-lg transition-colors"
            title="下一月"
          >
            <svg className="w-5 h-5 text-primary-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNextYear}
            className="p-1.5 hover:bg-accent-gray/10 rounded-lg transition-colors"
            title="下一年"
          >
            <svg className="w-5 h-5 text-primary-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-accent-gray py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => (
          <div key={index}>
            {day ? (
              <button
                type="button"
                onClick={() => handleDayClick(day)}
                className={`
                  w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-all
                  ${isSelectedDay(day)
                    ? 'bg-accent-green text-white font-bold shadow-sm scale-105'
                    : isToday(day)
                    ? 'bg-accent-green/10 text-accent-green font-semibold ring-1 ring-accent-green/30'
                    : 'hover:bg-accent-gray/10 text-primary-black'
                  }
                `}
              >
                {day}
              </button>
            ) : (
              <div className="w-full aspect-square" />
            )}
          </div>
        ))}
      </div>

      {/* Today button */}
      <div className="mt-3 pt-3 border-t border-accent-gray/10">
        <button
          type="button"
          onClick={handleToday}
          className="w-full px-3 py-2 text-sm text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors font-medium"
        >
          今天
        </button>
      </div>
    </div>
  );
}
