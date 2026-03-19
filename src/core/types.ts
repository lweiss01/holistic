export type AgentName = "codex" | "claude" | "antigravity" | "unknown";

export type SessionStatus = "active" | "handed_off" | "superseded";

export type Priority = "high" | "medium" | "low";

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
  impactNotes: string[];
  regressionRisks: string[];
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
  repoSnapshot?: Record<string, string>;
  pendingCommit?: {
    message: string;
    files: string[];
  } | null;
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
  currentPlanDoc: string;
  protocolDoc: string;
  historyDoc: string;
  regressionDoc: string;
  zeroTouchDoc: string;
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
