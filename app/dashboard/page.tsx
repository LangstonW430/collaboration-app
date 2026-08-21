'use client'

import { useQuery, useConvexAuth } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { documentQueries } from '@/lib/services'
import type { DocumentSummary } from '@/lib/services/types'
import DocumentCard from '@/components/dashboard/DocumentCard'
import TrashCard from '@/components/dashboard/TrashCard'
import NewDocumentButton from '@/components/dashboard/NewDocumentButton'
import InvitesBanner from '@/components/dashboard/InvitesBanner'
import Header from '@/components/ui/Header'

const SEARCH_DEBOUNCE_MS = 250

type Filter = 'all' | 'owned' | 'shared' | 'starred'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'owned', label: 'Owned' },
  { key: 'shared', label: 'Shared' },
  { key: 'starred', label: 'Starred' },
]

function matchesFilter(doc: DocumentSummary, filter: Filter): boolean {
  switch (filter) {
    case 'owned': return doc.userRole === 'owner'
    case 'shared': return doc.userRole !== 'owner'
    case 'starred': return doc.starred
    default: return true
  }
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const router = useRouter()

  const [view, setView] = useState<'documents' | 'trash'>('documents')
  const [filter, setFilter] = useState<Filter>('all')
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/auth/login')
  }, [isAuthenticated, isLoading, router])

  // Debounce so a keystroke burst becomes one server query.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchText])

  const result = useQuery(documentQueries.list)
  const searching = debouncedSearch.length > 0
  const searchResult = useQuery(
    documentQueries.search,
    searching ? { query: debouncedSearch } : 'skip'
  )
  const trashResult = useQuery(documentQueries.listTrash)

  const documents = useMemo(() => {
    const source = searching ? searchResult?.documents : result?.documents
    if (source === undefined) return undefined
    return source.filter((doc) => matchesFilter(doc, filter))
  }, [searching, searchResult, result, filter])

  const trashCount = trashResult?.documents.length ?? 0

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

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mr-auto">
            {view === 'trash' ? 'Trash' : 'My Documents'}
          </h1>

          {view === 'documents' && (
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search documents…"
                className="w-56 text-sm bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-blue-400 transition-colors"
              />
            </div>
          )}

          <button
            onClick={() => setView((v) => (v === 'trash' ? 'documents' : 'trash'))}
            data-testid="trash-toggle"
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              view === 'trash'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Trash{trashCount > 0 ? ` (${trashCount})` : ''}
          </button>

          {view === 'documents' && <NewDocumentButton />}
        </div>

        {view === 'documents' && (
          <div className="flex items-center gap-1.5 mb-5">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                  filter === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {view === 'trash' ? (
          <>
            {trashResult === undefined && <CardGridSkeleton />}
            {trashResult !== undefined && trashResult.documents.length === 0 && (
              <div className="text-center py-24">
                <p className="text-gray-400 text-sm">The trash is empty.</p>
              </div>
            )}
            {trashResult !== undefined && trashResult.documents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {trashResult.documents.map((doc) => (
                  <TrashCard key={doc._id} document={doc} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {documents === undefined && <CardGridSkeleton />}

            {documents !== undefined && documents.length === 0 && (
              <div className="text-center py-24">
                <div className="w-16 h-16 bg-white border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                {searching ? (
                  <p className="text-gray-400 text-sm">No documents match “{debouncedSearch}”.</p>
                ) : filter !== 'all' ? (
                  <p className="text-gray-400 text-sm">No {filter === 'starred' ? 'starred' : filter} documents.</p>
                ) : (
                  <>
                    <p className="text-gray-400 text-sm mb-4">No documents yet</p>
                    <NewDocumentButton variant="inline" />
                  </>
                )}
              </div>
            )}

            {documents !== undefined && documents.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {documents.map((doc) => (
                    <DocumentCard key={doc._id} document={doc} />
                  ))}
                </div>
                {!searching && result?.truncated && (
                  <p className="text-xs text-gray-400 text-center mt-6">
                    Showing your {documents.length} most recently updated documents.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="h-28 bg-gray-100 rounded-lg mb-3" />
          <div className="h-4 w-3/4 bg-gray-100 rounded mb-2" />
          <div className="h-3 w-1/2 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )
}
