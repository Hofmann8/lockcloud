import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export function LoadingSpinner({ 
  size = 'md', 
  text = '加载中...', 
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizeClasses[size]} border-accent-blue border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label="加载中"
        style={{
          borderTopColor: 'transparent',
          borderRightColor: 'var(--color-blue)',
          borderBottomColor: 'var(--color-blue)',
          borderLeftColor: 'var(--color-blue)',
        }}
      />
      {text && (
        <p className="text-sm text-primary-black/70 font-medium">{text}</p>
      )}
    </div>
  )
}

interface LoadingOverlayProps {
  text?: string
}

export function LoadingOverlay({ text = '加载中...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="card-functional p-8 shadow-xl">
        <LoadingSpinner size="lg" text={text} />
      </div>
    </div>
  )
}

interface InlineLoadingProps {
  text?: string
}

export function InlineLoading({ text = '加载中...' }: InlineLoadingProps) {
  return (
    <div className="flex items-center justify-center py-8">
      <LoadingSpinner size="md" text={text} />
    </div>
  )
}
