'use client'

import { useState } from 'react'
import type { TrashedDocumentSummary } from '@/lib/services/types'
import { useDocumentService } from '@/lib/hooks/useDocumentService'
import { useToast } from '@/components/Toast'
import { formatRelativeDate } from '@/lib/utils'

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
    <div data-testid="trash-card" className="doc-card rounded-xl p-3 h-full flex flex-col opacity-90">
      <div className="flex-1 h-32 bg-white border border-[#eeece3] rounded-lg mb-3 px-4 pt-4 pb-2 overflow-hidden">
        <p className="font-display text-[13px] font-semibold text-stone-500 truncate">{document.title || 'Untitled Document'}</p>
        <div className="w-8 h-px bg-stone-200 my-2" />
        {document.preview ? (
          <p className="doc-page-fade font-display text-[11px] leading-[1.8] text-stone-400 line-clamp-4">{document.preview}</p>
        ) : (
          <p className="font-display text-[11px] italic text-stone-300">Empty document</p>
        )}
      </div>

      <div className="px-1">
        <p className="font-medium text-[#1b1a17] text-sm truncate">{document.title || 'Untitled Document'}</p>
        <p className="text-xs text-stone-400 mt-1 mb-3">Trashed {formatRelativeDate(document.archivedAt)}</p>
      </div>

      <div className="flex gap-2">
        {confirming ? (
          <>
            <button
              onClick={handleDeleteForever}
              disabled={busy}
              className="flex-1 text-xs px-2 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="flex-1 text-xs px-2 py-2 bg-white border border-[#e7e3da] text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleRestore}
              disabled={busy}
              className="flex-1 text-xs px-2 py-2 bg-[#1b1a17] text-[#f7f6f2] rounded-lg hover:bg-black disabled:opacity-50 transition-colors"
            >
              Restore
            </button>
            <button
              onClick={handleDeleteForever}
              disabled={busy}
              className="flex-1 text-xs px-2 py-2 text-red-600 border border-red-200 bg-white rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Delete forever
            </button>
          </>
        )}
      </div>
    </div>
  )
}
