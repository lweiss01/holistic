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

// Tracks whether the handoff post-processing below succeeded. Exiting 0
// unconditionally hid failures of the git and sync commands from CI.
let postHandoffFailed = false;

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
      if ((addResult.status ?? 1) !== 0) {
        process.stderr.write("holistic: failed to stage Holistic docs for the handoff commit.\n");
        postHandoffFailed = true;
      } else {
        const commitResult = spawnSync("git", ["commit", "-m", message], {
          stdio: "inherit",
          cwd: rootDir,
        });
        if ((commitResult.status ?? 1) !== 0) {
          process.stderr.write("holistic: handoff docs were staged but the commit failed.\n");
          postHandoffFailed = true;
        } else {
          const syncScript = path.join(rootDir, repoPaths.holisticDir, "system", process.platform === "win32" ? "sync-state.ps1" : "sync-state.sh");
          if (fs.existsSync(syncScript)) {
            const syncResult = process.platform === "win32"
              ? spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", syncScript], { stdio: "inherit", cwd: rootDir })
              : spawnSync("/bin/sh", [syncScript], { stdio: "inherit", cwd: rootDir });
            if ((syncResult.status ?? 1) !== 0) {
              // Sync is best effort: the commit already landed, so report it
              // without failing the command.
              process.stderr.write("holistic: portable state sync did not complete.\n");
            }
          }
          const markResult = spawnSync(process.execPath, [cliPath, "internal-mark-commit", "--message", message], {
            stdio: "inherit",
            cwd: rootDir,
          });
          if ((markResult.status ?? 1) !== 0) {
            process.stderr.write("holistic: could not clear the pending handoff commit.\n");
            postHandoffFailed = true;
          }
        }
      }
    }
  }
}

process.exit(postHandoffFailed ? 1 : 0);
