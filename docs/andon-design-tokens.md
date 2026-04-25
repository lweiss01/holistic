# Andon dashboard — design tokens and UI plan

This document aligns the **Andon dashboard** implementation with the **Andon for Agents — Detailed Design Specification** (system design PDF: supervision layer, Holistic grounding, status model, and dashboard mockups A–F).

**Stack (spec §4, §8.1)**  
Repos / worktrees → **Holistic** (work memory, continuity, checkpoints, intent) → **Agents** (runtimes) → **Andon** (live supervision, status, intervention routing) → **Command Center** (broader operating surface).

**Agent runtime (Layers 1–2)** — Reference harness: **[OpenHarness](https://github.com/HKUDS/OpenHarness)**. Use it (or a compatible adapter) so task changes, summaries, and tool/file events reach Andon in near real time; the dashboard headline and `last_summary` stay trustworthy when this path is live.

**Holistic = context layer (spec §4.2, §8.1 “Layer 3”)**  
Holistic owns durable grounding: task intent, prior attempts, constraints, accepted/rejected approaches, phase/checkpoint history, repo/worktree association, handoffs. It answers: *What is this work, what matters, and what happened before?* The spec’s design principle **“Holistic is the anchor”** (§5) means supervision is most valuable when **live Andon signals are read against this context** (drift, scope, repeat rejected approaches)—not when Holistic replaces runtime adapters for every low-level agent tick.

**Andon = control tower (spec §4.3, Layers 4–6)**  
Andon owns live event ingestion, health/state, risk/drift signals, recommendations, and the dashboard. It answers: *What is happening right now, is it healthy, and do I need to act?*

**UI contract**  
Surface **both**: (1) **live** task/session fields and telemetry from Andon’s store, and (2) a **clearly labeled Holistic grounding** block (objective, scope, constraints on detail; mission line on monitor when the bridge is available). Do not conflate the two layers in copy or layout.

---

## 1. Semantic color tokens (status = Andon stack light)

Status colors are **not decorative**; they map the **state machine** in the spec (§6.1, §12, §25.8):

| Semantic token (CSS) | Spec state | Role |
|----------------------|------------|------|
| `--status-running` / bar / bg | Green / Running | Progressing normally |
| `--status-queued` | Blue / Queued | Waiting for assignment or dependency |
| `--status-needs-input` | Yellow / Needs Input | Question, approval, ambiguity |
| `--status-at-risk` | Orange / At Risk | Retries, scope spread, churn |
| `--status-blocked` | Red / Blocked | Cannot proceed without intervention |
| `--status-awaiting-review` | Purple / Awaiting Review | Done / paused for human verification |
| `--status-parked` | Gray / Parked | Intentionally idle |

Implementation: dashboard [`styles.css`](../apps/andon-dashboard/src/styles.css) exposes these as `--s-*` pairs (`--s-green`, `--s-green-bar`, `--s-green-bg`, …). **Do not** reuse status hues for non-status UI (spec: avoid training users to ignore signals).

---

## 2. Human chrome vs signal (attention routing)

| Token | Purpose |
|-------|---------|
| `--human-accent` | Navigation affordances, theme control, non-alarm focus rings — **separate** from status green/red. |
| `--human-accent-border` | Subtle nav hover border tint derived from human accent (light/dark). |
| `--fg-primary`, `--fg-secondary`, `--fg-muted` | Reading comfort; spec **human attention is scarce**. |
| `--bg-base`, `--bg-surface`, `--bg-raised` | Quiet surfaces so status and timeline stay focal. |

---

## 3. Typography tokens

| Token | Use |
|-------|-----|
| `--font-body` (Onest) | UI chrome, titles, prose — spec **legibility**; avoid Inter/Space Grotesk as primary (explicit product choice in CSS header). |
| `--font-mono` (JetBrains Mono) | Event types, timestamps, machine-parsed labels — **observable signals first**. |
| `.tabular-nums` | Times, counts, table columns — stable columns (tabular lining). |
| `--text-*` scale | Maintain clear hierarchy: eyebrow → title → body → meta. |

Optional later: `text-wrap: balance` on short panel titles.

---

## 4. Motion tokens

| Rule | Rationale |
|------|-----------|
| `--transition` (~130ms) | Small UI feedback; keep under **300ms** for user-initiated feel. |
| Theme / surface cross-fade **disabled** when `prefers-reduced-motion: reduce` | Respect accessibility; spec **alert rarely but meaningfully** includes not overwhelming motion. |

---

## 5. Layout tokens (mockups A–D)

| Pattern | Spec reference | Implementation direction |
|---------|----------------|---------------------------|
| **Active session board** | Mockup A §15.1 | Main column: task, repo, phase, **status + why + Focus now + last events + suggested action**. |
| **Wallboard / history** | Mockup B §15.2 | Table + future “attention queue” — Phase 3. |
| **Detail inspector** | Mockup C §15.3 | Holistic grounding, live signals, drift flags, recommendations. |
| **Session replay** | Mockup D §15.4 | Timeline with status transitions — paginated API + load older. |
| **Sticky “Focus now”** | §6.3 attention routing | Aside rail **sticky** so the shortest intervention path stays visible while scanning timeline. |
| **Header lamp** | Physical Andon metaphor | **Lamp color follows supervision status** when a session assessment is loaded; neutral when none. |

---

## 6. Screen → spec checklist (MVP)

| Screen | Spec §25.11 | MVP status |
|--------|-------------|------------|
| Live monitor | Screen 1 — Active Session Board | Implemented (`ActiveSessionPage`) |
| Timeline / replay | Screen 2 | Implemented (`TimelinePage`) + pagination |
| Detail inspector | Screen 3 | Implemented (`DetailPage`) |
| Wallboard | Multi-agent | Partial (`HistoryPage` list) |
| Intervention inbox / cross-repo | Mockups E–F | Deferred |

---

## 7. Phased next steps (engineering + design)

Aligned with spec **§25.13–25.14** and **Layer 6** (§8.2). **GSD tracking:** milestone **[M010](../.gsd/milestones/M010/M010-ROADMAP.md)** maps Builds A–F to slices `S01`–`S06` with implementation plans under `.gsd/milestones/M010/slices/`. **Planning index:** [`.planning/README.md`](../.planning/README.md).

**Done (recent passes)**  
Design tokens in CSS; dual theme; status strip + panel accent; timeline pagination; SSE refresh; Holistic bridge file mode; `tabular-nums` / reduced-motion / sticky focus rail / header lamp tied to status (see dashboard PRs).

**Build A — Attention density** ([S01-PLAN](../.gsd/milestones/M010/slices/S01/S01-PLAN.md))  
- Surface **severity** and **last meaningful event time** beside status (spec §6.1 every state).  
- “Focus now” copy already from API — tighten visual hierarchy (one primary CTA).

**Build B — Wallboard + queue (Phase 3 wedge)** ([S02-PLAN](../.gsd/milestones/M010/slices/S02/S02-PLAN.md))  
- Sort sessions by urgency; optional **Top attention queue** strip (Mockup B).  
- Repo-level rollups (Mockup E) after multi-session is stable.

**Build C — Replay summary** ([S03-PLAN](../.gsd/milestones/M010/slices/S03/S03-PLAN.md))  
- Compact “what happened while away” summary block above timeline (Mockup D).  
- Status transition markers in timeline (chips or inline).

**Build D — Holistic + drift (Phase 2)** ([S04-PLAN](../.gsd/milestones/M010/slices/S04/S04-PLAN.md))  
- Stronger **Live signals** row: files changed count, retry hints from events (spec Mockup C).  
- Drift flags already partially there — align labels with spec §11 (scope / intent / strategy / context).

**Build E — Command Center handoff** ([S05-PLAN](../.gsd/milestones/M010/slices/S05/S05-PLAN.md))  
- External **Command Center** surfaces remain out of this repo; keep API shapes stable for future embedding.

**Build F — Live task identity & dashboard honesty** ([S06-PLAN](../.gsd/milestones/M010/slices/S06/S06-PLAN.md))  
- Surface **task / correlation identifiers** in API + UI when present.  
- Audit **headline / Why / Holistic** copy so runtime signals and context grounding are never conflated (see stack notes at top of this doc and [`.planning/CANON-LAYERS.md`](../.planning/CANON-LAYERS.md)).

---

## 8. Reference

- Authoritative narrative: **Andon-system-design-spec** PDF (version in user design package).  
- Runbook: [andon-mvp.md](./andon-mvp.md).  
- Code: [`apps/andon-dashboard/src/`](../apps/andon-dashboard/src/).
