// Convex query function references for collaboration and comments.
// Pass these directly to useQuery() in components.
import { api } from "@/convex/_generated/api";

export const collaborationQueries = {
  /** Collaborators and pending invites for a document (owner-only). */
  listForDoc: api.collaborators.listForDoc,
  /** All pending invites addressed to the current user. */
  listMyInvites: api.collaborators.listMyInvites,
} as const;

export const commentQueries = {
  /** Unresolved comments for a document, enriched with author email. */
  list: api.comments.list,
} as const;
