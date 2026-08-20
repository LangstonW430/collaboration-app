import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { createCommentFieldsSchema } from '../lib/validation/documentSchema'
import { AUDIT_ACTIONS, recordAudit } from './model/audit'
import { enforceRateLimit } from './model/rateLimit'
import {
  canWrite,
  getDocumentAccess,
  requireDocumentAccess,
} from './model/documentAccess'

export const create = mutation({
  args: {
    docId: v.id('documents'),
    markId: v.string(),
    text: v.string(),
    quotedText: v.string(),
  },
  handler: async (ctx, args) => {
    // Read access, not write: viewers can comment on a document they can see
    // without being able to change its contents.
    const { userId } = await requireDocumentAccess(ctx, args.docId, 'read')
    await enforceRateLimit(ctx, userId, 'comments.create')

    const validation = createCommentFieldsSchema.safeParse({ text: args.text, quotedText: args.quotedText })
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Validation failed'
      console.error('[comments.create] Validation failure', { userId, issues: validation.error.issues })
      throw new Error(message)
    }

    return await ctx.db.insert('comments', {
      docId: args.docId,
      authorId: userId,
      markId: args.markId,
      text: validation.data.text,
      quotedText: validation.data.quotedText,
      resolved: false,
      createdAt: Date.now(),
    })
  },
})

export const list = query({
  args: { docId: v.id('documents') },
  handler: async (ctx, args) => {
    // Comments carry document text and author emails, so they are readable
    // only by the document's owner and its collaborators.
    const access = await getDocumentAccess(ctx, args.docId)
    if (!access) return []

    const comments = await ctx.db
      .query('comments')
      .withIndex('by_doc_and_resolved', (q) =>
        q.eq('docId', args.docId).eq('resolved', false)
      )
      .order('asc')
      .take(100)

    // One read per author rather than one per comment: a thread is usually a
    // few people saying many things.
    const authorIds = [...new Set(comments.map((c) => c.authorId))]
    const emailByAuthor = new Map(
      await Promise.all(
        authorIds.map(
          async (id) => [id, (await ctx.db.get(id))?.email ?? 'Unknown'] as const
        )
      )
    )

    return comments.map((c) => ({
      ...c,
      authorEmail: emailByAuthor.get(c.authorId) ?? 'Unknown',
    }))
  },
})

export const resolve = mutation({
  args: { commentId: v.id('comments') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const comment = await ctx.db.get(args.commentId)
    if (!comment) throw new Error('Comment not found')

    // Resolving hides the comment from everyone, so it is limited to the
    // comment's author and to those who can edit the document.
    const access = await requireDocumentAccess(ctx, comment.docId, 'read')
    if (comment.authorId !== userId && !canWrite(access.role)) {
      throw new Error('Not authorized')
    }

    await ctx.db.patch(args.commentId, { resolved: true })
  },
})

export const deleteComment = mutation({
  args: { commentId: v.id('comments') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const comment = await ctx.db.get(args.commentId)
    if (!comment) throw new Error('Comment not found')

    const access = await requireDocumentAccess(ctx, comment.docId, 'read')
    if (comment.authorId !== userId && access.role !== 'owner') {
      throw new Error('Not authorized')
    }

    await ctx.db.delete(args.commentId)

    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.COMMENT_DELETED,
      userId,
      docId: comment.docId,
      metadata: { commentAuthorId: comment.authorId },
    })
  },
})
