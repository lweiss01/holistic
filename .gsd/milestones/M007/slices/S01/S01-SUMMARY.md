---
slice: S01
milestone: M007
subsystem: andon-hooks
tags: [hooks, claude-code, setup, powershell, bash, event-forwarding]
dependency_graph:
  requires: []
  provides:
    - "andon-hook.ps1 — PostToolUse/Stop event forwarder (PowerShell)"
    - "andon-hook.sh — PostToolUse/Stop event forwarder (POSIX)"
    - "installAndonHooks() — idempotent hook registration in .claude/settings.json"
    - "refreshAndonHooks() — keeps hooks current when repo path changes"
    - "getSetupStatus() andon-hooks component — detects whether hooks are installed"
  affects:
    - "src/core/setup.ts — repairHolistic, bootstrapHolistic, writeSystemArtifacts"
    - ".claude/settings.json — PostToolUse and Stop hook entries added"
tech_stack:
  added: []
  patterns:
    - "Walk-up loop (5 levels) from hookData.cwd to find .holistic-local/state.json"
    - "Dual-field null-coalesce for tool_response.exit_code vs tool_response.exitCode"
    - "Fire-and-forget HTTP POST with 1s timeout via Invoke-RestMethod / curl"
    - "Idempotent hook registration (presence check on andon-hook substring)"
key_files:
  created:
    - ".holistic/system/andon-hook.ps1 (generated at runtime by writeAndonHookScripts)"
    - ".holistic/system/andon-hook.sh (generated at runtime by writeAndonHookScripts)"
  modified:
    - "src/core/setup.ts"
decisions:
  - "andonHookCommand() uses paths.holisticDir (not hardcoded .holistic) for correct path resolution across machine setups"
  - "writeAndonHookScripts() called from writeSystemArtifacts() so scripts are regenerated on every repair/init"
  - "installAndonHooks() added to repairHolistic and bootstrapHolistic when .claude dir is present"
  - "getSetupStatus() adds andon-hooks component with andonHooksInstalled boolean field"
  - "SetupComponentStatus union type extended with andon-hooks component"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 2
---

# M007 S01: Andon Hook Scripts and Setup Integration Summary

Claude Code's PostToolUse and Stop hook events are now wired into the Andon API via PowerShell and Bash hook scripts, with `setup.ts` managing installation and regeneration automatically.

## What Was Built

### Task 1: Hook Scripts

Two hook scripts were created (generated into `.holistic/system/` at runtime by `writeAndonHookScripts()`):

**`andon-hook.ps1`** (PowerShell — primary for Windows):
- Reads JSON from stdin; exits 0 silently if empty
- Walk-up loop (5 levels) from `$hookData.cwd` to find `.holistic-local/state.json` or `.holistic/state.json`
- Extracts `sessionId` from `state.activeSession.id`
- Maps `PostToolUse` + Bash tool to `command.finished`/`command.failed` or `test.finished`/`test.failed` (based on test runner pattern match)
- Maps `PostToolUse` + Edit/Write tools to `file.changed` with `payload.path` for status engine scope detection
- Maps `Stop` event to `agent.summary_emitted`
- Dual-field null-coalesce: `tool_response.exit_code ?? tool_response.exitCode`
- Fire-and-forget POST to `http://127.0.0.1:4318/events` with 1s timeout

**`andon-hook.sh`** (Bash — POSIX parity for Linux/macOS):
- Same walk-up logic using `jq -r '.cwd // empty'` instead of `$PWD`
- Same event mapping logic
- Fire-and-forget `curl -s --max-time 1` call

### Task 2: `setup.ts` Extensions

**`installAndonHooks(rootDir, paths, platform?)`**
- Reads `.claude/settings.json`, adds PostToolUse and Stop hook entries
- Uses `paths.holisticDir` for correct script path (not hardcoded `.holistic`)
- Idempotent: presence check on `'andon-hook'` substring prevents duplicate entries
- Preserves existing SessionStart, UserPromptSubmit hooks unchanged

**`refreshAndonHooks(rootDir, paths, platform?)`**
- Only runs if andon hooks already installed (returns `false` if missing)
- Calls `installAndonHooks()` to update script paths when repo moves

**`writeAndonHookScripts(paths)`** (internal, called by `writeSystemArtifacts`):
- Renders both scripts from `renderAndonHookPs1()` and `renderAndonHookSh()`
- Called from `writeSystemArtifacts()` so scripts regenerate on every `holistic repair`/`holistic init`

**`getSetupStatus()` extension**:
- Adds `andon-hooks` component to the returned `SetupComponentStatus[]`
- `andonHooksInstalled: boolean` field on the component entry
- `status: "ok"` when PostToolUse hook containing `andon-hook` is found in settings.json
- `status: "missing"` when not found or file absent

**`SetupComponentStatus` type extension**:
- Added `"andon-hooks"` to the component union type
- Added optional `andonHooksInstalled?: boolean` field

**Wire-up**:
- `repairHolistic()` calls `installAndonHooks()` when `.claude` dir present
- `bootstrapHolistic()` calls `installAndonHooks()` when `.claude` dir present and `installClaudeHooks !== false`

## Verification

```
node --experimental-strip-types -e "
import { installAndonHooks, refreshAndonHooks } from './src/core/setup.ts';
console.log(typeof installAndonHooks, typeof refreshAndonHooks);
"
# Output: function function
```

`getSetupStatus()` returns:
```json
{
  "component": "andon-hooks",
  "status": "ok",
  "details": "PostToolUse and Stop hooks present in settings.json",
  "andonHooksInstalled": true
}
```

`.claude/settings.json` after `installAndonHooks()`:
```json
{
  "PostToolUse": [{ "hooks": [{ "type": "command", "command": "powershell ... andon-hook.ps1" }] }],
  "Stop": [{ "hooks": [{ "type": "command", "command": "powershell ... andon-hook.ps1" }] }]
}
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] andonHookCommand() used hardcoded `.holistic` path instead of paths.holisticDir**
- **Found during:** Task 2 verification
- **Issue:** `andonHookCommand(repoRoot, platform)` used `path.join(repoRoot, ".holistic", "system")` — same pattern as `autoCheckpointCommand`. For self-dogfooding projects where `paths.holisticDir` is `.holistic-local`, this would write the wrong path to settings.json, pointing to non-existent scripts.
- **Fix:** Changed `andonHookCommand` to take `paths: RuntimePaths` and use `systemDir(paths)` instead of hardcoded path.
- **Files modified:** `src/core/setup.ts`
- **Note:** `autoCheckpointCommand` has the same hardcoded path issue but was not changed (out-of-scope of this slice).

## Self-Check

Files created/generated:
- `src/core/setup.ts` modified — FOUND (committed at 509c2294)
- `.holistic-local/system/andon-hook.ps1` — generated at runtime by `writeAndonHookScripts`
- `.holistic-local/system/andon-hook.sh` — generated at runtime by `writeAndonHookScripts`
- `.gsd/milestones/M007/slices/S01/S01-SUMMARY.md` — this file

Commits:
- `509c2294` — feat(M007-S01): extend setup.ts with Andon hook management

## Self-Check: PASSED
