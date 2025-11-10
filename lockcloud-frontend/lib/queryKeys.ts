/**
 * Query keys for React Query
 * Organized by feature for better cache management
 */

export const queryKeys = {
  // Auth queries
  auth: {
    me: ['auth', 'me'] as const,
  },
  
  // File queries
  files: {
    all: ['files'] as const,
    list: (filters?: Record<string, unknown>) => ['files', 'list', filters] as const,
    detail: (id: number) => ['files', 'detail', id] as const,
    directories: ['files', 'directories'] as const,
  },
  
  // Log queries
  logs: {
    all: ['logs'] as const,
    list: (filters?: Record<string, unknown>) => ['logs', 'list', filters] as const,
    summary: ['logs', 'summary'] as const,
  },
} as const;
