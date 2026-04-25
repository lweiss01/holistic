import type { HolisticContext } from "../../holistic-bridge-types/src/index.ts";
export declare const SESSION_STATUSES: readonly ["running", "queued", "needs_input", "at_risk", "blocked", "awaiting_review", "parked"];
export declare const SESSION_PHASES: readonly ["plan", "research", "execute", "test"];
export declare const EVENT_TYPES: readonly ["session.started", "session.ended", "session.idle_detected", "task.started", "task.completed", "phase.changed", "command.started", "command.finished", "command.failed", "file.changed", "test.started", "test.finished", "test.failed", "agent.question_asked", "agent.summary_emitted", "agent.retry_pattern_detected", "agent.scope_expansion_detected", "user.resumed"];
export declare const EVENT_SOURCES: readonly ["agent", "collector", "system", "user"];
export declare const AGENT_RUNTIMES: readonly ["codex", "openharness", "unknown"];
export declare const RECOMMENDATION_URGENCY: readonly ["low", "medium", "high"];
export declare const SUPERVISION_SEVERITIES: readonly ["info", "low", "medium", "high", "critical"];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type SessionPhase = (typeof SESSION_PHASES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type EventSource = (typeof EVENT_SOURCES)[number];
export type AgentRuntime = (typeof AGENT_RUNTIMES)[number];
export type RecommendationUrgency = (typeof RECOMMENDATION_URGENCY)[number];
export type SupervisionSeverity = (typeof SUPERVISION_SEVERITIES)[number];
export interface SupervisionSignals {
    lastMeaningfulEventAt: string | null;
    supervisionSeverity: SupervisionSeverity;
}
export interface SessionRecord {
    id: string;
    agentName: string;
    runtime: AgentRuntime;
    repoPath: string;
    worktreePath: string;
    objective: string;
    currentPhase: SessionPhase;
    startedAt: string;
    endedAt: string | null;
    lastEventAt: string;
    lastSummary: string | null;
}
export interface TaskRecord {
    id: string;
    sessionId: string;
    title: string;
    phase: SessionPhase;
    state: "active" | "completed";
    startedAt: string;
    completedAt: string | null;
    metadata: Record<string, unknown>;
}
export interface AgentEvent<TPayload = Record<string, unknown>> {
    id: string;
    sessionId: string;
    runtime?: AgentRuntime | null;
    taskId?: string | null;
    type: EventType;
    phase?: SessionPhase | null;
    source: EventSource;
    timestamp: string;
    summary?: string | null;
    payload: TPayload;
}
export interface StatusDecision {
    status: SessionStatus;
    phase: SessionPhase;
    explanation: string;
    evidence: string[];
}
export interface Recommendation {
    urgency: RecommendationUrgency;
    title: string;
    actionLabel: string;
    description: string;
}
export interface ActiveSessionResponse {
    session: SessionRecord | null;
    activeTask: TaskRecord | null;
    status: StatusDecision | null;
    recommendation: Recommendation | null;
    holisticContext: HolisticContext | null;
    supervision: SupervisionSignals | null;
}
export interface SessionDetailResponse {
    session: SessionRecord;
    activeTask: TaskRecord | null;
    status: StatusDecision;
    recommendation: Recommendation;
    holisticContext: HolisticContext | null;
    supervision: SupervisionSignals;
}
export interface TimelineResponse {
    sessionId: string;
    items: AgentEvent[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}
//# sourceMappingURL=types.d.ts.map