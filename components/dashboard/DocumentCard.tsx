'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { formatDate } from '@/lib/utils'

interface DocumentCardProps {
  document: Doc<'documents'>
}

export default function DocumentCard({ document }: DocumentCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const removeDocument = useMutation(api.documents.remove)

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

  return (
    <Link href={`/doc/${document._id}`}>
      <div className="relative bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group h-full flex flex-col">

        {/* Delete button — shown on hover */}
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
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
              title="Delete document"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex-1 w-full h-28 bg-gray-50 rounded-lg mb-3 p-3 overflow-hidden">
          {preview ? (
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-5">{preview}</p>
          ) : (
            <p className="text-xs text-gray-300 italic">Empty document</p>
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm truncate group-hover:text-blue-600 transition-colors">
            {document.title || 'Untitled Document'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(document.updatedAt)}
          </p>
        </div>
      </div>
    </Link>
  )
}
