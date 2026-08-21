'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { DocumentSummary } from '@/lib/services/types'
import { useDocumentService } from '@/lib/hooks/useDocumentService'
import { useToast } from '@/components/Toast'
import { formatRelativeDate } from '@/lib/utils'

interface DocumentCardProps {
  document: DocumentSummary
}

export default function DocumentCard({ document }: DocumentCardProps) {
  const isOwner = document.userRole === 'owner'
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [titleValue, setTitleValue] = useState(document.title || 'Untitled Document')
  // Optimistic star state; snaps back to the server's answer on failure.
  const [starred, setStarred] = useState(document.starred)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync displayed title when a remote update arrives. Skip while renaming.
  useEffect(() => {
    if (!renaming) setTitleValue(document.title || 'Untitled Document')
  }, [document.title, renaming])

  useEffect(() => {
    setStarred(document.starred)
  }, [document.starred])

  const { archive, update, duplicate, toggleStar } = useDocumentService()
  const toast = useToast()

  // Prepared by the server; see toSummary in convex/documents.ts.
  const preview = document.preview

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    try {
      await archive(document._id)
      toast.success('Moved to trash.')
      // No state reset on success: the card unmounts when the list updates.
    } catch {
      toast.error('Could not move this document to the trash.')
      setDeleting(false)
      setConfirming(false)
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirming(false)
  }

  async function handleToggleStar(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setStarred((s) => !s)
    try {
      const result = await toggleStar(document._id)
      setStarred(result.starred)
    } catch {
      setStarred(document.starred)
      toast.error('Could not update the star.')
    }
  }

  async function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await duplicate(document._id)
      toast.success('Copy created.')
    } catch {
      toast.error('Could not duplicate this document.')
    }
  }

  function handleRenameClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commitRename() {
    const trimmed = titleValue.trim() || 'Untitled Document'
    setTitleValue(trimmed)
    setRenaming(false)
    if (trimmed !== document.title) {
      try {
        await update(document._id, { title: trimmed })
      } catch {
        // Put the old title back, so what is shown is what is stored.
        setTitleValue(document.title || 'Untitled Document')
        toast.error('Could not rename this document.')
      }
    }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') {
      setTitleValue(document.title || 'Untitled Document')
      setRenaming(false)
    }
  }

  return (
    <Link href={`/doc/${document._id}`}>
      <div data-testid="document-card" className="relative bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group h-full flex flex-col">

        <div className="absolute top-2.5 right-2.5 flex items-center gap-1" onClick={e => e.preventDefault()}>
          {confirming ? (
            <>
              <button onClick={handleDelete} disabled={deleting} className="text-xs px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? 'Moving…' : 'Move to trash'}
              </button>
              <button onClick={handleCancelDelete} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors">Cancel</button>
            </>
          ) : (
            <>
              {!isOwner && (
                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium capitalize mr-0.5">{document.userRole}</span>
              )}
              <button
                onClick={handleToggleStar}
                data-testid="star-button"
                className={`p-1.5 rounded-md transition-all ${starred ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'}`}
                title={starred ? 'Unstar' : 'Star'}
              >
                <svg className="w-3.5 h-3.5" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              </button>
              <button onClick={handleDuplicate} className="p-1.5 rounded-md text-gray-300 hover:text-blue-500 hover:bg-blue-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-all" title="Duplicate document">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
              {isOwner && (
                <>
                  <button onClick={handleRenameClick} className="p-1.5 rounded-md text-gray-300 hover:text-blue-500 hover:bg-blue-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-all" title="Rename document">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={handleDelete} className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-all" title="Move to trash">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex-1 w-full h-28 bg-gray-50 rounded-lg mb-3 mt-6 p-3 overflow-hidden">
          {preview ? (
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-5">{preview}</p>
          ) : (
            <p className="text-xs text-gray-300 italic">Empty document</p>
          )}
        </div>
        <div>
          {renaming && isOwner ? (
            <input
              ref={inputRef}
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              onClick={e => e.preventDefault()}
              className="w-full text-sm font-medium text-gray-900 bg-white border border-blue-400 rounded px-1.5 py-0.5 outline-none"
            />
          ) : (
            <p className="font-medium text-gray-900 text-sm truncate group-hover:text-blue-600 transition-colors">{titleValue}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">Edited {formatRelativeDate(document.updatedAt)}</p>
        </div>
      </div>
    </Link>
  )
}
