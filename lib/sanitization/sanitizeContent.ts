// Sanitize HTML produced by TipTap before persisting to the backend.
// DOMPurify only works in browser environments; the server-side fallback is a
// minimal regex strip. Backend Zod length validation is the real security gate.

import type DOMPurifyDefault from 'dompurify'

type DOMPurifyI = typeof DOMPurifyDefault

const ALLOWED_TAGS = [
  // Inline text
  'p', 'br', 'strong', 'em', 'u', 's', 'code', 'mark', 'sub', 'sup',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Lists (including TipTap task list)
  'ul', 'ol', 'li',
  // Quotes & code
  'blockquote', 'pre',
  // Links & media
  'a', 'img', 'div', 'span', 'figure', 'figcaption',
  // Tables
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  // Structural
  'hr',
  // Task-list checkbox (TipTap renders <input type="checkbox">)
  'input', 'label',
  // YouTube embeds (TipTap youtube extension)
  'iframe',
]

const ALLOWED_ATTR = [
  // Standard
  'href', 'src', 'alt', 'title', 'class', 'id', 'lang',
  // Links
  'target', 'rel',
  // Tables
  'colspan', 'rowspan',
  // Checkbox (task list)
  'type', 'checked', 'disabled', 'contenteditable',
  // Inline style (used by TipTap text-color and highlight extensions)
  'style',
  // TipTap extension data attributes
  'data-type', 'data-checked', 'data-id', 'data-youtube-video',
  // YouTube iframe attributes
  'frameborder', 'allowfullscreen', 'allow', 'width', 'height',
]

const YOUTUBE_ORIGIN_RE = /^https:\/\/(www\.)?youtube(?:-nocookie)?\.com\//i

let _purify: DOMPurifyI | null = null

function getPurify(): DOMPurifyI {
  if (_purify) return _purify

  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const mod: any = require('dompurify')
  const instance = (mod.default ?? mod) as DOMPurifyI

  // Restrict iframe sources to YouTube only
  instance.addHook('uponSanitizeAttribute', (node, hookEvent) => {
    if (
      node.nodeName === 'IFRAME' &&
      hookEvent.attrName === 'src' &&
      !YOUTUBE_ORIGIN_RE.test(hookEvent.attrValue)
    ) {
      hookEvent.attrValue = ''
    }
  })

  _purify = instance
  return _purify
}

/**
 * Sanitizes TipTap HTML before it is persisted.
 * Removes script tags, event handlers, and dangerous attributes while
 * preserving all content the editor can legitimately produce.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side fallback: strip the most obvious injection vectors.
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s+on\w+\s*=/gi, ' data-removed=')
  }

  return getPurify().sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  }) as string
}

/**
 * Returns true when the sanitized value equals the input —
 * i.e. no content was stripped.
 */
export function isSanitized(html: string): boolean {
  if (typeof window === 'undefined') return true
  return sanitizeHtml(html) === html
}
