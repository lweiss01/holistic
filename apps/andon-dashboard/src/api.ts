import type {
  ActiveSessionResponse,
  SessionDetailResponse,
  TimelineResponse,
  SessionRecord
} from "../../../packages/andon-core/src/index.ts";

const apiBaseUrl = import.meta.env.VITE_ANDON_API_BASE_URL ?? "http://127.0.0.1:4318";
const DEFAULT_FETCH_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetchWithTimeout(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getActiveSession(): Promise<ActiveSessionResponse> {
  return fetchJson<ActiveSessionResponse>("/sessions/active");
}

export function getSessionsList(): Promise<{ sessions: SessionRecord[] }> {
  return fetchJson<{ sessions: SessionRecord[] }>("/sessions");
}

export function getSessionDetail(sessionId: string): Promise<SessionDetailResponse> {
  return fetchJson<SessionDetailResponse>(`/sessions/${encodeURIComponent(sessionId)}`);
}

export async function postCallback(sessionId: string, action: "approve" | "pause" | "resume"): Promise<void> {
  const response = await fetchWithTimeout(
    `${apiBaseUrl}/sessions/${encodeURIComponent(sessionId)}/callbacks/${action}`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error(`Callback failed with ${response.status}`);
  }
}

export interface TimelineQuery {
  limit?: number;
  offset?: number;
  tail?: number;
}

export function getTimeline(sessionId: string, query?: TimelineQuery): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (query?.tail != null) {
    params.set("tail", String(query.tail));
  } else {
    if (query?.limit != null) {
      params.set("limit", String(query.limit));
    }
    if (query?.offset != null) {
      params.set("offset", String(query.offset));
    }
  }

  const qs = params.toString();
  const path = `/sessions/${encodeURIComponent(sessionId)}/timeline${qs ? `?${qs}` : ""}`;
  return fetchJson<TimelineResponse>(path);
}

export function subscribeToStream(onMessage: () => void): () => void {
  const source = new EventSource(`${apiBaseUrl}/sessions/stream`);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as { type?: string };
      if (data.type === "session_update" || data.type === "ping" || data.type === "connected") {
        onMessage();
      }
    } catch {
      // ignore
    }
  };

  return () => source.close();
}
