import toast, { Toaster } from 'react-hot-toast'

// Toast helper functions with Chinese messages
export const showToast = {
  success: (message: string) => {
    return toast.success(message, {
      duration: 3000,
      position: 'top-center',
      style: {
        background: '#7bc96f',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
        border: '2px solid #1a1a1a',
        fontWeight: '500',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#7bc96f',
      },
    })
  },

  error: (message: string) => {
    return toast.error(message, {
      duration: 4000,
      position: 'top-center',
      style: {
        background: '#e74c3c',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
        border: '2px solid #1a1a1a',
        fontWeight: '500',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#e74c3c',
      },
    })
  },

  warning: (message: string) => {
    return toast(message, {
      duration: 3500,
      position: 'top-center',
      icon: '⚠️',
      style: {
        background: '#ff8c42',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
        border: '2px solid #1a1a1a',
        fontWeight: '500',
      },
    })
  },

  info: (message: string) => {
    return toast(message, {
      duration: 3000,
      position: 'top-center',
      icon: 'ℹ️',
      style: {
        background: '#5fa8d3',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
        border: '2px solid #1a1a1a',
        fontWeight: '500',
      },
    })
  },

  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-center',
      style: {
        background: '#fafafa',
        color: '#1a1a1a',
        padding: '16px',
        borderRadius: '8px',
        border: '2px solid #1a1a1a',
        fontWeight: '500',
      },
    })
  },

  // Dismiss a specific toast
  dismiss: (toastId?: string) => {
    toast.dismiss(toastId)
  },

  // Promise-based toast for async operations
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string
      error: string
    }
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        style: {
          padding: '16px',
          borderRadius: '8px',
          border: '2px solid #1a1a1a',
          fontWeight: '500',
        },
        success: {
          style: {
            background: '#7bc96f',
            color: '#fff',
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#7bc96f',
          },
        },
        error: {
          style: {
            background: '#e74c3c',
            color: '#fff',
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#e74c3c',
          },
        },
        loading: {
          style: {
            background: '#fafafa',
            color: '#1a1a1a',
          },
        },
      }
    )
  },
}

// Export Toaster component for use in layout
export { Toaster }

// Common Chinese toast messages
export const toastMessages = {
  // Success messages
  loginSuccess: '登录成功',
  registerSuccess: '注册成功',
  uploadSuccess: '上传成功',
  deleteSuccess: '删除成功',
  saveSuccess: '保存成功',
  updateSuccess: '更新成功',

  // Error messages
  loginError: '登录失败，请检查邮箱和密码',
  registerError: '注册失败，请重试',
  uploadError: '上传失败，请重试',
  deleteError: '删除失败，请重试',
  networkError: '网络连接失败，请检查网络',
  unknownError: '发生未知错误，请重试',
  sessionExpired: '登录已过期，请重新登录',
  permissionDenied: '无权访问',
  invalidInput: '输入数据无效',

  // Warning messages
  fileSizeWarning: '文件大小超过限制',
  fileTypeWarning: '不支持的文件类型',
  
  // Info messages
  loading: '加载中...',
  uploading: '上传中...',
  deleting: '删除中...',
  processing: '处理中...',
}
