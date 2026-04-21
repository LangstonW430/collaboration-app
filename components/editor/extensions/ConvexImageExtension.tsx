'use client'

import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useState } from 'react'

function ConvexImageView({ node, selected, editor }: NodeViewProps) {
  const storageId = node.attrs.storageId as string | null
  const directSrc = node.attrs.src as string | null
  const [showControls, setShowControls] = useState(false)

  const resolvedUrl = useQuery(
    api.files.getImageUrl,
    storageId ? { storageId: storageId as Id<'_storage'> } : 'skip'
  )

  const src = resolvedUrl ?? directSrc ?? ''
  const align = (node.attrs.align as string) ?? 'left'

  const alignClass = {
    left: 'mr-auto',
    center: 'mx-auto',
    right: 'ml-auto',
  }[align] ?? 'mr-auto'

  function setAlign(a: string) {
    editor?.commands.updateAttributes('convexImage', { align: a })
  }

  return (
    <NodeViewWrapper>
      <div
        className="relative inline-block my-2 group"
        style={{ display: 'block' }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        contentEditable={false}
      >
        {src ? (
          <img
            src={src}
            alt={node.attrs.alt ?? ''}
            className={`max-w-full rounded-lg block ${alignClass} ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            style={{ maxWidth: node.attrs.maxWidth ?? '100%' }}
          />
        ) : (
          <div className="w-48 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Alignment controls */}
        {(showControls || selected) && (
          <div className="absolute top-2 left-2 flex gap-1 bg-white border border-gray-200 rounded-lg shadow-sm p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAlign(a)}
                className={`p-1 rounded text-xs transition-colors ${align === a ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                title={`Align ${a}`}
              >
                {a === 'left' && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" />
                  </svg>
                )}
                {a === 'center' && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                )}
                {a === 'right' && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const ConvexImageExtension = Image.extend({
  name: 'convexImage',

  addAttributes() {
    return {
      ...this.parent?.(),
      storageId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-storage-id'),
        renderHTML: (attrs) =>
          attrs.storageId ? { 'data-storage-id': attrs.storageId } : {},
      },
      align: {
        default: 'left',
        parseHTML: (el) => el.getAttribute('data-align') ?? 'left',
        renderHTML: (attrs) => ({ 'data-align': attrs.align ?? 'left' }),
      },
      maxWidth: {
        default: '100%',
        parseHTML: (el) => el.style.maxWidth ?? '100%',
        renderHTML: (attrs) => ({ style: `max-width: ${attrs.maxWidth}` }),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ConvexImageView)
  },
})
