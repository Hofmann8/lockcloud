'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchTags, getTags } from '@/lib/api/tags';
import { TagWithCount } from '@/types';

interface TagInputProps {
  /** Callback when a tag is selected or created */
  onTagSelect: (tagName: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Tags to exclude from suggestions (already selected) */
  excludeTags?: string[];
  /** Auto-focus the input on mount */
  autoFocus?: boolean;
  /** Label for the input */
  label?: string;
  /** Helper text below the input */
  helperText?: string;
}

/**
 * TagInput component - Input field with tag suggestions dropdown
 * Shows matching tags ordered by usage, allows creating new tags
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export function TagInput({
  onTagSelect,
  placeholder = '输入标签名称...',
  disabled = false,
  excludeTags = [],
  autoFocus = false,
  label,
  helperText,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all tags for initial display
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
    staleTime: 30000,
  });

  // Search tags when input changes
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['tags', 'search', inputValue],
    queryFn: () => searchTags(inputValue.trim(), 20),
    enabled: inputValue.trim().length > 0,
    staleTime: 10000,
  });


  // Use search results if searching, otherwise show all tags (limited)
  const displayTags = inputValue.trim().length > 0 ? searchResults : allTags.slice(0, 10);

  // Filter out excluded tags and sort by usage count (descending)
  const availableTags = displayTags
    .filter((tag) => !excludeTags.includes(tag.name))
    .sort((a, b) => b.count - a.count);

  // Check if input matches an existing tag exactly
  const exactMatch = availableTags.find(
    (tag) => tag.name.toLowerCase() === inputValue.trim().toLowerCase()
  );

  // Check if we can create a new tag (input has value and no exact match)
  const canCreateNew = inputValue.trim().length > 0 && !exactMatch;

  const handleSelectTag = useCallback((tagName: string) => {
    onTagSelect(tagName.trim());
    setInputValue('');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, [onTagSelect]);

  const handleCreateTag = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      onTagSelect(trimmedValue);
      setInputValue('');
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    }
  }, [inputValue, onTagSelect]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsDropdownOpen(true);
    setHighlightedIndex(-1);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = availableTags.length + (canCreateNew ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsDropdownOpen(true);
        setHighlightedIndex((prev) => 
          prev < totalItems - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setIsDropdownOpen(true);
        setHighlightedIndex((prev) => 
          prev > 0 ? prev - 1 : totalItems - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < availableTags.length) {
          handleSelectTag(availableTags[highlightedIndex].name);
        } else if (highlightedIndex === availableTags.length && canCreateNew) {
          handleCreateTag();
        } else if (canCreateNew) {
          handleCreateTag();
        } else if (availableTags.length > 0) {
          handleSelectTag(availableTags[0].name);
        }
        break;
      case 'Escape':
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const showDropdown = isDropdownOpen && (availableTags.length > 0 || canCreateNew);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-primary-black mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="input-functional w-full px-4 py-2 text-base text-primary-black placeholder:text-accent-gray disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={label || '标签输入'}
          aria-expanded={showDropdown}
          aria-controls="tag-suggestions-listbox"
          aria-haspopup="listbox"
          role="combobox"
          autoComplete="off"
        />

        {/* Loading indicator */}
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 animate-spin text-accent-gray" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {/* Dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            id="tag-suggestions-listbox"
            className="absolute z-50 w-full mt-1 bg-primary-white border border-accent-gray/30 rounded-lg shadow-lg max-h-64 overflow-y-auto"
            role="listbox"
          >
            {/* Existing tags */}
            {availableTags.map((tag, index) => (
              <TagSuggestionItem
                key={tag.id}
                tag={tag}
                isHighlighted={index === highlightedIndex}
                onSelect={handleSelectTag}
              />
            ))}

            {/* Create new tag option */}
            {canCreateNew && (
              <button
                type="button"
                onClick={handleCreateTag}
                className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-2 border-t border-accent-gray/20 min-h-[44px] ${
                  highlightedIndex === availableTags.length
                    ? 'bg-accent-blue/10'
                    : 'hover:bg-accent-blue/5 active:bg-accent-blue/10'
                }`}
                role="option"
                aria-selected={highlightedIndex === availableTags.length}
              >
                <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-base text-primary-black">
                  创建新标签 &quot;<span className="font-medium text-accent-green">{inputValue.trim()}</span>&quot;
                </span>
              </button>
            )}
          </div>
        )}

        {/* No results message */}
        {isDropdownOpen && inputValue.trim() && availableTags.length === 0 && !canCreateNew && !isSearching && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-primary-white border border-accent-gray/30 rounded-lg shadow-lg p-3 text-sm text-accent-gray"
          >
            未找到匹配的标签
          </div>
        )}
      </div>

      {helperText && (
        <p className="mt-1.5 text-xs text-accent-gray">{helperText}</p>
      )}
    </div>
  );
}

interface TagSuggestionItemProps {
  tag: TagWithCount;
  isHighlighted: boolean;
  onSelect: (name: string) => void;
}

function TagSuggestionItem({ tag, isHighlighted, onSelect }: TagSuggestionItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tag.name)}
      className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between min-h-[44px] ${
        isHighlighted ? 'bg-accent-blue/10' : 'hover:bg-accent-blue/5 active:bg-accent-blue/10'
      }`}
      role="option"
      aria-selected={isHighlighted}
    >
      <span className="text-base text-primary-black">{tag.name}</span>
      <span className="text-sm text-accent-gray">{tag.count} 个文件</span>
    </button>
  );
}
