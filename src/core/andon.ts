interface AndonEventPayload {
  type: string;
  sessionId: string;
  summary?: string;
  payload?: Record<string, unknown>;
}

const pendingEvents: Promise<void>[] = [];

export function emitAndonEvent(
  event: AndonEventPayload
): void {
  if (process.env.ANDON_DISABLED === "true") {
    return;
  }

  const baseUrl = process.env.ANDON_API_BASE_URL ?? "http://127.0.0.1:4318";

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
        headers: { "Content-Type": "application/json" },
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

  pendingEvents.push(dispatch());
}

export async function flushAndonEvents(): Promise<void> {
  if (pendingEvents.length === 0) return;
  await Promise.allSettled(pendingEvents);
}
