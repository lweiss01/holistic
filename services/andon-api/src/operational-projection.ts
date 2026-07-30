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

export const OPERATIONAL_PROJECTION_FRESH_MS = 30 * 1000;
export const OPERATIONAL_PROJECTION_COLD_MS = 2 * 60 * 1000;
export const OPERATIONAL_PROJECTION_EXPIRED_MS = 10 * 60 * 1000;
export const OPERATIONAL_PROJECTION_LEGACY_HISTORY_MS = 60 * 60 * 1000;
export const OPERATIONAL_PROJECTION_REVIEW_STALE_MS = 24 * 60 * 60 * 1000;
/**
 * Ceiling on how long a needs_action or degraded_active session may keep
 * demanding operator attention. Review already aged out; needs_action and
 * degraded did not, so an abandoned "waiting for input" or "blocked" card sat on
 * Mission Control forever (observed live: a 60-day-old Needs Input card). That
 * breaks the rule that old sessions must never count as current intervention
 * work, and a board of permanent false demands is unreadable at a glance.
 *
 * Matches the review window for consistency. A session with live process proof
 * is never aged out by this: an agent legitimately waiting on a human keeps
 * heartbeating, so real waiting work cannot be hidden by it.
 */
export const OPERATIONAL_PROJECTION_ACTIONABLE_STALE_MS = 24 * 60 * 60 * 1000;

export type OperationalSourceOfTruth = "runtime" | "legacy" | "mixed" | "missing";
export type OperationalConfidence = "high" | "medium" | "low";
export type LifecycleState =
  | "running"
  | "awaiting_assignment"
  | "waiting_input"
  | "review_ready"
  | "blocked"
  | "parked"
  | "completed"
  | "stale"
  | "unknown";
export type RuntimeSignalState = "alive" | "stale" | "dead" | "unknown";
export type OperatorAttention = "none" | "assignment_needed" | "review_needed" | "input_needed" | "intervention_needed";
export type OperatorActionKind = "none" | "assignment" | "input" | "intervention" | "review" | "state_check";
export type MissionPrimaryStatus =
  | "running"
  | "awaiting_assignment"
  | "waiting_for_review"
  | "waiting_on_human_input"
  | "needs_intervention"
  | "parked_idle"
  | "done_historical"
  | "unknown";
export type OperatorActivityInsight =
  | "editing"
  | "planning"
  | "reading"
  | "testing"
  | "waiting"
  | "blocked"
  | "idle"
  | "review-ready"
  | "unknown";

export type OperationalProjectionReason =
  | "runtime_active"
  | "awaiting_assignment"
  | "waiting_for_input"
  | "awaiting_review"
  | "unacknowledged_completion"
  | "blocked_or_failed"
  | "stale_runtime"
  | "missing_runtime_signal"
  | "runtime_db_mismatch"
  | "terminated"
  | "parked"
  | "stale_review"
  | "stale_needs_action"
  | "stale_degraded"
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
  canonicalStatusHint?: "running" | "awaiting_assignment" | "needs_input" | "awaiting_review" | "parked" | "blocked" | "at_risk" | null;
  now?: Date | number | string;
  freshAfterMs?: number;
  coldAfterMs?: number;
  legacyHistoricalAfterMs?: number;
  reviewStaleAfterMs?: number;
  actionableStaleAfterMs?: number;
}

export interface OperationalProjection {
  sessionId: string;
  category: RuntimeOperationalCategory;
  reason: OperationalProjectionReason;
  rawRuntimeStatus: RuntimeStatus | "missing";
  derivedOperationalStatus:
    | "running"
    | "awaiting_assignment"
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
  lastAgentSignalTimestamp: string | null;
  agentSignalAgeMs: number | null;
  runtimeProcessAlive: boolean | "unknown";
  lifecycleState: LifecycleState;
  runtimeSignal: RuntimeSignalState;
  operatorAttention: OperatorAttention;
  primaryStatus: MissionPrimaryStatus;
  actionRequired: boolean;
  actionKind: OperatorActionKind;
  actionLabel: string;
  hasMeaningfulActivity: boolean;
  operatorActivity: OperatorActivityInsight;
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
    operatorActivity?: OperatorActivityInsight;
  }
): OperationalProjection {
  const missionControlCategories: RuntimeOperationalCategory[] = [
    "live",
    "needs_action",
    "degraded_active",
    "review",
    "unknown"
  ];
  const lifecycleState = lifecycleStateFor(fields.category, fields.reason, fields.rawRuntimeStatus, fields.freshness);
  const runtimeSignal = runtimeSignalFor(fields.freshness, input.runtimeProcessAlive);
  const operatorAttention = operatorAttentionFor(fields.category, lifecycleState, fields.reason);
  const primaryStatus = primaryStatusFor(lifecycleState, operatorAttention);
  const action = operatorActionFor(primaryStatus);
  const lastAgentSignalTimestamp = latestTimestamp([
    fields.lastHeartbeatAt,
    fields.lastMeaningfulActivityAt,
    fields.lastSignalTimestamp
  ]);
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
    lastAgentSignalTimestamp,
    agentSignalAgeMs: ageMs(lastAgentSignalTimestamp, fields.now),
    runtimeProcessAlive: input.runtimeProcessAlive ?? "unknown",
    lifecycleState,
    runtimeSignal,
    operatorAttention,
    primaryStatus,
    actionRequired: action.required,
    actionKind: action.kind,
    actionLabel: action.label,
    hasMeaningfulActivity: fields.lastMeaningfulActivityAt !== null,
    operatorActivity: fields.operatorActivity ?? operatorActivityFor(input, fields.rawRuntimeStatus, fields.category),
    confidence: fields.confidence ?? confidenceFor(fields.category, fields.reason),
    nextRecommendedOperatorAction: recommendedActionFor(fields.category, fields.reason),
    belongsOnMissionControl: missionControlCategories.includes(fields.category),
    belongsInHistory: fields.category === "historical",
    evidence: fields.evidence
  };
}

function operatorActionFor(primaryStatus: MissionPrimaryStatus): {
  required: boolean;
  kind: OperatorActionKind;
  label: string;
} {
  switch (primaryStatus) {
    case "awaiting_assignment":
      return {
        required: true,
        kind: "assignment",
        label: "Give this agent its next task or complete the session."
      };
    case "waiting_on_human_input":
      return {
        required: true,
        kind: "input",
        label: "Provide the requested input."
      };
    case "needs_intervention":
      return {
        required: true,
        kind: "intervention",
        label: "Investigate the issue."
      };
    case "waiting_for_review":
      return {
        required: true,
        kind: "review",
        label: "Review the requested output."
      };
    case "unknown":
      return {
        required: true,
        kind: "state_check",
        label: "Check session state."
      };
    case "running":
    case "parked_idle":
    case "done_historical":
      return {
        required: false,
        kind: "none",
        label: "No action needed."
      };
  }
}

function runtimeActivityInsight(activity: RuntimeSession["activity"] | undefined): OperatorActivityInsight {
  switch (activity) {
    case "planning":
    case "thinking":
      return "planning";
    case "reading":
      return "reading";
    case "editing":
    case "running_command":
      return "editing";
    case "running_tests":
      return "testing";
    case "reviewing":
      return "reading";
    case "waiting":
      return "waiting";
    case "idle":
      return "idle";
    default:
      return "unknown";
  }
}

function operatorActivityFor(
  input: OperationalProjectionInput,
  rawRuntimeStatus: RuntimeStatus | "missing",
  category: RuntimeOperationalCategory
): OperatorActivityInsight {
  if (category === "needs_action" || rawRuntimeStatus === "waiting_for_input") {
    return "waiting";
  }
  if (rawRuntimeStatus === "awaiting_assignment") {
    return "waiting";
  }
  if (category === "review" || rawRuntimeStatus === "waiting_for_approval" || rawRuntimeStatus === "awaiting_review") {
    return "review-ready";
  }
  if (category === "degraded_active" && (rawRuntimeStatus === "blocked" || rawRuntimeStatus === "failed")) {
    return "blocked";
  }
  if (category === "historical" || rawRuntimeStatus === "completed" || rawRuntimeStatus === "cancelled" || rawRuntimeStatus === "terminated" || rawRuntimeStatus === "parked") {
    return "idle";
  }
  return runtimeActivityInsight(input.runtimeSession?.activity);
}

function isChildOrPlumbingRuntimeSession(runtimeSession: RuntimeSession): boolean {
  const metadata = runtimeSession.metadata ?? {};
  const sessionKind = typeof metadata.sessionKind === "string" ? metadata.sessionKind : null;
  return metadata.topLevelWorkflow === false
    || metadata.plumbing === true
    || metadata.compatibilityMirror === true
    || ["task", "checkpoint", "artifact", "maintenance", "child_activity"].includes(sessionKind ?? "");
}

function isStaleReviewSignal(input: OperationalProjectionInput, lastSignalTimestamp: string | null, now: number): boolean {
  const reviewAge = ageMs(lastSignalTimestamp, now);
  return reviewAge !== null && reviewAge > (input.reviewStaleAfterMs ?? OPERATIONAL_PROJECTION_REVIEW_STALE_MS);
}

/**
 * Whether an attention-demanding signal has gone cold enough to be abandoned
 * rather than current work. Live process proof always wins: a session we can see
 * running is never aged out, so genuinely waiting agents stay on the board.
 */
function isStaleActionableSignal(
  input: OperationalProjectionInput,
  lastSignalTimestamp: string | null,
  now: number
): boolean {
  if (input.runtimeProcessAlive === true) {
    return false;
  }
  const age = ageMs(lastSignalTimestamp, now);
  return age !== null && age > (input.actionableStaleAfterMs ?? OPERATIONAL_PROJECTION_ACTIONABLE_STALE_MS);
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

function lifecycleStateFor(
  category: RuntimeOperationalCategory,
  reason: OperationalProjectionReason,
  rawRuntimeStatus: RuntimeStatus | "missing",
  freshness: RuntimeFreshness
): LifecycleState {
  // An aged-out card is set aside, not awaiting anything. Without this guard a
  // historical projection whose RAW status is still "waiting_for_input",
  // "awaiting_review" or "blocked" falls into the actionable branches below and
  // reports actionRequired with an operator prompt, even though it has already
  // left Mission Control.
  if (reason === "stale_review" || reason === "stale_needs_action" || reason === "stale_degraded") {
    return "parked";
  }
  if (reason === "awaiting_assignment" || rawRuntimeStatus === "awaiting_assignment") return "awaiting_assignment";
  if (category === "needs_action") return "waiting_input";
  if (category === "review") return "review_ready";
  if (rawRuntimeStatus === "waiting_for_input") return "waiting_input";
  if (rawRuntimeStatus === "waiting_for_approval" || rawRuntimeStatus === "awaiting_review") return "review_ready";
  if (rawRuntimeStatus === "blocked" || rawRuntimeStatus === "failed") return "blocked";
  if (rawRuntimeStatus === "parked" || rawRuntimeStatus === "paused") return "parked";
  if (rawRuntimeStatus === "completed" || rawRuntimeStatus === "cancelled" || rawRuntimeStatus === "terminated") return "completed";
  if ((reason === "stale_runtime" || reason === "missing_runtime_signal") && isRuntimeRunningStatus(rawRuntimeStatus) && freshness !== "unknown") return "running";
  if (reason === "stale_runtime" || reason === "missing_runtime_signal" || reason === "runtime_db_mismatch") return "stale";
  if (category === "live") return "running";
  if (category === "historical") return reason === "parked" ? "parked" : "completed";
  return "unknown";
}

function runtimeSignalFor(
  freshness: RuntimeFreshness,
  runtimeProcessAlive: boolean | "unknown" | undefined
): RuntimeSignalState {
  if (runtimeProcessAlive === false) return "dead";
  if (runtimeProcessAlive === true) {
    return freshness === "fresh" ? "alive" : "stale";
  }
  if (freshness === "stale" || freshness === "cold") return "stale";
  return "unknown";
}

function operatorAttentionFor(
  category: RuntimeOperationalCategory,
  lifecycleState: LifecycleState,
  reason: OperationalProjectionReason
): OperatorAttention {
  if (lifecycleState === "awaiting_assignment") return "assignment_needed";
  if (lifecycleState === "waiting_input" || category === "needs_action") return "input_needed";
  if (lifecycleState === "review_ready" || category === "review") return "review_needed";
  if (
    lifecycleState === "blocked"
    || reason === "blocked_or_failed"
    || reason === "runtime_db_mismatch"
    || reason === "contradictory_telemetry"
  ) {
    return "intervention_needed";
  }
  return "none";
}

function primaryStatusFor(lifecycleState: LifecycleState, operatorAttention: OperatorAttention): MissionPrimaryStatus {
  if (operatorAttention === "assignment_needed") return "awaiting_assignment";
  if (operatorAttention === "input_needed") return "waiting_on_human_input";
  if (operatorAttention === "intervention_needed") return "needs_intervention";
  if (operatorAttention === "review_needed") return "waiting_for_review";
  if (lifecycleState === "running") return "running";
  if (lifecycleState === "parked") return "parked_idle";
  if (lifecycleState === "completed") return "done_historical";
  if (lifecycleState === "stale") return "unknown";
  return "unknown";
}

function recommendedActionFor(category: RuntimeOperationalCategory, reason: OperationalProjectionReason): string {
  if (category === "live") {
    return "No action needed.";
  }
  if (category === "needs_action") {
    return reason === "awaiting_assignment"
      ? "Give this agent its next task or complete the session."
      : "Provide the requested input.";
  }
  if (category === "review") {
    return "Review the requested output.";
  }
  if (category === "degraded_active") {
    if (reason === "missing_runtime_signal" || reason === "stale_runtime" || reason === "legacy_active_without_runtime") {
      return "No action needed.";
    }
    return reason === "runtime_db_mismatch"
      ? "Investigate runtime/database mismatch"
      : "Investigate the issue.";
  }
  if (category === "historical") {
    if (reason === "stale_review") {
      return "Review aged out of Mission Control; open History if follow-up is needed.";
    }
    if (reason === "stale_needs_action" || reason === "stale_degraded") {
      return "Aged out of Mission Control as abandoned; open History if follow-up is needed.";
    }
    return "No action needed.";
  }
  return "Check session state.";
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
    if (isStaleActionableSignal(input, lastSignalTimestamp, now)) {
      return projection(input, {
        category: "historical",
        reason: "stale_needs_action",
        rawRuntimeStatus: "missing",
        derivedOperationalStatus: "historical",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt: null,
        lastMeaningfulActivityAt: null,
        now,
        evidence: ["Input-needed signal is older than the Mission Control attention window; treated as abandoned."]
      });
    }

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
    if (isStaleReviewSignal(input, lastSignalTimestamp, now)) {
      return projection(input, {
        category: "historical",
        reason: "stale_review",
        rawRuntimeStatus: "missing",
        derivedOperationalStatus: "historical",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt: null,
        lastMeaningfulActivityAt: null,
        now,
        evidence: ["Review signal is older than the Mission Control review window."]
      });
    }

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
  const lastRuntimeSignalTimestamp = latestTimestamp([
    lastHeartbeatAt,
    lastMeaningfulActivityAt,
    input.runtimeSession.terminatedAt,
    input.runtimeSession.completedAt
  ]);
  const lastSignalTimestamp = lastRuntimeSignalTimestamp
    ?? (isRuntimeRunningStatus(rawRuntimeStatus) ? null : input.runtimeSession.updatedAt);
  const freshness = freshnessFor(
    lastHeartbeatAt,
    now,
    input.freshAfterMs ?? OPERATIONAL_PROJECTION_FRESH_MS,
    input.coldAfterMs ?? OPERATIONAL_PROJECTION_COLD_MS
  );
  const evidenceBase = [`Runtime status is ${rawRuntimeStatus}.`];

  if (isChildOrPlumbingRuntimeSession(input.runtimeSession)) {
    return projection(input, {
      category: "historical",
      reason: "parked",
      rawRuntimeStatus,
      derivedOperationalStatus: "historical",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: [
        ...evidenceBase,
        "Runtime metadata marks this as child activity or telemetry plumbing, not a top-level agent workflow."
      ]
    });
  }

  if (input.canonicalStatusHint === "running" && !isRuntimeHistoricalStatus(rawRuntimeStatus)) {
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
      evidence: [
        ...evidenceBase,
        "Canonical telemetry contains fresh work-started activity; heartbeat and runtime connection remain secondary signal health."
      ]
    });
  }

  // An actionable canonical hint on a session whose telemetry has gone cold is an
  // abandoned demand, not current work. Placed after the running branch so fresh
  // work-started still wins, and excluding awaiting_review so review keeps its
  // own stale_review reason and window.
  if (
    (input.canonicalStatusHint === "needs_input"
      || input.canonicalStatusHint === "awaiting_assignment"
      || input.canonicalStatusHint === "blocked"
      || input.canonicalStatusHint === "at_risk")
    && isStaleActionableSignal(input, lastSignalTimestamp, now)
  ) {
    const degraded = input.canonicalStatusHint === "blocked" || input.canonicalStatusHint === "at_risk";
    return projection(input, {
      category: "historical",
      reason: degraded ? "stale_degraded" : "stale_needs_action",
      rawRuntimeStatus,
      derivedOperationalStatus: "historical",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: [
        ...evidenceBase,
        `Canonical ${input.canonicalStatusHint} signal is older than the Mission Control attention window and no live process proof exists.`
      ]
    });
  }

  if (isRuntimeRunningStatus(rawRuntimeStatus) && input.canonicalStatusHint === "parked") {
    return projection(input, {
      category: "historical",
      reason: "parked",
      rawRuntimeStatus,
      derivedOperationalStatus: "historical",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: [
        ...evidenceBase,
        "Canonical session status is parked; heartbeat is liveness metadata and does not make the session running."
      ]
    });
  }

  if (isRuntimeRunningStatus(rawRuntimeStatus) && input.canonicalStatusHint === "awaiting_review") {
    if (isStaleReviewSignal(input, lastSignalTimestamp, now)) {
      return projection(input, {
        category: "historical",
        reason: "stale_review",
        rawRuntimeStatus,
        derivedOperationalStatus: "historical",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [...evidenceBase, "Canonical review status is older than the Mission Control review window."]
      });
    }

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
      evidence: [
        ...evidenceBase,
        "Canonical session status is review-ready; heartbeat is liveness metadata and does not make it running."
      ]
    });
  }

  if (isRuntimeRunningStatus(rawRuntimeStatus) && input.canonicalStatusHint === "awaiting_assignment") {
    return projection(input, {
      category: "needs_action",
      reason: "awaiting_assignment",
      rawRuntimeStatus,
      derivedOperationalStatus: "awaiting_assignment",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: [
        ...evidenceBase,
        "Canonical session status is awaiting assignment; heartbeat is liveness metadata and does not make it running."
      ]
    });
  }

  if (isRuntimeRunningStatus(rawRuntimeStatus) && input.canonicalStatusHint === "needs_input") {
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
      evidence: [...evidenceBase, "Canonical session status is waiting for human input."]
    });
  }

  if (
    isRuntimeRunningStatus(rawRuntimeStatus)
    && (input.canonicalStatusHint === "blocked" || input.canonicalStatusHint === "at_risk")
  ) {
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
      evidence: [...evidenceBase, "Canonical session status requires intervention."]
    });
  }

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
      if (isStaleReviewSignal(input, lastSignalTimestamp, now)) {
        return projection(input, {
          category: "historical",
          reason: "stale_review",
          rawRuntimeStatus,
          derivedOperationalStatus: "historical",
          sourceOfTruth,
          freshness,
          lastSignalTimestamp,
          lastHeartbeatAt,
          lastMeaningfulActivityAt,
          now,
          evidence: [...evidenceBase, "Completed review signal is older than the Mission Control review window."]
        });
      }

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
    if (isStaleActionableSignal(input, lastSignalTimestamp, now)) {
      return projection(input, {
        category: "historical",
        reason: "stale_needs_action",
        rawRuntimeStatus,
        derivedOperationalStatus: "historical",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [
          ...evidenceBase,
          "Attention signal is older than the Mission Control attention window and no live process proof exists; treated as abandoned."
        ]
      });
    }

    return projection(input, {
      category: "needs_action",
      reason: rawRuntimeStatus === "awaiting_assignment" ? "awaiting_assignment" : "waiting_for_input",
      rawRuntimeStatus,
      derivedOperationalStatus: rawRuntimeStatus === "awaiting_assignment" ? "awaiting_assignment" : "needs_input",
      sourceOfTruth,
      freshness,
      lastSignalTimestamp,
      lastHeartbeatAt,
      lastMeaningfulActivityAt,
      now,
      evidence: rawRuntimeStatus === "awaiting_assignment"
        ? [...evidenceBase, "Runtime is explicitly waiting for the operator to assign the next task."]
        : [...evidenceBase, "Runtime is explicitly waiting for human input."]
    });
  }

  if (isRuntimeReviewStatus(rawRuntimeStatus) || input.reviewNeeded) {
    if (isStaleReviewSignal(input, lastSignalTimestamp, now)) {
      return projection(input, {
        category: "historical",
        reason: "stale_review",
        rawRuntimeStatus,
        derivedOperationalStatus: "historical",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [...evidenceBase, "Review signal is older than the Mission Control review window."]
      });
    }

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
    // Audit finding: a failed/blocked session used to stay degraded_active
    // forever, so terminated failures accumulated as permanent intervention work.
    if (isStaleActionableSignal(input, lastSignalTimestamp, now)) {
      return projection(input, {
        category: "historical",
        reason: "stale_degraded",
        rawRuntimeStatus,
        derivedOperationalStatus: "historical",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [
          ...evidenceBase,
          "Blocked/failed signal is older than the Mission Control attention window and no live process proof exists."
        ]
      });
    }

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
      const legacySignalAge = ageMs(lastSignalTimestamp, now);
      const coldLegacyMirror = freshness === "cold"
        || (lastHeartbeatAt === null
          && legacySignalAge !== null
          && legacySignalAge > (input.legacyHistoricalAfterMs ?? OPERATIONAL_PROJECTION_LEGACY_HISTORY_MS));
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

    const lastAgentSignalTimestamp = latestTimestamp([lastHeartbeatAt, lastMeaningfulActivityAt]);
    const lastAgentSignalAge = ageMs(lastAgentSignalTimestamp, now);
    if (
      input.runtimeProcessAlive !== true
      && lastAgentSignalAge !== null
      && lastAgentSignalAge > OPERATIONAL_PROJECTION_EXPIRED_MS
    ) {
      return projection(input, {
        category: "historical",
        reason: "parked",
        rawRuntimeStatus,
        derivedOperationalStatus: "historical",
        sourceOfTruth,
        freshness,
        lastSignalTimestamp,
        lastHeartbeatAt,
        lastMeaningfulActivityAt,
        now,
        evidence: [...evidenceBase, "Runtime signal is expired and no live process proof exists."]
      });
    }

    if (
      input.runtimeProcessAlive !== true
      && lastMeaningfulActivityAt
      && lastAgentSignalAge !== null
      && lastAgentSignalAge <= OPERATIONAL_PROJECTION_COLD_MS
    ) {
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
        evidence: [
          ...evidenceBase,
          "Fresh runtime activity is direct agent-session telemetry; heartbeat/runtime connection is shown as secondary signal health."
        ]
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

    if (freshness === "cold") {
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
        evidence: [...evidenceBase, "Runtime heartbeat is too old for running status."]
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
        ? [...evidenceBase, "Recent heartbeat proves liveness; meaningful activity is tracked separately."]
        : [...evidenceBase, "Recent heartbeat proves liveness; no meaningful activity is implied."]
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
