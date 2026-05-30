---
slice: S01
type: execute
wave: 1
depends_on: []
files_modified:
  - .holistic/system/andon-hook.ps1
  - .holistic/system/andon-hook.sh
  - src/core/setup.ts
autonomous: true
must_haves:
  truths:
    - "PostToolUse and Stop hook events are forwarded as AgentEvents to http://127.0.0.1:4318/events"
    - "The hook script resolves the Holistic session ID from state.json using cwd from hook JSON, not $PWD"
    - "The hook exits 0 and is silent on failure (Andon API may not be running)"
    - "installAndonHooks() adds PostToolUse and Stop entries to .claude/settings.json"
    - "getSetupStatus() reports andonHooksInstalled: true when hooks are present"
  artifacts:
    - path: ".holistic/system/andon-hook.ps1"
      provides: "PowerShell hook script handling PostToolUse and Stop events"
    - path: ".holistic/system/andon-hook.sh"
      provides: "Bash equivalent for cross-platform parity"
    - path: "src/core/setup.ts"
      provides: "installAndonHooks(), refreshAndonHooks(), andonHooksInstalled status detection"
  key_links:
    - from: "andon-hook.ps1"
      to: ".holistic-local/state.json"
      via: "walk-up from hookData.cwd"
      pattern: "hookData\\.cwd"
    - from: "andon-hook.ps1"
      to: "http://127.0.0.1:4318/events"
      via: "Invoke-RestMethod POST"
      pattern: "Invoke-RestMethod.*4318/events"
    - from: "src/core/setup.ts"
      to: ".claude/settings.json"
      via: "installAndonHooks()"
      pattern: "PostToolUse.*andon-hook"
---

# M007 S01 — Andon Hook Scripts and Setup Integration

Wire Claude Code's PostToolUse and Stop hooks into the Andon API. Create the hook scripts and extend
`setup.ts` so `holistic repair` installs and maintains the hooks automatically.

## Tasks

### Task 1: Write `andon-hook.ps1` and `andon-hook.sh`

**Files:** `.holistic/system/andon-hook.ps1`, `.holistic/system/andon-hook.sh`

**Action:**

Create `.holistic/system/andon-hook.ps1`. The script receives JSON on stdin from Claude Code and
fires a fire-and-forget POST to the Andon API. It must:

1. Set `$ErrorActionPreference = 'SilentlyContinue'` at the top so all errors are swallowed.
2. Read stdin: `$inputJson = $input | Out-String`. Exit 0 if empty.
3. Parse: `$hookData = $inputJson | ConvertFrom-Json`.
4. Walk up from `$hookData.cwd` to find `.holistic-local\state.json` or `.holistic\state.json`.
   Use the following walk-up loop exactly — do not simplify or assume a fixed depth:

```powershell
$dir = $hookData.cwd
$stateFile = $null
$level = 0
while ($dir -and $level -lt 5) {
    $candidate = Join-Path $dir '.holistic-local\state.json'
    if (Test-Path $candidate) { $stateFile = $candidate; break }
    $candidate = Join-Path $dir '.holistic\state.json'
    if (Test-Path $candidate) { $stateFile = $candidate; break }
    $parent = Split-Path $dir -Parent
    if ($parent -eq $dir) { break }   # filesystem root reached
    $dir = $parent
    $level++
}
if (-not $stateFile) { exit 0 }
```

> **ANTI-PATTERN**: Never use `$PWD` or `Get-Location` to find the repo root. In worktrees, `$PWD`
> is the worktree directory (`.claude\worktrees\<branch>`), which has no `.holistic-local\state.json`.
> Always use `$hookData.cwd` from the stdin JSON.

5. Read state: `$state = Get-Content $stateFile -Raw | ConvertFrom-Json`. Extract
   `$sessionId = $state.activeSession.id`. Exit 0 if null or empty.

6. Map the hook event to an `EventType`. Branch on `$hookData.hook_event_name`:
   - `"PostToolUse"` with `tool_name === "Bash"`: read exit code from
     `$hookData.tool_response.exit_code` (preferred). The field name may be `exit_code` OR
     `exitCode` depending on the Claude Code version — null-coalesce both:
     ```powershell
     # tool_response field name may be exit_code OR exitCode — check both
     $exitCode = if ($null -ne $hookData.tool_response.exit_code) {
         $hookData.tool_response.exit_code
     } else {
         $hookData.tool_response.exitCode
     }
     ```
     Check `$hookData.tool_input.command` against test patterns (`npm test`, `jest`, `vitest`,
     `pytest`, `mocha`). If test pattern matches: emit `test.finished` (exit 0) or `test.failed`
     (exit != 0). Otherwise: emit `command.finished` or `command.failed`. Always populate
     `payload.command` and `payload.exitCode`.
   - `"PostToolUse"` with `tool_name` in `@("Edit", "Write")`: emit `file.changed`. Populate
     `payload.path` with `$hookData.tool_input.file_path` (absolute path). This field is required
     by the status engine's out-of-scope detection.
   - `"Stop"`: emit `agent.summary_emitted` with `payload.stopReason = $hookData.stop_reason`.
   - All other events: exit 0.

7. Build the event object and POST:

```powershell
$event = @{
    id        = "hook-$(Get-Date -Format 'yyyyMMddHHmmssfff')-$([System.Guid]::NewGuid().ToString('N').Substring(0,6))"
    sessionId = $sessionId
    type      = $eventType
    source    = $source
    timestamp = (Get-Date -Format 'o')
    summary   = $summary
    payload   = $payload
}
$body = @{ events = @($event) } | ConvertTo-Json -Depth 5 -Compress
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:4318/events" `
        -Method POST -Body $body -ContentType "application/json" `
        -TimeoutSec 1 | Out-Null
} catch { }
exit 0
```

8. The script must never write to stdout (Claude Code parses hook stdout as a JSON decision).
   Pipe all output to `Out-Null`. The `try/catch` must swallow all HTTP errors silently.

Create `.holistic/system/andon-hook.sh` as a Bash equivalent for Linux/macOS parity.
The `.sh` variant should:
- Read stdin via `input=$(cat)`; exit 0 if empty.
- Parse `cwd` with `jq -r '.cwd // empty'`.
- Walk up from `$cwd` to find `.holistic-local/state.json` or `.holistic/state.json` (same
  5-level limit).

> **ANTI-PATTERN (Bash)**: Never use `$PWD` or `$(pwd)` to find the repo root. Use the `cwd`
> field from the stdin JSON exactly as for PowerShell.

- Extract `session_id` via `jq -r '.activeSession.id // empty'`.
- Map events and POST with `curl -s --max-time 1 -X POST ... 2>/dev/null` (fire-and-forget).
- Exit 0 always; redirect all output to `/dev/null`.

**Verification checklist:**
- [ ] `Test-Path .holistic/system/andon-hook.ps1` returns true
- [ ] `Test-Path .holistic/system/andon-hook.sh` returns true
- [ ] Script contains `$hookData.cwd` (not `$PWD`) for repo root resolution
- [ ] Walk-up loop is present with level limit of 5
- [ ] `exit_code` / `exitCode` dual-field check is present in the Bash branch
- [ ] `payload.path` is set for `file.changed` events
- [ ] Script exits 0 always; no stdout output; HTTP errors swallowed

**Done:** Both hook script files exist. The PowerShell variant correctly handles PostToolUse (Bash,
Edit, Write) and Stop events, resolves the session ID via cwd walk-up, and fires a silent
fire-and-forget POST. The Bash variant provides cross-platform parity.

---

### Task 2: Extend `setup.ts` with Andon hook management

**Files:** `src/core/setup.ts`

**Action:**

Read `src/core/setup.ts` to understand `installClaudeCodeHooks()`, `getSetupStatus()`, and how
the existing `auto-checkpoint.ps1` hooks are registered. Then make three additions:

**Addition 1 — `installAndonHooks(rootDir: string, paths: RuntimePaths): void`**

Modeled on `installClaudeCodeHooks()`. Reads `.claude/settings.json`, adds or updates hook entries
for `PostToolUse` and `Stop` that point to the absolute path of `andon-hook.ps1` (Windows) or
`andon-hook.sh` (Linux/macOS). The command format must match the existing pattern in settings.json:

```
powershell -NoProfile -ExecutionPolicy RemoteSigned -File "<absolute_path_to_andon-hook.ps1>"
```

Use `process.platform === 'win32'` to select `.ps1` vs `.sh`. If a hook entry for `andon-hook`
already exists in that event type's array, do not add a duplicate — check by presence of
`'andon-hook'` in the command string. Write the updated settings.json back to disk.

**Addition 2 — `refreshAndonHooks(rootDir: string, paths: RuntimePaths): void`**

Calls `installAndonHooks()`. Used at daemon startup to keep hooks current when the script path
changes (e.g., after a repo move). Wire this into the daemon startup sequence wherever
`installClaudeCodeHooks` is called, or alongside it.

**Addition 3 — Update `getSetupStatus()` Andon hook detection**

In the `claudeHooks` section of the status object returned by `getSetupStatus()`, add a field:

```typescript
andonHooksInstalled: boolean
```

This field is `true` if at least one `PostToolUse` hook command string contains `'andon-hook'` in
the parsed `.claude/settings.json`. Read the settings.json from `<rootDir>/.claude/settings.json`
(same location `installClaudeCodeHooks` uses). If the file is missing or malformed, return `false`.

Without this field, `holistic repair` will not know to re-install Andon hooks when they are missing.

**Verification checklist:**
- [ ] `installAndonHooks()` is exported from `setup.ts`
- [ ] `refreshAndonHooks()` is exported from `setup.ts`
- [ ] `getSetupStatus()` return type includes `andonHooksInstalled: boolean`
- [ ] Running `installAndonHooks()` against a test settings.json adds PostToolUse and Stop entries
- [ ] Running `installAndonHooks()` twice does not duplicate the entries
- [ ] `getSetupStatus()` returns `andonHooksInstalled: true` when the hook is present
- [ ] `getSetupStatus()` returns `andonHooksInstalled: false` when the hook is absent

**Done:** `setup.ts` exports `installAndonHooks()` and `refreshAndonHooks()`. `getSetupStatus()`
includes `andonHooksInstalled`. Running `holistic repair` will detect missing Andon hooks and
re-install them.

---

## Verification

```
node --experimental-strip-types -e "
import { installAndonHooks, refreshAndonHooks } from './src/core/setup.ts';
console.log(typeof installAndonHooks, typeof refreshAndonHooks);
"
```

Both should print `function function`.

```
Test-Path .holistic/system/andon-hook.ps1
Test-Path .holistic/system/andon-hook.sh
```

Both should return `True`.

## Success Criteria

- Hook scripts exist at `.holistic/system/andon-hook.ps1` and `.holistic/system/andon-hook.sh`
- Hook scripts walk up from `hookData.cwd` (not `$PWD`) to resolve the session ID
- `installAndonHooks()` idempotently registers PostToolUse and Stop hooks in `.claude/settings.json`
- `getSetupStatus()` reports `andonHooksInstalled` correctly
- All scripts exit 0 and are silent on failure
