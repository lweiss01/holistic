import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { andonAuthHeaders } from "./andon-auth.mjs";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:4318";
const DEFAULT_TRANSPORT = "http_events";
const DEFAULT_SOURCE_TYPE = "local_cli";
const DEFAULT_AGENT_NAME = "Local Agent";
const DEFAULT_STALE_SESSION_MS = 10 * 60 * 1000;
const CAPABILITIES = [
  "session.started",
  "session.heartbeat",
  "work.started",
  "work.completed",
  "input.requested",
  "input.resolved",
  "review.requested",
  "review.resolved",
  "validation.passed",
  "validation.failed",
  "session.completed",
  "session.ended",
  "session.parked",
  "session.error"
];

const SOURCE_TYPES = new Set([
  "codex",
  "chatgpt",
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
  "http_event_source",
  "manual",
  "custom",
  "unknown"
]);

const PRIMARY_STATUSES = new Set([
  "running",
  "awaiting_assignment",
  "waiting_for_review",
  "waiting_on_human_input",
  "needs_intervention",
  "parked_idle",
  "done_historical",
  "unknown"
]);

function repoRoot() {
  return process.env.HOLISTIC_REPO ?? process.cwd();
}

function resolveApiBaseUrl(options = {}, state = null) {
  return String(options.api ?? process.env.ANDON_API_BASE_URL ?? state?.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export function resolveBeaconStateFile(options = {}) {
  if (options.stateFile) {
    return path.resolve(String(options.stateFile));
  }
  if (process.env.ANDON_SESSION_BEACON_STATE_FILE?.trim()) {
    return path.resolve(process.env.ANDON_SESSION_BEACON_STATE_FILE.trim());
  }
  return path.join(repoRoot(), ".holistic-local", "andon-session.json");
}

function asNonEmptyString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeSourceType(value) {
  const normalized = asNonEmptyString(value)?.toLowerCase().replace(/-/g, "_");
  if (!normalized) return DEFAULT_SOURCE_TYPE;
  return SOURCE_TYPES.has(normalized) ? normalized : "custom";
}

function normalizePrimaryStatus(value, fallback = "running") {
  const normalized = asNonEmptyString(value)?.toLowerCase().replace(/-/g, "_");
  if (!normalized) return fallback;
  if (normalized === "awaiting_assignment" || normalized === "awaiting_next_assignment" || normalized === "awaiting_next_step") return "awaiting_assignment";
  if (normalized === "awaiting_review" || normalized === "review_ready") return "waiting_for_review";
  if (normalized === "waiting_for_input" || normalized === "needs_input") return "waiting_on_human_input";
  if (normalized === "blocked" || normalized === "failed") return "needs_intervention";
  if (normalized === "parked" || normalized === "idle") return "parked_idle";
  if (normalized === "completed" || normalized === "done") return "done_historical";
  return PRIMARY_STATUSES.has(normalized) ? normalized : "unknown";
}

function runtimeForSourceType(sourceType) {
  if (sourceType === "http_event_source" || sourceType === "manual" || sourceType === "unknown") {
    return "unknown";
  }
  return sourceType;
}

function repoNameFromPath(value) {
  return path.basename(path.resolve(value || repoRoot())) || "unknown-repo";
}

function slug(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "unknown";
}

export function loadBeaconState(options = {}) {
  const stateFile = resolveBeaconStateFile(options);
  if (!fs.existsSync(stateFile)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return null;
  }
}

function parseTimestampMs(value) {
  const timestamp = asNonEmptyString(value);
  if (!timestamp) return null;
  const ms = new Date(timestamp).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function beaconStateAgeMs(state, nowIso = new Date().toISOString()) {
  const last = parseTimestampMs(state?.lastEventAt);
  const now = parseTimestampMs(nowIso);
  if (last === null || now === null) return null;
  return Math.max(0, now - last);
}

function formatAge(ms) {
  if (ms === null) return "unknown";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function saveBeaconState(state, options = {}) {
  const stateFile = resolveBeaconStateFile(options);
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function clearBeaconState(options = {}) {
  const stateFile = resolveBeaconStateFile(options);
  if (fs.existsSync(stateFile)) {
    fs.rmSync(stateFile);
  }
}

function mergeMetadata(command, options = {}, state = null) {
  const sourceType = normalizeSourceType(options.sourceType ?? options.source ?? state?.sourceType);
  const repoPath = asNonEmptyString(options.repoPath) ?? asNonEmptyString(options.worktree) ?? state?.repoPath ?? repoRoot();
  const worktreePath = asNonEmptyString(options.worktreePath) ?? asNonEmptyString(options.worktree) ?? state?.worktreePath ?? repoPath;
  const repo = asNonEmptyString(options.repo) ?? state?.repo ?? repoNameFromPath(repoPath);
  const sessionId = asNonEmptyString(options.session)
    ?? asNonEmptyString(options.sessionId)
    ?? state?.sessionId
    ?? `${slug(sourceType)}-${slug(repo)}-${Date.now().toString(36)}`;
  const sourceId = asNonEmptyString(options.sourceId) ?? state?.sourceId ?? `andon-beacon-${slug(sourceType)}-${slug(repo)}`;
  const sourceName = asNonEmptyString(options.sourceName) ?? state?.sourceName ?? `${sourceType.replace(/_/g, " ")} beacon`;
  const startedAt = asNonEmptyString(options.startedAt) ?? state?.startedAt ?? new Date().toISOString();
  const primaryStatus = command === "start"
    ? normalizePrimaryStatus(options.status ?? options.primaryStatus, "running")
    : normalizePrimaryStatus(options.status ?? options.primaryStatus ?? state?.primaryStatus, state?.primaryStatus ?? "running");

  return {
    sessionId,
    sourceId,
    sourceName,
    sourceType,
    platform: asNonEmptyString(options.platform) ?? state?.platform ?? null,
    transport: asNonEmptyString(options.transport) ?? state?.transport ?? DEFAULT_TRANSPORT,
    agentName: asNonEmptyString(options.agent) ?? asNonEmptyString(options.agentName) ?? state?.agentName ?? DEFAULT_AGENT_NAME,
    repo,
    repoPath,
    worktreePath,
    objective: asNonEmptyString(options.objective) ?? state?.objective ?? "Instrumented agent session",
    branch: asNonEmptyString(options.branch) ?? state?.branch ?? null,
    startedAt,
    primaryStatus,
    apiBaseUrl: resolveApiBaseUrl(options, state)
  };
}

function statusForTelemetryCommand(command, fallback = "running") {
  if (command === "start" || command === "begin" || command === "resume") return "running";
  if (command === "work-completed") return "awaiting_assignment";
  if (command === "request-input") return "waiting_on_human_input";
  if (command === "request-review") return "waiting_for_review";
  if (command === "input-resolved" || command === "review-resolved" || command === "resolve-input" || command === "resolve-review" || command === "validation-passed") return "running";
  if (command === "validation-failed" || command === "error") return "needs_intervention";
  if (command === "park") return "parked_idle";
  if (command === "complete" || command === "end") return "done_historical";
  return fallback;
}

function commandForCompatibilityStatus(primaryStatus) {
  if (primaryStatus === "running") return "begin";
  if (primaryStatus === "awaiting_assignment") return "work-completed";
  if (primaryStatus === "waiting_on_human_input") return "request-input";
  if (primaryStatus === "waiting_for_review") return "request-review";
  if (primaryStatus === "needs_intervention") return "validation-failed";
  if (primaryStatus === "parked_idle") return "park";
  if (primaryStatus === "done_historical") return "end";
  return "heartbeat";
}

export function eventTypeForCommand(command, primaryStatus = "running") {
  if (command === "start") return "session.started";
  if (command === "heartbeat") return "session.heartbeat";
  if (command === "begin" || command === "resume") return "work.started";
  if (command === "work-completed") return "work.completed";
  if (command === "request-input") return "input.requested";
  if (command === "input-resolved" || command === "resolve-input") return "input.resolved";
  if (command === "request-review") return "review.requested";
  if (command === "review-resolved" || command === "resolve-review") return "review.resolved";
  if (command === "validation-passed") return "validation.passed";
  if (command === "validation-failed") return "validation.failed";
  if (command === "complete" || command === "end") return "session.ended";
  if (command === "park") return "session.parked";
  if (command === "error") return "session.error";
  if (command === "status") {
    return eventTypeForCommand(commandForCompatibilityStatus(primaryStatus), primaryStatus);
  }
  throw new Error(`Unsupported beacon command: ${command}`);
}

export function buildBeaconEvent(command, options = {}, state = null, nowIso = new Date().toISOString()) {
  const metadata = mergeMetadata(command, options, state);
  const primaryStatus = command === "status"
    ? normalizePrimaryStatus(options.status ?? options.primaryStatus ?? state?.primaryStatus, state?.primaryStatus ?? "running")
    : statusForTelemetryCommand(command, metadata.primaryStatus);
  const telemetryCommand = command === "status" ? commandForCompatibilityStatus(primaryStatus) : command;
  const eventType = eventTypeForCommand(command, primaryStatus);
  const runtime = runtimeForSourceType(metadata.sourceType);
  const message = asNonEmptyString(options.message)
    ?? (command === "start"
      ? "Instrumented agent session started."
      : command === "heartbeat"
        ? "Instrumented agent session heartbeat."
      : command === "begin" || command === "resume"
          ? "Instrumented agent session started work."
        : command === "work-completed"
          ? "Instrumented agent session completed the current work."
        : command === "request-input"
          ? "Instrumented agent session requested operator input."
        : command === "input-resolved" || command === "resolve-input"
          ? "Instrumented agent session resolved operator input."
        : command === "request-review"
          ? "Instrumented agent session requested review."
        : command === "review-resolved" || command === "resolve-review"
          ? "Instrumented agent session resolved review."
        : command === "validation-failed"
          ? "Instrumented agent session reported failed validation."
        : command === "validation-passed"
          ? "Instrumented agent session reported passed validation."
        : command === "complete" || command === "end"
          ? "Instrumented agent session completed."
        : command === "park"
            ? "Instrumented agent session parked."
            : command === "error"
              ? "Instrumented agent session reported an error."
              : "Instrumented agent session status changed.");
  const eventSlug = `${command}-${nowIso.replace(/[^0-9A-Za-z]/g, "")}`;

  return {
    event: {
      id: asNonEmptyString(options.eventId) ?? `andon-beacon-${metadata.sessionId}-${eventSlug}`,
      sessionId: metadata.sessionId,
      runtime,
      taskId: null,
      type: eventType,
      phase: "execute",
      source: "system",
      timestamp: nowIso,
      summary: message,
      payload: {
        source: "andon.session-beacon",
        sourceId: metadata.sourceId,
        sourceName: metadata.sourceName,
        sourceType: metadata.sourceType,
        platform: metadata.platform,
        transport: metadata.transport,
        capabilities: CAPABILITIES,
        agentName: metadata.agentName,
        repo: metadata.repo,
        repoPath: metadata.repoPath,
        worktreePath: metadata.worktreePath,
        objective: metadata.objective,
        branch: metadata.branch,
        startedAt: metadata.startedAt,
        telemetryCommand,
        completedAcknowledged: command === "complete" || command === "end" ? true : undefined,
        acknowledged: command === "complete" || command === "end" ? true : undefined,
        message
      }
    },
    state: {
      ...metadata,
      primaryStatus,
      lastEventAt: nowIso
    }
  };
}

export function parseBeaconArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = rest[index + 1];
    if (next === undefined || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { command, options };
}

async function postBeaconEvent(eventOrEvents, options = {}) {
  const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];
  const response = await fetch(`${resolveApiBaseUrl(options, options.state)}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Andon API returned ${response.status}${body ? `: ${body}` : ""}`);
  }
  return response.json();
}

async function verifyMissionControlStatus(state, options = {}, expectedStatus = "running") {
  const apiBaseUrl = resolveApiBaseUrl(options, state);
  const response = await fetch(`${apiBaseUrl}/mission-control`, { headers: andonAuthHeaders() });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Andon API returned ${response.status} while verifying /mission-control${body ? `: ${body}` : ""}`);
  }
  const mission = await response.json();
  const session = Array.isArray(mission.sessions)
    ? mission.sessions.find((item) => item?.session?.id === state.sessionId)
    : null;
  const actualStatus = session?.primaryStatus ?? null;
  if (actualStatus !== expectedStatus) {
    throw new Error(`/mission-control did not reflect ${expectedStatus} for ${state.sessionId}; got ${actualStatus ?? "missing session"}`);
  }
  return {
    apiBaseUrl,
    sessionId: state.sessionId,
    primaryStatus: actualStatus,
    actionRequired: Boolean(session?.actionRequired),
    lastAgentSignalAt: session?.lastAgentSignalTimestamp ?? null
  };
}

async function verifyMissionControlAbsent(state, options = {}) {
  const apiBaseUrl = resolveApiBaseUrl(options, state);
  const response = await fetch(`${apiBaseUrl}/mission-control`, { headers: andonAuthHeaders() });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Andon API returned ${response.status} while verifying /mission-control${body ? `: ${body}` : ""}`);
  }
  const mission = await response.json();
  const session = Array.isArray(mission.sessions)
    ? mission.sessions.find((item) => item?.session?.id === state.sessionId)
    : null;
  if (session) {
    throw new Error(`/mission-control still includes ${state.sessionId}; got ${session.primaryStatus ?? "unknown status"}`);
  }
  return {
    apiBaseUrl,
    sessionId: state.sessionId,
    primaryStatus: "not_on_mission_control",
    actionRequired: false,
    lastAgentSignalAt: null
  };
}

export function inspectBeaconState(options = {}, nowIso = new Date().toISOString()) {
  const state = loadBeaconState(options);
  const apiUrl = resolveApiBaseUrl(options, state);
  const stateFile = resolveBeaconStateFile(options);
  if (!state) {
    return {
      active: false,
      apiBaseUrl: apiUrl,
      stateFile,
      message: "No active local Andon beacon session."
    };
  }
  const ageMs = beaconStateAgeMs(state, nowIso);
  return {
    active: true,
    sessionId: state.sessionId,
    sourceType: state.sourceType,
    agentName: state.agentName,
    repo: state.repo,
    objective: state.objective,
    primaryStatus: state.primaryStatus,
    lastEventAt: state.lastEventAt,
    lastEventAge: formatAge(ageMs),
    stale: ageMs !== null && ageMs > DEFAULT_STALE_SESSION_MS,
    apiBaseUrl: apiUrl,
    stateFile
  };
}

export function formatInspectOutput(inspect) {
  const lines = ["[andon-session-beacon] current session"];
  lines.push(`  API URL      : ${inspect.apiBaseUrl}`);
  lines.push(`  State file   : ${inspect.stateFile}`);
  if (!inspect.active) {
    lines.push("  Active       : no");
    lines.push(`  Next         : npm run andon:session -- start --source local_cli --agent "Local Agent" --repo <repo> --objective "<objective>"`);
    return `${lines.join("\n")}\n`;
  }
  lines.push("  Active       : yes");
  lines.push(`  Session id   : ${inspect.sessionId}`);
  lines.push(`  Source type  : ${inspect.sourceType}`);
  lines.push(`  Agent        : ${inspect.agentName}`);
  lines.push(`  Repo         : ${inspect.repo}`);
  lines.push(`  Objective    : ${inspect.objective}`);
  lines.push(`  Status       : ${inspect.primaryStatus}`);
  lines.push(`  Last event   : ${inspect.lastEventAt ?? "unknown"} (${inspect.lastEventAge} ago)`);
  lines.push(`  Freshness    : ${inspect.stale ? "stale local beacon state" : "local beacon state is recent"}`);
  lines.push(`  Next         : npm run andon:session -- heartbeat --message "Working"`);
  return `${lines.join("\n")}\n`;
}

function expectedMissionControlResult(command, state) {
  if (command === "complete" || command === "end") return "session leaves Mission Control and appears in History";
  if (command === "park") return "session leaves Running and is parked/historical";
  if (command === "error") return "session reports Needs Intervention until handled";
  if (command === "begin" || command === "resume") return `one Mission Control card for ${state.sessionId} with status running`;
  if (command === "work-completed") return `one Mission Control card for ${state.sessionId} with status awaiting_assignment`;
  if (command === "request-input") return `one Mission Control card for ${state.sessionId} with status waiting_on_human_input`;
  if (command === "input-resolved" || command === "resolve-input") return `one Mission Control card for ${state.sessionId} with status running`;
  if (command === "request-review") return `one Mission Control card for ${state.sessionId} with status waiting_for_review`;
  if (command === "review-resolved" || command === "resolve-review") return `one Mission Control card for ${state.sessionId} with status running`;
  if (command === "validation-failed") return `one Mission Control card for ${state.sessionId} with status needs_intervention`;
  return `one Mission Control card for ${state.sessionId} with status ${state.primaryStatus}`;
}

export function formatCommandOutput(command, event, state, options = {}, verification = null) {
  const lines = [`[andon-session-beacon] ${event.type} ${state.sessionId}`];
  lines.push(`  API URL      : ${resolveApiBaseUrl(options, state)}`);
  lines.push(`  State file   : ${resolveBeaconStateFile(options)}`);
  lines.push(`  Source type  : ${state.sourceType}`);
  lines.push(`  Agent        : ${state.agentName}`);
  lines.push(`  Repo         : ${state.repo}`);
  lines.push(`  Objective    : ${state.objective}`);
  lines.push(`  Status       : ${state.primaryStatus}`);
  if (verification) {
    lines.push(`  Verified     : /mission-control reports ${verification.primaryStatus}`);
  }
  lines.push(`  Expected     : ${expectedMissionControlResult(command, state)}`);
  if (command === "start") {
    lines.push(`  Next         : npm run andon:session -- heartbeat --message "Working"`);
  } else if (command === "begin" || command === "resume") {
    lines.push(`  Next         : npm run andon:session -- heartbeat --message "Working"`);
  } else if (command === "heartbeat") {
    lines.push(`  Next         : npm run andon:session -- work-completed --message "Work is complete; awaiting next assignment"`);
  } else if (command === "status") {
    lines.push(`  Next         : npm run andon:session -- complete --message "Work complete"`);
  } else {
    lines.push("  Next         : npm run andon:session -- inspect");
  }
  return `${lines.join("\n")}\n`;
}

export async function runBeaconCommand(command, options = {}, nowIso = new Date().toISOString()) {
  const supported = new Set(["start", "begin", "resume", "heartbeat", "status", "work-completed", "request-input", "input-resolved", "resolve-input", "request-review", "review-resolved", "resolve-review", "validation-passed", "validation-failed", "complete", "end", "park", "error", "inspect", "current", "info"]);
  if (!supported.has(command)) {
    throw new Error("Usage: andon-session-beacon.mjs <start|begin|resume|heartbeat|work-completed|request-input|request-review|validation-failed|complete|park|error|inspect> [--source local_cli] [--agent \"Local Agent\"] [--repo holistic] [--objective \"...\"]");
  }
  if (command === "inspect" || command === "current" || command === "info") {
    return { inspect: inspectBeaconState(options, nowIso) };
  }

  const existingState = command === "start" ? null : loadBeaconState(options);
  if (!existingState && (command === "begin" || command === "resume") && !options.session && !options.sessionId) {
    const hasStartArgs = Boolean(
      (options.source ?? options.sourceType)
      && (options.agent ?? options.agentName)
      && options.repo
      && options.objective
    );
    if (!hasStartArgs) {
      throw new Error(`No active beacon session found at ${resolveBeaconStateFile(options)}. Run: npm run andon:session -- start --source local_cli --agent "Local Agent" --repo <repo> --objective "<objective>"`);
    }
  } else if (!existingState && command !== "start" && !options.session && !options.sessionId) {
    throw new Error(`No active beacon session found at ${resolveBeaconStateFile(options)}. Run "start" first or pass --session.`);
  }
  const staleAgeMs = beaconStateAgeMs(existingState, nowIso);
  if (
    existingState
    && (command === "heartbeat" || command === "status" || command === "work-completed" || command === "request-input" || command === "input-resolved" || command === "resolve-input" || command === "request-review" || command === "review-resolved" || command === "resolve-review" || command === "validation-passed" || command === "validation-failed")
    && staleAgeMs !== null
    && staleAgeMs > DEFAULT_STALE_SESSION_MS
    && options.force !== true
  ) {
    throw new Error(`Local beacon session ${existingState.sessionId} is stale (${formatAge(staleAgeMs)} old). Run "npm run andon:session -- inspect", then start a new session or pass --force if this session is intentionally still active.`);
  }

  const effectiveCommand = (command === "begin" || command === "resume") && !existingState && !options.session && !options.sessionId
    ? "start"
    : command;
  const { event, state } = buildBeaconEvent(effectiveCommand, options, existingState, nowIso);
  const events = [event];
  if (command === "begin" || command === "resume") {
    const heartbeatIso = new Date(new Date(nowIso).getTime() + 1).toISOString();
    events.push(buildBeaconEvent("heartbeat", { ...options, message: options.message }, state, heartbeatIso).event);
  }
  const result = await postBeaconEvent(events.length === 1 ? event : events, { ...options, state });
  const nextState = events.length > 1
    ? { ...state, primaryStatus: "running", lastEventAt: events[events.length - 1].timestamp }
    : state;
  const expectedStatus = command === "begin" || command === "resume"
    ? "running"
    : command === "work-completed"
      ? "awaiting_assignment"
      : command === "request-input"
        ? "waiting_on_human_input"
        : command === "input-resolved" || command === "resolve-input"
          ? "running"
          : command === "request-review"
            ? "waiting_for_review"
            : command === "review-resolved" || command === "resolve-review" || command === "validation-passed"
              ? "running"
              : command === "validation-failed" || command === "error"
                ? "needs_intervention"
                : command === "status"
                  ? nextState.primaryStatus
                  : null;
  const verification = command === "complete" || command === "end"
    ? await verifyMissionControlAbsent(nextState, options)
    : expectedStatus
      ? await verifyMissionControlStatus(nextState, options, expectedStatus)
      : null;

  if (command === "complete" || command === "end" || command === "park") {
    if (!existingState || existingState.sessionId === nextState.sessionId) {
      clearBeaconState(options);
    }
  } else {
    saveBeaconState(nextState, options);
  }

  return { event, events, state: nextState, result, verification };
}

function isMainModule() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isMainModule()) {
  const { command, options } = parseBeaconArgs(process.argv.slice(2));
  try {
    const result = await runBeaconCommand(command, options);
    if (result.inspect) {
      process.stdout.write(formatInspectOutput(result.inspect));
    } else {
      process.stdout.write(formatCommandOutput(command, result.event, result.state, options, result.verification));
    }
  } catch (error) {
    process.stderr.write(`[andon-session-beacon] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
