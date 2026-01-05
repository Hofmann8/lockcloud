/**
 * Tag Presets API
 * 
 * Handles tag preset operations (activity types).
 * Follows backend routes (backend/tag_presets/routes.py).
 * 
 * Requirements: 7.1
 */

import apiClient from './client';
import { TagPreset, TagPresetsResponse } from '../../types';

/**
 * Get tag presets list
 * Endpoint: GET /api/tag-presets?category=activity_type
 * 
 * @param category - Optional, filter by specific category (e.g., 'activity_type')
 * @returns Array of tag presets
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
