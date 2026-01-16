import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'btn-functional cursor-pointer';
  
  // Responsive sizing - mobile-first approach
  // Mobile: ensures 44x44px minimum touch target
  // Desktop: standard sizes
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm md:px-3 md:py-1.5 md:text-sm',
    md: 'px-4 py-2 text-base md:px-4 md:py-2 md:text-base',
    lg: 'px-6 py-3 text-lg md:px-6 md:py-3 md:text-lg',
  };
  
  const widthStyle = fullWidth ? 'w-full' : '';
  
  // Size-specific spinner dimensions
  const spinnerSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <button
      className={`${baseStyles} ${variant} ${sizeStyles[size]} ${widthStyle} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg 
          className={`animate-spin ${spinnerSizes[size]}`}
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && icon && icon}
      <span className={loading ? 'opacity-70' : ''}>{children}</span>
    </button>
  );
}
