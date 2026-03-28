# S03: Automatic Memory Hygiene — UAT

**Milestone:** M001
**Written:** 2026-03-28T18:52:15.576Z

# UAT — S03 Automatic Memory Hygiene

## Scenario 1: Stale unreferenced sessions archive automatically
1. Seed active sessions with records older than 30 days and no references.
2. Trigger session start/resume or daemon tick.
3. Confirm stale records move from `.holistic/sessions/` to `.holistic/sessions/archive/`.

**Expected:** Only qualifying stale unreferenced sessions archive; active/referenced sessions remain.

## Scenario 2: Referenced old sessions are preserved
1. Seed old sessions referenced by activeSession/lastHandoff/pendingWork/relatedSessions.
2. Trigger hygiene path.

**Expected:** Referenced sessions are not archived.

## Scenario 3: Explicit reuse reactivates archived session
1. Place target session in archive storage.
2. Use one explicit path: `diff --from/--to`, handoff `relatedSessions` with exact `session-*` id, or `search --id`.
3. Verify session file returns to active storage.

**Expected:** Exact targeted session reactivates; non-session free-form text does not trigger movement.

## Verification Commands
- `npm test -- --grep "archived sessions|history"` ✅
- `npm test -- --grep "30 day|daemon tick"` ✅
- `npm test -- --grep "diff|handoff|search|reactivat"` ✅
- `npm run build` ✅
- `npm test` ❌ (3 pre-existing non-S03 hook-management failures)

