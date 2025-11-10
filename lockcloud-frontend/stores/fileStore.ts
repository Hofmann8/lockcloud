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
  uploadFile: (file: globalThis.File, directory: string) => Promise<File>;
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
  
  uploadFile: async (file: globalThis.File, directory: string) => {
    set({ isUploading: true, uploadProgress: 0 });
    
    try {
      // Step 1: Request signed upload URL
      const uploadUrlRequest: UploadUrlRequest = {
        filename: file.name,
        directory,
        content_type: file.type,
      };
      
      const { upload_url, file_key } = await filesApi.getUploadUrl(uploadUrlRequest);
      
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
        file_key,
        filename: file.name,
        directory,
        size: file.size,
        content_type: file.type,
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
