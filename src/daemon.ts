import { pathToFileURL } from "node:url";
import { captureRepoSnapshot, getGitSnapshot, isPortableHolisticPath } from './core/git.ts';
import { writeDerivedDocs } from './core/docs.ts';
import { refreshHolisticHooks } from './core/setup.ts';
import { requestAutoSync } from './core/sync.ts';
import {
  buildAutoDraftHandoff,
  checkpointState,
  getRuntimePaths,
  loadState,
  readDraftHandoff,
  saveState,
  shouldAutoDraftHandoff,
  startNewSession,
  withStateLock,
  writeDraftHandoff,
} from './core/state.ts';
import type { AgentName, DraftHandoff, HolisticState, PassiveCaptureState, RuntimePaths } from './core/types.ts';

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

const QUIET_TICKS_BEFORE_CHECKPOINT = 1;

function now(): string {
  return new Date().toISOString();
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

function uniqueFiles(files: string[]): string[] {
  return [...new Set(files)].sort();
}

function summarizeFiles(files: string[]): string {
  return files.slice(0, 3).join(", ");
}

function isSameDraft(left: DraftHandoff | null, right: DraftHandoff | null): boolean {
  if (!left || !right) {
    return false;
  }

  return left.sourceSessionId === right.sourceSessionId
    && left.sourceSessionUpdatedAt === right.sourceSessionUpdatedAt
    && left.reason === right.reason;
}

function persistLocked(rootDir: string, state: HolisticState, paths: RuntimePaths): HolisticState {
  writeDerivedDocs(paths, state);
  state.repoSnapshot = captureRepoSnapshot(rootDir);
  saveState(paths, state, { locked: true });
  return state;
}

function persistObservedState(state: HolisticState, paths: RuntimePaths, snapshot: Record<string, string>): HolisticState {
  state.repoSnapshot = snapshot;
  saveState(paths, state, { locked: true });
  return state;
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
    const snapshot = getGitSnapshot(rootDir, state.repoSnapshot ?? {});
    const tracker = {
      ...defaultPassiveCapture(),
      ...(state.passiveCapture ?? {}),
      pendingFiles: state.passiveCapture?.pendingFiles ?? [],
    };
    const meaningfulFiles = snapshot.changedFiles.filter((file) => !isPortableHolisticPath(file));
    const previousBranch = tracker.lastObservedBranch;
    const branchChanged = Boolean(previousBranch && previousBranch !== snapshot.branch);

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
        lastCheckpointAt: now(),
      };
      persistLocked(rootDir, nextState, lockedPaths);
      return {
        changed: true,
        summary: `Captured branch switch from ${previousBranch} to ${snapshot.branch}.`,
        syncTrigger: "checkpoint" as const,
      };
    }

    if (meaningfulFiles.length > 0) {
      const nextState: HolisticState = {
        ...state,
        passiveCapture: {
          ...tracker,
          lastObservedBranch: snapshot.branch,
          pendingFiles: uniqueFiles([...tracker.pendingFiles, ...meaningfulFiles]),
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
          lastCheckpointAt: now(),
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

    if (state.activeSession) {
      const decision = shouldAutoDraftHandoff(state.activeSession);
      if (decision.should) {
        const nextDraft = buildAutoDraftHandoff(state, decision.reason);
        const existingDraft = readDraftHandoff(lockedPaths);
        if (nextDraft && !isSameDraft(existingDraft, nextDraft)) {
          writeDraftHandoff(lockedPaths, nextDraft);
          return {
            changed: true,
            summary: `Saved an auto-drafted handoff for ${decision.reason}.`,
          };
        }
      }
    }

    return { changed: false, summary: "No repo changes detected." };
  });

  if (result.syncTrigger) {
    requestAutoSync(rootDir, result.syncTrigger);
  }

  return result;
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const intervalSeconds = Number.parseInt(firstFlag(parsed.flags, "interval", "30"), 10);
  const runOnce = firstFlag(parsed.flags, "once") === "true";
  const agent = asAgent(firstFlag(parsed.flags, "agent", "unknown"));

  // Refresh hooks once at daemon startup so hook templates stay current
  // even if the user updated holistic without running a CLI command.
  const hookResult = refreshHolisticHooks(rootDir);
  for (const warning of hookResult.warnings) {
    process.stderr.write(`${warning}\n`);
  }

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
