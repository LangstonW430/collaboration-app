'use client'

import { useQuery, useConvexAuth } from 'convex/react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { Id } from '@/convex/_generated/dataModel'
import type { DocumentWithRole } from '@/lib/services/types'
import { documentQueries } from '@/lib/services'

const DocumentEditor = dynamic(
  () => import('@/components/editor/DocumentEditor'),
  { ssr: false, loading: () => <EditorSkeleton /> }
)

export default function DocPage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const params = useParams()
  const id = params.id as Id<'documents'>
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/auth/login')
  }, [isAuthenticated, isLoading, router])

  const document = useQuery(
    documentQueries.get,
    isAuthenticated ? { id } : 'skip'
  ) as DocumentWithRole | null | undefined

  // null means the document is gone or not ours to read. Navigating is a side
  // effect, so it belongs here rather than in the render body, where React
  // warns about updating another component mid-render and the call can repeat
  // on every render until the route changes.
  useEffect(() => {
    if (document === null) router.replace('/dashboard')
  }, [document, router])

  if (isLoading || !isAuthenticated) return <EditorSkeleton />

  // Undefined while loading, null while the redirect above is in flight.
  if (!document) return <EditorSkeleton />

  return <DocumentEditor document={document} />
}

function EditorSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 h-12" />
      <div className="max-w-3xl mx-auto px-8 py-14 animate-pulse">
        <div className="h-10 w-72 bg-gray-100 rounded-lg mb-10" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-5/6 bg-gray-100 rounded" />
          <div className="h-4 w-4/6 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  )
}
