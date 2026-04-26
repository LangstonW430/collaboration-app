import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withRequestLogging } from "@/lib/logging/requestLogger";

function handler(_request: NextRequest): NextResponse {
  return NextResponse.next();
}

export const middleware = withRequestLogging(handler);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
