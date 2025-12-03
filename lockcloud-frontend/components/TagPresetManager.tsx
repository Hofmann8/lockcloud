'use client';

import { useTagPresets } from '@/lib/hooks/useTagPresets';
import { TagPreset } from '@/types';

export function TagPresetManager() {
  // Load all tag presets
  const { data: allPresets = [], isLoading } = useTagPresets();

  // Group presets by category - only activity_type
  const activityTypePresets = allPresets.filter(
    (preset) => preset.category === 'activity_type'
  );

  // Render preset list for a category
  const renderPresetList = (presets: TagPreset[], categoryName: string) => (
    <div className="space-y-3">
      <h3 className="text-base md:text-lg font-semibold text-primary-black">
        {categoryName}
      </h3>
      
      {presets.length === 0 ? (
        <div className="text-sm text-accent-gray py-4">
          暂无{categoryName}预设
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="card-functional p-4 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm md:text-base font-medium text-primary-black">
                  {preset.display_name}
                </span>
              </div>
              <span className="px-2 py-0.5 text-xs rounded-md bg-accent-green/20 text-accent-green">
                启用
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-accent-gray">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Notice */}
      <div className="card-functional p-4 md:p-6 bg-accent-blue/5 border-accent-blue/20">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-accent-blue mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-primary-black">活动类型为固定选项</p>
            <p className="text-xs text-accent-gray mt-1">
              系统预设了以下活动类型，无法添加或删除。如需调整，请联系管理员。
            </p>
          </div>
        </div>
      </div>

      {/* Preset Lists */}
      <div className="card-functional p-4 md:p-6">
        {renderPresetList(activityTypePresets, '活动类型')}
      </div>
    </div>
  );
}
