import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { once } from "node:events";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { execFileSync, spawn } from "node:child_process";
import {
  applyHandoff,
  getRuntimePaths,
  isSafeSessionId,
  loadState,
  createInitialState,
  reactivateArchivedSession,
  saveState,
  startNewSession,
} from "../src/core/state.ts";
import { getSetupStatus, validateRuntimeConfig } from "../src/core/setup.ts";
import { writeDerivedDocs } from "../src/core/docs.ts";
import { resolveLocalProcessCommand } from "../packages/runtime-local/src/process.ts";
import { createRuntimeAdapterRegistry } from "../services/runtime-service/src/adapter-registry.ts";
import { createRuntimeServiceHandler } from "../services/runtime-service/src/server.ts";
import { createAndonHandler } from "../services/andon-api/src/server.ts";
import type { HolisticState } from "../src/core/types.ts";

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function makeRepo(): { rootDir: string } {
  const rootDir = makeTempDir("holistic-security-test");
  execFileSync("git", ["init"], { cwd: rootDir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: rootDir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: rootDir });
  fs.writeFileSync(path.join(rootDir, "README.md"), "# test\n", "utf8");
  return { rootDir };
}

function createAndonDatabase(databasePath: string): DatabaseSync {
  const schema = fs.readFileSync(path.join(process.cwd(), "services/andon-api/sql/001_initial.sql"), "utf8");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(schema);
  return database;
}

async function withServer(
  handler: (request: any, response: any) => Promise<void>,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(handler);
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Missing test port");
    }
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
  }
}

export const tests = [
  {
    name: "getRuntimePaths enforces repository containment for all configurable paths",
    run: () => {
      const { rootDir } = makeRepo();
      
      // Malicious config attempting directory traversal
      const config = {
        runtime: {
          holisticDir: "../outside-holistic",
          masterDoc: "../../outside-master.md",
          agentsDoc: "/absolute/path/agents.md"
        }
      };
      fs.writeFileSync(path.join(rootDir, "holistic.repo.json"), JSON.stringify(config), "utf8");
      
      const diagnostics: string[] = [];
      const paths = getRuntimePaths(rootDir, diagnostics);
      
      // Should fall back to safe defaults inside root
      assert.equal(paths.holisticDir, path.join(path.normalize(rootDir), ".holistic"));
      assert.equal(paths.masterDoc, path.join(path.normalize(rootDir), "HOLISTIC.md"));
      assert.equal(paths.agentsDoc, path.join(path.normalize(rootDir), "AGENTS.md"));
      
      // Should report diagnostics
      assert.ok(diagnostics.length >= 3);
      assert.ok(diagnostics.some(d => d.includes("attempted to escape repository root")));
    }
  },
  {
    name: "loadState handles corrupt state file by backing it up and reporting degraded status",
    run: () => {
      const { rootDir } = makeRepo();
      const holisticDir = path.join(rootDir, ".holistic");
      fs.mkdirSync(holisticDir, { recursive: true });
      
      const stateFile = path.join(holisticDir, "state.json");
      fs.writeFileSync(stateFile, "{ invalid json ...", "utf8");
      
      const { state, created } = loadState(rootDir);
      
      assert.equal(created, true);
      assert.equal(state.degraded, true);
      assert.ok(state.diagnostics?.some(d => d.includes("Local state file was corrupted")));
      
      // Check that backup exists
      const files = fs.readdirSync(holisticDir);
      assert.ok(files.some(f => f.startsWith("state.json.corrupt-")));
    }
  },
  {
    name: "doctor surfaces repository containment and state integrity findings",
    run: () => {
      const { rootDir } = makeRepo();
      const holisticDir = path.join(rootDir, ".holistic");
      fs.mkdirSync(holisticDir, { recursive: true });
      
      // 1. Create a containment violation
      fs.writeFileSync(path.join(rootDir, "holistic.repo.json"), JSON.stringify({
        runtime: { masterDoc: "../evil.md" }
      }), "utf8");
      
      // 2. Create a corrupt state
      fs.writeFileSync(path.join(holisticDir, "state.json"), "!!!", "utf8");
      
      const status = getSetupStatus(rootDir);
      
      const configDiag = status.find(s => s.component === "config-validation");
      if (configDiag?.status !== "error") {
        console.log("Config findings:", JSON.stringify(validateRuntimeConfig(getRuntimePaths(rootDir)), null, 2));
      }
      assert.equal(configDiag?.status, "error");
      assert.ok(configDiag?.details.includes("errors found"));
      
      const integrityDiag = status.find(s => s.component === "state-integrity");
      assert.equal(integrityDiag?.status, "error");
      assert.ok(integrityDiag?.details.includes("State is degraded"));
    }
  },
  {
    name: "safeMode produces minimal instructions in master doc",
    run: () => {
      const { rootDir } = makeRepo();
      const { state, paths } = loadState(rootDir);
      
      // Enable safe mode in config
      fs.writeFileSync(path.join(paths.holisticDir, "config.json"), JSON.stringify({
        safeMode: true
      }), "utf8");
      
      // This should trigger safeMode if getSetupStatus or similar is used, 
      // but writeDerivedDocs takes it directly.
      writeDerivedDocs(paths, state, { safeMode: true });
      
      const masterDoc = fs.readFileSync(paths.masterDoc, "utf8");
      assert.match(masterDoc, /# HOLISTIC \(Safe Mode\)/);
      assert.match(masterDoc, /MINIMAL INSTRUCTIONS/);
      assert.doesNotMatch(masterDoc, /AGENT INSTRUCTIONS - READ THIS ENTIRE FILE/);
      assert.match(masterDoc, /<!-- Holistic version: 0.6.5 -->/);
    }
  },
  {
    name: "session id validation accepts real ids and rejects traversal payloads",
    run: () => {
      assert.equal(isSafeSessionId("session-2026-07-27T12-00-00-000Z"), true);
      assert.equal(isSafeSessionId("pending-session-abc"), true);

      // The prefix test that previously guarded applyHandoff is not a guard.
      assert.equal(isSafeSessionId("session-../../../etc/hosts"), false);
      assert.equal(isSafeSessionId("../../victim"), false);
      assert.equal(isSafeSessionId("..\\..\\victim"), false);
      assert.equal(isSafeSessionId("/etc/passwd"), false);
      assert.equal(isSafeSessionId("C:/Windows/system.ini"), false);
      assert.equal(isSafeSessionId(".."), false);
      assert.equal(isSafeSessionId(""), false);
      assert.equal(isSafeSessionId("a".repeat(201)), false);
      assert.equal(isSafeSessionId(null), false);
      assert.equal(isSafeSessionId(42), false);
    }
  },
  {
    name: "reactivateArchivedSession refuses to read, move, or delete outside the session directories",
    run: () => {
      const { rootDir } = makeRepo();
      const paths = getRuntimePaths(rootDir);
      fs.mkdirSync(paths.archiveSessionsDir, { recursive: true });
      fs.mkdirSync(paths.sessionsDir, { recursive: true });

      // A file that a traversal id would reach from the archive directory.
      const victim = path.join(paths.holisticDir, "victim.json");
      fs.writeFileSync(victim, JSON.stringify({ id: "anything", token: "SUPERSECRET" }), "utf8");

      const escaped = reactivateArchivedSession(paths, "../../victim");

      assert.equal(escaped, null, "traversal id must not return file contents");
      assert.equal(fs.existsSync(victim), true, "traversal id must not delete the target");
      assert.equal(
        fs.existsSync(path.join(paths.holisticDir, "..", "victim.json")),
        false,
        "traversal id must not write outside the sessions directory",
      );
    }
  },
  {
    name: "reactivateArchivedSession still restores a legitimate archived session",
    run: () => {
      const { rootDir } = makeRepo();
      const paths = getRuntimePaths(rootDir);
      fs.mkdirSync(paths.archiveSessionsDir, { recursive: true });
      fs.mkdirSync(paths.sessionsDir, { recursive: true });

      const sessionId = "session-2026-07-27T10-00-00-000Z";
      const archivePath = path.join(paths.archiveSessionsDir, `${sessionId}.json`);
      fs.writeFileSync(archivePath, JSON.stringify({ id: sessionId, title: "Archived work" }), "utf8");

      const restored = reactivateArchivedSession(paths, sessionId);

      assert.equal(restored?.id, sessionId);
      assert.equal(fs.existsSync(path.join(paths.sessionsDir, `${sessionId}.json`)), true);
      assert.equal(fs.existsSync(archivePath), false);
    }
  },
  {
    name: "agent-supplied relatedSessions cannot escape the session directory during handoff",
    run: () => {
      const { rootDir } = makeRepo();
      // loadState creates the session and archive directories that handoff writes to.
      const { paths } = loadState(rootDir);
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Handoff traversal probe", ["Step one"]);
      saveState(paths, state);

      const victim = path.join(paths.holisticDir, "victim.json");
      fs.writeFileSync(victim, JSON.stringify({ id: "anything" }), "utf8");

      // "session-../../victim" satisfies the old startsWith("session-") check.
      applyHandoff(rootDir, state, {
        summary: "Traversal probe",
        next: ["Continue"],
        relatedSessions: ["session-../../victim"],
      });

      assert.equal(fs.existsSync(victim), true, "handoff metadata must not delete files outside the sessions directory");
    }
  },
  {
    name: "local runtime refuses a caller-supplied command unless explicitly allowlisted",
    run: () => {
      const previousOptIn = process.env.HOLISTIC_ALLOW_LOCAL_COMMAND;
      const previousAllowlist = process.env.HOLISTIC_LOCAL_COMMAND_ALLOWLIST;
      delete process.env.HOLISTIC_ALLOW_LOCAL_COMMAND;
      delete process.env.HOLISTIC_LOCAL_COMMAND_ALLOWLIST;

      try {
        const base = { sessionId: "s1", repoPath: process.cwd(), prompt: "p" };

        // Default: the bundled fixture runner, never the request's command.
        const fallback = resolveLocalProcessCommand(base);
        assert.equal(fallback.command, process.execPath);
        assert.match(fallback.args[0] ?? "", /fake-runner\.mjs$/);

        // Opt-in absent: a supplied command is refused outright.
        assert.throws(
          () => resolveLocalProcessCommand({ ...base, command: "node", args: ["-e", "1"] }),
          /HOLISTIC_ALLOW_LOCAL_COMMAND/,
        );

        // Opt-in present but the command is not allowlisted.
        process.env.HOLISTIC_ALLOW_LOCAL_COMMAND = "1";
        process.env.HOLISTIC_LOCAL_COMMAND_ALLOWLIST = "/usr/bin/safe-runner";
        assert.throws(
          () => resolveLocalProcessCommand({ ...base, command: "node", args: [] }),
          /not listed in HOLISTIC_LOCAL_COMMAND_ALLOWLIST/,
        );

        // Opt-in present and allowlisted: permitted.
        const allowed = resolveLocalProcessCommand({ ...base, command: "/usr/bin/safe-runner", args: ["--x"] });
        assert.equal(allowed.command, "/usr/bin/safe-runner");
        assert.deepEqual(allowed.args, ["--x"]);
      } finally {
        if (previousOptIn === undefined) delete process.env.HOLISTIC_ALLOW_LOCAL_COMMAND;
        else process.env.HOLISTIC_ALLOW_LOCAL_COMMAND = previousOptIn;
        if (previousAllowlist === undefined) delete process.env.HOLISTIC_LOCAL_COMMAND_ALLOWLIST;
        else process.env.HOLISTIC_LOCAL_COMMAND_ALLOWLIST = previousAllowlist;
      }
    }
  },
  {
    name: "runtime service rejects task requests carrying an unauthorized browser origin",
    run: async () => {
      const database = createAndonDatabase(path.join(makeTempDir("runtime-origin"), "andon.sqlite"));
      const handler = createRuntimeServiceHandler(database, createRuntimeAdapterRegistry());

      try {
        await withServer(handler, async (base) => {
          const hostile = await fetch(`${base}/runtime/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
            body: JSON.stringify({
              runtimeId: "local",
              prompt: "p",
              repoPath: process.cwd(),
              repoName: "probe",
              agentName: "probe",
              metadata: { localCommand: "node", localArgs: ["-e", "1"] },
            }),
          });
          assert.equal(hostile.status, 403);

          // Preflight from a hostile origin must not hand out permission.
          const preflight = await fetch(`${base}/runtime/tasks`, {
            method: "OPTIONS",
            headers: { Origin: "https://evil.example" },
          });
          assert.equal(preflight.status, 403);
          assert.equal(preflight.headers.get("access-control-allow-origin"), null);

          // A read endpoint must not echo a wildcard to any origin.
          const dashboard = await fetch(`${base}/runtime/sessions`, {
            headers: { Origin: "http://127.0.0.1:5173" },
          });
          assert.equal(dashboard.status, 200);
          assert.equal(dashboard.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173");
        });
      } finally {
        database.close();
      }
    }
  },
  {
    name: "andon api rejects unauthorized origins and non-JSON event bodies",
    run: async () => {
      const database = createAndonDatabase(path.join(makeTempDir("andon-origin"), "andon.sqlite"));
      const handler = createAndonHandler(database);

      try {
        await withServer(handler, async (base) => {
          const hostileRead = await fetch(`${base}/mission-control`, {
            headers: { Origin: "https://evil.example" },
          });
          assert.equal(hostileRead.status, 403);

          // A simple-request content type must not reach the ingest path,
          // otherwise a cross-origin form post skips preflight entirely.
          const formPost = await fetch(`${base}/events`, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ events: [] }),
          });
          assert.equal(formPost.status, 415);
          const formBody = (await formPost.json()) as { error?: string };
          assert.match(formBody.error ?? "", /Content-Type must be application\/json/);

          // Local non-browser clients keep working.
          const local = await fetch(`${base}/health`);
          assert.equal(local.status, 200);
          assert.equal(local.headers.get("access-control-allow-origin"), null);
        });
      } finally {
        database.close();
      }
    }
  },
  {
    name: "daemon starts in a clean repo and writes its pidfile to the configured runtime directory",
    run: async () => {
      const { rootDir } = makeRepo();
      const paths = getRuntimePaths(rootDir);
      saveState(paths, createInitialState(rootDir));

      const daemonPath = path.resolve(process.cwd(), "src", "daemon.ts");
      const child = spawn(
        process.execPath,
        ["--experimental-strip-types", daemonPath, "--interval", "3600"],
        { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] },
      );

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => { stdout += String(chunk); });
      child.stderr.on("data", (chunk: Buffer) => { stderr += String(chunk); });

      try {
        const started = Date.now();
        while (Date.now() - started < 15_000) {
          if (stdout.includes("Holistic daemon watching") || child.exitCode !== null) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        assert.equal(child.exitCode, null, `daemon exited early: ${stderr || stdout}`);
        assert.match(stdout, /Holistic daemon watching/);

        // The pidfile must follow the repo's configured runtime directory,
        // not a hard-coded ".holistic-local" that only the product repo has.
        const pidFile = path.join(paths.holisticDir, "daemon.pid");
        assert.equal(fs.existsSync(pidFile), true, "daemon pidfile was not created");
        assert.equal(fs.existsSync(path.join(rootDir, ".holistic-local", "daemon.pid")), false);

        // The Andon add-on is absent from a normal repo, so nothing is spawned for it.
        assert.doesNotMatch(stderr, /spawn EINVAL/);
        assert.doesNotMatch(stdout, /Andon API starting/);
      } finally {
        child.kill();
        if (process.platform === "win32" && child.pid) {
          try {
            execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
          } catch { /* already gone */ }
        }
      }
    }
  }
];
