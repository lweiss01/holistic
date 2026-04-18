import type { AgentEvent, EventType, SessionPhase } from "../../../packages/andon-core/src/index.ts";

interface OpenHarnessAdapterOptions {
  sessionId: string;
  taskId?: string;
}

function createEvent(
  type: EventType,
  summary: string,
  raw: Record<string, unknown>,
  options: OpenHarnessAdapterOptions
): AgentEvent {
  const timestamp = String(raw.timestamp ?? new Date().toISOString());
  const phase = (raw.phase ?? "execute") as SessionPhase;

  return {
    id: String(raw.id ?? `openharness-${type}-${timestamp}`),
    sessionId: options.sessionId,
    taskId: options.taskId ?? null,
    runtime: "openharness",
    type,
    phase,
    source: "collector",
    timestamp,
    summary,
    payload: raw
  };
}

function mapOpenHarnessType(rawType: string): EventType | null {
  switch (rawType) {
    case "session_start":
      return "session.started";
    case "assistant_message":
    case "assistant_output":
      return "agent.summary_emitted";
    case "ask_user":
      return "agent.question_asked";
    case "tool_call_started":
      return "command.started";
    case "tool_call_finished":
      return "command.finished";
    case "tool_call_failed":
      return "command.failed";
    case "task_started":
      return "task.started";
    case "task_completed":
      return "task.completed";
    case "test_failed":
      return "test.failed";
    default:
      return null;
  }
}

export function normalizeOpenHarnessStreamEvent(
  raw: Record<string, unknown>,
  options: OpenHarnessAdapterOptions
): AgentEvent | null {
  const rawType = String(raw.type ?? "");
  const mappedType = mapOpenHarnessType(rawType);

  if (!mappedType) {
    return null;
  }

  const summary =
    String(raw.summary ?? raw.message ?? raw.content ?? raw.tool_name ?? raw.tool ?? `${rawType} emitted by OpenHarness`);

  return createEvent(mappedType, summary, raw, options);
}
