/**
 * BatchActionBar Component
 * 
 * Floating toolbar for batch operations on selected files.
 * Follows the Web frontend implementation (lockcloud-frontend/components/BatchActionToolbar.tsx).
 * 
 * Features:
 * - Delete selected files
 * - Add tags to selected files
 * - Remove tags from selected files
 * - Edit metadata for selected files
 * 
 * Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  useColorScheme,
  Platform,
} from 'react-native';
import { useQueryClient, useQuery } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/Icon';
import { useBatchSelectionStore } from '@/stores/batchSelectionStore';
import { useAuthStore } from '@/stores/authStore';
import { batchDelete, batchAddTag, batchRemoveTag, batchUpdate } from '@/lib/api/files';
import { getTagPresets } from '@/lib/api/tagPresets';
import { searchTags } from '@/lib/api/tags';
import { File, TagWithCount, TagPreset, BatchUpdateData } from '@/types';

interface BatchActionBarProps {
  files: File[];
  onOperationComplete?: () => void;
}

/**
 * BatchActionBar - Floating toolbar for batch file operations
 * 
 * Requirements:
 * - 9.2: Display batch action toolbar when files are selected
 * - 9.3: Support batch delete for owned files
 * - 9.4: Support batch tag addition
 * - 9.5: Support batch tag removal
 * - 9.6: Support batch metadata update
 * - 9.7: Display operation results
 */
export function BatchActionBar({ files, onOperationComplete }: BatchActionBarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const queryClient = useQueryClient();
  const { clearSelection, getSelectedIds, exitSelectionMode } = useBatchSelectionStore();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.is_admin || false;
  
  const selectedIdsArray = getSelectedIds();
  const selectionCount = selectedIdsArray.length;

  // Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [isRemoveTagModalOpen, setIsRemoveTagModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Tag input states
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<TagWithCount[]>([]);
  const [selectedTagToRemove, setSelectedTagToRemove] = useState<{ id: number; name: string; count: number } | null>(null);
  
  // Edit form states
  const [editActivityDate, setEditActivityDate] = useState<string>('');
  const [editActivityType, setEditActivityType] = useState<string>('');
  const [editActivityName, setEditActivityName] = useState<string>('');
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch activity type presets
  const { data: activityTypePresets } = useQuery({
    queryKey: ['tagPresets', 'activity_type'],
    queryFn: () => getTagPresets('activity_type'),
  });

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Get selected files and categorize by ownership
  const selectedFiles = useMemo(() => 
    files.filter(f => selectedIdsArray.includes(f.id)), 
    [files, selectedIdsArray]
  );
  
  const { ownFiles, otherFiles } = useMemo(() => {
    const own: File[] = [];
    const other: File[] = [];
    selectedFiles.forEach(file => {
      if (file.uploader_id === user?.id || isAdmin) {
        own.push(file);
      } else {
        other.push(file);
      }
    });
    return { ownFiles: own, otherFiles: other };
  }, [selectedFiles, user?.id, isAdmin]);

  // Collect tags from selected files
  const selectedFilesTags = useMemo(() => {
    const tagMap = new Map<number, { id: number; name: string; count: number }>();
    selectedFiles.forEach(file => {
      file.free_tags?.forEach(tag => {
        const existing = tagMap.get(tag.id);
        if (existing) {
          existing.count += 1;
        } else {
          tagMap.set(tag.id, { id: tag.id, name: tag.name, count: 1 });
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
  }, [selectedFiles]);

  // Tag search handler
  const handleTagSearch = useCallback((query: string) => {
    setTagInput(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.trim().length > 0) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await searchTags(query);
          setTagSuggestions(results);
        } catch {
          setTagSuggestions([]);
        }
      }, 300);
    } else {
      setTagSuggestions([]);
    }
  }, []);

  // ========== DELETE ==========
  const handleDeleteConfirm = useCallback(async () => {
    if (ownFiles.length === 0) {
      Alert.alert('提示', '没有可删除的文件（只能删除自己上传的文件）');
      setIsDeleteModalOpen(false);
      return;
    }
    
    setIsProcessing(true);
    try {
      const result = await batchDelete(ownFiles.map(f => f.id));
      
      if (result.success) {
        const succeededCount = result.results?.succeeded?.length || 0;
        const failedCount = result.results?.failed?.length || 0;
        
        if (failedCount > 0) {
          Alert.alert('部分成功', `成功删除 ${succeededCount} 个文件，${failedCount} 个失败`);
        } else {
          Alert.alert('成功', `成功删除 ${succeededCount} 个文件`);
        }
        
        if (otherFiles.length > 0) {
          Alert.alert('提示', `${otherFiles.length} 个非本人上传的文件已跳过`);
        }
        
        clearSelection();
        exitSelectionMode();
        onOperationComplete?.();
        queryClient.invalidateQueries({ queryKey: ['files'] });
      } else {
        Alert.alert('错误', result.message || '删除失败');
      }
    } catch (error) {
      console.error('Batch delete error:', error);
      Alert.alert('错误', '删除操作失败，请重试');
    } finally {
      setIsProcessing(false);
      setIsDeleteModalOpen(false);
    }
  }, [ownFiles, otherFiles, clearSelection, exitSelectionMode, onOperationComplete, queryClient]);

  // ========== ADD TAG ==========
  const handleAddTagConfirm = useCallback(async () => {
    const tagName = tagInput.trim();
    if (!tagName) {
      Alert.alert('提示', '请输入标签名称');
      return;
    }
    
    if (ownFiles.length === 0) {
      Alert.alert('提示', '没有可操作的文件（只能修改自己上传的文件）');
      setIsAddTagModalOpen(false);
      return;
    }
    
    setIsProcessing(true);
    try {
      const result = await batchAddTag(ownFiles.map(f => f.id), tagName);
      
      if (result.success) {
        const succeededCount = result.results?.succeeded?.length || 0;
        Alert.alert('成功', `成功为 ${succeededCount} 个文件添加标签`);
        
        if (otherFiles.length > 0) {
          Alert.alert('提示', `${otherFiles.length} 个非本人上传的文件已跳过`);
        }
        
        clearSelection();
        exitSelectionMode();
        onOperationComplete?.();
        queryClient.invalidateQueries({ queryKey: ['files'] });
        queryClient.invalidateQueries({ queryKey: ['tags'] });
      } else {
        Alert.alert('错误', result.message || '添加标签失败');
      }
    } catch (error) {
      console.error('Batch add tag error:', error);
      Alert.alert('错误', '添加标签失败，请重试');
    } finally {
      setIsProcessing(false);
      setIsAddTagModalOpen(false);
      setTagInput('');
      setTagSuggestions([]);
    }
  }, [tagInput, ownFiles, otherFiles, clearSelection, exitSelectionMode, onOperationComplete, queryClient]);

  // ========== REMOVE TAG ==========
  const handleRemoveTagConfirm = useCallback(async () => {
    if (!selectedTagToRemove) {
      Alert.alert('提示', '请选择要移除的标签');
      return;
    }
    
    if (ownFiles.length === 0) {
      Alert.alert('提示', '没有可操作的文件（只能修改自己上传的文件）');
      setIsRemoveTagModalOpen(false);
      return;
    }
    
    setIsProcessing(true);
    try {
      const result = await batchRemoveTag(ownFiles.map(f => f.id), selectedTagToRemove.id);
      
      if (result.success) {
        const succeededCount = result.results?.succeeded?.length || 0;
        Alert.alert('成功', `成功从 ${succeededCount} 个文件移除标签`);
        
        clearSelection();
        exitSelectionMode();
        onOperationComplete?.();
        queryClient.invalidateQueries({ queryKey: ['files'] });
        queryClient.invalidateQueries({ queryKey: ['tags'] });
      } else {
        Alert.alert('错误', result.message || '移除标签失败');
      }
    } catch (error) {
      console.error('Batch remove tag error:', error);
      Alert.alert('错误', '移除标签失败，请重试');
    } finally {
      setIsProcessing(false);
      setIsRemoveTagModalOpen(false);
      setSelectedTagToRemove(null);
    }
  }, [selectedTagToRemove, ownFiles, clearSelection, exitSelectionMode, onOperationComplete, queryClient]);

  // ========== BATCH EDIT ==========
  const handleEditConfirm = useCallback(async () => {
    // Build updates object - only include non-empty values
    const updates: BatchUpdateData = {};
    if (editActivityDate) updates.activity_date = editActivityDate;
    if (editActivityType) updates.activity_type = editActivityType;
    if (editActivityName) updates.activity_name = editActivityName;
    
    if (Object.keys(updates).length === 0) {
      Alert.alert('提示', '请至少填写一项要修改的内容');
      return;
    }
    
    if (ownFiles.length === 0) {
      Alert.alert('提示', '没有可操作的文件（只能修改自己上传的文件）');
      setIsEditModalOpen(false);
      return;
    }
    
    setIsProcessing(true);
    try {
      const result = await batchUpdate(ownFiles.map(f => f.id), updates);
      
      if (result.success) {
        const succeededCount = result.results?.succeeded?.length || 0;
        const failedCount = result.results?.failed?.length || 0;
        
        if (failedCount > 0) {
          Alert.alert('部分成功', `成功更新 ${succeededCount} 个文件，${failedCount} 个失败`);
        } else {
          Alert.alert('成功', `成功更新 ${succeededCount} 个文件`);
        }
        
        if (otherFiles.length > 0) {
          Alert.alert('提示', `${otherFiles.length} 个非本人上传的文件已跳过`);
        }
        
        clearSelection();
        exitSelectionMode();
        onOperationComplete?.();
        queryClient.invalidateQueries({ queryKey: ['files'] });
        queryClient.invalidateQueries({ queryKey: ['directories'] });
      } else {
        Alert.alert('错误', result.message || '批量更新失败');
      }
    } catch (error) {
      console.error('Batch update error:', error);
      Alert.alert('错误', '批量更新失败，请重试');
    } finally {
      setIsProcessing(false);
      setIsEditModalOpen(false);
      setEditActivityDate('');
      setEditActivityType('');
      setEditActivityName('');
    }
  }, [editActivityDate, editActivityType, editActivityName, ownFiles, otherFiles, clearSelection, exitSelectionMode, onOperationComplete, queryClient]);

  if (selectionCount === 0) return null;

  const backgroundColor = colorScheme === 'dark' ? '#1c1c1e' : '#1a1a1a';
  const buttonBgColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)';

  return (
    <>
      {/* Floating Action Bar */}
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.toolbar}>
          {/* Edit Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#f97316' }]}
            onPress={() => setIsEditModalOpen(true)}
          >
            <Icon name="edit" size={20} color="#fff" style={styles.actionIcon} />
            <ThemedText style={styles.actionText}>编辑</ThemedText>
          </TouchableOpacity>

          {/* Add Tag Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: buttonBgColor }]}
            onPress={() => setIsAddTagModalOpen(true)}
          >
            <Icon name="tag" size={20} color="#fff" style={styles.actionIcon} />
            <ThemedText style={styles.actionText}>加标签</ThemedText>
          </TouchableOpacity>

          {/* Remove Tag Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: buttonBgColor }]}
            onPress={() => setIsRemoveTagModalOpen(true)}
          >
            <Icon name="tag-remove" size={20} color="#fff" style={styles.actionIcon} />
            <ThemedText style={styles.actionText}>移标签</ThemedText>
          </TouchableOpacity>

          {/* Delete Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
            onPress={() => setIsDeleteModalOpen(true)}
          >
            <Icon name="delete" size={20} color="#fff" style={styles.actionIcon} />
            <ThemedText style={styles.actionText}>删除</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={isDeleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isProcessing && setIsDeleteModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#fff' }]}>
            <ThemedText style={styles.modalTitle}>确认删除</ThemedText>
            <ThemedText style={styles.modalText}>
              确定要删除选中的 {ownFiles.length} 个文件吗？
            </ThemedText>
            {otherFiles.length > 0 && (
              <View style={styles.warningRow}>
                <Icon name="warning" size={14} color="#f59e0b" />
                <ThemedText style={styles.modalWarning}>
                  {otherFiles.length} 个非本人上传的文件将被跳过
                </ThemedText>
              </View>
            )}
            <View style={styles.warningRow}>
              <Icon name="warning" size={14} color="#ef4444" />
              <ThemedText style={styles.modalDanger}>
                删除操作不可撤销
              </ThemedText>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setIsDeleteModalOpen(false)}
                disabled={isProcessing}
              >
                <ThemedText style={styles.modalButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleDeleteConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.modalButtonText, { color: '#fff' }]}>确认删除</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Tag Modal */}
      <Modal
        visible={isAddTagModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isProcessing && setIsAddTagModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#fff' }]}>
            <ThemedText style={styles.modalTitle}>添加标签</ThemedText>
            <ThemedText style={styles.modalText}>
              为选中的 {ownFiles.length} 个文件添加标签
            </ThemedText>
            <TextInput
              style={[styles.tagInput, { 
                backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f5f5f5',
                color: colorScheme === 'dark' ? '#fff' : '#000',
              }]}
              placeholder="输入标签名称..."
              placeholderTextColor={colorScheme === 'dark' ? '#8e8e93' : '#999'}
              value={tagInput}
              onChangeText={handleTagSearch}
              autoCapitalize="none"
            />
            {tagSuggestions.length > 0 && (
              <ScrollView style={styles.suggestionsContainer} nestedScrollEnabled>
                {tagSuggestions.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={styles.suggestionItem}
                    onPress={() => {
                      setTagInput(tag.name);
                      setTagSuggestions([]);
                    }}
                  >
                    <ThemedText>{tag.name}</ThemedText>
                    <ThemedText style={styles.suggestionCount}>{tag.count} 个文件</ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setIsAddTagModalOpen(false);
                  setTagInput('');
                  setTagSuggestions([]);
                }}
                disabled={isProcessing}
              >
                <ThemedText style={styles.modalButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleAddTagConfirm}
                disabled={isProcessing || !tagInput.trim()}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.modalButtonText, { color: '#fff' }]}>确认添加</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove Tag Modal */}
      <Modal
        visible={isRemoveTagModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isProcessing && setIsRemoveTagModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#fff' }]}>
            <ThemedText style={styles.modalTitle}>移除标签</ThemedText>
            <ThemedText style={styles.modalText}>
              从选中的 {ownFiles.length} 个文件中移除标签
            </ThemedText>
            {selectedFilesTags.length > 0 ? (
              <ScrollView style={styles.tagsContainer} nestedScrollEnabled>
                <View style={styles.tagsGrid}>
                  {selectedFilesTags.map((tag) => (
                    <TouchableOpacity
                      key={tag.id}
                      style={[
                        styles.tagChip,
                        selectedTagToRemove?.id === tag.id && styles.tagChipSelected,
                      ]}
                      onPress={() => setSelectedTagToRemove(tag)}
                    >
                      <ThemedText style={[
                        styles.tagChipText,
                        selectedTagToRemove?.id === tag.id && styles.tagChipTextSelected,
                      ]}>
                        {tag.name} ({tag.count})
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <ThemedText style={styles.noTagsText}>选中的文件没有标签</ThemedText>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setIsRemoveTagModalOpen(false);
                  setSelectedTagToRemove(null);
                }}
                disabled={isProcessing}
              >
                <ThemedText style={styles.modalButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleRemoveTagConfirm}
                disabled={isProcessing || !selectedTagToRemove}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.modalButtonText, { color: '#fff' }]}>确认移除</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Batch Edit Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isProcessing && setIsEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.modalContentLarge, { backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#fff' }]}>
            <ThemedText style={styles.modalTitle}>批量编辑</ThemedText>
            <ThemedText style={styles.modalText}>
              编辑选中的 {ownFiles.length} 个文件
            </ThemedText>
            {otherFiles.length > 0 && (
              <View style={styles.warningRow}>
                <Icon name="warning" size={14} color="#f59e0b" />
                <ThemedText style={styles.modalWarning}>
                  {otherFiles.length} 个非本人上传的文件将被跳过
                </ThemedText>
              </View>
            )}
            <ThemedText style={styles.modalHint}>
              留空的字段将保持原值不变
            </ThemedText>
            
            <ScrollView style={styles.editFormContainer} nestedScrollEnabled>
              {/* Activity Date */}
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>活动日期</ThemedText>
                <TextInput
                  style={[styles.formInput, { 
                    backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f5f5f5',
                    color: colorScheme === 'dark' ? '#fff' : '#000',
                  }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colorScheme === 'dark' ? '#8e8e93' : '#999'}
                  value={editActivityDate}
                  onChangeText={setEditActivityDate}
                />
              </View>
              
              {/* Activity Type */}
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>活动类型</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      !editActivityType && styles.typeOptionSelected,
                    ]}
                    onPress={() => setEditActivityType('')}
                  >
                    <ThemedText style={[
                      styles.typeOptionText,
                      !editActivityType && styles.typeOptionTextSelected,
                    ]}>不修改</ThemedText>
                  </TouchableOpacity>
                  {activityTypePresets?.map((preset: TagPreset) => (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.typeOption,
                        editActivityType === preset.value && styles.typeOptionSelected,
                      ]}
                      onPress={() => setEditActivityType(preset.value)}
                    >
                      <ThemedText style={[
                        styles.typeOptionText,
                        editActivityType === preset.value && styles.typeOptionTextSelected,
                      ]}>{preset.display_name}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              {/* Activity Name */}
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>活动名称</ThemedText>
                <TextInput
                  style={[styles.formInput, { 
                    backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f5f5f5',
                    color: colorScheme === 'dark' ? '#fff' : '#000',
                  }]}
                  placeholder="输入活动名称"
                  placeholderTextColor={colorScheme === 'dark' ? '#8e8e93' : '#999'}
                  value={editActivityName}
                  onChangeText={setEditActivityName}
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setIsEditModalOpen(false);
                  setEditActivityDate('');
                  setEditActivityType('');
                  setEditActivityName('');
                }}
                disabled={isProcessing}
              >
                <ThemedText style={styles.modalButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleEditConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.modalButtonText, { color: '#fff' }]}>确认修改</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}


const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 70,
  },
  actionIcon: {
    marginBottom: 4,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  modalContentLarge: {
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalWarning: {
    fontSize: 13,
    color: '#f59e0b',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDanger: {
    fontSize: 13,
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalButtonPrimary: {
    backgroundColor: '#f97316',
  },
  modalButtonDanger: {
    backgroundColor: '#ef4444',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tagInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  suggestionsContainer: {
    maxHeight: 150,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  suggestionCount: {
    fontSize: 12,
    opacity: 0.6,
  },
  tagsContainer: {
    maxHeight: 200,
    marginBottom: 12,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  tagChipSelected: {
    backgroundColor: '#1a1a1a',
  },
  tagChipText: {
    fontSize: 14,
  },
  tagChipTextSelected: {
    color: '#fff',
  },
  noTagsText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    paddingVertical: 20,
  },
  editFormContainer: {
    maxHeight: 300,
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  formInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  typeSelector: {
    flexDirection: 'row',
  },
  typeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginRight: 8,
  },
  typeOptionSelected: {
    backgroundColor: '#f97316',
  },
  typeOptionText: {
    fontSize: 14,
  },
  typeOptionTextSelected: {
    color: '#fff',
  },
  modalHint: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default BatchActionBar;
