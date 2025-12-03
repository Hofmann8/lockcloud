import React from 'react'

interface SkeletonProps {
  className?: string
}

/**
 * Skeleton - Modern loading placeholder component
 * Uses shimmer animation for a polished loading experience
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      role="status"
      aria-label="加载中"
    />
  )
}

export function FileCardSkeleton() {
  return (
    <div className="card-functional p-4 space-y-3">
      {/* Thumbnail skeleton */}
      <Skeleton className="w-full h-48 rounded-t-lg" />
      
      {/* File name skeleton */}
      <Skeleton className="h-4 w-3/4" />
      
      {/* Metadata skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      
      {/* Button skeleton */}
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  )
}

export function FileGridSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <FileCardSkeleton key={index} />
      ))}
    </div>
  )
}

export function FileListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card-functional p-4">
          <div className="flex items-center gap-4">
            {/* Icon skeleton */}
            <Skeleton className="w-12 h-12 rounded-lg" />
            
            {/* Content skeleton */}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            
            {/* Action skeleton */}
            <Skeleton className="w-20 h-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} className="h-6" />
        ))}
      </div>
      
      {/* Rows skeleton */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-8" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Form fields */}
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      
      {/* Submit button */}
      <Skeleton className="h-12 w-full" />
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="card-functional p-6 space-y-3">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-4 w-40" />
    </div>
  )
}

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  )
}
