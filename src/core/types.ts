export type AgentName = 
  | "codex" 
  | "claude" 
  | "antigravity" 
  | "gemini"
  | "copilot"
  | "cursor"
  | "goose"
  | "gsd"
  | "unknown";

export type SessionStatus = "active" | "handed_off" | "superseded";

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

export interface SessionRecord {
  id: string;
  agent: AgentName;
  branch: string;
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
  status: SessionStatus;
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
}

export interface RuntimePaths {
  rootDir: string;
  holisticDir: string;
  stateFile: string;
  sessionsDir: string;
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
  reason: "idle-30min" | "work-milestone" | "";
}

export interface DraftHandoff {
  sourceSessionId: string;
  sourceSessionUpdatedAt: string;
  reason: AutoHandoffDecision["reason"];
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
