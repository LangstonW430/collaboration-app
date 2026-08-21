import { describe, it, expect } from 'vitest'
import { DEMO_DOCUMENTS } from '@/convex/model/demoContent'
import { sanitizeHtml } from '@/lib/sanitization/sanitizeContent'

// The seed writes straight to the database, but the editor sanitizes on every
// save. Anything stripped here would vanish the first time a visitor typed in a
// seeded document — silently, and only in the deployment people actually see.
describe('demo content', () => {
  it.each(DEMO_DOCUMENTS.map((d) => [d.title, d.content] as const))(
    '%s keeps its node attributes through sanitization',
    (_title, content) => {
      const clean = sanitizeHtml(content)
      for (const attribute of [
        'data-chart-type',
        'data-chart-values',
        'data-comment-id',
        'data-checked',
        'data-color',
        'colspan',
      ]) {
        if (content.includes(attribute)) expect(clean).toContain(attribute)
      }
    }
  )

  it('carries no script through sanitization', () => {
    for (const doc of DEMO_DOCUMENTS) {
      expect(sanitizeHtml(doc.content)).not.toContain('<script')
    }
  })

  it('shows off the features worth showing', () => {
    const all = DEMO_DOCUMENTS.map((d) => d.content).join('')
    expect(all).toContain('data-chart-type')
    expect(all).toContain('<table')
    expect(all).toContain('data-type="taskList"')
    expect(all).toContain('data-comment-id')
    expect(all).toContain('<pre><code>')
  })

  it('gives every document a distinct title and a recent edit time', () => {
    const titles = DEMO_DOCUMENTS.map((d) => d.title)
    expect(new Set(titles).size).toBe(titles.length)
    for (const doc of DEMO_DOCUMENTS) {
      expect(doc.editedMinutesAgo).toBeGreaterThan(0)
    }
  })
})
