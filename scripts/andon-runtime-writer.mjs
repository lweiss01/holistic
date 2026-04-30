import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const apiBaseUrl = (process.env.ANDON_API_BASE_URL ?? "http://127.0.0.1:4318").replace(/\/$/, "");
const repoRoot = process.env.HOLISTIC_REPO ?? process.cwd();
const intervalMs = Number(process.env.ANDON_RUNTIME_WRITER_INTERVAL_MS ?? "10000");
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

function buildStartedEvent(session, nowIso) {
  return {
    id: `runtime-writer-start-${session.id}-${Date.now()}`,
    sessionId: session.id,
    runtime: "codex",
    type: "session.started",
    phase: asPhase(session),
    source: "system",
    timestamp: nowIso,
    summary: `Runtime writer observed local session start: ${session.currentGoal || session.title || session.id}`,
    payload: {
      agentName: session.agent || "unknown",
      objective: session.currentGoal || session.title || "Unknown objective",
      startedAt: session.startedAt || nowIso,
      repoPath: repoRoot,
      worktreePath: repoRoot,
      branch: session.branch || null
    }
  };
}

function buildHeartbeatEvent(session, nowIso) {
  return {
    id: `runtime-writer-heartbeat-${session.id}-${Date.now()}`,
    sessionId: session.id,
    runtime: "codex",
    type: "agent.summary_emitted",
    phase: asPhase(session),
    source: "system",
    timestamp: nowIso,
    summary: session.latestStatus || "Runtime heartbeat: local session is active.",
    payload: {
      objective: session.currentGoal || session.title || "Unknown objective",
      agentName: session.agent || "unknown",
      startedAt: session.startedAt || nowIso,
      checkpointCount: session.checkpointCount ?? 0
    }
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

let lastObservedSessionId = null;
let lastHeartbeatAtMs = 0;

async function tick() {
  const stateFile = resolveStateFile();
  if (!fs.existsSync(stateFile)) {
    return;
  }

  const raw = fs.readFileSync(stateFile, "utf8");
  const state = parseState(raw);
  if (!state || !state.activeSession || state.activeSession.endedAt) {
    lastObservedSessionId = null;
    return;
  }

  const session = state.activeSession;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const events = [];

  const shouldEmitStart = lastObservedSessionId !== session.id;
  if (shouldEmitStart) {
    events.push(buildStartedEvent(session, nowIso));
  }

  const shouldEmitHeartbeat = nowMs - lastHeartbeatAtMs >= intervalMs;
  if (shouldEmitHeartbeat) {
    events.push(buildHeartbeatEvent(session, nowIso));
  }

  const posted = await postEvents(events);
  if (!posted) {
    return;
  }
  if (shouldEmitStart) {
    lastObservedSessionId = session.id;
    lastHeartbeatAtMs = 0;
  }
  if (shouldEmitHeartbeat) {
    lastHeartbeatAtMs = nowMs;
  }
}

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
  if (runOnce) {
    throw error;
  }
  process.stderr.write(`[andon-runtime-writer] startup retry scheduled: ${error instanceof Error ? error.message : String(error)}\n`);
});
process.stdout.write(`[andon-runtime-writer] Watching ${resolveStateFile()} every ${intervalMs}ms\n`);
