# Planning reconciliation — 2026-04-18

This document ties **what the repo already says in code/docs** to **session agreements** and lists **deliberate gaps** closed by new or updated GSD artifacts.

## Session agreements (must not regress)

1. **Holistic = context layer (Layer 3)** — durable grounding, not a substitute for full runtime harness telemetry.
2. **OpenHarness = reference for Layers 1–2** — primary integration direction for trustworthy live task titles, summaries, and tool/file events; see `docs/andon-mvp.md` and `docs/andon-design-tokens.md`.
3. **Andon dashboard** must show **runtime vs Holistic** distinctly (labeled grounding block; headline/why driven by substantive agent/Andon evidence).
4. **M010** tracks design-spec Builds A–F in slices (including **S06** dashboard honesty); larger “blocked on IDE approval but UI says running” is tracked under **M006 S05** (requires L1–2 events, not Holistic-only).

## Repository reality check

| Area | Built today | Gap vs design goals |
|------|-------------|---------------------|
| Supervision density | M010 **S01** complete: `supervision` fields, dashboard severity + last signal, focus rail | None for Build A baseline |
| Wallboard / queue | History list exists; urgency sort / attention strip | M010 **S02** |
| Replay summary | Timeline + pagination | M010 **S03** (“while away”, transition markers) |
| Inspector depth | Detail + Holistic bridge | M010 **S04** (live signals aggregates, spec §11 drift labels) |
| External integration | Partial in `andon-mvp` | M010 **S05** (`docs/andon-api-contract.md`, versioning) |
| Live task identity / trustworthy copy | Partial (`activeTask`, `last_summary`, evidence line tweaks) | **M010 S06 (new)** — task IDs visible, copy audit, tests |
| OpenHarness validation | Adapter exists | **M005 S03** — real payload tests / documented mapping gaps |
| Milestone wording | M006 S01 still reads like greenfield SSE | **M006** note: SSE landed in M005; M006 S01 = completion/hardening |
| IDE / harness **approval blocked** vs dashboard “healthy running” | No pending-approval event path + rules | **M006 S05** ([`S05-PLAN.md`](../.gsd/milestones/M006/slices/S05/S05-PLAN.md)); event volume/shape may lean on **M007** |
| `.planning` | Did not exist | **This folder** + `CANON-LAYERS.md` |

## `.holistic` vs `.planning`

- **`.holistic/`** (when generated) is **runtime/helpers** and is **gitignored** in this repo except for contributor policy in `AGENTS.md` / `HOLISTIC.md`. It is not the long-term store for milestone text.
- **`.planning/`** is **committed** product/architecture index and reconciliation — use it when agents or humans ask for “planning docs” outside `.gsd` execution detail.

## Action taken in this pass

- Added [`.planning/README.md`](./README.md), [`CANON-LAYERS.md`](./CANON-LAYERS.md), this file.
- Extended **M010** with **S06 — Build F** (live identity & dashboard honesty): `.gsd/milestones/M010/slices/S06/S06-PLAN.md`; updated `M010-ROADMAP.md`, `M010-PLAN.md`, `docs/andon-design-tokens.md` §7.
- Marked **M005 S01** complete in `M005-ROADMAP.md` (matches `M005/slices/S01/S01-SUMMARY.md`); added architecture planning note + OpenHarness pointer.
- Tightened **M006**, **M007**, **M009** roadmaps so Holistic/OpenHarness boundaries stay explicit.
- Updated **`.gsd/PROJECT.md`** M010 line to reference Builds A–F.
- Added **M006 S05** (approval gate visibility): `.gsd/milestones/M006/slices/S05/S05-PLAN.md`; updated `M006-ROADMAP.md` sequence + exit criteria; updated **`.gsd/PROJECT.md`** M006 line.

## Next implementer order

1. **M010 S02-T01** (list sort contract) — see `M010-PLAN.md` §10.
2. **M010 S06** in parallel if UX trust issues block dogfooding.
3. **M005 S03** when a stable OpenHarness capture fixture is available.
4. **M006 S05** once there is a concrete event source for "approval pending" (may trail **M007**; note the split in `S05-SUMMARY.md` when closing the slice).
