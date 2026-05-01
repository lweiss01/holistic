import type {
  ActiveSessionResponse,
  FleetResponse,
  OperationalCategory,
  SessionDetailResponse,
  SignalFreshnessState,
  SessionRecord,
  TimelineResponse
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

export function getFleet(): Promise<FleetResponse> {
  return fetchJson<FleetResponse>("/fleet");
}

export interface MissionControlSession {
  session: SessionRecord;
  category: OperationalCategory;
  reason: string;
  rawRuntimeStatus: string | null;
  derivedOperationalStatus: string;
  sourceOfTruth: string;
  freshness: SignalFreshnessState;
  lastSignalTimestamp: string | null;
  signalAgeMs: number | null;
  confidence: "high" | "medium" | "low";
  nextRecommendedOperatorAction: string;
  belongsToMissionControl: boolean;
  belongsToHistory: boolean;
}

export interface MissionControlResponse {
  generatedAt: string;
  totals: Record<OperationalCategory | "total", number>;
  sessions: MissionControlSession[];
}

export function getMissionControl(): Promise<MissionControlResponse> {
  return fetchJson<MissionControlResponse>("/mission-control");
}

export function getHistory(): Promise<MissionControlResponse> {
  return fetchJson<MissionControlResponse>("/history");
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

export interface SessionReplayEvent {
  id: string;
  sessionId: string;
  type: string;
  kind: string;
  timestamp: string;
  summary: string | null;
  source: string;
  meaningful: boolean;
}

export interface SessionReplayResponse {
  sessionId: string;
  generatedAt: string;
  events: SessionReplayEvent[];
  hiddenTelemetryCount: number;
}

export function getSessionReplay(sessionId: string): Promise<SessionReplayResponse> {
  return fetchJson<SessionReplayResponse>(`/sessions/${encodeURIComponent(sessionId)}/replay`);
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

export interface AndonHealthResponse {
  ok: boolean;
  service: string;
  databasePath: string;
  envAndonDbPath: string | null;
  counts: {
    runtimeSessions: number;
    runtimeEvents: number;
    legacySessions: number;
    legacyEvents: number;
    currentOperational: number;
    historical: number;
  };
  activeSessionIds: string[];
  fleetWillRenderCards: boolean;
  runtimeDatabaseAligned: boolean | "unknown";
  warnings: string[];
}

export function getAndonHealth(): Promise<AndonHealthResponse> {
  return fetchJson<AndonHealthResponse>("/health/andon");
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
