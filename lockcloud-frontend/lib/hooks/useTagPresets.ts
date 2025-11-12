import { useQuery } from '@tanstack/react-query';
import { getTagPresets } from '@/lib/api/tag-presets';
import { TagPreset } from '@/types';

/**
 * Hook to fetch tag presets
 * Supports filtering by category and provides caching
 */
export function useTagPresets(category?: 'activity_type' | 'instructor') {
  return useQuery<TagPreset[]>({
    queryKey: ['tag-presets', category],
    queryFn: () => getTagPresets(category),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  });
}

/**
 * Hook to fetch activity type presets
 */
export function useActivityTypes() {
  return useTagPresets('activity_type');
}

/**
 * Hook to fetch instructor presets
 */
export function useInstructors() {
  return useTagPresets('instructor');
}
