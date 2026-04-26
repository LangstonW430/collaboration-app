"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DocumentServiceMethods, DocumentUpdate, CollaboratorRole } from "@/lib/services/types";

// ── Context ───────────────────────────────────────────────────────────────────

const DocumentServiceContext = createContext<DocumentServiceMethods | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
// Mount once near the top of the React tree (inside ConvexAuthProvider).
// All useMutation hooks are called here, so Convex creates a single set of
// subscription handles that every consumer shares — the singleton pattern.

export function DocumentServiceProvider({ children }: { children: ReactNode }) {
  // Document mutations
  const _create = useMutation(api.documents.create);
  const _update = useMutation(api.documents.update);
  const _remove = useMutation(api.documents.remove);

  // File mutations
  const _generateUploadUrl = useMutation(api.files.generateUploadUrl);

  // Comment mutations
  const _createComment = useMutation(api.comments.create);
  const _resolveComment = useMutation(api.comments.resolve);
  const _deleteComment = useMutation(api.comments.deleteComment);

  // Collaboration mutations
  const _invite = useMutation(api.collaborators.invite);
  const _acceptInvite = useMutation(api.collaborators.acceptInvite);
  const _declineInvite = useMutation(api.collaborators.declineInvite);
  const _removeCollaborator = useMutation(api.collaborators.removeCollaborator);

  const service = useMemo<DocumentServiceMethods>(
    () => ({
      // ── Document ─────────────────────────────────────────────────────────
      create: () => _create(),

      update: (id: Id<"documents">, updates: DocumentUpdate) =>
        _update({ id, title: updates.title, content: updates.content }).then(
          () => undefined
        ),

      remove: (id: Id<"documents">) =>
        _remove({ id }).then(() => undefined),

      // ── File ─────────────────────────────────────────────────────────────
      generateUploadUrl: () => _generateUploadUrl(),

      // ── Comments ─────────────────────────────────────────────────────────
      createComment: (
        docId: Id<"documents">,
        markId: string,
        text: string,
        quotedText: string
      ) => _createComment({ docId, markId, text, quotedText }),

      resolveComment: (commentId: Id<"comments">) =>
        _resolveComment({ commentId }).then(() => undefined),

      deleteComment: (commentId: Id<"comments">) =>
        _deleteComment({ commentId }).then(() => undefined),

      // ── Collaboration ─────────────────────────────────────────────────────
      invite: (docId: Id<"documents">, email: string, role: CollaboratorRole) =>
        _invite({ docId, email, role }).then(() => undefined),

      acceptInvite: (inviteId: Id<"invites">) =>
        _acceptInvite({ inviteId }).then(() => undefined),

      declineInvite: (inviteId: Id<"invites">) =>
        _declineInvite({ inviteId }).then(() => undefined),

      removeCollaborator: (
        docId: Id<"documents">,
        collaboratorId: Id<"collaborators">
      ) => _removeCollaborator({ docId, collaboratorId }).then(() => undefined),
    }),
    [
      _create, _update, _remove,
      _generateUploadUrl,
      _createComment, _resolveComment, _deleteComment,
      _invite, _acceptInvite, _declineInvite, _removeCollaborator,
    ]
  );

  return (
    <DocumentServiceContext.Provider value={service}>
      {children}
    </DocumentServiceContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the singleton document service. Must be used inside
 * DocumentServiceProvider (added to app/providers.tsx).
 *
 * @example
 * const { create, update, remove, invite } = useDocumentService();
 */
export function useDocumentService(): DocumentServiceMethods {
  const ctx = useContext(DocumentServiceContext);
  if (!ctx) {
    throw new Error(
      "useDocumentService must be used within <DocumentServiceProvider>"
    );
  }
  return ctx;
}
