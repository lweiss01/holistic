export const SESSION_STATUSES = [
    "running",
    "queued",
    "needs_input",
    "at_risk",
    "blocked",
    "awaiting_review",
    "parked"
];
export const SESSION_PHASES = ["plan", "research", "execute", "test"];
export const EVENT_TYPES = [
    "session.started",
    "session.ended",
    "session.idle_detected",
    "task.started",
    "task.completed",
    "phase.changed",
    "command.started",
    "command.finished",
    "command.failed",
    "file.changed",
    "test.started",
    "test.finished",
    "test.failed",
    "agent.question_asked",
    "agent.summary_emitted",
    "agent.retry_pattern_detected",
    "agent.scope_expansion_detected",
    "user.resumed"
];
export const EVENT_SOURCES = ["agent", "collector", "system", "user"];
export const AGENT_RUNTIMES = ["codex", "openharness", "unknown"];
export const RECOMMENDATION_URGENCY = ["low", "medium", "high"];
//# sourceMappingURL=types.js.map