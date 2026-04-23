'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Youtube from '@tiptap/extension-youtube'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import { common, createLowlight } from 'lowlight'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import type { SaveStatus } from '@/types'
import { ConvexImageExtension } from './extensions/ConvexImageExtension'
import { ChartExtension } from './extensions/ChartExtension'
import { CommentMark } from './extensions/CommentMark'
import CommentsSidebar from './CommentsSidebar'

const lowlight = createLowlight(common)

const AUTOSAVE_DELAY_MS = 1000

const TEXT_COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af',
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
]
const HIGHLIGHT_COLORS = [
  '#fef9c3', '#dcfce7', '#dbeafe', '#fce7f3',
  '#ede9fe', '#fee2e2', '#ffedd5', '#cffafe',
]

export type UserRole = 'owner' | 'editor' | 'viewer'
export type DocumentWithRole = Doc<'documents'> & { userRole: UserRole }

interface DocumentEditorProps {
  document: DocumentWithRole
}

type DropdownName = 'color' | 'highlight' | 'heading' | 'insert' | 'align' | 'comment'
interface DropdownState {
  name: DropdownName
  top: number
  left: number
}

export default function DocumentEditor({ document: doc }: DocumentEditorProps) {
  const { userRole } = doc
  const canEdit = userRole === 'owner' || userRole === 'editor'

  const [title, setTitle] = useState(doc.title)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [showInvite, setShowInvite] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [dropdown, setDropdown] = useState<DropdownState | null>(null)
  const [commentText, setCommentText] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownPanelRef = useRef<HTMLDivElement>(null)
  const pendingCommentRef = useRef<{ from: number; to: number; quoted: string } | null>(null)

  const updateDocument = useMutation(api.documents.update)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const createComment = useMutation(api.comments.create)

  // Close dropdown on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownPanelRef.current &&
        !dropdownPanelRef.current.contains(e.target as Node)
      ) {
        setDropdown(null)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdown(null)
    }
    window.document.addEventListener('mousedown', handleClick)
    window.document.addEventListener('keydown', handleKey)
    return () => {
      window.document.removeEventListener('mousedown', handleClick)
      window.document.removeEventListener('keydown', handleKey)
    }
  }, [])

  function toggleDropdown(name: DropdownName, e: React.MouseEvent<HTMLElement>) {
    if (dropdown?.name === name) {
      setDropdown(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setDropdown({ name, top: rect.bottom + 4, left: rect.left })
  }

  function closeDropdown() {
    setDropdown(null)
  }

  function scheduleSave(updates: { title?: string; content?: string }) {
    if (!canEdit) return
    setSaveStatus('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await updateDocument({ id: doc._id, ...updates })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, AUTOSAVE_DELAY_MS)
  }

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    try {
      const uploadUrl = await generateUploadUrl()
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      const { storageId } = await res.json()
      editor?.chain().focus().insertContent({
        type: 'convexImage',
        attrs: { storageId, src: null, alt: file.name },
      }).run()
    } catch (err) {
      console.error('Image upload failed', err)
    }
  }, [generateUploadUrl])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: canEdit ? 'Start writing… (type / for commands)' : '' }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      Youtube.configure({ controls: true, nocookie: true }),
      CharacterCount,
      Typography,
      ConvexImageExtension,
      ChartExtension,
      CommentMark,
    ],
    content: doc.content || '',
    editable: canEdit,
    onUpdate: ({ editor }) => {
      scheduleSave({ content: editor.getHTML() })
    },
    editorProps: {
      attributes: { class: 'focus:outline-none min-h-[500px]' },
      handlePaste(view, event) {
        if (!canEdit) return false
        const items = Array.from(event.clipboardData?.items ?? [])
        const imgItem = items.find((i) => i.type.startsWith('image/'))
        if (imgItem) {
          const file = imgItem.getAsFile()
          if (file) { uploadImage(file); return true }
        }
        return false
      },
      handleDrop(view, event) {
        if (!canEdit) return false
        const files = Array.from(event.dataTransfer?.files ?? [])
        const imgFile = files.find((f) => f.type.startsWith('image/'))
        if (imgFile) { uploadImage(imgFile); return true }
        return false
      },
    },
  })

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canEdit) return
    setTitle(e.target.value)
    scheduleSave({ title: e.target.value })
  }

  function insertYoutube() {
    closeDropdown()
    const url = window.prompt('YouTube URL:')
    if (url) editor?.chain().focus().setYoutubeVideo({ src: url }).run()
  }

  function insertTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    closeDropdown()
  }

  function insertChart() {
    editor?.chain().focus().insertContent({ type: 'chart', attrs: {} }).run()
    closeDropdown()
  }

  function insertHr() {
    editor?.chain().focus().setHorizontalRule().run()
    closeDropdown()
  }

  function openCommentPanel(e: React.MouseEvent<HTMLButtonElement>) {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) return
    const quoted = editor.state.doc.textBetween(from, to, ' ')
    pendingCommentRef.current = { from, to, quoted }
    setCommentText('')
    if (dropdown?.name === 'comment') {
      setDropdown(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      setDropdown({ name: 'comment', top: rect.bottom + 4, left: rect.left })
    }
  }

  async function submitComment() {
    if (!editor || !pendingCommentRef.current || !commentText.trim()) return
    const { from, to, quoted } = pendingCommentRef.current
    const markId = crypto.randomUUID()
    editor.chain().setTextSelection({ from, to }).setMark('comment', { commentId: markId }).run()
    try {
      await createComment({
        docId: doc._id,
        markId,
        text: commentText.trim(),
        quotedText: quoted,
      })
      setShowSidebar(true)
    } catch (err) {
      console.error('Failed to save comment', err)
    }
    pendingCommentRef.current = null
    setCommentText('')
    closeDropdown()
  }

  const statusConfig = {
    saved:  { label: 'Saved',       cls: 'text-green-500' },
    saving: { label: 'Saving…',     cls: 'text-gray-400'  },
    error:  { label: 'Save failed', cls: 'text-red-500'   },
    idle:   { label: '',            cls: ''                },
  }[saveStatus]

  const charCount = editor?.storage.characterCount?.characters?.() ?? 0
  const wordCount = editor?.storage.characterCount?.words?.() ?? 0

  const headingLevel = [1, 2, 3].find((l) => editor?.isActive('heading', { level: l }))
  const headingLabel = headingLevel ? `H${headingLevel}` : 'Normal'

  const currentAlign = (['left', 'center', 'right', 'justify'] as const).find((a) =>
    editor?.isActive({ textAlign: a })
  ) ?? 'left'

  const isOpen = (name: DropdownName) => dropdown?.name === name

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 h-11 flex items-center gap-1 overflow-x-auto">
          {/* Back */}
          <Link
            href="/dashboard"
            className="shrink-0 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to dashboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>

          <Sep />

          {/* Undo / Redo */}
          <Btn onClick={() => editor?.chain().focus().undo().run()} title="Undo" disabled={!editor?.can().undo()}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14L4 9m0 0l5-5M4 9h10a5 5 0 010 10h-1" /></svg>
          </Btn>
          <Btn onClick={() => editor?.chain().focus().redo().run()} title="Redo" disabled={!editor?.can().redo()}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 14l5-5m0 0l-5-5m5 5H9a5 5 0 000 10h1" /></svg>
          </Btn>

          <Sep />

          {/* Text formatting */}
          <Btn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold"><strong className="text-sm leading-none">B</strong></Btn>
          <Btn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic"><em className="text-sm leading-none not-italic font-serif">I</em></Btn>
          <Btn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline"><span className="text-sm leading-none underline">U</span></Btn>
          <Btn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough"><span className="text-sm leading-none line-through">S</span></Btn>
          <Btn onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')} title="Inline code">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </Btn>
          <Btn onClick={() => editor?.chain().focus().toggleSubscript().run()} active={editor?.isActive('subscript')} title="Subscript"><span className="text-xs leading-none">X₂</span></Btn>
          <Btn onClick={() => editor?.chain().focus().toggleSuperscript().run()} active={editor?.isActive('superscript')} title="Superscript"><span className="text-xs leading-none">X²</span></Btn>

          <Sep />

          {/* Text color trigger */}
          <Btn onClick={(e) => toggleDropdown('color', e)} title="Text color" active={isOpen('color')}>
            <span className="text-sm font-bold leading-none" style={{ color: editor?.getAttributes('textStyle')?.color ?? '#000' }}>A</span>
          </Btn>

          {/* Highlight trigger */}
          <Btn onClick={(e) => toggleDropdown('highlight', e)} title="Highlight" active={isOpen('highlight')}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </Btn>

          <Sep />

          {/* Alignment trigger */}
          <Btn onClick={(e) => toggleDropdown('align', e)} title="Alignment" active={isOpen('align')}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {currentAlign === 'center' && <><line x1="3" y1="6" x2="21" y2="6" strokeWidth={2} strokeLinecap="round"/><line x1="6" y1="12" x2="18" y2="12" strokeWidth={2} strokeLinecap="round"/><line x1="4" y1="18" x2="20" y2="18" strokeWidth={2} strokeLinecap="round"/></>}
              {currentAlign === 'right' && <><line x1="3" y1="6" x2="21" y2="6" strokeWidth={2} strokeLinecap="round"/><line x1="9" y1="12" x2="21" y2="12" strokeWidth={2} strokeLinecap="round"/><line x1="6" y1="18" x2="21" y2="18" strokeWidth={2} strokeLinecap="round"/></>}
              {(currentAlign === 'left' || currentAlign === 'justify') && <><line x1="3" y1="6" x2="21" y2="6" strokeWidth={2} strokeLinecap="round"/><line x1="3" y1="12" x2="15" y2="12" strokeWidth={2} strokeLinecap="round"/><line x1="3" y1="18" x2="18" y2="18" strokeWidth={2} strokeLinecap="round"/></>}
            </svg>
          </Btn>

          <Sep />

          {/* Heading dropdown trigger */}
          <button
            onClick={(e) => toggleDropdown('heading', e)}
            className={`flex items-center gap-1 px-2 h-7 text-xs font-medium rounded-md transition-colors shrink-0 ${isOpen('heading') ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {headingLabel}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>

          <Sep />

          {/* Lists */}
          <Btn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
          </Btn>
          <Btn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered list">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20h14M7 12h14M7 4h14M3 20v-2M3 12v-2M3 4V2" /></svg>
          </Btn>
          <Btn onClick={() => editor?.chain().focus().toggleTaskList().run()} active={editor?.isActive('taskList')} title="Task list">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </Btn>

          <Sep />

          {/* Block */}
          <Btn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" /></svg>
          </Btn>
          <Btn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} title="Code block">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </Btn>

          <Sep />

          {/* Insert dropdown trigger */}
          <button
            onClick={(e) => toggleDropdown('insert', e)}
            className={`flex items-center gap-1 px-2 h-7 text-xs font-medium rounded-md transition-colors shrink-0 ${isOpen('insert') ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Insert
          </button>

          <Sep />

          {/* Add comment (owners + editors) */}
          {canEdit && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={openCommentPanel}
              title="Add comment (select text first)"
              className={`shrink-0 p-1.5 rounded-md transition-colors ${isOpen('comment') ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </button>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadImage(file)
              e.target.value = ''
            }}
          />

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {canEdit && (
              <span className={`text-xs transition-colors ${statusConfig.cls}`}>
                {statusConfig.label}
              </span>
            )}
            {!canEdit && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md">View only</span>
            )}

            {/* Comments sidebar toggle */}
            <button
              onClick={() => setShowSidebar((s) => !s)}
              title="Toggle comments"
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${showSidebar ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Comments
            </button>

            {userRole === 'owner' && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                Share
              </button>
            )}
          </div>
        </div>

        {/* Table controls — shown when cursor is inside a table */}
        {editor?.isActive('table') && canEdit && (
          <div className="px-4 h-8 flex items-center gap-1 border-t border-gray-100 bg-gray-50 overflow-x-auto">
            <span className="text-xs text-gray-400 mr-2">Table:</span>
            <TblBtn onClick={() => editor.chain().focus().addColumnBefore().run()}>+ Col before</TblBtn>
            <TblBtn onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Col after</TblBtn>
            <TblBtn onClick={() => editor.chain().focus().deleteColumn().run()}>Del col</TblBtn>
            <TblBtn onClick={() => editor.chain().focus().addRowBefore().run()}>+ Row before</TblBtn>
            <TblBtn onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row after</TblBtn>
            <TblBtn onClick={() => editor.chain().focus().deleteRow().run()}>Del row</TblBtn>
            <TblBtn onClick={() => editor.chain().focus().mergeCells().run()}>Merge</TblBtn>
            <TblBtn onClick={() => editor.chain().focus().splitCell().run()}>Split</TblBtn>
            <TblBtn onClick={() => editor.chain().focus().deleteTable().run()} danger>Delete table</TblBtn>
          </div>
        )}
      </div>

      {/* ── Fixed dropdown panels ─────────────────────────────────────────────── */}
      {dropdown && (
        <div
          ref={dropdownPanelRef}
          style={{ position: 'fixed', top: dropdown.top, left: dropdown.left, zIndex: 50 }}
        >
          {dropdown.name === 'color' && (
            <div className="p-2 bg-white border border-gray-200 rounded-xl shadow-xl grid grid-cols-4 gap-1">
              {TEXT_COLORS.map((c) => (
                <button key={c} style={{ background: c }} className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform" onClick={() => { editor?.chain().focus().setColor(c).run(); closeDropdown() }} title={c} />
              ))}
              <button className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 text-xs hover:bg-gray-50" onClick={() => { editor?.chain().focus().unsetColor().run(); closeDropdown() }} title="Remove color">✕</button>
            </div>
          )}

          {dropdown.name === 'highlight' && (
            <div className="p-2 bg-white border border-gray-200 rounded-xl shadow-xl grid grid-cols-4 gap-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button key={c} style={{ background: c }} className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform" onClick={() => { editor?.chain().focus().setHighlight({ color: c }).run(); closeDropdown() }} title={c} />
              ))}
              <button className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 text-xs hover:bg-gray-50" onClick={() => { editor?.chain().focus().unsetHighlight().run(); closeDropdown() }} title="Remove highlight">✕</button>
            </div>
          )}

          {dropdown.name === 'align' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-1 flex gap-1">
              {(['left', 'center', 'right', 'justify'] as const).map((a) => (
                <Btn key={a} onClick={() => { editor?.chain().focus().setTextAlign(a).run(); closeDropdown() }} active={currentAlign === a} title={`Align ${a}`}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    {a === 'left' && <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></>}
                    {a === 'center' && <><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></>}
                    {a === 'right' && <><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></>}
                    {a === 'justify' && <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
                  </svg>
                </Btn>
              ))}
            </div>
          )}

          {dropdown.name === 'heading' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-36">
              <HeadingItem label="Normal" onClick={() => { editor?.chain().focus().setParagraph().run(); closeDropdown() }} active={!headingLevel} />
              {([1, 2, 3] as const).map((l) => (
                <HeadingItem key={l} label={`Heading ${l}`} size={l} onClick={() => { editor?.chain().focus().toggleHeading({ level: l }).run(); closeDropdown() }} active={editor?.isActive('heading', { level: l })} />
              ))}
            </div>
          )}

          {dropdown.name === 'insert' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-44">
              <InsertItem label="Image" icon="🖼️" onClick={() => { closeDropdown(); fileInputRef.current?.click() }} />
              <InsertItem label="Table" icon="⊞" onClick={insertTable} />
              <InsertItem label="Chart" icon="📊" onClick={insertChart} />
              <InsertItem label="YouTube video" icon="▶️" onClick={insertYoutube} />
              <InsertItem label="Divider" icon="—" onClick={insertHr} />
            </div>
          )}

          {dropdown.name === 'comment' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-64">
              {pendingCommentRef.current?.quoted && (
                <p className="text-xs text-gray-500 border-l-2 border-amber-300 pl-2 mb-2.5 italic line-clamp-2">
                  {pendingCommentRef.current.quoted}
                </p>
              )}
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 mb-2 outline-none focus:border-blue-400 resize-none"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment()
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim()}
                  className="flex-1 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  Comment
                </button>
                <button
                  onClick={() => { closeDropdown(); pendingCommentRef.current = null }}
                  className="flex-1 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5 text-center">⌘+Enter to submit</p>
            </div>
          )}
        </div>
      )}

      {/* Content row */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document body */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl w-full mx-auto px-8 py-12">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              readOnly={!canEdit}
              placeholder="Untitled Document"
              className={`w-full text-4xl font-bold text-gray-900 bg-transparent border-none outline-none mb-8 placeholder:text-gray-200 ${!canEdit ? 'cursor-default' : ''}`}
            />
            <div className="tiptap-editor">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Comments sidebar */}
        {showSidebar && (
          <CommentsSidebar
            editor={editor}
            docId={doc._id}
            canEdit={canEdit}
            onClose={() => setShowSidebar(false)}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="border-t border-gray-100 px-8 py-2 flex items-center gap-4 text-xs text-gray-400 shrink-0">
        <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
        <span>{charCount} character{charCount !== 1 ? 's' : ''}</span>
      </div>

      {showInvite && (
        <InviteModalDynamic docId={doc._id} onClose={() => setShowInvite(false)} />
      )}
    </div>
  )
}

// ── Small UI primitives ──────────────────────────────────────────────────────

function Sep() {
  return <div className="w-px h-5 bg-gray-200 shrink-0 mx-0.5" />
}

interface BtnProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  active?: boolean
  title?: string
  disabled?: boolean
  children: React.ReactNode
}

function Btn({ onClick, active, title, disabled, children }: BtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`shrink-0 p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )
}

function TblBtn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-0.5 rounded-md transition-colors ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-200'}`}
    >
      {children}
    </button>
  )
}

function HeadingItem({ label, size, onClick, active }: { label: string; size?: 1 | 2 | 3; onClick: () => void; active?: boolean }) {
  const sizeClass = size ? ['text-lg font-bold', 'text-base font-semibold', 'text-sm font-semibold'][size - 1] : 'text-sm'
  return (
    <button onClick={onClick} className={`w-full text-left px-3 py-1.5 ${sizeClass} transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
      {label}
    </button>
  )
}

function InsertItem({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
      <span className="text-base">{icon}</span>
      {label}
    </button>
  )
}

const InviteModalDynamic = dynamic(() => import('./InviteModal'), { ssr: false })
