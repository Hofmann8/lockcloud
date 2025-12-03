import { create } from 'zustand';
import { File, UploadUrlRequest, FileConfirmRequest } from '@/types';
import * as filesApi from '@/lib/api/files';
import axios from 'axios';

interface FileState {
  files: File[];
  currentDirectory: string;
  selectedFile: File | null;
  isUploading: boolean;
  uploadProgress: number;
  
  // Basic setters
  setFiles: (files: File[]) => void;
  addFile: (file: File) => void;
  removeFile: (fileId: number) => void;
  setCurrentDirectory: (directory: string) => void;
  setSelectedFile: (file: File | null) => void;
  
  // Actions
  uploadFile: (file: globalThis.File) => Promise<File>;
  deleteFile: (fileId: number) => Promise<void>;
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  currentDirectory: '',
  selectedFile: null,
  isUploading: false,
  uploadProgress: 0,
  
  setFiles: (files) => set({ files }),
  
  addFile: (file) => set((state) => ({
    files: [...state.files, file],
  })),
  
  removeFile: (fileId) => set((state) => ({
    files: state.files.filter((f) => f.id !== fileId),
  })),
  
  setCurrentDirectory: (directory) => set({ currentDirectory: directory }),
  
  setSelectedFile: (file) => set({ selectedFile: file }),
  
  uploadFile: async (file: globalThis.File) => {
    set({ isUploading: true, uploadProgress: 0 });
    
    try {
      // Note: This is a simplified upload that may need additional parameters
      // In a real implementation, you'd need to provide activity_date and activity_type
      const uploadUrlRequest: UploadUrlRequest = {
        original_filename: file.name,
        content_type: file.type,
        size: file.size,
        activity_date: new Date().toISOString().split('T')[0], // Default to today
        activity_type: '', // Should be provided by the UI
      };
      
      const { upload_url, s3_key } = await filesApi.getUploadUrl(uploadUrlRequest);
      
      // Step 2: Upload file directly to S3 using signed URL
      await axios.put(upload_url, file, {
        headers: {
          'Content-Type': file.type,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            set({ uploadProgress: progress });
          }
        },
      });
      
      // Step 3: Confirm upload with backend
      const confirmRequest: FileConfirmRequest = {
        s3_key,
        original_filename: file.name,
        size: file.size,
        content_type: file.type,
        activity_date: new Date().toISOString().split('T')[0],
        activity_type: '',
      };
      
      const uploadedFile = await filesApi.confirmUpload(confirmRequest);
      
      // Add to store
      get().addFile(uploadedFile);
      
      set({ isUploading: false, uploadProgress: 100 });
      
      return uploadedFile;
    } catch (error) {
      set({ isUploading: false, uploadProgress: 0 });
      throw error;
    }
  },
  
  deleteFile: async (fileId: number) => {
    try {
      await filesApi.deleteFile(fileId);
      
      // Remove from store
      get().removeFile(fileId);
    } catch (error) {
      throw error;
    }
  },
}));
