import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { initializeHolistic } from '../core/setup.ts';
import { getRuntimePaths } from '../core/state.ts';

function makeTempRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-privacy-test-"));
  execFileSync("git", ["init"], { cwd: root });
  // Set up mock git user for hooks validation if needed
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  return root;
}

export const tests = [
  {
    name: "generated artifacts contain privacy guards when portableState is off",
    run: () => {
      const rootDir = makeTempRepo();
      try {
        initializeHolistic(rootDir, { 
          portableState: false, 
          installGitHooks: true,
          platform: "win32" // Test both to be safe
        });
        
        const paths = getRuntimePaths(rootDir);
        
        // 1. Pre-push hook guard
        const prePush = fs.readFileSync(path.join(rootDir, ".git", "hooks", "pre-push"), "utf8");
        assert.match(prePush, /exit 0  # Portable state disabled \(Privacy Mode\)/);
        
        // 2. PowerShell Sync Script
        const syncPs1 = fs.readFileSync(path.join(rootDir, ".holistic", "system", "sync-state.ps1"), "utf8");
        assert.match(syncPs1, /Write-Host 'Holistic sync skipped: portableState is disabled \(Privacy Mode\).'/);
        assert.match(syncPs1, /exit 0/);

        // 3. PowerShell Restore Script
        const restorePs1 = fs.readFileSync(path.join(rootDir, ".holistic", "system", "restore-state.ps1"), "utf8");
        assert.match(restorePs1, /Write-Host 'Holistic restore skipped: portableState is disabled \(Privacy Mode\).'/);
        assert.match(restorePs1, /exit 0/);

        // Run again for unix platform artifacts
        initializeHolistic(rootDir, { 
          portableState: false, 
          installGitHooks: true,
          platform: "linux" 
        });

        // 4. Shell Sync Script
        const syncSh = fs.readFileSync(path.join(rootDir, ".holistic", "system", "sync-state.sh"), "utf8");
        assert.match(syncSh, /echo 'Holistic sync skipped: portableState is disabled \(Privacy Mode\).'/);
        assert.match(syncSh, /exit 0/);

        // 5. Shell Restore Script
        const restoreSh = fs.readFileSync(path.join(rootDir, ".holistic", "system", "restore-state.sh"), "utf8");
        assert.match(restoreSh, /echo 'Holistic restore skipped: portableState is disabled \(Privacy Mode\).'/);
        assert.match(restoreSh, /exit 0/);

      } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "generated artifacts do NOT contain privacy guards when portableState is on",
    run: () => {
      const rootDir = makeTempRepo();
      try {
        initializeHolistic(rootDir, { 
          portableState: true, 
          installGitHooks: true,
          platform: "linux" 
        });
        
        const prePush = fs.readFileSync(path.join(rootDir, ".git", "hooks", "pre-push"), "utf8");
        assert.doesNotMatch(prePush, /Privacy Mode/);
        
        const syncSh = fs.readFileSync(path.join(rootDir, ".holistic", "system", "sync-state.sh"), "utf8");
        assert.doesNotMatch(syncSh, /Privacy Mode/);
        
        const restoreSh = fs.readFileSync(path.join(rootDir, ".holistic", "system", "restore-state.sh"), "utf8");
        assert.doesNotMatch(restoreSh, /Privacy Mode/);

      } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
      }
    }
  }
];
