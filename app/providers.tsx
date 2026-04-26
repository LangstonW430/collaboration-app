'use client'

import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { ConvexReactClient } from "convex/react"
import type { ReactNode } from "react"
import { ConnectionProvider } from "@/lib/context/ConnectionContext"
import { ToastProvider } from "@/components/Toast"
import { ErrorBoundary } from "@/components/ErrorBoundary"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
if (!convexUrl) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set — add it to .env.local or GitHub Secrets')
const convex = new ConvexReactClient(convexUrl)

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <ConnectionProvider>
        <ToastProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ToastProvider>
      </ConnectionProvider>
    </ConvexAuthProvider>
  )
}
