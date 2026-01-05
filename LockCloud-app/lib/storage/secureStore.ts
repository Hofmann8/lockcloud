/**
 * Secure Storage Service
 * 
 * Uses expo-secure-store for encrypted storage of sensitive data like JWT tokens.
 * This replaces localStorage used in the web frontend.
 * 
 * Requirements: 1.3, 13.1
 */

import * as SecureStore from 'expo-secure-store';
import { User } from '../../types';

// Storage keys
const STORAGE_KEYS = {
  TOKEN: 'lockcloud_token',
  USER: 'lockcloud_user',
} as const;

/**
 * Storage service interface for secure data persistence
 */
export interface StorageService {
  setToken(token: string): Promise<void>;
  getToken(): Promise<string | null>;
  removeToken(): Promise<void>;
  setUser(user: User): Promise<void>;
  getUser(): Promise<User | null>;
  removeUser(): Promise<void>;
  clearAll(): Promise<void>;
}

/**
 * Store JWT token securely
 * @param token - JWT token string
 */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
}

/**
 * Retrieve stored JWT token
 * @returns JWT token string or null if not found
 */
export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);
}

/**
 * Remove stored JWT token
 */
export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
}

/**
 * Store user data securely
 * @param user - User object to store
 */
export async function setUser(user: User): Promise<void> {
  const userJson = JSON.stringify(user);
  await SecureStore.setItemAsync(STORAGE_KEYS.USER, userJson);
}

/**
 * Retrieve stored user data
 * @returns User object or null if not found
 */
export async function getUser(): Promise<User | null> {
  const userJson = await SecureStore.getItemAsync(STORAGE_KEYS.USER);
  if (!userJson) {
    return null;
  }
  try {
    return JSON.parse(userJson) as User;
  } catch {
    // If JSON parsing fails, remove corrupted data
    await removeUser();
    return null;
  }
}

/**
 * Remove stored user data
 */
export async function removeUser(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.USER);
}

/**
 * Clear all stored credentials
 */
export async function clearAll(): Promise<void> {
  await Promise.all([
    removeToken(),
    removeUser(),
  ]);
}

// Export as a service object for convenience
export const secureStore: StorageService = {
  setToken,
  getToken,
  removeToken,
  setUser,
  getUser,
  removeUser,
  clearAll,
};

export default secureStore;
