import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface LocalProcessStartOptions {
  sessionId: string;
  repoPath: string;
  prompt: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureRunnerPath = resolve(currentDirectory, "../fixtures/fake-runner.mjs");

const ALLOW_CUSTOM_COMMAND_ENV = "HOLISTIC_ALLOW_LOCAL_COMMAND";
const COMMAND_ALLOWLIST_ENV = "HOLISTIC_LOCAL_COMMAND_ALLOWLIST";

/** Only variables matching this prefix may be supplied by a task request. */
const SAFE_ENV_KEY = /^HOLISTIC_[A-Z0-9_]*$/;

function commandAllowlist(): string[] {
  return (process.env[COMMAND_ALLOWLIST_ENV] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Resolve the executable for a local runtime task.
 *
 * `options.command` originates from the `metadata.localCommand` field of an
 * HTTP request body, so treating it as trusted turns POST /runtime/tasks into
 * arbitrary command execution. A caller-supplied command therefore requires
 * both an explicit opt-in and membership in an operator-controlled allowlist;
 * without those the adapter only ever runs its bundled fixture runner.
 */
export function resolveLocalProcessCommand(options: LocalProcessStartOptions): LocalProcessCommand {
  if (!options.command) {
    return {
      command: process.execPath,
      args: [fixtureRunnerPath]
    };
  }

  if (process.env[ALLOW_CUSTOM_COMMAND_ENV] !== "1") {
    throw new Error(
      `Refusing to run caller-supplied localCommand ${JSON.stringify(options.command)}. `
      + `Set ${ALLOW_CUSTOM_COMMAND_ENV}=1 and list the executable in ${COMMAND_ALLOWLIST_ENV} to enable it.`
    );
  }

  const allowlist = commandAllowlist();
  if (!allowlist.includes(options.command)) {
    throw new Error(
      `localCommand ${JSON.stringify(options.command)} is not listed in ${COMMAND_ALLOWLIST_ENV}.`
    );
  }

  return {
    command: options.command,
    args: options.args ?? []
  };
}

export interface LocalProcessCommand {
  command: string;
  args: string[];
}

/**
 * Request-supplied environment is filtered to the HOLISTIC_ namespace. Merging
 * it wholesale would let a task request set NODE_OPTIONS, LD_PRELOAD, or PATH,
 * each of which is a code-execution vector even with a fixed command.
 */
function safeExtraEnv(env: Record<string, string> | undefined): Record<string, string> {
  if (!env) {
    return {};
  }

  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (SAFE_ENV_KEY.test(key)) {
      safe[key] = value;
    }
  }
  return safe;
}

export function startLocalProcess(options: LocalProcessStartOptions): ChildProcessWithoutNullStreams {
  const command = resolveLocalProcessCommand(options);

  const child = spawn(command.command, command.args, {
    cwd: options.repoPath,
    env: {
      ...process.env,
      HOLISTIC_SESSION_ID: options.sessionId,
      HOLISTIC_PROMPT: options.prompt,
      HOLISTIC_REPO_PATH: options.repoPath,
      ...safeExtraEnv(options.env)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  // A failed spawn emits 'error'; unhandled, it terminates the runtime service.
  child.on("error", (error: Error) => {
    process.stderr.write(
      `[runtime-local] spawn failed for session ${options.sessionId}: ${error.message}\n`
    );
  });

  return child;
}
