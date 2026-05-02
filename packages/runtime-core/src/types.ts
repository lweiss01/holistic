export const RUNTIME_IDS = [
  "local",
  "codex",
  "chatgpt",
  "claude-code",
  "claude_code",
  "cursor",
  "aider",
  "openharness",
  "openhands",
  "jules",
  "github_copilot",
  "gsd",
  "symphony_runner",
  "local_cli",
  "file_heartbeat",
  "custom"
] as const;

export const RUNTIME_STATUSES = [
  "starting",
  "running",
  "paused",
  "waiting_for_input",
  "waiting_for_approval",
  "awaiting_review",
  "blocked",
  "failed",
  "completed",
  "cancelled",
  "terminated",
  "parked",
  "unknown"
] as const;

export const RUNTIME_ACTIVITIES = [
  "planning",
  "reading",
  "editing",
  "running_command",
  "running_tests",
  "reviewing",
  "thinking",
  "waiting",
  "idle",
  "unknown"
] as const;

export type RuntimeId = (typeof RUNTIME_IDS)[number];
export type RuntimeStatus = (typeof RUNTIME_STATUSES)[number];
export type RuntimeActivity = (typeof RUNTIME_ACTIVITIES)[number];

export const RUNTIME_LIFECYCLE_STATES = [
  "not_started",
  "starting",
  "active",
  "waiting",
  "review",
  "completed",
  "failed",
  "cancelled",
  "terminated",
  "parked",
  "unknown"
] as const;

export const RUNTIME_FRESHNESS_STATES = [
  "fresh",
  "stale",
  "cold",
  "unknown"
] as const;

export const RUNTIME_OPERATIONAL_CATEGORIES = [
  "live",
  "needs_action",
  "degraded_active",
  "review",
  "historical",
  "unknown"
] as const;

export const RUNTIME_RUNNING_STATUSES = ["starting", "running"] as const;
export const RUNTIME_NEEDS_ACTION_STATUSES = ["waiting_for_input"] as const;
export const RUNTIME_REVIEW_STATUSES = ["waiting_for_approval", "awaiting_review"] as const;
export const RUNTIME_HISTORICAL_STATUSES = ["completed", "cancelled", "terminated", "parked"] as const;
export const RUNTIME_DEGRADED_STATUSES = ["blocked", "failed"] as const;

export type RuntimeLifecycleState = (typeof RUNTIME_LIFECYCLE_STATES)[number];
export type RuntimeFreshness = (typeof RUNTIME_FRESHNESS_STATES)[number];
export type RuntimeOperationalCategory = (typeof RUNTIME_OPERATIONAL_CATEGORIES)[number];

export interface RuntimeTaskInput {
  repoPath: string;
  repoName: string;
  branch?: string;
  worktreePath?: string;
  prompt: string;
  agentName: string;
  runtimeId: RuntimeId;
  constraints?: string[];
  contextFiles?: string[];
  metadata?: Record<string, unknown>;
}

export interface RuntimeSession {
  id: string;
  runtimeId: RuntimeId;
  agentName: string;
  repoName: string;
  repoPath: string;
  worktreePath?: string;
  branch?: string;
  status: RuntimeStatus;
  lifecycle?: RuntimeLifecycleState;
  activity: RuntimeActivity;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  terminatedAt?: string;
  lastHeartbeatAt?: string;
  lastMeaningfulActivityAt?: string;
  pid?: number;
  metadata?: Record<string, unknown>;
}

export interface RuntimeFreshnessSnapshot {
  freshness: RuntimeFreshness;
  lastHeartbeatAt: string | null;
  lastMeaningfulActivityAt: string | null;
  heartbeatAgeMs: number | null;
  meaningfulActivityAgeMs: number | null;
}

export interface RuntimeAndonTrustSnapshot {
  sessionId: string;
  runtimeId: RuntimeId | "unknown";
  rawStatus: RuntimeStatus | "missing";
  runtimeExists: boolean;
  processAlive: boolean | "unknown";
  freshness: RuntimeFreshness;
  lastHeartbeatAt: string | null;
  lastMeaningfulActivityAt: string | null;
  telemetryMissing: boolean;
  sourceOfTruth: "runtime" | "legacy" | "mixed" | "missing";
}

export interface MinimumAndonEventContract {
  trustLiveRequires: readonly string[];
  markInputNeededRequires: readonly string[];
  markReviewNeededRequires: readonly string[];
  markHistoricalRequires: readonly string[];
  missingTelemetryBehavior: RuntimeOperationalCategory;
}

export const MINIMUM_ANDON_EVENT_CONTRACT: MinimumAndonEventContract = {
  trustLiveRequires: [
    "runtime session record",
    "raw status starting or running",
    "known-live runtime process or equivalent adapter liveness proof",
    "fresh heartbeat",
    "fresh or recent meaningful activity",
    "no terminal, review, input-waiting, blocked, or failed status"
  ],
  markInputNeededRequires: [
    "raw status waiting_for_input",
    "question or input-request event with unresolved state"
  ],
  markReviewNeededRequires: [
    "raw status waiting_for_approval or awaiting_review",
    "approval/review request event or unacknowledged completion signal"
  ],
  markHistoricalRequires: [
    "raw status completed, cancelled, terminated, or parked",
    "acknowledged completion or terminal lifecycle timestamp"
  ],
  missingTelemetryBehavior: "unknown"
};

function includesRuntimeStatus<T extends readonly RuntimeStatus[]>(values: T, status: RuntimeStatus): status is T[number] {
  return (values as readonly RuntimeStatus[]).includes(status);
}

export function isRuntimeRunningStatus(status: RuntimeStatus): boolean {
  return includesRuntimeStatus(RUNTIME_RUNNING_STATUSES, status);
}

export function isRuntimeNeedsActionStatus(status: RuntimeStatus): boolean {
  return includesRuntimeStatus(RUNTIME_NEEDS_ACTION_STATUSES, status);
}

export function isRuntimeReviewStatus(status: RuntimeStatus): boolean {
  return includesRuntimeStatus(RUNTIME_REVIEW_STATUSES, status);
}

export function isRuntimeHistoricalStatus(status: RuntimeStatus): boolean {
  return includesRuntimeStatus(RUNTIME_HISTORICAL_STATUSES, status);
}

export function isRuntimeDegradedStatus(status: RuntimeStatus): boolean {
  return includesRuntimeStatus(RUNTIME_DEGRADED_STATUSES, status);
}

export function runtimeSessionCanBeTrustedAsLive(snapshot: RuntimeAndonTrustSnapshot): boolean {
  return snapshot.runtimeExists
    && snapshot.sourceOfTruth === "runtime"
    && snapshot.processAlive === true
    && snapshot.telemetryMissing === false
    && snapshot.freshness === "fresh"
    && snapshot.lastHeartbeatAt !== null
    && snapshot.rawStatus !== "missing"
    && isRuntimeRunningStatus(snapshot.rawStatus);
}
