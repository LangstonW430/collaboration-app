import Link from 'next/link'
import type { Doc } from '@/convex/_generated/dataModel'
import { formatDate } from '@/lib/utils'

interface DocumentCardProps {
  document: Doc<'documents'>
}

export default function DocumentCard({ document }: DocumentCardProps) {
  const preview = document.content
    ? document.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
    : ''

  return (
    <Link href={`/doc/${document._id}`}>
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group h-full flex flex-col">
        <div className="flex-1 w-full h-28 bg-gray-50 rounded-lg mb-3 p-3 overflow-hidden">
          {preview ? (
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-5">{preview}</p>
          ) : (
            <p className="text-xs text-gray-300 italic">Empty document</p>
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm truncate group-hover:text-blue-600 transition-colors">
            {document.title || 'Untitled Document'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(document.updatedAt)}
          </p>
        </div>
      </div>
    </Link>
  )
}
