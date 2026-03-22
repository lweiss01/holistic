import path from "node:path";

function runtimeRootFromContextDir(contextDir: string): string {
  const normalized = contextDir.replaceAll("\\", "/");
  const runtimeRoot = path.posix.dirname(normalized);
  return runtimeRoot === "." ? "" : runtimeRoot;
}

export function repoLocalCliPaths(contextDir: string): { windows: string; posix: string; systemDir: string } {
  const runtimeRoot = runtimeRootFromContextDir(contextDir);
  const systemDir = runtimeRoot ? `${runtimeRoot}/system` : "system";
  const windowsDir = systemDir.replaceAll("/", "\\");
  return {
    windows: `.\\${windowsDir}\\holistic.cmd`,
    posix: `./${systemDir}/holistic`,
    systemDir,
  };
}

export function repoLocalCliCommand(contextDir: string, command: string): { windows: string; posix: string } {
  const base = repoLocalCliPaths(contextDir);
  const normalizedCommand = command.trim().replace(/^holistic\s+/, "");
  return {
    windows: `${base.windows} ${normalizedCommand}`.trim(),
    posix: `${base.posix} ${normalizedCommand}`.trim(),
  };
}

export function renderRepoLocalCliCommands(contextDir: string, command: string): string {
  const commands = repoLocalCliCommand(contextDir, command);
  return `Windows \`${commands.windows}\`; macOS/Linux \`${commands.posix}\``;
}

export function renderCliFallbackNote(contextDir: string, command: string): string {
  return `Use the repo-local Holistic helper in this repo: ${renderRepoLocalCliCommands(contextDir, command)}.`;
}
