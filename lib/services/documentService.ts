// Convex query function references for documents and files.
// Pass these directly to useQuery() — they replace direct api.X.Y imports in
// components, so a backend rename only requires updating this file.
import { api } from "@/convex/_generated/api";

export const documentQueries = {
  /** All documents the current user owns or collaborates on. */
  list: api.documents.list,
  /** Single document by ID (null if not found / not authorised). */
  get: api.documents.get,
  /** Full-content search over the same documents `list` shows. */
  search: api.documents.search,
  /** The caller's trashed documents, most recently trashed first. */
  listTrash: api.documents.listTrash,
} as const;

export const presenceQueries = {
  /** Other users currently viewing a document. */
  activeUsers: api.presence.activeUsers,
} as const;

export const userQueries = {
  /** The signed-in user's own name and email (null when signed out). */
  me: api.users.me,
} as const;

export const fileQueries = {
  /** Signed URL for a stored image given its Convex storage ID. */
  getImageUrl: api.files.getImageUrl,
} as const;
