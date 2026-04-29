# Andon dashboard - design tokens and UI plan

This document aligns the Andon dashboard implementation with the Andon design specification while reflecting the runtime-first fleet program now tracked in `.gsd`.

**Stack**
Repos and worktrees -> **Holistic** (work memory, continuity, checkpoints, intent) -> **Holistic runtime adapters** (live sessions, commands, files, tests, approvals) -> **Andon** (fleet supervision, ranking, intervention routing) -> **Command Center** (broader operating surface).

**Agent runtime (Layers 1-2)**
Holistic now owns the runtime protocol through `packages/runtime-core` and the future `runtime-service`.
The first shipped runtime is local.
External adapters such as Codex, Claude Code, OpenHarness, or custom harnesses adapt into that contract instead of defining the architecture themselves.

**Holistic = context layer**
Holistic owns durable grounding: task intent, prior attempts, constraints, accepted or rejected approaches, phase and checkpoint history, repo/worktree association, and handoffs.
It answers: what is this work, what matters, and what happened before?
The design principle "Holistic is the anchor" means supervision is most valuable when live runtime signals are read against this context, not when Holistic replaces runtime telemetry.

**Andon = control tower**
Andon owns live event ingestion, health and state, risk and drift signals, recommendations, and the dashboard.
It answers: what is happening right now, is it healthy, and do I need to act?

**UI contract**
Surface both:
1. Live runtime and fleet fields from Andon's store.
2. A clearly labeled Holistic grounding block.

Do not conflate runtime activity, status explanation, and Holistic memory in copy or layout.

---

## 1. Semantic color tokens

Status colors are not decorative; they map the supervision model:

| Semantic token (CSS) | Meaning | Role |
|----------------------|---------|------|
| `--status-running` | Running | Progressing normally |
| `--status-queued` | Queued | Waiting for assignment or dependency |
| `--status-needs-input` | Needs Input | Question, approval, ambiguity |
| `--status-at-risk` | At Risk | Retries, churn, scope spread |
| `--status-blocked` | Blocked | Cannot proceed without intervention |
| `--status-awaiting-review` | Awaiting Review | Done or paused for human verification |
| `--status-parked` | Parked | Intentionally idle |

Implementation: dashboard `styles.css` should keep status hues reserved for supervision semantics rather than general decoration.

---

## 2. Human chrome vs signal

| Token | Purpose |
|-------|---------|
| `--human-accent` | Navigation affordances, theme control, non-alarm focus rings |
| `--human-accent-border` | Subtle nav hover border tint derived from human accent |
| `--fg-primary`, `--fg-secondary`, `--fg-muted` | Reading comfort for information-dense screens |
| `--bg-base`, `--bg-surface`, `--bg-raised` | Quiet surfaces so status, queue, and timeline stay focal |

---

## 3. Typography tokens

| Token | Use |
|-------|-----|
| `--font-body` | UI chrome, titles, prose |
| `--font-mono` | Event types, timestamps, machine labels |
| `.tabular-nums` | Times, counts, table or card columns |
| `--text-*` scale | Eyebrow -> title -> body -> meta hierarchy |

---

## 4. Motion tokens

| Rule | Rationale |
|------|-----------|
| Short transitions for hover and reveal only | Feedback should feel crisp, not theatrical |
| Respect `prefers-reduced-motion` | Alerts should be meaningful without overwhelming motion |

---

## 5. Layout targets

| Pattern | Implementation direction |
|---------|--------------------------|
| **Mission Control homepage** | Fleet Header, Attention Queue, Agent Grid, Activity Heatmap, Recent Signals Rail |
| **Session detail** | Drill-down for why a session is in its current state, what changed, and what to do now |
| **Timeline / replay** | Chronological event review with recent signal emphasis |
| **History** | Ledger and archive view, no longer the primary fleet surface |

The root route `/` should become Mission Control.
The existing single-session board is useful baseline UI, but it should no longer be the first mental model.

---

## 6. Current baseline vs target

| Surface | Current baseline | Target direction |
|---------|------------------|------------------|
| `/` | Single active-session monitor | Fleet Mission Control |
| `/session/:id` | Useful detail board | Keep as drill-down |
| `/session/:id/timeline` | Useful replay view | Keep as drill-down |
| `/history` | Session wall / archive | Keep as supporting context |

Already-shipped attention-density work, SSE refresh, timeline pagination, and Holistic grounding remain useful groundwork for the fleet target.

---

## 7. Program sequence

The design program now follows the runtime-first milestone order below.
The planning source of truth is `.gsd`, with milestone details in the files linked here.

**M006 - Runtime Core and Persistence**
- Define `runtime-core` types, capabilities, normalized events, and storage tables.

**M007 - Runtime Service and Local Adapter**
- Add `runtime-service`, the local adapter, NDJSON events, lifecycle tracking, and heartbeats.

**M008 - Guardrails, Approvals, and Worktree Isolation**
- Add approval gating, process safety, worktree metadata, and overlap signals.

**M009 - Fleet Intelligence**
- Add activity derivation, attention ranking, failure and stall detection, approval visibility, and Holistic-vs-runtime drift reasoning.

**M010 - Mission Control UX**
- Add `GET /fleet`, Fleet Header, Attention Queue, Agent Grid, Activity Heatmap, Recent Signals Rail, and route migration for `/`.

---

## 8. Design constraints for M010

- Keep cards compact enough to show several agents at once.
- Put the Attention Queue near the top and make intervention status immediately obvious.
- Use color semantically, not decoratively.
- Keep runtime state and Holistic grounding visually distinct.
- Avoid oversized hero panels, novelty widgets, and decorative clutter.

---

## 9. Reference

- Runbook: [andon-mvp.md](./andon-mvp.md)
- Planning index: [`.planning/README.md`](../.planning/README.md)
- Milestones: [M006](../.gsd/milestones/M006/M006-ROADMAP.md), [M007](../.gsd/milestones/M007/M007-ROADMAP.md), [M008](../.gsd/milestones/M008/M008-ROADMAP.md), [M009](../.gsd/milestones/M009/M009-ROADMAP.md), [M010](../.gsd/milestones/M010/M010-ROADMAP.md)
- Code: [`apps/andon-dashboard/src/`](../apps/andon-dashboard/src/)
