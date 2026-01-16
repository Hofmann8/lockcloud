'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getAvatarUploadUrl, uploadAvatarToS3, confirmAvatarUpload, deleteAvatar } from '@/lib/api/auth';
import { Button } from './Button';
import { UserAvatar } from './UserAvatar';
import toast from 'react-hot-toast';

interface AvatarUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function AvatarUploadDialog({ isOpen, onClose }: AvatarUploadDialogProps) {
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('请选择 JPG、PNG、WebP 或 GIF 格式的图片');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('图片大小不能超过 5MB');
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get upload URL
      const { upload_url, avatar_key } = await getAvatarUploadUrl(selectedFile.type);
      setUploadProgress(20);

      // Step 2: Upload to S3
      await uploadAvatarToS3(upload_url, selectedFile, (progress) => {
        setUploadProgress(20 + progress * 0.6); // 20-80%
      });
      setUploadProgress(80);

      // Step 3: Confirm upload
      const result = await confirmAvatarUpload(avatar_key);
      setUploadProgress(100);

      // Update user in store
      if (user) {
        setUser({
          ...user,
          avatar_key: result.avatar_key,
          avatar_url: result.avatar_url,
        });
      }

      toast.success('头像更新成功');
      handleClose();
    } catch (error) {
      console.error('Avatar upload failed:', error);
      toast.error('头像上传失败，请重试');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!user?.avatar_key) return;

    setIsDeleting(true);
    try {
      await deleteAvatar();
      
      // Update user in store
      setUser({
        ...user,
        avatar_key: undefined,
        avatar_url: undefined,
      });

      toast.success('头像已删除');
      handleClose();
    } catch (error) {
      console.error('Avatar delete failed:', error);
      toast.error('删除头像失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    onClose();
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-sm w-full mx-4">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            更换头像
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current/Preview Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-24 h-24 rounded-full object-cover border-4 border-orange-500"
                />
              ) : (
                <div className="w-24 h-24">
                  <UserAvatar user={user} size="xl" className="!w-24 !h-24 !text-3xl" />
                </div>
              )}
              
              {/* Upload progress overlay */}
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <span className="text-white font-bold">{Math.round(uploadProgress)}%</span>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {previewUrl ? '预览新头像' : '当前头像'}
            </p>
          </div>

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              variant="primary"
              className="w-full"
              onClick={selectedFile ? handleUpload : triggerFileSelect}
              disabled={isUploading || isDeleting}
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  上传中...
                </span>
              ) : selectedFile ? (
                '确认上传'
              ) : (
                '选择图片'
              )}
            </Button>

            {selectedFile && !isUploading && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
              >
                重新选择
              </Button>
            )}

            {user?.avatar_key && !selectedFile && (
              <Button
                variant="secondary"
                className="w-full text-red-500 hover:text-red-600"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? '删除中...' : '删除头像'}
              </Button>
            )}
          </div>

          {/* Tips */}
          <p className="text-xs text-gray-400 text-center">
            支持 JPG、PNG、WebP、GIF，最大 5MB
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" className="w-full" onClick={handleClose}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
