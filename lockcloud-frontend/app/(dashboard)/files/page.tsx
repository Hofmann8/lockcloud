'use client';

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { listFiles } from '@/lib/api/files';
import { searchTags } from '@/lib/api/tags';
import { FileFilters, File, TagWithCount } from '@/types';
import { FileGrid } from '@/components/FileGrid';
import { FileGridSkeleton } from '@/components/SkeletonLoader';
import { Pagination } from '@/components/Pagination';
import { Card } from '@/components/Card';
import { ErrorCard } from '@/components/ErrorCard';
import { MobileMenuButton } from '@/components/MobileMenuButton';
import { SelectableFileCard, BatchSelectionHeader } from '@/components/BatchSelection';
import { BatchActionToolbar } from '@/components/BatchActionToolbar';
import { FileCardSimple } from '@/components/FileCardSimple';
import { useBatchSelectionStore } from '@/stores/batchSelectionStore';
import { ActivityDirectoryEditor } from '@/components/ActivityDirectoryEditor';
import { useActivityTypes } from '@/lib/hooks/useTagPresets';
import { zhCN } from '@/locales/zh-CN';

type MediaType = 'all' | 'image' | 'video';

function FilesPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { clearSelection } = useBatchSelectionStore();
  
  const [tagInput, setTagInput] = useState('');
  const [isDirectoryEditorOpen, setIsDirectoryEditorOpen] = useState(false);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  
  const { data: activityTypes = [] } = useActivityTypes();
  
  // Get current filter values from URL - must be before suggestedTags
  const currentMediaType = (searchParams.get('media_type') as MediaType) || 'all';
  const currentTags = useMemo(() => 
    searchParams.get('tags')?.split(',').filter(Boolean) || [], 
    [searchParams]
  );

  // Search tags when input changes
  const { data: searchResults = [] } = useQuery({
    queryKey: ['tags', 'search', tagInput],
    queryFn: () => searchTags(tagInput, 5),
    enabled: tagInput.trim().length > 0,
    staleTime: 10000,
  });

  // Only show suggestions when user is typing, filter out count=0 tags, max 3 results
  const suggestedTags = useMemo(() => {
    if (!tagInput.trim()) return [];
    return searchResults
      .filter((tag: TagWithCount) => tag.count > 0 && !currentTags.includes(tag.name))
      .slice(0, 3);
  }, [tagInput, searchResults, currentTags]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(event.target as Node) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(event.target as Node)
      ) {
        setIsTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Derive filters directly from URL parameters
  const filters: FileFilters = {
    page: parseInt(searchParams.get('page') || '1', 10),
    per_page: parseInt(searchParams.get('per_page') || '24', 10),
    ...(searchParams.get('directory') && { directory: searchParams.get('directory')! }),
    ...(searchParams.get('activity_type') && { activity_type: searchParams.get('activity_type')! }),
    ...(searchParams.get('activity_name') && { activity_name: searchParams.get('activity_name')! }),
    ...(searchParams.get('activity_date') && { activity_date: searchParams.get('activity_date')! }),
    ...(searchParams.get('instructor') && { instructor: searchParams.get('instructor')! }),
    ...(searchParams.get('date_from') && { date_from: searchParams.get('date_from')! }),
    ...(searchParams.get('date_to') && { date_to: searchParams.get('date_to')! }),
    ...(searchParams.get('search') && { search: searchParams.get('search')! }),
    ...(searchParams.get('media_type') && { media_type: searchParams.get('media_type') as MediaType }),
    ...(searchParams.get('tags') && { tags: currentTags }),
    ...(searchParams.get('year') && { year: parseInt(searchParams.get('year')!, 10) }),
    ...(searchParams.get('month') && { month: parseInt(searchParams.get('month')!, 10) }),
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['files', filters],
    queryFn: () => listFiles(filters),
  });

  useEffect(() => {
    clearSelection();
  }, [searchParams, clearSelection]);

  // Media type change - immediate
  const handleMediaTypeChange = useCallback((type: MediaType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (type !== 'all') {
      params.set('media_type', type);
    } else {
      params.delete('media_type');
    }
    params.set('page', '1');
    router.push(`/files?${params.toString()}`);
  }, [searchParams, router]);

  // Add tag
  const handleAddTag = useCallback((tagName?: string) => {
    const tag = tagName || tagInput.trim();
    if (!tag) return;
    const params = new URLSearchParams(searchParams.toString());
    const newTags = [...currentTags, ...tag.split(',').map(t => t.trim()).filter(t => t && !currentTags.includes(t))];
    if (newTags.length > 0) {
      params.set('tags', newTags.join(','));
    }
    params.set('page', '1');
    router.push(`/files?${params.toString()}`);
    setTagInput('');
    setIsTagDropdownOpen(false);
  }, [tagInput, currentTags, searchParams, router]);

  // Remove tag
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const newTags = currentTags.filter(t => t !== tagToRemove);
    if (newTags.length > 0) {
      params.set('tags', newTags.join(','));
    } else {
      params.delete('tags');
    }
    params.set('page', '1');
    router.push(`/files?${params.toString()}`);
  }, [currentTags, searchParams, router]);

  const handlePageChange = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`/files?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchParams, router]);

  const handlePerPageChange = useCallback((perPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('per_page', String(perPage));
    params.set('page', '1');
    router.push(`/files?${params.toString()}`);
  }, [searchParams, router]);

  const handleFileUpdate = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['directories'] });
  }, [refetch, queryClient]);

  const renderSelectableFileCard = useCallback((file: File) => (
    <SelectableFileCard file={file}>
      <FileCardSimple file={file} onFileUpdate={handleFileUpdate} />
    </SelectableFileCard>
  ), [handleFileUpdate]);

  // Build breadcrumb from current filters
  const breadcrumb = useMemo(() => {
    const parts: { label: string; href: string }[] = [{ label: '全部文件', href: '/files' }];
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const activityName = searchParams.get('activity_name');
    const activityDate = searchParams.get('activity_date');
    
    if (year) {
      parts.push({ label: `${year}年`, href: `/files?year=${year}` });
      if (month) {
        parts.push({ label: `${month}月`, href: `/files?year=${year}&month=${month}` });
        if (activityName && activityDate) {
          const day = parseInt(activityDate.split('-')[2], 10);
          const label = `${day}日-${activityName}`;
          parts.push({ label, href: '' });
        }
      }
    }
    return parts;
  }, [searchParams]);
  
  // Check if we're viewing a specific activity directory
  const isActivityDirectory = !!(
    searchParams.get('activity_date') && 
    searchParams.get('activity_name') && 
    searchParams.get('activity_type')
  );
  
  const currentActivityDate = searchParams.get('activity_date') || '';
  const currentActivityName = searchParams.get('activity_name') || '';
  const currentActivityType = searchParams.get('activity_type') || '';
  const currentActivityTypeDisplay = activityTypes.find(t => t.value === currentActivityType)?.display_name || currentActivityType;

  return (
    <div className="space-y-4">
      {/* Row 1: Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm">
        <MobileMenuButton />
        {breadcrumb.map((item, index) => (
          <span key={item.label} className="flex items-center gap-2">
            {index > 0 && <span className="text-gray-300">/</span>}
            {index === breadcrumb.length - 1 || !item.href ? (
              <span className="font-medium text-black">{item.label}</span>
            ) : (
              <button
                onClick={() => router.push(item.href)}
                className="text-gray-500 hover:text-orange-500 transition-colors"
              >
                {item.label}
              </button>
            )}
          </span>
        ))}
        {/* Activity type badge */}
        {isActivityDirectory && currentActivityTypeDisplay && (
          <span className="px-2 py-0.5 bg-orange-50 text-orange-500 text-xs rounded-full">
            {currentActivityTypeDisplay}
          </span>
        )}
        {data && (
          <span className="text-gray-400 ml-1">({data.pagination.total})</span>
        )}
        {/* Edit directory button */}
        {isActivityDirectory && (
          <button
            onClick={() => setIsDirectoryEditorOpen(true)}
            className="ml-2 p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
            title="编辑活动目录"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>

      {/* Row 2: All Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Selection + Media Type + Tags */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Batch Selection - 始终显示，防止布局跳动 */}
          <BatchSelectionHeader files={data?.files || []} />
          <div className="h-5 w-px bg-gray-200 hidden sm:block" />

          {/* Media Type Pills */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {[
              { value: 'all' as MediaType, label: '全部' },
              { value: 'image' as MediaType, label: '图片' },
              { value: 'video' as MediaType, label: '视频' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleMediaTypeChange(value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  currentMediaType === value
                    ? 'bg-white shadow-sm text-black'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Current Tags */}
          {currentTags.map(tag => (
            <span 
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-500 text-xs rounded-full"
            >
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}

          {/* Tag Input with Autocomplete */}
          <div className="relative flex items-center gap-1">
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setIsTagDropdownOpen(true);
              }}
              onFocus={() => setIsTagDropdownOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (suggestedTags.length > 0) {
                    handleAddTag(suggestedTags[0].name);
                  } else {
                    handleAddTag();
                  }
                } else if (e.key === 'Escape') {
                  setIsTagDropdownOpen(false);
                }
              }}
              placeholder="+ 标签"
              className="w-20 sm:w-24 px-2 py-1 text-xs border border-gray-200 rounded-md 
                focus:outline-none focus:border-orange-500 placeholder:text-gray-400"
            />
            <button
              onClick={() => {
                if (suggestedTags.length > 0 && tagInput.trim()) {
                  handleAddTag(suggestedTags[0].name);
                } else {
                  handleAddTag();
                }
              }}
              disabled={!tagInput.trim()}
              className="px-2 py-1 text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600 
                transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="添加标签"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            
            {/* Tag Suggestions Dropdown */}
            {isTagDropdownOpen && suggestedTags.length > 0 && (
              <div
                ref={tagDropdownRef}
                className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50"
              >
                {suggestedTags.map((tag: TagWithCount) => {
                  const lowerName = tag.name.toLowerCase();
                  const lowerQuery = tagInput.toLowerCase();
                  const matchIndex = lowerName.indexOf(lowerQuery);
                  
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleAddTag(tag.name)}
                      className="w-full px-3 py-2 text-left hover:bg-orange-50 transition-colors flex items-center justify-between text-xs"
                    >
                      <span className="text-gray-800">
                        {matchIndex >= 0 && tagInput ? (
                          <>
                            {tag.name.slice(0, matchIndex)}
                            <span className="bg-orange-100 text-orange-600 font-medium">
                              {tag.name.slice(matchIndex, matchIndex + tagInput.length)}
                            </span>
                            {tag.name.slice(matchIndex + tagInput.length)}
                          </>
                        ) : (
                          tag.name
                        )}
                      </span>
                      <span className="text-gray-400">{tag.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Per Page */}
        <select
          value={filters.per_page}
          onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
          className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-orange-500 bg-white"
        >
          <option value={12}>12</option>
          <option value={24}>24</option>
          <option value={48}>48</option>
          <option value={96}>96</option>
        </select>
      </div>

      {/* Loading State */}
      {isLoading && <FileGridSkeleton count={filters.per_page} />}

      {/* Error State */}
      {error && (
        <ErrorCard
          title="加载失败"
          message={zhCN.errors.serverError}
          variant="error"
          action={{ label: "重试", onClick: () => window.location.reload() }}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && data && data.files.length === 0 && (
        <Card variant="bordered" padding="lg">
          <div className="text-center">
            <p className="text-gray-500">{zhCN.files.noFiles}</p>
          </div>
        </Card>
      )}

      {/* File List */}
      {!isLoading && !error && data && data.files.length > 0 && (
        <>
          <FileGrid 
            files={data.files} 
            onFileUpdate={handleFileUpdate}
            renderFileCard={renderSelectableFileCard}
          />
          
          {/* Pagination */}
          {data.pagination.total > data.pagination.per_page && (
            <Pagination
              currentPage={data.pagination.page}
              totalPages={data.pagination.pages}
              totalItems={data.pagination.total}
              itemsPerPage={data.pagination.per_page}
              onPageChange={handlePageChange}
              hasNext={data.pagination.has_next}
              hasPrev={data.pagination.has_prev}
            />
          )}
        </>
      )}

      <BatchActionToolbar onOperationComplete={handleFileUpdate} files={data?.files || []} />
      
      {/* Activity Directory Editor Modal */}
      {isActivityDirectory && (
        <ActivityDirectoryEditor
          isOpen={isDirectoryEditorOpen}
          onClose={() => setIsDirectoryEditorOpen(false)}
          activityDate={currentActivityDate}
          activityName={currentActivityName}
          activityType={currentActivityType}
          onUpdate={() => {
            handleFileUpdate();
            // Navigate to updated directory if name/type changed
          }}
        />
      )}
    </div>
  );
}

export default function FilesPage() {
  return (
    <Suspense fallback={<FileGridSkeleton count={24} />}>
      <FilesPageContent />
    </Suspense>
  );
}
