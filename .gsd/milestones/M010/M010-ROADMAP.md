# M010: Andon design spec — Builds A through E

This milestone tracks the **phased dashboard and API work** called out in [docs/andon-design-tokens.md](../../../docs/andon-design-tokens.md) §7 (aligned with the Andon system design PDF: attention density, wallboard, replay summary, Holistic/drift depth, Command Center handoff, and **live task identity / trustworthy copy**). It is **incremental UX and data surfacing** on top of the M005 MVP scaffold; larger engine work remains mapped in M006–M009.

**Architecture reminder:** Holistic is **Layer 3 context**; **[OpenHarness](https://github.com/HKUDS/OpenHarness)** (or a compatible adapter) is the **Layer 1–2 runtime** reference — see [`.planning/CANON-LAYERS.md`](../../../.planning/CANON-LAYERS.md).

**Master plan (waves, verification, risks):** [M010-PLAN.md](./M010-PLAN.md)

## Vision

Ship spec-shaped supervision UX so the dashboard reliably answers: *who/what, health, what changed, who needs me, why, what next* — without waiting for the full V2–V4 roadmap.

## Slice overview

| ID   | Build | Focus | Risk | Depends | Done |
|------|-------|-------|------|---------|------|
| S01  | **A** | Attention density — severity, last meaningful signal time, single primary CTA hierarchy | low | M005 S01+ | [x] |
| S02  | **B** | Wallboard + attention queue — sort/filter sessions, optional top strip | medium | S01 | [ ] |
| S03  | **C** | Replay summary — “while away” block, status transition markers in timeline | medium | M005 timeline API | [ ] |
| S04  | **D** | Holistic + drift — live signals (files/retry hints), drift labels vs spec §11 | medium | S01 | [ ] |
| S05  | **E** | Command Center handoff — stable API contracts, embed notes, no new CC UI in-repo | low | parallel | [ ] |
| S06  | **F** | Live task identity & dashboard honesty — visible task/session correlation ids; headline/Why/Holistic copy cannot be conflated | low | S01 | [ ] |

## Exit criteria (milestone)

- Each slice has a completed `Sxx-PLAN.md` task checklist and a short `Sxx-SUMMARY.md` with proof (screens or test notes).
- Builds A–D deliver visible dashboard improvements traceable to the design spec; Build E delivers documented API stability for external consumers; **Build F** closes the “trustworthy live identity + copy” gap called out in [`.planning/RECONCILIATION-2026-04-18.md`](../../../.planning/RECONCILIATION-2026-04-18.md).

## References

- [docs/andon-design-tokens.md](../../../docs/andon-design-tokens.md)
- [docs/andon-mvp.md](../../../docs/andon-mvp.md)
- [`.planning/CANON-LAYERS.md`](../../../.planning/CANON-LAYERS.md)
- Dashboard: `apps/andon-dashboard/` — API: `services/andon-api/`
