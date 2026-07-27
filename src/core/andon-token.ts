import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Shared location of the Andon loopback auth token.
 *
 * The Andon services listen on 127.0.0.1 with no user accounts. Loopback plus
 * an origin check keeps browsers out, but any process that can open a socket
 * can still reach them, so mutating routes require a bearer token. The token is
 * a file readable only by its owner: a process running as the same user can
 * read it, which is accepted, but another user on a shared machine cannot.
 *
 * This module lives in src/ because the shipped CLI emits events and therefore
 * needs to read the token. The services import it so both sides resolve the
 * same path. Creation lives on the server side, in services/shared/auth.ts.
 */
export function andonTokenFilePath(): string {
  const override = process.env.ANDON_TOKEN_FILE?.trim();
  if (override) {
    return path.resolve(override);
  }
  return path.join(os.homedir(), ".holistic", "andon-token");
}

/** Minimum length for a value to be accepted as a token rather than junk. */
export const MIN_ANDON_TOKEN_LENGTH = 32;

/** Read the token, or null when it is absent, unreadable, or implausible. */
export function readAndonToken(): string | null {
  try {
    const value = fs.readFileSync(andonTokenFilePath(), "utf8").trim();
    return value.length >= MIN_ANDON_TOKEN_LENGTH ? value : null;
  } catch {
    return null;
  }
}

/** Authorization header value for a token, or an empty object when absent. */
export function andonAuthHeaders(): Record<string, string> {
  const token = readAndonToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
