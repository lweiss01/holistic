---
estimated_steps: 5
estimated_files: 3
skills_used:
  - test
  - debug-like-expert
---

# T03: Reactivate archived sessions on diff, exact handoff references, and exact-id search

**Slice:** S03 — Automatic Memory Hygiene
**Milestone:** M001

## Description

Close R009 by making explicit session reuse pull archived history back into active storage. This task adds one shared reactivation helper and uses it from the user-facing flows that make an archived session relevant again.

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

## Verification

- Add or update assertions in `tests/run-tests.ts` for diff, handoff, and exact-id search reactivation paths.
- `npm test -- --grep "diff|handoff|search"`

## Observability Impact

- Signals added/changed: archive-to-active file moves driven by diff, handoff, and search paths.
- How a future agent inspects this: run the targeted CLI commands and inspect `.holistic/sessions/` vs `.holistic/sessions/archive/` in tests.
- Failure state exposed: targeted sessions remain archived after explicit reuse, or unrelated sessions move unexpectedly.

## Inputs

- `src/core/state.ts` — session lookup and handoff application seams.
- `src/cli.ts` — diff flow, CLI help text, and new exact-id search command surface.
- `tests/run-tests.ts` — regression harness for diff and handoff behavior.

## Expected Output

- `src/core/state.ts` — shared reactivation helper used by explicit reuse flows.
- `src/cli.ts` — diff/search command paths wired to reactivate archived sessions by exact id.
- `tests/run-tests.ts` — assertions proving reactivation and non-reactivating negative cases.
