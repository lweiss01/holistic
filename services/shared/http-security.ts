import type { IncomingMessage } from "node:http";

/**
 * Both Andon services listen on loopback with no authentication. Loopback
 * binding does not keep a browser out: any page the developer visits can issue
 * cross-origin requests to 127.0.0.1, and with a wildcard CORS policy it can
 * also read the responses. These helpers close that path by refusing requests
 * that carry a browser Origin we did not authorize, and by requiring a JSON
 * content type on request bodies so simple-form posts cannot skip preflight.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173"
];

function configuredOrigins(): string[] {
  const extra = (process.env.ANDON_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    // Non-browser clients (CLI writers, hooks, collectors, tests) send no
    // Origin. They are subject to the same loopback trust as the services.
    return true;
  }
  return configuredOrigins().includes(origin);
}

export function requestOrigin(request: IncomingMessage): string | undefined {
  const origin = request.headers.origin;
  return typeof origin === "string" && origin.length > 0 ? origin : undefined;
}

/** CORS headers for an allowed origin. Never a wildcard. */
export function corsHeaders(origin: string | undefined): Record<string, string> {
  if (!origin) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  };
}

export function hasRequestBody(request: IncomingMessage): boolean {
  const contentLength = Number(request.headers["content-length"] ?? "0");
  return Number.isFinite(contentLength) && contentLength > 0
    ? true
    : Boolean(request.headers["transfer-encoding"]);
}

/**
 * A cross-origin POST with Content-Type text/plain, form-urlencoded, or
 * multipart is a "simple request" and reaches the handler without preflight.
 * Requiring application/json forces a preflight that the origin check rejects.
 */
export function hasJsonContentType(request: IncomingMessage): boolean {
  const contentType = request.headers["content-type"];
  return typeof contentType === "string" && contentType.toLowerCase().includes("application/json");
}
