import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const apiBaseUrl = (process.env.ANDON_API_BASE_URL ?? "http://127.0.0.1:4318").replace(/\/$/, "");

function findNearestHolisticRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let level = 0; level < 10; level++) {
    if (
      fs.existsSync(path.join(dir, 'holistic.repo.json')) ||
      fs.existsSync(path.join(dir, '.holistic-local')) ||
      fs.existsSync(path.join(dir, '.holistic'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

const repoRoot = process.env.HOLISTIC_REPO ?? findNearestHolisticRoot(process.cwd());
const intervalMs = Number(process.env.ANDON_RUNTIME_WRITER_INTERVAL_MS ?? "10000");
const staleSessionMs = Number(process.env.ANDON_RUNTIME_WRITER_STALE_SESSION_MS ?? String(20 * 60 * 1000));
// How often to RE-ASSERT the lifecycle status (running/waiting) even without a
// transition. Heartbeats only preserve status, so if the API independently
// changes the stored status (e.g. a restart reconciliation sweep parks a
// "running" row), the writer must re-assert to self-heal.
const lifecycleReassertMs = Number(process.env.ANDON_RUNTIME_WRITER_REASSERT_MS ?? "60000");
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
  return candidate && candidate.toLowerCase() !== "unknown" ? candidate : "unknown";
}

const sourceRuntimeTypes = new Set([
  "codex",
  "chatgpt",
  "claude-code",
  "claude_code",
  "cursor",
  "aider",
  "openhands",
  "jules",
  "github_copilot",
  "gsd",
  "symphony_runner",
  "local_cli",
  "file_heartbeat",
  "custom",
  "openharness"
]);

// Map Holistic agent names to Andon Mission Control sourceType. Agent-agnostic:
// every supported agent resolves to the correct source identity so Mission
// Control shows the real agent, not a generic "file_heartbeat". Mirrors the
// agent->sourceType contract used elsewhere in Holistic.
const agentSourceTypeAliases = {
  claude: "claude_code",
  "claude-code": "claude_code",
  claude_code: "claude_code",
  codex: "codex",
  cursor: "cursor",
  copilot: "github_copilot",
  github_copilot: "github_copilot",
  gemini: "custom",
  antigravity: "custom",
  goose: "custom",
  gsd: "gsd",
  gsd2: "gsd",
  local: "local_cli"
};

function normalizedSourceType(value) {
  const candidate = String(value || "").trim().toLowerCase();
  if (!candidate || candidate === "unknown") {
    return null;
  }
  const normalized = candidate.replace(/-/g, "_");
  if (agentSourceTypeAliases[candidate]) return agentSourceTypeAliases[candidate];
  if (agentSourceTypeAliases[normalized]) return agentSourceTypeAliases[normalized];
  if (sourceRuntimeTypes.has(candidate)) return candidate;
  if (sourceRuntimeTypes.has(normalized)) return normalized;
  if (normalized === "local") return "local_cli";
  return null;
}

function asRuntimeName(session) {
  return normalizedSourceType(session?.runtime) ?? normalizedSourceType(session?.agent) ?? "unknown";
}

function asSourceType(session) {
  return normalizedSourceType(session?.runtime) ?? normalizedSourceType(session?.agent) ?? "file_heartbeat";
}

function sourcePayload(session) {
  const platform = normalizedSourceType(session?.runtime) ?? normalizedSourceType(session?.agent);
  return {
    source: "andon.runtime-writer",
    sourceId: "holistic-file-state-writer",
    sourceName: "Holistic file-state writer",
    sourceType: asSourceType(session),
    platform,
    transport: "cli_writer",
    capabilities: ["session.started", "session.heartbeat", "session.completed"]
  };
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
  // Freshness is purely a function of how recently state.json was updated.
  // A completion signal no longer forces "fresh forever" — a turn-complete
  // signal means the agent is WAITING for the human, not that the session is
  // immortal. If state.json stops updating, liveness must decay naturally.
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
    runtime: asRuntimeName(session),
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
      ...sourcePayload(session)
    }
  };
}

export function buildHeartbeatEvent(session, nowIso) {
  return {
    id: `runtime-writer-heartbeat-${session.id}-${Date.now()}`,
    sessionId: session.id,
    runtime: asRuntimeName(session),
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
      ...sourcePayload(session)
    }
  };
}

export function buildCompletedEvent(session, nowIso) {
  return {
    id: `runtime-writer-completed-${session.id}`,
    sessionId: session.id,
    runtime: asRuntimeName(session),
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
      ...sourcePayload(session)
    }
  };
}

// Emitted when the active session carries a turn-completion signal but has NOT
// ended (endedAt is null). The agent finished its turn and is waiting for the
// human. Agent-agnostic: any agent that records a completion checkpoint lands
// here regardless of which tool it runs in.
export function buildNeedsInputEvent(session, nowIso) {
  return {
    id: `runtime-writer-needs-input-${session.id}-${Date.now()}`,
    sessionId: session.id,
    runtime: asRuntimeName(session),
    type: "session.needs_input",
    phase: asPhase(session),
    source: "system",
    timestamp: nowIso,
    summary: session.latestStatus || "Agent finished its turn and is waiting for input.",
    payload: {
      objective: session.currentGoal || session.title || "Unknown objective",
      agentName: asAgentName(session),
      startedAt: session.startedAt || nowIso,
      activity: "waiting",
      latestStatus: session.latestStatus || null,
      sessionUpdatedAt: session.updatedAt || session.lastUpdatedAt || session.lastEventAt || null,
      ...sourcePayload(session)
    }
  };
}

// Emitted on the transition back into active work (waiting -> running, or to
// clear a stale non-running status) so Mission Control flips off "waiting".
export function buildWorkStartedEvent(session, nowIso) {
  return {
    id: `runtime-writer-work-started-${session.id}-${Date.now()}`,
    sessionId: session.id,
    runtime: asRuntimeName(session),
    type: "work.started",
    phase: asPhase(session),
    source: "system",
    timestamp: nowIso,
    summary: session.latestStatus || "Agent resumed active work.",
    payload: {
      objective: session.currentGoal || session.title || "Unknown objective",
      agentName: asAgentName(session),
      startedAt: session.startedAt || nowIso,
      activity: asActivity(session),
      latestStatus: session.latestStatus || null,
      sessionUpdatedAt: session.updatedAt || session.lastUpdatedAt || session.lastEventAt || null,
      ...sourcePayload(session)
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
    return { lastStartedSessionId: null, lastHeartbeatAtMs: 0, lastCompletedSessionId: null, lastLifecycle: null };
  }
  const parsed = parseState(fs.readFileSync(stateFile, "utf8"));
  return {
    lastStartedSessionId: typeof parsed?.lastStartedSessionId === "string" ? parsed.lastStartedSessionId : null,
    lastHeartbeatAtMs: Number.isFinite(Number(parsed?.lastHeartbeatAtMs)) ? Number(parsed.lastHeartbeatAtMs) : 0,
    lastCompletedSessionId: typeof parsed?.lastCompletedSessionId === "string" ? parsed.lastCompletedSessionId : null,
    lastLifecycle: parsed?.lastLifecycle === "running" || parsed?.lastLifecycle === "waiting" || parsed?.lastLifecycle === "completed"
      ? parsed.lastLifecycle
      : null,
    lastLifecycleAssertAtMs: Number.isFinite(Number(parsed?.lastLifecycleAssertAtMs)) ? Number(parsed.lastLifecycleAssertAtMs) : 0
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
  const sessionEnded = Boolean(session.endedAt);

  // A truly-ended session (endedAt set) emits session.completed exactly once,
  // regardless of freshness, then goes quiet. This is the ONLY path to
  // "completed" — a turn-completion signal on an active session does not end it.
  if (sessionEnded) {
    const shouldEmitComplete = writerState.lastCompletedSessionId !== session.id;
    if (shouldEmitComplete) {
      events.push(buildCompletedEvent(session, nowIso));
    }
    return {
      events,
      shouldEmitStart: false,
      shouldEmitHeartbeat: false,
      shouldEmitComplete,
      skippedStaleSession: false,
      lifecycle: "completed"
    };
  }

  const sessionIsFresh = isSessionFreshEnoughForRuntimeWriter(session, nowMs);
  if (!sessionIsFresh) {
    return {
      events,
      shouldEmitStart: false,
      shouldEmitHeartbeat: false,
      shouldEmitComplete: false,
      skippedStaleSession: true,
      lifecycle: writerState.lastLifecycle ?? null
    };
  }

  const shouldEmitStart = writerState.lastStartedSessionId !== session.id;
  if (shouldEmitStart) {
    events.push(buildStartedEvent(session, nowIso));
  }

  // Lifecycle: a turn-completion signal (without endedAt) means the agent
  // finished its turn and is WAITING for the human. Otherwise it is running.
  const desiredLifecycle = session.completionSignal ? "waiting" : "running";
  const priorLifecycle = writerState.lastLifecycle ?? (shouldEmitStart ? "running" : null);
  const transitioned = desiredLifecycle !== priorLifecycle;

  // Assert the lifecycle status on a transition OR on a periodic re-assert
  // interval. The API's runtime status hint only registers "running" from
  // work.started and "waiting" from session.needs_input (session.started and
  // heartbeats do not count), so the writer must actively assert — and keep
  // asserting — the true status so it survives independent status changes.
  const reassertDue = nowMs - (writerState.lastLifecycleAssertAtMs ?? 0) >= lifecycleReassertMs;
  let assertedLifecycle = false;
  if (transitioned || reassertDue) {
    if (desiredLifecycle === "waiting") {
      events.push(buildNeedsInputEvent(session, nowIso));
    } else {
      events.push(buildWorkStartedEvent(session, nowIso));
    }
    assertedLifecycle = true;
  }

  // Heartbeat preserves the current status and keeps liveness fresh. Always
  // heartbeat on the interval, including while waiting, so the session stays
  // visible (as needs_action) rather than decaying to disconnected.
  const shouldEmitHeartbeat = nowMs - writerState.lastHeartbeatAtMs >= heartbeatIntervalMs;
  if (shouldEmitHeartbeat) {
    events.push(buildHeartbeatEvent(session, nowIso));
  }

  return {
    events,
    shouldEmitStart,
    shouldEmitHeartbeat,
    shouldEmitComplete: false,
    assertedLifecycle,
    transitioned,
    skippedStaleSession: false,
    lifecycle: desiredLifecycle
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
  // Process ended sessions too (so the final session.completed fires once);
  // only bail when there is no active session at all.
  if (!state || !state.activeSession) {
    return;
  }

  const session = state.activeSession;
  const nowMs = Date.now();
  const writerState = loadWriterState();
  const { events, shouldEmitStart, shouldEmitHeartbeat, shouldEmitComplete, assertedLifecycle, lifecycle } =
    buildRuntimeWriterEvents(session, nowMs, writerState, intervalMs);

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
  if (lifecycle) {
    writerState.lastLifecycle = lifecycle;
  }
  if (assertedLifecycle) {
    writerState.lastLifecycleAssertAtMs = nowMs;
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
