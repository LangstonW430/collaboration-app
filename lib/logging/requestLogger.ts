// Edge-runtime compatible — no Node.js built-ins. Used by middleware.ts.
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const REQUEST_ID_HEADER = "x-request-id";

type Handler = (req: NextRequest) => NextResponse | Promise<NextResponse>;

function jsonLog(level: string, fields: Record<string, unknown>): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    ...fields,
  });
  if (level === "warn") console.warn(entry);
  else if (level === "error") console.error(entry);
  else console.log(entry);
}

/**
 * Wraps a Next.js middleware handler with structured request/response logging.
 * Attaches a request ID to the response and propagates it for downstream logs.
 */
export function withRequestLogging(handler: Handler): Handler {
  return async (request: NextRequest) => {
    const requestId =
      request.headers.get(REQUEST_ID_HEADER) ?? uuidv4();
    const start = Date.now();

    // Propagate request ID to the handler via a new request with the header set.
    const reqWithId = new NextRequest(request.url, {
      method: request.method,
      headers: (() => {
        const h = new Headers(request.headers);
        h.set(REQUEST_ID_HEADER, requestId);
        return h;
      })(),
      body: request.body,
    });

    const response = await handler(reqWithId);
    const duration = Date.now() - start;
    const path = new URL(request.url).pathname;

    jsonLog(response.status >= 500 ? "error" : "info", {
      type: "http_request",
      method: request.method,
      path,
      status: response.status,
      duration_ms: duration,
      requestId,
    });

    // Propagate the request ID so clients can correlate logs.
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  };
}
