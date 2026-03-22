import fs from "node:fs";
import path from "node:path";

export interface HookCommand {
  nodePath: string;
  scriptPath: string;
  useStripTypes: boolean;
  stateFilePath: string;
  syncPowerShellPath: string;
  syncShellPath: string;
}

export interface GitHookInstallResult {
  installed: boolean;
  hooks: string[];
  refreshed: string[];
  warnings: string[];
}

type HookName = "post-commit" | "post-checkout" | "pre-push";
type HookMode = "install" | "refresh";

const HOLISTIC_HOOK_MARKER = "HOLISTIC-MANAGED";
const SUPPORTED_HOOKS: HookName[] = ["post-commit", "post-checkout", "pre-push"];

function shellQuote(value: string): string {
  return value.replace(/'/g, `'\"'\"'`);
}

function commandLine(command: HookCommand, args: string[]): string {
  const parts = [
    `'${shellQuote(command.nodePath)}'`,
    command.useStripTypes ? "--experimental-strip-types" : "",
    `'${shellQuote(command.scriptPath)}'`,
    ...args.map((arg) => `'${shellQuote(arg)}'`),
  ].filter(Boolean);
  return parts.join(" ");
}

function normalizeHookContent(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function isHolisticManagedHook(content: string): boolean {
  return normalizeHookContent(content).includes(HOLISTIC_HOOK_MARKER);
}

function renderHookHeader(name: HookName): string {
  return `#!/usr/bin/env sh
# ${HOLISTIC_HOOK_MARKER} ${name}
`;
}

function renderGitHooks(rootDir: string, command: HookCommand): Record<HookName, string> {
  const checkpointCommand = commandLine(command, [
    "checkpoint",
    "--reason",
    "post-commit",
  ]);
  const branchSwitchCommand = commandLine(command, [
    "checkpoint",
    "--reason",
    "branch-switch",
    "--status",
    "Detected branch switch; review the new branch context.",
  ]);
  const statusCommand = commandLine(command, ["status"]);

  return {
    "post-commit": `${renderHookHeader("post-commit")}# Holistic auto-checkpoint after commit

cd '${shellQuote(rootDir)}' || exit 0

if [ -f "$PWD/${shellQuote(command.stateFilePath)}" ]; then
  COMMIT_SUBJECT=$(git -C "$PWD" log -1 --pretty=%s 2>/dev/null || echo post-commit)
  ${checkpointCommand} --status "Committed: $COMMIT_SUBJECT" >/dev/null 2>&1 || true
fi

exit 0
`,
    "post-checkout": `${renderHookHeader("post-checkout")}# Holistic continuity checkpoint after branch switch

cd '${shellQuote(rootDir)}' || exit 0

if [ -f "$PWD/${shellQuote(command.stateFilePath)}" ] && [ "$3" = "1" ]; then
  ${branchSwitchCommand} >/dev/null 2>&1 || true
fi

exit 0
`,
    "pre-push": `${renderHookHeader("pre-push")}# Holistic status reminder before push

cd '${shellQuote(rootDir)}' || exit 0

if [ -f "$PWD/${shellQuote(command.stateFilePath)}" ]; then
  echo ""
  echo "Holistic Status:"
  ${statusCommand} || true
  echo ""
  echo "Run the generated sync helper to update Holistic state:"
  echo "  Windows (PowerShell): powershell -NoProfile -ExecutionPolicy Bypass -File ./${shellQuote(command.syncPowerShellPath)}"
  echo "  macOS/Linux: ./${shellQuote(command.syncShellPath)}"
  echo ""
fi

exit 0
`,
  };
}

function writeHookFile(hooksDir: string, hookName: HookName, content: string): void {
  fs.writeFileSync(path.join(hooksDir, hookName), content, { encoding: "utf8", mode: 0o755 });
}

function syncGitHooks(rootDir: string, gitDir: string | null, command: HookCommand, mode: HookMode): GitHookInstallResult {
  if (!gitDir || !fs.existsSync(gitDir)) {
    return { installed: false, hooks: [], refreshed: [], warnings: [] };
  }

  const hooksDir = path.join(gitDir, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const rendered = renderGitHooks(rootDir, command);
  const warnings: string[] = [];
  const refreshed: string[] = [];
  const managedHooks = new Set<HookName>();
  let hasManagedExistingHook = false;

  for (const hookName of SUPPORTED_HOOKS) {
    const hookPath = path.join(hooksDir, hookName);
    if (!fs.existsSync(hookPath)) {
      continue;
    }

    const content = fs.readFileSync(hookPath, "utf8");
    if (isHolisticManagedHook(content)) {
      hasManagedExistingHook = true;
      managedHooks.add(hookName);
      continue;
    }

    warnings.push(`Skipped Holistic hook refresh for ${hookName}: existing hook is not Holistic-managed.`);
  }

  for (const hookName of SUPPORTED_HOOKS) {
    const hookPath = path.join(hooksDir, hookName);
    const expected = rendered[hookName];

    if (!fs.existsSync(hookPath)) {
      if (mode === "install" || hasManagedExistingHook) {
        writeHookFile(hooksDir, hookName, expected);
        refreshed.push(hookName);
        managedHooks.add(hookName);
      }
      continue;
    }

    const current = fs.readFileSync(hookPath, "utf8");
    if (!isHolisticManagedHook(current)) {
      continue;
    }

    managedHooks.add(hookName);
    if (normalizeHookContent(current) !== normalizeHookContent(expected)) {
      writeHookFile(hooksDir, hookName, expected);
      refreshed.push(hookName);
    }
  }

  return {
    installed: managedHooks.size > 0,
    hooks: [...managedHooks],
    refreshed,
    warnings,
  };
}

export function installGitHooks(rootDir: string, gitDir: string | null, command: HookCommand): GitHookInstallResult {
  return syncGitHooks(rootDir, gitDir, command, "install");
}

export function refreshGitHooks(rootDir: string, gitDir: string | null, command: HookCommand): GitHookInstallResult {
  return syncGitHooks(rootDir, gitDir, command, "refresh");
}
