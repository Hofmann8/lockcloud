# Utility Functions

This directory contains utility functions for error handling, toast notifications, and loading states.

## Toast Notifications

### Basic Usage

```typescript
import { showToast, toastMessages } from '@/lib/utils/toast'

// Success toast
showToast.success('操作成功')
showToast.success(toastMessages.uploadSuccess)

// Error toast
showToast.error('操作失败')
showToast.error(toastMessages.networkError)

// Warning toast
showToast.warning('文件大小超过限制')

// Info toast
showToast.info('正在处理您的请求')

// Loading toast
const toastId = showToast.loading('上传中...')
// Later dismiss it
showToast.dismiss(toastId)
```

### Promise-based Toast

```typescript
import { showToast } from '@/lib/utils/toast'

const uploadPromise = uploadFile(file, directory)

showToast.promise(uploadPromise, {
  loading: '上传中...',
  success: '上传成功',
  error: '上传失败',
})
```

### Predefined Messages

```typescript
import { toastMessages } from '@/lib/utils/toast'

// Success messages
toastMessages.loginSuccess
toastMessages.uploadSuccess
toastMessages.deleteSuccess

// Error messages
toastMessages.loginError
toastMessages.networkError
toastMessages.sessionExpired
toastMessages.permissionDenied

// Loading messages
toastMessages.loading
toastMessages.uploading
toastMessages.deleting
```

## Error Handling

### Basic Error Handling

```typescript
import { handleApiError } from '@/lib/utils/errorHandler'

try {
  await someApiCall()
} catch (error) {
  handleApiError(error) // Automatically shows appropriate toast
}
```

### Specific Error Handlers

```typescript
import { errorHandlers } from '@/lib/utils/errorHandler'

// Login error
try {
  await login(email, password)
} catch (error) {
  errorHandlers.login(error)
}

// Upload error
try {
  await uploadFile(file)
} catch (error) {
  errorHandlers.upload(error)
}

// Delete error
try {
  await deleteFile(fileId)
} catch (error) {
  errorHandlers.delete(error)
}
```

### Wrap Functions with Error Handling

```typescript
import { withErrorHandling } from '@/lib/utils/errorHandler'

const safeUpload = withErrorHandling(uploadFile)

// Now errors are automatically handled
await safeUpload(file, directory)
```

## Loading States

### Using LoadingSpinner

```typescript
import { LoadingSpinner, LoadingOverlay, InlineLoading } from '@/components'

// Small spinner
<LoadingSpinner size="sm" text="加载中..." />

// Medium spinner (default)
<LoadingSpinner size="md" text="处理中..." />

// Large spinner
<LoadingSpinner size="lg" text="上传中..." />

// Full-page overlay
<LoadingOverlay text="正在保存..." />

// Inline loading
<InlineLoading text="加载数据..." />
```

### Using Skeleton Loaders

```typescript
import {
  FileCardSkeleton,
  FileGridSkeleton,
  FileListSkeleton,
  TableSkeleton,
  FormSkeleton,
  StatCardSkeleton,
  StatsGridSkeleton,
} from '@/components'

// File grid skeleton
{isLoading && <FileGridSkeleton count={6} />}

// Table skeleton
{isLoading && <TableSkeleton rows={10} columns={5} />}

// Stats grid skeleton
{isLoading && <StatsGridSkeleton count={4} />}
```

### Using Loading Hooks

```typescript
import { useLoading, useLoadingStates } from '@/lib/hooks/useLoading'

// Single loading state
function MyComponent() {
  const { isLoading, startLoading, stopLoading, withLoading } = useLoading()

  const handleSubmit = async () => {
    await withLoading(async () => {
      await someAsyncOperation()
    })
  }

  return <Button disabled={isLoading}>Submit</Button>
}

// Multiple loading states
function MyComponent() {
  const { isLoading, withLoading } = useLoadingStates(['upload', 'delete', 'fetch'])

  const handleUpload = async () => {
    await withLoading('upload', async () => {
      await uploadFile()
    })
  }

  return (
    <>
      <Button disabled={isLoading('upload')}>Upload</Button>
      <Button disabled={isLoading('delete')}>Delete</Button>
    </>
  )
}
```

## Error Boundary

### Wrap Components with ErrorBoundary

```typescript
import { ErrorBoundary } from '@/components'

function App() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  )
}

// With custom fallback
function App() {
  return (
    <ErrorBoundary
      fallback={
        <div>
          <h1>Something went wrong</h1>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      }
    >
      <YourComponent />
    </ErrorBoundary>
  )
}
```

## Complete Example

```typescript
'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { uploadFile } from '@/lib/api/files'
import { showToast, toastMessages } from '@/lib/utils/toast'
import { handleApiError } from '@/lib/utils/errorHandler'
import { useLoading } from '@/lib/hooks/useLoading'
import { LoadingSpinner, ErrorBoundary } from '@/components'

function UploadComponent() {
  const [file, setFile] = useState<File | null>(null)
  const { isLoading, withLoading } = useLoading()

  const uploadMutation = useMutation({
    mutationFn: (data: { file: File; directory: string }) =>
      uploadFile(data.file, data.directory),
    onSuccess: () => {
      showToast.success(toastMessages.uploadSuccess)
    },
    onError: (error) => {
      handleApiError(error)
    },
  })

  const handleUpload = async () => {
    if (!file) {
      showToast.warning('请选择文件')
      return
    }

    await withLoading(async () => {
      await uploadMutation.mutateAsync({
        file,
        directory: '/uploads',
      })
    })
  }

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleUpload} disabled={isLoading}>
        {isLoading ? <LoadingSpinner size="sm" text="上传中..." /> : '上传'}
      </button>
    </div>
  )
}

export default function Page() {
  return (
    <ErrorBoundary>
      <UploadComponent />
    </ErrorBoundary>
  )
}
```

## API Client Integration

The API client (`lib/api/client.ts`) automatically handles common errors:

- **401 Unauthorized**: Shows "登录已过期，请重新登录" and redirects to login
- **403 Forbidden**: Shows "无权访问"
- **Network errors**: Shows "网络连接失败，请检查网络"

You don't need to handle these errors manually in your components.

## Best Practices

1. **Use skeleton loaders** for better perceived performance instead of just spinners
2. **Use toast notifications** for user feedback on actions
3. **Wrap async operations** with loading states
4. **Use ErrorBoundary** at the top level of your app or page
5. **Handle specific errors** with custom messages when needed
6. **Use predefined messages** from `toastMessages` for consistency
7. **Combine loading states** with disabled buttons to prevent duplicate submissions
