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

export function renderCliFallbackNote(contextDir: string, command: string): string {
  const fallback = repoLocalCliCommand(contextDir, command);
  return `If \`holistic\` is not on PATH, use the repo-local helper instead: Windows \`${fallback.windows}\`; macOS/Linux \`${fallback.posix}\`.`;
}
