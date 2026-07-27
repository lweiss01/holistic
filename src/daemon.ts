import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { captureRepoSnapshot, getGitSnapshot, isPortableHolisticPath } from './core/git.ts';
import { writeDerivedDocs } from './core/docs.ts';
import { readExistingRuntimeConfig, refreshHolisticHooks } from './core/setup.ts';
import { requestAutoSync } from './core/sync.ts';
import {
  checkpointState,
  getRuntimePaths,
  loadState,
  maybeWriteAutoDraftHandoff,
  runSessionHygiene,
  saveState,
  shouldCheckpointForElapsedTime,
  shouldCheckpointForPendingFiles,
  startNewSession,
  withStateLock,
} from './core/state.ts';
import type { AgentName, HolisticState, PassiveCaptureState, RuntimePaths } from './core/types.ts';

interface ParsedArgs {
  flags: Record<string, string[]>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string[]> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const flag = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[flag] = ["true"];
      continue;
    }
    flags[flag] ??= [];
    flags[flag].push(next);
    index += 1;
  }
  return { flags };
}

function firstFlag(flags: Record<string, string[]>, name: string, fallback = ""): string {
  return flags[name]?.[0] ?? fallback;
}

function asAgent(value: string): AgentName {
  if (value === "codex" || value === "claude" || value === "antigravity" || value === "gemini" || value === "copilot" || value === "cursor" || value === "goose" || value === "gsd" || value === "gsd2") {
    return value;
  }
  return "unknown";
}

function inferAgentFromEnvironment(): AgentName {
  if (process.env.CURSOR_AGENT === "1" || process.env.CURSOR_EXTENSION_HOST_ROLE === "agent-exec") {
    return "cursor";
  }
  if (process.env.CLAUDECODE === "1" || process.env.CLAUDE_DESKTOP === "1") {
    return "claude";
  }
  return "unknown";
}

const QUIET_TICKS_BEFORE_CHECKPOINT = 1;

function defaultPassiveCapture(): PassiveCaptureState {
  return {
    lastObservedBranch: null,
    pendingFiles: [],
    activityTicks: 0,
    quietTicks: 0,
    lastCheckpointAt: null,
  };
}

function uniqueFiles(files: string[]): string[] {
  return [...new Set(files)].sort();
}

function summarizeFiles(files: string[]): string {
  return files.slice(0, 3).join(", ");
}

function persistLocked(rootDir: string, state: HolisticState, paths: RuntimePaths): { success: boolean; state?: HolisticState; error?: string } {
  const config = readExistingRuntimeConfig(paths);
  writeDerivedDocs(paths, state, { mode: "runtime", safeMode: config.safeMode });
  state.repoSnapshot = captureRepoSnapshot(rootDir);
  const saveResult = saveState(paths, state, { locked: true });
  if (!saveResult.success) {
    return { success: false, error: saveResult.error };
  }
  return { success: true, state };
}

function persistObservedState(state: HolisticState, paths: RuntimePaths, snapshot: Record<string, string>): { success: boolean; state?: HolisticState; error?: string } {
  state.repoSnapshot = snapshot;
  const saveResult = saveState(paths, state, { locked: true });
  if (!saveResult.success) {
    return { success: false, error: saveResult.error };
  }
  return { success: true, state };
}

function ensurePassiveSession(rootDir: string, state: HolisticState, agent: AgentName): HolisticState {
  if (state.activeSession) {
    return state;
  }

  return startNewSession(rootDir, state, agent, "Passively capture repo activity for the next agent handoff", [
    "Read HOLISTIC.md",
    "Review the detected repo activity",
    "Confirm whether to continue planned work or start something new",
  ], "Passive session capture");
}

export function runDaemonTick(rootDir: string, agent: AgentName = "unknown"): { changed: boolean; summary: string; syncTrigger?: "checkpoint" } {
  const paths = getRuntimePaths(rootDir);
  const result = withStateLock(paths, () => {
    const { state, paths: lockedPaths } = loadState(rootDir);

    // Run session hygiene before passive-capture decisions.
    runSessionHygiene(lockedPaths, state);

    const snapshot = getGitSnapshot(rootDir, state.repoSnapshot ?? {});
    const tracker = {
      ...defaultPassiveCapture(),
      ...(state.passiveCapture ?? {}),
      pendingFiles: state.passiveCapture?.pendingFiles ?? [],
    };
    const meaningfulFiles = snapshot.changedFiles.filter((file) => !isPortableHolisticPath(file));
    const previousBranch = tracker.lastObservedBranch;
    const branchChanged = Boolean(previousBranch && previousBranch !== snapshot.branch);
    const currentTimeMs = Date.now();
    const checkpointedAt = new Date(currentTimeMs).toISOString();

    if (branchChanged) {
      let nextState = ensurePassiveSession(rootDir, state, agent);
      nextState = checkpointState(rootDir, nextState, {
        agent,
        reason: "branch-switch",
        status: `Detected a branch switch from ${previousBranch} to ${snapshot.branch}; Holistic captured a continuity checkpoint automatically.`,
        next: nextState.activeSession?.nextSteps.length
          ? nextState.activeSession.nextSteps
          : ["Review the new branch and confirm the intended task."],
        impacts: ["Holistic now records branch switches as explicit continuity checkpoints."],
        regressions: ["Branch changes should create a single checkpoint instead of repeated polling noise."],
      });
      nextState.passiveCapture = {
        ...defaultPassiveCapture(),
        lastObservedBranch: snapshot.branch,
        lastCheckpointAt: checkpointedAt,
      };
      const persistResult = persistLocked(rootDir, nextState, lockedPaths);
      if (!persistResult.success) {
        console.error(`Daemon: Failed to persist state: ${persistResult.error}`);
      }
      return {
        changed: true,
        summary: `Captured branch switch from ${previousBranch} to ${snapshot.branch}.`,
        syncTrigger: "checkpoint" as const,
      };
    }

    const nextPendingFiles = uniqueFiles([...tracker.pendingFiles, ...meaningfulFiles]);

    if (meaningfulFiles.length > 0 && shouldCheckpointForPendingFiles(nextPendingFiles)) {
      let nextState = ensurePassiveSession(rootDir, state, agent);
      const fileSummary = summarizeFiles(nextPendingFiles);
      nextState = checkpointState(rootDir, nextState, {
        agent,
        reason: "daemon-auto-threshold",
        status: `Detected ${nextPendingFiles.length} meaningful file(s) without waiting for a quiet point; Holistic captured a proactive checkpoint automatically.`,
        next: nextState.activeSession?.nextSteps.length
          ? nextState.activeSession.nextSteps
          : [`Review recent changes in ${fileSummary || "the repo"} and confirm the intended task.`],
        impacts: ["Passive capture now checkpoints immediately when five or more meaningful files accumulate."],
        regressions: ["Threshold-based passive checkpoints should clear pending state so the next tick does not refire immediately."],
      });
      nextState.passiveCapture = {
        ...defaultPassiveCapture(),
        lastObservedBranch: snapshot.branch,
        lastCheckpointAt: checkpointedAt,
      };
      persistLocked(rootDir, nextState, lockedPaths);
      return {
        changed: true,
        summary: `Captured an immediate passive checkpoint for ${nextPendingFiles.length} file(s) on ${snapshot.branch}.`,
        syncTrigger: "checkpoint" as const,
      };
    }

    if (meaningfulFiles.length > 0) {
      const nextState: HolisticState = {
        ...state,
        passiveCapture: {
          ...tracker,
          lastObservedBranch: snapshot.branch,
          pendingFiles: nextPendingFiles,
          activityTicks: tracker.activityTicks + 1,
          quietTicks: 0,
        },
      };
      persistObservedState(nextState, lockedPaths, snapshot.snapshot);
      return {
        changed: false,
        summary: `Buffered ${nextState.passiveCapture?.pendingFiles.length ?? 0} changed file(s) for a quieter passive checkpoint.`,
      };
    }

    if (tracker.pendingFiles.length > 0) {
      const quietTicks = tracker.quietTicks + 1;
      if (quietTicks >= QUIET_TICKS_BEFORE_CHECKPOINT) {
        let nextState = ensurePassiveSession(rootDir, state, agent);
        const fileSummary = summarizeFiles(tracker.pendingFiles);
        nextState = checkpointState(rootDir, nextState, {
          agent,
          reason: tracker.activityTicks > 1 || tracker.pendingFiles.length > 1 ? "daemon-auto-cluster" : "daemon-auto",
          status: `Detected a quiet point after repo activity on ${snapshot.branch}; Holistic captured ${tracker.pendingFiles.length} file(s) automatically.`,
          next: nextState.activeSession?.nextSteps.length
            ? nextState.activeSession.nextSteps
            : [`Review recent changes in ${fileSummary || "the repo"} and confirm the intended task.`],
          impacts: ["Passive capture now clusters nearby repo changes before checkpointing, which reduces noise while preserving continuity."],
          regressions: ["Passive checkpoints should cluster nearby edits instead of firing on every poll tick."],
        });
        nextState.passiveCapture = {
          ...defaultPassiveCapture(),
          lastObservedBranch: snapshot.branch,
          lastCheckpointAt: checkpointedAt,
        };
        persistLocked(rootDir, nextState, lockedPaths);
        return {
          changed: true,
          summary: `Captured a passive checkpoint for ${tracker.pendingFiles.length} file(s) on ${snapshot.branch}.`,
          syncTrigger: "checkpoint" as const,
        };
      }

      const nextState: HolisticState = {
        ...state,
        passiveCapture: {
          ...tracker,
          lastObservedBranch: snapshot.branch,
          quietTicks,
        },
      };
      persistObservedState(nextState, lockedPaths, snapshot.snapshot);
      return { changed: false, summary: "Waiting for repo activity to settle before checkpointing." };
    }

    if (shouldCheckpointForElapsedTime(tracker.lastCheckpointAt, currentTimeMs)) {
      let nextState = ensurePassiveSession(rootDir, state, agent);
      nextState = checkpointState(rootDir, nextState, {
        agent,
        reason: "daemon-auto-elapsed",
        status: `Detected 2 hours of elapsed time since the last passive checkpoint on ${snapshot.branch}; Holistic captured a proactive checkpoint automatically even without new meaningful file changes.`,
        next: nextState.activeSession?.nextSteps.length
          ? nextState.activeSession.nextSteps
          : ["Review the current session status and confirm the intended next task."],
        impacts: ["Passive capture now checkpoints after two hours even when no meaningful repo changes occurred."],
        regressions: ["Elapsed-time passive checkpoints should not require pending files or repeated trigger loops."],
      });
      nextState.passiveCapture = {
        ...defaultPassiveCapture(),
        lastObservedBranch: snapshot.branch,
        lastCheckpointAt: checkpointedAt,
      };
      persistLocked(rootDir, nextState, lockedPaths);
      return {
        changed: true,
        summary: `Captured an elapsed-time passive checkpoint on ${snapshot.branch}.`,
        syncTrigger: "checkpoint" as const,
      };
    }

    if (tracker.lastObservedBranch !== snapshot.branch || Object.keys(state.repoSnapshot ?? {}).length === 0) {
      const nextState: HolisticState = {
        ...state,
        passiveCapture: {
          ...tracker,
          lastObservedBranch: snapshot.branch,
        },
      };
      persistObservedState(nextState, lockedPaths, snapshot.snapshot);
    }

    const autoDraft = maybeWriteAutoDraftHandoff(lockedPaths, state, currentTimeMs);
    if (autoDraft.changed) {
      return {
        changed: true,
        summary: `Saved an auto-drafted handoff for ${autoDraft.reason}.`,
      };
    }

    return { changed: false, summary: "No repo changes detected." };
  });

  if (result.syncTrigger) {
    requestAutoSync(rootDir, result.syncTrigger);
  }

  return result;
}

const ANDON_API_PORT = 4318;
const ANDON_DASHBOARD_PORT = 5173;

export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

export function isDaemonRunning(pidFile: string): boolean {
  if (!fs.existsSync(pidFile)) return false;
  const existing = Number(fs.readFileSync(pidFile, "utf8").trim());
  if (!existing || existing === process.pid) return false;
  try {
    process.kill(existing, 0);
    return true;
  } catch {
    return false;
  }
}

function killTree(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

/**
 * Attach an error handler before returning a child. A failed spawn emits an
 * 'error' event, and an unhandled 'error' on a ChildProcess terminates the
 * whole daemon. Passive capture must survive an Andon service failing to start.
 */
function superviseChild(child: ChildProcess, label: string): ChildProcess {
  child.once("error", (error: Error) => {
    process.stderr.write(`${label} failed to start: ${error.message}\n`);
  });
  child.once("exit", (code) => {
    if (code !== 0 && code !== null) {
      process.stderr.write(`${label} exited with code ${code}.\n`);
    }
  });
  return child;
}

/**
 * The Andon add-on lives in the Holistic product repo, not in the repos
 * Holistic is installed into. Detect it rather than assuming it: a published
 * install has no services/ or apps/ tree, and spawning those paths
 * unconditionally leaves every user with failing child processes.
 * Set HOLISTIC_ANDON=0 to opt out even when the add-on is present.
 */
function andonAvailability(rootDir: string): { enabled: boolean; apiScript: string; writerScript: string; dashboardDir: string } {
  const apiScript = path.join(rootDir, "services/andon-api/src/server.ts");
  const writerScript = path.join(rootDir, "scripts/andon-runtime-writer.mjs");
  const dashboardDir = path.join(rootDir, "apps/andon-dashboard");
  const optedOut = process.env.HOLISTIC_ANDON === "0";
  const present = fs.existsSync(apiScript) && fs.existsSync(writerScript);
  return { enabled: present && !optedOut, apiScript, writerScript, dashboardDir };
}

async function startAndonServices(rootDir: string): Promise<ChildProcess[]> {
  const andon = andonAvailability(rootDir);
  if (!andon.enabled) {
    return [];
  }

  const owned: ChildProcess[] = [];

  if (await isPortFree(ANDON_API_PORT)) {
    const api = spawn(
      process.execPath,
      ["--experimental-strip-types", andon.apiScript],
      { cwd: rootDir, env: { ...process.env, HOLISTIC_REPO: rootDir }, stdio: "ignore" }
    );
    owned.push(superviseChild(api, "Andon API"));
    process.stdout.write(`Holistic: Andon API starting on port ${ANDON_API_PORT}.\n`);
  }

  if (fs.existsSync(andon.dashboardDir) && await isPortFree(ANDON_DASHBOARD_PORT)) {
    // Node 20.12+/22+ refuses to spawn .cmd/.bat without a shell, so npm.cmd
    // must be routed through the command interpreter on Windows. This mirrors
    // scripts/andon-dev.mjs, which already handles it correctly.
    const dashboard = process.platform === "win32"
      ? spawn(
          process.env.ComSpec || "cmd.exe",
          ["/d", "/s", "/c", `npm --prefix "${andon.dashboardDir}" run dev`],
          { cwd: rootDir, stdio: "ignore", windowsHide: true }
        )
      : spawn(
          "npm",
          ["--prefix", andon.dashboardDir, "run", "dev"],
          { cwd: rootDir, stdio: "ignore" }
        );
    owned.push(superviseChild(dashboard, "Andon dashboard"));
    process.stdout.write(`Holistic: Andon dashboard starting on port ${ANDON_DASHBOARD_PORT}.\n`);
  }

  // Agent-agnostic liveness forwarder. Reads the repo's state.json and POSTs
  // session.started/heartbeat/needs_input/completed to the Andon API for
  // WHATEVER agent owns the active session (claude, codex, cursor, gsd, ...).
  // This is the single agent-agnostic source of Mission Control liveness — it
  // replaces per-agent tool hooks, which only ever worked for Claude Code and
  // broke in worktrees. Started whenever Andon is present because the daemon is
  // the sole owner per repo (pidFile guard) and the writer retries while the
  // API warms up.
  const writer = spawn(
    process.execPath,
    [andon.writerScript],
    { cwd: rootDir, env: { ...process.env, HOLISTIC_REPO: rootDir }, stdio: "ignore" }
  );
  owned.push(superviseChild(writer, "Andon runtime-writer"));
  process.stdout.write("Holistic: Andon runtime-writer forwarding session liveness.\n");

  return owned;
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const intervalSeconds = Number.parseInt(firstFlag(parsed.flags, "interval", "30"), 10);
  const runOnce = firstFlag(parsed.flags, "once") === "true";
  const agent = asAgent(firstFlag(parsed.flags, "agent", inferAgentFromEnvironment()));

  // Derive the pidfile from the repo's configured runtime directory rather than
  // hard-coding ".holistic-local", which only exists in the Holistic product
  // repo's dogfooding setup. A normal install uses ".holistic", and neither
  // directory is guaranteed to exist yet, so create it before writing.
  const pidFile = path.join(getRuntimePaths(rootDir).holisticDir, "daemon.pid");

  // Bail if another daemon instance is already running for this repo.
  if (!runOnce && isDaemonRunning(pidFile)) {
    process.stdout.write(`Holistic daemon already running (pid ${fs.readFileSync(pidFile, "utf8").trim()}).\n`);
    return 0;
  }

  if (!runOnce) {
    fs.mkdirSync(path.dirname(pidFile), { recursive: true });
    fs.writeFileSync(pidFile, String(process.pid), "utf8");
  }

  // Refresh hooks once at daemon startup so hook templates stay current
  // even if the user updated holistic without running a CLI command.
  const hookResult = refreshHolisticHooks(rootDir);
  for (const warning of hookResult.warnings) {
    process.stderr.write(`${warning}\n`);
  }

  // A one-shot tick is used by hooks and tests. Starting long-lived Andon
  // services only to kill them immediately wastes work and can disturb an
  // already-running Andon setup, so skip them entirely in that mode.
  const andonChildren = runOnce ? [] : await startAndonServices(rootDir);

  const tick = () => {
    const result = runDaemonTick(rootDir, agent);
    if (result.changed) {
      process.stdout.write(`${new Date().toISOString()} ${result.summary}\n`);
    }
  };

  tick();
  if (runOnce) {
    return 0;
  }

  process.stdout.write(`Holistic daemon watching ${rootDir} every ${intervalSeconds}s.\n`);
  const timer = setInterval(tick, intervalSeconds * 1000);
  const stop = () => {
    clearInterval(timer);
    for (const child of andonChildren) killTree(child);
    try { fs.unlinkSync(pidFile); } catch { /* already gone */ }
    process.stdout.write("Holistic daemon stopped.\n");
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return await new Promise<number>(() => undefined);
}

const isEntrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isEntrypoint) {
  main().then((code) => {
    process.exit(code);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
