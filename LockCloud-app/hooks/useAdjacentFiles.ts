/**
 * useAdjacentFiles Hook
 * 
 * Fetches adjacent files (previous and next) for navigation in file detail view.
 * Supports swipe navigation between files.
 * 
 * Requirements: 4.4
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { getAdjacentFiles } from '@/lib/api/files';
import { AdjacentFiles } from '@/types';

interface UseAdjacentFilesOptions {
  /** Current file ID */
  fileId: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

interface UseAdjacentFilesReturn {
  /** Adjacent files data */
  adjacentFiles: AdjacentFiles | undefined;
  /** Whether the query is loading */
  isLoading: boolean;
  /** Whether there's an error */
  isError: boolean;
  /** Error object if any */
  error: Error | null;
  /** Whether there's a previous file */
  hasPrevious: boolean;
  /** Whether there's a next file */
  hasNext: boolean;
  /** Navigate to previous file */
  goToPrevious: () => void;
  /** Navigate to next file */
  goToNext: () => void;
  /** Refetch adjacent files */
  refetch: () => void;
}

/**
 * Hook for fetching and navigating between adjacent files
 * 
 * @param options - Hook options
 * @returns Adjacent files data and navigation functions
 */
export function useAdjacentFiles({
  fileId,
  enabled = true,
}: UseAdjacentFilesOptions): UseAdjacentFilesReturn {
  const router = useRouter();

  // Fetch adjacent files
  const {
    data: adjacentFiles,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['adjacent-files', fileId],
    queryFn: () => getAdjacentFiles(fileId),
    enabled: enabled && fileId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  // Check if previous/next files exist
  const hasPrevious = !!adjacentFiles?.previous;
  const hasNext = !!adjacentFiles?.next;

  // Navigate to previous file
  const goToPrevious = useCallback(() => {
    if (adjacentFiles?.previous) {
      router.push(`/files/${adjacentFiles.previous.id}`);
    }
  }, [adjacentFiles?.previous, router]);

  // Navigate to next file
  const goToNext = useCallback(() => {
    if (adjacentFiles?.next) {
      router.push(`/files/${adjacentFiles.next.id}`);
    }
  }, [adjacentFiles?.next, router]);

  return {
    adjacentFiles,
    isLoading,
    isError,
    error: error as Error | null,
    hasPrevious,
    hasNext,
    goToPrevious,
    goToNext,
    refetch,
  };
}

export default useAdjacentFiles;
