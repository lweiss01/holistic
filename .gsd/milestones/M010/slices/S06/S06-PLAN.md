# S06 — Build F: Live task identity & dashboard honesty

**Goal:** Supervisors can trust that the **live monitor** reflects **what the agent is doing now** and **why** the status engine chose the current state — without mistaking Holistic grounding for runtime harness fields. Surfaces stable **task / correlation identifiers** when the API has them (session design + ops/debug).

## Motivation (gap vs prior builds)

Builds A–E cover density, wallboard, replay, inspector depth, and API contracts. Session feedback identified an additional spec-adjacent requirement: **headline / Why / Holistic block** must stay **semantically separated**, and **task IDs** (or equivalent correlation keys) should be **visible** so multiple sessions and tooling stay unambiguous.

## Tasks

- [ ] **T01: API — stable identifiers** — Ensure `ActiveSessionResponse` and `SessionDetailResponse` expose at least one of: open task id, external task key, session id (already present), and/or `activeTask.id` consistently typed in `packages/andon-core`. Document fields in `docs/andon-mvp.md` (table row).
  - Files: `packages/andon-core/src/types.ts`, `services/andon-api/src/repository.ts`

- [ ] **T02: Dashboard — identity chrome** — On live monitor + detail header, show a compact **Task / ID** line (mono, `tabular-nums`) when non-empty; do not replace headline — append or secondary row.
  - Files: `apps/andon-dashboard/src/App.tsx`, `apps/andon-dashboard/src/styles.css`

- [ ] **T03: Copy & evidence audit** — Verify **headline** prefers `activeTask.title` then session objective; **Why** uses status-engine evidence (substantive events); **Holistic** block remains explicitly labeled per `docs/andon-design-tokens.md` UI contract. Remove or reword any remaining scaffold strings that imply Holistic is the harness.
  - Files: `apps/andon-dashboard/src/App.tsx`, `packages/andon-core/src/status-engine.ts` (only if evidence selection still wrong), `docs/andon-mvp.md`

- [ ] **T04: Tests** — Assertions on JSON shape for identifiers + one UI-relevant pure function test if any selection logic moves to core; `npm test` green.

## Success criteria

- Operators can answer “which task is this?” from the dashboard without opening SQLite.
- No screen implies Holistic fields are a substitute for OpenHarness/runtime task lines.

## Proof level

**Automated:** T04. **Manual:** one seeded session + one session with `activeTask` populated (fixture or local harness).
