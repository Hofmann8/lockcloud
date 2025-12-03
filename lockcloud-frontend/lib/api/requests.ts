import apiClient from './client';

export interface FileRequestData {
  id: number;
  file_id: number | null;
  requester_id: number;
  owner_id: number;
  request_type: 'edit' | 'delete' | 'directory_edit';
  status: 'pending' | 'approved' | 'rejected';
  proposed_changes?: {
    activity_date?: string;
    activity_type?: string;
    activity_name?: string;
    instructor?: string;
    filename?: string;
    free_tags?: string[];
    new_activity_name?: string;
    new_activity_type?: string;
  };
  directory_info?: {
    activity_date: string;
    activity_name: string;
    activity_type: string;
  };
  message?: string;
  response_message?: string;
  created_at: string;
  updated_at: string;
  file?: {
    id: number;
    filename: string;
    activity_date?: string;
    activity_type?: string;
    activity_name?: string;
  };
  requester?: { id: number; name: string };
  owner?: { id: number; name: string };
}

// Create a new request
export const createRequest = async (data: {
  file_id: number;
  request_type: 'edit' | 'delete';
  proposed_changes?: {
    activity_date?: string;
    activity_type?: string;
    activity_name?: string;
    instructor?: string;
    filename?: string;
    free_tags?: string[];
  };
  message?: string;
}): Promise<FileRequestData> => {
  const response = await apiClient.post('/api/requests', data);
  return response.data.request;
};

// Get received requests (as file owner)
export const getReceivedRequests = async (status?: string): Promise<FileRequestData[]> => {
  const params = status ? { status } : {};
  const response = await apiClient.get('/api/requests/received', { params });
  return response.data.requests;
};

// Get sent requests
export const getSentRequests = async (status?: string): Promise<FileRequestData[]> => {
  const params = status ? { status } : {};
  const response = await apiClient.get('/api/requests/sent', { params });
  return response.data.requests;
};

// Get pending request count
export const getPendingCount = async (): Promise<number> => {
  const response = await apiClient.get('/api/requests/pending-count');
  return response.data.count;
};

// Approve a request
export const approveRequest = async (requestId: number, responseMessage?: string): Promise<FileRequestData> => {
  const response = await apiClient.post(`/api/requests/${requestId}/approve`, {
    response_message: responseMessage,
  });
  return response.data.request;
};

// Reject a request
export const rejectRequest = async (requestId: number, responseMessage?: string): Promise<FileRequestData> => {
  const response = await apiClient.post(`/api/requests/${requestId}/reject`, {
    response_message: responseMessage,
  });
  return response.data.request;
};

// Create a directory edit request
export const createDirectoryRequest = async (data: {
  activity_date: string;
  activity_name: string;
  activity_type: string;
  proposed_changes: {
    new_activity_name?: string;
    new_activity_type?: string;
  };
  message?: string;
}): Promise<FileRequestData> => {
  const response = await apiClient.post('/api/requests/directory', data);
  return response.data.request;
};
