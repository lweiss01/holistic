import type { RuntimeActivity } from "./types.ts";

export const HOLISTIC_RUNTIME_EVENT_TYPES = [
  "session.started",
  "session.heartbeat",
  "session.paused",
  "session.resumed",
  "session.completed",
  "session.failed",
  "session.cancelled",
  "task.started",
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
  "git.branch_created",
  "git.commit_created",
  "git.conflict_detected",
  "agent.question",
  "agent.warning",
  "agent.blocked",
  "approval.requested",
  "approval.granted",
  "approval.denied"
] as const;

export const HOLISTIC_RUNTIME_EVENT_SEVERITIES = [
  "info",
  "success",
  "warning",
  "error",
  "critical"
] as const;

export type HolisticRuntimeEventType = (typeof HOLISTIC_RUNTIME_EVENT_TYPES)[number];
export type HolisticRuntimeEventSeverity = (typeof HOLISTIC_RUNTIME_EVENT_SEVERITIES)[number];

export interface HolisticRuntimeEvent {
  id: string;
  sessionId: string;
  type: HolisticRuntimeEventType;
  timestamp: string;
  message?: string;
  activity?: RuntimeActivity;
  severity?: HolisticRuntimeEventSeverity;
  payload?: Record<string, unknown>;
}
