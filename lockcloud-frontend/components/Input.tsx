import React, { useId } from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  helperText?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  fullWidth?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  prefix,
  suffix,
  fullWidth = true,
  className = '',
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || `input-${props.name || generatedId}`;
  
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm md:text-sm font-medium text-primary-black mb-1.5 md:mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {prefix && (
          <div className="absolute left-3 md:left-3 top-1/2 -translate-y-1/2 text-accent-gray pointer-events-none">
            {prefix}
          </div>
        )}
        <input
          id={inputId}
          className={`
            input-functional
            ${fullWidth ? 'w-full' : ''}
            ${prefix ? 'pl-10 md:pl-10' : 'pl-4 md:pl-4'}
            ${suffix ? 'pr-10 md:pr-10' : 'pr-4 md:pr-4'}
            py-2 md:py-2
            text-base md:text-base
            text-primary-black
            placeholder:text-accent-gray
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'error' : ''}
            ${className}
          `}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3 md:right-3 top-1/2 -translate-y-1/2 text-accent-gray pointer-events-none">
            {suffix}
          </div>
        )}
      </div>
      {error && (
        <div className="mt-1.5 flex items-start gap-1.5">
          <svg className="w-4 h-4 text-semantic-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm md:text-sm text-semantic-error leading-relaxed">{error}</p>
        </div>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-sm md:text-sm text-accent-gray">{helperText}</p>
      )}
    </div>
  );
}
