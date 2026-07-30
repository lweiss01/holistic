import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { andonAuthHeaders } from "./andon-auth.mjs";

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "::1", "[::1]", "localhost", "0.0.0.0"]);

/**
 * Refuse to forward session liveness anywhere but loopback. Mirrors
 * resolveAndonBaseUrl in src/core/andon.ts; see that function for the
 * reasoning. Returns null when delivery is not permitted.
 */
export function resolveWriterApiBaseUrl(raw = process.env.ANDON_API_BASE_URL ?? "http://127.0.0.1:4318") {
  let url;
  try {
    url = new URL(raw);
  } catch {
    process.stderr.write(`[andon-runtime-writer] ignoring malformed ANDON_API_BASE_URL (${raw}).\n`);
    return null;
  }
  if (!LOOPBACK_HOSTNAMES.has(url.hostname) && process.env.ANDON_ALLOW_REMOTE !== "1") {
    process.stderr.write(
      `[andon-runtime-writer] refusing to send session data to non-loopback host ${url.hostname}. `
      + "Set ANDON_ALLOW_REMOTE=1 to override.\n"
    );
    return null;
  }
  return raw.replace(/\/$/, "");
}

const apiBaseUrl = resolveWriterApiBaseUrl();

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
  // Prefer .holistic-local/state.json if it exists (checked lazily in tick),
  // otherwise fall back to .holistic/state.json. We don't check fs.existsSync
  // here to avoid TOCTOU and redundant stat syscalls; tick() will handle ENOENT.
  const localState = path.join(repoRoot, ".holistic-local", "state.json");
  return localState;
}

/**
 * Read state.json, falling back to .holistic/ when .holistic-local/ is absent.
 * Returns the path actually read so the turn-state sidecar is resolved next to
 * the SAME state file; resolving it next to a file we did not read would look
 * for sidecars in a directory the hooks never write to.
 */
function loadStateFileWithFallback() {
  const primary = resolveStateFile();
  try {
    return { raw: fs.readFileSync(primary, "utf8"), stateFile: primary };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    if (!primary.includes(".holistic-local")) {
      return null;
    }
    const fallback = primary.replace(".holistic-local", ".holistic");
    try {
      return { raw: fs.readFileSync(fallback, "utf8"), stateFile: fallback };
    } catch {
      return null;
    }
  }
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

export function isSessionFreshEnoughForRuntimeWriter(session, nowMs, maxAgeMs = staleSessionMs, turnSignalAtMs = null) {
  // Freshness is a function of the most recent DIRECT signal: a state.json
  // update OR a turn-state sidecar write. Turn hooks fire on every tool call
  // but deliberately never touch state.json, so during a long autonomous turn
  // state.json ages while the agent is demonstrably working; gating on
  // state.json alone silenced the writer mid-turn (no heartbeats, no
  // Stop->waiting assert) and Mission Control dropped the live card as cold.
  // A completion signal still does not force "fresh forever" — when both
  // state.json and the sidecar stop updating, liveness must decay naturally.
  const lastSignal = lastSessionSignalMs(session);
  const newestSignal = Math.max(lastSignal ?? Number.NEGATIVE_INFINITY, turnSignalAtMs ?? Number.NEGATIVE_INFINITY);
  if (!Number.isFinite(newestSignal)) {
    return false;
  }
  return nowMs - newestSignal <= maxAgeMs;
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

/**
 * Per-agent turn hooks record the turn boundary in a dedicated sidecar next to
 * state.json. They deliberately do not touch state.json itself: they fire on
 * every tool call and cannot take the state lock, so writing there loses
 * concurrent updates and can be read half-written.
 *
 * Each agent writes its OWN sidecar (turn-state.<agent>.json). A single shared
 * file could not answer "which agent ended its turn": the writer stamped every
 * signal with the active session's agent, so a Gemini turn rendered as a Claude
 * card, and two agents in one repo overwrote each other last-write-wins. The
 * unsuffixed turn-state.json remains supported as an unattributed legacy signal
 * for installs whose hooks predate the agent argument.
 */
export function turnStateAgentSlug(agent) {
  return String(agent ?? "").replace(/[^A-Za-z0-9._-]/g, "").toLowerCase();
}

export function resolveTurnStateFile(stateFile, agent = null) {
  const slug = turnStateAgentSlug(agent);
  const name = slug ? `turn-state.${slug}.json` : "turn-state.json";
  return path.join(path.dirname(stateFile), name);
}

function readSidecarFile(filePath) {
  try {
    const parsed = parseState(fs.readFileSync(filePath, "utf8"));
    const value = parsed?.turnState;
    return {
      turnState: value === "waiting" || value === "running" ? value : null,
      recordedAtMs: parseTimestampMs(parsed?.recordedAt),
      agent: typeof parsed?.agent === "string" ? turnStateAgentSlug(parsed.agent) : null
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the turn signal for ONE agent. Another agent's sidecar is never
 * returned -- not for turnState and not for freshness. Letting a foreign
 * sidecar through would both mis-attribute the status and keep an abandoned
 * session alive on a different agent's activity.
 */
export function readTurnStateSidecarRecord(stateFile, agent = null) {
  const empty = { turnState: null, recordedAtMs: null, agent: null };
  const slug = turnStateAgentSlug(agent);

  if (slug) {
    const own = readSidecarFile(resolveTurnStateFile(stateFile, slug));
    if (own && own.turnState) {
      return { ...own, agent: own.agent ?? slug };
    }
  }

  // Legacy shared sidecar: usable only when unattributed, or when it happens to
  // name the agent we are asking about.
  const legacy = readSidecarFile(resolveTurnStateFile(stateFile, null));
  if (!legacy || !legacy.turnState) {
    return empty;
  }
  if (legacy.agent && slug && legacy.agent !== slug) {
    return empty;
  }
  if (legacy.agent && !slug) {
    return empty;
  }
  return legacy;
}

export function readTurnStateSidecar(stateFile, agent = null) {
  return readTurnStateSidecarRecord(stateFile, agent).turnState;
}

/**
 * The agent whose turn signal is allowed to drive this session's card. An
 * unknown agent yields "", which restricts the lookup to the unattributed
 * legacy sidecar rather than matching some arbitrary agent's file.
 */
export function sessionTurnStateAgent(session) {
  const candidate = String(session?.agent || session?.runtime || "").trim();
  if (!candidate || candidate.toLowerCase() === "unknown") {
    return "";
  }
  return turnStateAgentSlug(candidate);
}

// Matches the legacy shared sidecar and every per-agent sidecar, but not the
// ".tmp" files the hooks write immediately before their atomic rename.
const TURN_STATE_FILE_PATTERN = /^turn-state(\.[A-Za-z0-9._-]+)?\.json$/;

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

export function buildRuntimeWriterEvents(session, nowMs, writerState, heartbeatIntervalMs = intervalMs, turnStateOverride = null, turnSignalAtMs = null) {
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

  const sessionIsFresh = isSessionFreshEnoughForRuntimeWriter(session, nowMs, staleSessionMs, turnSignalAtMs);
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

  // Lifecycle: prefer an explicit turnState written by per-agent turn hooks
  // (Stop->waiting, UserPromptSubmit->running) because it is a direct signal
  // at every turn boundary. The sidecar is authoritative; session.turnState is
  // kept as a fallback for state written by older hook versions. Fall back to
  // completionSignal inference only when neither is present.
  const turnState = turnStateOverride ?? session.turnState ?? null;
  const desiredLifecycle = turnState === "waiting" ? "waiting"
    : turnState === "running" ? "running"
    : session.completionSignal ? "waiting" : "running";
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
  if (!apiBaseUrl) {
    // Destination refused at startup; stay quiet rather than retrying forever.
    return false;
  }
  try {
    const response = await fetch(`${apiBaseUrl}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...andonAuthHeaders() },
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
  const loaded = loadStateFileWithFallback();
  if (!loaded) {
    return;
  }
  const state = parseState(loaded.raw);
  // Process ended sessions too (so the final session.completed fires once);
  // only bail when there is no active session at all.
  if (!state || !state.activeSession) {
    return;
  }

  const session = state.activeSession;
  const nowMs = Date.now();
  const writerState = loadWriterState();
  const turnSidecar = readTurnStateSidecarRecord(loaded.stateFile, sessionTurnStateAgent(session));
  const { events, shouldEmitStart, shouldEmitHeartbeat, shouldEmitComplete, assertedLifecycle, lifecycle } =
    buildRuntimeWriterEvents(session, nowMs, writerState, intervalMs, turnSidecar.turnState, turnSidecar.recordedAtMs);

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

  // Fast path: watch the turn-state sidecar and emit within ~50ms. The regular
  // polling interval is too slow for real-time running/waiting; when a per-agent
  // turn hook records a turn boundary we want Mission Control to reflect it
  // immediately. The 10s poll remains the authoritative source.
  //
  // Watch the containing directory rather than the sidecar itself: the file does
  // not exist until the first turn hook fires, and an atomic replace swaps the
  // inode, which drops a watch bound directly to the old file.
  const stateFileToWatch = resolveStateFile();
  const watchDir = path.dirname(stateFileToWatch);
  let lastKnownTurnState = null;
  let watchDebounceTimer = null;
  try {
    // Watch every turn-state sidecar, not one fixed name: each agent writes its
    // own file. Which one actually counts is decided per tick by matching the
    // active session's agent, so a foreign agent's write cannot flip this card.
    fs.watch(watchDir, { persistent: false }, (_eventType, filename) => {
      if (filename && !TURN_STATE_FILE_PATTERN.test(filename)) {
        return;
      }
      clearTimeout(watchDebounceTimer);
      watchDebounceTimer = setTimeout(() => {
        const loaded = loadStateFileWithFallback();
        if (!loaded) {
          return;
        }
        const watchedState = parseState(loaded.raw);
        const currentTurnState = readTurnStateSidecar(
          loaded.stateFile,
          sessionTurnStateAgent(watchedState?.activeSession)
        );
        if (currentTurnState !== null && currentTurnState !== lastKnownTurnState) {
          lastKnownTurnState = currentTurnState;
          tick().catch(() => {});
        }
      }, 50);
    });
  } catch {
    // fs.watch not available or directory missing; polling is the fallback
  }

  await tick().catch((error) => {
    process.stderr.write(`[andon-runtime-writer] startup retry scheduled: ${error instanceof Error ? error.message : String(error)}\n`);
  });
  process.stdout.write(`[andon-runtime-writer] Watching ${stateFileToWatch} every ${intervalMs}ms\n`);
}
