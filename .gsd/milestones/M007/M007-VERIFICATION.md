---
phase: M007-andon-event-forwarding
verified: 2026-05-30T18:00:00Z
status: human_needed
score: 13/13 must-haves verified
human_verification:
  - test: "Open the Andon dashboard at http://127.0.0.1:4318 (or configured port). Navigate to an active session detail page. Trigger a few tool calls in Claude Code (e.g., read a file, run a bash command). Observe the Live timeline section."
    expected: "New events appear in the timeline within approximately 2 seconds of tool execution, without refreshing the page. The event types (command.finished, file.changed, etc.) and summaries should match the tool that was run."
    why_human: "Requires a live running Andon API, active Holistic session, and Claude Code session with hooks installed to observe real-time SSE delivery end-to-end."
  - test: "Run a failing command in Claude Code (e.g., a bash command that exits non-zero). Check the timeline in the session detail page."
    expected: "A 'Command failed' event row appears with a red left-border indicator (tone-critical CSS class)."
    why_human: "Visual CSS rendering and live hook delivery cannot be verified programmatically."
  - test: "Run a failing test command matching a test runner pattern (npm test, jest, vitest). Check the timeline."
    expected: "A 'Test failed' row appears with tone-critical styling (red border), distinct from a generic command.failed row."
    why_human: "Test detection heuristic (command pattern + exit code) must be confirmed against real Claude Code hook payloads, as field names (exit_code vs exitCode) are version-dependent."
  - test: "Verify that hook execution does not noticeably delay Claude Code tool calls. Run several file reads and bash commands in quick succession."
    expected: "Claude Code response latency is not meaningfully affected by hook execution. No errors or stderr output from hooks appear in Claude's response."
    why_human: "Latency impact requires subjective human assessment during a real session."
---

# M007: Andon Event Forwarding — Verification Report

**Phase Goal:** Connect real-time Claude Code activity to the Andon dashboard via hook scripts so tool calls appear as live events on the timeline within 2 seconds, without affecting Claude's response or breaking any existing functionality.

**Verified:** 2026-05-30T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `installAndonHooks()` exists in setup.ts and writes PostToolUse/Stop to .claude/settings.json | VERIFIED | setup.ts:1086 — exported function, writes both PostToolUse and Stop hook entries |
| 2 | `writeAndonHookScripts()` is called from `writeSystemArtifacts()` | VERIFIED | setup.ts:705 — `writeAndonHookScripts(paths)` called at end of writeSystemArtifacts |
| 3 | `getSetupStatus()` returns `andonHooksInstalled: boolean` on the andon-hooks component | VERIFIED | setup.ts:1858-1892 — component "andon-hooks" pushed with `andonHooksInstalled` boolean field |
| 4 | `repairHolistic()` calls `installAndonHooks()` when .claude dir present | VERIFIED | setup.ts:1639-1642 — guarded by `fs.existsSync(path.join(rootDir, ".claude"))` |
| 5 | `bootstrapHolistic()` calls `installAndonHooks()` when .claude dir present | VERIFIED | setup.ts:1733-1741 — guarded by `claudeCodePresent && options.installClaudeHooks !== false` |
| 6 | Hook scripts always exit 0 | VERIFIED | PS1 renderer: every early-exit path uses `exit 0`; final line is `exit 0`. SH renderer: same pattern with `exit 0` throughout. The `try/catch` on the HTTP POST swallows all errors. |
| 7 | Hook script reads `$hookData.cwd` NOT `$PWD` for repo root detection | VERIFIED | setup.ts:860 — `$dir = $hookData.cwd`; comment at line 857-859 explicitly warns never to use `$PWD` |
| 8 | WAL pragma applied before migrations in db.ts | VERIFIED | db.ts:21 — `database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")` at line 21, before schema readFileSync at line 23 |
| 9 | `001_initial.sql` has WAL documentation comment | VERIFIED | sql/001_initial.sql:1-2 — documentation comment explaining db.ts is authoritative; PRAGMA statements present |
| 10 | `scripts/smoke-timeline.mjs` exists and handles empty-DB case | VERIFIED | File exists; lines 27-31 handle missing DB (process.exit(0)); lines 39-44 handle no-sessions case; lines 53-57 handle no-events case |
| 11 | `apps/andon-dashboard/src/App.tsx` uses `tail: 200` in timeline fetch | VERIFIED | App.tsx:531 — `getTimeline(sessionId, { tail: 200 })` |
| 12 | `TimelinePanel` renders events newest-first; `command.failed`/`test.failed` use `tone-critical` | VERIFIED | App.tsx:90-96 — `eventTone()` returns "critical" when `type.includes("failed")`; items reversed before setState (App.tsx:532); CSS classes `.timeline-row.tone-critical` in styles.css:933 |
| 13 | No new `useTimeline` hook added; SSE refresh via existing `useLiveStream(loadData)` | VERIFIED | App.tsx:548 — `useLiveStream(loadData)` in DetailPage; no `useTimeline` identifier exists anywhere in App.tsx |

**Score:** 13/13 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/setup.ts` | installAndonHooks, writeAndonHookScripts, getSetupStatus extension | VERIFIED | All three present; SetupComponentStatus type union extended with "andon-hooks" and andonHooksInstalled field |
| `services/andon-api/src/db.ts` | WAL pragma at connection-open time before migrations | VERIFIED | WAL applied at line 21, schema applied at line 23 |
| `services/andon-api/sql/001_initial.sql` | WAL documentation comment | VERIFIED | Comment at line 1 explains authoritative placement in db.ts |
| `scripts/smoke-timeline.mjs` | Smoke test script with empty-DB handling | VERIFIED | All three empty cases (no DB file, no sessions, no events) handled with process.exit(0) |
| `apps/andon-dashboard/src/App.tsx` | TimelinePanel, eventTone, tail:200, useLiveStream wiring | VERIFIED | All present; DetailPage uses useLiveStream(loadData) at line 548 |
| `apps/andon-dashboard/src/api.ts` | getTimeline function, TimelineResponse interface | VERIFIED | Added at lines 190-209 |
| `apps/andon-dashboard/src/styles.css` | .timeline-list, .timeline-row, tone-critical/warning/memory/test CSS | VERIFIED | All classes present at lines 912-970 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `writeSystemArtifacts()` | `writeAndonHookScripts()` | direct call | WIRED | setup.ts:705 |
| `repairHolistic()` | `installAndonHooks()` | conditional on .claude dir | WIRED | setup.ts:1639-1642 |
| `bootstrapHolistic()` | `installAndonHooks()` | conditional on claudeCodePresent | WIRED | setup.ts:1733-1741 |
| `DetailPage` | `getTimeline()` | inside loadData Promise.all | WIRED | App.tsx:531 |
| `DetailPage` | `TimelinePanel` | rendered at line 601 | WIRED | App.tsx:601 — `<TimelinePanel events={timeline} />` |
| `DetailPage` | `useLiveStream(loadData)` | SSE-driven refresh | WIRED | App.tsx:548 |
| Hook PS1 script | `$hookData.cwd` | reads stdin JSON field | WIRED | setup.ts:860 |
| Hook PS1 script | `http://127.0.0.1:4318/events` | Invoke-RestMethod with 1s timeout | WIRED | setup.ts:938-941 |

---

## Anti-Patterns Found

No blockers or stubs detected. All implementations are substantive.

| File | Pattern Checked | Result |
|------|----------------|--------|
| `src/core/setup.ts` | TODO/FIXME, placeholder returns, empty handlers | Clean |
| `services/andon-api/src/db.ts` | Static returns, missing DB query | Clean |
| `scripts/smoke-timeline.mjs` | Placeholder output, missing empty-DB handling | Clean |
| `apps/andon-dashboard/src/App.tsx` | Stub components, ignored state | Clean |

---

## Human Verification Required

### 1. Live event delivery end-to-end

**Test:** Open the Andon dashboard. Navigate to an active session detail page (`/session/<id>`). In Claude Code, run a few tool calls (read a file, run a bash command). Watch the "Live timeline" section.

**Expected:** New events appear within approximately 2 seconds without a manual page refresh. Events show correct type labels (e.g., "Command finished", "File changed") and summaries.

**Why human:** Requires a running Andon API service, active Holistic session, and Claude Code with hooks installed. SSE delivery latency cannot be verified statically.

### 2. tone-critical styling for failed events

**Test:** Trigger a failing bash command in Claude Code (exit code non-zero). Check the timeline row.

**Expected:** The row has a red left-border (tone-critical). The badge reads "Command failed".

**Why human:** Visual CSS rendering requires a browser. The hook's Bash exit code detection uses `tool_response.exit_code ?? tool_response.exitCode` — the actual field name in Claude Code's payload must be confirmed against a live hook invocation.

### 3. Test runner detection

**Test:** Run `npm test` (or another test runner) with a failing test. Check the timeline.

**Expected:** A "Test failed" row appears (not a generic "Command failed" row), with tone-critical styling.

**Why human:** Test detection heuristic requires live hook data to verify the regex pattern fires correctly and that the exit code field is correctly read.

### 4. Hook latency impact

**Test:** Use Claude Code normally for several minutes with hooks active. Note any perceived slowdown in tool execution turnaround.

**Expected:** No noticeable latency added to Claude Code's tool call cycle. No stderr errors appear in Claude's responses.

**Why human:** PowerShell startup cost (~200-400ms on Windows) is a known latency concern from the research. Only measurable in a live session.

---

## Summary

All 13 automated must-haves are verified against the actual codebase. The implementation is complete and substantive — no stubs, no orphaned code, no missing wiring. The pipeline from Claude Code hook → PS1/SH script → Andon API → SQLite WAL → SSE broadcast → TimelinePanel is fully implemented.

The only outstanding items are live-environment behaviors (event delivery latency, visual rendering, hook payload field names in the real Claude Code runtime) that require human testing in an active session.

---

_Verified: 2026-05-30T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
