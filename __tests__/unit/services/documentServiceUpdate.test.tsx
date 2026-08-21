import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'

// One mutation stub stands in for every useMutation call in the provider.
const mutation = vi.fn()
vi.mock('convex/react', () => ({ useMutation: () => mutation }))

import { DocumentServiceProvider, useDocumentService } from '@/lib/hooks/useDocumentService'
import type { Id } from '@/convex/_generated/dataModel'

const wrapper = ({ children }: { children: ReactNode }) => (
  <DocumentServiceProvider>{children}</DocumentServiceProvider>
)

const docId = 'doc_1' as Id<'documents'>

beforeEach(() => {
  mutation.mockReset()
})

describe('DocumentService.update', () => {
  it("passes through the server's updatedAt", async () => {
    mutation.mockResolvedValue({ updatedAt: 1_700_000_000_000 })
    const { result } = renderHook(() => useDocumentService(), { wrapper })

    let received: { updatedAt: number } | undefined
    await act(async () => {
      received = await result.current.update(docId, { title: 'Hello' })
    })

    expect(received).toEqual({ updatedAt: 1_700_000_000_000 })
  })

  it('still resolves with a timestamp when the backend is a version behind', async () => {
    // A deployment that predates documents.update returning its updatedAt
    // resolves to null. Reading .updatedAt off that threw, which failed the
    // save, retried three times, and left the editor stuck as never saved.
    mutation.mockResolvedValue(null)
    const { result } = renderHook(() => useDocumentService(), { wrapper })

    let received: { updatedAt: number } | undefined
    await act(async () => {
      received = await result.current.update(docId, { title: 'Hello' })
    })

    expect(received).toBeDefined()
    expect(typeof received!.updatedAt).toBe('number')
    expect(received!.updatedAt).toBeGreaterThan(0)
  })

  it('does not swallow a genuine mutation failure', async () => {
    mutation.mockRejectedValue(new Error('Not authorized'))
    const { result } = renderHook(() => useDocumentService(), { wrapper })

    await expect(result.current.update(docId, { title: 'Hello' })).rejects.toThrow(
      /Not authorized/
    )
  })
})
