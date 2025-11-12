import apiClient from './client';
import {
  TagPresetsResponse,
  AddTagPresetRequest,
  TagPreset,
} from '@/types';

/**
 * Get tag presets list
 * @param category Optional, filter by specific category
 */
export const getTagPresets = async (
  category?: 'activity_type' | 'instructor'
): Promise<TagPreset[]> => {
  const params = category ? { category } : {};
  const response = await apiClient.get<TagPresetsResponse>(
    '/api/tag-presets',
    { params }
  );
  return response.data.presets;
};

/**
 * Add new tag preset (admin only)
 */
export const addTagPreset = async (
  data: AddTagPresetRequest
): Promise<TagPreset> => {
  const response = await apiClient.post('/api/tag-presets', data);
  return response.data.preset;
};

/**
 * Deactivate tag preset (admin only)
 */
export const deactivateTagPreset = async (
  presetId: number
): Promise<void> => {
  await apiClient.delete(`/api/tag-presets/${presetId}`);
};
