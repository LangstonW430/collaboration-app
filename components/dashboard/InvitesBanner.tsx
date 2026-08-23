'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import type { Id } from '@/convex/_generated/dataModel'
import { collaborationQueries } from '@/lib/services'
import { useDocumentService } from '@/lib/hooks/useDocumentService'
import { useToast } from '@/components/Toast'

export default function InvitesBanner() {
  const invites = useQuery(collaborationQueries.listMyInvites)
  const { acceptInvite, declineInvite } = useDocumentService()
  const toast = useToast()
  const [busy, setBusy] = useState<Id<'invites'> | null>(null)

  // An invite can fail to apply — the document was deleted, or the owner
  // withdrew it. Without this the rejection was unhandled and the row simply
  // sat there, giving the user nothing to react to.
  async function respond(
    inviteId: Id<'invites'>,
    action: (id: Id<'invites'>) => Promise<void>,
    failureMessage: string
  ) {
    setBusy(inviteId)
    try {
      await action(inviteId)
    } catch {
      toast.error(failureMessage)
    } finally {
      setBusy(null)
    }
  }

  if (!invites || invites.length === 0) return null

  return (
    <div className="mb-8 space-y-2.5">
      {invites.map((inv) => (
        <div key={inv._id} className="flex items-center justify-between bg-[#fbf6e9] border border-[#ecdfc0] border-l-[3px] border-l-[#b7912f] rounded-lg px-4 py-3 gap-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-sm text-stone-700">
              <span className="font-semibold text-[#1b1a17]">{inv.inviterName}</span>
              {' '}invited you to{' '}
              <span className="font-display font-semibold text-[#1b1a17]">&ldquo;{inv.docTitle}&rdquo;</span>
              {' '}as{' '}
              <span className="text-[#96751f] font-medium">{inv.role}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() =>
                respond(inv._id as Id<'invites'>, acceptInvite, 'Could not accept this invite. It may have been withdrawn.')
              }
              disabled={busy === inv._id}
              className="text-xs font-medium px-3.5 py-1.5 bg-[#1b1a17] text-[#f7f6f2] rounded-full hover:bg-black transition-colors disabled:opacity-50"
            >
              Accept
            </button>
            <button
              onClick={() =>
                respond(inv._id as Id<'invites'>, declineInvite, 'Could not decline this invite.')
              }
              disabled={busy === inv._id}
              className="text-xs font-medium px-3.5 py-1.5 text-stone-500 hover:text-[#1b1a17] hover:bg-[#f3ead3] rounded-full transition-colors disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
