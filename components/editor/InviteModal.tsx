'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

interface InviteModalProps {
  docId: Id<'documents'>
  onClose: () => void
}

export default function InviteModal({ docId, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const data = useQuery(api.collaborators.listForDoc, { docId })
  const invite = useMutation(api.collaborators.invite)
  const removeCollaborator = useMutation(api.collaborators.removeCollaborator)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    setSuccess(false)
    try {
      await invite({ docId, email: email.trim(), role })
      setEmail('')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setSending(false)
    }
  }

  async function handleRemove(collaboratorId: Id<'collaborators'>) {
    await removeCollaborator({ docId, collaboratorId })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Share document</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Invite form */}
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); setSuccess(false) }}
                placeholder="Email address"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                required
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="text-sm border border-gray-200 rounded-lg px-2 py-2 outline-none focus:border-blue-400 bg-white cursor-pointer"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
            {success && (
              <p className="text-xs text-green-600">Invite sent!</p>
            )}

            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Sending…' : 'Send invite'}
            </button>
          </form>

          {/* Current collaborators */}
          {data && (data.collaborators.length > 0 || data.pendingInvites.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">People with access</p>

              {data.collaborators.map((collab) => (
                <div key={collab._id} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0">
                    {collab.name && (
                      <p className="text-sm font-medium text-gray-900 truncate">{collab.name}</p>
                    )}
                    <p className="text-xs text-gray-500 truncate">{collab.email ?? 'Unknown'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs text-gray-400 capitalize">{collab.role}</span>
                    <button
                      onClick={() => handleRemove(collab._id as Id<'collaborators'>)}
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="Remove access"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {data.pendingInvites.map((inv) => (
                <div key={inv._id} className="flex items-center justify-between py-1.5 opacity-60">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">{inv.inviteeEmail}</p>
                    <p className="text-xs text-gray-400">Invite pending</p>
                  </div>
                  <span className="text-xs text-gray-400 capitalize shrink-0 ml-2">{inv.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
