#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const cliPath = path.resolve(repoRoot, "dist/cli.js");
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [cliPath, ...args], {
  stdio: "inherit",
  cwd: process.cwd(),
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

/**
 * Resolve the Holistic directory and tracked file names for the current repo.
 * Reads holistic.repo.json if present, otherwise falls back to defaults.
 */
function resolveRepoPaths(rootDir) {
  const defaults = {
    holisticDir: ".holistic",
    masterDoc: "HOLISTIC.md",
    agentsDoc: "AGENTS.md",
  };

  const configPath = path.join(rootDir, "holistic.repo.json");
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const runtime = config.runtime ?? {};
      return {
        holisticDir: runtime.holisticDir ?? defaults.holisticDir,
        masterDoc: runtime.masterDoc ?? defaults.masterDoc,
        agentsDoc: runtime.agentsDoc ?? defaults.agentsDoc,
      };
    } catch {
      // Fall through to defaults on corrupt config.
    }
  }

  return defaults;
}

if (args[0] === "handoff") {
  const rootDir = process.cwd();
  const repoPaths = resolveRepoPaths(rootDir);
  const pendingCommitPath = path.join(rootDir, repoPaths.holisticDir, "context", "pending-commit.txt");
  if (fs.existsSync(pendingCommitPath)) {
    const message = fs.readFileSync(pendingCommitPath, "utf8").split(/\r?\n/)[0]?.trim();
    if (message) {
      const addResult = spawnSync("git", ["add", "--", repoPaths.masterDoc, repoPaths.agentsDoc, repoPaths.holisticDir], {
        stdio: "inherit",
        cwd: rootDir,
      });
      if ((addResult.status ?? 1) === 0) {
        const commitResult = spawnSync("git", ["commit", "-m", message], {
          stdio: "inherit",
          cwd: rootDir,
        });
        if ((commitResult.status ?? 1) === 0) {
          const syncScript = path.join(rootDir, repoPaths.holisticDir, "system", process.platform === "win32" ? "sync-state.ps1" : "sync-state.sh");
          if (fs.existsSync(syncScript)) {
            if (process.platform === "win32") {
              spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", syncScript], {
                stdio: "inherit",
                cwd: rootDir,
              });
            } else {
              spawnSync("/bin/sh", [syncScript], {
                stdio: "inherit",
                cwd: rootDir,
              });
            }
          }
          spawnSync(process.execPath, [cliPath, "internal-mark-commit", "--message", message], {
            stdio: "inherit",
            cwd: rootDir,
          });
        }
      }
    }
  }
}

process.exit(0);
