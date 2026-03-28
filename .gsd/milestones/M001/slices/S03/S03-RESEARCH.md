# M001/S03 — Research

**Date:** 2026-03-27

## Summary

S03 owns **R008** and **R009**. The codebase already has one central session-storage subsystem in `src/core/state.ts`, but it does **not** implement a true active-vs-archived split yet. All completed/superseded sessions are written directly into `.holistic/sessions/`, and the misleadingly named `readArchivedSessions()` simply reads that flat directory. There is no `.holistic/sessions/archive/` directory, no 30-day hygiene pass, and no reactivation path when an older session becomes relevant again.

The slice is moderately scoped but architecturally straightforward: keep the current JSON `SessionRecord` format, add filesystem-level separation between active and archived session files, and centralize archive/unarchive behavior in `src/core/state.ts`. The main ambiguity is requirement wording for **"searched"** in R009: the current product has `diff` but no session search command. That means the planner should either explicitly narrow S03 to the existing surfaces (`diff`, handoff references, derived docs/history readers) or add a small search surface as part of the slice.

## Recommendation

Implement S03 as a **storage-layer refactor in `src/core/state.ts` plus thin call-site wiring**.

Specifically:
1. Add an explicit archive directory under `.holistic/sessions/archive/` in runtime paths.
2. Replace the current single-directory session readers/writers with helpers that distinguish:
   - active stored sessions (`.holistic/sessions/*.json`)
   - archived sessions (`.holistic/sessions/archive/*.json`)
   - merged readers for docs/history/diff.
3. Add one hygiene function that archives sessions older than 30 days **only when they are not referenced by recent work**.
4. Add one reactivation helper that moves a session back to active storage when it is used by `diff` or explicitly referenced during handoff creation.

This approach keeps the existing session schema and most CLI/MCP behavior intact, limits churn to a few well-defined seams, and gives the planner a clean test story: filesystem moves, daemon-triggered hygiene, and automatic reactivation.

## Implementation Landscape

### Key Files

- `src/core/state.ts` — primary seam for S03. It defines `RuntimePaths`, `ensureDirs()`, `loadState()`, `readArchivedSessions()`, `loadSessionById()`, `startNewSession()`, `continueFromLatest()`, `applyHandoff()`, and `writeArchivedSession()`. Almost all archive/unarchive logic should live here.
- `src/core/types.ts` — `RuntimePaths` currently exposes only `sessionsDir`; S03 likely needs an `archiveSessionsDir` (or similarly named) path so callers stop hand-rolling archive paths.
- `src/daemon.ts` — `runDaemonTick()` already runs once at startup and then on an interval. This is the natural place for the periodic hygiene pass required by R008.
- `src/cli.ts` — `handleDiff()` calls `loadSessionById()` for both ends of a diff, making it the cleanest existing surface for R009's “diffed session reactivates” behavior.
- `src/mcp-server.ts` — only relevant if the planner wants archive hygiene to happen on MCP auto-resume/session start through the same state-layer entrypoint used by CLI resume.
- `src/core/docs.ts` — renders history/regression/current-context docs from `readArchivedSessions()`. If sessions split into active + archive directories, these renderers must switch to a merged reader or project history will silently lose archived content.
- `tests/run-tests.ts` — existing test harness already covers diff, daemon tick, elapsed-time thresholds, and archived-session loading. S03 should extend this file with filesystem-level archive/unarchive tests rather than add a new framework.
- `package.json` — confirms verification commands: `npm test` and `npm run build`. Also confirms the repository constraint that tests run source-mode via `node --experimental-strip-types`.

### Natural Seams

1. **Path and filesystem seam**
   - `getRuntimePaths()` / `RuntimePaths`
   - `ensureDirs()`
   - new helpers for active/archive file paths

2. **Storage/query seam**
   - current `readArchivedSessions()` should likely become:
     - `readActiveStoredSessions()`
     - `readArchivedSessions()`
     - `readAllStoredSessions()` (or equivalent merged reader)
   - `loadSessionById()` becomes the best place to optionally reactivate archived sessions when the caller wants “use implies active again”.

3. **Hygiene seam**
   - one pure-ish helper in `src/core/state.ts` that:
     - finds archive candidates
     - computes whether they are referenced by recent work
     - moves them into `.holistic/sessions/archive/`
     - returns whether state/docs need persistence.
   - `src/daemon.ts` should call this helper each tick, ideally early in `runDaemonTick()` while the state lock is already held.

4. **Reactivation seam**
   - `diff`: via `loadSessionById()` or a dedicated `loadSessionByIdAndReactivate()` helper.
   - `handoff references`: likely normalize `input.references` / `input.relatedSessions` in `applyHandoff()` or just before it, and reactivate any exact session-id matches.

### Build Order

1. **Prove the storage split first**
   - Add archive path support and explicit readers/writers for active vs archived sessions.
   - This unblocks every downstream step and is the most likely place for accidental regressions because current docs/history readers assume a single flat directory.

2. **Implement pure archive-candidate logic next**
   - Build the 30-day + unreferenced filter in `src/core/state.ts` before wiring it into daemon/session-start flows.
   - This is the policy core for R008 and the easiest logic to test in isolation with synthetic timestamps.

3. **Wire hygiene into runtime entrypoints**
   - Add periodic daemon execution in `src/daemon.ts`.
   - Add session-start execution through the resume/start path used by CLI/MCP.
   - Prefer one shared helper over duplicating archiving logic across CLI, MCP, and daemon.

4. **Add reactivation behavior last**
   - Wire `diff` first because that surface already exists and has tests.
   - Then wire handoff-reference reactivation once exact reference-matching rules are defined.

### Verification Approach

Run verification **sequentially**, not in parallel with build, because the repo’s source-mode tests can race with `npm run build` import rewrites.

Recommended sequence:

1. Focused tests while implementing:
   - `npm test -- --grep "archive|unarchive|diff helpers|daemon tick"`

2. Full regression pass after the slice is complete:
   - `npm test`

3. Build after tests complete:
   - `npm run build`

Observable behaviors to verify:
- a completed/superseded session older than 30 days and unreferenced moves from `.holistic/sessions/` to `.holistic/sessions/archive/`
- a recently referenced old session does **not** archive
- daemon startup/tick performs the hygiene pass without breaking checkpoint behavior
- `holistic diff --from <archived-id> --to <other-id>` succeeds and the archived session moves back to active storage
- handoff reference reactivation works for whatever exact reference form the implementation supports
- derived docs/history still include archived sessions after the directory split

## Constraints

- `SessionRecord` JSON is already the durable format. S03 should not invent a new schema unless the planner decides reference tracking cannot be derived from existing fields.
- `src/core/docs.ts` currently treats `readArchivedSessions()` as the source for durable project history. If S03 changes storage layout without a merged reader, history/regression docs will become incomplete.
- `runDaemonTick()` already holds the state lock and already runs at startup plus interval; duplicating separate hygiene scheduling would add avoidable complexity.
- The codebase currently has **no session search command**. R009’s “searched” behavior is not directly implementable without either scoping clarification or a new surface.

## Common Pitfalls

- **Flat-directory assumptions hidden behind misleading names** — `readArchivedSessions()` sounds archive-aware but currently reads the root `.holistic/sessions/` directory only. Rename or split helpers clearly so later code does not keep assuming “archived” means “all sessions.”
- **Reactivation in read paths causing silent writes** — if `loadSessionById()` starts moving files, callers must be ready for stateful behavior under a lock. Keep a pure read helper for docs and a mutating reactivation helper for user actions like `diff`.
- **Reference matching too fuzzy** — `references` are free-form strings. Reactivating on substring matches will cause archive thrash. Only exact, explicit session-id references (or another narrowly defined marker) are safe.
- **Docs dropping archived history** — every history/regression renderer currently assumes one reader. If the executor updates diff loading but misses docs, archived sessions will disappear from derived continuity docs.

## Open Risks

- R009 is partly underspecified because “searched” has no existing command surface.
- “Unreferenced in recent work” is also underspecified: the current schema has `references`, `relatedSessions`, `pendingWork.carriedFromSession`, and `lastHandoff.sessionId`, but no explicit `lastReferencedAt`. The executor may need to define a conservative rule such as exact session-id references within active session, pending work, last handoff, and recent stored sessions.
- If the planner decides reactivation should happen inside `loadSessionById()`, it will need to refactor the current pure API shape so callers can persist the mutation safely.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| TypeScript | `wshobson/agents@typescript-advanced-types` | available via `npx skills add wshobson/agents@typescript-advanced-types` |
| Node.js | `wshobson/agents@nodejs-backend-patterns` | available via `npx skills add wshobson/agents@nodejs-backend-patterns` |

## Sources

- Current session storage and loading behavior confirmed from `src/core/state.ts` (`getRuntimePaths`, `ensureDirs`, `readArchivedSessions`, `loadSessionById`, `writeArchivedSession`, `startNewSession`, `applyHandoff`).
- Daemon startup/periodic execution path confirmed from `src/daemon.ts` (`runDaemonTick`, startup tick before interval loop).
- Existing diff integration and session lookup seam confirmed from `src/cli.ts` (`handleDiff`).
- Existing regression coverage and test harness style confirmed from `tests/run-tests.ts` and `package.json`.
