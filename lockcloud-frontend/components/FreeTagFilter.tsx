'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchTags, getTags } from '@/lib/api/tags';
import { TagWithCount } from '@/types';

interface FreeTagFilterProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

/**
 * FreeTagFilter component - Multi-select tag chips with search autocomplete
 * Requirements: 4.1, 4.2, 6.1
 */
export function FreeTagFilter({ selectedTags, onChange, disabled = false }: FreeTagFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all tags for initial display
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
    staleTime: 30000,
  });

  // Search tags when query changes
  const { data: searchResults = [] } = useQuery({
    queryKey: ['tags', 'search', searchQuery],
    queryFn: () => searchTags(searchQuery, 20),
    enabled: searchQuery.length > 0,
    staleTime: 10000,
  });

  // Use search results if searching, otherwise show all tags
  const displayTags = searchQuery.length > 0 ? searchResults : allTags;

  // Filter out already selected tags
  const availableTags = displayTags.filter(
    (tag) => !selectedTags.includes(tag.name)
  );

  const handleAddTag = useCallback((tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      onChange([...selectedTags, tagName]);
    }
    setSearchQuery('');
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  }, [selectedTags, onChange]);

  const handleRemoveTag = useCallback((tagName: string) => {
    onChange(selectedTags.filter((t) => t !== tagName));
  }, [selectedTags, onChange]);


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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    } else if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      // If there's an exact match or search results, add the first one
      const exactMatch = availableTags.find(
        (t) => t.name.toLowerCase() === searchQuery.toLowerCase()
      );
      if (exactMatch) {
        handleAddTag(exactMatch.name);
      } else if (availableTags.length > 0) {
        handleAddTag(availableTags[0].name);
      }
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-primary-black mb-2">
        自由标签
      </label>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map((tagName) => (
            <span
              key={tagName}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-blue/10 text-accent-blue rounded-full text-sm"
            >
              {tagName}
              <button
                type="button"
                onClick={() => handleRemoveTag(tagName)}
                disabled={disabled}
                className="hover:text-semantic-error transition-colors disabled:opacity-50"
                aria-label={`移除标签 ${tagName}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input with Add Button */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="搜索或添加标签..."
            className="input-functional flex-1 px-4 py-2 text-base text-primary-black placeholder:text-accent-gray disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => {
              if (searchQuery.trim()) {
                const exactMatch = availableTags.find(
                  (t) => t.name.toLowerCase() === searchQuery.toLowerCase()
                );
                if (exactMatch) {
                  handleAddTag(exactMatch.name);
                } else if (availableTags.length > 0) {
                  handleAddTag(availableTags[0].name);
                }
              }
            }}
            disabled={disabled || !searchQuery.trim()}
            className="px-4 py-2 bg-accent-blue text-primary-white rounded-lg hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium"
            aria-label="添加标签"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加
          </button>
        </div>

        {/* Dropdown */}
        {isDropdownOpen && availableTags.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-primary-white border border-accent-gray/30 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          >
            {availableTags.map((tag) => (
              <TagOption
                key={tag.id}
                tag={tag}
                searchQuery={searchQuery}
                onSelect={handleAddTag}
              />
            ))}
          </div>
        )}

        {/* No results message */}
        {isDropdownOpen && searchQuery && availableTags.length === 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-primary-white border border-accent-gray/30 rounded-lg shadow-lg p-3 text-sm text-accent-gray"
          >
            未找到匹配的标签
          </div>
        )}
      </div>

      {/* Helper text */}
      <p className="mt-1.5 text-xs text-accent-gray">
        选择多个标签时，显示包含任意标签的文件（OR 逻辑）
      </p>
    </div>
  );
}

interface TagOptionProps {
  tag: TagWithCount;
  searchQuery: string;
  onSelect: (name: string) => void;
}

function TagOption({ tag, searchQuery, onSelect }: TagOptionProps) {
  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return <span>{text}</span>;
    
    const before = text.slice(0, index);
    const match = text.slice(index, index + query.length);
    const after = text.slice(index + query.length);
    
    return (
      <>
        {before}
        <span className="bg-accent-blue/20 text-accent-blue font-medium">{match}</span>
        {after}
      </>
    );
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(tag.name)}
      className="w-full px-4 py-2 text-left hover:bg-accent-blue/5 transition-colors flex items-center justify-between"
    >
      <span className="text-sm text-primary-black">{highlightMatch(tag.name, searchQuery)}</span>
      <span className="text-xs text-accent-gray">{tag.count} 个文件</span>
    </button>
  );
}
