# S03: Automatic Memory Hygiene

**Goal:** Introduce automatic session-memory hygiene so stale, unreferenced sessions move into `.holistic/sessions/archive/` without losing project history, and explicit reuse brings them back to active storage automatically.
**Demo:** After this: sessions >30 days old AND unreferenced move to .holistic/sessions/archive/ automatically; archived sessions move back to active when used in diff/handoff/reference; archive check runs on session start and periodically in daemon

## Tasks
- [x] **T01: Added explicit archive session storage and kept derived history/regression docs reading merged stored sessions.** — Build the filesystem contract that the rest of S03 depends on.

## Failure Modes

| Dependency | On error | On timeout | On malformed response |
|------------|----------|-----------|----------------------|
| Local filesystem under `.holistic/sessions/**` | Leave the current session state untouched, fail the write/read path deterministically, and keep tests exercising the error boundary. | Not applicable for local sync filesystem access. | Skip corrupt session JSON exactly as current readers do instead of crashing the entire tool. |
| Derived docs renderers in `src/core/docs.ts` | Keep history/regression generation reading a merged session list so storage refactors cannot silently hide prior work. | Not applicable. | Treat malformed archived entries as skipped records, not a fatal docs render error. |

## Load Profile

- **Shared resources**: `.holistic/sessions/` directory listings and per-session JSON files.
- **Per-operation cost**: O(number of stored session files) directory scans and JSON parses.
- **10x breakpoint**: Repeated full-directory reads become the first cost center, so helper boundaries should stay centralized and reusable.

## Negative Tests

- **Malformed inputs**: corrupt JSON file in active or archive storage is skipped without breaking the rest of the read.
- **Error paths**: empty archive directory and mixed active/archive session sets still render derived docs successfully.
- **Boundary conditions**: active-only history, archive-only history, and newest-first ordering across both directories.

## Steps

1. Add an explicit archive runtime path (for example `archiveSessionsDir`) and ensure Holistic creates it alongside the existing sessions directory.
2. Replace the misleading single-directory `readArchivedSessions()` behavior with explicit active/archive/all-session helpers while keeping the current `SessionRecord` shape unchanged.
3. Update history/regression/current-context doc renderers to consume the merged reader so archived sessions remain visible after the storage split.
4. Extend `tests/run-tests.ts` with assertions that archived sessions live under `.holistic/sessions/archive/` and still appear in derived docs/history output.

## Must-Haves

- [ ] `RuntimePaths` exposes the archive directory explicitly.
- [ ] Docs/history readers no longer assume every stored session lives directly in `.holistic/sessions/`.
- [ ] Existing corrupt-session tolerance is preserved across both directories.
  - Estimate: 1.5h
  - Files: src/core/types.ts, src/core/state.ts, src/core/docs.ts, tests/run-tests.ts
  - Verify: npm test -- --grep "archived sessions|history"
- [x] **T02: Implemented 30-day stale-session archiving during session start, resume, and daemon ticks with shared hygiene helper, reference-exemption logic, and boundary-condition tests** — Implement the actual hygiene policy once the storage contract exists.

## Failure Modes

| Dependency | On error | On timeout | On malformed response |
|------------|----------|-----------|----------------------|
| Session-history files discovered by the state layer | Abort that archive move, leave the session in active storage, and surface the failure through deterministic tests instead of partially moving files. | Not applicable for local sync filesystem access. | Ignore malformed records when computing candidates so one bad file cannot archive the wrong sessions. |
| `runDaemonTick()` shared lock + checkpoint flow | Run hygiene before normal passive-capture logic and preserve the current checkpoint behavior if no archive work is needed. | Daemon tick should return without repeated loops or extra checkpoints. | If candidate metadata is incomplete, treat the session as referenced and do not archive it. |

## Load Profile

- **Shared resources**: session directory listings, daemon state lock, and derived-reference scans across recent sessions.
- **Per-operation cost**: one archive-candidate scan per session start/tick, plus file move/write work for each archived session.
- **10x breakpoint**: repeated scans of very large session histories; candidate logic should stay conservative and single-pass.

## Negative Tests

- **Malformed inputs**: missing `endedAt`, invalid timestamps, or incomplete reference metadata should not archive the session.
- **Error paths**: daemon tick with no candidates leaves passive checkpoint behavior unchanged.
- **Boundary conditions**: exactly 30 days old, just under 30 days, referenced old sessions, and multiple stale candidates in one pass.

## Steps

1. Add a shared helper in `src/core/state.ts` that identifies archive candidates older than 30 days and excludes anything referenced by active session state, pending work, last handoff, or recent stored sessions.
2. Invoke that helper from session-start/resume entrypoints and from `runDaemonTick()` before passive checkpoint decisions, reusing one codepath instead of duplicating policy.
3. Preserve or expose enough runtime state for tests to prove when hygiene ran and which files moved.
4. Extend `tests/run-tests.ts` to cover stale-session archiving, reference exemptions, and daemon/session-start integration without regressing existing proactive-checkpoint tests.

## Must-Haves

- [ ] One shared hygiene helper owns the archive policy.
- [ ] Session start/resume and daemon tick both exercise the same policy path.
- [ ] Referenced old sessions remain active until they truly become stale and unused.
  - Estimate: 2h
  - Files: src/core/state.ts, src/daemon.ts, tests/run-tests.ts
  - Verify: npm test -- --grep "30 days|daemon tick"
- [x] **T03: Added session reactivation on diff, handoff references, and exact-id search so explicit reuse moves archived sessions back to active storage** — Close R009 by making explicit session reuse pull archived history back into active storage.

## Failure Modes

| Dependency | On error | On timeout | On malformed response |
|------------|----------|-----------|----------------------|
| CLI session-id inputs for diff/search | Fail the command with a clear missing-session error and leave unrelated archived files untouched. | Not applicable for local sync filesystem access. | Reject malformed or non-existent ids without broadening the match set. |
| Handoff reference arrays | Reactivate only exact session-id matches; leave free-form notes/readme references untouched. | Not applicable. | Treat malformed reference entries as inert text, not as archive-move triggers. |

## Load Profile

- **Shared resources**: archive directory lookups and single-session file moves.
- **Per-operation cost**: O(number of stored sessions) lookup unless an index helper is added; at most one move per explicitly used session id.
- **10x breakpoint**: repeated broad search would cause unnecessary directory scans, so this task should keep search exact-id scoped.

## Negative Tests

- **Malformed inputs**: empty `--id`, unknown ids, and free-form handoff references that merely mention similar text should not reactivate anything.
- **Error paths**: diff/search for a missing session still exits cleanly with an error.
- **Boundary conditions**: one archived diff endpoint, both archived diff endpoints, exact-id handoff references, and exact-id search reactivating only the targeted session.

## Steps

1. Add a mutating reactivation helper in `src/core/state.ts` that loads a session by id and moves it from archive storage back into active storage when the caller explicitly opts in.
2. Wire `holistic diff --from/--to` to use that helper so archived sessions become active again as soon as they are compared.
3. During `applyHandoff()`, detect exact session-id matches in `references` or `relatedSessions` and reactivate those sessions without using substring matching.
4. Add a minimal `holistic search --id "<session-id>" [--format text|json]` command that resolves an archived session by exact id and reactivates it, satisfying the searched-session requirement without fuzzy archive churn.
5. Extend `tests/run-tests.ts` to cover diff reactivation, handoff reactivation, exact-id search reactivation, and the non-reactivating negative cases.

## Must-Haves

- [ ] Reactivation is explicit and exact-match based outside the guaranteed `diff` flow.
- [ ] `holistic diff`, handoff application, and `holistic search --id` all reuse the same state-layer reactivation helper.
- [ ] Missing-session errors remain clear and do not mutate unrelated files.
  - Estimate: 2h
  - Files: src/core/state.ts, src/cli.ts, tests/run-tests.ts
  - Verify: npm test -- --grep "diff|handoff|search"
