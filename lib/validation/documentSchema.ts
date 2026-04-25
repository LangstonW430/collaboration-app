import { z } from 'zod'

// ── Limits ───────────────────────────────────────────────────────────────────

export const TITLE_MAX = 500
export const CONTENT_MAX = 1_000_000
export const COMMENT_TEXT_MAX = 2_000
export const COMMENT_QUOTED_MAX = 500
export const EMAIL_MAX = 254

// ── Field-level schemas ───────────────────────────────────────────────────────

export const documentTitleSchema = z
  .string()
  .min(1, 'Title cannot be empty')
  .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or fewer`)
  .trim()

export const documentContentSchema = z
  .string()
  .max(CONTENT_MAX, `Document exceeds the maximum size of ${(CONTENT_MAX / 1000).toLocaleString()} KB`)
  .refine(
    (html) => !html.trimStart().startsWith('{'),
    'Content format is invalid'
  )

export const commentTextSchema = z
  .string()
  .min(1, 'Comment cannot be empty')
  .max(COMMENT_TEXT_MAX, `Comment must be ${COMMENT_TEXT_MAX} characters or fewer`)
  .trim()

export const inviteEmailSchema = z
  .string()
  .min(1, 'Email is required')
  .max(EMAIL_MAX, 'Email address is too long')
  .email('Please enter a valid email address')
  .trim()

// ── Mutation-args schemas (include Convex ID fields) ──────────────────────────

/** Matches the args for api.documents.update */
export const saveDocumentArgsSchema = z.object({
  id: z.string().min(1),
  title: documentTitleSchema.optional(),
  content: documentContentSchema.optional(),
})

/** Matches the args for api.comments.create */
export const createCommentArgsSchema = z.object({
  docId: z.string().min(1),
  markId: z.string().min(1),
  text: commentTextSchema,
  quotedText: z.string().max(COMMENT_QUOTED_MAX, `Quoted text must be ${COMMENT_QUOTED_MAX} characters or fewer`),
})

/** Matches the args for api.collaborators.invite */
export const inviteArgsSchema = z.object({
  docId: z.string().min(1),
  email: inviteEmailSchema,
  role: z.enum(['editor', 'viewer'], {
    error: 'Role must be "editor" or "viewer"',
  }),
})

// ── Inferred types ────────────────────────────────────────────────────────────

export type SaveDocumentArgs = z.infer<typeof saveDocumentArgsSchema>
export type CreateCommentArgs = z.infer<typeof createCommentArgsSchema>
export type InviteArgs = z.infer<typeof inviteArgsSchema>
