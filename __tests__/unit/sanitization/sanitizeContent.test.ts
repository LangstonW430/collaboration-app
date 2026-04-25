import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sanitizeHtml, isSanitized } from '../../../lib/sanitization/sanitizeContent'

// ── Client-side path (jsdom has window defined) ───────────────────────────────

describe('sanitizeHtml — client-side (DOMPurify)', () => {
  it('passes through clean paragraph HTML unchanged', () => {
    const html = '<p>Hello, <strong>world</strong>!</p>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('strips <script> tags entirely', () => {
    const result = sanitizeHtml('<p>Safe</p><script>alert("xss")</script>')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert')
    expect(result).toContain('<p>Safe</p>')
  })

  it('strips inline event handlers', () => {
    const result = sanitizeHtml('<p onclick="evil()">Text</p>')
    expect(result).not.toContain('onclick')
    expect(result).toContain('Text')
  })

  it('strips onerror on img tags', () => {
    const result = sanitizeHtml('<img src="x" onerror="evil()">')
    expect(result).not.toContain('onerror')
  })

  it('strips javascript: href', () => {
    const result = sanitizeHtml('<a href="javascript:void(0)">Click</a>')
    expect(result).not.toContain('javascript:')
  })

  it('preserves allowed heading tags', () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2>'
    const result = sanitizeHtml(html)
    expect(result).toContain('<h1>')
    expect(result).toContain('<h2>')
  })

  it('preserves allowed list tags', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    expect(sanitizeHtml(html)).toContain('<ul>')
    expect(sanitizeHtml(html)).toContain('<li>')
  })

  it('preserves blockquote', () => {
    const html = '<blockquote><p>A quote</p></blockquote>'
    expect(sanitizeHtml(html)).toContain('<blockquote>')
  })

  it('preserves table structure', () => {
    const html = '<table><tr><td>Cell</td></tr></table>'
    const result = sanitizeHtml(html)
    expect(result).toContain('<table>')
    expect(result).toContain('<td>')
  })

  it('strips disallowed tags but keeps their text content (KEEP_CONTENT)', () => {
    // <marquee> is not in the allowlist, its text should survive
    const result = sanitizeHtml('<marquee>Keep this text</marquee>')
    expect(result).toContain('Keep this text')
    expect(result).not.toContain('<marquee')
  })

  it('allows YouTube iframe src', () => {
    const html = '<div data-youtube-video><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>'
    const result = sanitizeHtml(html)
    expect(result).toContain('youtube.com')
  })

  it('allows youtube-nocookie iframe src', () => {
    const html = '<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>'
    const result = sanitizeHtml(html)
    // src must still be present (not cleared)
    expect(result).toContain('youtube-nocookie.com')
  })

  it('clears non-YouTube iframe src', () => {
    const html = '<iframe src="https://evil.example.com/payload"></iframe>'
    const result = sanitizeHtml(html)
    expect(result).not.toContain('evil.example.com')
  })

  it('preserves TipTap task-list data-type attribute', () => {
    const html = '<ul><li data-type="taskItem">Task</li></ul>'
    const result = sanitizeHtml(html)
    expect(result).toContain('data-type="taskItem"')
  })

  it('preserves inline style for text colour', () => {
    const html = '<span style="color: rgb(239, 68, 68)">Red text</span>'
    const result = sanitizeHtml(html)
    expect(result).toContain('style=')
  })
})

// ── isSanitized ───────────────────────────────────────────────────────────────

describe('isSanitized', () => {
  it('returns true for already-clean HTML', () => {
    expect(isSanitized('<p>Clean content</p>')).toBe(true)
  })

  it('returns false when the input contains a script tag', () => {
    expect(isSanitized('<p>Hi</p><script>bad()</script>')).toBe(false)
  })

  it('returns false when an event handler is present', () => {
    expect(isSanitized('<img onerror="x()">')).toBe(false)
  })
})

// ── Server-side fallback (window stubbed to undefined) ────────────────────────

describe('sanitizeHtml — server-side fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('window', undefined)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('strips <script> tags via regex', () => {
    const result = sanitizeHtml('<p>Safe</p><script>alert("xss")</script>')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert')
    expect(result).toContain('<p>Safe</p>')
  })

  it('replaces inline event handler attributes', () => {
    const result = sanitizeHtml('<p onclick="evil()">Text</p>')
    expect(result).not.toContain('onclick=')
    expect(result).toContain('Text')
  })

  it('leaves normal HTML untouched', () => {
    const html = '<p>Hello <strong>world</strong></p>'
    expect(sanitizeHtml(html)).toBe(html)
  })
})
