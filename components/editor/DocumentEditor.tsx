'use client'

import { useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import type { SaveStatus } from '@/types'

const InviteModal = dynamic(() => import('./InviteModal'), { ssr: false })

const AUTOSAVE_DELAY_MS = 1000

export type UserRole = 'owner' | 'editor' | 'viewer'

export type DocumentWithRole = Doc<'documents'> & { userRole: UserRole }

interface DocumentEditorProps {
  document: DocumentWithRole
}

export default function DocumentEditor({ document }: DocumentEditorProps) {
  const { userRole } = document
  const canEdit = userRole === 'owner' || userRole === 'editor'

  const [title, setTitle] = useState(document.title)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [showInvite, setShowInvite] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateDocument = useMutation(api.documents.update)

  function scheduleSave(updates: { title?: string; content?: string }) {
    if (!canEdit) return
    setSaveStatus('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(async () => {
      try {
        await updateDocument({ id: document._id, ...updates })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, AUTOSAVE_DELAY_MS)
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: canEdit ? 'Start writing…' : '' }),
    ],
    content: document.content || '',
    editable: canEdit,
    onUpdate: ({ editor }) => {
      scheduleSave({ content: editor.getHTML() })
    },
    editorProps: {
      attributes: { class: 'focus:outline-none min-h-[500px]' },
    },
  })

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canEdit) return
    setTitle(e.target.value)
    scheduleSave({ title: e.target.value })
  }

  const statusConfig = {
    saved:  { label: 'Saved',       className: 'text-green-500' },
    saving: { label: 'Saving…',     className: 'text-gray-400'  },
    error:  { label: 'Save failed', className: 'text-red-500'   },
    idle:   { label: '',            className: ''                },
  }[saveStatus]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="shrink-0 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to dashboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>

            <div className="w-px h-5 bg-gray-200" />

            {canEdit && (
              <div className="flex items-center gap-0.5">
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold">
                  <strong className="text-sm leading-none">B</strong>
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic">
                  <em className="text-sm leading-none">I</em>
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough">
                  <span className="text-sm leading-none line-through">S</span>
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')} title="Inline code">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </ToolbarBtn>

                <div className="w-px h-4 bg-gray-200 mx-1" />

                <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="Heading 1">
                  <span className="text-xs font-bold leading-none">H1</span>
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2">
                  <span className="text-xs font-bold leading-none">H2</span>
                </ToolbarBtn>

                <div className="w-px h-4 bg-gray-200 mx-1" />

                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                  </svg>
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered list">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
                  </svg>
                </ToolbarBtn>
              </div>
            )}

            {!canEdit && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md">View only</span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs transition-colors ${statusConfig.className}`}>
              {statusConfig.label}
            </span>

            {userRole === 'owner' && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Share
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document body */}
      <div className="flex-1 max-w-3xl w-full mx-auto px-8 py-12">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          readOnly={!canEdit}
          placeholder="Untitled Document"
          className={`w-full text-4xl font-bold text-gray-900 bg-transparent border-none outline-none mb-8 placeholder:text-gray-200 ${!canEdit ? 'cursor-default select-none' : ''}`}
        />
        <div className="tiptap-editor">
          <EditorContent editor={editor} />
        </div>
      </div>

      {showInvite && (
        <InviteModal docId={document._id} onClose={() => setShowInvite(false)} />
      )}
    </div>
  )
}

interface ToolbarBtnProps {
  onClick: () => void
  active?: boolean
  title?: string
  children: React.ReactNode
}

function ToolbarBtn({ onClick, active, title, children }: ToolbarBtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'bg-gray-900 text-white'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )
}
