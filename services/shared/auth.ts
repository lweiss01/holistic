import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage } from "node:http";

import { andonTokenFilePath, MIN_ANDON_TOKEN_LENGTH } from "../../src/core/andon-token.ts";

/**
 * Server side of the Andon loopback auth token. Clients only ever read the
 * token file (see src/core/andon-token.ts); creation happens here, once, when a
 * service starts.
 */

/** Routes that must stay reachable without a token so liveness probes work. */
const PUBLIC_PATHS = new Set(["/health"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/**
 * Read the existing token or mint one. The file is created with mode 0600 so
 * other users on the machine cannot read it.
 */
export function getOrCreateToken(): string {
  const file = andonTokenFilePath();

  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (existing.length >= MIN_ANDON_TOKEN_LENGTH) {
      return existing;
    }
  } catch {
    // Missing or unreadable; fall through and mint a fresh one.
  }

  const token = randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    // writeFileSync only applies mode when creating, so enforce it explicitly
    // for a pre-existing file that we just overwrote.
    fs.chmodSync(file, 0o600);
  } catch {
    // Best effort: Windows ACLs do not map onto POSIX modes.
  }
  return token;
}

/**
 * Resolve the token a service should enforce. Returns null when auth is
 * explicitly disabled, which exists for local debugging only.
 */
export function resolveServiceToken(): string | null {
  if (process.env.ANDON_REQUIRE_TOKEN === "0") {
    process.stderr.write(
      "Andon: ANDON_REQUIRE_TOKEN=0, starting without authentication. Any local process can reach this service.\n",
    );
    return null;
  }
  return getOrCreateToken();
}

/**
 * Constant-time bearer comparison. A null token means auth is disabled, so
 * every request is authorized.
 */
export function isAuthorized(request: IncomingMessage, token: string | null): boolean {
  if (!token) {
    return true;
  }

  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(header.slice("Bearer ".length).trim(), "utf8");
  const expected = Buffer.from(token, "utf8");
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}
