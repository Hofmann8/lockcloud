'use client';

import { useState, useRef, useEffect } from 'react';
import { TagPreset } from '@/types';

interface FlexibleTagInputProps {
  label: string;
  value: string;
  onChange: (value: string, displayName: string) => void;
  options: TagPreset[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  allowCustom?: boolean;
  onAddNew?: (value: string, displayName: string) => Promise<void>;
}

export function FlexibleTagInput({
  label,
  value,
  onChange,
  options,
  placeholder = '输入或选择',
  required = false,
  error,
  disabled = false,
  icon,
  allowCustom = true,
  onAddNew,
}: FlexibleTagInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update search term when value changes
  useEffect(() => {
    if (value) {
      const option = options.find(opt => opt.value === value);
      setSearchTerm(option?.display_name || value);
    } else {
      setSearchTerm('');
    }
  }, [value, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsAddingNew(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (option: TagPreset) => {
    onChange(option.value, option.display_name);
    setSearchTerm(option.display_name);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
    
    // If exact match exists, select it
    const exactMatch = options.find(
      opt => opt.display_name.toLowerCase() === newValue.toLowerCase()
    );
    if (exactMatch) {
      onChange(exactMatch.value, exactMatch.display_name);
    } else if (!allowCustom) {
      onChange('', '');
    }
  };

  const handleAddNew = async () => {
    if (!searchTerm.trim() || !newDisplayName.trim()) return;
    
    setIsAddingNew(true);
    try {
      // Generate value from display name (convert to snake_case)
      const generatedValue = newDisplayName
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w\u4e00-\u9fa5_]/g, '');
      
      if (onAddNew) {
        await onAddNew(generatedValue, newDisplayName);
      }
      
      onChange(generatedValue, newDisplayName);
      setSearchTerm(newDisplayName);
      setIsOpen(false);
      setNewDisplayName('');
    } catch (error) {
      console.error('Failed to add new tag:', error);
    } finally {
      setIsAddingNew(false);
    }
  };

  const showAddNewOption = allowCustom && searchTerm && filteredOptions.length === 0;

  return (
    <div className="w-full relative">
      <label className="block text-sm font-medium text-primary-black mb-2 flex items-center gap-1.5">
        {icon}
        {label}
        {required && <span className="text-semantic-error">*</span>}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
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
        />

        {/* Dropdown icon */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-accent-gray hover:text-primary-black transition-colors"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-accent-gray/20 rounded-lg shadow-lg max-h-64 overflow-y-auto"
          >
            {filteredOptions.length > 0 ? (
              <div className="py-1">
                {filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className="w-full px-4 py-2.5 text-left hover:bg-accent-green/10 transition-colors flex items-center justify-between group"
                  >
                    <span className="text-sm text-primary-black">{option.display_name}</span>
                    {value === option.value && (
                      <svg className="w-4 h-4 text-accent-green" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Add new option */}
            {showAddNewOption && (
              <div className="border-t border-accent-gray/20 p-3 bg-accent-gray/5">
                <div className="space-y-2">
                  <p className="text-xs text-accent-gray">添加新标签</p>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="输入显示名称"
                    className="input-functional w-full px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNew();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddNew}
                    disabled={isAddingNew || !newDisplayName.trim()}
                    className="w-full px-3 py-2 text-sm bg-accent-green text-white rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isAddingNew ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        添加中...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        添加到列表
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {filteredOptions.length === 0 && !showAddNewOption && (
              <div className="px-4 py-8 text-center text-sm text-accent-gray">
                没有找到匹配的选项
              </div>
            )}
          </div>
        )}
      </div>

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
