# M007: Andon V3 — Event Forwarding Research

**Researched:** 2026-04-24
**Domain:** Claude Code hooks → Andon API event pipeline
**Confidence:** HIGH (all findings verified against live source code and official docs)

---

## Summary

M007 S01 must wire Claude Code's PostToolUse/Stop/UserPromptSubmit hooks into the Andon API at port
4318. The full Andon API and event type system are already built and working; the only missing piece is
a hook script that (a) reads JSON from stdin, (b) resolves the Holistic session ID, and (c) POST-s a
correctly shaped `AgentEvent` to `/events`. The session identity problem is the hardest design question
because Claude Code's `session_id` is a Claude-internal UUID, not the Holistic session ID
(`session-2026-04-18T20-39-45-509Z`). The resolution strategy is to read `.holistic-local/state.json`
(or `.holistic/state.json`) at hook execution time — the file is always present and the active session
ID is at `state.activeSession.id`.

On Windows (the current dev environment) PowerShell is the right hook script language. Node.js
`--experimental-strip-types` works too, but PowerShell is already proven in `auto-checkpoint.ps1` and
`start-holistic.ps1`, avoids a startup cost question, and handles JSON natively with
`ConvertFrom-Json`/`ConvertTo-Json`. A Node.js script is a viable alternative for richer payload
parsing when the tool output is complex.

**Primary recommendation:** Add a single PowerShell hook script that handles PostToolUse and Stop hook
events, maps them to the right `EventType`, reads the Holistic session ID from state.json, and fires a
fire-and-forget HTTP POST to `http://127.0.0.1:4318/events`. Wire it into `.claude/settings.json` via
the existing `installClaudeCodeHooks` mechanism. The script must be silent on failure (the Andon API
may not be running).

---

## Question-by-Question Findings

### 1. Claude Code Hook Types and JSON Payloads

**Source:** Official docs at code.claude.com/docs/en/hooks (verified 2026-04-24). Confidence: HIGH.

Hook events are delivered as JSON on stdin to command-type hooks. Each event shares a common envelope
and then adds event-specific fields.

#### Common envelope (all hooks)

```json
{
  "session_id":       "string  — Claude-internal UUID (NOT the Holistic session ID)",
  "transcript_path":  "string  — path to conversation JSON on disk",
  "cwd":              "string  — working directory at hook fire time",
  "permission_mode":  "string  — default|plan|acceptEdits|auto|dontAsk|bypassPermissions",
  "hook_event_name":  "string  — PreToolUse|PostToolUse|Stop|UserPromptSubmit|SessionStart"
}
```

#### PostToolUse (most important for M007)

```json
{
  "session_id":     "string",
  "hook_event_name": "PostToolUse",
  "tool_name":      "string  — e.g. 'Bash', 'Edit', 'Write', 'Read'",
  "tool_input":     { "...tool arguments sent to Claude" },
  "tool_response":  { "...tool result — schema varies by tool_name" },
  "tool_use_id":    "string  — unique per invocation",
  "duration_ms":    "number  — execution time"
}
```

Key `tool_name` values and their payload shapes:
- **`Bash`**: `tool_input.command` (string), `tool_response.output` (string), `tool_response.exitCode` (number)
- **`Edit` / `Write`**: `tool_input.file_path`, `tool_input.new_content` (or `old_string`/`new_string`)
- **`Read`**: `tool_input.file_path`
- MCP tools use pattern `mcp__<server>__<tool>`

#### Stop

```json
{
  "session_id":     "string",
  "hook_event_name": "Stop",
  "stop_reason":    "string  — e.g. 'end_turn'"
}
```

#### UserPromptSubmit

```json
{
  "session_id":     "string",
  "hook_event_name": "UserPromptSubmit",
  "prompt":         "string  — the text the user submitted"
}
```

#### SessionStart

```json
{
  "session_id":     "string",
  "hook_event_name": "SessionStart",
  "source":         "startup|resume|clear|compact",
  "model":          "string  — e.g. 'claude-sonnet-4-6'"
}
```

#### Exit code semantics

| Exit code | Meaning |
|-----------|---------|
| 0 | Success; JSON stdout parsed if present |
| 1 | Non-blocking error; stderr shown to Claude |
| 2 | Blocking: prevents the action (PostToolUse exit 2 is still non-blocking — tool already ran) |

For M007 the hook must always exit 0 and never output JSON (no blocking, no decision injection).

#### Environment variable available in all hooks

`CLAUDE_PROJECT_DIR` — the project root (same as `cwd` in most cases). This is useful as a fallback
if we need to locate `.holistic-local`.

---

### 2. Andon API POST /events Endpoint

**Source:** Direct code reading of `services/andon-api/src/server.ts` and `repository.ts`. Confidence: HIGH.

The endpoint accepts three body shapes:
- `{ events: AgentEvent[] }` — preferred (what `emitAndonEvent` already sends)
- `AgentEvent[]` — bare array
- `AgentEvent` — single object

Returns `202 Accepted` with `{ inserted: number }`.

#### AgentEvent shape (from `packages/andon-core/src/types.ts`)

```typescript
interface AgentEvent {
  id: string;              // unique — use hook event + tool_use_id or timestamp+random
  sessionId: string;       // HOLISTIC session ID, NOT Claude's session_id
  runtime?: "codex" | "openharness" | "unknown" | null;
  taskId?: string | null;  // optional; omit for hook-sourced events
  type: EventType;         // see table below
  phase?: "plan" | "research" | "execute" | "test" | null;
  source: "agent" | "collector" | "system" | "user";
  timestamp: string;       // ISO 8601
  summary?: string | null; // one-line human-readable description
  payload: Record<string, unknown>;
}
```

The `ingestEvents` function in `repository.ts` calls `ensureSession` which auto-creates a session row
if `sessionId` does not exist yet. So the hook does NOT need the session to be pre-registered — it just
needs a consistent session ID.

#### Critical behavior of ensureSession

`ensureSession` upserts the sessions table on every event. If the session row doesn't exist, it creates
one using fields from the event's `payload` (e.g., `agentName`, `objective`, `runtime`). This means:

1. The first hook event creates a "bare" session row if `session.started` hasn't fired yet.
2. Subsequent Holistic lifecycle events (which include `agentName` and `objective`) will upsert the
   same row with richer data.
3. The hook script does NOT need to fire a `session.started` event first — it just needs the ID to
   match the one in state.json.

---

### 3. Event Types and Hook-to-EventType Mapping

**Source:** `packages/andon-core/src/types.ts` EVENT_TYPES enum. Confidence: HIGH.

Complete list of valid EventType values:
```
session.started, session.ended, session.idle_detected, session.checkpoint_created,
task.started, task.completed, phase.changed,
command.started, command.finished, command.failed,
file.changed, test.started, test.finished, test.failed,
agent.question_asked, agent.summary_emitted, agent.retry_pattern_detected,
agent.scope_expansion_detected, user.resumed
```

#### Recommended hook-to-EventType mappings

| Claude Hook | Condition | EventType | source |
|-------------|-----------|-----------|--------|
| PostToolUse | `tool_name === "Bash"` and exit code 0 | `command.finished` | `"collector"` |
| PostToolUse | `tool_name === "Bash"` and exit code != 0 | `command.failed` | `"collector"` |
| PostToolUse | `tool_name === "Edit"` or `"Write"` | `file.changed` | `"collector"` |
| PostToolUse | `tool_name === "Bash"` and command matches test pattern | `test.failed` or `test.finished` | `"collector"` |
| Stop | `stop_reason === "end_turn"` | `agent.summary_emitted` | `"collector"` |
| UserPromptSubmit | any | `user.resumed` | `"user"` |

**Test detection heuristic:** Check `tool_input.command` for patterns like `npm test`, `jest`,
`vitest`, `pytest`, `mocha`, then check `tool_response.exitCode` to determine pass/fail.

**Note on `command.started`:** PostToolUse fires AFTER the tool completes. There is no way to fire
`command.started` from a PostToolUse hook. PreToolUse can fire `command.started` but that adds hook
execution complexity. Recommendation: skip `command.started` for now; `command.finished` + timing
from `duration_ms` is sufficient for S01.

---

### 4. Session Identity Problem

**Source:** Code reading of `src/core/state.ts`, `.holistic-local/state.json`. Confidence: HIGH.

**The problem:** Claude Code provides `session_id` in hook JSON — this is a Claude-internal UUID like
`abc123...` with no relationship to Holistic session IDs like `session-2026-04-18T20-39-45-509Z`.

**The resolution:** Read the Holistic state file at hook time.

The state file location is deterministic:
```
<repo_root>/.holistic-local/state.json   (primary — .holistic-local is gitignored, machine-local)
<repo_root>/.holistic/state.json         (fallback — some setups use the tracked dir)
```

The active session ID is at `state.activeSession.id`. It is always present when a session is running.
Format: `session-<ISO8601-with-hyphens>`, e.g. `session-2026-04-18T20-39-45-509Z`.

**Failure case:** If `state.json` is missing or `activeSession` is null, the hook has no session to
attach to. In this case, emit with a synthetic fallback ID like
`claude-hook-<claude_session_id_prefix>` so the event isn't lost, OR silently skip.

**PowerShell read pattern:**
```powershell
$stateFile = Join-Path $cwd ".holistic-local\state.json"
if (-not (Test-Path $stateFile)) { $stateFile = Join-Path $cwd ".holistic\state.json" }
if (-not (Test-Path $stateFile)) { exit 0 }  # no Holistic state, skip
$state = Get-Content $stateFile -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
$sessionId = $state.activeSession.id
if (-not $sessionId) { exit 0 }  # no active session, skip
```

**Important:** The hook reads `cwd` from the hook JSON (stdin), not `$PWD`, because Claude Code may
change directories between hook calls. Use the JSON `cwd` field to locate the repo root.

---

### 5. Right Script Language for Hooks

**Source:** Code reading of existing hooks (`auto-checkpoint.ps1`, `start-holistic.ps1`), settings.json.
Confidence: HIGH.

The project is **Windows-first** (`platform: win32`). Both existing hooks are PowerShell. The
daemon startup script is PowerShell. The project writes both `.ps1` and `.sh` variants for
cross-platform support.

**Recommendation: PowerShell script for M007 hook** — consistent with existing infrastructure.
Reasoning:
- Already proven: `auto-checkpoint.ps1` runs in the UserPromptSubmit hook
- `ConvertFrom-Json` / `ConvertTo-Json` handle the JSON transformation natively
- `Invoke-RestMethod` or `Invoke-WebRequest` handle HTTP POST
- No extra runtime startup cost (Node.js adds ~200ms cold start per hook invocation)
- The hook fires on EVERY tool call — startup cost matters

**Node.js alternative** is viable if payload parsing logic grows complex (regex for test detection
etc.). A `.cjs` or `.ts` (with `--experimental-strip-types`) file would work — the project already
uses this pattern for the Holistic CLI.

**For cross-platform parity:** also write a `.sh` variant. The `installClaudeCodeHooks` mechanism in
`setup.ts` already selects the right script per platform.

**Idiomatic PowerShell hook skeleton:**
```powershell
# andon-hook.ps1 — fired on PostToolUse and Stop
param()
$ErrorActionPreference = 'SilentlyContinue'

# 1. Read JSON from stdin
$inputJson = $input | Out-String
if (-not $inputJson.Trim()) { exit 0 }
$hookData = $inputJson | ConvertFrom-Json

# 2. Resolve Holistic session ID
$cwd = $hookData.cwd
$stateFile = Join-Path $cwd ".holistic-local\state.json"
if (-not (Test-Path $stateFile)) { $stateFile = Join-Path $cwd ".holistic\state.json" }
if (-not (Test-Path $stateFile)) { exit 0 }
$state = Get-Content $stateFile -Raw | ConvertFrom-Json
$sessionId = $state.activeSession.id
if (-not $sessionId) { exit 0 }

# 3. Map hook event to AndonEvent
$eventType = $null
$summary = ""
$payload = @{}
$source = "collector"

$hookName = $hookData.hook_event_name
if ($hookName -eq "PostToolUse") {
    $toolName = $hookData.tool_name
    if ($toolName -eq "Bash") {
        $exitCode = $hookData.tool_response.exit_code
        $cmd = $hookData.tool_input.command
        $isTest = ($cmd -match "npm test|jest|vitest|pytest|mocha")
        if ($isTest) {
            $eventType = if ($exitCode -eq 0) { "test.finished" } else { "test.failed" }
            $summary = if ($exitCode -eq 0) { "Tests passed: $cmd" } else { "Tests failed: $cmd" }
        } else {
            $eventType = if ($exitCode -eq 0) { "command.finished" } else { "command.failed" }
            $summary = if ($exitCode -eq 0) { "Ran: $cmd" } else { "Failed: $cmd (exit $exitCode)" }
        }
        $payload = @{ command = $cmd; exitCode = $exitCode; durationMs = $hookData.duration_ms }
    } elseif ($toolName -in @("Edit", "Write")) {
        $eventType = "file.changed"
        $filePath = $hookData.tool_input.file_path
        $summary = "Edited: $filePath"
        $payload = @{ path = $filePath; tool = $toolName }
    }
} elseif ($hookName -eq "Stop") {
    $eventType = "agent.summary_emitted"
    $summary = "Agent turn completed"
    $source = "collector"
    $payload = @{ stopReason = $hookData.stop_reason }
}

if (-not $eventType) { exit 0 }

# 4. Build and POST the event
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
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 1 | Out-Null
} catch { }

exit 0
```

**Critical design constraints:**
- Must exit 0 always (never block tool calls)
- Must be silent on failure (Andon API might not be running)
- Timeout must be very short (1 second max) — hook runs on EVERY tool call
- Must NOT output anything to stdout (would be parsed as JSON decision)

---

### 6. Events That Matter for Status Engine Correctness

**Source:** `packages/andon-core/src/status-engine.ts`. Confidence: HIGH.

The `deriveStatus` function in the status engine scans events and makes decisions based on these types:

| EventType | Status engine effect | Impact |
|-----------|----------------------|--------|
| `command.failed` | Adds to `failureEvents[]`; 2+ recent failures → `at_risk` | HIGH |
| `test.failed` | Same as command.failed; also contributes to `blocked` if followed by `session.idle_detected` | HIGH |
| `file.changed` | Checked against `holisticContext.expectedScope`; out-of-scope → `at_risk` | HIGH |
| `agent.scope_expansion_detected` | Direct → `at_risk` | MEDIUM |
| `agent.question_asked` | If `resolved !== true` → `needs_input` | MEDIUM |
| `session.idle_detected` | Combined with failure → `blocked` | MEDIUM |
| `task.started` / `task.completed` | Drives running vs. awaiting_review | MEDIUM |
| `agent.summary_emitted` | Latest "Why" line shown in dashboard | LOW |
| `session.checkpoint_created` | Used for "Latest Holistic checkpoint" secondary line only | LOW |

**Key insight:** The status engine's `AT_RISK_FAILURE_THRESHOLD` is 2 (`const AT_RISK_FAILURE_THRESHOLD = 2`). Two `command.failed` or `test.failed` events from the hook will flip the session to `at_risk` immediately. This is exactly the intended behavior for M007.

**For `file.changed` to trigger out-of-scope detection**, the event payload must include `path` as a
string (the engine does `String((event.payload as { path?: string }).path ?? "")`). Make sure the hook
populates `payload.path = <absolute_file_path>`.

**The `RECENT_ACTIVITY_WINDOW_MS` is 10 minutes.** A session with no events for 10 minutes is
classified as `parked`. Hook events keep the session alive in `running` state as long as tool calls
continue — this is the core "live data" benefit.

---

### 7. Batching and Rate-Limiting Concerns

**Source:** `services/andon-api/src/server.ts` (80ms debounce for SSE broadcast), `repository.ts`
(SQLite transaction per ingest call), `src/core/andon.ts` (fire-and-forget with 1s timeout).
Confidence: HIGH.

**Volume estimate:** Claude Code can fire PostToolUse hooks at 1–10 Hz during active work (reading
multiple files, writing, running commands). Holistic sessions can last hours.

**Current ingest path:** Each POST to `/events` opens a SQLite transaction. SQLite handles ~10,000
writes/second in WAL mode. For Andon's expected volume (< 10 events/second from hooks), this is not
a problem.

**SSE broadcast:** The server has an 80ms debounce (`scheduleStreamBroadcast`). Multiple rapid events
collapse into one SSE notification, so the dashboard doesn't get hammered.

**Recommendation for S01:** No batching needed. Fire one HTTP POST per hook invocation. Each request
has a 1-second timeout (matching `emitAndonEvent`). For S02, if volume causes SQLite contention, add
a write queue or WAL mode.

**One concern: hook startup cost on Windows.** PowerShell process spawning takes ~200-400ms. This is
added latency on every tool call. Options:
- Accept it (acceptable for development workflow monitoring)
- Use a pre-warmed Node.js approach with `--experimental-strip-types` (but Node.js also has ~200ms
  cold start)
- Use a persistent background process that hooks write to via a named pipe (complex, not worth it
  for S01)

**Verdict:** Accept the latency for S01. The hook fires AFTER the tool runs (PostToolUse), so it
doesn't delay the tool itself — it only delays the next Claude iteration slightly.

---

### 8. What emitAndonEvent() Already Handles vs. What's Missing

**Source:** `src/core/andon.ts`, `src/core/state.ts`. Confidence: HIGH.

#### What emitAndonEvent() already handles

| Trigger | EventType emitted | Call site |
|---------|-------------------|-----------|
| `startNewSession()` | `session.started` | state.ts:1235 |
| `startNewSession()` | `task.started` | state.ts:1246 |
| `checkpointState()` | `session.checkpoint_created` | state.ts:1159 |
| `checkpointState()` (with completion signal) | `agent.summary_emitted` | state.ts:1173 |
| `writeHandoff()` | `session.ended` | state.ts:1561 |

All five are **Holistic lifecycle events** (Layer 3). They fire from the CLI and daemon process, not
from Claude Code hooks.

#### What is missing (Layer 1-2, needed for M007)

These event types are defined in `EVENT_TYPES` but are NEVER emitted by any current code:
- `command.started` / `command.finished` / `command.failed`
- `file.changed`
- `test.started` / `test.finished` / `test.failed`
- `agent.retry_pattern_detected`
- `agent.scope_expansion_detected`
- `session.idle_detected`
- `user.resumed`

The hook script is the intended source for all of these. The only new infra needed is:
1. The hook script file (PostToolUse + Stop handler)
2. `.claude/settings.json` entry wiring the hook
3. A new helper in `setup.ts` (`installAndonHooks`) to manage the hook entries the same way
   `installClaudeCodeHooks` manages SessionStart and UserPromptSubmit

---

## Architecture Patterns

### Recommended Implementation Structure

```
.holistic/system/
├── auto-checkpoint.ps1          (exists)
├── auto-checkpoint.sh           (exists)
├── andon-hook.ps1               (NEW — handles PostToolUse, Stop)
└── andon-hook.sh                (NEW — cross-platform parity)

src/core/setup.ts
  installAndonHooks()            (NEW — adds PostToolUse + Stop entries to settings.json)
  refreshAndonHooks()            (NEW — keeps hooks current on daemon start)
```

### settings.json target shape

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "...holistic resume..." }] },
      { "hooks": [{ "type": "command", "command": "...start-holistic.ps1..." }] }
    ],
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "...auto-checkpoint.ps1..." }] }
    ],
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "powershell -NoProfile -ExecutionPolicy RemoteSigned -File \"D:\\...\\andon-hook.ps1\"" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "powershell -NoProfile -ExecutionPolicy RemoteSigned -File \"D:\\...\\andon-hook.ps1\"" }] }
    ]
  }
}
```

Note: `PostToolUse` and `Stop` can reuse the same script file — the script reads `hook_event_name`
from stdin to branch behavior.

### Data Flow

```
Claude Code tool call
  → PostToolUse fires
  → andon-hook.ps1 receives JSON on stdin
  → reads .holistic-local/state.json for sessionId
  → maps tool_name + response to EventType
  → POST { events: [AgentEvent] } → http://127.0.0.1:4318/events
  → ingestEvents() opens SQLite transaction
  → ensureSession() upserts session row
  → event inserted
  → scheduleStreamBroadcast() fires after 80ms debounce
  → SSE clients receive { type: "session_update" }
  → dashboard refetches GET /sessions/active
  → status engine re-derives status from new events
  → UI shows updated status
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| HTTP client in hook script | Custom socket code | `Invoke-RestMethod` (PowerShell) or `fetch` (Node.js) |
| JSON parsing in hook | String manipulation | `ConvertFrom-Json` / `JSON.parse` |
| SQLite batching | Custom queue | Accept single-event writes; SQLite handles the volume |
| Session identity | MCP tool call to look up session | Read state.json directly from filesystem |
| Hook registration | Manual settings.json edits | Extend `installClaudeCodeHooks` in setup.ts |

---

## Common Pitfalls

### Pitfall 1: Writing to stdout from the hook script
**What goes wrong:** Claude Code parses hook stdout as a JSON decision object. Any stdout output from
the hook script is interpreted as a hook response — even partial output can cause unexpected behavior.
**How to avoid:** Redirect all output to `Out-Null` or `/dev/null`. Never `Write-Host` or `echo`.

### Pitfall 2: Using $PWD instead of the cwd field from hook JSON
**What goes wrong:** The hook process inherits the shell's working directory, which may not be the repo
root. Claude Code changes directories frequently.
**How to avoid:** Parse `$hookData.cwd` from the stdin JSON to locate `.holistic-local/state.json`.

### Pitfall 3: Using Claude's session_id as the Andon sessionId
**What goes wrong:** The Claude session UUID has no relationship to the Holistic session ID in the
Andon database. Events posted with the wrong ID create orphan sessions or get attached to the wrong
session.
**How to avoid:** Always read sessionId from state.json, not from the hook payload's `session_id`.

### Pitfall 4: No timeout on the HTTP call
**What goes wrong:** If the Andon API is down or slow, the hook blocks tool execution indefinitely.
Claude Code waits for the hook to complete before proceeding.
**How to avoid:** Use `-TimeoutSec 1` on `Invoke-RestMethod`. Wrap in `try/catch` and swallow errors.

### Pitfall 5: test.failed detection based on command name only
**What goes wrong:** `npm test` can succeed; `npm install` can fail but is not a test failure. Checking
only the command string leads to false positives and negatives.
**How to avoid:** Check BOTH the command pattern (to identify test runners) AND the exit code. Only
emit `test.failed` when command matches a test pattern AND exit code != 0.

### Pitfall 6: Forgetting to match the path field for file.changed events
**What goes wrong:** The status engine reads `event.payload.path` to check scope expansion. If `path`
is missing or wrong, the `outOfScopeChange` detection never fires.
**How to avoid:** Always populate `payload.path` with the absolute file path for `file.changed` events.

### Pitfall 7: Hook not registered in .holistic-local settings.json
**What goes wrong:** `.claude/settings.json` is in the tracked `.claude/` directory. If Holistic uses
a `.holistic-local` overriding settings file, hooks go to the wrong place. Verify which settings.json
Claude Code is actually reading.
**How to avoid:** Check where Claude Code reads settings from (`~/.claude/settings.json` global, or
project `.claude/settings.json`). The existing `installClaudeCodeHooks` writes to
`<repoRoot>/.claude/settings.json` which is what Claude Code picks up for project-scoped hooks.

---

## Open Questions

1. **What does `tool_response` look like for Bash exit codes?**
   - The official docs say "schema varies by tool_name" but don't enumerate all fields.
   - The hook mastery repo and community examples suggest `tool_response.exit_code` (not `exitCode`).
   - **Recommendation:** Log the raw hook JSON in a dev session to observe the actual shape before
     hard-coding field names. The PowerShell script should handle both `exit_code` and `exitCode`
     via null-coalescing.

2. **Does Claude Code respect PostToolUse hooks in subagents (worktrees)?**
   - The project uses worktrees extensively. The `agent_id` and `agent_type` fields in the hook
     payload suggest subagent awareness, but it's unclear whether hooks registered in the root
     `.claude/settings.json` fire in subagent contexts.
   - **Recommendation:** Test manually and add a note in the script about this.

3. **How should the hook handle multi-repo worktrees?**
   - The `cwd` in the hook may be inside a worktree (`D:\Projects\active\holistic\.claude\worktrees\...`).
   - The state.json is at `<root>/.holistic-local/state.json` where `<root>` is the main repo.
   - **Recommendation:** The hook should walk up from `cwd` until it finds `.holistic-local/` or
     `.holistic/` rather than assuming a fixed depth.

4. **Should UserPromptSubmit emit `user.resumed`?**
   - `user.resumed` is currently only emitted by the callback endpoint when a human clicks "resume"
     in the dashboard.
   - Emitting it on every user prompt may over-fire this event type.
   - **Recommendation:** Use `user.resumed` for UserPromptSubmit. It keeps the session "alive" in the
     status engine (prevents `parked` classification) which is the desired behavior.

---

## Sources

### Primary (HIGH confidence)
- `packages/andon-core/src/types.ts` — EVENT_TYPES, AgentEvent interface, SessionStatus
- `packages/andon-core/src/status-engine.ts` — deriveStatus(), AT_RISK_FAILURE_THRESHOLD, RECENT_ACTIVITY_WINDOW_MS
- `services/andon-api/src/server.ts` — POST /events handler, SSE debounce logic
- `services/andon-api/src/repository.ts` — ingestEvents(), ensureSession()
- `src/core/andon.ts` — emitAndonEvent() implementation, 1s timeout pattern
- `src/core/state.ts` — createSession() ID format, existing emitAndonEvent call sites
- `src/core/setup.ts` — installClaudeCodeHooks(), auto-checkpoint pattern
- `.claude/settings.json` — current hook configuration
- `.holistic-local/state.json` — live session ID format (`session-<ISO8601-with-hyphens>`)
- `services/andon-api/sql/001_initial.sql` — schema (events table, indices)

### Secondary (MEDIUM confidence — official docs, verified 2026-04-24)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — hook types, JSON payloads, exit codes, environment variables

---

## Metadata

**Confidence breakdown:**
- Claude Code hook payloads: HIGH — verified against official docs
- Andon API shape and behavior: HIGH — read directly from source
- Session identity resolution: HIGH — confirmed from live state.json + createSession() source
- Hook script language choice: HIGH — consistent with existing project patterns
- Batching/performance: HIGH — SQLite limits + 80ms debounce confirmed in source
- tool_response field names for Bash exit code: MEDIUM — open question #1

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (Claude Code hook schema is stable; Andon API is internal)
