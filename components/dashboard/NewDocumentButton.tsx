'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDocumentService } from '@/lib/hooks/useDocumentService'

interface NewDocumentButtonProps {
  variant?: 'default' | 'inline'
}

export default function NewDocumentButton({ variant = 'default' }: NewDocumentButtonProps) {
  const [loading, setLoading] = useState(false)
  const { create } = useDocumentService()
  const router = useRouter()

  async function handleCreate() {
    setLoading(true)
    try {
      const docId = await create()
      router.push(`/doc/${docId}`)
    } catch (err) {
      console.error('Failed to create document:', err)
      setLoading(false)
    }
  }

  if (variant === 'inline') {
    return (
      <button onClick={handleCreate} disabled={loading} className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 transition-colors">
        {loading ? 'Creating…' : 'Create your first document →'}
      </button>
    )
  }

  return (
    <button onClick={handleCreate} disabled={loading} className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {loading ? 'Creating…' : 'New Document'}
    </button>
  )
}
