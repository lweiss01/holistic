# M010 — Master execution plan (Builds A–E)

**Milestone:** [M010-ROADMAP.md](./M010-ROADMAP.md)  
**Design source:** [docs/andon-design-tokens.md](../../../docs/andon-design-tokens.md) §7 + Andon system design PDF  
**Checkpoint:** Holistic checkpoint recorded after M010 scaffolding (session-2026-04-18T20-39-45-509Z).

---

## 1. Objective

Deliver **spec-shaped supervision UX** in bounded slices: attention density (A), wallboard/queue (B), replay summary (C), Holistic/drift depth (D), **documented API surface** for external Command Center (E), and **live task identity / dashboard honesty** (F) — without blocking on M006–M009 engine roadmap.

## 2. Non-goals (this milestone)

- Full **Intervention Inbox** product (deferred to **M008** / broader attention routing).
- **CLI `holistic andon watch`** and bidirectional orchestration (**M006**).
- Semantic / Level-2 drift models (**M009**); S04 only **aligns labels and surfacing** with spec §11 where data already exists.

## 3. Preconditions

- M005: API + dashboard run locally; migrate/seed; active session, detail, timeline routes work.
- Baseline UX already landed: lamp by status, route context, sticky focus rail, reduced-motion, tabular numerals ([dashboard](../../../apps/andon-dashboard/src/)).

## 4. Execution waves

Work **slice-by-slice**; each slice ends with checklist completion in `Sxx-PLAN.md` plus **`Sxx-SUMMARY.md`** (proof: tests + short manual notes or screenshots).

| Wave | Slices | Rationale |
|------|--------|-----------|
| **W1** | **S01** (Build A) | Establishes **shared fields** (severity, last meaningful signal time) on active session if missing; improves live monitor + Focus rail. Downstream slices reuse the same JSON shape where applicable. |
| **W2** | **S02** (Build B) | Needs stable **list payload** and sort keys; may reuse severity/urgency from core — natural after S01 clarifies status/evidence story. |
| **W3** | **S03** (Build C) | Timeline **summary** may need a small API addition; UI depends on W1/W2 only for consistency, not blocking. Can start T01 (endpoint design) in parallel late W2 if capacity allows. |
| **W4** | **S04** (Build D) | Detail inspector enrichment; benefits from S01 discipline on “what counts as a signal.” |
| **W5** | **S05** (Build E) | Mostly **documentation**; start **anytime** (e.g. draft `docs/andon-api-contract.md` in W1) to decouple from UI cycles. Must finish before milestone close. |
| **W6** | **S06** (Build F) | **Trust + identity** — small additive API fields and dashboard chrome so operators never confuse Holistic grounding with runtime task lines; pairs with [`.planning/CANON-LAYERS.md`](../../../.planning/CANON-LAYERS.md). Can run in parallel with S02–S04 once S01 types exist. |

**Parallelism:** S05 documentation can proceed alongside W1–W2. S03 T01 (API) can overlap W2 tail if S02 list work is unblocked. **S06** can start after **S01** (shared JSON discipline) and overlap **S02–S04** if capacity allows.

## 5. Slice entry / exit (verification loop)

For each **Sxx**:

1. **Enter** — Read `Sxx-PLAN.md`; confirm scope fits non-goals above.
2. **Build** — Complete tasks in order unless a task documents safe reordering.
3. **Verify (tests are mandatory)**
   - **Create or extend automated tests** for each slice (new unit tests in `packages/andon-core` or `tests/andon.test.ts`, and API assertions where behavior crosses the HTTP boundary). No slice closes on manual-only proof.
   - **Run:** `npm test` before merge (or `npm run test:andon` only when the slice touches exclusively Andon paths and full suite is impractical in one step — prefer full `npm test` at milestone end).
   - `npm run andon:build` when dashboard changes.
   - Manual smoke: `npm run andon:api` + `npm run andon:dashboard`, hit routes in [docs/andon-mvp.md](../../../docs/andon-mvp.md).
4. **Exit** — Check all `[ ]` → `[x]` in slice PLAN; write **`Sxx-SUMMARY.md`**: what shipped, URLs/paths, known follow-ups for M006/M008.

## 6. Acceptance mapping (spec ↔ slices)

| Spec intent | Slice |
|-------------|--------|
| §6.1 Every state: legible **why** + **what next** + time/attention cues | **S01**, **S04** |
| Mockup B wallboard / queue | **S02** |
| Mockup D replay / “while away” | **S03** |
| Mockup C live signals + drift | **S04** |
| External Command Center consumption | **S05** |
| Runtime vs context clarity (no “Holistic as harness” UX) | **S06** |

## 7. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| API shape churn breaks dashboard | Extend types in `packages/andon-core` first; keep fields **additive**; document in S05. |
| “Meaningful event” definition ambiguous | Define whitelist/blacklist of event types in **andon-core** with a single helper used by API + tests. |
| Timeline summary N+1 queries | Prefer one aggregated query or bounded scan with documented limits in S03. |
| S04 scope creep into M009 | Cap S04 to **surfacing** + label alignment; no new ML/semantic engine. |

## 8. Milestone done when

- [ ] S01–S06 **PLAN** task checklists completed (or explicitly deferred with reason in SUMMARY).
- [ ] Each slice has **`Sxx-SUMMARY.md`**.
- [ ] `docs/andon-design-tokens.md` §7 still points at M010 (update if slice scope shifts).
- [ ] **S05** delivers **[`docs/andon-api-contract.md`](../../../docs/andon-api-contract.md)** (or agreed equivalent section in `andon-mvp.md`).

## 9. Slice plans (detail)

- [S01 — Build A](./slices/S01/S01-PLAN.md)
- [S02 — Build B](./slices/S02/S02-PLAN.md)
- [S03 — Build C](./slices/S03/S03-PLAN.md)
- [S04 — Build D](./slices/S04/S04-PLAN.md)
- [S05 — Build E](./slices/S05/S05-PLAN.md)
- [S06 — Build F](./slices/S06/S06-PLAN.md)

---

## 10. Next action (for implementer)

**S01 is complete.** Start **W2 / S02-T01** (session list sort keys + API contract). Run **S06** in parallel if dashboard trust / task identity is blocking dogfooding (see `S06-PLAN.md`).
