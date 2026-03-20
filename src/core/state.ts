import fs from "node:fs";
import path from "node:path";
import { getGitSnapshot } from "./git.ts";
import { sanitizeList, sanitizeText } from "./redact.ts";
import type {
  AgentName,
  CheckpointInput,
  DocIndex,
  HandoffInput,
  HolisticState,
  PendingWorkItem,
  ResumePayload,
  RuntimePaths,
  SessionRecord,
} from "./types.ts";

function now(): string {
  return new Date().toISOString();
}

function projectNameFromRoot(rootDir: string): string {
  return path.basename(rootDir);
}

export function getRuntimePaths(rootDir: string): RuntimePaths {
  const holisticDir = path.join(rootDir, ".holistic");
  const contextDir = path.join(holisticDir, "context");
  return {
    rootDir,
    holisticDir,
    stateFile: path.join(holisticDir, "state.json"),
    sessionsDir: path.join(holisticDir, "sessions"),
    contextDir,
    adaptersDir: path.join(contextDir, "adapters"),
    masterDoc: path.join(rootDir, "HOLISTIC.md"),
    agentsDoc: path.join(rootDir, "AGENTS.md"),
    currentPlanDoc: path.join(contextDir, "current-plan.md"),
    protocolDoc: path.join(contextDir, "session-protocol.md"),
    historyDoc: path.join(contextDir, "project-history.md"),
    regressionDoc: path.join(contextDir, "regression-watch.md"),
    zeroTouchDoc: path.join(contextDir, "zero-touch.md"),
  };
}

function defaultDocIndex(): DocIndex {
  return {
    masterDoc: "HOLISTIC.md",
    stateFile: ".holistic/state.json",
    sessionsDir: ".holistic/sessions",
    contextDir: ".holistic/context",
    adapterDocs: {
      codex: ".holistic/context/adapters/codex.md",
      claude: ".holistic/context/adapters/claude-cowork.md",
      antigravity: ".holistic/context/adapters/antigravity.md",
    },
    currentPlanDoc: ".holistic/context/current-plan.md",
    protocolDoc: ".holistic/context/session-protocol.md",
    historyDoc: ".holistic/context/project-history.md",
    regressionDoc: ".holistic/context/regression-watch.md",
    zeroTouchDoc: ".holistic/context/zero-touch.md",
  };
}

export function createInitialState(rootDir: string): HolisticState {
  const timestamp = now();
  return {
    version: 1,
    projectName: projectNameFromRoot(rootDir),
    createdAt: timestamp,
    updatedAt: timestamp,
    activeSession: null,
    pendingWork: [],
    lastHandoff: null,
    docIndex: defaultDocIndex(),
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

export function loadState(rootDir: string): { state: HolisticState; paths: RuntimePaths; created: boolean } {
  const paths = getRuntimePaths(rootDir);
  ensureDirs(paths);

  if (!fs.existsSync(paths.stateFile)) {
    return { state: createInitialState(rootDir), paths, created: true };
  }

  const raw = fs.readFileSync(paths.stateFile, "utf8");
  const state = JSON.parse(raw) as HolisticState;
  const defaults = defaultDocIndex();
  state.docIndex = {
    ...defaults,
    ...(state.docIndex ?? {}),
    adapterDocs: {
      ...defaults.adapterDocs,
      ...(state.docIndex?.adapterDocs ?? {}),
    },
  };
  state.pendingWork = state.pendingWork ?? [];
  state.repoSnapshot = state.repoSnapshot ?? {};
  state.pendingCommit = state.pendingCommit ?? null;
  return { state, paths, created: false };
}

export function saveState(paths: RuntimePaths, state: HolisticState): void {
  state.updatedAt = now();
  fs.writeFileSync(paths.stateFile, JSON.stringify(state, null, 2) + "\n", "utf8");
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

function refreshSessionFromRepo(rootDir: string, state: HolisticState, session: SessionRecord): { state: HolisticState; session: SessionRecord } {
  const snapshot = getGitSnapshot(rootDir, state.repoSnapshot ?? {});
  return {
    state: {
      ...state,
      repoSnapshot: snapshot.snapshot,
    },
    session: {
      ...session,
      branch: snapshot.branch,
      changedFiles: snapshot.changedFiles,
      updatedAt: now(),
    },
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
  session.nextSteps = uniqueMerge(session.nextSteps, sanitizeList(input.next));
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

  const nextPending = state.pendingWork[0];
  if (nextPending) {
    const resumed = createSession(agent, nextPending.recommendedNextStep, nextPending.title, [
      "Read HOLISTIC.md",
      nextPending.recommendedNextStep,
    ]);
    resumed.latestStatus = sanitizeText(nextPending.context);
    resumed.nextSteps = [sanitizeText(nextPending.recommendedNextStep)];
    const refreshed = refreshSessionFromRepo(rootDir, state, resumed);
    refreshed.session.resumeRecap = buildResumeRecap({
      ...refreshed.state,
      activeSession: refreshed.session,
      pendingWork: state.pendingWork.slice(1),
    });
    return {
      ...refreshed.state,
      activeSession: refreshed.session,
      pendingWork: state.pendingWork.slice(1),
      pendingCommit: null,
    };
  }

  if (state.lastHandoff) {
    const resumed = createSession(agent, state.lastHandoff.nextAction, "Continue previous handoff", [
      "Read HOLISTIC.md",
      state.lastHandoff.nextAction,
    ]);
    resumed.latestStatus = state.lastHandoff.summary;
    resumed.blockers = [...state.lastHandoff.blockers];
    resumed.nextSteps = [state.lastHandoff.nextAction];
    const refreshed = refreshSessionFromRepo(rootDir, state, resumed);
    return {
      ...refreshed.state,
      activeSession: refreshed.session,
      pendingCommit: null,
    };
  }

  const fallback = createSession(agent, "Start a new task and capture the first checkpoint.");
  const refreshed = refreshSessionFromRepo(rootDir, state, fallback);
  return {
    ...refreshed.state,
    activeSession: refreshed.session,
    pendingCommit: null,
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
  session.nextSteps = uniqueMerge(session.nextSteps, sanitizeList(input.next));
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
      files: ["HOLISTIC.md", "AGENTS.md", ".holistic"],
    },
  };
}
