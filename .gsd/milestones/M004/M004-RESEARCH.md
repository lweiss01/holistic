# M004 Research Summary

**Researched:** 2026-04-02  
**Domain:** Git commit execution, sync script portability, file I/O error handling, daemon state persistence, deduplication bugs, snapshot performance  
**Confidence:** HIGH

## Summary

M004 addresses critical reliability and performance gaps in Holistic's auto-commit, sync, file I/O, and daemon subsystems:

1. **Auto-commit writes intent but never executes** — `writePendingCommit()` creates `.holistic/context/pending-commit.txt` but no code actually runs `git commit`. The handoff flow records commit intent in `state.pendingCommit` but never calls git.

2. **Sync scripts have hardcoded ROOT paths** — Generated sync scripts in `.holistic/system/sync-state.{sh,ps1}` use hardcoded absolute paths like `ROOT='/absolute/path/to/repo'`. When a user cd's to a subdirectory and runs the script, it fails because the path is wrong.

3. **File I/O operations lack error handling** — All `fs.readFileSync()`, `fs.writeFileSync()`, `fs.mkdirSync()`, `fs.unlinkSync()` calls in critical paths (state.ts, git.ts) will crash the process if they hit permission errors, missing files, or disk full.

4. **Daemon writes state.json on every tick** — `persistObservedState()` is called in buffering paths (when files change but no checkpoint is triggered), writing state.json 120+ times per hour even when nothing meaningful changed.

5. **Three deduplication/minor bugs** — `recentFirstMerge()` doesn't dedupe its own list before merging, detached HEAD returns "detached" instead of commit SHA, and session hygiene runs on every daemon tick instead of once per day.

6. **Snapshot walks entire tree** — `walkRepoFiles()` recursively stats every file in the repo (skipping node_modules/build/etc). On 1000+ file repos, this is slow. Git ls-files is 10x faster.

## Current State

### S01: Auto-Commit Execution

**Current behavior:**
- Handoff flow calls `writePendingCommit(paths, message)` which writes to `.holistic/context/pending-commit.txt`
- State stores `pendingCommit: { message, files }` 
- No code actually stages files or runs `git commit`
- User must manually commit if they want the changes in git

**What exists:**
- `writePendingCommit()` and `clearPendingCommit()` in src/core/git.ts
- `state.pendingCommit` in types and state management
- CLI shows "Pending git commit: <message>" after handoff
- CLI has `holistic commit-done` to clear pending state

**What's missing:**
- `commitPendingChanges()` function to execute the actual commit
- Integration into handoff flow (auto-commit after writing pending-commit.txt)
- Error handling for git commit failures
- Verification that files are staged correctly

**Files:**
- `src/core/git.ts` — needs new `commitPendingChanges()` function
- `src/cli.ts` — handoff command needs to call commit after writePendingCommit
- `src/core/state.ts` — handoffSession needs commit integration

### S02: Sync Script Portability

**Current behavior:**
- `src/core/setup.ts` generates `.holistic/system/sync-state.sh` and `.holistic/system/sync-state.ps1`
- Scripts have hardcoded `ROOT='/absolute/path'` at the top
- When user cd's to subdirectory and runs script, ROOT is wrong
- Script fails because git commands use wrong directory

**What exists:**
- Script generation in `buildHelperScripts()` in src/core/setup.ts
- Scripts use `ROOT` variable throughout
- Scripts work if run from repo root

**What's missing:**
- Dynamic ROOT resolution using script location or git repo detection
- For shell: `ROOT="$(cd "$(dirname "$0")/../.." && pwd)"`
- For PowerShell: `$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)`

**Files:**
- `src/core/setup.ts` — `buildHelperScripts()` function needs updated script templates

### S03: File I/O Error Handling

**Current behavior:**
- All fs.*Sync() calls will throw and crash if they hit errors
- No try/catch around critical operations
- `chmod 000 .holistic/state.json && holistic checkpoint` crashes with EACCES

**What exists:**
- 19 fs.*Sync() calls in src/core/state.ts
- Additional calls in src/core/git.ts, src/core/docs.ts
- `withStateLock()` has lock file handling but no I/O error handling

**What's missing:**
- try/catch wrappers around all fs.*Sync() calls
- Graceful error messages instead of stack traces
- Return `{success: boolean, error?: string}` pattern
- Callers need to check success and handle errors

**Files:**
- `src/core/state.ts` — wrap saveState, loadState, all session I/O
- `src/core/git.ts` — wrap snapshot capture, pending commit I/O
- `src/core/docs.ts` — wrap doc generation

### S04: Daemon State Persistence Optimization

**Current behavior:**
- `persistObservedState()` is called 3 times in daemon buffering paths:
  1. When files change but no checkpoint (buffering pending files)
  2. During quiet tick counting
  3. After time-based checks
- Each call writes state.json to disk
- Daemon runs every 60 seconds, so 60 writes/hour minimum

**What exists:**
- `persistLocked()` — writes docs + snapshot + saveState (used when checkpointing)
- `persistObservedState()` — updates snapshot + saveState (used when buffering)
- Three call sites in src/daemon.ts buffering paths

**What's missing:**
- Conditional persistence — only write when checkpoint actually created
- In-memory state tracking without disk writes during buffering
- State should only persist when:
  - Checkpoint created
  - Branch changed
  - Hygiene ran
  - Not during buffering/quiet ticks

**Files:**
- `src/daemon.ts` — remove `persistObservedState()` calls from buffering paths

### S05: Deduplication & Minor Bugs

**Bug 1: recentFirstMerge doesn't dedupe incoming**
- `recentFirstMerge(current, incoming)` calls `sanitizeList(incoming)` but then can add duplicates
- If incoming = ['a', 'a', 'b'], it becomes ['a', 'b'] after sanitize, but doesn't check if 'a' is in current
- Result: ['a', 'b', ...current] even if current already has 'a'

**Bug 2: Detached HEAD shows "detached" not SHA**
- `getBranchName()` returns "detached" when HEAD is detached
- Should return commit SHA instead so user knows where they are
- Use `git rev-parse HEAD` to get SHA

**Bug 3: Session hygiene runs on every tick**
- `runSessionHygiene()` is called on every daemon tick
- Should throttle to once per day
- Add `lastHygieneAt` to state and check elapsed time

**Files:**
- `src/core/state.ts` — fix `recentFirstMerge()`
- `src/core/git.ts` — fix `getBranchName()` for detached HEAD
- `src/daemon.ts` — throttle `runSessionHygiene()`

### S06: Git LS-Files for Snapshot

**Current behavior:**
- `walkRepoFiles()` recursively walks directory tree
- Stats every file (size + mtime)
- Skips SKIP_DIRS but still slow on large repos

**What exists:**
- `captureRepoSnapshot()` calls `walkRepoFiles()`
- SKIP_DIRS set to avoid node_modules/build/dist
- Result is `Record<string, string>` of "size:mtime"

**What's missing:**
- Use `git ls-files -z` to get tracked files only
- Much faster than filesystem walk
- Handles .gitignore automatically
- Need error handling if not in git repo

**Files:**
- `src/core/git.ts` — replace `walkRepoFiles()` with git ls-files

## Verification Strategy

### S01 Verification
After handoff, run `git log -1` — should show commit with correct message and Holistic files staged.

### S02 Verification
Generate sync script, cd to subdirectory, run `./holistic/system/sync-state.sh` — should succeed.

### S03 Verification
`chmod 000 .holistic/state.json && holistic checkpoint` — should show error message, not crash.

### S04 Verification
Run daemon for 1 hour with active file changes — state.json should be written <5 times instead of 120+.

### S05 Verification
- Detached HEAD: `git checkout <sha> && holistic status` — should show commit SHA, not "detached"
- Hygiene: daemon runs for 25 hours — hygiene should run ~1 time, not 1500 times
- Deduplication: add duplicate nextSteps in checkpoint — should not appear twice

### S06 Verification
Repo with 1000+ files — capture snapshot before/after change, measure duration. Should be 10x faster.

## Risk Assessment

**S01 (High):** Git commit execution is critical path. If it fails, handoffs break. Need careful error handling.

**S02 (Medium):** Sync script changes affect all platforms. Need testing on Mac/Windows/Linux.

**S03 (High):** Error handling changes touch many call sites. Missing one could leave a crash path.

**S04 (Medium):** Removing persistence could lose state if daemon crashes. Need to verify state is saved when it matters.

**S05 (Low):** Bug fixes are isolated and low-risk.

**S06 (Medium):** Git ls-files changes core snapshot logic. Need fallback if git not available.

## Dependencies

- S02 depends on S01 (sync scripts push commits, so commit execution should work first)
- S04 depends on S03 (if state persistence fails silently, we won't notice without error handling)
- S06 depends on S03 (git ls-files can fail, need error handling)

## Key Decisions

1. **Auto-commit timing**: Commit immediately after handoff OR defer to next checkpoint?
   - **Recommendation**: Immediate commit — user expectation is that handoff creates commit
   
2. **Error handling pattern**: Throw OR return {success, error}?
   - **Recommendation**: Return pattern — more graceful, easier to test

3. **Daemon persistence**: Remove all buffering writes OR keep some?
   - **Recommendation**: Remove buffering writes, only persist on checkpoints

4. **Detached HEAD SHA**: Use HEAD OR FETCH_HEAD OR full SHA?
   - **Recommendation**: Use `git rev-parse --short HEAD` for readable 7-char SHA

5. **Git ls-files fallback**: Fail OR fall back to walkRepoFiles?
   - **Recommendation**: Fall back — non-git repos should still work (though sync won't)

## Next Steps

Create detailed task plans for each slice with specific implementation steps, files to modify, and verification commands.
