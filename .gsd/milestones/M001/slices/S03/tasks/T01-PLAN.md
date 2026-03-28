---
estimated_steps: 4
estimated_files: 4
skills_used:
  - test
  - debug-like-expert
---

# T01: Split active vs archived session storage and preserve merged history reads

**Slice:** S03 — Automatic Memory Hygiene
**Milestone:** M001

## Description

Build the filesystem contract that the rest of S03 depends on. This task creates an explicit active-vs-archive storage split while preserving the existing `SessionRecord` JSON format and keeping derived docs complete after the refactor.

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

## Verification

- Add or update assertions in `tests/run-tests.ts` for archive-path placement and merged-history rendering.
- `npm test -- --grep "archived sessions|history"`

## Inputs

- `src/core/types.ts` — current runtime path shape that lacks an explicit archive directory.
- `src/core/state.ts` — existing flat session reader/writer behavior.
- `src/core/docs.ts` — derived doc renderers that currently assume one stored-session source.
- `tests/run-tests.ts` — existing regression harness for diff/history behavior.

## Expected Output

- `src/core/types.ts` — runtime path contract updated with explicit archive storage.
- `src/core/state.ts` — explicit active/archive/all-session helpers replacing flat-directory assumptions.
- `src/core/docs.ts` — merged readers used by derived history/regression rendering.
- `tests/run-tests.ts` — assertions proving archive placement and merged-history visibility.
