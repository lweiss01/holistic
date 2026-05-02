import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const apiBaseUrl = (process.env.ANDON_API_BASE_URL ?? "http://127.0.0.1:4318").replace(/\/$/, "");
const repoRoot = process.env.HOLISTIC_REPO ?? process.cwd();
const intervalMs = Number(process.env.ANDON_RUNTIME_WRITER_INTERVAL_MS ?? "10000");
const staleSessionMs = Number(process.env.ANDON_RUNTIME_WRITER_STALE_SESSION_MS ?? String(20 * 60 * 1000));
const runOnce = process.argv.includes("--once");

function parseState(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function resolveStateFile() {
  const explicit = process.env.HOLISTIC_STATE_FILE?.trim();
  if (explicit) {
    return explicit;
  }
  const localState = path.join(repoRoot, ".holistic-local", "state.json");
  if (fs.existsSync(localState)) {
    return localState;
  }
  return path.join(repoRoot, ".holistic", "state.json");
}

function asPhase(session) {
  const branchy = session?.currentPlan?.join(" ").toLowerCase() ?? "";
  if (branchy.includes("test")) return "test";
  if (branchy.includes("research")) return "research";
  if (branchy.includes("plan")) return "plan";
  return "execute";
}

function asActivity(session) {
  const phase = asPhase(session);
  if (phase === "plan") return "planning";
  if (phase === "research") return "reading";
  if (phase === "test") return "running_tests";
  const status = String(session?.latestStatus ?? "").toLowerCase();
  if (status.includes("waiting")) return "waiting";
  if (status.includes("review")) return "reviewing";
  if (status.includes("idle")) return "idle";
  return "editing";
}

function asAgentName(session) {
  const candidate = String(session?.agent || session?.runtime || "").trim();
  return candidate && candidate.toLowerCase() !== "unknown" ? candidate : "codex";
}

function parseTimestampMs(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function lastSessionSignalMs(session) {
  return parseTimestampMs(session?.updatedAt)
    ?? parseTimestampMs(session?.lastUpdatedAt)
    ?? parseTimestampMs(session?.lastEventAt)
    ?? parseTimestampMs(session?.lastSignalAt)
    ?? parseTimestampMs(session?.endedAt)
    ?? parseTimestampMs(session?.startedAt);
}

export function isSessionFreshEnoughForRuntimeWriter(session, nowMs, maxAgeMs = staleSessionMs) {
  if (session?.completionSignal) {
    return true;
  }
  const lastSignal = lastSessionSignalMs(session);
  if (lastSignal === null) {
    return false;
  }
  return nowMs - lastSignal <= maxAgeMs;
}

export function buildStartedEvent(session, nowIso) {
  const startedAt = session.startedAt || nowIso;
  return {
    id: `runtime-writer-start-${session.id}`,
    sessionId: session.id,
    runtime: "codex",
    type: "session.started",
    phase: asPhase(session),
    source: "system",
    timestamp: startedAt,
    summary: `Runtime writer observed local session start: ${session.currentGoal || session.title || session.id}`,
    payload: {
      agentName: asAgentName(session),
      objective: session.currentGoal || session.title || "Unknown objective",
      startedAt,
      repoPath: repoRoot,
      worktreePath: repoRoot,
      branch: session.branch || null,
      activity: asActivity(session),
      source: "andon.runtime-writer"
    }
  };
}

export function buildHeartbeatEvent(session, nowIso) {
  return {
    id: `runtime-writer-heartbeat-${session.id}-${Date.now()}`,
    sessionId: session.id,
    runtime: "codex",
    type: "session.heartbeat",
    phase: asPhase(session),
    source: "system",
    timestamp: nowIso,
    summary: "Runtime writer heartbeat.",
    payload: {
      objective: session.currentGoal || session.title || "Unknown objective",
      agentName: asAgentName(session),
      startedAt: session.startedAt || nowIso,
      checkpointCount: session.checkpointCount ?? 0,
      activity: asActivity(session),
      latestStatus: session.latestStatus || null,
      sessionUpdatedAt: session.updatedAt || session.lastUpdatedAt || session.lastEventAt || null,
      source: "andon.runtime-writer"
    }
  };
}

export function buildCompletedEvent(session, nowIso) {
  return {
    id: `runtime-writer-completed-${session.id}`,
    sessionId: session.id,
    runtime: "codex",
    type: "session.completed",
    phase: asPhase(session),
    source: "system",
    timestamp: nowIso,
    summary: session.latestStatus || "Agent returned final output.",
    payload: {
      objective: session.currentGoal || session.title || "Unknown objective",
      agentName: asAgentName(session),
      startedAt: session.startedAt || nowIso,
      completedAt: nowIso,
      activity: "reviewing",
      latestStatus: session.latestStatus || null,
      sessionUpdatedAt: session.updatedAt || session.lastUpdatedAt || session.lastEventAt || null,
      completionSignal: session.completionSignal ?? null,
      source: "andon.runtime-writer"
    }
  };
}

function resolveWriterStateFile() {
  const explicit = process.env.ANDON_RUNTIME_WRITER_STATE_FILE?.trim();
  if (explicit) {
    return explicit;
  }
  return path.join(repoRoot, ".holistic-local", "andon-runtime-writer-state.json");
}

function loadWriterState() {
  const stateFile = resolveWriterStateFile();
  if (!fs.existsSync(stateFile)) {
    return { lastStartedSessionId: null, lastHeartbeatAtMs: 0 };
  }
  const parsed = parseState(fs.readFileSync(stateFile, "utf8"));
  return {
    lastStartedSessionId: typeof parsed?.lastStartedSessionId === "string" ? parsed.lastStartedSessionId : null,
    lastHeartbeatAtMs: Number.isFinite(Number(parsed?.lastHeartbeatAtMs)) ? Number(parsed.lastHeartbeatAtMs) : 0,
    lastCompletedSessionId: typeof parsed?.lastCompletedSessionId === "string" ? parsed.lastCompletedSessionId : null
  };
}

function saveWriterState(writerState) {
  const stateFile = resolveWriterStateFile();
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(writerState, null, 2)}\n`, "utf8");
}

export function buildRuntimeWriterEvents(session, nowMs, writerState, heartbeatIntervalMs = intervalMs) {
  const nowIso = new Date(nowMs).toISOString();
  const events = [];
  const sessionIsFresh = isSessionFreshEnoughForRuntimeWriter(session, nowMs);
  const shouldEmitComplete = Boolean(session.completionSignal) && writerState.lastCompletedSessionId !== session.id;

  if (!sessionIsFresh && !shouldEmitComplete) {
    return {
      events,
      shouldEmitStart: false,
      shouldEmitHeartbeat: false,
      shouldEmitComplete: false,
      skippedStaleSession: true
    };
  }

  const shouldEmitStart = writerState.lastStartedSessionId !== session.id;
  if (shouldEmitStart) {
    events.push(buildStartedEvent(session, nowIso));
  }

  if (shouldEmitComplete) {
    events.push(buildCompletedEvent(session, nowIso));
  }

  const shouldEmitHeartbeat = !session.completionSignal && nowMs - writerState.lastHeartbeatAtMs >= heartbeatIntervalMs;
  if (shouldEmitHeartbeat) {
    events.push(buildHeartbeatEvent(session, nowIso));
  }

  return {
    events,
    shouldEmitStart,
    shouldEmitHeartbeat,
    shouldEmitComplete,
    skippedStaleSession: false
  };
}

async function postEvents(events) {
  if (events.length === 0) {
    return true;
  }
  try {
    const response = await fetch(`${apiBaseUrl}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events })
    });
    if (!response.ok) {
      throw new Error(`runtime writer failed with ${response.status}`);
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[andon-runtime-writer] API unavailable, retrying: ${message}\n`);
    return false;
  }
}

async function tick() {
  const stateFile = resolveStateFile();
  if (!fs.existsSync(stateFile)) {
    return;
  }

  const raw = fs.readFileSync(stateFile, "utf8");
  const state = parseState(raw);
  if (!state || !state.activeSession || state.activeSession.endedAt) {
    return;
  }

  const session = state.activeSession;
  const nowMs = Date.now();
  const writerState = loadWriterState();
  const { events, shouldEmitStart, shouldEmitHeartbeat, shouldEmitComplete } = buildRuntimeWriterEvents(session, nowMs, writerState, intervalMs);

  const posted = await postEvents(events);
  if (!posted) {
    return;
  }
  if (shouldEmitStart) {
    writerState.lastStartedSessionId = session.id;
  }
  if (shouldEmitHeartbeat) {
    writerState.lastHeartbeatAtMs = nowMs;
  }
  if (shouldEmitComplete) {
    writerState.lastCompletedSessionId = session.id;
  }
  saveWriterState(writerState);
}

function isMainModule() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isMainModule()) {
  if (runOnce) {
    await tick();
    process.exit(0);
  }

  setInterval(() => {
    tick().catch((error) => {
      process.stderr.write(`[andon-runtime-writer] ${error instanceof Error ? error.message : String(error)}\n`);
    });
  }, intervalMs);

  await tick().catch((error) => {
    process.stderr.write(`[andon-runtime-writer] startup retry scheduled: ${error instanceof Error ? error.message : String(error)}\n`);
  });
  process.stdout.write(`[andon-runtime-writer] Watching ${resolveStateFile()} every ${intervalMs}ms\n`);
}
