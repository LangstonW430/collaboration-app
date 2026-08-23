'use client'

import { useQuery, useConvexAuth } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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

  // Each new query string opens a fresh subscription that starts undefined.
  // Holding the previous results keeps the grid steady while the next answer
  // loads, instead of flashing the skeleton on every debounced keystroke.
  const lastSearchDocs = useRef<DocumentSummary[] | undefined>(undefined)
  if (searchResult !== undefined) lastSearchDocs.current = searchResult.documents
  if (!searching) lastSearchDocs.current = undefined

  const searchPending = searching && searchResult === undefined
  const source = searching
    ? searchResult?.documents ?? lastSearchDocs.current
    : result?.documents
  const documents = source?.filter((doc) => matchesFilter(doc, filter))

  const trashCount = trashResult?.documents.length ?? 0
  const allDocs = result?.documents
  const sharedCount = allDocs?.filter((d) => d.userRole !== 'owner').length ?? 0

  function clearSearch() {
    setSearchText('')
    setDebouncedSearch('')
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen desk flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1b1a17] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen desk">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10">
        <InvitesBanner />

        {/* Masthead */}
        <div className="mb-8">
          <p className="eyebrow mb-1.5">{view === 'trash' ? 'Recently removed' : 'Workspace'}</p>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
            <div>
              <h1 className="font-display text-3xl sm:text-[2.375rem] leading-tight tracking-tight text-[#1b1a17]">
                {view === 'trash' ? 'Trash' : 'My Documents'}
              </h1>
              <p className="text-sm text-stone-500 mt-1.5">
                {view === 'trash'
                  ? trashResult === undefined
                    ? ' '
                    : trashCount === 0
                      ? 'Nothing in the trash'
                      : `${trashCount} ${trashCount === 1 ? 'document' : 'documents'} waiting to be restored`
                  : allDocs === undefined
                    ? ' '
                    : `${allDocs.length} ${allDocs.length === 1 ? 'document' : 'documents'}${sharedCount > 0 ? ` · ${sharedCount} shared with you` : ''}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {view === 'documents' && (
                <div className="relative">
                  <svg className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') clearSearch() }}
                    placeholder="Search documents…"
                    aria-label="Search documents"
                    className="w-56 sm:w-64 text-sm bg-white/80 border border-[#e7e3da] rounded-full pl-10 pr-9 py-2 outline-none placeholder:text-stone-400 focus:bg-white focus:border-stone-400 transition-colors"
                  />
                  {searchPending ? (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#1b1a17] border-t-transparent rounded-full animate-spin" />
                  ) : searchText ? (
                    <button
                      onClick={clearSearch}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-700 rounded-full transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  ) : null}
                </div>
              )}

              <button
                onClick={() => setView((v) => (v === 'trash' ? 'documents' : 'trash'))}
                data-testid="trash-toggle"
                className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border transition-colors ${
                  view === 'trash'
                    ? 'bg-[#1b1a17] text-[#f7f6f2] border-[#1b1a17]'
                    : 'bg-white/80 text-stone-500 border-[#e7e3da] hover:border-stone-400 hover:text-stone-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Trash{trashCount > 0 ? ` (${trashCount})` : ''}
              </button>

              {view === 'documents' && <NewDocumentButton />}
            </div>
          </div>
        </div>

        {view === 'documents' && (
          <div className="flex items-center gap-7 border-b border-[#e7e3da] mb-7">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`relative pb-2.5 text-sm transition-colors ${
                  filter === key
                    ? 'text-[#1b1a17] font-medium'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {label}
                {filter === key && (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] bg-[#1b1a17] rounded-full" />
                )}
              </button>
            ))}
          </div>
        )}

        {view === 'trash' ? (
          <>
            {trashResult === undefined && <CardGridSkeleton />}
            {trashResult !== undefined && trashResult.documents.length === 0 && (
              <EmptyState>
                <p className="font-display text-lg text-stone-500">The trash is empty.</p>
              </EmptyState>
            )}
            {trashResult !== undefined && trashResult.documents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
              <EmptyState>
                {searching ? (
                  <p className="font-display text-lg text-stone-500">No documents match &ldquo;{debouncedSearch}&rdquo;.</p>
                ) : filter !== 'all' ? (
                  <p className="font-display text-lg text-stone-500">No {filter === 'starred' ? 'starred' : filter} documents.</p>
                ) : (
                  <>
                    <p className="font-display text-xl text-stone-600 mb-1">A blank page awaits</p>
                    <p className="text-sm text-stone-400 mb-5">No documents yet</p>
                    <NewDocumentButton variant="inline" />
                  </>
                )}
              </EmptyState>
            )}

            {documents !== undefined && documents.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {documents.map((doc) => (
                    <DocumentCard key={doc._id} document={doc} />
                  ))}
                </div>
                {!searching && result?.truncated && (
                  <p className="text-xs text-stone-400 text-center mt-8">
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

/* A small stack of blank pages: the desk with nothing on it yet. */
function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-20">
      <div className="relative w-20 h-24 mx-auto mb-7" aria-hidden="true">
        <div className="absolute inset-0 bg-white border border-[#e7e3da] rounded-md -rotate-6 shadow-sm" />
        <div className="absolute inset-0 bg-white border border-[#e7e3da] rounded-md rotate-3 shadow-sm" />
        <div className="absolute inset-0 bg-white border border-[#e7e3da] rounded-md shadow-sm flex items-center justify-center">
          <svg className="w-7 h-7 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>
      {children}
    </div>
  )
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[#e7e3da] bg-[#fbfaf6] p-3 animate-pulse">
          <div className="h-36 bg-white border border-[#eeece3] rounded-lg mb-3 p-4">
            <div className="h-3 w-2/3 bg-stone-100 rounded mb-3" />
            <div className="h-2 w-full bg-stone-100 rounded mb-2" />
            <div className="h-2 w-5/6 bg-stone-100 rounded mb-2" />
            <div className="h-2 w-4/6 bg-stone-100 rounded" />
          </div>
          <div className="px-1 pb-1">
            <div className="h-4 w-3/4 bg-stone-200/60 rounded mb-2" />
            <div className="h-3 w-1/2 bg-stone-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
