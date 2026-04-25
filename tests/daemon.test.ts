import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isDaemonRunning, isPortFree, runDaemonTick } from "../src/daemon.ts";

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function makeFakeRepo(rootDir: string): void {
  fs.mkdirSync(path.join(rootDir, ".git", "refs", "heads"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(path.join(rootDir, ".git", "refs", "heads", "main"), "0".repeat(40) + "\n", "utf8");
}

export const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "Daemon isPortFree returns false for an occupied port and true after release",
    async run() {
      const server = createServer();
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const { port } = server.address() as AddressInfo;

      assert.equal(await isPortFree(port), false, "port should be occupied while server is listening");

      await new Promise<void>((resolve) => server.close(() => resolve()));

      assert.equal(await isPortFree(port), true, "port should be free after server closes");
    },
  },
  {
    name: "Daemon isDaemonRunning returns false with no PID file, false with stale PID, true with live PID",
    async run() {
      const dir = makeTempDir("holistic-daemon-pid");
      const pidFile = path.join(dir, "daemon.pid");

      assert.equal(isDaemonRunning(pidFile), false, "no PID file — not running");

      // Stale PID: use a PID that almost certainly does not exist.
      fs.writeFileSync(pidFile, "9999999", "utf8");
      assert.equal(isDaemonRunning(pidFile), false, "stale PID — not running");

      // Live PID: spawn a real child process and use its PID.
      const child = spawn(
        process.execPath,
        ["-e", "setTimeout(() => {}, 10000)"],
        { stdio: "ignore" }
      );
      try {
        fs.writeFileSync(pidFile, String(child.pid), "utf8");
        assert.equal(isDaemonRunning(pidFile), true, "live child PID — running");
      } finally {
        child.kill();
      }
    },
  },
  {
    name: "Daemon runDaemonTick returns correct shape on a fresh repo",
    run() {
      const rootDir = makeTempDir("holistic-daemon-tick");
      makeFakeRepo(rootDir);

      const result = runDaemonTick(rootDir);

      assert.equal(typeof result.changed, "boolean", "result.changed must be boolean");
      assert.equal(typeof result.summary, "string", "result.summary must be string");
      assert.ok(result.summary.length > 0, "summary must not be empty");
    },
  },
];
