'use client'

import { useState } from 'react'
import type { TrashedDocumentSummary } from '@/lib/services/types'
import { useDocumentService } from '@/lib/hooks/useDocumentService'
import { useToast } from '@/components/Toast'
import { formatDate } from '@/lib/utils'

interface TrashCardProps {
  document: TrashedDocumentSummary
}

/**
 * A trashed document. Not a link: a document in the trash is restored or
 * destroyed from here, not opened.
 */
export default function TrashCard({ document }: TrashCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const { restore, remove } = useDocumentService()
  const toast = useToast()

  async function handleRestore() {
    setBusy(true)
    try {
      await restore(document._id)
      toast.success('Document restored.')
    } catch {
      toast.error('Could not restore this document.')
      setBusy(false)
    }
  }

  async function handleDeleteForever() {
    if (!confirming) { setConfirming(true); return }
    setBusy(true)
    try {
      await remove(document._id)
      toast.success('Document permanently deleted.')
    } catch {
      toast.error('Could not delete this document.')
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div data-testid="trash-card" className="bg-white rounded-xl border border-gray-200 p-4 h-full flex flex-col">
      <div className="flex-1 w-full h-28 bg-gray-50 rounded-lg mb-3 p-3 overflow-hidden">
        {document.preview ? (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-5">{document.preview}</p>
        ) : (
          <p className="text-xs text-gray-300 italic">Empty document</p>
        )}
      </div>

      <p className="font-medium text-gray-900 text-sm truncate">{document.title || 'Untitled Document'}</p>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">Trashed {formatDate(document.archivedAt)}</p>

      <div className="flex gap-2">
        {confirming ? (
          <>
            <button
              onClick={handleDeleteForever}
              disabled={busy}
              className="flex-1 text-xs px-2 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="flex-1 text-xs px-2 py-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleRestore}
              disabled={busy}
              className="flex-1 text-xs px-2 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Restore
            </button>
            <button
              onClick={handleDeleteForever}
              disabled={busy}
              className="flex-1 text-xs px-2 py-1.5 text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Delete forever
            </button>
          </>
        )}
      </div>
    </div>
  )
}
