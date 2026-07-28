import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateAdapterProfile, writeDerivedDocs } from "../src/core/docs.ts";
import { createInitialState, getRuntimePaths } from "../src/core/state.ts";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "holistic-adapter-capability-test-"));
}

function makeGitRepo(dir: string): void {
  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "README.md"), "# test\n", "utf8");
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
}

export const tests: Array<{ name: string; run: () => void }> = [
  {
    name: "validateAdapterProfile rejects realtime_hooks without turn_hook_config",
    run: () => {
      assert.throws(
        () => validateAdapterProfile({ appName: "TestAgent", capability: "realtime_hooks" }),
        /requires turn_hook_config/,
      );
    }
  },
  {
    name: "validateAdapterProfile rejects turn_hook_config on non-realtime tiers",
    run: () => {
      assert.throws(
        () => validateAdapterProfile({
          appName: "TestAgent",
          capability: "session_lifecycle_only",
          turnHookConfigYaml: "turn_hooks:\n  - agent_hook: Stop",
        }),
        /forbids turn_hook_config/,
      );
      assert.throws(
        () => validateAdapterProfile({
          appName: "TestAgent",
          capability: "substrate_fallback",
          turnHookConfigYaml: "turn_hooks:\n  - agent_hook: Stop",
        }),
        /forbids turn_hook_config/,
      );
    }
  },
  {
    name: "validateAdapterProfile accepts consistent capability declarations",
    run: () => {
      assert.doesNotThrow(() => validateAdapterProfile({
        appName: "TestAgent",
        capability: "realtime_hooks",
        turnHookConfigYaml: "turn_hooks:\n  - agent_hook: Stop",
      }));
      assert.doesNotThrow(() => validateAdapterProfile({ appName: "TestAgent", capability: "session_lifecycle_only" }));
      assert.doesNotThrow(() => validateAdapterProfile({ appName: "TestAgent", capability: "substrate_fallback" }));
    }
  },
  {
    name: "every generated adapter doc declares a capability tier",
    run: () => {
      const dir = makeTempDir();
      try {
        makeGitRepo(dir);
        const state = createInitialState(dir);
        const paths = getRuntimePaths(dir);
        fs.mkdirSync(path.dirname(paths.stateFile), { recursive: true });
        writeDerivedDocs(paths, state);

        const adapterFiles = fs.readdirSync(paths.adaptersDir).filter((f) => f.endsWith(".md"));
        assert.ok(adapterFiles.length > 0, "expected generated adapter docs");
        for (const fileName of adapterFiles) {
          const content = fs.readFileSync(path.join(paths.adaptersDir, fileName), "utf8");
          assert.match(
            content,
            /## Capability\n\n```yaml\ncapability: (realtime_hooks|session_lifecycle_only|substrate_fallback)\n```/,
            `${fileName} should declare a capability tier`,
          );
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "adapter docs carrying Turn Hook Config declare realtime_hooks and vice versa",
    run: () => {
      const dir = makeTempDir();
      try {
        makeGitRepo(dir);
        const state = createInitialState(dir);
        const paths = getRuntimePaths(dir);
        fs.mkdirSync(path.dirname(paths.stateFile), { recursive: true });
        writeDerivedDocs(paths, state);

        for (const fileName of fs.readdirSync(paths.adaptersDir).filter((f) => f.endsWith(".md"))) {
          const content = fs.readFileSync(path.join(paths.adaptersDir, fileName), "utf8");
          const isRealtime = /capability: realtime_hooks/.test(content);
          const hasTurnHookConfig = /## Turn Hook Config/.test(content);
          assert.equal(
            hasTurnHookConfig,
            isRealtime,
            `${fileName}: Turn Hook Config presence must match realtime_hooks capability`,
          );
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
];
