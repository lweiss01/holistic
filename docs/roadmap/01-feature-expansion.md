# Roadmap: Phase 1 - Feature Expansion

**Priority:** High  
**Complexity:** Low-Medium  
**Dependencies:** **Phase 0 (Code Hardening) MUST be complete first**  
**Estimated effort:** 3-4 sessions  
**Affected areas:** `cli`, `mcp`, `git-integration`, `state-management`

## Goal

Add features that make Holistic clearly better than doing nothing. These are high-value, low-complexity additions that unlock new workflows and dramatically improve the user experience.

**⚠️ IMPORTANT:** Do not start this phase until Phase 0 is complete. Building features on a shaky foundation wastes time.

## Implementation Status

Phase 1 is complete in repo as of March 21, 2026.

Implemented deliverables:
- `holistic serve` thin MCP server mode
- `holistic diff`
- `holistic status`
- git hook installation during `holistic init`
- state file locking to protect concurrent writes

Current verification signal:
- `node --experimental-strip-types tests/run-tests.ts` passes, including coverage for MCP state persistence, diff rendering, status rendering, git hook generation, and passive capture.

Remaining follow-up that does not block Phase 1.5:
- Re-run end-to-end MCP validation with external Claude Desktop and Cursor clients during release hardening
- Decide when to bump the version and publish
- Cut a GitHub release when the release train is ready

---

## Implementation Plan

### Task 1a: MCP Server Mode (`holistic serve`)

**Goal:** Expose Holistic as an MCP server so agents can call `holistic_checkpoint`, `holistic_resume`, and `holistic_handoff` directly without CLI commands.

**Why This Matters:**
- **Invisible capture:** Agents checkpoint mid-session without user intervention
- **Works with Claude Desktop, Cursor, and any MCP-capable tool**
- **Most powerful adoption unlock** - makes Holistic feel like magic

**Implementation:**

1. **Add `@modelcontextprotocol/sdk` dependency:**
```bash
npm install @modelcontextprotocol/sdk
```

2. **Create MCP server `src/mcp-server.ts`:**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadState, saveState, checkpointState, applyHandoff, getResumePayload } from "./core/state.js";
import { getRuntimePaths } from "./core/state.js";
import { writeDerivedDocs } from "./core/docs.js";
import type { CheckpointInput, HandoffInput, AgentName } from "./core/types.js";

const server = new Server(
  {
    name: "holistic",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "holistic_resume",
        description: "Resume the current Holistic session and get project context",
        inputSchema: {
          type: "object",
          properties: {
            agent: {
              type: "string",
              description: "Agent name (codex, claude, cursor, etc.)",
              enum: ["codex", "claude", "antigravity", "gemini", "copilot", "cursor", "goose", "gsd"],
            },
            continue: {
              type: "boolean",
              description: "Continue from latest session",
            },
          },
        },
      },
      {
        name: "holistic_checkpoint",
        description: "Create a checkpoint to save current work state",
        inputSchema: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Why this checkpoint is being created",
            },
            status: {
              type: "string",
              description: "Current status update",
            },
            done: {
              type: "array",
              items: { type: "string" },
              description: "Work completed since last checkpoint",
            },
            next: {
              type: "array",
              items: { type: "string" },
              description: "Next steps to try",
            },
            impacts: {
              type: "array",
              items: { type: "string" },
              description: "Project impact notes",
            },
            regressions: {
              type: "array",
              items: { type: "string" },
              description: "Regression risks to guard",
            },
          },
          required: ["reason"],
        },
      },
      {
        name: "holistic_handoff",
        description: "Finish the session and prepare handoff for next agent",
        inputSchema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Session summary",
            },
            done: {
              type: "array",
              items: { type: "string" },
              description: "Work completed",
            },
            next: {
              type: "array",
              items: { type: "string" },
              description: "Recommended next steps",
            },
            impacts: {
              type: "array",
              items: { type: "string" },
              description: "Overall project impact",
            },
            regressions: {
              type: "array",
              items: { type: "string" },
              description: "Regression risks",
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const rootDir = process.env.HOLISTIC_REPO || process.cwd();
  const { state, paths } = loadState(rootDir);

  switch (request.params.name) {
    case "holistic_resume": {
      const agent = (request.params.arguments?.agent as AgentName) || "unknown";
      const payload = getResumePayload(state, agent);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }

    case "holistic_checkpoint": {
      const input: CheckpointInput = {
        reason: request.params.arguments?.reason as string,
        status: request.params.arguments?.status as string,
        done: request.params.arguments?.done as string[],
        next: request.params.arguments?.next as string[],
        impacts: request.params.arguments?.impacts as string[],
        regressions: request.params.arguments?.regressions as string[],
      };

      const nextState = checkpointState(rootDir, state, input);
      writeDerivedDocs(paths, nextState);
      saveState(paths, nextState);

      return {
        content: [
          {
            type: "text",
            text: `Checkpoint created: ${nextState.activeSession?.checkpointCount} total checkpoints`,
          },
        ],
      };
    }

    case "holistic_handoff": {
      const input: HandoffInput = {
        summary: request.params.arguments?.summary as string,
        done: request.params.arguments?.done as string[],
        next: request.params.arguments?.next as string[],
        impacts: request.params.arguments?.impacts as string[],
        regressions: request.params.arguments?.regressions as string[],
      };

      const nextState = applyHandoff(rootDir, state, input);
      writeDerivedDocs(paths, nextState);
      saveState(paths, nextState);

      return {
        content: [
          {
            type: "text",
            text: `Handoff complete. Summary: ${nextState.lastHandoff?.summary}`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Holistic MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
```

3. **Add `holistic serve` command to `src/cli.ts`:**
```typescript
case "serve":
  // Exec the MCP server in a child process
  const { spawn } = await import("node:child_process");
  const mcpServer = spawn("node", ["--experimental-strip-types", path.join(__dirname, "mcp-server.ts")], {
    stdio: "inherit",
  });
  
  mcpServer.on("close", (code) => {
    process.exit(code || 0);
  });
  
  return await new Promise<number>(() => undefined);  // Run forever
```

4. **Add MCP server config example to docs:**
```json
// For Claude Desktop - add to ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "holistic": {
      "command": "npx",
      "args": ["holistic", "serve"],
      "env": {
        "HOLISTIC_REPO": "/path/to/your/repo"
      }
    }
  }
}
```

**Validation:**
```bash
# Test MCP server
holistic serve
# Should output: "Holistic MCP server running on stdio"

# Test with Claude Desktop
# 1. Add config above to claude_desktop_config.json
# 2. Restart Claude Desktop
# 3. In chat: "Use holistic_checkpoint to save my progress with reason 'test'"
# 4. Verify checkpoint created in .holistic/state.json
```

---

### Task 1b: `holistic diff` Command

**Goal:** Show what changed between two sessions.

**Implementation:**
```typescript
// src/cli.ts
async function handleDiff(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const { paths } = loadState(rootDir);
  const from = firstFlag(parsed.flags, "from");
  const to = firstFlag(parsed.flags, "to");
  const format = firstFlag(parsed.flags, "format", "text");

  if (!from || !to) {
    process.stderr.write("Error: --from and --to session IDs required\n");
    return 1;
  }

  const session1 = loadSessionById(paths, from);
  const session2 = loadSessionById(paths, to);

  if (!session1 || !session2) {
    process.stderr.write("Error: One or both sessions not found\n");
    return 1;
  }

  if (format === "json") {
    printJson({
      from: session1,
      to: session2,
      diff: computeDiff(session1, session2),
    });
  } else {
    renderDiff(session1, session2);
  }

  return 0;
}

function computeDiff(s1: SessionRecord, s2: SessionRecord) {
  return {
    timeSpan: {
      from: s1.startedAt,
      to: s2.startedAt,
      durationDays: (new Date(s2.startedAt).getTime() - new Date(s1.startedAt).getTime()) / (1000 * 60 * 60 * 24),
    },
    goalChanged: s1.currentGoal !== s2.currentGoal,
    newWork: s2.workDone.filter(w => !s1.workDone.includes(w)),
    newRegressions: s2.regressionRisks.filter(r => !s1.regressionRisks.includes(r)),
    clearedRegressions: s1.regressionRisks.filter(r => !s2.regressionRisks.includes(r)),
    newBlockers: s2.blockers.filter(b => !s1.blockers.includes(b)),
    clearedBlockers: s1.blockers.filter(b => !s2.blockers.includes(b)),
    fileChanges: {
      new: s2.changedFiles.filter(f => !s1.changedFiles.includes(f)),
      removed: s1.changedFiles.filter(f => !s2.changedFiles.includes(f)),
    },
  };
}

function renderDiff(s1: SessionRecord, s2: SessionRecord): void {
  const diff = computeDiff(s1, s2);

  console.log(`\n📊 Session Diff\n`);
  console.log(`FROM: ${s1.title} (${s1.id})`);
  console.log(`TO:   ${s2.title} (${s2.id})`);
  console.log(`Time span: ${diff.timeSpan.from} → ${diff.timeSpan.to} (${diff.timeSpan.durationDays.toFixed(1)} days)\n`);

  if (diff.goalChanged) {
    console.log(`🎯 Goal Changed:`);
    console.log(`  FROM: ${s1.currentGoal}`);
    console.log(`  TO:   ${s2.currentGoal}\n`);
  }

  if (diff.newWork.length > 0) {
    console.log(`✅ New Work Completed:`);
    diff.newWork.forEach(w => console.log(`  + ${w}`));
    console.log("");
  }

  if (diff.newRegressions.length > 0) {
    console.log(`⚠️  New Regression Risks:`);
    diff.newRegressions.forEach(r => console.log(`  + ${r}`));
    console.log("");
  }

  if (diff.clearedRegressions.length > 0) {
    console.log(`✓ Cleared Regression Risks:`);
    diff.clearedRegressions.forEach(r => console.log(`  - ${r}`));
    console.log("");
  }

  if (diff.newBlockers.length > 0) {
    console.log(`🚫 New Blockers:`);
    diff.newBlockers.forEach(b => console.log(`  + ${b}`));
    console.log("");
  }

  if (diff.clearedBlockers.length > 0) {
    console.log(`✓ Cleared Blockers:`);
    diff.clearedBlockers.forEach(b => console.log(`  - ${b}`));
    console.log("");
  }

  console.log(`📁 File Changes: +${diff.fileChanges.new.length} new, -${diff.fileChanges.removed.length} removed\n`);
}
```

**Validation:**
```bash
holistic diff --from session-2026-03-19T19-30-32-935Z --to session-2026-03-20T01-56-30-503Z
# Should show goal changes, new work, regressions, etc.

holistic diff --from <id1> --to <id2> --format json | jq
# Should output structured diff
```

---

### Task 1c: `holistic status` Command

**Goal:** Quick read-only view of current session without side effects.

**Implementation:**
```typescript
async function handleStatus(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const { state } = loadState(rootDir);

  if (!state.activeSession) {
    console.log(`\n📋 Holistic Status\n`);
    console.log(`No active session.`);
    
    if (state.lastHandoff) {
      console.log(`\nLast handoff: ${state.lastHandoff.summary}`);
      console.log(`Next action: ${state.lastHandoff.nextAction}`);
    }
    
    if (state.pendingWork.length > 0) {
      console.log(`\nPending work: ${state.pendingWork.length} item(s)`);
      state.pendingWork.slice(0, 3).forEach(item => {
        console.log(`  - ${item.title}`);
      });
    }
    
    console.log("");
    return 0;
  }

  const session = state.activeSession;
  console.log(`\n📋 Holistic Status\n`);
  console.log(`Session: ${session.id}`);
  console.log(`Title: ${session.title}`);
  console.log(`Agent: ${session.agent}`);
  console.log(`Branch: ${session.branch}`);
  console.log(`Started: ${session.startedAt}`);
  console.log(`Checkpoints: ${session.checkpointCount}`);
  console.log(`\nGoal: ${session.currentGoal}`);
  console.log(`Status: ${session.latestStatus}`);
  
  if (session.nextSteps.length > 0) {
    console.log(`\nNext steps:`);
    session.nextSteps.forEach(step => console.log(`  - ${step}`));
  }
  
  if (session.blockers.length > 0) {
    console.log(`\n🚫 Blockers:`);
    session.blockers.forEach(b => console.log(`  - ${b}`));
  }
  
  if (session.regressionRisks.length > 0) {
    console.log(`\n⚠️  Regression watch (${session.regressionRisks.length} items)`);
  }
  
  console.log(`\n📁 Changed files: ${session.changedFiles.length}\n`);
  
  return 0;
}
```

**Validation:**
```bash
# Test with active session
holistic start-new --goal "Test status command"
holistic checkpoint --reason "test"
holistic status
# Should show session details without modifying state

# Test with no active session
holistic handoff
holistic status
# Should show last handoff + pending work
```

---

### Task 1d: Git Hook Installer

**Goal:** Auto-checkpoint on commit, show status reminder before push.

**Implementation:**

1. **Add `--install-hooks` flag to `holistic init`:**
```typescript
async function handleInit(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const result = initializeHolistic(rootDir, {
    // ... existing options ...
    installGitHooks: firstFlag(parsed.flags, "install-hooks") === "true",
  });
  
  if (result.gitHooksInstalled) {
    process.stdout.write(`Git hooks installed:\n`);
    process.stdout.write(`  post-commit: Auto-checkpoint after each commit\n`);
    process.stdout.write(`  pre-push: Status reminder before push\n`);
  }
  
  return 0;
}
```

2. **Create hook installer in `src/core/git-hooks.ts`:**
```typescript
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

export function installGitHooks(rootDir: string): { installed: boolean; hooks: string[] } {
  const gitDir = path.join(rootDir, ".git");
  
  if (!fs.existsSync(gitDir)) {
    return { installed: false, hooks: [] };
  }

  const hooksDir = path.join(gitDir, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const installedHooks: string[] = [];

  // Post-commit hook
  const postCommitPath = path.join(hooksDir, "post-commit");
  const postCommitScript = `#!/bin/bash
# Holistic auto-checkpoint after commit

if [ -f ".holistic/state.json" ]; then
  COMMIT_MSG=$(git log -1 --pretty=%B)
  holistic checkpoint \\
    --reason "post-commit" \\
    --status "Committed: $COMMIT_MSG" \\
    2>/dev/null || true
fi

exit 0
`;
  
  fs.writeFileSync(postCommitPath, postCommitScript, { mode: 0o755 });
  installedHooks.push("post-commit");

  // Pre-push hook
  const prePushPath = path.join(hooksDir, "pre-push");
  const prePushScript = `#!/bin/bash
# Holistic status reminder before push

if [ -f ".holistic/state.json" ]; then
  echo ""
  echo "🧠 Holistic Status:"
  holistic status 2>/dev/null || true
  echo ""
  echo "Push to sync Holistic state:"
  echo "  git push origin holistic/state"
  echo ""
fi

exit 0
`;
  
  fs.writeFileSync(prePushPath, prePushScript, { mode: 0o755 });
  installedHooks.push("pre-push");

  return { installed: true, hooks: installedHooks };
}
```

**Validation:**
```bash
# Install hooks
holistic init --install-hooks

# Verify hooks exist
ls -la .git/hooks/
# Should show post-commit and pre-push

# Test post-commit
echo "test" >> README.md
git add README.md
git commit -m "test: hook integration"
# Should auto-create checkpoint

# Test pre-push
git push
# Should show Holistic status before push
```

---

### Task 1e: State File Concurrency Protection

**Goal:** Prevent race conditions when two agents access state.json simultaneously.

**Implementation:**

```typescript
// src/core/lock.ts
import fs from "node:fs";
import path from "node:path";

const LOCK_TIMEOUT = 5000;  // 5 seconds

export async function withLock<T>(
  lockPath: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  // Try to acquire lock
  while (true) {
    try {
      // Atomic lock file creation
      fs.writeFileSync(lockPath, process.pid.toString(), { flag: "wx" });
      break;
    } catch (error) {
      // Lock exists, wait
      if (Date.now() - startTime > LOCK_TIMEOUT) {
        throw new Error(`Failed to acquire lock after ${LOCK_TIMEOUT}ms`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  try {
    return await fn();
  } finally {
    // Release lock
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // Lock already released
    }
  }
}

// src/core/state.ts - Update saveState
export function saveState(paths: RuntimePaths, state: HolisticState): void {
  const lockPath = `${paths.stateFile}.lock`;
  
  // Use atomic write with lock
  withLock(lockPath, async () => {
    state.updatedAt = now();
    const tempPath = `${paths.stateFile}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2) + "\n", "utf8");
    fs.renameSync(tempPath, paths.stateFile);  // Atomic rename
  }).catch(error => {
    console.error(`Warning: Failed to save state: ${error.message}`);
  });
}
```

**Validation:**
```bash
# Test concurrent access
# Terminal 1:
holistic checkpoint --reason "test1" &

# Terminal 2 (immediately):
holistic checkpoint --reason "test2" &

# Wait for both to complete
wait

# Verify both checkpoints recorded
cat .holistic/state.json | grep checkpointCount
# Should show 2 checkpoints, no corruption
```

---

## Testing Strategy

### Unit Tests
- MCP tool schemas valid
- Diff computation correct
- Lock acquisition/release works
- Git hooks created with correct permissions

### Integration Tests
1. **MCP server:**
   - holistic_resume returns valid payload
   - holistic_checkpoint creates checkpoint
   - holistic_handoff archives session

2. **Diff:**
   - Detects goal changes
   - Shows new work, regressions, blockers
   - JSON format parseable

3. **Git hooks:**
   - Post-commit creates checkpoint
   - Pre-push shows status
   - Hooks don't break git workflow

4. **Concurrency:**
   - Simultaneous checkpoints don't corrupt state
   - Lock timeout works
   - Lock released on error

---

## Success Criteria

- [x] Thin MCP server mode exists in repo and persists Holistic state
- [x] `holistic diff` shows meaningful changes between sessions
- [x] `holistic status` provides a quick read-only overview
- [x] Git hooks can be installed and generate portable hook scripts
- [x] Concurrent state access is protected by a state lock
- [x] Documentation is updated for the implemented Phase 1 feature set

---

## Release Follow-Up

- [ ] Re-run end-to-end MCP validation with external Claude Desktop and Cursor clients
- [ ] Reconfirm command behavior on macOS and Linux in a real environment before release
- [ ] Update version to 0.2.0 when the release is ready
- [ ] Publish to npm
- [ ] Create GitHub release
- [ ] Update any release notes or changelog material

---

## Documentation Updates

1. Add MCP setup guide to README
2. Document `holistic diff` use cases
3. Add `holistic status` to quick reference
4. Create git hooks configuration guide
5. Update command list in `--help`

---

## Why These Features?

**MCP Server:**
- Unlocks invisible capture in agents
- Works with existing tools (Claude, Cursor)
- Most requested integration

**Diff:**
- Essential for team mode
- Personal review of progress
- Foundation for analytics

**Status:**
- Quick sanity check
- Safe for git hooks
- No side effects

**Git Hooks:**
- Zero-friction checkpointing
- Users already commit regularly
- Integrates into existing workflow

**Concurrency:**
- Team mode requirement
- Prevents corruption
- Future-proofs for daemon

---

## Post-Completion

After Phase 1:
- [x] Update roadmap to mark Phase 1 complete
- [x] Begin Phase 1.5 (Workflow Disappearance)
- [ ] Update version to 0.2.0
- [ ] Publish to npm
- [ ] Create GitHub release
- [ ] Begin Phase 2 (Team/Org Mode)
