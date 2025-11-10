# API Client Documentation

This directory contains the API client configuration and service functions for the LockCloud frontend.

## Structure

### `client.ts`
The base Axios client with interceptors for authentication and error handling.

**Features:**
- Automatic JWT token injection from localStorage
- Response error handling with Chinese error messages
- Automatic redirect to login on 401 errors
- Network error handling

### `auth.ts`
Authentication API service functions.

**Functions:**
- `sendCode(email)` - Send verification code to email
- `register(data)` - Register new user with verification code
- `login(data)` - Login and get JWT token
- `refreshToken()` - Refresh JWT token
- `getMe()` - Get current user information

### `files.ts`
File management API service functions.

**Functions:**
- `getUploadUrl(data)` - Request signed upload URL
- `confirmUpload(data)` - Confirm file upload completion
- `listFiles(filters)` - List files with optional filters
- `getFile(fileId)` - Get single file metadata
- `deleteFile(fileId)` - Delete file (owner only)
- `getDirectories()` - Get directory structure

### `logs.ts`
Logging and statistics API service functions.

**Functions:**
- `getLogs(filters)` - Query file operation logs
- `getSummary()` - Get usage summary statistics

## Usage Example

```typescript
import * as authApi from '@/lib/api/auth';
import * as filesApi from '@/lib/api/files';

// Login
const { token, user } = await authApi.login({
  email: 'user@zju.edu.cn',
  password: 'password123'
});

// List files
const { files, total } = await filesApi.listFiles({
  directory: '/rehearsals/2025-01-session/',
  page: 1,
  per_page: 50
});
```

## Error Handling

All API functions throw structured errors with the following format:

```typescript
{
  code: string;      // Error code (e.g., 'AUTH_001')
  message: string;   // Chinese error message
  details?: object;  // Additional error details
}
```

Common error codes:
- `AUTH_001` - 用户名或密码错误
- `AUTH_002` - 邮箱必须是浙江大学邮箱
- `AUTH_004` - 登录已过期，请重新登录
- `FILE_001` - 文件不存在
- `FILE_002` - 无权访问此文件
- `NETWORK_ERROR` - 网络连接失败
