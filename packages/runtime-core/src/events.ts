import type { RuntimeActivity } from "./types.ts";

export const HOLISTIC_RUNTIME_EVENT_TYPES = [
  "session.started",
  "session.heartbeat",
  "session.paused",
  "session.resumed",
  "session.completed",
  "session.failed",
  "session.cancelled",
  "session.terminated",
  "task.started",
  "task.updated",
  "task.completed",
  "phase.changed",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "file.changed",
  "command.started",
  "command.completed",
  "command.failed",
  "test.started",
  "test.completed",
  "test.failed",
  "input.requested",
  "input.resolved",
  "git.branch_created",
  "context.branch_changed",
  "context.environment_changed",
  "git.commit_created",
  "git.conflict_detected",
  "agent.question",
  "agent.summary",
  "agent.warning",
  "agent.blocked",
  "holistic.checkpoint",
  "telemetry.noop",
  "user.action",
  "approval.requested",
  "approval.granted",
  "approval.denied",
  "review.requested",
  "review.acknowledged"
] as const;

export const HOLISTIC_RUNTIME_EVENT_SEVERITIES = [
  "info",
  "success",
  "warning",
  "error",
  "critical"
] as const;

export const RUNTIME_EVENT_FAMILIES = [
  "session_lifecycle",
  "heartbeat",
  "task",
  "tool",
  "command",
  "file",
  "test",
  "question_input",
  "approval_review",
  "completion_termination",
  "error_blocker",
  "checkpoint",
  "summary",
  "branch_environment_context",
  "user_action",
  "noop"
] as const;

export const RUNTIME_EVENT_SIGNIFICANCE = [
  "heartbeat",
  "meaningful_activity",
  "checkpoint",
  "summary",
  "branch_environment_context",
  "user_action",
  "review_state",
  "noop"
] as const;

export type HolisticRuntimeEventType = (typeof HOLISTIC_RUNTIME_EVENT_TYPES)[number];
export type HolisticRuntimeEventSeverity = (typeof HOLISTIC_RUNTIME_EVENT_SEVERITIES)[number];
export type RuntimeEventFamily = (typeof RUNTIME_EVENT_FAMILIES)[number];
export type RuntimeEventSignificance = (typeof RUNTIME_EVENT_SIGNIFICANCE)[number];

export interface HolisticRuntimeEvent {
  id: string;
  sessionId: string;
  type: HolisticRuntimeEventType;
  timestamp: string;
  message?: string;
  activity?: RuntimeActivity;
  severity?: HolisticRuntimeEventSeverity;
  family?: RuntimeEventFamily;
  significance?: RuntimeEventSignificance;
  payload?: Record<string, unknown>;
}

const HEARTBEAT_EVENTS: ReadonlySet<HolisticRuntimeEventType> = new Set([
  "session.heartbeat"
]);

const NOOP_EVENTS: ReadonlySet<HolisticRuntimeEventType> = new Set([
  "telemetry.noop"
]);

const CHECKPOINT_EVENTS: ReadonlySet<HolisticRuntimeEventType> = new Set([
  "holistic.checkpoint"
]);

const SUMMARY_EVENTS: ReadonlySet<HolisticRuntimeEventType> = new Set([
  "agent.summary"
]);

const CONTEXT_EVENTS: ReadonlySet<HolisticRuntimeEventType> = new Set([
  "context.branch_changed",
  "context.environment_changed",
  "git.branch_created",
  "git.commit_created",
  "git.conflict_detected"
]);

const USER_ACTION_EVENTS: ReadonlySet<HolisticRuntimeEventType> = new Set([
  "user.action"
]);

const REVIEW_STATE_EVENTS: ReadonlySet<HolisticRuntimeEventType> = new Set([
  "approval.requested",
  "approval.granted",
  "approval.denied",
  "review.requested",
  "review.acknowledged"
]);

const MEANINGFUL_ACTIVITY_EVENTS: ReadonlySet<HolisticRuntimeEventType> = new Set([
  "session.started",
  "session.paused",
  "session.resumed",
  "session.completed",
  "session.failed",
  "session.cancelled",
  "session.terminated",
  "task.started",
  "task.updated",
  "task.completed",
  "phase.changed",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "file.changed",
  "command.started",
  "command.completed",
  "command.failed",
  "test.started",
  "test.completed",
  "test.failed",
  "input.requested",
  "input.resolved",
  "agent.question",
  "agent.warning",
  "agent.blocked"
]);

export function runtimeEventSignificance(type: HolisticRuntimeEventType): RuntimeEventSignificance {
  if (HEARTBEAT_EVENTS.has(type)) return "heartbeat";
  if (NOOP_EVENTS.has(type)) return "noop";
  if (CHECKPOINT_EVENTS.has(type)) return "checkpoint";
  if (SUMMARY_EVENTS.has(type)) return "summary";
  if (CONTEXT_EVENTS.has(type)) return "branch_environment_context";
  if (USER_ACTION_EVENTS.has(type)) return "user_action";
  if (REVIEW_STATE_EVENTS.has(type)) return "review_state";
  if (MEANINGFUL_ACTIVITY_EVENTS.has(type)) return "meaningful_activity";
  return "noop";
}

export function runtimeEventFamily(type: HolisticRuntimeEventType): RuntimeEventFamily {
  if (type === "session.heartbeat") return "heartbeat";
  if (type === "session.failed" || type === "agent.blocked" || type === "agent.warning") return "error_blocker";
  if (type.startsWith("session.")) {
    return type === "session.completed" || type === "session.cancelled" || type === "session.terminated"
      ? "completion_termination"
      : "session_lifecycle";
  }
  if (type.startsWith("task.") || type === "phase.changed") return "task";
  if (type.startsWith("tool.")) return "tool";
  if (type.startsWith("command.")) return "command";
  if (type.startsWith("file.")) return "file";
  if (type.startsWith("test.")) return "test";
  if (type.startsWith("input.") || type === "agent.question") return "question_input";
  if (type.startsWith("approval.") || type.startsWith("review.")) return "approval_review";
  if (type === "holistic.checkpoint") return "checkpoint";
  if (type === "agent.summary") return "summary";
  if (type.startsWith("context.") || type.startsWith("git.")) return "branch_environment_context";
  if (type === "user.action") return "user_action";
  if (type === "telemetry.noop") return "noop";
  return "session_lifecycle";
}

export function isRuntimeHeartbeatEvent(event: Pick<HolisticRuntimeEvent, "type">): boolean {
  return runtimeEventSignificance(event.type) === "heartbeat";
}

export function isRuntimeMeaningfulActivityEvent(event: Pick<HolisticRuntimeEvent, "type">): boolean {
  return runtimeEventSignificance(event.type) === "meaningful_activity";
}

export function isRuntimeSummaryEvent(event: Pick<HolisticRuntimeEvent, "type">): boolean {
  return runtimeEventSignificance(event.type) === "summary";
}
