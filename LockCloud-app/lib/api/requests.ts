/**
 * File Requests API
 * 
 * Handles file edit/delete request operations.
 * Follows backend routes (backend/file_requests/routes.py).
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7
 */

import apiClient from './client';
import { FileRequest, CreateRequestData, CreateDirectoryRequestData } from '../../types';

/**
 * Create a new file request
 * Endpoint: POST /api/requests
 * 
 * @param data - Request data including file_id, request_type, proposed_changes, and message
 * @returns Created request
 */
export const createRequest = async (data: CreateRequestData): Promise<FileRequest> => {
  const response = await apiClient.post('/api/requests', data);
  return response.data.request;
};

/**
 * Get received requests (as file owner)
 * Endpoint: GET /api/requests/received
 * 
 * @param status - Optional status filter ('pending', 'approved', 'rejected')
 * @returns Array of received requests
 */
export const getReceivedRequests = async (status?: string): Promise<FileRequest[]> => {
  const params = status ? { status } : {};
  const response = await apiClient.get('/api/requests/received', { params });
  return response.data.requests;
};

/**
 * Get sent requests
 * Endpoint: GET /api/requests/sent
 * 
 * @param status - Optional status filter ('pending', 'approved', 'rejected')
 * @returns Array of sent requests
 */
export const getSentRequests = async (status?: string): Promise<FileRequest[]> => {
  const params = status ? { status } : {};
  const response = await apiClient.get('/api/requests/sent', { params });
  return response.data.requests;
};

/**
 * Get pending request count
 * Endpoint: GET /api/requests/pending-count
 * 
 * @returns Number of pending requests
 */
export const getPendingCount = async (): Promise<number> => {
  const response = await apiClient.get('/api/requests/pending-count');
  return response.data.count;
};

/**
 * Approve a request
 * Endpoint: POST /api/requests/{id}/approve
 * 
 * @param requestId - Request ID
 * @param responseMessage - Optional response message
 * @returns Updated request
 */
export const approveRequest = async (
  requestId: number,
  responseMessage?: string
): Promise<FileRequest> => {
  const response = await apiClient.post(`/api/requests/${requestId}/approve`, {
    response_message: responseMessage,
  });
  return response.data.request;
};

/**
 * Reject a request
 * Endpoint: POST /api/requests/{id}/reject
 * 
 * @param requestId - Request ID
 * @param responseMessage - Optional response message
 * @returns Updated request
 */
export const rejectRequest = async (
  requestId: number,
  responseMessage?: string
): Promise<FileRequest> => {
  const response = await apiClient.post(`/api/requests/${requestId}/reject`, {
    response_message: responseMessage,
  });
  return response.data.request;
};

/**
 * Create a directory edit request
 * Endpoint: POST /api/requests/directory
 * 
 * @param data - Directory request data
 * @returns Created request
 */
export const createDirectoryRequest = async (
  data: CreateDirectoryRequestData
): Promise<FileRequest> => {
  const response = await apiClient.post('/api/requests/directory', data);
  return response.data.request;
};
