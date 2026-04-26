"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import type { AuthServiceMethods } from "@/lib/services/types";

// ── Context ───────────────────────────────────────────────────────────────────

const AuthServiceContext = createContext<AuthServiceMethods | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthServiceProvider({ children }: { children: ReactNode }) {
  const { signIn: _signIn, signOut: _signOut } = useAuthActions();

  const service = useMemo<AuthServiceMethods>(
    () => ({
      signIn: (email: string, password: string) =>
        _signIn("password", { email, password, flow: "signIn" }).then(
          () => undefined
        ),

      signUp: (email: string, password: string) =>
        _signIn("password", { email, password, flow: "signUp" }).then(
          () => undefined
        ),

      signOut: () => _signOut(),
    }),
    [_signIn, _signOut]
  );

  return (
    <AuthServiceContext.Provider value={service}>
      {children}
    </AuthServiceContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the singleton auth service. Must be used inside AuthServiceProvider.
 *
 * @example
 * const { signIn, signOut } = useAuthService();
 * await signIn(email, password);
 */
export function useAuthService(): AuthServiceMethods {
  const ctx = useContext(AuthServiceContext);
  if (!ctx) {
    throw new Error(
      "useAuthService must be used within <AuthServiceProvider>"
    );
  }
  return ctx;
}
