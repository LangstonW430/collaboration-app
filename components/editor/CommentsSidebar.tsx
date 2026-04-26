'use client'

import { useQuery } from 'convex/react'
import type { Id } from '@/convex/_generated/dataModel'
import type { Editor } from '@tiptap/react'
import { commentQueries } from '@/lib/services'
import { useDocumentService } from '@/lib/hooks/useDocumentService'

interface Props {
  editor: Editor | null
  docId: Id<'documents'>
  canEdit: boolean
  onClose: () => void
}

export default function CommentsSidebar({ editor, docId, canEdit, onClose }: Props) {
  const comments = useQuery(commentQueries.list, { docId }) ?? []
  const { resolveComment, deleteComment } = useDocumentService()

  function removeMarkFromEditor(markId: string) {
    if (!editor) return
    const { doc, schema } = editor.state
    const commentMarkType = schema.marks['comment']
    if (!commentMarkType) return
    const transaction = editor.state.tr
    doc.descendants((node, pos) => {
      if (node.isText) {
        const m = node.marks.find(
          (mk) => mk.type === commentMarkType && mk.attrs.commentId === markId
        )
        if (m) transaction.removeMark(pos, pos + node.nodeSize, m)
      }
    })
    if (transaction.docChanged) editor.view.dispatch(transaction)
  }

  function scrollToMark(markId: string) {
    if (!editor) return
    const { doc, schema } = editor.state
    const commentMarkType = schema.marks['comment']
    if (!commentMarkType) return
    let targetPos: number | null = null
    doc.descendants((node, pos) => {
      if (targetPos !== null) return false
      if (node.isText && node.marks.some((m) => m.type === commentMarkType && m.attrs.commentId === markId)) {
        targetPos = pos
      }
    })
    if (targetPos !== null) {
      editor.chain().setTextSelection(targetPos).scrollIntoView().run()
    }
  }

  async function handleResolve(commentId: Id<'comments'>, markId: string) {
    await resolveComment(commentId)
    removeMarkFromEditor(markId)
  }

  async function handleDelete(commentId: Id<'comments'>, markId: string) {
    await deleteComment(commentId)
    removeMarkFromEditor(markId)
  }

  return (
    <div className="w-72 shrink-0 border-l border-gray-100 bg-gray-50 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">
          Comments {comments.length > 0 && <span className="text-gray-400 font-normal">({comments.length})</span>}
        </h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" title="Close">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {comments.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-10">No open comments</p>
        )}

        {comments.map((c) => (
          <div
            key={c._id}
            className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm cursor-pointer hover:border-blue-200 transition-colors"
            onClick={() => scrollToMark(c.markId)}
          >
            <p className="text-xs text-gray-400 mb-1.5 font-medium">{c.authorEmail}</p>

            {c.quotedText && (
              <blockquote className="text-xs text-gray-500 border-l-2 border-amber-300 pl-2 mb-2 italic line-clamp-2">
                {c.quotedText}
              </blockquote>
            )}

            <p className="text-sm text-gray-700 mb-3 leading-snug">{c.text}</p>

            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              {canEdit && (
                <button
                  onClick={() => handleResolve(c._id as Id<'comments'>, c.markId)}
                  className="flex-1 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  Resolve
                </button>
              )}
              <button
                onClick={() => handleDelete(c._id as Id<'comments'>, c.markId)}
                className="flex-1 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
