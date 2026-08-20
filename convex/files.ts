import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getDocumentAccess,
  requireDocumentAccess,
} from "./model/documentAccess";

/**
 * Returns a signed URL for uploading a file directly to Convex storage.
 * Scoped to a document the caller can edit, so upload capacity is tied to a
 * real editing session rather than to any signed-in account.
 */
export const generateUploadUrl = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    await requireDocumentAccess(ctx, args.docId, "write");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Returns a fresh signed URL for a stored file.
 *
 * Access is granted only when the caller can read `docId` and that document
 * actually embeds the storage ID, so a signed-in user cannot read arbitrary
 * files out of the deployment's storage by guessing IDs.
 *
 * A just-uploaded image is not yet referenced by the saved document, so this
 * returns null until the autosave lands. The query re-runs reactively when the
 * document changes, so the image appears on its own once the save completes.
 */
export const getImageUrl = query({
  args: {
    storageId: v.id("_storage"),
    docId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const access = await getDocumentAccess(ctx, args.docId);
    if (!access) return null;
    if (!access.doc.content.includes(args.storageId)) return null;

    return await ctx.storage.getUrl(args.storageId);
  },
});
