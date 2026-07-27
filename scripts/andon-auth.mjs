import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Reader for the Andon loopback auth token, for the plain-JS scripts that run
 * without type stripping and so cannot import src/core/andon-token.ts.
 *
 * Keep this in sync with that module; it is the canonical definition and owns
 * the same path and minimum-length rules. Only reading lives here. Creation is
 * the server's job, in services/shared/auth.ts.
 */

const MIN_TOKEN_LENGTH = 32;

export function andonTokenFilePath() {
  const override = process.env.ANDON_TOKEN_FILE?.trim();
  if (override) {
    return path.resolve(override);
  }
  return path.join(os.homedir(), ".holistic", "andon-token");
}

export function readAndonToken() {
  try {
    const value = fs.readFileSync(andonTokenFilePath(), "utf8").trim();
    return value.length >= MIN_TOKEN_LENGTH ? value : null;
  } catch {
    return null;
  }
}

/** Authorization header for the token, or an empty object when absent. */
export function andonAuthHeaders() {
  const token = readAndonToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
