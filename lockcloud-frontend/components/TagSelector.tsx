'use client';

import React, { useId } from 'react';
import { TagPreset } from '@/types';

interface TagSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: TagPreset[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export function TagSelector({
  label,
  value,
  onChange,
  options,
  placeholder = '请选择',
  required = false,
  error,
  disabled = false,
}: TagSelectorProps) {
  const generatedId = useId();
  const selectId = `tag-selector-${generatedId}`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-primary-black mb-2"
        >
          {label}
          {required && <span className="text-semantic-error ml-1">*</span>}
        </label>
      )}
      
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          input-functional
          w-full
          px-4
          py-2.5
          text-base
          text-primary-black
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'error' : ''}
        `}
      >
        <option value="">{placeholder}</option>
        {options
          .filter((option) => option.is_active)
          .map((option) => (
            <option key={option.id} value={option.value}>
              {option.display_name}
            </option>
          ))}
      </select>

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
          <p className="text-sm text-semantic-error leading-relaxed">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
