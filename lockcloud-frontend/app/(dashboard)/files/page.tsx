'use client';

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { listFiles, aiSearch, faceSearch, getPersonFiles, setPersonCover } from '@/lib/api/files';
import { searchTags } from '@/lib/api/tags';
import { FileFilters, File, TagWithCount } from '@/types';
import { FileGrid } from '@/components/FileGrid';
import { FileGridSkeleton } from '@/components/SkeletonLoader';
import { Pagination, PerPageSelect } from '@/components/Pagination';
import { Card } from '@/components/Card';
import { ErrorCard } from '@/components/ErrorCard';
import { MobileMenuButton } from '@/components/MobileMenuButton';
import { SelectableFileCard, BatchSelectionHeader } from '@/components/BatchSelection';
import { BatchActionToolbar } from '@/components/BatchActionToolbar';
import { FileCardSimple } from '@/components/FileCardSimple';
import { useBatchSelectionStore } from '@/stores/batchSelectionStore';
import { ActivityDirectoryEditor } from '@/components/ActivityDirectoryEditor';
import { activityTypeLabel } from '@/lib/constants/activityTypes';
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
  
  // Get current filter values from URL - must be before suggestedTags
  const currentMediaType = (searchParams.get('media_type') as MediaType) || 'all';
  const currentTags = useMemo(() =>
    searchParams.get('tags')?.split(',').filter(Boolean) || [],
    [searchParams]
  );

  // AI 搜索模式:URL 上有 ai=<query> 就走语义检索,否则走 listFiles。
  // 跟"按年月活动筛选"是同一层的另一种 query 模式。
  const aiQuery = searchParams.get('ai') || '';
  const isAiMode = aiQuery.length > 0;

  // 人脸模式:?face=<face_id> 走 face KNN(找同一个人,未聚类的脸用这个)
  //           ?person=<person_id> 走 person 视图(已聚类的归属人)
  const faceIdParam = searchParams.get('face');
  const personIdParam = searchParams.get('person');
  const isFaceMode = !!faceIdParam;
  const isPersonMode = !!personIdParam;

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
    ...(searchParams.get('date_from') && { date_from: searchParams.get('date_from')! }),
    ...(searchParams.get('date_to') && { date_to: searchParams.get('date_to')! }),
    ...(searchParams.get('search') && { search: searchParams.get('search')! }),
    ...(searchParams.get('media_type') && { media_type: searchParams.get('media_type') as MediaType }),
    ...(searchParams.get('tags') && { tags: currentTags }),
    ...(searchParams.get('year') && { year: parseInt(searchParams.get('year')!, 10) }),
    ...(searchParams.get('month') && { month: parseInt(searchParams.get('month')!, 10) }),
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: isFaceMode
      ? ['face-search', faceIdParam]
      : isPersonMode
      ? ['person-files', personIdParam, filters.page]
      : isAiMode
      ? ['ai-search', aiQuery]
      : ['files', filters],
    queryFn: async () => {
      if (isFaceMode) {
        const r = await faceSearch(parseInt(faceIdParam!, 10), 60);
        return {
          files: r.results.map((x) => x.file),
          pagination: {
            total: r.results.length,
            page: 1,
            per_page: r.results.length || 1,
            pages: 1,
            has_next: false,
            has_prev: false,
          },
          _face: { ms: r.ms, query_face_id: r.query_face_id },
        };
      }
      if (isPersonMode) {
        const r = await getPersonFiles(parseInt(personIdParam!, 10), filters.page, filters.per_page);
        return {
          files: r.files,
          pagination: r.pagination,
          _person: r.person,
        };
      }
      if (isAiMode) {
        const r = await aiSearch(aiQuery, 50);
        // 适配 FileListResponse 的形状,FileGrid / EmptyState 等下游代码无需改动。
        // AI 模式返回 top-K,没有真正的分页 —— pages=1, has_*=false。
        return {
          files: r.results.map((x) => x.file),
          pagination: {
            total: r.results.length,
            page: 1,
            per_page: r.results.length || 1,
            pages: 1,
            has_next: false,
            has_prev: false,
          },
          // 私下挂 AI 元信息,渲染统计行时取
          _ai: { ms: r.ms, query_tokens: r.query_tokens },
        };
      }
      return listFiles(filters);
    },
  });

  // 取 AI 模式的统计(只在 isAiMode 下有值)
  const aiStats = isAiMode
    ? (data as { _ai?: { ms: number; query_tokens: number } } | undefined)?._ai
    : undefined;

  useEffect(() => {
    clearSelection();
  }, [searchParams, clearSelection]);

  // 把当前列表 URL(含搜索/筛选/AI 查询)记在 sessionStorage,
  // 详情页的"返回"按钮据此回到用户进来时的列表状态,
  // 避免方向键翻图导致 router.back() 倒退回上一张图而不是回列表。
  useEffect(() => {
    const params = searchParams.toString();
    sessionStorage.setItem('files-list-return-url', params ? `/files?${params}` : '/files');
  }, [searchParams]);

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

  // person 模式下,"设为代表"按钮挂载点
  // 显示名优先 person.name,没起名就用 #id —— 跟人物页落款一致
  const personMeta = isPersonMode
    ? (data as { _person?: { id: number; name: string | null } } | undefined)?._person
    : undefined;
  const personDisplay = personMeta?.name?.trim() || (personIdParam ? `#${personIdParam}` : '');
  const setCoverMut = useMutation({
    mutationFn: ({ fileId }: { fileId: number }) =>
      setPersonCover(personMeta!.id, fileId),
    onMutate: () => {
      // 显示长时 loading toast,handler 内会同步等 S3 mirror,可能 1~2s
      const toastId = toast.loading(`正在设为 ${personDisplay} 的代表…`);
      return { toastId };
    },
    onSuccess: (_data, _vars, ctx) => {
      toast.success(`已设为 ${personDisplay} 的代表`, { id: ctx?.toastId });
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['people-in-file'] });
    },
    onError: (err, _vars, ctx) => {
      toast.error(`设置失败:${(err as Error).message}`, { id: ctx?.toastId });
    },
  });
  const pendingCoverFileId = setCoverMut.variables?.fileId;

  const renderSelectableFileCard = useCallback((file: File) => {
    const cover = isPersonMode && personMeta
      ? {
          label: `设为${personDisplay}的代表`,
          onClick: () => setCoverMut.mutate({ fileId: file.id }),
          isPending: setCoverMut.isPending && pendingCoverFileId === file.id,
        }
      : undefined;
    return (
      <SelectableFileCard file={file}>
        <FileCardSimple file={file} onFileUpdate={handleFileUpdate} setAsCover={cover} />
      </SelectableFileCard>
    );
  }, [handleFileUpdate, isPersonMode, personMeta, personDisplay, setCoverMut, pendingCoverFileId]);

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
  const currentActivityTypeDisplay = currentActivityType ? activityTypeLabel(currentActivityType) : '';

  return (
    <div className="space-y-4">
      {/* Row 1: Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <MobileMenuButton />
        <button
          onClick={() => router.push('/files')}
          className={`transition-colors ${
            isAiMode ? 'text-gray-500 hover:text-orange-500' : 'font-medium text-black'
          }`}
        >
          全部文件
        </button>
        {!isAiMode && breadcrumb.slice(1).map((item, index) => (
          <span key={item.label} className="flex items-center gap-2">
            <span className="text-gray-300">/</span>
            {index === breadcrumb.length - 2 || !item.href ? (
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
        {/* AI 搜索 chip */}
        {isAiMode && (
          <>
            <span className="text-gray-300">/</span>
            <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 bg-orange-50 border border-orange-500/30 text-orange-600 text-xs rounded-full">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.5l1.8 5.4a3 3 0 0 0 1.9 1.9L21 11.5l-5.3 1.7a3 3 0 0 0-1.9 1.9L12 20.5l-1.8-5.4a3 3 0 0 0-1.9-1.9L3 11.5l5.3-1.7a3 3 0 0 0 1.9-1.9L12 2.5z" />
              </svg>
              <span className="font-medium">AI 搜索:{aiQuery}</span>
              <button
                onClick={() => router.push('/files')}
                className="ml-0.5 p-0.5 rounded-full hover:bg-orange-100 hover:text-orange-700 transition-colors"
                aria-label="退出 AI 搜索"
                title="退出 AI 搜索"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
            {aiStats && (
              <span className="text-[11px] text-gray-400">
                {data?.pagination.total ?? 0} 结果 · {aiStats.ms}ms · {aiStats.query_tokens} tokens
              </span>
            )}
          </>
        )}
        {/* Person 模式 chip:点详情页人脸框跳过来的 */}
        {isPersonMode && (
          <>
            <span className="text-gray-300">/</span>
            <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 bg-orange-50 border border-orange-500/30 text-orange-600 text-xs rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">
                {(data as { _person?: { name: string | null; id: number; face_count: number } } | undefined)?._person?.name
                  || `#${personIdParam}`}
              </span>
              <button onClick={() => router.push('/files')} className="ml-0.5 p-0.5 rounded-full hover:bg-orange-100" aria-label="退出">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
            <span className="text-[11px] text-gray-400">{data?.pagination.total ?? 0} 张照片</span>
          </>
        )}
        {/* Face 模式 chip:未聚类脸的 KNN 搜索 */}
        {isFaceMode && (
          <>
            <span className="text-gray-300">/</span>
            <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 bg-orange-50 border border-orange-500/30 text-orange-600 text-xs rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="font-medium">相似人脸</span>
              <button onClick={() => router.push('/files')} className="ml-0.5 p-0.5 rounded-full hover:bg-orange-100" aria-label="退出">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
            <span className="text-[11px] text-gray-400">{data?.pagination.total ?? 0} 张相似</span>
          </>
        )}
        {/* Activity type badge */}
        {!isAiMode && isActivityDirectory && currentActivityTypeDisplay && (
          <span className="px-2 py-0.5 bg-orange-50 text-orange-500 text-xs rounded-full">
            {currentActivityTypeDisplay}
          </span>
        )}
        {!isAiMode && data && (
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

      {/* Row 2: All Controls - AI / 人脸 / Person 模式下整行隐藏(都是非常规排序/筛选) */}
      {!isAiMode && !isFaceMode && !isPersonMode && (
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-2">
        {/* Row 2a: Selection + Media Type (Mobile: Full width row) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Batch Selection - 始终显示，防止布局跳动 */}
          <BatchSelectionHeader files={data?.files || []} />
          <div className="h-5 w-px bg-gray-200 hidden sm:block" />

          {/* Media Type Pills - Mobile: Larger touch targets */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {[
              { value: 'all' as MediaType, label: '全部' },
              { value: 'image' as MediaType, label: '图片' },
              { value: 'video' as MediaType, label: '视频' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleMediaTypeChange(value)}
                className={`px-3 py-1.5 md:px-2.5 md:py-1 text-sm md:text-xs font-medium rounded-md transition-colors min-h-[36px] md:min-h-0 ${
                  currentMediaType === value
                    ? 'bg-white shadow-sm text-black'
                    : 'text-gray-500 hover:text-black active:bg-white/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2b: Tags (Mobile: Full width row, wrapping) */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:flex-1">
          {/* Current Tags - Mobile: Larger touch targets for remove button */}
          {currentTags.map(tag => (
            <span 
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 md:px-2 md:py-0.5 bg-orange-50 text-orange-500 text-sm md:text-xs rounded-full"
            >
              {tag}
              <button 
                onClick={() => handleRemoveTag(tag)} 
                className="hover:text-red-500 active:text-red-600 p-0.5 -mr-0.5 min-w-[24px] min-h-[24px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                aria-label={`移除标签 ${tag}`}
              >
                <svg className="w-3.5 h-3.5 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}

          {/* Tag Input with Autocomplete - Mobile: Larger input */}
          <div className="relative flex items-center gap-1.5 md:gap-1 flex-1 md:flex-none min-w-0">
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
              className="flex-1 md:flex-none w-full md:w-24 px-3 py-2 md:px-2 md:py-1 text-sm md:text-xs border border-gray-200 rounded-md 
                focus:outline-none focus:border-orange-500 placeholder:text-gray-400 min-h-[40px] md:min-h-0"
              style={{ fontSize: '16px' }} // Prevent iOS zoom
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
              className="px-3 py-2 md:px-2 md:py-1 text-sm md:text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600 active:bg-orange-700
                transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] min-w-[40px] md:min-h-0 md:min-w-0 flex items-center justify-center"
              title="添加标签"
              aria-label="添加标签"
            >
              <svg className="w-4 h-4 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            
            {/* Tag Suggestions Dropdown - Mobile: Larger touch targets */}
            {isTagDropdownOpen && suggestedTags.length > 0 && (
              <div
                ref={tagDropdownRef}
                className="absolute top-full left-0 mt-1 w-full md:w-48 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 md:max-h-48 overflow-y-auto z-50"
              >
                {suggestedTags.map((tag: TagWithCount) => {
                  const lowerName = tag.name.toLowerCase();
                  const lowerQuery = tagInput.toLowerCase();
                  const matchIndex = lowerName.indexOf(lowerQuery);
                  
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleAddTag(tag.name)}
                      className="w-full px-4 py-3 md:px-3 md:py-2 text-left hover:bg-orange-50 active:bg-orange-100 transition-colors flex items-center justify-between text-sm md:text-xs min-h-[44px] md:min-h-0 border-b border-gray-100 last:border-b-0"
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
                      <span className="text-gray-400 ml-2">{tag.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Row 2c: Per Page (Mobile: Right aligned) */}
        <div className="flex justify-end md:justify-start md:ml-auto">
          <PerPageSelect
            value={filters.per_page ?? 24}
            onChange={handlePerPageChange}
          />
        </div>
      </div>
      )}

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
            <p className="text-gray-500">
              {isAiMode
                ? `没有匹配 "${aiQuery}" 的结果`
                : isFaceMode
                ? '没有找到相似的人脸'
                : isPersonMode
                ? '该人物暂无照片'
                : zhCN.files.noFiles}
            </p>
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
