import { describe, it, expect } from 'vitest'
import {
  documentTitleSchema,
  documentContentSchema,
  commentTextSchema,
  inviteEmailSchema,
  saveDocumentArgsSchema,
  createCommentArgsSchema,
  inviteArgsSchema,
  TITLE_MAX,
  CONTENT_MAX,
  COMMENT_TEXT_MAX,
} from '../../../lib/validation/documentSchema'

// ── documentTitleSchema ───────────────────────────────────────────────────────

describe('documentTitleSchema', () => {
  it('accepts a normal title', () => {
    expect(documentTitleSchema.safeParse('My Document').success).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    const result = documentTitleSchema.safeParse('  Hello  ')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('Hello')
  })

  it('rejects an empty string', () => {
    const result = documentTitleSchema.safeParse('')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/empty/i)
    }
  })

  it('rejects a whitespace-only string', () => {
    // trim() makes it empty, then min(1) fires
    expect(documentTitleSchema.safeParse('   ').success).toBe(false)
  })

  it('accepts a title at the exact character limit', () => {
    expect(documentTitleSchema.safeParse('a'.repeat(TITLE_MAX)).success).toBe(true)
  })

  it('rejects a title one character over the limit', () => {
    const result = documentTitleSchema.safeParse('a'.repeat(TITLE_MAX + 1))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(String(TITLE_MAX))
    }
  })
})

// ── documentContentSchema ─────────────────────────────────────────────────────

describe('documentContentSchema', () => {
  it('accepts valid HTML content', () => {
    expect(documentContentSchema.safeParse('<p>Hello <strong>world</strong></p>').success).toBe(true)
  })

  it('accepts an empty string (blank document)', () => {
    expect(documentContentSchema.safeParse('').success).toBe(true)
  })

  it('accepts content that contains { but does not start with it', () => {
    expect(documentContentSchema.safeParse('<p>Value: {x}</p>').success).toBe(true)
  })

  it('rejects content that starts with { (JSON format guard)', () => {
    const result = documentContentSchema.safeParse('{"type":"doc"}')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/format/i)
    }
  })

  it('accepts content right at the size limit', () => {
    // Using a valid HTML fragment to stay just under the limit
    const html = '<p>' + 'a'.repeat(CONTENT_MAX - 7) + '</p>'
    expect(documentContentSchema.safeParse(html).success).toBe(true)
  })

  it('rejects content exceeding the size limit', () => {
    const result = documentContentSchema.safeParse('a'.repeat(CONTENT_MAX + 1))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/exceed|maximum|size/i)
    }
  })
})

// ── commentTextSchema ─────────────────────────────────────────────────────────

describe('commentTextSchema', () => {
  it('accepts normal comment text', () => {
    expect(commentTextSchema.safeParse('Looks good to me!').success).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    const result = commentTextSchema.safeParse('  great  ')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('great')
  })

  it('rejects an empty comment', () => {
    const result = commentTextSchema.safeParse('')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toMatch(/empty/i)
  })

  it('rejects a whitespace-only comment', () => {
    expect(commentTextSchema.safeParse('   ').success).toBe(false)
  })

  it('rejects text exceeding the limit', () => {
    const result = commentTextSchema.safeParse('x'.repeat(COMMENT_TEXT_MAX + 1))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(String(COMMENT_TEXT_MAX))
    }
  })
})

// ── inviteEmailSchema ─────────────────────────────────────────────────────────

describe('inviteEmailSchema', () => {
  it('accepts a valid email', () => {
    expect(inviteEmailSchema.safeParse('alice@example.com').success).toBe(true)
  })

  it('trims whitespace from email', () => {
    const result = inviteEmailSchema.safeParse('  bob@example.com  ')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('bob@example.com')
  })

  it('rejects an empty string', () => {
    expect(inviteEmailSchema.safeParse('').success).toBe(false)
  })

  it('rejects an email without @', () => {
    const result = inviteEmailSchema.safeParse('notanemail')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toMatch(/valid email/i)
  })

  it('rejects an email without domain', () => {
    expect(inviteEmailSchema.safeParse('user@').success).toBe(false)
  })

  it('rejects a string that is just @', () => {
    expect(inviteEmailSchema.safeParse('@').success).toBe(false)
  })
})

// ── saveDocumentArgsSchema ────────────────────────────────────────────────────

describe('saveDocumentArgsSchema', () => {
  it('accepts args with title only', () => {
    const result = saveDocumentArgsSchema.safeParse({ id: 'doc_123', title: 'My Doc' })
    expect(result.success).toBe(true)
  })

  it('accepts args with content only', () => {
    const result = saveDocumentArgsSchema.safeParse({ id: 'doc_123', content: '<p>Hello</p>' })
    expect(result.success).toBe(true)
  })

  it('accepts args with both title and content', () => {
    const result = saveDocumentArgsSchema.safeParse({
      id: 'doc_123',
      title: 'Doc',
      content: '<p>Body</p>',
    })
    expect(result.success).toBe(true)
  })

  it('rejects args when id is missing', () => {
    const result = saveDocumentArgsSchema.safeParse({ title: 'No ID' })
    expect(result.success).toBe(false)
  })

  it('rejects args when title exceeds the limit', () => {
    const result = saveDocumentArgsSchema.safeParse({
      id: 'doc_123',
      title: 'x'.repeat(TITLE_MAX + 1),
    })
    expect(result.success).toBe(false)
  })
})

// ── createCommentArgsSchema ───────────────────────────────────────────────────

describe('createCommentArgsSchema', () => {
  it('accepts valid comment args', () => {
    const result = createCommentArgsSchema.safeParse({
      docId: 'doc_123',
      markId: 'mark_456',
      text: 'Great point!',
      quotedText: 'some selected text',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing docId', () => {
    const result = createCommentArgsSchema.safeParse({
      markId: 'mark_456',
      text: 'Hello',
      quotedText: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty comment text', () => {
    const result = createCommentArgsSchema.safeParse({
      docId: 'doc_123',
      markId: 'mark_456',
      text: '',
      quotedText: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toMatch(/empty/i)
  })
})

// ── inviteArgsSchema ──────────────────────────────────────────────────────────

describe('inviteArgsSchema', () => {
  it('accepts valid editor invite', () => {
    const result = inviteArgsSchema.safeParse({
      docId: 'doc_123',
      email: 'team@example.com',
      role: 'editor',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid viewer invite', () => {
    const result = inviteArgsSchema.safeParse({
      docId: 'doc_123',
      email: 'reader@example.com',
      role: 'viewer',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid role', () => {
    const result = inviteArgsSchema.safeParse({
      docId: 'doc_123',
      email: 'user@example.com',
      role: 'admin',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = inviteArgsSchema.safeParse({
      docId: 'doc_123',
      email: 'not-an-email',
      role: 'viewer',
    })
    expect(result.success).toBe(false)
  })
})
