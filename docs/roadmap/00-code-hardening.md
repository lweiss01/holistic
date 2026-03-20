# Roadmap: Phase 0 - Code Hardening

**Priority:** 🔴 **CRITICAL - DO THIS FIRST**  
**Complexity:** Low  
**Dependencies:** None  
**Estimated effort:** 1-2 sessions  
**Affected areas:** `cli`, `state-management`, `git-integration`, `types`

## Goal

Fix foundational code issues before any marketing or new features. Address embarrassing bugs and ambiguities that will surface when new users start kicking the tires. This phase must be completed before Phase 1 (Feature Expansion).

## Why This Matters

Building features on a shaky foundation means:
- Silent failures that are hard to debug
- Breaking changes when you finally fix the issues
- Users encountering bugs that make them abandon the tool
- Tech debt that compounds with every new feature

Better to fix these now while the user base is small.

---

## Implementation Plan

### Task 1a: Fix the "master" branch fallback ambiguity

**Current Problem:**
- `getBranchName()` in `git.ts` returns `"master"` as fallback when `.git/HEAD` is missing
- `createSession()` in `state.ts` initializes `branch: "master"`
- A failed git read is **indistinguishable** from actually being on master branch
- This creates silent failures that are impossible to diagnose

**The Fix:**
```typescript
// git.ts - Change fallback to make failures visible
function getBranchName(rootDir: string): string {
  try {
    const headPath = path.join(rootDir, ".git", "HEAD");
    const content = fs.readFileSync(headPath, "utf8").trim();
    
    if (content.startsWith("ref: refs/heads/")) {
      return content.replace("ref: refs/heads/", "");
    }
    
    return "detached";
  } catch {
    return "unknown";  // Changed from "master"
  }
}

// state.ts - Initialize as empty string, not "master"
function createSession(agent: AgentName, goal: string, title?: string, plan?: string[]): SessionRecord {
  const timestamp = now();
  return {
    id: `session-${timestamp.replaceAll(":", "-").replaceAll(".", "-")}`,
    agent,
    branch: "",  // Changed from "master" - will be set by refreshSessionFromRepo()
    // ... rest of fields
  };
}
```

**Validation:**
```bash
# Test 1: Normal repo
cd /path/to/holistic
holistic start-new --goal "Test"
cat .holistic/state.json | grep branch  # Should show actual branch

# Test 2: Corrupted .git
rm .git/HEAD
holistic start-new --goal "Test"
cat .holistic/state.json | grep branch  # Should show "unknown", not "master"

# Test 3: Detached HEAD
git checkout HEAD~1
holistic start-new --goal "Test"
cat .holistic/state.json | grep branch  # Should show "detached"
```

**Regression Guard:**
- Never silently fall back to a plausible branch name
- Always make failures visibly different from success states

---

### Task 1b: Expand AgentName and adapter routing

**Current Problem:**
- `AgentName` union locked to `"codex" | "claude" | "antigravity" | "unknown"`
- `asAgent()` in `cli.ts` silently returns `"unknown"` for anything else
- Every new tool falls back to Codex adapter doc
- No adapters for Gemini, Copilot, Cursor, Goose, or GSD

**The Fix:**

1. **Expand the union in `src/core/types.ts`:**
```typescript
export type AgentName = 
  | "codex"
  | "claude"
  | "antigravity"
  | "gemini"
  | "copilot"
  | "cursor"
  | "goose"
  | "gsd"
  | "unknown";
```

2. **Update `asAgent()` in `src/cli.ts`:**
```typescript
function asAgent(value: string): AgentName {
  const validAgents: AgentName[] = [
    "codex",
    "claude", 
    "antigravity",
    "gemini",
    "copilot",
    "cursor",
    "goose",
    "gsd"
  ];
  
  if (validAgents.includes(value as AgentName)) {
    return value as AgentName;
  }
  
  return "unknown";
}
```

3. **Update `defaultDocIndex()` in `src/core/state.ts`:**
```typescript
function defaultDocIndex(): DocIndex {
  return {
    // ... existing fields ...
    adapterDocs: {
      codex: ".holistic/context/adapters/codex.md",
      claude: ".holistic/context/adapters/claude-cowork.md",
      antigravity: ".holistic/context/adapters/antigravity.md",
      gemini: ".holistic/context/adapters/gemini.md",
      copilot: ".holistic/context/adapters/copilot.md",
      cursor: ".holistic/context/adapters/cursor.md",
      goose: ".holistic/context/adapters/goose.md",
      gsd: ".holistic/context/adapters/gsd.md",
    },
    // ... rest of fields ...
  };
}
```

4. **Create adapter files** in `.holistic/context/adapters/`:
   - `gemini.md`
   - `copilot.md`
   - `cursor.md`
   - `goose.md`
   - `gsd.md`

   Use this template:
   ```markdown
   # {Tool Name} Adapter

   ## Startup Contract

   1. Read `HOLISTIC.md`.
   2. Review `project-history.md`, `regression-watch.md`, and `zero-touch.md` for durable memory before editing related code.
   3. If the Holistic daemon is installed, treat passive session capture as already active.
   4. Run `holistic resume --agent {tool-name}` when you need an explicit recap or recovery flow.
   5. Recap the current state for the user in the first 30 seconds.
   6. Ask: continue as planned, tweak the plan, or start something new.

   ## Checkpoint Contract

   Run `holistic checkpoint` when:
   - the task focus changes
   - you are about to compact or clear context
   - you finish a meaningful chunk of work
   - you fix or alter behavior that could regress later

   Include impact notes and regression risks when they matter.

   ## Handoff Contract

   - Preferred: map your session-end workflow to `holistic handoff`
   - Fallback: ask the user to run `holistic handoff` before leaving the session
   ```

5. **Update `printHelp()` in `src/cli.ts`:**
```typescript
function printHelp(): void {
  process.stdout.write(`Holistic CLI

Usage:
  holistic init [...]
  holistic resume [--agent codex|claude|antigravity|gemini|copilot|cursor|goose|gsd] [...]
  holistic checkpoint [...]
  holistic handoff [...]
  holistic start-new [...]
  holistic watch [--agent codex|claude|antigravity|gemini|copilot|cursor|goose|gsd] [...]
`);
}
```

**Validation:**
```bash
# Test each agent name
holistic resume --agent gemini
holistic resume --agent copilot
holistic resume --agent cursor
holistic resume --agent goose
holistic resume --agent gsd

# Verify adapter docs exist
ls .holistic/context/adapters/  # Should list all 8 adapters
```

---

### Task 1c: Add state migration

**Current Problem:**
- `version: 1` is stored in `state.json` but `loadState()` does nothing with it
- No guard, no migration, no warning
- Future schema changes will silently break old users

**The Fix:**

1. **Add version constant in `src/core/state.ts`:**
```typescript
const CURRENT_STATE_VERSION = 1;

export function loadState(rootDir: string): { state: HolisticState; paths: RuntimePaths; created: boolean } {
  const paths = getRuntimePaths(rootDir);
  ensureDirs(paths);

  if (!fs.existsSync(paths.stateFile)) {
    return { state: createInitialState(rootDir), paths, created: true };
  }

  const raw = fs.readFileSync(paths.stateFile, "utf8");
  let state = JSON.parse(raw) as HolisticState;
  
  // Migrate if needed
  if (state.version < CURRENT_STATE_VERSION) {
    state = migrateState(state, state.version, CURRENT_STATE_VERSION);
  }
  
  // Apply defaults
  const defaults = defaultDocIndex();
  state.docIndex = {
    ...defaults,
    ...(state.docIndex ?? {}),
    adapterDocs: {
      ...defaults.adapterDocs,
      ...(state.docIndex?.adapterDocs ?? {}),
    },
  };
  state.pendingWork = state.pendingWork ?? [];
  state.repoSnapshot = state.repoSnapshot ?? {};
  state.pendingCommit = state.pendingCommit ?? null;
  
  return { state, paths, created: false };
}
```

2. **Add migration function:**
```typescript
function migrateState(state: HolisticState, fromVersion: number, toVersion: number): HolisticState {
  let migrated = { ...state };
  
  // No migrations yet, but pattern is in place
  // Future example:
  // if (fromVersion < 2) {
  //   migrated = migrateV1ToV2(migrated);
  // }
  
  migrated.version = toVersion;
  migrated.updatedAt = now();
  
  // Log migration for debugging
  if (fromVersion !== toVersion) {
    console.log(`Migrated Holistic state from v${fromVersion} to v${toVersion}`);
  }
  
  return migrated;
}

// Example future migration (commented out for now)
// function migrateV1ToV2(state: HolisticState): HolisticState {
//   return {
//     ...state,
//     // Add new fields with defaults
//     newField: "default value",
//   };
// }
```

**Validation:**
```bash
# Test migration path
# 1. Create a v1 state
holistic init

# 2. Manually edit .holistic/state.json to set version: 0

# 3. Run any command
holistic resume
# Should see: "Migrated Holistic state from v0 to v1"

# 4. Verify state.json now shows version: 1
cat .holistic/state.json | grep version
```

---

### Task 1d: Consolidate readline usage

**Current Problem:**
- `handleHandoff()` calls `ask()` up to 8 times sequentially
- Each `ask()` creates and closes its own readline interface
- Wasteful and can cause issues on Windows

**The Fix:**

```typescript
async function handleHandoff(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const { state, paths } = loadState(rootDir);
  if (!state.activeSession) {
    process.stderr.write("No active session to hand off.\n");
    return 1;
  }

  // Create readline interface ONCE
  const rl = createInterface({ input, output });

  const input: HandoffInput = {
    summary: firstFlag(parsed.flags, "summary"),
    done: listFlag(parsed.flags, "done"),
    tried: listFlag(parsed.flags, "tried"),
    next: listFlag(parsed.flags, "next"),
    assumptions: listFlag(parsed.flags, "assumption"),
    blockers: listFlag(parsed.flags, "blocker"),
    references: listFlag(parsed.flags, "ref"),
    impacts: listFlag(parsed.flags, "impact"),
    regressions: listFlag(parsed.flags, "regression"),
    status: firstFlag(parsed.flags, "status"),
  };

  if (!input.summary) {
    input.summary = await askWithInterface(rl, "Handoff summary", state.activeSession.latestStatus || state.activeSession.currentGoal);
  }
  if (input.done?.length === 0) {
    input.done = await promptListWithInterface(rl, "Work completed", state.activeSession.workDone);
  }
  // ... rest of prompts using rl ...

  // Close ONCE at the end
  rl.close();

  const nextState = applyHandoff(rootDir, state, input);
  persist(rootDir, nextState, paths);

  if (nextState.pendingCommit) {
    writePendingCommit(paths, nextState.pendingCommit.message);
  }

  process.stdout.write(`Handoff complete.\n...`);
  return 0;
}

// Helper functions that accept the interface
async function askWithInterface(rl: Interface, question: string, fallback = ""): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || fallback;
}

async function promptListWithInterface(rl: Interface, question: string, fallback: string[]): Promise<string[]> {
  const joined = fallback.join(" | ");
  const answer = await askWithInterface(rl, `${question} (separate with |)`, joined);
  return answer
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}
```

Do the same for `handleStartNew()`.

**Validation:**
```bash
# Test interactive handoff flow
holistic start-new --goal "Test readline consolidation"
echo "test" >> README.md
holistic checkpoint --reason "test"
holistic handoff
# Answer prompts - should work smoothly without interface flicker
```

---

### Task 1e: Publish to npm

**Current Problem:**
- `package.json` has `"private": true`
- Install experience is `git clone` + `npm link` (adoption barrier)
- Not discoverable via `npm search holistic`

**The Fix:**

1. **Update `package.json`:**
```json
{
  "name": "holistic",
  "version": "0.1.0",
  "private": false,
  "description": "Cross-agent, cross-platform memory for AI coding work",
  "keywords": [
    "ai",
    "coding-assistant",
    "context-management",
    "agent-memory",
    "claude",
    "cursor",
    "copilot",
    "gemini",
    "handoff",
    "session-management"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/lweiss01/holistic.git"
  },
  "bugs": {
    "url": "https://github.com/lweiss01/holistic/issues"
  },
  "homepage": "https://github.com/lweiss01/holistic#readme",
  "type": "module",
  "bin": {
    "holistic": "./bin/holistic.js"
  },
  "scripts": {
    "holistic": "node --experimental-strip-types ./src/cli.ts",
    "daemon": "node --experimental-strip-types ./src/daemon.ts",
    "test": "node --experimental-strip-types ./tests/run-tests.ts",
    "prepublishOnly": "npm test"
  },
  "engines": {
    "node": ">=24.0.0"
  }
}
```

2. **Add `.npmignore`:**
```
# Development files
tests/
.holistic/
.bg-shell/
.git/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
```

3. **Test local pack:**
```bash
npm pack
# Creates holistic-0.1.0.tgz

# Test installation
npm install -g ./holistic-0.1.0.tgz
holistic --help
```

4. **Publish:**
```bash
npm login
npm publish
```

**Validation:**
```bash
# After publishing, test clean install
npm uninstall -g holistic
npm install -g holistic
holistic init --help
```

---

## Testing Strategy

### Unit Tests
- Branch name fallback returns "unknown" when .git/HEAD missing
- asAgent() recognizes all valid agent names
- State migration increments version correctly
- Readline consolidation doesn't leak interfaces

### Integration Tests
1. **Branch detection:**
   - Normal repo → actual branch name
   - Corrupted .git → "unknown"
   - Detached HEAD → "detached"

2. **Agent routing:**
   - Each agent name → correct adapter doc
   - Unknown agent → "unknown" fallback

3. **State migration:**
   - v0 state → auto-migrates to v1
   - v1 state → no migration needed
   - Migration preserves all existing data

4. **npm installation:**
   - Fresh install works
   - `holistic --help` works
   - All commands available

---

## Success Criteria

- [ ] Branch fallback clearly distinguishes failures from success
- [ ] All 8 agent names recognized and routed to correct adapters
- [ ] State migration pattern in place (even if no migrations yet)
- [ ] Readline interface created once per interactive command
- [ ] Package published to npm with proper metadata
- [ ] Clean install via `npm install -g holistic` works
- [ ] All existing tests still pass
- [ ] No breaking changes to existing functionality

---

## Why This Can't Wait

**User Impact:**
- **Branch ambiguity:** Silent failures confuse users debugging session issues
- **Missing agents:** New tool users immediately hit "unknown" agent and think tool is incomplete
- **No migration:** Future schema changes will break existing users with no recovery path
- **Readline waste:** Windows users may see interface flicker or hangs
- **No npm package:** High friction prevents casual tryouts

**Technical Debt:**
- Each new feature multiplies the cost of fixing these issues later
- Migration becomes harder with more users and more schema versions
- npm publishing after 1000 stars looks unprofessional

---

## Post-Completion Checklist

Before moving to Phase 1 (Feature Expansion):

- [ ] Run full test suite - all passing
- [ ] Test on Windows, macOS, Linux
- [ ] Verify npm package installs cleanly
- [ ] Update README with npm install instructions
- [ ] Tag release as v0.1.0
- [ ] Create GitHub release notes
- [ ] Close all Phase 0 issues

**Then and only then** → proceed to Phase 1.
