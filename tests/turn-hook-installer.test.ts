import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installAllTurnHooks } from "../src/core/setup.ts";
import { getRuntimePaths } from "../src/core/state.ts";
import { writeDerivedDocs } from "../src/core/docs.ts";
import { createInitialState } from "../src/core/state.ts";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "holistic-turn-hook-test-"));
}

function makeGitRepo(dir: string): void {
  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "README.md"), "# test\n", "utf8");
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
}

function setupHolisticWithAdapters(dir: string): ReturnType<typeof getRuntimePaths> {
  const state = createInitialState(dir);
  const paths = getRuntimePaths(dir);
  fs.mkdirSync(path.dirname(paths.stateFile), { recursive: true });
  fs.mkdirSync(paths.adaptersDir, { recursive: true });
  writeDerivedDocs(paths, state);
  // Write fake turn-hook scripts so installAllTurnHooks has a real command to embed
  const sysDir = path.join(paths.holisticDir, "system");
  fs.mkdirSync(sysDir, { recursive: true });
  fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), "# fake turn hook\n", "utf8");
  fs.writeFileSync(path.join(sysDir, "andon-turn-hook.sh"), "#!/usr/bin/env sh\n# fake turn hook\n", "utf8");
  return paths;
}

const MINIMAL_TURN_HOOK_DOC = `<!-- HOLISTIC-GENERATED -->

## Turn Hook Config

\`\`\`yaml
turn_hooks:
  - agent_hook: Stop
    holistic_event: turn.ended
    state_field: turn_state
    state_value: waiting

  - agent_hook: UserPromptSubmit
    holistic_event: turn.started
    state_field: turn_state
    state_value: running

install_targets:
  - main

hook_config:
  windows:
    path: .test-hooks/hooks.json
    format: json_merge
    hook_key: (root)
  posix:
    path: .test-hooks/hooks.json
    format: json_merge
    hook_key: (root)
\`\`\`
`;

export const tests: Array<{ name: string; run: () => void }> = [
  {
    name: "installAllTurnHooks silently skips when no adapters directory exists",
    run: () => {
      const dir = makeTempDir();
      try {
        makeGitRepo(dir);
        const paths = getRuntimePaths(dir);
        assert.doesNotThrow(() => installAllTurnHooks(dir, paths, "win32"));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAllTurnHooks silently skips adapters without Turn Hook Config section",
    run: () => {
      const dir = makeTempDir();
      try {
        makeGitRepo(dir);
        const paths = getRuntimePaths(dir);
        fs.mkdirSync(paths.adaptersDir, { recursive: true });
        fs.writeFileSync(
          path.join(paths.adaptersDir, "no-hooks.md"),
          "# No Hooks Adapter\n\nThis adapter has no turn hook config.\n",
          "utf8"
        );
        const sysDir = path.join(paths.holisticDir, "system");
        fs.mkdirSync(sysDir, { recursive: true });
        fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), "# fake\n", "utf8");
        assert.doesNotThrow(() => installAllTurnHooks(dir, paths, "win32"));
        assert.equal(fs.existsSync(path.join(dir, ".test-hooks", "hooks.json")), false);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAllTurnHooks writes turn hook into (root)-keyed JSON config",
    run: () => {
      const dir = makeTempDir();
      try {
        makeGitRepo(dir);
        const paths = getRuntimePaths(dir);
        fs.mkdirSync(paths.adaptersDir, { recursive: true });
        fs.writeFileSync(path.join(paths.adaptersDir, "test-agent.md"), MINIMAL_TURN_HOOK_DOC, "utf8");
        const sysDir = path.join(paths.holisticDir, "system");
        fs.mkdirSync(sysDir, { recursive: true });
        fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), "# fake\n", "utf8");
        // Pre-create the agent config directory so installAllTurnHooks will write into it
        fs.mkdirSync(path.join(dir, ".test-hooks"), { recursive: true });

        installAllTurnHooks(dir, paths, "win32");

        const configPath = path.join(dir, ".test-hooks", "hooks.json");
        assert.ok(fs.existsSync(configPath), "hooks.json should be created");
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        assert.ok(Array.isArray(config.Stop), "Stop key should be an array at root");
        assert.ok(Array.isArray(config.UserPromptSubmit), "UserPromptSubmit key should be an array at root");
        const stopCmd = config.Stop[0]?.command as string | undefined;
        assert.ok(typeof stopCmd === "string" && stopCmd.includes("andon-turn-hook"), "Stop entry should reference andon-turn-hook");
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAllTurnHooks writes turn hook into named-key JSON config (Claude settings.json style)",
    run: () => {
      const dir = makeTempDir();
      try {
        makeGitRepo(dir);
        const paths = getRuntimePaths(dir);
        fs.mkdirSync(paths.adaptersDir, { recursive: true });
        const claudeStyleDoc = MINIMAL_TURN_HOOK_DOC.replace(
          "hook_key: (root)\n  posix:\n    path: .test-hooks/hooks.json\n    format: json_merge\n    hook_key: (root)",
          "hook_key: hooks\n  posix:\n    path: .test-hooks/hooks.json\n    format: json_merge\n    hook_key: hooks"
        );
        fs.writeFileSync(path.join(paths.adaptersDir, "claude-style.md"), claudeStyleDoc, "utf8");
        const sysDir = path.join(paths.holisticDir, "system");
        fs.mkdirSync(sysDir, { recursive: true });
        fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), "# fake\n", "utf8");
        // Pre-create the agent config directory so installAllTurnHooks will write into it
        fs.mkdirSync(path.join(dir, ".test-hooks"), { recursive: true });

        installAllTurnHooks(dir, paths, "win32");

        const configPath = path.join(dir, ".test-hooks", "hooks.json");
        assert.ok(fs.existsSync(configPath), "hooks.json should be created");
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        assert.ok(config.hooks && typeof config.hooks === "object", "hooks key should exist");
        assert.ok(Array.isArray(config.hooks.Stop), "Stop should be under hooks");
        // Entries use Claude-style nested groups: [{hooks: [{type, command}]}]
        const stopGroup = config.hooks.Stop[0] as { hooks?: Array<{ command?: string }> } | undefined;
        const stopCmd = stopGroup?.hooks?.[0]?.command;
        assert.ok(typeof stopCmd === "string" && stopCmd.includes("andon-turn-hook"), "Stop entry should reference andon-turn-hook");
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAllTurnHooks is idempotent: repeated calls do not duplicate hook entries",
    run: () => {
      const dir = makeTempDir();
      try {
        makeGitRepo(dir);
        const paths = getRuntimePaths(dir);
        fs.mkdirSync(paths.adaptersDir, { recursive: true });
        fs.writeFileSync(path.join(paths.adaptersDir, "test-agent.md"), MINIMAL_TURN_HOOK_DOC, "utf8");
        const sysDir = path.join(paths.holisticDir, "system");
        fs.mkdirSync(sysDir, { recursive: true });
        fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), "# fake\n", "utf8");
        // Pre-create the agent config directory so installAllTurnHooks will write into it
        fs.mkdirSync(path.join(dir, ".test-hooks"), { recursive: true });

        installAllTurnHooks(dir, paths, "win32");
        installAllTurnHooks(dir, paths, "win32");
        installAllTurnHooks(dir, paths, "win32");

        const configPath = path.join(dir, ".test-hooks", "hooks.json");
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        assert.equal(config.Stop.length, 1, "exactly one Stop entry after three installs");
        assert.equal(config.UserPromptSubmit.length, 1, "exactly one UserPromptSubmit entry after three installs");
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAllTurnHooks installs turn hooks for all adapter docs with Turn Hook Config sections",
    run: () => {
      const dir = makeTempDir();
      try {
        makeGitRepo(dir);
        const paths = setupHolisticWithAdapters(dir);
        // writeDerivedDocs generates claude-cowork.md with a Turn Hook Config section.
        // codex.md is session_lifecycle_only: Codex has no hook system, so no
        // Turn Hook Config is generated and nothing must be installed for it.
        // Pre-create agent config directories to simulate agents being initialized in this repo.
        // An isolated fake home keeps the generated Gemini adapter (global ~/ target)
        // away from the real home directory.
        fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
        fs.mkdirSync(path.join(dir, ".codex"), { recursive: true });
        const fakeHome = makeTempDir();
        fs.mkdirSync(path.join(fakeHome, ".gemini"), { recursive: true });
        try {
        installAllTurnHooks(dir, paths, "win32", fakeHome);

        // Claude adapter installs to .claude/settings.json under hooks key
        const claudeSettings = path.join(dir, ".claude", "settings.json");
        assert.ok(fs.existsSync(claudeSettings), ".claude/settings.json should be created");
        const settings = JSON.parse(fs.readFileSync(claudeSettings, "utf8"));
        const stopHooks = settings.hooks?.Stop ?? [];
        const claudeHasTurnHook = stopHooks.some(
          (g: { hooks?: Array<{ command?: string }> }) =>
            g.hooks?.some((h) => typeof h.command === "string" && h.command.includes("andon-turn-hook"))
        );
        assert.ok(claudeHasTurnHook, "Claude settings.json should have andon-turn-hook in Stop");

        // Codex is session_lifecycle_only: no turn hooks may be installed
        const codexHooks = path.join(dir, ".codex", "hooks.json");
        assert.equal(fs.existsSync(codexHooks), false,
          "no .codex/hooks.json may be created: Codex has no hook system");

        // Gemini adapter targets the global ~/.gemini/settings.json
        const geminiSettings = path.join(fakeHome, ".gemini", "settings.json");
        assert.ok(fs.existsSync(geminiSettings), "~/.gemini/settings.json should be created for Gemini adapter");
        const gemini = JSON.parse(fs.readFileSync(geminiSettings, "utf8"));
        assert.ok(Array.isArray(gemini.hooks?.AfterTool), "AfterTool should be under hooks in Gemini settings");
        assert.ok(Array.isArray(gemini.hooks?.SessionStart), "SessionStart should be under hooks in Gemini settings");
        } finally {
          fs.rmSync(fakeHome, { recursive: true, force: true });
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAllTurnHooks expands ~/ targets into the home directory only when the agent dir exists",
    run: () => {
      const dir = makeTempDir();
      const fakeHome = makeTempDir();
      try {
        makeGitRepo(dir);
        const paths = getRuntimePaths(dir);
        fs.mkdirSync(paths.adaptersDir, { recursive: true });
        const homeDoc = MINIMAL_TURN_HOOK_DOC
          .replaceAll(".test-hooks/hooks.json", "~/.test-agent/settings.json")
          .replaceAll("hook_key: (root)", "hook_key: hooks");
        fs.writeFileSync(path.join(paths.adaptersDir, "home-agent.md"), homeDoc, "utf8");
        const sysDir = path.join(paths.holisticDir, "system");
        fs.mkdirSync(sysDir, { recursive: true });
        fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), "# fake\n", "utf8");

        // Agent not initialized in this home: nothing may be created
        installAllTurnHooks(dir, paths, "win32", fakeHome);
        const settingsPath = path.join(fakeHome, ".test-agent", "settings.json");
        assert.equal(fs.existsSync(settingsPath), false, "no settings file before the agent dir exists");

        fs.mkdirSync(path.join(fakeHome, ".test-agent"), { recursive: true });
        installAllTurnHooks(dir, paths, "win32", fakeHome);
        assert.ok(fs.existsSync(settingsPath), "settings.json should be created inside the fake home");
        const config = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        assert.ok(Array.isArray(config.hooks?.Stop), "hook events should be written under hooks");
        // Nothing may leak into the repo from a ~/ target
        assert.equal(fs.existsSync(path.join(dir, "~")), false, "no literal ~ directory in the repo");
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.rmSync(fakeHome, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAllTurnHooks rejects ~/ targets that escape the home directory",
    run: () => {
      const dir = makeTempDir();
      const fakeHome = makeTempDir();
      try {
        makeGitRepo(dir);
        const paths = getRuntimePaths(dir);
        fs.mkdirSync(paths.adaptersDir, { recursive: true });
        const escapeDoc = MINIMAL_TURN_HOOK_DOC
          .replaceAll(".test-hooks/hooks.json", "~/../escape-target/hooks.json");
        fs.writeFileSync(path.join(paths.adaptersDir, "escape-agent.md"), escapeDoc, "utf8");
        const sysDir = path.join(paths.holisticDir, "system");
        fs.mkdirSync(sysDir, { recursive: true });
        fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), "# fake\n", "utf8");
        const escapeDir = path.join(path.dirname(fakeHome), "escape-target");
        fs.mkdirSync(escapeDir, { recursive: true });

        installAllTurnHooks(dir, paths, "win32", fakeHome);

        assert.equal(
          fs.existsSync(path.join(escapeDir, "hooks.json")),
          false,
          "a ~/.. traversal must not write outside the home directory",
        );
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.rmSync(fakeHome, { recursive: true, force: true });
        fs.rmSync(path.join(path.dirname(fakeHome), "escape-target"), { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAllTurnHooks writes a ~/ target once and never resolves it against worktrees",
    run: () => {
      const dir = makeTempDir();
      const wtDir = makeTempDir();
      const fakeHome = makeTempDir();
      try {
        makeGitRepo(dir);
        execFileSync("git", ["worktree", "add", wtDir, "HEAD"], { cwd: dir });

        const paths = getRuntimePaths(dir);
        fs.mkdirSync(paths.adaptersDir, { recursive: true });
        const globalWorktreeDoc = MINIMAL_TURN_HOOK_DOC
          .replaceAll(".test-hooks/hooks.json", "~/.test-agent/settings.json")
          .replace("install_targets:\n  - main", "install_targets:\n  - main\n  - worktrees");
        fs.writeFileSync(path.join(paths.adaptersDir, "global-agent.md"), globalWorktreeDoc, "utf8");
        const sysDir = path.join(paths.holisticDir, "system");
        fs.mkdirSync(sysDir, { recursive: true });
        fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), "# fake\n", "utf8");
        fs.mkdirSync(path.join(fakeHome, ".test-agent"), { recursive: true });

        installAllTurnHooks(dir, paths, "win32", fakeHome);

        assert.ok(
          fs.existsSync(path.join(fakeHome, ".test-agent", "settings.json")),
          "global settings should be written once into the home directory",
        );
        assert.equal(fs.existsSync(path.join(wtDir, "~")), false, "no literal ~ directory in the worktree");
        assert.equal(fs.existsSync(path.join(dir, "~")), false, "no literal ~ directory in the main repo");
      } finally {
        try { execFileSync("git", ["worktree", "remove", "--force", wtDir], { cwd: dir }); } catch { /* ignore */ }
        fs.rmSync(dir, { recursive: true, force: true });
        fs.rmSync(wtDir, { recursive: true, force: true });
        fs.rmSync(fakeHome, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAllTurnHooks propagates to worktrees when install_targets includes worktrees",
    run: () => {
      const dir = makeTempDir();
      const wtDir = makeTempDir();
      try {
        makeGitRepo(dir);
        execFileSync("git", ["worktree", "add", wtDir, "HEAD"], { cwd: dir });

        const paths = getRuntimePaths(dir);
        fs.mkdirSync(paths.adaptersDir, { recursive: true });
        // Make an adapter with worktrees in install_targets
        const worktreeDoc = MINIMAL_TURN_HOOK_DOC.replace(
          "install_targets:\n  - main",
          "install_targets:\n  - main\n  - worktrees"
        );
        fs.writeFileSync(path.join(paths.adaptersDir, "wt-agent.md"), worktreeDoc, "utf8");
        const sysDir = path.join(paths.holisticDir, "system");
        fs.mkdirSync(sysDir, { recursive: true });
        fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), "# fake\n", "utf8");
        // Pre-create agent config directories in both main and worktree
        fs.mkdirSync(path.join(dir, ".test-hooks"), { recursive: true });
        fs.mkdirSync(path.join(wtDir, ".test-hooks"), { recursive: true });

        installAllTurnHooks(dir, paths, "win32");

        // Main repo should have the hooks file
        const mainConfig = path.join(dir, ".test-hooks", "hooks.json");
        assert.ok(fs.existsSync(mainConfig), "main repo hooks.json should exist");

        // Worktree should also have the hooks file
        const wtConfig = path.join(wtDir, ".test-hooks", "hooks.json");
        assert.ok(fs.existsSync(wtConfig), "worktree hooks.json should exist");
        const wtCfg = JSON.parse(fs.readFileSync(wtConfig, "utf8"));
        assert.ok(Array.isArray(wtCfg.Stop), "worktree Stop should be an array");
      } finally {
        try { execFileSync("git", ["worktree", "remove", "--force", wtDir], { cwd: dir }); } catch { /* ignore */ }
        fs.rmSync(dir, { recursive: true, force: true });
        fs.rmSync(wtDir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAllTurnHooks preserves existing entries in the JSON config",
    run: () => {
      const dir = makeTempDir();
      try {
        makeGitRepo(dir);
        const paths = getRuntimePaths(dir);
        fs.mkdirSync(paths.adaptersDir, { recursive: true });
        fs.writeFileSync(path.join(paths.adaptersDir, "test-agent.md"), MINIMAL_TURN_HOOK_DOC, "utf8");
        const sysDir = path.join(paths.holisticDir, "system");
        fs.mkdirSync(sysDir, { recursive: true });
        fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), "# fake\n", "utf8");

        // Pre-create the hooks file with an existing entry
        const hooksDir = path.join(dir, ".test-hooks");
        fs.mkdirSync(hooksDir, { recursive: true });
        fs.writeFileSync(path.join(hooksDir, "hooks.json"), JSON.stringify({
          Stop: [{ command: "existing-stop-hook" }],
          SomeOtherHook: [{ command: "other-hook" }]
        }, null, 2) + "\n", "utf8");

        installAllTurnHooks(dir, paths, "win32");

        const config = JSON.parse(fs.readFileSync(path.join(hooksDir, "hooks.json"), "utf8"));
        assert.equal(config.Stop.length, 2, "existing Stop entry should be preserved");
        assert.equal(config.Stop[0].command, "existing-stop-hook", "original entry should remain");
        assert.ok(config.SomeOtherHook, "other hook key should be preserved");
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
];
