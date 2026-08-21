import type { Id } from "@/convex/_generated/dataModel";

// ── Shared enums ──────────────────────────────────────────────────────────────

export type UserRole = "owner" | "editor" | "viewer";
export type CollaboratorRole = "editor" | "viewer";
export type InviteStatus = "pending" | "accepted" | "declined";

// ── Domain models ─────────────────────────────────────────────────────────────
// These mirror the Convex schema but are the authoritative types used by all
// React components. Nothing outside lib/services should import from
// convex/_generated/dataModel for these shapes.

export interface Document {
  _id: Id<"documents">;
  _creationTime: number;
  title: string;
  content: string;
  ownerId: Id<"users">;
  createdAt: number;
  updatedAt: number;
  userRole: UserRole;
}

/**
 * A document as it appears in a list. Carries a short text preview instead of
 * the body: the dashboard subscription would otherwise re-send every document
 * in full whenever anyone saved one.
 */
export interface DocumentSummary {
  _id: Id<"documents">;
  _creationTime: number;
  title: string;
  preview: string;
  ownerId: Id<"users">;
  createdAt: number;
  updatedAt: number;
  userRole: UserRole;
  /** Whether the current user has starred this document. */
  starred: boolean;
}

/** A trashed document as documents.listTrash returns it. */
export interface TrashedDocumentSummary extends DocumentSummary {
  archivedAt: number;
}

/** What documents.list returns, with a flag for documents it left out. */
export interface DocumentList {
  documents: DocumentSummary[];
  truncated: boolean;
}

/** Another user currently viewing a document. */
export interface PresenceUser {
  userId: Id<"users">;
  name: string | null;
  email: string | null;
}

export interface DocumentUpdate {
  title?: string;
  content?: string;
}

export interface Collaborator {
  _id: Id<"collaborators">;
  userId: Id<"users">;
  role: CollaboratorRole;
  name: string | null;
  email: string | null;
}

export interface PendingInvite {
  _id: Id<"invites">;
  docId: Id<"documents">;
  inviteeEmail: string;
  role: CollaboratorRole;
}

/** Full collaboration state for a document (owner-only view). */
export interface CollaborationData {
  collaborators: Collaborator[];
  pendingInvites: PendingInvite[];
}

/** Invite enriched with document title and inviter name for the banner UI. */
export interface InviteWithDetails {
  _id: Id<"invites">;
  docId: Id<"documents">;
  docTitle: string;
  inviterName: string;
  role: CollaboratorRole;
}

export interface Comment {
  _id: Id<"comments">;
  _creationTime: number;
  docId: Id<"documents">;
  authorId: Id<"users">;
  authorEmail: string;
  markId: string;
  text: string;
  quotedText: string;
  resolved: boolean;
  createdAt: number;
}

// ── Service interfaces ────────────────────────────────────────────────────────
// These describe the contract the hooks expose to components. Tests can mock
// these interfaces without touching Convex at all.

export interface DocumentMutations {
  /** Create a blank document; resolves with its Convex ID. */
  create(): Promise<Id<"documents">>;
  /**
   * Persist title / content changes. Resolves with the server's updatedAt for
   * the write, so the caller can tell its own save apart from someone else's.
   */
  update(id: Id<"documents">, updates: DocumentUpdate): Promise<{ updatedAt: number }>;
  /** Permanently delete an owned document. */
  remove(id: Id<"documents">): Promise<void>;
  /** Move an owned document to the trash; collaborators lose access. */
  archive(id: Id<"documents">): Promise<void>;
  /** Bring a trashed document back, collaborator access included. */
  restore(id: Id<"documents">): Promise<void>;
  /** Copy a readable document into the caller's account; resolves with the copy's ID. */
  duplicate(id: Id<"documents">): Promise<Id<"documents">>;
  /** Star or unstar a document; resolves with the new state. */
  toggleStar(docId: Id<"documents">): Promise<{ starred: boolean }>;
  /** Record that the caller is currently viewing the document. */
  heartbeat(docId: Id<"documents">): Promise<void>;
  /**
   * Return a short-lived signed URL for direct file upload to Convex storage.
   * Scoped to a document the caller can edit.
   */
  generateUploadUrl(docId: Id<"documents">): Promise<string>;
}

export interface CommentMutations {
  /** Attach a comment to a text selection identified by markId. */
  createComment(
    docId: Id<"documents">,
    markId: string,
    text: string,
    quotedText: string
  ): Promise<Id<"comments">>;
  /** Mark a comment resolved; it will no longer appear in the sidebar. */
  resolveComment(commentId: Id<"comments">): Promise<void>;
  /** Permanently remove a comment (author or owner). */
  deleteComment(commentId: Id<"comments">): Promise<void>;
}

export interface CollaborationMutations {
  /** Send a collaboration invite to an email address. */
  invite(
    docId: Id<"documents">,
    email: string,
    role: CollaboratorRole
  ): Promise<void>;
  /** Accept a pending invite and gain access to the document. */
  acceptInvite(inviteId: Id<"invites">): Promise<void>;
  /** Decline a pending invite. */
  declineInvite(inviteId: Id<"invites">): Promise<void>;
  /** Remove a collaborator's access (owner only). */
  removeCollaborator(
    docId: Id<"documents">,
    collaboratorId: Id<"collaborators">
  ): Promise<void>;
}

/** Combined service interface returned by useDocumentService(). */
export type DocumentServiceMethods = DocumentMutations &
  CommentMutations &
  CollaborationMutations;

export interface AuthServiceMethods {
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

// ── Convenience re-export of DocumentWithRole ─────────────────────────────────
// DocumentEditor and the doc page both need this shape.
export type DocumentWithRole = Document;
