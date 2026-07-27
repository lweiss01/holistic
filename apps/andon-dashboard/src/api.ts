import type {
  AgentEvent,
  OperationalCategory,
  SessionDetailResponse,
  SignalFreshnessState,
  SessionRecord,
} from "../../../packages/andon-core/src/index.ts";

export type { AgentEvent };

/**
 * Same-origin by default so requests go through the dev server proxy, which
 * attaches the Andon loopback auth token. Talking to the API directly from the
 * browser would need that token in page JavaScript, so avoid it: an explicit
 * VITE_ANDON_API_BASE_URL only works against a service started with
 * ANDON_REQUIRE_TOKEN=0.
 */
const apiBaseUrl = import.meta.env.VITE_ANDON_API_BASE_URL ?? "/api";
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
  lastAgentSignalTimestamp: string | null;
  agentSignalAgeMs: number | null;
  runtimeProcessAlive: boolean | "unknown";
  lifecycleState:
    | "running"
    | "awaiting_assignment"
    | "waiting_input"
    | "review_ready"
    | "blocked"
    | "parked"
    | "completed"
    | "stale"
    | "unknown";
  runtimeSignal: "alive" | "stale" | "dead" | "unknown";
  operatorAttention: "none" | "assignment_needed" | "review_needed" | "input_needed" | "intervention_needed";
  primaryStatus:
    | "running"
    | "awaiting_assignment"
    | "waiting_for_review"
    | "waiting_on_human_input"
    | "needs_intervention"
    | "parked_idle"
    | "done_historical"
    | "unknown";
  actionRequired: boolean;
  actionKind: "none" | "assignment" | "input" | "intervention" | "review" | "state_check";
  actionLabel: string;
  confidence: "high" | "medium" | "low";
  operatorActivity:
    | "editing"
    | "planning"
    | "reading"
    | "testing"
    | "waiting"
    | "blocked"
    | "idle"
    | "review-ready"
    | "unknown";
  nextRecommendedOperatorAction: string;
  belongsToMissionControl: boolean;
  belongsToHistory: boolean;
}

export interface CanonicalSessionDetailResponse extends SessionDetailResponse {
  projection: MissionControlSession | null;
}

export interface AgentSessionSourceSummary {
  sourceId: string;
  sourceName: string;
  sourceType:
    | "codex"
    | "chatgpt"
    | "claude_code"
    | "cursor"
    | "aider"
    | "openhands"
    | "jules"
    | "github_copilot"
    | "gsd"
    | "symphony_runner"
    | "local_cli"
    | "file_heartbeat"
    | "http_event_source"
    | "manual"
    | "custom"
    | "unknown";
  platform: string | null;
  transport: "http_events" | "file_state" | "cli_writer" | "websocket" | "webhook" | "database" | "unknown";
  status: "connected" | "idle" | "active" | "stale" | "disconnected" | "uninstrumented" | "unknown" | "error";
  repo: string | null;
  lastSignalAt: string | null;
  lastHeartbeatAt: string | null;
  capabilities: string[];
  reason: string | null;
}

export interface AgentSignalIngestionStatus {
  status:
    | "active"
    | "idle"
    | "stale"
    | "disconnected"
    | "uninstrumented"
    | "unknown"
    | "error"
    | "no_sources_configured"
    | "historical_only";
  label: string;
  message: string;
  tone: "healthy" | "neutral" | "warning" | "critical" | "unknown";
  lastSignalAt: string | null;
  sourceCount: number;
  activeSourceCount: number;
  staleSourceCount: number;
  historicalCount: number;
}

export interface MissionControlResponse {
  generatedAt: string;
  totals: Record<OperationalCategory | "total", number>;
  sessions: MissionControlSession[];
  sources: AgentSessionSourceSummary[];
  ingestionStatus: AgentSignalIngestionStatus;
  historicalCount: number;
  lastSignalAt: string | null;
}

export function getMissionControl(): Promise<MissionControlResponse> {
  return fetchJson<MissionControlResponse>("/mission-control");
}

export function getHistory(): Promise<MissionControlResponse> {
  return fetchJson<MissionControlResponse>("/history");
}

export function getSessionDetail(sessionId: string): Promise<CanonicalSessionDetailResponse> {
  return fetchJson<CanonicalSessionDetailResponse>(`/sessions/${encodeURIComponent(sessionId)}`);
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
  raw?: unknown;
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

export interface TimelineResponse {
  sessionId: string;
  items: AgentEvent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function getTimeline(
  sessionId: string,
  options: { tail?: number } = {},
): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (options.tail !== undefined) params.set("tail", String(options.tail));
  const query = params.toString();
  return fetchJson<TimelineResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/timeline${query ? `?${query}` : ""}`,
  );
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
