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
    <header className="sticky top-0 z-40 border-b border-[#e7e3da] bg-[#f7f6f2]/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 bg-[#1b1a17] rounded-md flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-[#f7f6f2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-display font-semibold text-[17px] tracking-tight text-[#1b1a17] group-hover:text-black transition-colors">
            CollabDocs
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {identity && (
            <div className="flex items-center gap-2" title={`Signed in as ${identity}`}>
              <span className="w-7 h-7 rounded-full bg-[#1b1a17] text-[#f7f6f2] font-display text-xs font-semibold flex items-center justify-center shadow-sm">
                {identity.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:block text-sm text-stone-500 max-w-48 truncate">{identity}</span>
            </div>
          )}
          <span className="hidden sm:block w-px h-4 bg-[#e7e3da]" aria-hidden="true" />
          <button
            onClick={handleSignOut}
            className="text-sm text-stone-500 hover:text-[#1b1a17] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
