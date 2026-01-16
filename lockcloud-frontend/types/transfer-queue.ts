// Transfer Queue Types (Upload + Download)

export type TransferType = 'upload' | 'download';
export type TransferStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Base transfer item
export interface TransferFileItem {
  id: string;
  filename: string;
  status: TransferStatus;
  progress: number;
  transferredBytes: number;
  totalBytes: number;
  error?: string;
}

// Upload specific
export interface UploadFileItem extends TransferFileItem {
  file: File;
  customFilename?: string;
  s3Key?: string;
}

// Download specific
export interface DownloadFileItem extends TransferFileItem {
  fileId: number;
  downloadUrl?: string;
  blob?: Blob;
  contentType?: string;
}

// Base task
export interface TransferTask {
  id: string;
  type: TransferType;
  status: TransferStatus;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// Upload task
export interface UploadTask extends TransferTask {
  type: 'upload';
  files: UploadFileItem[];
  activityDate: string;
  activityType: string;
  activityName?: string;
}

// Download task
export interface DownloadTask extends TransferTask {
  type: 'download';
  files: DownloadFileItem[];
}

// Union type for all tasks
export type AnyTransferTask = UploadTask | DownloadTask;

// Request types
export interface CreateUploadTaskRequest {
  files: Array<{
    file: File;
    customFilename?: string;
  }>;
  activityDate: string;
  activityType: string;
  activityName?: string;
}

export interface CreateDownloadTaskRequest {
  files: Array<{
    fileId: number;
    filename: string;
    size: number;
    contentType?: string;
  }>;
}
