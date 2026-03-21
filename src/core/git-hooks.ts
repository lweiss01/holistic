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
}

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

export function installGitHooks(rootDir: string, gitDir: string | null, command: HookCommand): GitHookInstallResult {
  if (!gitDir || !fs.existsSync(gitDir)) {
    return { installed: false, hooks: [] };
  }

  const hooksDir = path.join(gitDir, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

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

  const postCommit = `#!/usr/bin/env sh
# Holistic auto-checkpoint after commit

cd '${shellQuote(rootDir)}' || exit 0

if [ -f "$PWD/${shellQuote(command.stateFilePath)}" ]; then
  COMMIT_SUBJECT=$(git -C "$PWD" log -1 --pretty=%s 2>/dev/null || echo post-commit)
  ${checkpointCommand} --status "Committed: $COMMIT_SUBJECT" >/dev/null 2>&1 || true
fi

exit 0
`;

  const postCheckout = `#!/usr/bin/env sh
# Holistic continuity checkpoint after branch switch

cd '${shellQuote(rootDir)}' || exit 0

if [ -f "$PWD/${shellQuote(command.stateFilePath)}" ] && [ "$3" = "1" ]; then
  ${branchSwitchCommand} >/dev/null 2>&1 || true
fi

exit 0
`;

  const prePush = `#!/usr/bin/env sh
# Holistic status reminder before push

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
`;

  fs.writeFileSync(path.join(hooksDir, "post-commit"), postCommit, { encoding: "utf8", mode: 0o755 });
  fs.writeFileSync(path.join(hooksDir, "post-checkout"), postCheckout, { encoding: "utf8", mode: 0o755 });
  fs.writeFileSync(path.join(hooksDir, "pre-push"), prePush, { encoding: "utf8", mode: 0o755 });

  return {
    installed: true,
    hooks: ["post-commit", "post-checkout", "pre-push"],
  };
}
