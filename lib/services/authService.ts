// Auth service — business logic helpers that sit above @convex-dev/auth.
// The React hook lives in lib/hooks/useAuthService.ts.

/** Classify raw auth errors into user-friendly messages. */
export function formatAuthError(err: unknown): string {
  if (!(err instanceof Error)) return "An unexpected error occurred";
  const msg = err.message.toLowerCase();
  if (msg.includes("invalid password") || msg.includes("wrong password"))
    return "Incorrect email or password";
  if (msg.includes("user not found") || msg.includes("no account"))
    return "No account found with that email";
  if (msg.includes("already exists") || msg.includes("email taken"))
    return "An account with this email already exists";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Network error — please check your connection";
  return err.message;
}
