import type { HolisticRuntimeEvent } from "../../runtime-core/src/index.ts";

export interface RuntimeParseResult {
  events: HolisticRuntimeEvent[];
  remainder: string;
}

function fallbackEvent(
  sessionId: string,
  stream: "stdout" | "stderr",
  message: string
): HolisticRuntimeEvent {
  return {
    id: `${stream}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    type: stream === "stderr" ? "agent.warning" : "tool.completed",
    timestamp: new Date().toISOString(),
    severity: stream === "stderr" ? "warning" : "info",
    message,
    payload: {
      stream,
      raw: message
    }
  };
}

function normalizeEvent(sessionId: string, payload: Record<string, unknown>): HolisticRuntimeEvent {
  const type = String(payload.type ?? "tool.completed") as HolisticRuntimeEvent["type"];
  const timestamp = payload.timestamp ? String(payload.timestamp) : new Date().toISOString();

  return {
    id: payload.id ? String(payload.id) : `${type.replace(".", "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    type,
    timestamp,
    message: payload.message ? String(payload.message) : undefined,
    activity: payload.activity ? (String(payload.activity) as HolisticRuntimeEvent["activity"]) : undefined,
    severity: payload.severity ? (String(payload.severity) as HolisticRuntimeEvent["severity"]) : undefined,
    payload: payload.payload && typeof payload.payload === "object"
      ? payload.payload as Record<string, unknown>
      : payload
  };
}

export function parseRuntimeChunk(
  sessionId: string,
  stream: "stdout" | "stderr",
  chunkText: string,
  remainder = ""
): RuntimeParseResult {
  const combined = `${remainder}${chunkText}`;
  const lines = combined.split(/\r?\n/);
  const nextRemainder = lines.pop() ?? "";
  const events: HolisticRuntimeEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!parsed || typeof parsed !== "object") {
        events.push(fallbackEvent(sessionId, stream, trimmed));
        continue;
      }
      events.push(normalizeEvent(sessionId, parsed as Record<string, unknown>));
    } catch {
      events.push(fallbackEvent(sessionId, stream, trimmed));
    }
  }

  return {
    events,
    remainder: nextRemainder
  };
}
