export const RUNTIME_IDS = [
  "local",
  "codex",
  "claude-code",
  "openharness",
  "custom"
] as const;

export const RUNTIME_STATUSES = [
  "starting",
  "running",
  "paused",
  "waiting_for_input",
  "waiting_for_approval",
  "blocked",
  "failed",
  "completed",
  "cancelled",
  "unknown"
] as const;

export const RUNTIME_ACTIVITIES = [
  "planning",
  "reading",
  "editing",
  "running_command",
  "running_tests",
  "reviewing",
  "thinking",
  "waiting",
  "idle",
  "unknown"
] as const;

export type RuntimeId = (typeof RUNTIME_IDS)[number];
export type RuntimeStatus = (typeof RUNTIME_STATUSES)[number];
export type RuntimeActivity = (typeof RUNTIME_ACTIVITIES)[number];

export interface RuntimeTaskInput {
  repoPath: string;
  repoName: string;
  branch?: string;
  worktreePath?: string;
  prompt: string;
  agentName: string;
  runtimeId: RuntimeId;
  constraints?: string[];
  contextFiles?: string[];
  metadata?: Record<string, unknown>;
}

export interface RuntimeSession {
  id: string;
  runtimeId: RuntimeId;
  agentName: string;
  repoName: string;
  repoPath: string;
  worktreePath?: string;
  branch?: string;
  status: RuntimeStatus;
  activity: RuntimeActivity;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  pid?: number;
  metadata?: Record<string, unknown>;
}
