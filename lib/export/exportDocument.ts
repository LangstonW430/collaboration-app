// Client-side document export. Builds the file in memory and hands it to the
// browser as a download — nothing goes through the server.

/** Characters that may not appear literally in HTML text or attributes. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Wraps the editor's HTML in a minimal standalone page, so the download opens
 * readably in a browser rather than as an unstyled fragment.
 */
export function buildHtmlExport(title: string, contentHtml: string): string {
  const safeTitle = escapeHtml(title || 'Untitled Document')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; max-width: 48rem; margin: 0 auto; padding: 3rem 1.5rem; line-height: 1.65; }
  h1.doc-title { font-size: 2.25rem; margin: 0 0 2rem; }
  img { max-width: 100%; height: auto; }
  pre { background: #f3f4f6; border-radius: 8px; padding: 1rem; overflow-x: auto; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
  blockquote { border-left: 3px solid #d1d5db; margin-left: 0; padding-left: 1rem; color: #4b5563; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #d1d5db; padding: 0.4rem 0.6rem; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0; }
</style>
</head>
<body>
<h1 class="doc-title">${safeTitle}</h1>
${contentHtml}
</body>
</html>
`
}

/**
 * A filename the OS will accept, derived from the document title.
 * "Q3 plan: final?" becomes "Q3-plan-final".
 */
export function toFilename(title: string, extension: string): string {
  const base = (title || 'Untitled Document')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document'
  return `${base}.${extension}`
}

/** Offers `content` to the user as a file download. */
export function downloadFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
