import apiClient from './client';
import {
  TagPresetsResponse,
  TagPreset,
} from '@/types';

/**
 * Get tag presets list
 * @param category Optional, filter by specific category
 */
export const getTagPresets = async (
  category?: 'activity_type'
): Promise<TagPreset[]> => {
  const params = category ? { category } : {};
  const response = await apiClient.get<TagPresetsResponse>(
    '/api/tag-presets',
    { params }
  );
  return response.data.presets;
};
