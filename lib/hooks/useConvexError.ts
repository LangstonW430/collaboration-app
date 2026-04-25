import { useState, useCallback, useRef } from 'react'

export type ConvexErrorType = 'network' | 'auth' | 'validation' | 'unknown'

export interface ConvexErrorState {
  message: string
  type: ConvexErrorType
}

function classifyError(err: unknown): ConvexErrorState {
  const raw = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('websocket') ||
    lower.includes('network request failed')
  ) {
    return {
      message: 'Connection lost. Please check your internet connection.',
      type: 'network',
    }
  }
  if (
    lower.includes('unauthorized') ||
    lower.includes('unauthenticated') ||
    lower.includes('forbidden') ||
    lower.includes('not authenticated')
  ) {
    return {
      message: 'Your session has expired. Please sign in again.',
      type: 'auth',
    }
  }
  if (
    lower.includes('invalid') ||
    lower.includes('validation') ||
    lower.includes('argument')
  ) {
    return {
      message: 'The request could not be completed. Please try again.',
      type: 'validation',
    }
  }
  return {
    message: 'Something went wrong. Please try again.',
    type: 'unknown',
  }
}

interface UseConvexErrorOptions {
  onError?: (error: ConvexErrorState) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useConvexError<TArgs, TReturn = any>(
  mutationFn: (args: TArgs) => Promise<TReturn>,
  options: UseConvexErrorOptions = {}
) {
  const [error, setError] = useState<ConvexErrorState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const lastArgsRef = useRef<TArgs | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const execute = useCallback(
    async (args: TArgs): Promise<boolean> => {
      lastArgsRef.current = args
      setIsLoading(true)
      setError(null)

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await mutationFn(args)
          setIsLoading(false)
          return true
        } catch (err) {
          const classified = classifyError(err)
          // Auth errors are not retryable; also stop after the third attempt
          if (classified.type === 'auth' || attempt === 2) {
            setError(classified)
            optionsRef.current.onError?.(classified)
            setIsLoading(false)
            return false
          }
          // Exponential backoff: 1 s, then 2 s before the final attempt
          await new Promise<void>(resolve =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt))
          )
        }
      }

      setIsLoading(false)
      return false
    },
    [mutationFn]
  )

  const retry = useCallback(async (): Promise<boolean> => {
    if (lastArgsRef.current === null) return false
    return execute(lastArgsRef.current)
  }, [execute])

  const clearError = useCallback(() => setError(null), [])

  return { error, isLoading, execute, retry, clearError }
}
