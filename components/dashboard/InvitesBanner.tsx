'use client'

import { useQuery } from 'convex/react'
import type { Id } from '@/convex/_generated/dataModel'
import { collaborationQueries } from '@/lib/services'
import { useDocumentService } from '@/lib/hooks/useDocumentService'

export default function InvitesBanner() {
  const invites = useQuery(collaborationQueries.listMyInvites)
  const { acceptInvite, declineInvite } = useDocumentService()

  if (!invites || invites.length === 0) return null

  return (
    <div className="mb-6 space-y-2">
      {invites.map((inv) => (
        <div key={inv._id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 gap-4">
          <div className="min-w-0">
            <p className="text-sm text-gray-800">
              <span className="font-medium">{inv.inviterName}</span>
              {' '}invited you to{' '}
              <span className="font-medium">&ldquo;{inv.docTitle}&rdquo;</span>
              {' '}as{' '}
              <span className="text-blue-700 font-medium">{inv.role}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => acceptInvite(inv._id as Id<'invites'>)}
              className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => declineInvite(inv._id as Id<'invites'>)}
              className="text-xs font-medium px-3 py-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
