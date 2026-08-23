'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDocumentService } from '@/lib/hooks/useDocumentService'
import { useToast } from '@/components/Toast'

interface NewDocumentButtonProps {
  variant?: 'default' | 'inline'
}

export default function NewDocumentButton({ variant = 'default' }: NewDocumentButtonProps) {
  const [loading, setLoading] = useState(false)
  const { create } = useDocumentService()
  const router = useRouter()
  const toast = useToast()

  async function handleCreate() {
    setLoading(true)
    try {
      const docId = await create()
      router.push(`/doc/${docId}`)
    } catch (err) {
      console.error('Failed to create document:', err)
      // Carries the server's message, which is how the caller learns they have
      // hit the rate limit and how long to wait.
      toast.error(err instanceof Error ? err.message : 'Could not create a document.')
      setLoading(false)
    }
  }

  if (variant === 'inline') {
    return (
      <button onClick={handleCreate} disabled={loading} className="text-sm text-[#1b1a17] font-medium underline underline-offset-4 decoration-[#d9c58c] decoration-2 hover:decoration-[#b7912f] disabled:opacity-50 transition-colors">
        {loading ? 'Creating…' : 'Create your first document →'}
      </button>
    )
  }

  return (
    <button onClick={handleCreate} disabled={loading} className="inline-flex items-center gap-2 bg-[#1b1a17] text-[#f7f6f2] px-5 py-2 rounded-full text-sm font-medium shadow-sm hover:bg-black hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {loading ? 'Creating…' : 'New Document'}
    </button>
  )
}
