// The two React node views (image, chart) hold their state entirely in HTML
// attributes, so they are the content most easily lost between saves. These
// tests drive the full cycle a real edit goes through:
//
//   edit -> getHTML() -> sanitizeHtml() -> persisted -> re-parsed on reload
//
// and assert the node's attributes come back identical.

import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import type { Extensions, JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { ChartExtension } from '@/components/editor/extensions/ChartExtension'
import { ConvexImageExtension } from '@/components/editor/extensions/ConvexImageExtension'
import { sanitizeHtml } from '@/lib/sanitization/sanitizeContent'

const extensions: Extensions = [StarterKit, ChartExtension, ConvexImageExtension]

function withEditor<T>(content: string | JSONContent, fn: (editor: Editor) => T): T {
  const editor = new Editor({ extensions, content })
  try {
    return fn(editor)
  } finally {
    editor.destroy()
  }
}

/** Runs content through save + sanitize + reload, returning the reloaded doc. */
function reload(build: (editor: Editor) => void) {
  const html = withEditor('<p></p>', (editor) => {
    build(editor)
    return editor.getHTML()
  })
  const persisted = sanitizeHtml(html)
  const json = withEditor(persisted, (editor) => editor.getJSON())
  return { html, persisted, json }
}

function nodesOfType(json: JSONContent, type: string): JSONContent[] {
  return (json.content ?? []).filter((node) => node.type === type)
}

describe('uploaded images survive a save and reload', () => {
  it('keeps the storage ID that resolves the image URL', () => {
    const { persisted, json } = reload((editor) => {
      editor.commands.insertContent({
        type: 'convexImage',
        attrs: { storageId: 'kg2abc123', src: null, alt: 'diagram.png' },
      })
    })

    expect(persisted).toContain('data-storage-id="kg2abc123"')

    const [image] = nodesOfType(json, 'convexImage')
    expect(image).toBeDefined()
    expect(image.attrs?.storageId).toBe('kg2abc123')
    expect(image.attrs?.alt).toBe('diagram.png')
  })

  it('keeps alignment chosen from the image controls', () => {
    const { json } = reload((editor) => {
      editor.commands.insertContent({
        type: 'convexImage',
        attrs: { storageId: 'kg2xyz', src: null, align: 'center' },
      })
    })

    const [image] = nodesOfType(json, 'convexImage')
    expect(image?.attrs?.align).toBe('center')
  })

  it('still parses plain images that have a src and no storage ID', () => {
    const json = withEditor('<img src="https://example.com/a.png" alt="a">', (editor) =>
      editor.getJSON()
    )
    const [image] = nodesOfType(json, 'convexImage')
    expect(image?.attrs?.src).toBe('https://example.com/a.png')
  })
})

describe('charts survive a save and reload', () => {
  const attrs = {
    chartType: 'line',
    chartTitle: 'Quarterly revenue',
    labels: 'Q1, Q2, Q3, Q4',
    data: '12, 40, 31, 55',
    colors: '#3b82f6, #ef4444',
  }

  it('keeps every configured attribute', () => {
    const { persisted, json } = reload((editor) => {
      editor.commands.insertContent({ type: 'chart', attrs })
    })

    expect(persisted).toContain('data-chart-type="line"')
    expect(persisted).toContain('data-chart-values="12, 40, 31, 55"')

    const [chart] = nodesOfType(json, 'chart')
    expect(chart).toBeDefined()
    expect(chart.attrs).toMatchObject(attrs)
  })

  it('does not emit bare non-standard HTML attributes', () => {
    const { html } = reload((editor) => {
      editor.commands.insertContent({ type: 'chart', attrs })
    })
    expect(html).not.toContain(' labels=')
    expect(html).not.toContain(' data=')
    expect(html).not.toContain(' colors=')
  })

  it('reads charts written in the previous bare-attribute format', () => {
    const legacy =
      '<div charttype="pie" charttitle="Old chart" labels="A, B" data="1, 2" colors="#000"></div>'
    const json = withEditor(legacy, (editor) => editor.getJSON())

    const [chart] = nodesOfType(json, 'chart')
    expect(chart?.attrs).toMatchObject({
      chartType: 'pie',
      chartTitle: 'Old chart',
      labels: 'A, B',
      data: '1, 2',
      colors: '#000',
    })
  })
})
