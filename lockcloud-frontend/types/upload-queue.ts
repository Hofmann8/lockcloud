// Upload Queue Types

export interface UploadTask {
  id: string;
  files: UploadFileItem[];
  activityDate: string;
  activityType: string;
  activityName?: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface UploadFileItem {
  id: string;
  file: File;
  customFilename?: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  error?: string;
  s3Key?: string;
}

export interface CreateUploadTaskRequest {
  files: Array<{
    file: File;
    customFilename?: string;
  }>;
  activityDate: string;
  activityType: string;
  activityName?: string;
}
