---
title: "Spec: Decision Supersession, Automatic Capture, Andon Drift Seam, and Trust Provenance"
status: draft
audience: implementing agent
repo_state_basis: live main @ v0.6.5 (read 2026-05-28)
owner: lweiss01
---

# Spec: Decision Supersession, Automatic Capture, Andon Drift Seam, and Trust Provenance

## 0. How to read this document

This is a single spec covering four features that share one seam. It is written for an implementing agent and is **grounded in the live repo**, not a clean-room design. Skeletons for most of this already exist in the codebase. Your job is to close named gaps, not to build from scratch. Each section states what exists today, what the gap is, and what to build, with file-level targets.

Read the whole document before writing code. The features have a dependency order (Section 1 before Section 2; Section 3 depends on the bridge contract that Sections 1 and 2 touch). Do not reorder.

Ownership is fixed and non-negotiable in this spec:

| Concern | Owner | Rationale |
| --- | --- | --- |
| Decision records + supersession lifecycle | Holistic | Project state: what is true now vs. overturned. State, not trajectory. |
| Automatic capture and triggers | Holistic | How decisions/checkpoints get written without a human prompt. |
| Drift detection (is the agent still on-goal) | Andon | Trajectory over time. Reads Holistic context as input. |
| In-boundary trust + provenance | Holistic (mostly built) | A property of the written artifact. |
| Cross-operator trust (untrusted foreign agent) | Future / neither yet | Needs a verifiable-log substrate. Out of scope; named only. |

The Andon -> Holistic bridge is **read-only from Andon's side**. Andon never writes to Holistic state. This is load-bearing for the ownership split; do not violate it.

---

## 1. Decision records and supersession lifecycle (Holistic)

### 1.1 Problem

Holistic preserves session state but has no first-class concept of a *decision*. Decisions ("use the state branch for sync", "MCP server is read-only") currently live as free text inside `latestStatus`, checkpoint reasons, or `assumptions[]`. Because they are not named, they cannot be retired. Over time the continuity layer accumulates decisions that later turned out wrong, with no way to mark them dead without deleting them. This is the "confident lies" failure: a cold-booting agent reads an overturned decision as current truth.

Note the existing `SessionStatus = "superseded"` is **session-level** and out of scope here. Retiring a whole work session is not the same as retiring a decision. This spec adds **decision-level** supersession.

### 1.2 What exists today

- `src/core/types.ts`: `SessionRecord` carries free-text `assumptions[]`, `impactNotes[]`, `triedItems[]`, and structured `impactNotesStructured[]`. No decision type.
- `src/core/state.ts:1223`: sets a session `status: "superseded"` (session envelope, not decisions).
- `.beads/issues.jsonl`: an existing append-only JSONL artifact in the repo. Use it as the structural precedent.

### 1.3 What to build

#### 1.3.1 Storage: `.holistic/decisions.jsonl`

A new append-only, line-delimited JSON artifact at `.holistic/decisions.jsonl`. One JSON object per line. **Never edit or delete a line.** Supersession is a *new appended line* that points at an earlier decision id. Current truth is computed by folding the log left to right.

Rationale for append-only JSONL over a mutable array in `state.json`:

1. Merge safety. Decisions sync on the `holistic/state` branch. Appends from two machines auto-merge or conflict trivially. A mutable array inside `state.json` (which also holds `activeSession`, `pendingWork`, etc.) maximizes conflict surface on the most sync-critical artifact.
2. Cold-reader friendliness. One always-loaded file gives a zero-context agent the full decision history with status, instead of decisions scattered across session files.
3. Non-destructive by construction, which is the core requirement: nothing is ever deleted, so the rationale for a dead decision stays traceable.

#### 1.3.2 Schema: `DecisionRecord`

Add to `src/core/types.ts`. Follow the existing house style: additive, optional where it can be, version-gated.

```ts
export type DecisionStatus = "active" | "superseded";

// Extends the decision taxonomy. AreaTag (existing) describes code areas and is
// NOT a drop-in: it has no "convention" / "scope" / "tooling" members. Define a
// dedicated scope tag for decisions rather than overloading AreaTag.
export type DecisionScope =
  | "architecture"
  | "convention"
  | "scope"
  | "tooling"
  | "process"
  | "other";

export interface DecisionRecord {
  id: string;                    // "dec_001" — stable, monotonic, never reused
  status: DecisionStatus;        // folded value; on disk every line is the event,
                                 // status is the line's own claim at write time
  title: string;                 // one line, written for a zero-context reader
  rationale: string;             // why this was decided
  scope: DecisionScope;          // for filtering and for Andon to weight drift
  sessionId: string;             // provenance: the session that recorded it
  agent: AgentName;              // provenance: which agent authored it
  decidedAt: string;             // ISO 8601
  supersedes: string | null;     // id of the decision this overturns, or null
  confidence?: "high" | "low";   // source confidence; low = daemon-inferred
}
```

Provenance (`sessionId`, `agent`) is mandatory, not optional. A decision with no author is exactly the trust gap Section 4 addresses; do not allow anonymous decisions.

#### 1.3.3 Fold logic

Add a pure resolver, e.g. `resolveDecisions(lines: DecisionRecord[]): DecisionRecord[]` in a new `src/core/decisions.ts`:

- Read all lines in order.
- A line with `supersedes: "dec_X"` marks `dec_X` as `superseded` in the resolved view and is itself `active` (unless later superseded in turn).
- Current truth = the set of `active` decisions after the full fold.
- Resolve chains (dec_001 -> dec_007 -> dec_012): only the tail is active; all ancestors are superseded.
- Detect and surface cycles as a diagnostic rather than looping (reuse the Degraded Mode pattern from `state.ts`).

#### 1.3.3a Supersession semantics (read before implementing)

The hard part of this feature is not the mechanism of marking something deprecated. It is what "deprecated" *means*. Three rules are fixed here and must not be relaxed during implementation:

**Rule 1 — Readable in place, excluded by fold, never relocated.** A superseded decision stays physically in `.holistic/decisions.jsonl`, byte-for-byte unchanged, in its original position. It is removed from the *active set* only logically, by `resolveDecisions` excluding it from the fold result. It is never moved to an archive file, never deleted, never rewritten. This gives both properties at once: the audit trail is preserved in place (physical), and the active context the next agent reads stays clean (logical, via the fold). Presentation follows from this: `resume` and `HOLISTIC.md` show the active set inline and put superseded decisions behind a "history" affordance, but that is a *view* over one append-only file, not a second storage location.

**Rule 2 — Supersession is always an explicit author act, never inferred.** Nothing enters a decision's `supersedes` field except through an explicit `holistic supersede` invocation by an identified author (agent or human). Implicit supersession — a heuristic deciding that a newer decision "claims the same scope" as an older one and silently retiring it — is **prohibited**, because that is precisely where the confident-lies problem re-enters under concurrent multi-agent writes. The daemon and Andon may **flag a supersession candidate** ("dec_007 appears to overlap active dec_001; an author should decide"), but flagging is not superseding. A flag is a recommendation surfaced at `resume`; it writes nothing to `supersedes`. This is consistent with the read-only Andon bridge (Section 3): observers flag, only authors write. Note this constrains Section 2.3: a daemon-inferred *decision* is allowed (as a `confidence: "low"` candidate), but a daemon-inferred *supersession* is not.

**Rule 3 — A supersession must say why, and the why is about the old decision.** A superseding record carries both the link (`supersedes: "dec_001"`) and a mandatory `rationale`. The rationale on a superseding record must explain *why the prior decision no longer holds* ("state branch conflicts under concurrent multi-agent writes"), not merely restate the new decision. This is what turns supersession from a bare flag into reasoning the next agent can follow back through the chain. A supersession whose rationale only describes the new decision and not the reason for overturning the old one should be treated as incomplete.

#### 1.3.4 Command: `holistic supersede`

Add to the CLI (`src/cli.ts`). Mutating command, so it belongs in the "Guarded Mutation" tier per `SECURITY.md`.

```
holistic decide "<title>" --rationale "<why>" --scope architecture
holistic supersede dec_001 --with "<title>" --rationale "<why>" --scope architecture
```

- `decide` appends a new active decision.
- `supersede` appends a new decision whose `supersedes` points at the target, after validating the target exists and is currently active.
- Both auto-fill `sessionId` and `agent` from the active session context. Never prompt the human for provenance.

#### 1.3.5 Surfacing

- `holistic resume` and `HOLISTIC.md` must show the **active decision set** prominently, and make superseded decisions reachable but not noisy (list active inline; superseded behind a "history" affordance).
- The bridge (Section 3) exposes active decisions to Andon as read-only context.

### 1.4 Out of scope for this section (deferred, name only)

Lifecycle (deprecation/supersession) on `assumptions[]` and `impactNotes[]`. Same pattern, deferred. Do not build it now; leave a `// FUTURE:` note in `types.ts` next to those fields.

### 1.5 Acceptance criteria

1. `holistic decide` appends a valid line to `.holistic/decisions.jsonl`; no other file is mutated except state metadata pointers.
2. `holistic supersede` on an active decision produces a fold where the target is `superseded` and the new record is `active`; the target line is byte-for-byte unchanged on disk.
3. `holistic supersede` on a non-existent or already-superseded id is rejected with a clear error and writes nothing.
4. `resolveDecisions` resolves a 3-deep chain correctly and flags a cycle without hanging.
5. Two concurrent appends from different branches merge without losing either decision.
6. A zero-context agent reading `HOLISTIC.md` after `resume` can list current active decisions without running custom tooling.
7. (Rule 1) A superseded decision remains at its original byte offset in the file; no archive file is created; it is absent from `resolveDecisions` active output but present in full history.
8. (Rule 2) No code path other than an explicit `holistic supersede` writes a non-null `supersedes` value. A daemon- or Andon-originated overlap produces a candidate flag surfaced at `resume`, and `.holistic/decisions.jsonl` gains no superseding line until an author acts.
9. (Rule 3) `holistic supersede` requires a `--rationale`; a supersede attempt with empty or missing rationale is rejected and writes nothing.

---

## 2. Automatic capture and trigger model (Holistic)

### 2.1 Problem

Holistic's value proposition is that it is invisible until needed: the repo remembers without the human saying "checkpoint this" or "log this decision." Today, capture leans on proxies for work (idle time, file-churn ticks, commits) via the daemon. That captures *activity* but not *semantics*. A decision is a semantic act that is not observable from the filesystem, so without this section, decisions from Section 1 would still require a human prompt, defeating the point.

### 2.2 What exists today

- `src/daemon.ts` + `holistic watch`: activity-threshold passive checkpoints. `PassiveCaptureState` tracks `activityTicks`, `quietTicks`, `lastCheckpointAt`.
- `AutoHandoffDecision` (`types.ts`): reasons `idle-30min`, `work-milestone`, `completion-signal`. The concept of unprompted handoff exists.
- `CompletionSignalMetadata`: agents can emit `task-complete` / `milestone-complete`.
- Adapter docs (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`): the existing mechanism for instructing agents on protocol.

### 2.3 Design (settled)

Two capture layers with different mechanisms:

- **Layer 1 — activity capture.** Time/churn/commit-triggered. Mostly built (daemon). Hardening only; not the focus.
- **Layer 2 — semantic capture.** Detecting that a decision/assumption/regression-relevant act happened, without a human prompt. **Primary mechanism is agent self-report**, instructed by `HOLISTIC.md` and adapter docs, executed as a side effect of the agent's normal work loop. **Daemon-inferred heuristics are a backstop** for when the agent does not self-report.

The human speaks for neither layer. The agent handles semantics; the daemon handles activity.

### 2.4 Visibility: the escalation predicate

Capture is **silent by default**, surfaced at `resume`. A **lightweight confirm** is triggered only at high-consequence or ambiguous edges. "Occasional" is defined precisely by this predicate, computed at capture time:

```
confirm  =  supersedes_active            // overturning a recorded decision
         OR contradicts_rejected         // re-proposing a rejectedApproaches entry
         OR low_confidence_source        // daemon-inferred, confidence: "low"
silent   =  otherwise                    // fresh, non-conflicting, agent-authored
```

- `supersedes_active`: an **explicit** `holistic supersede` targets a currently-active decision. Overturning is where silent error compounds, so an author confirms before it lands. Per Rule 2 (Section 1.3.3a), supersession is *only ever* explicit; this predicate gates the confirm on an author-initiated supersede, it does not authorize an inferred one. The daemon/Andon may flag a supersession *candidate*, but a candidate is surfaced at `resume`, never auto-applied.
- `contradicts_rejected`: the candidate matches an entry in the active intent's `rejectedApproaches`. This is also a drift signal (see Section 3) and one of the inputs that escalates a silent write to a confirm.
- `low_confidence_source`: the daemon guessed a *decision* happened rather than the agent stating it. (The daemon may never guess a *supersession* — Rule 2.)

All three conditions are cheap and derivable from the decisions log plus existing schema. Confirms cluster at the dangerous edges and stay silent on the safe interior, which keeps Holistic invisible without letting wrong decisions land silently.

### 2.5 What to build

1. **Agent instruction (primary).** Extend `HOLISTIC.md` generation and the adapter docs so agents are instructed to record decisions inline as they work, via the MCP tool / substrate write, including `title`, `rationale`, `scope`. This is the main path to invisibility. Respect `safeMode`: under safe mode, emit minimal instructions and prefer documentation-first phrasing (consistent with existing `safeMode` behavior in `setup.ts`).
2. **Capture entry point.** A single internal function that all capture paths (agent MCP call, daemon inference, git hook) funnel through, which (a) builds the `DecisionRecord`, (b) evaluates the escalation predicate, (c) either appends silently or raises a confirm.
3. **Confirm surface.** Lightweight, non-blocking where possible. On interactive surfaces, a one-line prompt. On non-interactive (mobile, daemon-only), default to **queue-for-resume**, not silent-accept, so a `low_confidence` or overturning capture is reviewed at next `resume` rather than landing unseen.
4. **Daemon backstop (Layer 1 hardening).** Where the daemon infers a likely decision from activity, it must set `confidence: "low"` so the predicate routes it to confirm/queue. The daemon must never write a `high`-confidence decision; only agents self-reporting can.

### 2.6 Acceptance criteria

1. An agent following `HOLISTIC.md` records a fresh non-conflicting decision with **no human interaction**, and it appears in the active set at next `resume`.
2. An agent recording a decision that supersedes an active one triggers a confirm (interactive) or a resume-queue entry (non-interactive); it does not land silently.
3. A daemon-inferred decision is always `confidence: "low"` and never lands silently.
4. Under `safeMode`, capture still functions but instruction text is minimal.
5. Disabling capture (env or config) stops all writes without erroring (parallel to existing `ANDON_DISABLED` pattern).

---

## 3. Andon drift seam (Andon)

### 3.1 Problem and the real gap

The drift engine is largely built. `packages/andon-core/src/status-engine.ts` already derives an `at_risk` "signs of drift, churn, or repeated failure" decision from: scope expansion, out-of-scope file changes vs. `holisticContext.expectedScope`, repeated `rejectedApproaches`, failure churn, and idle-after-failure. `recommendation-engine.ts` already emits "Redirect the agent before it drifts further." The bridge type `HolisticContext` already carries the frozen intent anchor (`objective`, `constraints`, `expectedScope`, `successCriteria`, `acceptedApproaches`, `rejectedApproaches`, `priorAttempts`).

**The gap is the producer.** `agent.scope_expansion_detected` is a defined `EventType` and is *consumed* by `status-engine.ts`, but nothing in `services/andon-collector/` *produces* it. The detection rules exist; the emitter that turns raw PostToolUse hook payloads into these semantic events does not. This is exactly the "audit PostToolUse hook payload shape before writing collector code" step.

### 3.2 What to build

1. **PostToolUse payload audit (do this first, write nothing else until done).** Document the actual shape of the hook payload as delivered today: confirm presence of tool name, file path(s) touched, args, and timestamps. Output a short `docs/posttooluse-payload.md` recording the real fields. Every detector below depends on these fields existing; do not assume them.
2. **Scope-expansion detector.** In `services/andon-collector/`, emit `agent.scope_expansion_detected` when a tool touches a path outside `holisticContext.expectedScope`. The consumer logic already exists (`isPathOutsideScope`); you are feeding it.
3. **Retry/thrash detector.** Emit `agent.retry_pattern_detected` on repeated near-identical tool calls or edit/revert cycles, computed from the payload stream alone (no LLM).
4. **Decision-aware drift (new, depends on Section 1).** Read active decisions via the bridge. If the agent's actions contradict an **active** decision (not just `rejectedApproaches`), raise a drift recommendation. This is read-only: Andon surfaces it; it does **not** write a decision or a supersession back to Holistic. If Andon thinks a decision should be superseded, it emits a recommendation that the human or agent acts on through Holistic's own `supersede` command.

### 3.3 Control-loop framing (design guidance, not a hard requirement)

Prefer integrated error over single-event triggers where practical: a single out-of-scope touch is noise; sustained divergence is drift. The existing `AT_RISK_FAILURE_THRESHOLD` is a step in this direction. This gives the "catch slow slides before damage accumulates" property and reduces false halts on legitimate mid-task course-correction. Do not auto-halt; flag and optionally pause, consistent with the andon-cord metaphor (empower a stop, don't force one).

### 3.4 Acceptance criteria

1. `docs/posttooluse-payload.md` exists and reflects the real payload, with any missing-but-needed fields called out.
2. A tool touching a path outside `expectedScope` produces `agent.scope_expansion_detected`, and `status-engine.ts` flips the session to `at_risk` with that evidence, end to end.
3. Repeated identical tool calls produce `agent.retry_pattern_detected`.
4. An action contradicting an active decision produces a drift recommendation and writes nothing to Holistic.
5. The bridge remains read-only from Andon: a grep for Holistic writes in `packages/andon-*` and `services/andon-*` returns nothing.

---

## 4. Trust and provenance (Holistic, mostly built + named future work)

### 4.1 In-boundary (today's real case) — mostly built

`SECURITY.md` already documents a "Consent-First, Read-First" trust model: path containment, guarded mutation tiers, safe mode, secret redaction, read-only routine commands, and an explicit threat model. The in-boundary case (all agents are yours, trusted by construction) is largely solved. **Do not rebuild it.**

The one genuine gap is **provenance**, and Section 1 already closes most of it: every `DecisionRecord` carries `sessionId` and `agent`. Extend the same idea minimally:

1. Provenance is mandatory on decisions (already specified in 1.3.2).
2. Add a short note to `SECURITY.md` naming the trust boundary explicitly: the repo works as a coordination substrate **because every writing agent is inside one operator's trust boundary**. State this as a precondition rather than leaving it implicit. This is documentation, not code.

### 4.2 Cross-operator (the hard case) — named, not built

When agents belong to different operators (neither controls the other's runtime), the repo stops being a shared substrate: there is no shared filesystem, git history is per-org, and "versioned and auditable" breaks because either side can rewrite history unilaterally. The correct primitive is a record with settlement guarantees and no privileged writer: an append-only log both sides can verify but neither can edit. This is a **different primitive** than a repo file and is **explicitly out of scope**.

Capture it in a new `docs/FUTURE-cross-operator-trust.md` stub so the architecture does not foreclose it. Do not let any in-boundary design assume a single trusted writer in a way that would be impossible to relax later (e.g., keep the decisions log append-only and signable-in-principle, which the JSONL choice already supports).

### 4.3 Acceptance criteria

1. `SECURITY.md` names the in-boundary trust assumption explicitly as a precondition.
2. Every decision has non-empty provenance; anonymous decisions are rejected.
3. `docs/FUTURE-cross-operator-trust.md` exists and records the verifiable-log direction.

---

## 5. Build order and a single next step

Dependency order, do not reorder:

1. Section 1 (decision schema + storage + fold + commands). Everything else reads this.
2. Section 2 (capture + escalation predicate). Makes Section 1 invisible-by-default.
3. Section 3 (Andon producers + decision-aware drift). Depends on the bridge exposing active decisions.
4. Section 4 (provenance note + future-work stub). Small; can land alongside Section 1.

### Single next step

Do the **PostToolUse payload audit** in Section 3.2 and write `docs/posttooluse-payload.md`. It is the cheapest high-information action: it unblocks every Andon detector, confirms whether the `confidence`/scope fields the capture model needs are even present in the hook stream, and answers "is this feasible on the current hook shape" before any collector or schema code is written. It is also the step already identified as top-of-list, so it converges the spec with the existing plan.
