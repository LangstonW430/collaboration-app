import { describe, expect, it } from 'vitest'
import { buildHtmlExport, toFilename } from '@/lib/export/exportDocument'

describe('buildHtmlExport', () => {
  it('produces a standalone page carrying the document body', () => {
    const html = buildHtmlExport('My Doc', '<p>Hello <strong>world</strong></p>')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<title>My Doc</title>')
    expect(html).toContain('<p>Hello <strong>world</strong></p>')
  })

  it('escapes the title so it cannot break out of its markup', () => {
    const html = buildHtmlExport('<script>alert(1)</script>', '<p>x</p>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('falls back to a default title when the document has none', () => {
    expect(buildHtmlExport('', '<p>x</p>')).toContain('<title>Untitled Document</title>')
  })
})

describe('toFilename', () => {
  it('turns a title into a safe filename with the right extension', () => {
    expect(toFilename('Q3 plan: final?', 'html')).toBe('Q3-plan-final.html')
  })

  it('handles an empty title', () => {
    expect(toFilename('', 'txt')).toBe('Untitled-Document.txt')
  })

  it('handles a title with no filename-safe characters at all', () => {
    expect(toFilename('???', 'txt')).toBe('document.txt')
  })

  it('caps very long titles', () => {
    const name = toFilename('x'.repeat(300), 'txt')
    expect(name.length).toBeLessThanOrEqual(84)
  })
})
