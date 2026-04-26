// Single import point for all service types, query refs, and helpers.
// Components should import from here, not from the individual service files.

export type {
  UserRole,
  CollaboratorRole,
  InviteStatus,
  Document,
  DocumentUpdate,
  DocumentWithRole,
  Collaborator,
  PendingInvite,
  CollaborationData,
  InviteWithDetails,
  Comment,
  DocumentMutations,
  CommentMutations,
  CollaborationMutations,
  DocumentServiceMethods,
  AuthServiceMethods,
} from "./types";

export { documentQueries, fileQueries } from "./documentService";
export { collaborationQueries, commentQueries } from "./collaborationService";
export { formatAuthError } from "./authService";
