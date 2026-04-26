'use client'

import { useQuery, useConvexAuth } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { documentQueries } from '@/lib/services'
import DocumentCard from '@/components/dashboard/DocumentCard'
import NewDocumentButton from '@/components/dashboard/NewDocumentButton'
import InvitesBanner from '@/components/dashboard/InvitesBanner'
import Header from '@/components/ui/Header'

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/auth/login')
  }, [isAuthenticated, isLoading, router])

  const documents = useQuery(documentQueries.list)

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <InvitesBanner />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">My Documents</h1>
          <NewDocumentButton />
        </div>

        {documents === undefined && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="h-28 bg-gray-100 rounded-lg mb-3" />
                <div className="h-4 w-3/4 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {documents !== undefined && documents.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-white border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm mb-4">No documents yet</p>
            <NewDocumentButton variant="inline" />
          </div>
        )}

        {documents !== undefined && documents.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {documents.map((doc) => (
              <DocumentCard key={doc._id} document={doc} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
