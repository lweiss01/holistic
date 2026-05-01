import type {
  HolisticRuntimeEvent,
  RuntimeFreshness,
  RuntimeOperationalCategory,
  RuntimeSession,
  RuntimeStatus
} from "../../../packages/runtime-core/src/index.ts";
import {
  isRuntimeDegradedStatus,
  isRuntimeHeartbeatEvent,
  isRuntimeHistoricalStatus,
  isRuntimeMeaningfulActivityEvent,
  isRuntimeNeedsActionStatus,
  isRuntimeReviewStatus,
  isRuntimeRunningStatus
} from "../../../packages/runtime-core/src/index.ts";

export const OPERATIONAL_PROJECTION_FRESH_MS = 5 * 60 * 1000;
export const OPERATIONAL_PROJECTION_COLD_MS = 20 * 60 * 1000;
export const OPERATIONAL_PROJECTION_LEGACY_HISTORY_MS = 60 * 60 * 1000;

export type OperationalSourceOfTruth = "runtime" | "legacy" | "mixed" | "missing";
export type OperationalConfidence = "high" | "medium" | "low";

export type OperationalProjectionReason =
  | "runtime_active"
  | "waiting_for_input"
  | "awaiting_review"
  | "unacknowledged_completion"
  | "blocked_or_failed"
  | "stale_runtime"
  | "missing_runtime_signal"
  | "runtime_db_mismatch"
  | "terminated"
  | "parked"
  | "stale_legacy_only"
  | "legacy_active_without_runtime"
  | "contradictory_telemetry"
  | "insufficient_evidence";

export interface OperationalLegacySessionInput {
  id: string;
  status?: string | null;
  endedAt?: string | null;
  lastEventAt?: string | null;
  appearsActive?: boolean;
}

export interface OperationalProjectionInput {
  sessionId: string;
  runtimeSession?: RuntimeSession | null;
  runtimeEvents?: HolisticRuntimeEvent[];
  legacySession?: OperationalLegacySessionInput | null;
  sourceOfTruth?: OperationalSourceOfTruth;
  runtimeProcessAlive?: boolean | "unknown";
  runtimeDbMismatch?: boolean;
  humanInputNeeded?: boolean;
  reviewNeeded?: boolean;
  completedAcknowledged?: boolean;
  now?: Date | number | string;
  freshAfterMs?: number;
  coldAfterMs?: number;
  legacyHistoricalAfterMs?: number;
}

export interface OperationalProjection {
  sessionId: string;
  category: RuntimeOperationalCategory;
  reason: OperationalProjectionReason;
  rawRuntimeStatus: RuntimeStatus | "missing";
  derivedOperationalStatus:
    | "running"
    | "needs_input"
    | "awaiting_review"
    | "degraded"
    | "historical"
    | "unknown";
  sourceOfTruth: OperationalSourceOfTruth;
  freshness: RuntimeFreshness;
  lastSignalTimestamp: string | null;
  signalAgeMs: number | null;
  lastHeartbeatAt: string | null;
  heartbeatAgeMs: number | null;
  lastMeaningfulActivityAt: string | null;
  meaningfulActivityAgeMs: number | null;
  hasMeaningfulActivity: boolean;
  confidence: OperationalConfidence;
  nextRecommendedOperatorAction: string;
  belongsOnMissionControl: boolean;
  belongsInHistory: boolean;
  evidence: string[];
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function normalizeNow(value: Date | number | string | undefined): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return parseTime(value) ?? Date.now();
  }
  return Date.now();
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  let latest: { value: string; time: number } | null = null;
  for (const value of values) {
    const time = parseTime(value);
    if (value && time !== null && (!latest || time > latest.time)) {
      latest = { value, time };
    }
  }
  return latest?.value ?? null;
}

function ageMs(timestamp: string | null, now: number): number | null {
  const time = parseTime(timestamp);
  if (time === null) {
    return null;
  }
  return Math.max(0, now - time);
}

function freshnessFor(timestamp: string | null, now: number, freshAfterMs: number, coldAfterMs: number): RuntimeFreshness {
  const age = ageMs(timestamp, now);
  if (age === null) {
    return "unknown";
  }
  if (age <= freshAfterMs) {
    return "fresh";
  }
  if (age <= coldAfterMs) {
    return "stale";
  }
  return "cold";
}

function inferSourceOfTruth(input: OperationalProjectionInput): OperationalSourceOfTruth {
  if (!input.runtimeSession) {
    return input.legacySession ? "legacy" : "missing";
  }
  const metadata = input.runtimeSession.metadata;
  if (metadata?.andonIngestMirror === true || metadata?.source === "andon.ingest.mirror") {
    return "mixed";
  }
  return input.legacySession ? "mixed" : "runtime";
}

function meaningfulActivityTimestamp(
  runtimeSession: RuntimeSession | null | undefined,
  runtimeEvents: HolisticRuntimeEvent[]
): string | null {
  return latestTimestamp([
    runtimeSession?.lastMeaningfulActivityAt,
    ...runtimeEvents
      .filter((event) => isRuntimeMeaningfulActivityEvent(event))
      .map((event) => event.timestamp)
  ]);
}

function heartbeatTimestamp(
  runtimeSession: RuntimeSession | null | undefined,
  runtimeEvents: HolisticRuntimeEvent[]
): string | null {
  return latestTimestamp([
    runtimeSession?.lastHeartbeatAt,
    ...runtimeEvents
      .filter((event) => isRuntimeHeartbeatEvent(event))
      .map((event) => event.timestamp)
  ]);
}

function projection(
  input: OperationalProjectionInput,
  fields: {
    category: RuntimeOperationalCategory;
    reason: OperationalProjectionReason;
    rawRuntimeStatus: RuntimeStatus | "missing";
    derivedOperationalStatus: OperationalProjection["derivedOperationalStatus"];
    sourceOfTruth: OperationalSourceOfTruth;
    freshness: RuntimeFreshness;
    lastSignalTimestamp: string | null;
    lastHeartbeatAt: string | null;
    lastMeaningfulActivityAt: string | null;
    now: number;
    evidence: string[];
    confidence?: OperationalConfidence;
  }
): OperationalProjection {
  const missionControlCategories: RuntimeOperationalCategory[] = [
    "live",
    "needs_action",
    "degraded_active",
    "review",
    "unknown"
  ];
  return {
    sessionId: input.sessionId,
    category: fields.category,
    reason: fields.reason,
    rawRuntimeStatus: fields.rawRuntimeStatus,
    derivedOperationalStatus: fields.derivedOperationalStatus,
    sourceOfTruth: fields.sourceOfTruth,
    freshness: fields.freshness,
    lastSignalTimestamp: fields.lastSignalTimestamp,
    signalAgeMs: ageMs(fields.lastSignalTimestamp, fields.now),
    lastHeartbeatAt: fields.lastHeartbeatAt,
    heartbeatAgeMs: ageMs(fields.lastHeartbeatAt, fields.now),
    lastMeaningfulActivityAt: fields.lastMeaningfulActivityAt,
    meaningfulActivityAgeMs: ageMs(fields.lastMeaningfulActivityAt, fields.now),
    hasMeaningfulActivity: fields.lastMeaningfulActivityAt !== null,
    confidence: fields.confidence ?? confidenceFor(fields.category, fields.reason),
    nextRecommendedOperatorAction: recommendedActionFor(fields.category, fields.reason),
    belongsOnMissionControl: missionControlCategories.includes(fields.category),
    belongsInHistory: fields.category === "historical",
    evidence: fields.evidence
  };
}

function confidenceFor(category: RuntimeOperationalCategory, reason: OperationalProjectionReason): OperationalConfidence {
  if (category === "unknown") {
    return "low";
  }
  if (reason === "missing_runtime_signal" || reason === "stale_runtime" || reason === "legacy_active_without_runtime") {
    return "medium";
  }
  return "high";
}

function recommendedActionFor(category: RuntimeOperationalCategory, reason: OperationalProjectionReason): string {
  if (category === "live") {
    return "Monitor active runtime";
  }
  if (category === "needs_action") {
    return "Answer requested input";
  }
  if (category === "review") {
    return "Review or approve session output";
  }
  if (category === "degraded_active") {
    return reason === "runtime_db_mismatch"
      ? "Investigate runtime/database mismatch"
      : "Investigate runtime telemetry";
  }
  if (category === "historical") {
    return "No live operator action";
  }
  return "Inspect source data before acting";
}

function legacyProjection(input: OperationalProjectionInput, now: number): OperationalProjection {
  const sourceOfTruth = inferSourceOfTruth(input);
  const lastSignalTimestamp = latestTimestamp([
    input.legacySession?.endedAt,
    input.legacySession?.lastEventAt
  ]);
  const freshness = freshnessFor(
    lastSignalTimestamp,
    now,
    input.freshAfterMs ?? OPERATIONAL_PROJECTION_FRESH_MS,
    input.coldAfterMs ?? OPERATIONAL_PROJECTION_COLD_MS
  );
  const legacyHistoricalAfterMs = input.legacyHistoricalAfterMs ?? OPERATIONAL_PROJECTION_LEGACY_HISTORY_MS;
  const legacyAge = ageMs(lastSignalTimestamp, now);
  const terminalLegacy = Boolean(input.legacySession?.endedAt)
    || ["completed", "cancelled", "terminated", "ended", "parked"].includes(input.legacySession?.status ?? "");

  if (terminalLegacy || (legacyAge !== null && legacyAge > legacyHistoricalAfterMs && !input.legacySession?.appearsActive)) {
    return projection(input, {
      category: "historical",
      reason: terminalLegacy ? "terminated" : "stale_legacy_only",
      rawRuntimeStatus: "missing",
      derivedOperationalStatus: "historical",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt: null,
      lastMeaningfulActivityAt: null,
      now,
      evidence: ["No runtime session exists; legacy session is terminal or cold."]
    });
  }

  if (input.humanInputNeeded || input.legacySession?.status === "waiting_for_input") {
    return projection(input, {
      category: "needs_action",
      reason: "waiting_for_input",
      rawRuntimeStatus: "missing",
      derivedOperationalStatus: "needs_input",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt: null,
      lastMeaningfulActivityAt: null,
      now,
      evidence: ["Explicit input-needed signal is present without runtime liveness."]
    });
  }

  if (input.reviewNeeded || input.legacySession?.status === "waiting_for_approval" || input.legacySession?.status === "awaiting_review") {
    return projection(input, {
      category: "review",
      reason: "awaiting_review",
      rawRuntimeStatus: "missing",
      derivedOperationalStatus: "awaiting_review",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt: null,
      lastMeaningfulActivityAt: null,
      now,
      evidence: ["Explicit review-needed signal is present without runtime liveness."]
    });
  }

  return projection(input, {
    category: "unknown",
    reason: input.legacySession?.appearsActive ? "legacy_active_without_runtime" : "insufficient_evidence",
    rawRuntimeStatus: "missing",
    derivedOperationalStatus: "unknown",
    sourceOfTruth,
    freshness,
    lastSignalTimestamp,
    lastHeartbeatAt: null,
    lastMeaningfulActivityAt: null,
    now,
    evidence: input.legacySession?.appearsActive
      ? ["Legacy session appears active, but no runtime truth exists."]
      : ["No runtime truth is available."]
  });
}

export function projectOperationalSession(input: OperationalProjectionInput): OperationalProjection {
  const now = normalizeNow(input.now);
  const runtimeEvents = input.runtimeEvents ?? [];
  const sourceOfTruth = input.sourceOfTruth ?? inferSourceOfTruth(input);

  if (!input.runtimeSession) {
    return legacyProjection({ ...input, sourceOfTruth }, now);
  }

  const rawRuntimeStatus = input.runtimeSession.status;
  const lastHeartbeatAt = heartbeatTimestamp(input.runtimeSession, runtimeEvents);
  const lastMeaningfulActivityAt = meaningfulActivityTimestamp(input.runtimeSession, runtimeEvents);
  const lastSignalTimestamp = latestTimestamp([
    lastHeartbeatAt,
    lastMeaningfulActivityAt,
    input.runtimeSession.terminatedAt,
    input.runtimeSession.completedAt,
    input.runtimeSession.updatedAt
  ]);
  const freshness = freshnessFor(
    lastHeartbeatAt,
    now,
    input.freshAfterMs ?? OPERATIONAL_PROJECTION_FRESH_MS,
    input.coldAfterMs ?? OPERATIONAL_PROJECTION_COLD_MS
  );
  const evidenceBase = [`Runtime status is ${rawRuntimeStatus}.`];

  if (input.runtimeSession.completedAt && isRuntimeRunningStatus(rawRuntimeStatus)) {
    return projection(input, {
      category: "unknown",
      reason: "contradictory_telemetry",
      rawRuntimeStatus,
      derivedOperationalStatus: "unknown",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: [...evidenceBase, "Session has a completion timestamp while runtime status still looks active."]
    });
  }

  if (isRuntimeHistoricalStatus(rawRuntimeStatus) || rawRuntimeStatus === "paused") {
    if (rawRuntimeStatus === "completed" && input.completedAcknowledged !== true) {
      return projection(input, {
        category: "review",
        reason: "unacknowledged_completion",
        rawRuntimeStatus,
        derivedOperationalStatus: "awaiting_review",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [...evidenceBase, "Completed session remains review-visible until acknowledged."]
      });
    }

    return projection(input, {
      category: "historical",
      reason: rawRuntimeStatus === "parked" || rawRuntimeStatus === "paused" ? "parked" : "terminated",
      rawRuntimeStatus,
      derivedOperationalStatus: "historical",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: evidenceBase
    });
  }

  if (isRuntimeNeedsActionStatus(rawRuntimeStatus) || input.humanInputNeeded) {
    return projection(input, {
      category: "needs_action",
      reason: "waiting_for_input",
      rawRuntimeStatus,
      derivedOperationalStatus: "needs_input",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: [...evidenceBase, "Runtime is explicitly waiting for human input."]
    });
  }

  if (isRuntimeReviewStatus(rawRuntimeStatus) || input.reviewNeeded) {
    return projection(input, {
      category: "review",
      reason: "awaiting_review",
      rawRuntimeStatus,
      derivedOperationalStatus: "awaiting_review",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: [...evidenceBase, "Runtime is explicitly waiting for review or approval."]
    });
  }

  if (isRuntimeDegradedStatus(rawRuntimeStatus)) {
    return projection(input, {
      category: "degraded_active",
      reason: "blocked_or_failed",
      rawRuntimeStatus,
      derivedOperationalStatus: "degraded",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: [...evidenceBase, "Runtime reports blocked or failed state."]
    });
  }

  if (isRuntimeRunningStatus(rawRuntimeStatus)) {
    if (sourceOfTruth !== "runtime") {
      const coldLegacyMirror = freshness === "cold";
      return projection(input, {
        category: coldLegacyMirror ? "historical" : "degraded_active",
        reason: coldLegacyMirror ? "stale_legacy_only" : "missing_runtime_signal",
        rawRuntimeStatus,
        derivedOperationalStatus: coldLegacyMirror ? "historical" : "degraded",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [...evidenceBase, "Active-looking row is not backed by direct runtime truth."]
      });
    }

    if (input.runtimeDbMismatch) {
      return projection(input, {
        category: "degraded_active",
        reason: "runtime_db_mismatch",
        rawRuntimeStatus,
        derivedOperationalStatus: "degraded",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [...evidenceBase, "Runtime and database telemetry disagree."]
      });
    }

    if (input.runtimeProcessAlive !== true) {
      return projection(input, {
        category: "degraded_active",
        reason: "missing_runtime_signal",
        rawRuntimeStatus,
        derivedOperationalStatus: "degraded",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [...evidenceBase, "No live process proof is available for the runtime session."]
      });
    }

    if (!lastHeartbeatAt) {
      return projection(input, {
        category: "degraded_active",
        reason: "missing_runtime_signal",
        rawRuntimeStatus,
        derivedOperationalStatus: "degraded",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [...evidenceBase, "No heartbeat exists; activity or branch context cannot prove liveness."]
      });
    }

    if (freshness !== "fresh") {
      return projection(input, {
        category: "degraded_active",
        reason: "stale_runtime",
        rawRuntimeStatus,
        derivedOperationalStatus: "degraded",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [...evidenceBase, "Runtime heartbeat is not fresh enough for healthy live status."]
      });
    }

    return projection(input, {
      category: "live",
      reason: "runtime_active",
      rawRuntimeStatus,
      derivedOperationalStatus: "running",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: lastMeaningfulActivityAt
        ? [...evidenceBase, "Fresh heartbeat proves liveness; meaningful activity is tracked separately."]
        : [...evidenceBase, "Fresh heartbeat proves liveness; no meaningful activity is implied."]
    });
  }

  return projection(input, {
    category: "unknown",
    reason: "insufficient_evidence",
    rawRuntimeStatus,
    derivedOperationalStatus: "unknown",
    sourceOfTruth,
    freshness,
    lastSignalTimestamp,
    lastHeartbeatAt,
    lastMeaningfulActivityAt,
    now,
    evidence: [...evidenceBase, "Runtime status is not mapped to an operational category."]
  });
}
