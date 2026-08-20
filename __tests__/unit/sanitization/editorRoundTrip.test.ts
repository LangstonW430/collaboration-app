// Guards the contract between the editor and the sanitizer: every piece of HTML
// TipTap can produce must survive sanitizeHtml() byte-for-byte. When it does
// not, the attribute it dropped is silently deleted from the user's document on
// the next autosave.
//
// If a new extension or attribute is added to DocumentEditor, add a case here.
// A failure means lib/sanitization/sanitizeContent.ts needs the new attribute.

import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import type { Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Youtube from '@tiptap/extension-youtube'
import { CommentMark } from '@/components/editor/extensions/CommentMark'
import { sanitizeHtml } from '@/lib/sanitization/sanitizeContent'

// Mirrors the extension list in components/editor/DocumentEditor.tsx, minus the
// two React node views (chart, image), which are covered in their own suite.
// (StarterKit v3 already provides Underline, so it is not listed separately.)
const extensions: Extensions = [
  StarterKit,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Highlight.configure({ multicolor: true }),
  Color,
  TextStyle,
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
  Subscript,
  Superscript,
  Youtube.configure({ controls: true, nocookie: true }),
  CommentMark,
]

/** Builds a document with `build`, returns the HTML TipTap would autosave. */
function editorHtml(build: (editor: Editor) => void): string {
  const editor = new Editor({ extensions, content: '<p></p>' })
  try {
    build(editor)
    return editor.getHTML()
  } finally {
    editor.destroy()
  }
}

function expectSurvives(build: (editor: Editor) => void): string {
  const html = editorHtml(build)
  expect(sanitizeHtml(html)).toBe(html)
  return html
}

describe('sanitizeHtml preserves TipTap editor output', () => {
  it('keeps multicolour highlight attributes', () => {
    const html = expectSurvives((e) => {
      e.commands.insertContent('<p>highlighted</p>')
      e.commands.selectAll()
      e.commands.setHighlight({ color: '#fef9c3' })
    })
    expect(html).toContain('data-color="#fef9c3"')
  })

  it('keeps comment mark anchors', () => {
    const html = expectSurvives((e) => {
      e.commands.insertContent('<p>quoted text</p>')
      e.commands.selectAll()
      e.commands.setMark('comment', { commentId: 'comment-1' })
    })
    expect(html).toContain('data-comment-id="comment-1"')
  })

  it('keeps resizable table column widths', () => {
    const html = expectSurvives((e) => {
      e.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    })
    expect(html).toContain('<colgroup>')
  })

  it('keeps YouTube embed settings', () => {
    const html = expectSurvives((e) => {
      e.commands.setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    })
    expect(html).toContain('data-youtube-video')
    expect(html).toContain('start="0"')
  })

  it('keeps task list state', () => {
    const html = expectSurvives((e) => {
      e.commands.toggleTaskList()
    })
    expect(html).toContain('data-checked="false"')
  })

  it('keeps text colour and alignment', () => {
    expectSurvives((e) => {
      e.commands.insertContent('<p>coloured</p>')
      e.commands.selectAll()
      e.commands.setColor('#ef4444')
      e.commands.setTextAlign('center')
    })
  })

  it('keeps basic marks and block types', () => {
    expectSurvives((e) => {
      e.commands.setContent(
        '<h1>Title</h1>' +
          '<p><strong>bold</strong> <em>italic</em> <u>under</u> <s>strike</s> <code>code</code></p>' +
          '<p><sub>sub</sub> <sup>sup</sup></p>' +
          '<blockquote><p>quote</p></blockquote>' +
          '<ul><li><p>item</p></li></ul>' +
          '<ol><li><p>item</p></li></ol>' +
          '<hr>'
      )
    })
  })
})

describe('sanitizeHtml still blocks injection', () => {
  it('strips script tags', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>')
  })

  it('strips event handlers on allowed tags', () => {
    expect(sanitizeHtml('<img data-storage-id="x" onerror="alert(1)">')).not.toContain('onerror')
  })

  it('strips javascript: URLs', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:')
  })

  it('blanks non-YouTube iframe sources', () => {
    const result = sanitizeHtml('<iframe src="https://evil.example.com/frame"></iframe>')
    expect(result).not.toContain('evil.example.com')
  })

  it('allows YouTube iframe sources through', () => {
    const result = sanitizeHtml('<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>')
    expect(result).toContain('youtube-nocookie.com/embed/abc')
  })

  it('does not allow arbitrary data attributes', () => {
    expect(sanitizeHtml('<p data-evil="1">x</p>')).toBe('<p>x</p>')
  })
})
