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

export function emitAndonEvent(
  event: AndonEventPayload
): void {
  if (process.env.ANDON_DISABLED === "true") {
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
