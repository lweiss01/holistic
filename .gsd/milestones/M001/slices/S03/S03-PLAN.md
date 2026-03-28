# S03: Automatic Memory Hygiene

**Goal:** Introduce automatic session-memory hygiene so stale, unreferenced sessions move into `.holistic/sessions/archive/` without losing project history, and explicit reuse brings them back to active storage automatically.
**Demo:** After this: sessions >30 days old AND unreferenced move to `.holistic/sessions/archive/` automatically; archived sessions move back to active when used in diff, handoff, or exact-id session search; archive checks run on session start and periodically in the daemon.

## Must-Haves

- Sessions stored under `.holistic/sessions/` split cleanly into active files and archived files under `.holistic/sessions/archive/` while keeping the current `SessionRecord` JSON shape.
- A merged reader keeps derived history/regression docs complete after the directory split.
- Hygiene archives only sessions older than 30 days that are not referenced by active work, pending work, last handoff, or recent stored sessions.
- Session start/resume paths and daemon ticks both run the same hygiene helper instead of duplicating archiving logic.
- Archived sessions reactivate automatically when explicitly used by `holistic diff`, exact session-id references in handoff input, or `holistic search --id <session-id>`.

## Threat Surface

- **Abuse**: Broad substring matching could move unrelated archived sessions back to active storage or churn files repeatedly; reactivation should therefore use exact session-id matches for handoff/search surfaces.
- **Data exposure**: No new external data leaves the repo, but archived session history remains durable project memory and must not disappear from derived docs after the directory split.
- **Input trust**: CLI flags and handoff reference arrays are untrusted inputs that can trigger filesystem reads/moves; all path resolution must stay under Holistic runtime directories.

## Requirement Impact

- **Requirements touched**: R008, R009.
- **Re-verify**: Derived history/regression docs, daemon auto-checkpoint behavior, `holistic diff`, handoff application, and the new exact-id `holistic search` flow all need regression coverage after shipping.
- **Decisions revisited**: D008.

## Proof Level

- This slice proves: operational
- Real runtime required: yes
- Human/UAT required: no

## Verification

- `npm test` passes with new assertions added in `tests/run-tests.ts` covering archive placement, merged history reads, stale-vs-referenced hygiene, daemon/session-start hygiene hooks, diff reactivation, handoff reactivation, and exact-id search reactivation.
- `npm run build` passes after the new archive/search helpers are wired into runtime entrypoints.

## Observability / Diagnostics

- Runtime signals: session file moves between `.holistic/sessions/` and `.holistic/sessions/archive/`, plus passive-capture timestamps used to prove when hygiene ran.
- Inspection surfaces: filesystem state under `.holistic/sessions/**`, `holistic diff`, `holistic search --id`, and derived docs generated from `src/core/docs.ts`.
- Failure visibility: missing session files, sessions that fail to move on hygiene/reactivation, or history docs that omit archived sessions should be directly visible in tests and runtime file layout.
- Redaction constraints: session JSON stays repo-local; do not broaden what is rendered beyond current session-history content.

## Integration Closure

- Upstream surfaces consumed: `src/core/state.ts`, `src/core/docs.ts`, `src/daemon.ts`, `src/cli.ts`, `tests/run-tests.ts`.
- New wiring introduced in this slice: session storage split, shared hygiene pass invoked from session-start and daemon entrypoints, and explicit reactivation wiring for diff/handoff/search surfaces.
- What remains before the milestone is truly usable end-to-end: nothing for S03 once the runtime paths, daemon flow, and CLI surfaces above are verified together.

## Tasks

- [ ] **T01: Split active vs archived session storage and preserve merged history reads** `est:1.5h`
  - Why: The slice cannot archive or reactivate safely until the filesystem contract is explicit and derived docs stop assuming one flat sessions directory.
  - Files: `src/core/types.ts`, `src/core/state.ts`, `src/core/docs.ts`, `tests/run-tests.ts`
  - Do: Add an explicit archive runtime path, replace the misleading flat-directory reader with explicit active/archive/all-session helpers while keeping `SessionRecord` unchanged, and update derived docs to read the merged history so archived sessions stay visible.
  - Verify: `npm test -- --grep "archived sessions|history"`
  - Done when: archived session fixtures are written under `.holistic/sessions/archive/`, corrupt-session tolerance still works, and derived history/regression docs still include archived sessions.

- [ ] **T02: Archive stale unreferenced sessions during session start and daemon ticks** `est:2h`
  - Why: R008 is only satisfied when the 30-day archive policy runs automatically at the real runtime entrypoints, not just through a helper.
  - Files: `src/core/state.ts`, `src/daemon.ts`, `tests/run-tests.ts`
  - Do: Implement one shared hygiene helper that archives sessions older than 30 days only when they are not referenced by active work, pending work, last handoff, or recent stored sessions, then invoke it from session-start/resume and daemon-tick flows.
  - Verify: `npm test -- --grep "30 days|daemon tick"`
  - Done when: stale sessions archive automatically, referenced sessions stay active, and daemon passive-checkpoint behavior still passes regression coverage.

- [ ] **T03: Reactivate archived sessions on diff, exact handoff references, and exact-id search** `est:2h`
  - Why: R009 requires relevance-based reactivation, and this task closes the user-facing reuse loop instead of leaving archived sessions stranded.
  - Files: `src/core/state.ts`, `src/cli.ts`, `tests/run-tests.ts`
  - Do: Add a shared reactivation helper, wire it into `holistic diff`, exact session-id handoff references, and a minimal `holistic search --id` command, and keep matching exact so reuse is predictable.
  - Verify: `npm test -- --grep "diff|handoff|search"`
  - Done when: explicit reuse moves the targeted archived session back under active storage, unrelated sessions remain archived, and missing-session errors stay clear.

## Files Likely Touched

- `src/core/types.ts`
- `src/core/state.ts`
- `src/core/docs.ts`
- `src/daemon.ts`
- `src/cli.ts`
- `tests/run-tests.ts`
