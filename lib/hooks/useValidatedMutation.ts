import { useState, useCallback, useRef } from 'react'
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
 *   readValidationErrors — the same messages, readable as soon as execute()
 *                          resolves, before React has re-rendered with them
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
  // Mirrors the state so a caller awaiting execute() can read why it failed in
  // the same tick. Reading the state variable there yields the value from the
  // render that created the closure — the previous failure's message, or null.
  const errorsRef = useRef<ValidationErrors | null>(null)
  const { execute: executeRaw, isLoading, error, retry, clearError } = useConvexError(mutationFn)

  const record = useCallback((errors: ValidationErrors | null) => {
    errorsRef.current = errors
    setValidationErrors(errors)
  }, [])

  const execute = useCallback(
    async (args: TArgs): Promise<boolean> => {
      record(null)

      const result = schema.safeParse(args)
      if (!result.success) {
        record(parseZodError(result.error))
        return false
      }

      return executeRaw(result.data as TArgs)
    },
    [schema, executeRaw, record]
  )

  const clearErrors = useCallback(() => {
    record(null)
    clearError()
  }, [clearError, record])

  return {
    execute,
    validationErrors,
    readValidationErrors: useCallback(() => errorsRef.current, []),
    clearValidationErrors: useCallback(() => record(null), [record]),
    isLoading,
    error,
    retry,
    clearErrors,
  }
}
