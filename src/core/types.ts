export type AgentName = 
  | "codex" 
  | "claude" 
  | "antigravity" 
  | "gemini"
  | "copilot"
  | "cursor"
  | "goose"
  | "gsd"
  | "gsd2"
  | "unknown";

/**
 * Lifecycle of a Holistic session record.
 *
 * Deliberately NOT named SessionStatus. Andon defines its own SessionStatus
 * (running, needs_input, blocked, ...) describing what an agent is doing right
 * now, and two different types sharing one name across the repo was a standing
 * source of confusion. This one answers "where is this record in its life",
 * not "what is the agent doing".
 *
 * See docs/status-vocabularies.md for how the four status types relate.
 */
export type HolisticSessionLifecycle = "active" | "handed_off" | "superseded";

export type Priority = "high" | "medium" | "low";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type OutcomeStatus = "success" | "partial" | "failed" | "ongoing" | "unknown";

export type AreaTag = 
  | "cli"
  | "daemon"
  | "state-management"
  | "docs"
  | "git-integration"
  | "sync"
  | "adapters"
  | "tests"
  | "types"
  | "architecture"
  | "ux";

export interface ValidationItem {
  description: string;
  command?: string;
  expectedOutcome?: string;
}

export interface ImpactNote {
  description: string;
  severity?: Severity;
  affectedAreas?: AreaTag[];
  outcome?: OutcomeStatus;
}

export interface RegressionRisk {
  description: string;
  severity?: Severity;
  affectedAreas?: AreaTag[];
  validationChecklist?: ValidationItem[];
}

export interface PendingWorkItem {
  id: string;
  title: string;
  context: string;
  recommendedNextStep: string;
  priority: Priority;
  carriedFromSession: string;
  createdAt: string;
  /**
   * Carryover detail. A pending item used to keep only the first next step,
   * which meant the anti-loop signal (what was already tried) and the safety
   * signal (blockers, regression risks) did not survive a session boundary in
   * structured form. Optional so state files written by older versions still
   * load; readers must tolerate absence.
   */
  agent?: AgentName;
  nextSteps?: string[];
  triedItems?: string[];
  assumptions?: string[];
  blockers?: string[];
  regressionRisks?: string[];
}

export interface LastHandoff {
  sessionId: string;
  summary: string;
  blockers: string[];
  nextAction: string;
  committedAt: string | null;
  createdAt: string;
}

export interface PassiveCaptureState {
  lastObservedBranch: string | null;
  pendingFiles: string[];
  activityTicks: number;
  quietTicks: number;
  lastCheckpointAt: string | null;
}

export type HealthWarningCode = "daemon-stale-checkpoint" | "unusual-files-without-checkpoint";

export interface HealthWarning {
  code: HealthWarningCode;
  message: string;
  observedAt: string;
  inputs: {
    lastCheckpointAt: string | null;
    staleThresholdDays?: number;
    daysSinceCheckpoint?: number;
    changedFileCount?: number;
    changedFilesThreshold?: number;
    hasCheckpointEvidence?: boolean;
  };
}

export interface HealthDiagnostics {
  warnings: HealthWarning[];
}

export interface SessionRecord {
  id: string;
  agent: AgentName;
  branch: string;
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
  status: HolisticSessionLifecycle;
  title: string;
  currentGoal: string;
  currentPlan: string[];
  latestStatus: string;
  workDone: string[];
  triedItems: string[];
  nextSteps: string[];
  assumptions: string[];
  blockers: string[];
  references: string[];
  // Legacy string arrays - kept for backward compatibility
  impactNotes: string[];
  regressionRisks: string[];
  // Enhanced structured metadata (optional, v2+)
  impactNotesStructured?: ImpactNote[];
  regressionRisksStructured?: RegressionRisk[];
  affectedAreas?: AreaTag[];
  relatedSessions?: string[];
  outcomeStatus?: OutcomeStatus;
  severity?: Severity;
  completionSignal?: CompletionSignalMetadata | null;
  // Written by per-agent turn hooks (Stop->waiting, UserPromptSubmit->running).
  // Takes priority over completionSignal inference in the runtime-writer.
  turnState?: "running" | "waiting";
  // End of enhanced metadata
  changedFiles: string[];
  checkpointCount: number;
  lastCheckpointReason: string;
  resumeRecap: string[];
}

export interface DocIndex {
  masterDoc: string;
  stateFile: string;
  sessionsDir: string;
  contextDir: string;
  adapterDocs: Record<string, string>;
  currentPlanDoc: string;
  protocolDoc: string;
  historyDoc: string;
  regressionDoc: string;
  zeroTouchDoc: string;
}

export interface HolisticState {
  version: number;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  activeSession: SessionRecord | null;
  pendingWork: PendingWorkItem[];
  lastHandoff: LastHandoff | null;
  docIndex: DocIndex;
  passiveCapture?: PassiveCaptureState;
  repoSnapshot?: Record<string, string>;
  pendingCommit?: {
    message: string;
    files: string[];
  } | null;
  lastAutoCheckpoint?: string;
  degraded?: boolean;
  diagnostics?: string[];
}

export interface RuntimePaths {
  rootDir: string;
  holisticDir: string;
  stateFile: string;
  sessionsDir: string;
  archiveSessionsDir: string;
  contextDir: string;
  adaptersDir: string;
  masterDoc: string;
  agentsDoc: string;
  rootHistoryDoc: string | null;
  rootClaudeDoc: string | null;
  rootGeminiDoc: string | null;
  rootCursorRulesDoc: string | null;
  rootWindsurfRulesDoc: string | null;
  rootCopilotInstructionsDoc: string | null;
  currentPlanDoc: string;
  protocolDoc: string;
  historyDoc: string;
  regressionDoc: string;
  zeroTouchDoc: string;
  trackedPaths: string[];
}

export interface GitSnapshot {
  branch: string;
  changedFiles: string[];
}

export interface CheckpointInput {
  agent?: AgentName;
  reason: string;
  goal?: string;
  title?: string;
  status?: string;
  plan?: string[];
  done?: string[];
  tried?: string[];
  next?: string[];
  assumptions?: string[];
  blockers?: string[];
  references?: string[];
  impacts?: string[];
  regressions?: string[];
  // Enhanced structured inputs (optional)
  impactsStructured?: ImpactNote[];
  regressionsStructured?: RegressionRisk[];
  affectedAreas?: AreaTag[];
  relatedSessions?: string[];
  outcomeStatus?: OutcomeStatus;
  severity?: Severity;
  completionSignal?: CompletionSignalMetadata | null;
}

export type CompletionSignalKind =
  | "natural-breakpoint"
  | "task-complete"
  | "slice-complete"
  | "milestone-complete";

export type CompletionSignalSource = "agent" | "system";

export interface CompletionSignalMetadata {
  kind: CompletionSignalKind;
  source: CompletionSignalSource;
  recordedAt: string;
}

export interface CompletionDraftDecisionInput {
  sessionId?: string | null;
  sessionUpdatedAt?: string | null;
  completionSignal?: CompletionSignalMetadata | null;
  existingDraft?: Pick<DraftHandoff, "sourceSessionId" | "sourceSessionUpdatedAt" | "reason"> | null;
}

export interface HandoffInput {
  summary?: string;
  done?: string[];
  tried?: string[];
  next?: string[];
  assumptions?: string[];
  blockers?: string[];
  references?: string[];
  impacts?: string[];
  regressions?: string[];
  status?: string;
  // Enhanced structured inputs (optional)
  impactsStructured?: ImpactNote[];
  regressionsStructured?: RegressionRisk[];
  affectedAreas?: AreaTag[];
  relatedSessions?: string[];
  outcomeStatus?: OutcomeStatus;
  severity?: Severity;
}

export interface AutoHandoffDecision {
  should: boolean;
  reason: "idle-30min" | "work-milestone" | "completion-signal" | "";
}

/**
 * "session-ended-mid-draft" marks answers rescued when the active session
 * disappeared while the user was still filling in the handoff prompts. Unlike
 * an auto-draft, it is not tied to the session that produced it, because that
 * session no longer exists.
 */
export type DraftHandoffReason = AutoHandoffDecision["reason"] | "session-ended-mid-draft";

export interface DraftHandoff {
  sourceSessionId: string;
  sourceSessionUpdatedAt: string;
  reason: DraftHandoffReason;
  createdAt: string;
  handoff: HandoffInput;
}

export interface ResumePayload {
  status: "empty" | "ready";
  recap: string[];
  choices: string[];
  recommendedCommand: string;
  adapterDoc: string;
  activeSession: SessionRecord | null;
  pendingWork: PendingWorkItem[];
  lastHandoff: LastHandoff | null;
}

export interface SessionDiff {
  timeSpan: {
    from: string;
    to: string;
    durationMs: number;
  };
  goalChanged: boolean;
  fromGoal: string;
  toGoal: string;
  newWork: string[];
  newRegressions: string[];
  clearedRegressions: string[];
  newBlockers: string[];
  clearedBlockers: string[];
  fileChanges: {
    new: string[];
    removed: string[];
  };
}
