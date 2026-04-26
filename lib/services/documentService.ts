// Convex query function references for documents and files.
// Pass these directly to useQuery() — they replace direct api.X.Y imports in
// components, so a backend rename only requires updating this file.
import { api } from "@/convex/_generated/api";

export const documentQueries = {
  /** All documents the current user owns or collaborates on. */
  list: api.documents.list,
  /** Single document by ID (null if not found / not authorised). */
  get: api.documents.get,
} as const;

export const fileQueries = {
  /** Signed URL for a stored image given its Convex storage ID. */
  getImageUrl: api.files.getImageUrl,
} as const;
