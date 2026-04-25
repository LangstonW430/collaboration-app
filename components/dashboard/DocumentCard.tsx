'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { formatDate } from '@/lib/utils'

type UserRole = 'owner' | 'editor' | 'viewer'

interface DocumentCardProps {
  document: Doc<'documents'> & { userRole: UserRole }
}

export default function DocumentCard({ document }: DocumentCardProps) {
  const isOwner = document.userRole === 'owner'
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [titleValue, setTitleValue] = useState(document.title || 'Untitled Document')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync displayed title when Convex pushes a remote update (e.g. owner renames
  // from another session). Skip while the inline rename input is open.
  useEffect(() => {
    if (!renaming) setTitleValue(document.title || 'Untitled Document')
  }, [document.title, renaming])
  const removeDocument = useMutation(api.documents.remove)
  const updateDocument = useMutation(api.documents.update)

  const preview = document.content
    ? document.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
    : ''

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    await removeDocument({ id: document._id })
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirming(false)
  }

  function handleRenameClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setRenaming(true)
    setTimeout(() => {
      inputRef.current?.select()
    }, 0)
  }

  async function commitRename() {
    const trimmed = titleValue.trim() || 'Untitled Document'
    setTitleValue(trimmed)
    setRenaming(false)
    if (trimmed !== document.title) {
      await updateDocument({ id: document._id, title: trimmed })
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

        {/* Owner action buttons */}
        {isOwner && (
          <div
            className="absolute top-2.5 right-2.5 flex items-center gap-1"
            onClick={e => e.preventDefault()}
          >
            {confirming ? (
              <>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  onClick={handleCancelDelete}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleRenameClick}
                  className="p-1.5 rounded-md text-gray-300 hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
                  title="Rename document"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete document"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}

        {/* Shared badge for non-owner docs */}
        {!isOwner && (
          <div className="absolute top-2.5 right-2.5">
            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium capitalize">
              {document.userRole}
            </span>
          </div>
        )}

        <div className="flex-1 w-full h-28 bg-gray-50 rounded-lg mb-3 p-3 overflow-hidden">
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
            <p className="font-medium text-gray-900 text-sm truncate group-hover:text-blue-600 transition-colors">
              {titleValue}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(document.updatedAt)}
          </p>
        </div>
      </div>
    </Link>
  )
}
