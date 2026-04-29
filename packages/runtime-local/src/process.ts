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

export interface LocalProcessCommand {
  command: string;
  args: string[];
}

export function resolveLocalProcessCommand(options: LocalProcessStartOptions): LocalProcessCommand {
  if (options.command) {
    return {
      command: options.command,
      args: options.args ?? []
    };
  }

  return {
    command: process.execPath,
    args: [fixtureRunnerPath]
  };
}

export function startLocalProcess(options: LocalProcessStartOptions): ChildProcessWithoutNullStreams {
  const command = resolveLocalProcessCommand(options);

  return spawn(command.command, command.args, {
    cwd: options.repoPath,
    env: {
      ...process.env,
      HOLISTIC_SESSION_ID: options.sessionId,
      HOLISTIC_PROMPT: options.prompt,
      HOLISTIC_REPO_PATH: options.repoPath,
      ...(options.env ?? {})
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}
