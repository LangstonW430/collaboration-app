import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { z } from 'zod'
import { useValidatedMutation } from '../../../lib/hooks/useValidatedMutation'
import {
  createSuccessMutation,
  createFailingMutation,
} from '../../utils/mockConvexMutation'

// Simple schema used across tests
const testSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Title cannot be empty').max(10, 'Title too long'),
})

describe('useValidatedMutation', () => {
  // ── validation failures ─────────────────────────────────────────────────────

  describe('when validation fails', () => {
    it('does not call the mutationFn', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: '', title: 'Hi' })
      })

      expect(mutFn).not.toHaveBeenCalled()
    })

    it('returns false', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      let outcome: boolean | undefined
      await act(async () => {
        outcome = await result.current.execute({ id: '', title: 'Hi' })
      })

      expect(outcome).toBe(false)
    })

    it('sets validationErrors with field-keyed messages', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: '', title: '' })
      })

      expect(result.current.validationErrors).not.toBeNull()
      expect(result.current.validationErrors).toHaveProperty('id')
      expect(result.current.validationErrors).toHaveProperty('title')
    })

    it('stores the first error message per field', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: 'ok', title: '' })
      })

      expect(result.current.validationErrors?.title).toBe('Title cannot be empty')
    })

    it('reports the max-length message when title is too long', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: 'ok', title: 'way too long title' })
      })

      expect(result.current.validationErrors?.title).toBe('Title too long')
    })

    it('does not set isLoading while only validating', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: '', title: '' })
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  // ── successful mutation ─────────────────────────────────────────────────────

  describe('when validation passes and mutation succeeds', () => {
    it('calls the mutationFn with validated args', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: 'doc_1', title: 'My Doc' })
      })

      expect(mutFn).toHaveBeenCalledWith({ id: 'doc_1', title: 'My Doc' })
    })

    it('returns true', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      let outcome: boolean | undefined
      await act(async () => {
        outcome = await result.current.execute({ id: 'doc_1', title: 'My Doc' })
      })

      expect(outcome).toBe(true)
    })

    it('leaves validationErrors as null', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: 'doc_1', title: 'My Doc' })
      })

      expect(result.current.validationErrors).toBeNull()
    })

    it('leaves error as null', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: 'doc_1', title: 'My Doc' })
      })

      expect(result.current.error).toBeNull()
    })
  })

  // ── mutation failure (auth — no retry) ─────────────────────────────────────

  describe('when validation passes but mutation throws an auth error', () => {
    it('returns false', async () => {
      const mutFn = createFailingMutation('Not authenticated', { isAuth: true })
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      let outcome: boolean | undefined
      await act(async () => {
        outcome = await result.current.execute({ id: 'doc_1', title: 'My Doc' })
      })

      expect(outcome).toBe(false)
    })

    it('sets error.type to "auth"', async () => {
      const mutFn = createFailingMutation('Not authenticated', { isAuth: true })
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: 'doc_1', title: 'My Doc' })
      })

      expect(result.current.error?.type).toBe('auth')
    })

    it('does not set validationErrors for network/auth errors', async () => {
      const mutFn = createFailingMutation('Not authenticated', { isAuth: true })
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: 'doc_1', title: 'My Doc' })
      })

      expect(result.current.validationErrors).toBeNull()
    })

    it('calls the mutationFn once (no retry on auth errors)', async () => {
      const mutFn = createFailingMutation('Not authenticated', { isAuth: true })
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: 'doc_1', title: 'My Doc' })
      })

      expect(mutFn).toHaveBeenCalledTimes(1)
    })
  })

  // ── clearValidationErrors ───────────────────────────────────────────────────

  describe('clearValidationErrors', () => {
    it('resets validationErrors to null', async () => {
      const mutFn = createSuccessMutation()
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: '', title: '' })
      })
      expect(result.current.validationErrors).not.toBeNull()

      act(() => result.current.clearValidationErrors())

      expect(result.current.validationErrors).toBeNull()
    })
  })

  // ── clearErrors ─────────────────────────────────────────────────────────────

  describe('clearErrors', () => {
    it('resets both validationErrors and network error', async () => {
      const mutFn = createFailingMutation('Not authenticated', { isAuth: true })
      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: 'doc_1', title: 'My Doc' })
      })
      expect(result.current.error).not.toBeNull()

      act(() => result.current.clearErrors())

      expect(result.current.error).toBeNull()
      expect(result.current.validationErrors).toBeNull()
    })
  })

  // ── retry ───────────────────────────────────────────────────────────────────

  describe('retry', () => {
    it('re-calls the mutation with the last args', async () => {
      const mutFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Not authenticated'))
        .mockResolvedValueOnce(null)

      const { result } = renderHook(() =>
        useValidatedMutation(mutFn, testSchema)
      )

      await act(async () => {
        await result.current.execute({ id: 'doc_1', title: 'My Doc' })
      })
      // first call failed (auth), second call should succeed via retry
      await act(async () => {
        await result.current.retry()
      })

      expect(mutFn).toHaveBeenCalledTimes(2)
      expect(result.current.error).toBeNull()
    })
  })
})
