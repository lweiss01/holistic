import { andonAuthHeaders } from './andon-token.ts';

interface AndonEventPayload {
  type: string;
  sessionId: string;
  summary?: string;
  payload?: Record<string, unknown>;
}

/**
 * In-flight dispatches awaited by flushAndonEvents.
 *
 * flushAndonEvents is only called from the CLI, which exits afterwards. The
 * daemon and the MCP server are long-lived and emit on every checkpoint, so
 * without self-removal this array grew for the life of the process. Entries
 * remove themselves on settle, and the cap bounds a pathological backlog when
 * the API is unreachable and dispatches are slow to time out.
 */
const pendingEvents: Promise<void>[] = [];
const MAX_PENDING_EVENTS = 100;

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "::1", "[::1]", "localhost", "0.0.0.0"]);

/**
 * Resolve the Andon endpoint, refusing to send anywhere but loopback.
 *
 * Events carry the session objective, latest status, agent name, and branch:
 * a readable summary of what is being built. ANDON_API_BASE_URL previously
 * accepted any host with no restriction, and delivery failures were invisible
 * unless ANDON_DEBUG was set, so pointing it at a remote host silently
 * exfiltrated every checkpoint. Set ANDON_ALLOW_REMOTE=1 to opt in.
 *
 * Returns null when the destination is not permitted, in which case no request
 * is made. The warning is unconditional because silence is the failure mode
 * worth being loud about.
 */
export function resolveAndonBaseUrl(): string | null {
  const raw = process.env.ANDON_API_BASE_URL ?? "http://127.0.0.1:4318";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    process.stderr.write(`Holistic: ignoring malformed ANDON_API_BASE_URL (${raw}).\n`);
    return null;
  }

  if (!LOOPBACK_HOSTNAMES.has(url.hostname) && process.env.ANDON_ALLOW_REMOTE !== "1") {
    process.stderr.write(
      `Holistic: refusing to send session data to non-loopback host ${url.hostname}. `
      + "Set ANDON_ALLOW_REMOTE=1 to override.\n",
    );
    return null;
  }

  return raw.replace(/\/$/, "");
}

const TRUTHY_FLAG_VALUES = new Set(["true", "1", "yes", "on"]);

function isTruthyFlag(value: string | undefined): boolean {
  return value != null && TRUTHY_FLAG_VALUES.has(value.trim().toLowerCase());
}

/**
 * Detect a test runner without asking the runner to cooperate.
 *
 * The suite exercises CLI, checkpoint, and handoff paths, all of which emit.
 * Because emission defaulted to on and only suppressed on the exact string
 * "true", every full test run injected fixture sessions ("First objective",
 * "Handoff traversal probe", agent "codex") into the operator's real Andon
 * database - hundreds of rows polluting the live board. The runner now sets
 * the flags explicitly, but a heuristic backstop keeps a stray `node --test`
 * or a test file run directly from writing to live state.
 */
function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "test"
    || isTruthyFlag(process.env.HOLISTIC_TEST_MODE)
    || process.env.NODE_TEST_CONTEXT != null
    || process.env.VITEST != null
    || process.env.JEST_WORKER_ID != null
  );
}

/**
 * Why emission is suppressed, or null when events may be sent.
 *
 * ANDON_ALLOW_TEST_EMIT=1 is the opt-in for tests that assert on dispatch
 * behavior itself; an explicit ANDON_DISABLED still wins over it.
 */
export function andonSuppressionReason(): string | null {
  if (isTruthyFlag(process.env.ANDON_DISABLED)) {
    return "ANDON_DISABLED";
  }
  if (isTruthyFlag(process.env.ANDON_ALLOW_TEST_EMIT)) {
    return null;
  }
  if (isTestEnvironment()) {
    return "test environment";
  }
  return null;
}

export function emitAndonEvent(
  event: AndonEventPayload
): void {
  const suppressed = andonSuppressionReason();
  if (suppressed) {
    if (process.env.ANDON_DEBUG === "true") {
      console.warn(`Andon event suppressed (${suppressed}): ${event.type}`);
    }
    return;
  }

  const baseUrl = resolveAndonBaseUrl();
  if (!baseUrl) {
    return;
  }

  const fullEvent = {
    ...event,
    id: `cli-sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source: "system",
    timestamp: new Date().toISOString()
  };

  const dispatch = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const result = await fetch(`${baseUrl}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...andonAuthHeaders() },
        body: JSON.stringify({ events: [fullEvent] }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!result.ok && process.env.ANDON_DEBUG === "true") {
        console.warn(`Andon API dropped event with status: ${result.status}`);
      }
    } catch (err) {
      if (process.env.ANDON_DEBUG === "true") {
        console.warn(`Andon API connection failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  if (pendingEvents.length >= MAX_PENDING_EVENTS) {
    pendingEvents.shift();
  }

  const inFlight: Promise<void> = dispatch().finally(() => {
    const index = pendingEvents.indexOf(inFlight);
    if (index !== -1) {
      pendingEvents.splice(index, 1);
    }
  });
  pendingEvents.push(inFlight);
}

/** Test seam: number of dispatches still in flight. */
export function pendingAndonEventCount(): number {
  return pendingEvents.length;
}

export async function flushAndonEvents(): Promise<void> {
  if (pendingEvents.length === 0) return;
  await Promise.allSettled(pendingEvents);
  pendingEvents.length = 0;
}
