import fs from "node:fs";

const LOCK_TIMEOUT_MS = 5000;
const LOCK_WAIT_MS = 50;

function sleepSync(durationMs: number): void {
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, durationMs);
}

export function withLockSync<T>(lockPath: string, fn: () => T): T {
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
