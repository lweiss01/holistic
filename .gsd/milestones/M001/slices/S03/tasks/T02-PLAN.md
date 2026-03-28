---
estimated_steps: 4
estimated_files: 3
skills_used:
  - test
  - debug-like-expert
---

# T02: Archive stale unreferenced sessions during session start and daemon ticks

**Slice:** S03 — Automatic Memory Hygiene
**Milestone:** M001

## Description

Implement the actual hygiene policy once the storage contract exists. This task owns the 30-day archive rule from R008 and wires it into the real runtime entrypoints so the behavior happens automatically instead of relying on manual maintenance.

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

## Verification

- Add or update assertions in `tests/run-tests.ts` for stale-vs-referenced sessions and daemon/startup execution.
- `npm test -- --grep "30 days|daemon tick"`

## Observability Impact

- Signals added/changed: deterministic archive-vs-keep-active state transitions during startup and daemon ticks.
- How a future agent inspects this: inspect `.holistic/sessions/**` layout plus the daemon-tick assertions in `tests/run-tests.ts`.
- Failure state exposed: stale sessions that fail to move, or referenced sessions that archive incorrectly, become visible as file-layout and assertion failures.

## Inputs

- `src/core/state.ts` — storage helpers and session-start/resume entrypoints.
- `src/daemon.ts` — periodic runtime tick that should trigger hygiene.
- `tests/run-tests.ts` — regression harness for daemon and passive-capture behavior.

## Expected Output

- `src/core/state.ts` — shared archive-candidate and hygiene execution helpers.
- `src/daemon.ts` — daemon tick wired to run hygiene before passive checkpoint decisions.
- `tests/run-tests.ts` — assertions proving automatic 30-day archiving and reference exemptions.
