'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { userQueries } from '@/lib/services'

export default function Header() {
  const { signOut } = useAuthActions()
  const router = useRouter()
  const me = useQuery(userQueries.me)
  const identity = me?.name || me?.email || null

  async function handleSignOut() {
    await signOut()
    router.push('/auth/login')
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
            CollabDocs
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {identity && (
            <div className="flex items-center gap-2" title={`Signed in as ${identity}`}>
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold flex items-center justify-center">
                {identity.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:block text-sm text-gray-500 max-w-48 truncate">{identity}</span>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
