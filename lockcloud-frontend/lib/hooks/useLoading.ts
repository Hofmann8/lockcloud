import { useState, useCallback } from 'react'

/**
 * Hook for managing loading states
 */
export function useLoading(initialState = false) {
  const [isLoading, setIsLoading] = useState(initialState)

  const startLoading = useCallback(() => {
    setIsLoading(true)
  }, [])

  const stopLoading = useCallback(() => {
    setIsLoading(false)
  }, [])

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        startLoading()
        const result = await fn()
        return result
      } finally {
        stopLoading()
      }
    },
    [startLoading, stopLoading]
  )

  return {
    isLoading,
    startLoading,
    stopLoading,
    withLoading,
  }
}

/**
 * Hook for managing multiple loading states
 */
export function useLoadingStates<T extends string>(keys: T[]) {
  const [loadingStates, setLoadingStates] = useState<Record<T, boolean>>(
    keys.reduce((acc, key) => ({ ...acc, [key]: false }), {} as Record<T, boolean>)
  )

  const startLoading = useCallback((key: T) => {
    setLoadingStates((prev) => ({ ...prev, [key]: true }))
  }, [])

  const stopLoading = useCallback((key: T) => {
    setLoadingStates((prev) => ({ ...prev, [key]: false }))
  }, [])

  const isLoading = useCallback((key: T) => {
    return loadingStates[key] || false
  }, [loadingStates])

  const isAnyLoading = useCallback(() => {
    return Object.values(loadingStates).some((state) => state)
  }, [loadingStates])

  const withLoading = useCallback(
    async <R,>(key: T, fn: () => Promise<R>): Promise<R> => {
      try {
        startLoading(key)
        const result = await fn()
        return result
      } finally {
        stopLoading(key)
      }
    },
    [startLoading, stopLoading]
  )

  return {
    loadingStates,
    startLoading,
    stopLoading,
    isLoading,
    isAnyLoading,
    withLoading,
  }
}
