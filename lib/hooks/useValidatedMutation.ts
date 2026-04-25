import { useState, useCallback } from 'react'
import { type ZodSchema, type ZodError } from 'zod'
import { useConvexError } from './useConvexError'

export type ValidationErrors = Record<string, string>

function parseZodError(error: ZodError): ValidationErrors {
  const out: ValidationErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root'
    // Keep the first message per field
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/**
 * Validates args against a Zod schema before calling a Convex mutation.
 * Falls back to useConvexError for network/auth error handling and retry logic.
 *
 * Returns:
 *   execute(args)        — validates then calls the mutation; returns false on any failure
 *   validationErrors     — field-keyed validation messages (null when clean)
 *   isLoading            — true while a mutation attempt is in flight
 *   error                — network/auth/unknown error from useConvexError
 *   retry                — re-attempt the last call
 *   clearErrors          — reset both validationErrors and error
 */
// The schema may produce a structurally identical but nominally different type
// (e.g. z.string() vs Convex Id<"table"> which is string & brand). The cast
// inside execute is safe because Id types are plain strings at runtime.
export function useValidatedMutation<TArgs, TReturn>(
  mutationFn: (args: TArgs) => Promise<TReturn>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodSchema<any>
) {
  const [validationErrors, setValidationErrors] = useState<ValidationErrors | null>(null)
  const { execute: executeRaw, isLoading, error, retry, clearError } = useConvexError(mutationFn)

  const execute = useCallback(
    async (args: TArgs): Promise<boolean> => {
      setValidationErrors(null)

      const result = schema.safeParse(args)
      if (!result.success) {
        setValidationErrors(parseZodError(result.error))
        return false
      }

      return executeRaw(result.data as TArgs)
    },
    [schema, executeRaw]
  )

  const clearErrors = useCallback(() => {
    setValidationErrors(null)
    clearError()
  }, [clearError])

  return {
    execute,
    validationErrors,
    clearValidationErrors: useCallback(() => setValidationErrors(null), []),
    isLoading,
    error,
    retry,
    clearErrors,
  }
}
