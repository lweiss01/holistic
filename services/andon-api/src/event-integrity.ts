import type { AgentEvent, EventType } from "../../../packages/andon-core/src/index.ts";

export type ReplayEventKind =
  | "heartbeat_liveness"
  | "noop_telemetry"
  | "checkpoint"
  | "context_branch_change"
  | "agent_summary"
  | "meaningful_activity";

const BRANCH_SWITCH_SUMMARY = "Detected branch switch; review the new branch context.";

const HEARTBEAT_SUMMARY_PREFIXES = [
  "collector heartbeat:",
  "local runtime heartbeat.",
  "runtime heartbeat"
];

const CHECKPOINT_TYPES = new Set<string>([
  "session.checkpoint_created",
  "holistic.checkpoint"
]);

const SUMMARY_TYPES = new Set<string>([
  "agent.summary",
  "agent.summary_emitted"
]);

const HEARTBEAT_TYPES = new Set<string>([
  "session.heartbeat"
]);

const NOOP_TYPES = new Set<string>([
  "telemetry.noop",
  "session.idle_detected"
]);

const BRANCH_CONTEXT_TYPES = new Set<string>([
  "context.branch_changed"
]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function payloadText(event: AgentEvent, key: string): string {
  return text((event.payload as Record<string, unknown>)[key]);
}

function eventSummary(event: AgentEvent): string {
  return text(event.summary);
}

function looksLikeCollectorHeartbeat(event: AgentEvent): boolean {
  const summary = eventSummary(event).toLowerCase();
  return HEARTBEAT_SUMMARY_PREFIXES.some((prefix) => summary.startsWith(prefix));
}

function branchSwitchFromSummary(summary: string): { previousBranch: string | null; currentBranch: string | null } {
  const match = summary.match(/branch switch from\s+(.+?)\s+to\s+(.+?)(?:[.;]|$)/i);
  if (!match) {
    return { previousBranch: null, currentBranch: null };
  }
  return {
    previousBranch: match[1]?.trim() ?? null,
    currentBranch: match[2]?.trim() ?? null
  };
}

export function isBranchContextEvent(event: AgentEvent): boolean {
  const summary = eventSummary(event);
  const reason = payloadText(event, "reason");
  const status = payloadText(event, "status");
  const previousBranch = payloadText(event, "previousBranch");
  const currentBranch = payloadText(event, "currentBranch") || payloadText(event, "branch");

  return event.type === "context.branch_changed"
    || reason === "branch-switch"
    || summary === BRANCH_SWITCH_SUMMARY
    || status === BRANCH_SWITCH_SUMMARY
    || /branch switch/i.test(summary)
    || /branch switch/i.test(status)
    || (previousBranch.length > 0 && currentBranch.length > 0);
}

export function classifyReplayEventType(type: string): ReplayEventKind {
  if (HEARTBEAT_TYPES.has(type)) {
    return "heartbeat_liveness";
  }
  if (NOOP_TYPES.has(type)) {
    return "noop_telemetry";
  }
  if (CHECKPOINT_TYPES.has(type)) {
    return "checkpoint";
  }
  if (BRANCH_CONTEXT_TYPES.has(type)) {
    return "context_branch_change";
  }
  if (SUMMARY_TYPES.has(type)) {
    return "agent_summary";
  }
  return "meaningful_activity";
}

export function normalizeAgentEventForReplayIntegrity(event: AgentEvent): AgentEvent {
  const payload = { ...(event.payload ?? {}) } as Record<string, unknown>;
  const summary = eventSummary(event);

  if (isBranchContextEvent(event)) {
    const parsed = branchSwitchFromSummary(summary || payloadText(event, "status"));
    const previousBranch = payloadText(event, "previousBranch") || parsed.previousBranch;
    const currentBranch = payloadText(event, "currentBranch") || payloadText(event, "branch") || parsed.currentBranch;
    return {
      ...event,
      type: "context.branch_changed" as EventType,
      summary: summary || BRANCH_SWITCH_SUMMARY,
      payload: {
        ...payload,
        legacyType: event.type,
        reason: "branch-switch",
        previousBranch: previousBranch || null,
        currentBranch: currentBranch || null,
        significance: "branch_environment_context"
      }
    };
  }

  if (event.type === "session.checkpoint_created") {
    return {
      ...event,
      type: "holistic.checkpoint" as EventType,
      payload: {
        ...payload,
        legacyType: event.type,
        significance: "checkpoint"
      }
    };
  }

  if (event.type === "agent.summary_emitted" && looksLikeCollectorHeartbeat(event)) {
    return {
      ...event,
      type: "session.heartbeat" as EventType,
      payload: {
        ...payload,
        legacyType: event.type,
        significance: "heartbeat"
      }
    };
  }

  if (event.type === "session.heartbeat" || event.type === "telemetry.noop" || event.type === "holistic.checkpoint") {
    return event;
  }

  return event;
}

export function replayDeduplicationKey(event: AgentEvent): string | null {
  if (event.type !== "context.branch_changed") {
    return null;
  }

  const previousBranch = payloadText(event, "previousBranch");
  const currentBranch = payloadText(event, "currentBranch") || payloadText(event, "branch");
  if (previousBranch || currentBranch) {
    return JSON.stringify(["context.branch_changed", previousBranch || null, currentBranch || null]);
  }

  return JSON.stringify(["context.branch_changed", eventSummary(event)]);
}
