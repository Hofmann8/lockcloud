import React from 'react';

interface ErrorCardProps {
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'error' | 'warning' | 'info';
}

export function ErrorCard({ 
  title, 
  message, 
  action,
  variant = 'error' 
}: ErrorCardProps) {
  const colors = {
    error: {
      bg: 'bg-semantic-error/10',
      border: 'border-semantic-error/30',
      text: 'text-semantic-error',
      icon: 'text-semantic-error',
    },
    warning: {
      bg: 'bg-semantic-warning/10',
      border: 'border-semantic-warning/30',
      text: 'text-semantic-warning',
      icon: 'text-semantic-warning',
    },
    info: {
      bg: 'bg-semantic-info/10',
      border: 'border-semantic-info/30',
      text: 'text-semantic-info',
      icon: 'text-semantic-info',
    },
  };

  const style = colors[variant];

  const icons = {
    error: (
      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-4 md:p-6`}>
      <div className="flex items-start gap-3 md:gap-4">
        <div className={`${style.icon} shrink-0 mt-0.5`}>
          {icons[variant]}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`text-base md:text-lg font-semibold ${style.text} mb-1`}>
              {title}
            </h3>
          )}
          <p className="text-sm md:text-base text-primary-black leading-relaxed">
            {message}
          </p>
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-3 text-sm md:text-sm font-medium ${style.text} hover:underline focus:outline-none focus:underline`}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
