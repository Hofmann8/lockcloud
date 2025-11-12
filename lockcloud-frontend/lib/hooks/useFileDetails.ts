import { useQuery } from '@tanstack/react-query';
import { getFileById } from '@/lib/api/files';
import { File } from '@/types';

/**
 * Hook to fetch file details by ID
 * Provides caching, automatic refetching, and enhanced error handling
 */
export function useFileDetails(fileId: number | null) {
  return useQuery<File>({
    queryKey: ['file', fileId],
    queryFn: async () => {
      if (!fileId) {
        throw new Error('File ID is required');
      }
      try {
        return await getFileById(fileId);
      } catch (error: any) {
        // Enhance error messages for better user feedback
        if (error.message === 'File not found') {
          throw new Error('File not found');
        }
        if (error.message === 'Access denied') {
          throw new Error('Access denied');
        }
        if (error.code === 'NETWORK_ERROR') {
          throw new Error('Network connection failed');
        }
        // Re-throw original error if not handled
        throw error;
      }
    },
    enabled: !!fileId && fileId > 0, // Only fetch if fileId is valid
    staleTime: 10 * 60 * 1000, // 10 minutes - file metadata rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer for navigation
    retry: (failureCount, error: any) => {
      // Don't retry on 404 or 403 errors
      if (error.message === 'File not found' || error.message === 'Access denied') {
        return false;
      }
      // Retry once for other errors (network issues, etc.)
      return failureCount < 1;
    },
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on mount if data is fresh
  });
}
