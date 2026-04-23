import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'

export const create = mutation({
  args: {
    docId: v.id('documents'),
    markId: v.string(),
    text: v.string(),
    quotedText: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')
    return await ctx.db.insert('comments', {
      docId: args.docId,
      authorId: userId,
      markId: args.markId,
      text: args.text,
      quotedText: args.quotedText,
      resolved: false,
      createdAt: Date.now(),
    })
  },
})

export const list = query({
  args: { docId: v.id('documents') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_doc_and_resolved', (q) =>
        q.eq('docId', args.docId).eq('resolved', false)
      )
      .order('asc')
      .take(100)
    return await Promise.all(
      comments.map(async (c) => {
        const author = (await ctx.db.get(c.authorId)) as any
        return { ...c, authorEmail: (author?.email as string | undefined) ?? 'Unknown' }
      })
    )
  },
})

export const resolve = mutation({
  args: { commentId: v.id('comments') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')
    const comment = await ctx.db.get(args.commentId)
    if (!comment) throw new Error('Comment not found')
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
    const doc = await ctx.db.get(comment.docId)
    if (comment.authorId !== userId && doc?.ownerId !== userId) {
      throw new Error('Not authorized')
    }
    await ctx.db.delete(args.commentId)
  },
})
