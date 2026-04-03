import fs from "node:fs";
import path from "node:path";

const LOCK_TIMEOUT_MS = 5000;
const LOCK_WAIT_MS = 50;

function sleepSync(durationMs: number): void {
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, durationMs);
}

function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 tests whether the process exists without killing it.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function tryRecoverStaleLock(lockPath: string): boolean {
  try {
    const content = fs.readFileSync(lockPath, "utf8").trim();
    const pid = Number.parseInt(content, 10);
    if (Number.isNaN(pid) || pid <= 0) {
      // Corrupt lock file — safe to remove.
      fs.unlinkSync(lockPath);
      return true;
    }

    if (!isProcessRunning(pid)) {
      // The process that held the lock is gone — stale lock from a crash.
      fs.unlinkSync(lockPath);
      return true;
    }

    return false;
  } catch {
    // If we can't read or remove the lock, let the normal timeout path handle it.
    return false;
  }
}

export function withLockSync<T>(lockPath: string, fn: () => T): T {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const startedAt = Date.now();

  while (true) {
    try {
      fs.writeFileSync(lockPath, `${process.pid}\n`, { encoding: "utf8", flag: "wx" });
      break;
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? String((error as NodeJS.ErrnoException).code)
        : undefined;
      if (code !== "EEXIST") {
        throw error;
      }

      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        // Before giving up, check if the lock holder crashed.
        if (tryRecoverStaleLock(lockPath)) {
          continue;
        }
        throw new Error(`Failed to acquire Holistic state lock within ${LOCK_TIMEOUT_MS}ms.`);
      }

      sleepSync(LOCK_WAIT_MS);
    }
  }

  try {
    return fn();
  } finally {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // Ignore best-effort cleanup failures.
    }
  }
}
