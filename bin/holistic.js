#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const cliPath = path.resolve(repoRoot, "src/cli.ts");
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, ...args], {
  stdio: "inherit",
  cwd: process.cwd(),
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (args[0] === "handoff") {
  const pendingCommitPath = path.join(process.cwd(), ".holistic", "context", "pending-commit.txt");
  if (fs.existsSync(pendingCommitPath)) {
    const message = fs.readFileSync(pendingCommitPath, "utf8").split(/\r?\n/)[0]?.trim();
    if (message) {
      const addResult = spawnSync("git", ["add", "--", "HOLISTIC.md", "AGENTS.md", ".holistic"], {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      if ((addResult.status ?? 1) === 0) {
        const commitResult = spawnSync("git", ["commit", "-m", message], {
          stdio: "inherit",
          cwd: process.cwd(),
        });
        if ((commitResult.status ?? 1) === 0) {
          const syncScript = path.join(process.cwd(), ".holistic", "system", process.platform === "win32" ? "sync-state.ps1" : "sync-state.sh");
          if (fs.existsSync(syncScript)) {
            if (process.platform === "win32") {
              spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", syncScript], {
                stdio: "inherit",
                cwd: process.cwd(),
              });
            } else {
              spawnSync("/bin/sh", [syncScript], {
                stdio: "inherit",
                cwd: process.cwd(),
              });
            }
          }
          spawnSync(process.execPath, ["--experimental-strip-types", cliPath, "internal-mark-commit", "--message", message], {
            stdio: "inherit",
            cwd: process.cwd(),
          });
        }
      }
    }
  }
}

process.exit(0);
