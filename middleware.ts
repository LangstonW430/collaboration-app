import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Auth is handled client-side via useConvexAuth() in each page.
// This middleware only exists to satisfy Next.js static/image exclusions.
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
