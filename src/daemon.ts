import { pathToFileURL } from "node:url";
import { captureRepoSnapshot, getGitSnapshot } from './core/git.ts';
import { writeDerivedDocs } from './core/docs.ts';
import { checkpointState, loadState, saveState, startNewSession } from './core/state.ts';
import type { AgentName } from './core/types.ts';

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
  if (value === "codex" || value === "claude" || value === "antigravity") {
    return value;
  }
  return "unknown";
}

function persist(rootDir: string, state: ReturnType<typeof loadState>["state"], paths: ReturnType<typeof loadState>["paths"]): ReturnType<typeof loadState>["state"] {
  writeDerivedDocs(paths, state);
  state.repoSnapshot = captureRepoSnapshot(rootDir);
  saveState(paths, state);
  return state;
}

export function runDaemonTick(rootDir: string, agent: AgentName = "unknown"): { changed: boolean; summary: string } {
  const { state, paths } = loadState(rootDir);
  const snapshot = getGitSnapshot(rootDir, state.repoSnapshot ?? {});

  if (snapshot.changedFiles.length === 0) {
    return { changed: false, summary: "No repo changes detected." };
  }

  let nextState = state;
  if (!nextState.activeSession) {
    nextState = startNewSession(rootDir, nextState, agent, "Passively capture repo activity for the next agent handoff", [
      "Read HOLISTIC.md",
      "Review the detected file changes",
      "Confirm whether to continue planned work or start something new",
    ], "Passive session capture");
  }

  nextState = checkpointState(rootDir, nextState, {
    agent,
    reason: "daemon-auto",
    status: `Detected repo activity on ${snapshot.branch}; Holistic captured it automatically in the background.`,
    next: nextState.activeSession?.nextSteps.length
      ? nextState.activeSession.nextSteps
      : ["Review the recent file changes and confirm the intended task."],
    impacts: ["Background capture is preserving repo activity without requiring a manual session-start command."],
    regressions: ["Background capture reduces the chance that work is forgotten when agents switch tools or contexts."],
  });

  persist(rootDir, nextState, paths);
  return {
    changed: true,
    summary: `Captured ${snapshot.changedFiles.length} changed file(s) on ${snapshot.branch}.`,
  };
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const intervalSeconds = Number.parseInt(firstFlag(parsed.flags, "interval", "30"), 10);
  const runOnce = firstFlag(parsed.flags, "once") === "true";
  const agent = asAgent(firstFlag(parsed.flags, "agent", "unknown"));

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
