import fs from "node:fs";
import path from "node:path";
import { renderRepoLocalCliCommands } from './cli-fallback.ts';
import { getGitSnapshot, getRecentCommitSubjects, isPortableHolisticPath } from './git.ts';
import { emitAndonEvent } from './andon.ts';
import { withLockSync } from './lock.ts';
import { sanitizeList, sanitizeText } from './redact.ts';
import type {
  AgentName,
  AutoHandoffDecision,
  CheckpointInput,
  CompletionDraftDecisionInput,
  CompletionSignalKind,
  CompletionSignalMetadata,
  CompletionSignalSource,
  DocIndex,
  DraftHandoff,
  HandoffInput,
  HealthDiagnostics,
  HealthWarning,
  HolisticState,
  PendingWorkItem,
  PassiveCaptureState,
  ResumePayload,
  RuntimePaths,
  SessionDiff,
  SessionRecord,
} from './types.ts';

/**
 * Safe file write helper - returns {success, error} instead of throwing
 */
function safeWriteFile(filePath: string, content: string): { success: boolean; error?: string } {
  try {
    fs.writeFileSync(filePath, content, "utf8");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to write ${filePath}: ${message}` };
  }
}

/**
 * Safe file read helper - returns {success, data, error}
 */
function safeReadFile(filePath: string): { success: boolean; data?: string; error?: string } {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to read ${filePath}: ${message}` };
  }
}

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

/**
 * Ensures a resolved path remains inside the repository root.
 * If path escapes root, falls back to default and records a diagnostic.
 */
function resolvePathInsideRoot(rootDir: string, candidate: string, defaultBasename: string, diagnostics?: string[]): string {
  const normalizedRoot = path.normalize(rootDir);
  const resolved = path.resolve(normalizedRoot, candidate);
  
  // Ensure we check with a trailing separator to prevent matching /path/repo-sibling
  const rootWithSlash = normalizedRoot.endsWith(path.sep) ? normalizedRoot : normalizedRoot + path.sep;
  const isInside = resolved === normalizedRoot || resolved.startsWith(rootWithSlash);

  if (!isInside) {
    if (diagnostics) {
      diagnostics.push(`Security Warning: Configured path '${candidate}' attempted to escape repository root. Falling back to safe default: '${defaultBasename}'.`);
    }
    return path.join(normalizedRoot, defaultBasename);
  }
  
  return resolved;
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

export function getRuntimePaths(rootDir: string, diagnostics?: string[]): RuntimePaths {
  const runtime = readRepoRuntimeConfig(rootDir).runtime ?? {};
  
  // Enforce repository containment for all configurable paths
  const holisticDir = resolvePathInsideRoot(rootDir, runtime.holisticDir ?? ".holistic", ".holistic", diagnostics);
  const contextDir = path.join(holisticDir, "context");
  const masterDoc = resolvePathInsideRoot(rootDir, runtime.masterDoc ?? "HOLISTIC.md", "HOLISTIC.md", diagnostics);
  const agentsDoc = resolvePathInsideRoot(rootDir, runtime.agentsDoc ?? "AGENTS.md", "AGENTS.md", diagnostics);
  
  const writeRootHistoryDoc = runtime.writeRootHistoryDoc !== false;
  const writeRootAgentDocs = runtime.writeRootAgentDocs !== false;
  
  const rootHistoryDoc = writeRootHistoryDoc
    ? resolvePathInsideRoot(rootDir, runtime.rootHistoryDoc ?? "HISTORY.md", "HISTORY.md", diagnostics)
    : null;
  const rootClaudeDoc = writeRootAgentDocs
    ? resolvePathInsideRoot(rootDir, runtime.rootClaudeDoc ?? "CLAUDE.md", "CLAUDE.md", diagnostics)
    : null;
  const rootGeminiDoc = writeRootAgentDocs
    ? resolvePathInsideRoot(rootDir, runtime.rootGeminiDoc ?? "GEMINI.md", "GEMINI.md", diagnostics)
    : null;
    
  // Fixed system paths (not configurable for containment safety)
  const rootCursorRulesDoc = writeRootAgentDocs ? path.join(rootDir, ".cursorrules") : null;
  const rootWindsurfRulesDoc = writeRootAgentDocs ? path.join(rootDir, ".windsurfrules") : null;
  const rootCopilotInstructionsDoc = writeRootAgentDocs ? path.join(rootDir, ".github", "copilot-instructions.md") : null;

  const trackedPaths = [
    relativeToRoot(rootDir, masterDoc),
    relativeToRoot(rootDir, agentsDoc),
    rootHistoryDoc ? relativeToRoot(rootDir, rootHistoryDoc) : null,
    rootClaudeDoc ? relativeToRoot(rootDir, rootClaudeDoc) : null,
    rootGeminiDoc ? relativeToRoot(rootDir, rootGeminiDoc) : null,
    rootCursorRulesDoc ? relativeToRoot(rootDir, rootCursorRulesDoc) : null,
    rootWindsurfRulesDoc ? relativeToRoot(rootDir, rootWindsurfRulesDoc) : null,
    rootCopilotInstructionsDoc ? relativeToRoot(rootDir, rootCopilotInstructionsDoc) : null,
    relativeToRoot(rootDir, holisticDir),
  ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

  const sessionsDir = path.join(holisticDir, "sessions");
  const archiveSessionsDir = path.join(sessionsDir, "archive");

  return {
    rootDir,
    holisticDir,
    stateFile: path.join(holisticDir, "state.json"),
    sessionsDir,
    archiveSessionsDir,
    contextDir,
    adaptersDir: path.join(contextDir, "adapters"),
    masterDoc,
    agentsDoc,
    rootHistoryDoc,
    rootClaudeDoc,
    rootGeminiDoc,
    rootCursorRulesDoc,
    rootWindsurfRulesDoc,
    rootCopilotInstructionsDoc,
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
      gsd2: relativeToRoot(paths.rootDir, path.join(paths.adaptersDir, "gsd2.md")),
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
        title: "Continue recent repo work",
        goal: `Continue work related to: ${sanitizeText(recentCommits[0])}`,
        plan: ["Review the latest commits", "Continue the most recent implementation thread"],
        source: "git",
        status: "Inferred a session from recent repo history.",
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
  fs.mkdirSync(paths.archiveSessionsDir, { recursive: true });
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

function loadStateFromDisk(rootDir: string, paths: RuntimePaths, diagnostics: string[]): { state: HolisticState; created: boolean } {
  if (!fs.existsSync(paths.stateFile)) {
    return { state: createInitialState(rootDir), created: true };
  }

  const result = safeReadFile(paths.stateFile);
  if (!result.success || !result.data) {
    // If we can't read state file, create fresh state instead of crashing
    diagnostics.push(`Warning: Could not read state file: ${result.error}`);
    const state = createInitialState(rootDir);
    state.degraded = true;
    return { state, created: true };
  }

  try {
    return {
      state: hydrateState(JSON.parse(result.data) as HolisticState, paths),
      created: false,
    };
  } catch (err) {
    // JSON parse error - backup corrupt file and create fresh state
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const corruptBackup = `${paths.stateFile}.corrupt-${timestamp}.json`;
    try {
      if (fs.existsSync(paths.stateFile)) {
        fs.renameSync(paths.stateFile, corruptBackup);
        diagnostics.push(`Security: Local state file was corrupted. Backed up to ${path.basename(corruptBackup)} for inspection. Initializing fresh state.`);
      }
    } catch (renameErr) {
      diagnostics.push(`Error: State corruption detected but backup failed: ${renameErr instanceof Error ? renameErr.message : String(renameErr)}`);
    }

    const state = createInitialState(rootDir);
    state.degraded = true;
    return { state, created: true };
  }
}

export function withStateLock<T>(paths: RuntimePaths, fn: () => T): T {
  return withLockSync(stateLockFile(paths), fn);
}

export function loadState(rootDir: string): { state: HolisticState; paths: RuntimePaths; created: boolean } {
  const diagnostics: string[] = [];
  const paths = getRuntimePaths(rootDir, diagnostics);
  ensureDirs(paths);
  const { state, created } = loadStateFromDisk(rootDir, paths, diagnostics);
  
  // Merge any diagnostics gathered during path resolution and state loading
  if (diagnostics.length > 0) {
    state.diagnostics = [...(state.diagnostics ?? []), ...diagnostics];
  }
  
  return { state, paths, created };
}

export function saveState(paths: RuntimePaths, state: HolisticState, options?: { locked?: boolean }): { success: boolean; error?: string } {
  const write = (): { success: boolean; error?: string } => {
    state.updatedAt = now();
    const tempFile = `${paths.stateFile}.${process.pid}.tmp`;
    
    // Write to temp file
    const writeResult = safeWriteFile(tempFile, JSON.stringify(state, null, 2) + "\n");
    if (!writeResult.success) {
      return writeResult;
    }

    // Rename temp to actual (atomic operation)
    try {
      fs.renameSync(tempFile, paths.stateFile);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to rename ${tempFile} to ${paths.stateFile}: ${message}` };
    }
  };

  if (options?.locked) {
    return write();
  }

  try {
    return withStateLock(paths, write);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to acquire state lock: ${message}` };
  }
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
    completionSignal: null,
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

function readSessionsFromDir(directory: string): SessionRecord[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const sessions: SessionRecord[] = [];
  for (const file of fs.readdirSync(directory)) {
    if (!file.endsWith(".json")) {
      continue;
    }

    try {
      sessions.push(JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")) as SessionRecord);
    } catch {
      // Skip corrupt session files instead of crashing the entire tool.
    }
  }

  return sessions;
}

function sortSessionsNewestFirst(sessions: SessionRecord[]): SessionRecord[] {
  return [...sessions].sort((left, right) => {
    const rightKey = right.endedAt || right.updatedAt || "";
    const leftKey = left.endedAt || left.updatedAt || "";
    return rightKey.localeCompare(leftKey);
  });
}

export function readActiveSessions(paths: RuntimePaths): SessionRecord[] {
  return sortSessionsNewestFirst(readSessionsFromDir(paths.sessionsDir));
}

export function readArchivedSessions(paths: RuntimePaths): SessionRecord[] {
  return sortSessionsNewestFirst(readSessionsFromDir(paths.archiveSessionsDir));
}

export function readAllSessions(paths: RuntimePaths): SessionRecord[] {
  return sortSessionsNewestFirst([...readActiveSessions(paths), ...readArchivedSessions(paths)]);
}

const STALE_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Collect the set of session IDs that are "referenced" by current state and
 * should never be archived regardless of age.  Referenced means: active session,
 * last handoff, any pending-work item that carried from a session, or any
 * session whose ID appears as a relatedSession on a recent stored session.
 */
function referencedSessionIds(state: HolisticState, paths: RuntimePaths): Set<string> {
  const ids = new Set<string>();

  if (state.activeSession) {
    ids.add(state.activeSession.id);
  }

  if (state.lastHandoff) {
    ids.add(state.lastHandoff.sessionId);
  }

  for (const item of state.pendingWork) {
    if (item.carriedFromSession) {
      ids.add(item.carriedFromSession);
    }
  }

  // Scan recent stored sessions for relatedSessions cross-references.
  // We read active sessions only — archived sessions referencing each other
  // shouldn't prevent archival.
  for (const session of readSessionsFromDir(paths.sessionsDir)) {
    if (session.relatedSessions) {
      for (const related of session.relatedSessions) {
        ids.add(related);
      }
    }
  }

  return ids;
}

/**
 * Identify active sessions that are stale (ended >30 days ago) and not
 * referenced by any current state.  Returns the list of candidate sessions
 * that should be moved to archive storage.
 */
export function findArchiveCandidates(
  paths: RuntimePaths,
  state: HolisticState,
  currentTimeMs: number = Date.now(),
): SessionRecord[] {
  const referenced = referencedSessionIds(state, paths);
  const cutoffMs = currentTimeMs - STALE_SESSION_AGE_MS;
  const candidates: SessionRecord[] = [];

  for (const session of readSessionsFromDir(paths.sessionsDir)) {
    // Skip sessions without a valid endedAt — they are incomplete or malformed.
    if (!session.endedAt) {
      continue;
    }

    const endedMs = new Date(session.endedAt).getTime();
    if (Number.isNaN(endedMs)) {
      // Malformed timestamp — treat as referenced and leave in place.
      continue;
    }

    if (endedMs > cutoffMs) {
      // Not stale yet.
      continue;
    }

    if (referenced.has(session.id)) {
      // Still referenced — keep active.
      continue;
    }

    candidates.push(session);
  }

  return candidates;
}

/**
 * Run the session-hygiene policy: move stale unreferenced sessions from
 * active storage to archive storage.  Returns the list of session IDs
 * that were archived.
 *
 * This is the single shared codepath that both session-start/resume
 * entrypoints and the daemon tick invoke.
 */
export function runSessionHygiene(
  paths: RuntimePaths,
  state: HolisticState,
  currentTimeMs: number = Date.now(),
): string[] {
  const candidates = findArchiveCandidates(paths, state, currentTimeMs);
  const archived: string[] = [];

  for (const session of candidates) {
    const activePath = path.join(paths.sessionsDir, `${session.id}.json`);
    const archivePath = path.join(paths.archiveSessionsDir, `${session.id}.json`);

    try {
      // Write to archive first, then remove from active — crash-safe ordering.
      fs.writeFileSync(archivePath, JSON.stringify(session, null, 2) + "\n", "utf8");
      fs.unlinkSync(activePath);
      archived.push(session.id);
    } catch {
      // If the move fails for any reason, leave the session in active storage.
      // A future tick will retry.
    }
  }

  return archived;
}

/**
 * Reactivate an archived session by moving it from archive storage back to
 * active storage.  Returns the session record on success, or null if the
 * session is not found in the archive directory.
 *
 * This is the single shared helper that diff, handoff, and search flows
 * use when explicit reuse makes an archived session relevant again.
 */
export function reactivateArchivedSession(paths: RuntimePaths, sessionId: string): SessionRecord | null {
  const archivePath = path.join(paths.archiveSessionsDir, `${sessionId}.json`);
  if (!fs.existsSync(archivePath)) {
    return null;
  }

  let session: SessionRecord;
  try {
    session = JSON.parse(fs.readFileSync(archivePath, "utf8")) as SessionRecord;
  } catch {
    // Corrupt archive file — cannot reactivate.
    return null;
  }

  const activePath = path.join(paths.sessionsDir, `${sessionId}.json`);

  try {
    // Write to active first, then remove from archive — crash-safe ordering.
    fs.writeFileSync(activePath, JSON.stringify(session, null, 2) + "\n", "utf8");
    fs.unlinkSync(archivePath);
  } catch {
    // If the move fails, leave archive in place.
    return null;
  }

  return session;
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
  const recommendedCommand = hasCarryover
    ? renderRepoLocalCliCommands(state.docIndex.contextDir, "resume --continue")
    : renderRepoLocalCliCommands(state.docIndex.contextDir, "start-new --goal \"Describe the new task\"");

  return {
    status: hasCarryover ? "ready" : "empty",
    recap,
    choices,
    recommendedCommand,
    adapterDoc: state.docIndex.adapterDocs[agent] ?? state.docIndex.adapterDocs.codex,
    activeSession: state.activeSession,
    pendingWork: state.pendingWork,
    lastHandoff: state.lastHandoff,
  };
}

/**
 * Build a formatted startup greeting for agents.
 * Used by both MCP notification and manual /holistic command.
 * Returns null when there is no carryover context and no health diagnostics to surface.
 */
export function buildStartupGreeting(state: HolisticState, agent: AgentName): string | null {
  const payload = getResumePayload(state, agent);
  const diagnostics = evaluateHealthDiagnostics(state);
  const hasCarryover = payload.status !== "empty";

  if (!hasCarryover && diagnostics.warnings.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push("Holistic resume");
  lines.push("");

  if (hasCarryover) {
    lines.push(...payload.recap.map((line) => `- ${line}`));
    lines.push("");
    lines.push(`Choices: ${payload.choices.join(", ")}`);
    lines.push(`Adapter doc: ${payload.adapterDoc}`);
    lines.push(`Recommended command: ${payload.recommendedCommand}`);
    lines.push(`Long-term history: ${state.docIndex.historyDoc}`);
    lines.push(`Regression watch: ${state.docIndex.regressionDoc}`);
    lines.push(`Zero-touch architecture: ${state.docIndex.zeroTouchDoc}`);
  }

  if (diagnostics.warnings.length > 0) {
    if (hasCarryover) {
      lines.push("");
    }
    lines.push("System health warnings:");
    for (const warning of diagnostics.warnings) {
      lines.push(`- ${warning.message} [${warning.code}]`);
    }
  }

  return lines.join("\n");
}

export function loadSessionById(state: HolisticState, paths: RuntimePaths, sessionId: string): SessionRecord | null {
  if (state.activeSession?.id === sessionId) {
    return state.activeSession;
  }

  for (const session of readAllSessions(paths)) {
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

const COMPLETION_SIGNAL_KINDS: CompletionSignalKind[] = [
  "natural-breakpoint",
  "task-complete",
  "slice-complete",
  "milestone-complete",
];

const COMPLETION_SIGNAL_SOURCES: CompletionSignalSource[] = ["agent", "system"];

export function normalizeCompletionSignalMetadata(input: {
  kind?: unknown;
  source?: unknown;
  recordedAt?: unknown;
}): CompletionSignalMetadata | null {
  if (typeof input.kind !== "string" || typeof input.source !== "string") {
    return null;
  }

  if (!COMPLETION_SIGNAL_KINDS.includes(input.kind as CompletionSignalKind)) {
    return null;
  }

  if (!COMPLETION_SIGNAL_SOURCES.includes(input.source as CompletionSignalSource)) {
    return null;
  }

  const recordedAt = typeof input.recordedAt === "string" && input.recordedAt.trim().length > 0
    ? input.recordedAt
    : now();
  const recordedAtMs = new Date(recordedAt).getTime();
  if (Number.isNaN(recordedAtMs)) {
    return null;
  }

  return {
    kind: input.kind as CompletionSignalKind,
    source: input.source as CompletionSignalSource,
    recordedAt,
  };
}

function deriveCheckpointSessionSeed(rootDir: string, state: HolisticState): {
  title: string;
  goal: string;
  plan: string[];
} {
  if (state.lastHandoff) {
    return {
      title: "Continue previous handoff",
      goal: state.lastHandoff.nextAction,
      plan: ["Read HOLISTIC.md", state.lastHandoff.nextAction],
    };
  }

  const nextPending = state.pendingWork[0];
  if (nextPending) {
    return {
      title: nextPending.title,
      goal: nextPending.recommendedNextStep,
      plan: ["Read HOLISTIC.md", nextPending.recommendedNextStep],
    };
  }

  const inferred = inferSessionStart(rootDir, state);
  if (inferred.source !== "default") {
    return {
      title: inferred.title,
      goal: inferred.goal,
      plan: inferred.plan,
    };
  }

  return {
    title: "Capture work and prepare a clean handoff.",
    goal: "Capture work and prepare a clean handoff.",
    plan: ["Read HOLISTIC.md", "Confirm next step with the user"],
  };
}

export function checkpointState(rootDir: string, state: HolisticState, input: CheckpointInput): HolisticState {
  const agent = input.agent ?? state.activeSession?.agent ?? "unknown";
  const checkpointSeed = deriveCheckpointSessionSeed(rootDir, state);
  const baseSession = state.activeSession
    ? state.activeSession
    : createSession(
        agent,
        input.goal || checkpointSeed.goal,
        input.title || checkpointSeed.title,
        input.plan && input.plan.length > 0 ? input.plan : checkpointSeed.plan,
      );

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
  session.completionSignal = input.completionSignal ?? null;
  
  session.lastCheckpointReason = sanitizeText(input.reason || "manual");
  session.checkpointCount += 1;
  session.resumeRecap = buildResumeRecap({
    ...nextState,
    activeSession: session,
  });

  void emitAndonEvent({
    type: "session.checkpoint_created",
    sessionId: session.id,
    summary: input.reason || "Manual checkpoint saved",
    payload: { 
      checkpointCount: session.checkpointCount,
      objective: session.currentGoal || session.title,
      agentName: session.agent,
      currentPhase: "execute",
      startedAt: session.startedAt
    }
  });
  
  if (input.completionSignal) {
    void emitAndonEvent({
      type: "agent.summary_emitted",
      sessionId: session.id,
      summary: "Completion signal detected",
      payload: { 
        signal: input.completionSignal,
        objective: session.currentGoal || session.title,
        agentName: session.agent
      }
    });
  }

  return {
    ...nextState,
    activeSession: session,
    pendingCommit: null,
    lastAutoCheckpoint: now(),
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
  const filePath = path.join(paths.archiveSessionsDir, `${session.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2) + "\n", "utf8");
}

export function startNewSession(rootDir: string, state: HolisticState, agent: AgentName, goal: string, plan: string[], title?: string): HolisticState {
  // Run session hygiene on startup — archive stale unreferenced sessions.
  runSessionHygiene(getRuntimePaths(rootDir), state);

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

  void emitAndonEvent({
    type: "session.started",
    sessionId: nextState.activeSession.id,
    summary: `Session started: ${goal}`,
    payload: { 
      agentName: agent, 
      objective: goal || title || "Unknown objective",
      branch: refreshed.session.branch,
      startedAt: nextState.activeSession.startedAt
    }
  });
  void emitAndonEvent({
    type: "task.started",
    sessionId: nextState.activeSession.id,
    summary: `Task started: ${goal}`,
    payload: {
      agentName: agent, 
      objective: goal || title || "Unknown objective",
      startedAt: nextState.activeSession.startedAt
    }
  });

  return nextState;
}

export function continueFromLatest(rootDir: string, state: HolisticState, agent: AgentName): HolisticState {
  // Run session hygiene on resume — archive stale unreferenced sessions.
  runSessionHygiene(getRuntimePaths(rootDir), state);

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

const PASSIVE_CHECKPOINT_ELAPSED_MS = 2 * 60 * 60 * 1000;
const PASSIVE_CHECKPOINT_PENDING_FILE_THRESHOLD = 5;
const HEALTH_WARNING_STALE_CHECKPOINT_MS = 3 * 24 * 60 * 60 * 1000;
const HEALTH_WARNING_UNUSUAL_FILES_THRESHOLD = 50;
const AUTO_DRAFT_IDLE_MINUTES = 30;
const AUTO_DRAFT_WORK_MILESTONE_HOURS = 2;
const AUTO_DRAFT_WORK_MILESTONE_CHECKPOINTS = 5;

export function shouldCheckpointForElapsedTime(lastCheckpointAt: string | null | undefined, currentTimeMs = Date.now()): boolean {
  if (!lastCheckpointAt) {
    return false;
  }

  const lastCheckpointMs = new Date(lastCheckpointAt).getTime();
  if (Number.isNaN(lastCheckpointMs)) {
    return false;
  }

  return currentTimeMs - lastCheckpointMs >= PASSIVE_CHECKPOINT_ELAPSED_MS;
}

export function shouldCheckpointForPendingFiles(pendingFiles: string[] | null | undefined): boolean {
  if (!pendingFiles || pendingFiles.length === 0) {
    return false;
  }

  return pendingFiles.length >= PASSIVE_CHECKPOINT_PENDING_FILE_THRESHOLD;
}

function latestCheckpointTimestamp(state: HolisticState): string | null {
  const candidates = [state.lastAutoCheckpoint, state.passiveCapture?.lastCheckpointAt].filter((value): value is string => Boolean(value));
  if (candidates.length === 0) {
    return null;
  }

  const ranked = candidates
    .map((value) => ({ value, ms: new Date(value).getTime() }))
    .filter((item) => !Number.isNaN(item.ms))
    .sort((left, right) => right.ms - left.ms);

  return ranked[0]?.value ?? null;
}

export function evaluateHealthDiagnostics(state: HolisticState, currentTimeMs = Date.now()): HealthDiagnostics {
  const warnings: HealthWarning[] = [];
  const observedAt = new Date(currentTimeMs).toISOString();
  const lastCheckpointAt = latestCheckpointTimestamp(state);

  if (lastCheckpointAt) {
    const lastCheckpointMs = new Date(lastCheckpointAt).getTime();
    if (!Number.isNaN(lastCheckpointMs)) {
      const elapsedMs = currentTimeMs - lastCheckpointMs;
      if (elapsedMs >= HEALTH_WARNING_STALE_CHECKPOINT_MS) {
        const daysSinceCheckpoint = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
        warnings.push({
          code: "daemon-stale-checkpoint",
          message: "Daemon may not be checkpointing — no checkpoint has been recorded for 3+ days.",
          observedAt,
          inputs: {
            lastCheckpointAt,
            staleThresholdDays: 3,
            daysSinceCheckpoint,
          },
        });
      }
    }
  }

  const changedFileCount = Math.max(
    state.activeSession?.changedFiles.length ?? 0,
    state.passiveCapture?.pendingFiles.length ?? 0,
  );
  const hasCheckpointEvidence = Boolean(lastCheckpointAt || (state.activeSession?.checkpointCount ?? 0) > 0);
  if (changedFileCount >= HEALTH_WARNING_UNUSUAL_FILES_THRESHOLD && !hasCheckpointEvidence) {
    warnings.push({
      code: "unusual-files-without-checkpoint",
      message: "Unusual repo activity detected: 50+ changed files with no checkpoint evidence.",
      observedAt,
      inputs: {
        lastCheckpointAt,
        changedFileCount,
        changedFilesThreshold: HEALTH_WARNING_UNUSUAL_FILES_THRESHOLD,
        hasCheckpointEvidence,
      },
    });
  }

  return { warnings };
}

export function shouldDraftCompletionSignalHandoff(input: CompletionDraftDecisionInput): AutoHandoffDecision {
  if (!input.completionSignal || !input.sessionId || !input.sessionUpdatedAt) {
    return { should: false, reason: "" };
  }

  const existingDraft = input.existingDraft;
  if (
    existingDraft
    && existingDraft.sourceSessionId === input.sessionId
    && existingDraft.sourceSessionUpdatedAt === input.sessionUpdatedAt
    && existingDraft.reason === "completion-signal"
  ) {
    return { should: false, reason: "" };
  }

  return { should: true, reason: "completion-signal" };
}

export function shouldAutoDraftHandoff(session: SessionRecord, currentTimeMs = Date.now(), existingDraft: DraftHandoff | null = null): AutoHandoffDecision {
  const completionSignalDecision = shouldDraftCompletionSignalHandoff({
    sessionId: session.id,
    sessionUpdatedAt: session.updatedAt,
    completionSignal: session.completionSignal ?? null,
    existingDraft,
  });
  if (completionSignalDecision.should) {
    return completionSignalDecision;
  }

  const updatedAtMs = new Date(session.updatedAt).getTime();
  const startedAtMs = new Date(session.startedAt).getTime();
  if (Number.isNaN(updatedAtMs) || Number.isNaN(startedAtMs)) {
    return { should: false, reason: "" };
  }

  const idleMinutes = (currentTimeMs - updatedAtMs) / 60000;
  if (idleMinutes >= AUTO_DRAFT_IDLE_MINUTES) {
    return { should: true, reason: "idle-30min" };
  }

  const sessionHours = (currentTimeMs - startedAtMs) / 3600000;
  if (session.checkpointCount >= AUTO_DRAFT_WORK_MILESTONE_CHECKPOINTS && sessionHours >= AUTO_DRAFT_WORK_MILESTONE_HOURS) {
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

export function isSameDraftHandoff(left: DraftHandoff | null, right: DraftHandoff | null): boolean {
  if (!left || !right) {
    return false;
  }

  return left.sourceSessionId === right.sourceSessionId
    && left.sourceSessionUpdatedAt === right.sourceSessionUpdatedAt
    && left.reason === right.reason;
}

export function maybeWriteAutoDraftHandoff(paths: RuntimePaths, state: HolisticState, currentTimeMs = Date.now()): {
  changed: boolean;
  reason: AutoHandoffDecision["reason"];
  draft: DraftHandoff | null;
} {
  if (!state.activeSession) {
    return { changed: false, reason: "", draft: null };
  }

  const existingDraft = readDraftHandoff(paths);
  const decision = shouldAutoDraftHandoff(state.activeSession, currentTimeMs, existingDraft);
  if (!decision.should) {
    return { changed: false, reason: "", draft: existingDraft };
  }

  const nextDraft = buildAutoDraftHandoff(state, decision.reason);
  if (!nextDraft || isSameDraftHandoff(existingDraft, nextDraft)) {
    return { changed: false, reason: decision.reason, draft: existingDraft };
  }

  writeDraftHandoff(paths, nextDraft);
  return { changed: true, reason: decision.reason, draft: nextDraft };
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

  // Reactivate archived sessions that are explicitly referenced by exact id
  // in relatedSessions — free-form text in other fields is left untouched.
  const paths = getRuntimePaths(rootDir);
  if (input.relatedSessions) {
    for (const relatedId of input.relatedSessions) {
      if (relatedId && relatedId.startsWith("session-")) {
        reactivateArchivedSession(paths, relatedId);
      }
    }
  }

  void emitAndonEvent({
    type: "session.ended",
    sessionId: session.id,
    summary: `Handoff: ${summary}`,
    payload: { 
      nextAction,
      objective: session.currentGoal || session.title,
      agentName: session.agent,
      startedAt: session.startedAt
    }
  });

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
