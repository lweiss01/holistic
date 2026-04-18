import type {
  ActiveSessionResponse,
  SessionDetailResponse,
  TimelineResponse,
  SessionRecord
} from "../../../packages/andon-core/src/index.ts";

const apiBaseUrl = import.meta.env.VITE_ANDON_API_BASE_URL ?? "http://127.0.0.1:4318";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);
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
  const response = await fetch(`${apiBaseUrl}/sessions/${encodeURIComponent(sessionId)}/callbacks/${action}`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Callback failed with ${response.status}`);
  }
}

export function getTimeline(sessionId: string): Promise<TimelineResponse> {
  return fetchJson<TimelineResponse>(`/sessions/${encodeURIComponent(sessionId)}/timeline`);
}

export function subscribeToStream(onMessage: () => void): () => void {
  const source = new EventSource(`${apiBaseUrl}/sessions/stream`);
  
  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "ping") {
        onMessage();
      }
    } catch {
      // ignore
    }
  };

  return () => source.close();
}
