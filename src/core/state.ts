import fs from "node:fs";
import path from "node:path";
import { getGitSnapshot, getRecentCommitSubjects, isPortableHolisticPath } from './git.ts';
import { withLockSync } from './lock.ts';
import { sanitizeList, sanitizeText } from './redact.ts';
import type {
  AgentName,
  AutoHandoffDecision,
  CheckpointInput,
  DocIndex,
  DraftHandoff,
  HandoffInput,
  HolisticState,
  PendingWorkItem,
  PassiveCaptureState,
  ResumePayload,
  RuntimePaths,
  SessionDiff,
  SessionRecord,
} from './types.ts';

function now(): string {
  return new Date().toISOString();
}

function projectNameFromRoot(rootDir: string): string {
  return path.basename(rootDir);
}

interface RepoRuntimeConfigShape {
  runtime?: {
    holisticDir?: string;
    masterDoc?: string;
    agentsDoc?: string;
    rootHistoryDoc?: string | null;
    rootClaudeDoc?: string | null;
    rootGeminiDoc?: string | null;
    writeRootHistoryDoc?: boolean;
    writeRootAgentDocs?: boolean;
  };
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function relativeToRoot(rootDir: string, absolutePath: string): string {
  return normalizeRelativePath(path.relative(rootDir, absolutePath));
}

function readRepoRuntimeConfig(rootDir: string): RepoRuntimeConfigShape {
  const configPath = path.join(rootDir, "holistic.repo.json");
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as RepoRuntimeConfigShape;
  } catch {
    return {};
  }
}

export function getRuntimePaths(rootDir: string): RuntimePaths {
  const runtime = readRepoRuntimeConfig(rootDir).runtime ?? {};
  const holisticDir = path.join(rootDir, runtime.holisticDir ?? ".holistic");
  const contextDir = path.join(holisticDir, "context");
  const masterDoc = path.join(rootDir, runtime.masterDoc ?? "HOLISTIC.md");
  const agentsDoc = path.join(rootDir, runtime.agentsDoc ?? "AGENTS.md");
  const writeRootHistoryDoc = runtime.writeRootHistoryDoc !== false;
  const writeRootAgentDocs = runtime.writeRootAgentDocs !== false;
  const rootHistoryDoc = writeRootHistoryDoc
    ? path.join(rootDir, runtime.rootHistoryDoc ?? "HISTORY.md")
    : null;
  const rootClaudeDoc = writeRootAgentDocs
    ? path.join(rootDir, runtime.rootClaudeDoc ?? "CLAUDE.md")
    : null;
  const rootGeminiDoc = writeRootAgentDocs
    ? path.join(rootDir, runtime.rootGeminiDoc ?? "GEMINI.md")
    : null;

  const trackedPaths = [
    relativeToRoot(rootDir, masterDoc),
    relativeToRoot(rootDir, agentsDoc),
    rootHistoryDoc ? relativeToRoot(rootDir, rootHistoryDoc) : null,
    rootClaudeDoc ? relativeToRoot(rootDir, rootClaudeDoc) : null,
    rootGeminiDoc ? relativeToRoot(rootDir, rootGeminiDoc) : null,
    relativeToRoot(rootDir, holisticDir),
  ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

  return {
    rootDir,
    holisticDir,
    stateFile: path.join(holisticDir, "state.json"),
    sessionsDir: path.join(holisticDir, "sessions"),
    contextDir,
    adaptersDir: path.join(contextDir, "adapters"),
    masterDoc,
    agentsDoc,
    rootHistoryDoc,
    rootClaudeDoc,
    rootGeminiDoc,
    currentPlanDoc: path.join(contextDir, "current-plan.md"),
    protocolDoc: path.join(contextDir, "session-protocol.md"),
    historyDoc: path.join(contextDir, "project-history.md"),
    regressionDoc: path.join(contextDir, "regression-watch.md"),
    zeroTouchDoc: path.join(contextDir, "zero-touch.md"),
    trackedPaths,
  };
}

function defaultDocIndex(paths: RuntimePaths): DocIndex {
  return {
    masterDoc: relativeToRoot(paths.rootDir, paths.masterDoc),
    stateFile: relativeToRoot(paths.rootDir, paths.stateFile),
    sessionsDir: relativeToRoot(paths.rootDir, paths.sessionsDir),
    contextDir: relativeToRoot(paths.rootDir, paths.contextDir),
    adapterDocs: {
      codex: relativeToRoot(paths.rootDir, path.join(paths.adaptersDir, "codex.md")),
      claude: relativeToRoot(paths.rootDir, path.join(paths.adaptersDir, "claude-cowork.md")),
      antigravity: relativeToRoot(paths.rootDir, path.join(paths.adaptersDir, "antigravity.md")),
      gemini: relativeToRoot(paths.rootDir, path.join(paths.adaptersDir, "gemini.md")),
      copilot: relativeToRoot(paths.rootDir, path.join(paths.adaptersDir, "copilot.md")),
      cursor: relativeToRoot(paths.rootDir, path.join(paths.adaptersDir, "cursor.md")),
      goose: relativeToRoot(paths.rootDir, path.join(paths.adaptersDir, "goose.md")),
      gsd: relativeToRoot(paths.rootDir, path.join(paths.adaptersDir, "gsd.md")),
    },
    currentPlanDoc: relativeToRoot(paths.rootDir, paths.currentPlanDoc),
    protocolDoc: relativeToRoot(paths.rootDir, paths.protocolDoc),
    historyDoc: relativeToRoot(paths.rootDir, paths.historyDoc),
    regressionDoc: relativeToRoot(paths.rootDir, paths.regressionDoc),
    zeroTouchDoc: relativeToRoot(paths.rootDir, paths.zeroTouchDoc),
  };
}

function defaultPassiveCapture(): PassiveCaptureState {
  return {
    lastObservedBranch: null,
    pendingFiles: [],
    activityTicks: 0,
    quietTicks: 0,
    lastCheckpointAt: null,
  };
}

interface InferredSessionStart {
  title: string;
  goal: string;
  plan: string[];
  source: "pending" | "handoff" | "files" | "git" | "default";
  status: string;
  blockers?: string[];
  nextSteps?: string[];
  consumePendingWork?: boolean;
}

function loadHolisticConfig(rootDir: string): Record<string, unknown> {
  const configPath = path.join(getRuntimePaths(rootDir).holisticDir, "config.json");
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function autoInferRepoSignalsEnabled(rootDir: string): boolean {
  const config = loadHolisticConfig(rootDir);
  return config.autoInferSessions !== false;
}

function isPortableHolisticFile(file: string): boolean {
  return isPortableHolisticPath(file);
}

function summarizeFilesForGoal(files: string[]): string {
  const interesting = files
    .filter((file) => !isPortableHolisticFile(file))
    .slice(0, 3);

  const targets = interesting.length > 0 ? interesting : files.slice(0, 3);
  return targets.join(", ");
}

export function inferSessionStart(rootDir: string, state: HolisticState): InferredSessionStart {
  const nextPending = state.pendingWork[0];
  if (nextPending) {
    return {
      title: nextPending.title,
      goal: nextPending.recommendedNextStep,
      plan: ["Read HOLISTIC.md", nextPending.recommendedNextStep],
      source: "pending",
      status: nextPending.context,
      nextSteps: [nextPending.recommendedNextStep],
      consumePendingWork: true,
    };
  }

  if (state.lastHandoff) {
    return {
      title: "Continue previous handoff",
      goal: state.lastHandoff.nextAction,
      plan: ["Read HOLISTIC.md", state.lastHandoff.nextAction],
      source: "handoff",
      status: state.lastHandoff.summary,
      blockers: [...state.lastHandoff.blockers],
      nextSteps: [state.lastHandoff.nextAction],
    };
  }

  if (autoInferRepoSignalsEnabled(rootDir)) {
    const snapshot = getGitSnapshot(rootDir, state.repoSnapshot ?? {});
    const changedFiles = snapshot.changedFiles.filter((file) => !isPortableHolisticFile(file));
    if (changedFiles.length > 0) {
      const summary = summarizeFilesForGoal(changedFiles);
      return {
        title: "Continue recent repo work",
        goal: `Continue work around ${summary}`,
        plan: ["Review the most recently changed files", "Continue the current implementation thread"],
        source: "files",
        status: `Inferred a session from recent repo changes on ${snapshot.branch}.`,
        nextSteps: [`Review ${summary}`],
      };
    }

    const recentCommits = getRecentCommitSubjects(rootDir).filter((subject) => subject !== "docs(holistic): handoff");
    if (recentCommits.length > 0) {
      return {
        title: "Continue recent git work",
        goal: `Continue work related to: ${sanitizeText(recentCommits[0])}`,
        plan: ["Review the latest commits", "Continue the most recent implementation thread"],
        source: "git",
        status: "Inferred a session from recent git history.",
        nextSteps: ["Review the latest commit context before continuing"],
      };
    }
  }

  return {
    title: "New work session",
    goal: "Start a new task and capture the first checkpoint.",
    plan: ["Read HOLISTIC.md", "Confirm the next task with the user"],
    source: "default",
    status: "No prior session context could be inferred automatically.",
  };
}

export function canInferSessionStart(rootDir: string, state: HolisticState): boolean {
  return inferSessionStart(rootDir, state).source !== "default";
}

export function createInitialState(rootDir: string): HolisticState {
  const timestamp = now();
  const paths = getRuntimePaths(rootDir);
  return {
    version: 2,
    projectName: projectNameFromRoot(rootDir),
    createdAt: timestamp,
    updatedAt: timestamp,
    activeSession: null,
    pendingWork: [],
    lastHandoff: null,
    docIndex: defaultDocIndex(paths),
    passiveCapture: defaultPassiveCapture(),
    repoSnapshot: {},
    pendingCommit: null,
  };
}

function ensureDirs(paths: RuntimePaths): void {
  fs.mkdirSync(paths.holisticDir, { recursive: true });
  fs.mkdirSync(paths.sessionsDir, { recursive: true });
  fs.mkdirSync(paths.contextDir, { recursive: true });
  fs.mkdirSync(paths.adaptersDir, { recursive: true });
}

export function stateLockFile(paths: RuntimePaths): string {
  return `${paths.stateFile}.lock`;
}

const CURRENT_STATE_VERSION = 2;

function migrateState(state: HolisticState, fromVersion: number, toVersion: number): HolisticState {
  let migrated = { ...state };

  // Phase tracking was removed in a cleanup refactor
  // Old state files with phaseTracker will simply ignore those fields
  
  migrated.version = toVersion;
  migrated.updatedAt = now();
  
  // Log migration for debugging
  if (fromVersion !== toVersion) {
    process.stdout.write(`Migrated Holistic state from v${fromVersion} to v${toVersion}\n`);
  }
  
  return migrated;
}

// Future migration example (commented out until needed):
// function migrateV1ToV2(state: HolisticState): HolisticState {
//   return {
//     ...state,
//     // Add new fields with defaults
//     // newField: "default value",
//   };
// }

function hydrateState(state: HolisticState, paths: RuntimePaths): HolisticState {
  if (state.version < CURRENT_STATE_VERSION) {
    state = migrateState(state, state.version, CURRENT_STATE_VERSION);
  }

  const defaults = defaultDocIndex(paths);
  state.docIndex = {
    ...(state.docIndex ?? {}),
    ...defaults,
    adapterDocs: {
      ...(state.docIndex?.adapterDocs ?? {}),
      ...defaults.adapterDocs,
    },
  };
  state.passiveCapture = {
    ...defaultPassiveCapture(),
    ...(state.passiveCapture ?? {}),
    pendingFiles: state.passiveCapture?.pendingFiles ?? [],
  };
  state.pendingWork = state.pendingWork ?? [];
  state.repoSnapshot = state.repoSnapshot ?? {};
  state.pendingCommit = state.pendingCommit ?? null;
  return state;
}

function loadStateFromDisk(rootDir: string, paths: RuntimePaths): { state: HolisticState; created: boolean } {
  if (!fs.existsSync(paths.stateFile)) {
    return { state: createInitialState(rootDir), created: true };
  }

  const raw = fs.readFileSync(paths.stateFile, "utf8");
  return {
    state: hydrateState(JSON.parse(raw) as HolisticState, paths),
    created: false,
  };
}

export function withStateLock<T>(paths: RuntimePaths, fn: () => T): T {
  return withLockSync(stateLockFile(paths), fn);
}

export function loadState(rootDir: string): { state: HolisticState; paths: RuntimePaths; created: boolean } {
  const paths = getRuntimePaths(rootDir);
  ensureDirs(paths);
  const { state, created } = loadStateFromDisk(rootDir, paths);
  return { state, paths, created };
}

export function saveState(paths: RuntimePaths, state: HolisticState, options?: { locked?: boolean }): void {
  const write = () => {
    state.updatedAt = now();
    const tempFile = `${paths.stateFile}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2) + "\n", "utf8");
    fs.renameSync(tempFile, paths.stateFile);
  };

  if (options?.locked) {
    write();
    return;
  }

  withStateLock(paths, write);
}

export function draftHandoffFile(paths: RuntimePaths): string {
  return path.join(paths.holisticDir, "draft-handoff.json");
}

export function readDraftHandoff(paths: RuntimePaths): DraftHandoff | null {
  const filePath = draftHandoffFile(paths);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as DraftHandoff;
  } catch {
    return null;
  }
}

export function writeDraftHandoff(paths: RuntimePaths, draft: DraftHandoff): void {
  fs.writeFileSync(draftHandoffFile(paths), JSON.stringify(draft, null, 2) + "\n", "utf8");
}

export function clearDraftHandoff(paths: RuntimePaths): void {
  const filePath = draftHandoffFile(paths);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function createSession(agent: AgentName, goal: string, title?: string, plan?: string[]): SessionRecord {
  const timestamp = now();
  return {
    id: `session-${timestamp.replaceAll(":", "-").replaceAll(".", "-")}`,
    agent,
    branch: "",  // Changed from "master" - will be set by refreshSessionFromRepo()
    startedAt: timestamp,
    updatedAt: timestamp,
    endedAt: null,
    status: "active",
    title: sanitizeText(title || goal || "Untitled session"),
    currentGoal: sanitizeText(goal || "Capture work and prepare a clean handoff."),
    currentPlan: sanitizeList(plan && plan.length ? plan : ["Read HOLISTIC.md", "Confirm next step with the user"]),
    latestStatus: "Session started.",
    workDone: [],
    triedItems: [],
    nextSteps: [],
    assumptions: [],
    blockers: [],
    references: [],
    impactNotes: [],
    regressionRisks: [],
    changedFiles: [],
    checkpointCount: 0,
    lastCheckpointReason: "session-start",
    resumeRecap: [],
  };
}

function uniqueMerge(current: string[], incoming: string[]): string[] {
  const merged = [...current];
  for (const item of incoming) {
    if (!merged.includes(item)) {
      merged.push(item);
    }
  }
  return merged;
}

function recentFirstMerge(current: string[], incoming: string[]): string[] {
  const incomingUnique = sanitizeList(incoming);
  if (incomingUnique.length === 0) {
    return [...current];
  }

  const remaining = current.filter((item) => !incomingUnique.includes(item));
  return [...incomingUnique, ...remaining];
}

export function readArchivedSessions(paths: RuntimePaths): SessionRecord[] {
  if (!fs.existsSync(paths.sessionsDir)) {
    return [];
  }

  return fs.readdirSync(paths.sessionsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(fs.readFileSync(path.join(paths.sessionsDir, file), "utf8")) as SessionRecord)
    .sort((left, right) => (right.endedAt || right.updatedAt).localeCompare(left.endedAt || left.updatedAt));
}

function buildResumeRecap(state: HolisticState): string[] {
  const lines: string[] = [];

  if (state.activeSession) {
    const session = state.activeSession;
    lines.push(`Current objective: ${session.currentGoal}`);
    lines.push(`Latest status: ${session.latestStatus}`);
    if (session.triedItems.length > 0) {
      lines.push(`Already tried: ${session.triedItems.join("; ")}`);
    }
    if (session.nextSteps.length > 0) {
      lines.push(`Try next: ${session.nextSteps.join("; ")}`);
    }
    if (session.impactNotes.length > 0) {
      lines.push(`Overall impact so far: ${session.impactNotes.join("; ")}`);
    }
    if (session.regressionRisks.length > 0) {
      lines.push(`Regression watch: ${session.regressionRisks.join("; ")}`);
    }
    if (session.blockers.length > 0) {
      lines.push(`Blockers: ${session.blockers.join("; ")}`);
    }
    if (state.pendingWork.length > 0) {
      lines.push(`Pending work waiting in queue: ${state.pendingWork.length}`);
    }
    return lines;
  }

  if (state.lastHandoff) {
    lines.push(`Last handoff summary: ${state.lastHandoff.summary}`);
    lines.push(`Recommended next action: ${state.lastHandoff.nextAction}`);
    if (state.lastHandoff.blockers.length > 0) {
      lines.push(`Known blockers: ${state.lastHandoff.blockers.join("; ")}`);
    }
  }

  if (state.pendingWork.length > 0) {
    const top = state.pendingWork[0];
    lines.push(`Top pending work: ${top.title}`);
    lines.push(`Pending context: ${top.context}`);
    lines.push(`Suggested next step: ${top.recommendedNextStep}`);
  }

  if (lines.length === 0) {
    lines.push("No prior Holistic session history exists in this repo yet.");
  }

  return lines;
}

export function getResumePayload(state: HolisticState, agent: AgentName): ResumePayload {
  const recap = buildResumeRecap(state);
  const hasCarryover = Boolean(state.activeSession || state.lastHandoff || state.pendingWork.length > 0);
  const choices = hasCarryover ? ["continue", "tweak", "start-new"] : ["start-new"];

  return {
    status: hasCarryover ? "ready" : "empty",
    recap,
    choices,
    recommendedCommand: hasCarryover ? "holistic resume --continue" : "holistic start-new --goal \"Describe the new task\"",
    adapterDoc: state.docIndex.adapterDocs[agent] ?? state.docIndex.adapterDocs.codex,
    activeSession: state.activeSession,
    pendingWork: state.pendingWork,
    lastHandoff: state.lastHandoff,
  };
}

/**
 * Build a formatted startup greeting for agents.
 * Used by both MCP notification and manual /holistic command.
 * Returns null if there's no meaningful context to share.
 */
export function buildStartupGreeting(state: HolisticState, agent: AgentName): string | null {
  const payload = getResumePayload(state, agent);
  if (payload.status === "empty") {
    return null;
  }

  const lines: string[] = [];
  lines.push("Holistic resume");
  lines.push("");
  lines.push(...payload.recap.map((line) => `- ${line}`));
  lines.push("");
  lines.push(`Choices: ${payload.choices.join(", ")}`);
  lines.push(`Adapter doc: ${payload.adapterDoc}`);
  lines.push(`Recommended command: ${payload.recommendedCommand}`);
  lines.push(`Long-term history: ${state.docIndex.historyDoc}`);
  lines.push(`Regression watch: ${state.docIndex.regressionDoc}`);
  lines.push(`Zero-touch architecture: ${state.docIndex.zeroTouchDoc}`);
  return lines.join("\n");
}

export function loadSessionById(state: HolisticState, paths: RuntimePaths, sessionId: string): SessionRecord | null {
  if (state.activeSession?.id === sessionId) {
    return state.activeSession;
  }

  for (const session of readArchivedSessions(paths)) {
    if (session.id === sessionId) {
      return session;
    }
  }

  return null;
}

export function computeSessionDiff(fromSession: SessionRecord, toSession: SessionRecord): SessionDiff {
  return {
    timeSpan: {
      from: fromSession.startedAt,
      to: toSession.startedAt,
      durationMs: new Date(toSession.startedAt).getTime() - new Date(fromSession.startedAt).getTime(),
    },
    goalChanged: fromSession.currentGoal !== toSession.currentGoal,
    fromGoal: fromSession.currentGoal,
    toGoal: toSession.currentGoal,
    newWork: toSession.workDone.filter((item) => !fromSession.workDone.includes(item)),
    newRegressions: toSession.regressionRisks.filter((item) => !fromSession.regressionRisks.includes(item)),
    clearedRegressions: fromSession.regressionRisks.filter((item) => !toSession.regressionRisks.includes(item)),
    newBlockers: toSession.blockers.filter((item) => !fromSession.blockers.includes(item)),
    clearedBlockers: fromSession.blockers.filter((item) => !toSession.blockers.includes(item)),
    fileChanges: {
      new: toSession.changedFiles.filter((item) => !fromSession.changedFiles.includes(item)),
      removed: fromSession.changedFiles.filter((item) => !toSession.changedFiles.includes(item)),
    },
  };
}

function refreshSessionFromRepo(rootDir: string, state: HolisticState, session: SessionRecord): { state: HolisticState; session: SessionRecord } {
  const snapshot = getGitSnapshot(rootDir, state.repoSnapshot ?? {});
  const changedFiles = snapshot.changedFiles.filter((file) => !isPortableHolisticFile(file));
  return {
    state: {
      ...state,
      repoSnapshot: snapshot.snapshot,
    },
    session: {
      ...session,
      branch: snapshot.branch,
      changedFiles,
      updatedAt: now(),
    },
  };
}

function syncActiveSession(state: HolisticState, goal?: string, status?: string, title?: string, plan?: string[]): HolisticState {
  if (!state.activeSession) {
    return state;
  }

  const session: SessionRecord = {
    ...state.activeSession,
  };

  if (goal) {
    session.currentGoal = sanitizeText(goal);
  }
  if (status) {
    session.latestStatus = sanitizeText(status);
  }
  if (title) {
    session.title = sanitizeText(title);
  }
  if (plan && plan.length > 0) {
    session.currentPlan = sanitizeList(plan);
  }
  session.updatedAt = now();

  session.resumeRecap = buildResumeRecap({
    ...state,
    activeSession: session,
  });

  return {
    ...state,
    activeSession: session,
  };
}

export function checkpointState(rootDir: string, state: HolisticState, input: CheckpointInput): HolisticState {
  const agent = input.agent ?? state.activeSession?.agent ?? "unknown";
  const baseSession = state.activeSession
    ? state.activeSession
    : createSession(agent, input.goal || "Capture work and prepare a clean handoff.", input.title, input.plan);

  const refreshed = refreshSessionFromRepo(rootDir, state, baseSession);
  const nextState = { ...refreshed.state };
  const session = refreshed.session;

  session.agent = agent;
  if (input.goal) {
    session.currentGoal = sanitizeText(input.goal);
  }
  if (input.title) {
    session.title = sanitizeText(input.title);
  }
  if (input.plan && input.plan.length > 0) {
    session.currentPlan = sanitizeList(input.plan);
  }
  if (input.status) {
    session.latestStatus = sanitizeText(input.status);
  }

  session.workDone = uniqueMerge(session.workDone, sanitizeList(input.done));
  session.triedItems = uniqueMerge(session.triedItems, sanitizeList(input.tried));
  session.nextSteps = recentFirstMerge(session.nextSteps, input.next ?? []);
  session.assumptions = uniqueMerge(session.assumptions, sanitizeList(input.assumptions));
  session.blockers = uniqueMerge(session.blockers, sanitizeList(input.blockers));
  session.references = uniqueMerge(session.references, sanitizeList(input.references));
  session.impactNotes = uniqueMerge(session.impactNotes, sanitizeList(input.impacts));
  session.regressionRisks = uniqueMerge(session.regressionRisks, sanitizeList(input.regressions));
  
  // Handle enhanced structured metadata
  if (input.impactsStructured) {
    session.impactNotesStructured = input.impactsStructured;
  }
  if (input.regressionsStructured) {
    session.regressionRisksStructured = input.regressionsStructured;
  }
  if (input.affectedAreas) {
    session.affectedAreas = input.affectedAreas;
  }
  if (input.relatedSessions) {
    session.relatedSessions = input.relatedSessions;
  }
  if (input.outcomeStatus) {
    session.outcomeStatus = input.outcomeStatus;
  }
  if (input.severity) {
    session.severity = input.severity;
  }
  
  session.lastCheckpointReason = sanitizeText(input.reason || "manual");
  session.checkpointCount += 1;
  session.resumeRecap = buildResumeRecap({
    ...nextState,
    activeSession: session,
  });

  return {
    ...nextState,
    activeSession: session,
    pendingCommit: null,
  };
}

function toPendingWork(session: SessionRecord): PendingWorkItem {
  return {
    id: `pending-${session.id}`,
    title: session.title,
    context: session.latestStatus || session.currentGoal,
    recommendedNextStep: session.nextSteps[0] || "Review HOLISTIC.md and decide the next concrete step.",
    priority: session.blockers.length > 0 ? "high" : "medium",
    carriedFromSession: session.id,
    createdAt: now(),
  };
}

function writeArchivedSession(paths: RuntimePaths, session: SessionRecord): void {
  const filePath = path.join(paths.sessionsDir, `${session.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2) + "\n", "utf8");
}

export function startNewSession(rootDir: string, state: HolisticState, agent: AgentName, goal: string, plan: string[], title?: string): HolisticState {
  const nextState: HolisticState = { ...state, pendingWork: [...state.pendingWork], pendingCommit: null };

  if (nextState.activeSession) {
    const refreshed = refreshSessionFromRepo(rootDir, nextState, nextState.activeSession);
    const archived = {
      ...refreshed.session,
      status: "superseded" as const,
      endedAt: now(),
    };
    writeArchivedSession(getRuntimePaths(rootDir), archived);
    nextState.pendingWork.unshift(toPendingWork(archived));
    nextState.repoSnapshot = refreshed.state.repoSnapshot;
  }

  nextState.activeSession = createSession(agent, goal, title, plan);
  const refreshed = refreshSessionFromRepo(rootDir, nextState, nextState.activeSession);
  nextState.activeSession = refreshed.session;
  nextState.repoSnapshot = refreshed.state.repoSnapshot;
  nextState.lastHandoff = null;
  return nextState;
}

export function continueFromLatest(rootDir: string, state: HolisticState, agent: AgentName): HolisticState {
  if (state.activeSession) {
    const refreshed = refreshSessionFromRepo(rootDir, state, {
      ...state.activeSession,
      agent,
    });
    return {
      ...refreshed.state,
      activeSession: refreshed.session,
      pendingCommit: null,
    };
  }

  const inferred = inferSessionStart(rootDir, state);
  const resumed = createSession(agent, inferred.goal, inferred.title, inferred.plan);
  resumed.latestStatus = inferred.status;
  resumed.nextSteps = inferred.nextSteps ? sanitizeList(inferred.nextSteps) : [];
  resumed.blockers = inferred.blockers ? sanitizeList(inferred.blockers) : [];

  const remainingPendingWork = inferred.consumePendingWork ? state.pendingWork.slice(1) : state.pendingWork;
  const refreshed = refreshSessionFromRepo(rootDir, state, resumed);
  refreshed.session.resumeRecap = buildResumeRecap({
    ...refreshed.state,
    activeSession: refreshed.session,
    pendingWork: remainingPendingWork,
  });
  return {
    ...refreshed.state,
    activeSession: refreshed.session,
    pendingWork: remainingPendingWork,
    pendingCommit: null,
  };
}

export function shouldAutoDraftHandoff(session: SessionRecord, currentTimeMs = Date.now()): AutoHandoffDecision {
  const updatedAtMs = new Date(session.updatedAt).getTime();
  const startedAtMs = new Date(session.startedAt).getTime();
  const idleMinutes = (currentTimeMs - updatedAtMs) / 60000;
  if (idleMinutes >= 30) {
    return { should: true, reason: "idle-30min" };
  }

  const sessionHours = (currentTimeMs - startedAtMs) / 3600000;
  if (session.checkpointCount >= 5 && sessionHours >= 2) {
    return { should: true, reason: "work-milestone" };
  }

  return { should: false, reason: "" };
}

export function buildAutoDraftHandoff(state: HolisticState, reason: AutoHandoffDecision["reason"]): DraftHandoff | null {
  const session = state.activeSession;
  if (!session) {
    return null;
  }

  return {
    sourceSessionId: session.id,
    sourceSessionUpdatedAt: session.updatedAt,
    reason,
    createdAt: now(),
    handoff: {
      summary: session.latestStatus || "Auto-drafted handoff",
      done: [...session.workDone],
      tried: [...session.triedItems],
      next: session.nextSteps.length > 0 ? [...session.nextSteps] : ["Review auto-drafted handoff and continue."],
      assumptions: [...session.assumptions],
      blockers: [...session.blockers],
      references: [...session.references],
      impacts: [...session.impactNotes],
      regressions: [...session.regressionRisks],
      status: session.latestStatus,
    },
  };
}

export function applyHandoff(rootDir: string, state: HolisticState, input: HandoffInput): HolisticState {
  if (!state.activeSession) {
    return state;
  }

  const refreshed = refreshSessionFromRepo(rootDir, state, state.activeSession);
  const session = refreshed.session;
  session.status = "handed_off";
  session.endedAt = now();

  session.latestStatus = sanitizeText(input.status || session.latestStatus);
  session.workDone = uniqueMerge(session.workDone, sanitizeList(input.done));
  session.triedItems = uniqueMerge(session.triedItems, sanitizeList(input.tried));
  session.nextSteps = recentFirstMerge(session.nextSteps, input.next ?? []);
  session.assumptions = uniqueMerge(session.assumptions, sanitizeList(input.assumptions));
  session.blockers = uniqueMerge(session.blockers, sanitizeList(input.blockers));
  session.references = uniqueMerge(session.references, sanitizeList(input.references));
  session.impactNotes = uniqueMerge(session.impactNotes, sanitizeList(input.impacts));
  session.regressionRisks = uniqueMerge(session.regressionRisks, sanitizeList(input.regressions));
  
  // Handle enhanced structured metadata
  if (input.impactsStructured) {
    session.impactNotesStructured = input.impactsStructured;
  }
  if (input.regressionsStructured) {
    session.regressionRisksStructured = input.regressionsStructured;
  }
  if (input.affectedAreas) {
    session.affectedAreas = input.affectedAreas;
  }
  if (input.relatedSessions) {
    session.relatedSessions = input.relatedSessions;
  }
  if (input.outcomeStatus) {
    session.outcomeStatus = input.outcomeStatus;
  }
  if (input.severity) {
    session.severity = input.severity;
  }
  
  session.resumeRecap = buildResumeRecap({
    ...refreshed.state,
    activeSession: session,
  });

  const summary = sanitizeText(input.summary || session.latestStatus || session.currentGoal);
  const nextAction = session.nextSteps[0] || "Review HOLISTIC.md and confirm the next action.";
  const pendingWork = [...state.pendingWork];

  if (session.nextSteps.length > 0 || session.blockers.length > 0) {
    pendingWork.unshift(toPendingWork(session));
  }

  writeArchivedSession(getRuntimePaths(rootDir), session);

  const paths = getRuntimePaths(rootDir);
  return {
    ...refreshed.state,
    activeSession: null,
    pendingWork,
    lastHandoff: {
      sessionId: session.id,
      summary,
      blockers: [...session.blockers],
      nextAction,
      committedAt: null,
      createdAt: now(),
    },
    pendingCommit: {
      message: `docs(holistic): handoff session ${session.id}`,
      files: paths.trackedPaths,
    },
  };
}
