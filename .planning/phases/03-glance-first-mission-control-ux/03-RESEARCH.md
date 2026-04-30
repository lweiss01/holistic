# Phase 03: Glance-First Mission Control UX — Research
**Researched:** 2026-04-29  
**Requirements:** UIX-01, UIX-02, UIX-03  
**Confidence:** HIGH

## Summary
Phase 03 should make Mission Control triage readable in under 3 seconds by enforcing a strict state-first visual hierarchy and explicit degraded-mode semantics. The backend already computes trustworthy status, urgency, attention rank, and freshness; the frontend needs to prioritize those signals over narrative copy.

The implementation should not introduce new status inference in UI. Instead, render existing `FleetSessionItem` truth fields in a consistent intervention-first layout:

1. Critical intervention signals first (`status`, `urgency`, `why now`, `next action`).
2. Runtime health and freshness presented explicitly and distinctly.
3. Contextual detail (objective, summary, repo/worktree) demoted to secondary scan layers.

## Standard Stack
Use the current dashboard and API contracts:

- React + TypeScript Mission Control UI in `apps/andon-dashboard/src/App.tsx`.
- Existing CSS token/tone system in `apps/andon-dashboard/src/styles.css`.
- Fleet payload from `packages/andon-core/src/types.ts` (`FleetResponse`, `FleetSessionItem`).
- Runtime-truth statuses from `services/andon-api/src/repository.ts`.
- Regression coverage via `tests/andon.test.ts` and deterministic render checks where feasible.

No new UI framework, component library, or state manager is needed for this phase.

## Architecture Patterns

### Pattern 1: State-First Card Information Architecture (UIX-01)
Render each card in strict scan order:

1. **Intervention header:** status chip + urgency chip.
2. **Identity line:** agent and current actionable headline.
3. **Why-now line:** compact reason from status evidence.
4. **Action line:** recommended next action.
5. **Secondary metrics:** repo, runtime, phase, freshness, rank details.

Avoid leading with long objective text or historical summary paragraphs.

### Pattern 2: Intervention Lane + Grid Split (UIX-02)
Keep two simultaneous views:

- **Attention Queue:** top N sessions requiring intervention (`needs_input`, `blocked`, `at_risk`, `awaiting_review`), always visible.
- **Agent Grid:** full filtered set sorted by attention/freshness/recent activity.

This preserves fast actionability without hiding fleet breadth.

### Pattern 3: Explicit Degraded/Disconnected Runtime Semantics (UIX-03)
When runtime truth is weak or absent, show explicit degraded messaging that cannot be confused with active flow:

- `heartbeatFreshness = cold` + non-urgent state should present as degraded/parked language.
- Runtime-missing scenarios should use explicit copy such as “No runtime heartbeat” and “runtime signal missing.”
- Degraded visual treatment must be distinct from `running` and `blocked` tones.

### Pattern 4: Canonical Display Mapping from Backend Truth
UI labels and colors should map deterministically from backend status enums:

- `running` → active flow tone
- `needs_input` → operator action tone
- `blocked` → critical stop tone
- `at_risk` → warning tone
- `awaiting_review` → review tone
- `parked` with cold/runtime-missing evidence → degraded/offline tone

Do not derive new display states from narrative text in the component.

### Pattern 5: Dense-by-Default, Expand-on-Demand
Cards should remain concise and scannable by default; deeper context should live behind:

- details toggles (`rank details`, `full summary`)
- session detail route (`/session/:id`)
- timeline route (`/session/:id/timeline`)

This preserves glanceability while retaining diagnostic depth.

## Don't Hand-Roll
- Do **not** create a frontend-only status classifier separate from backend Fleet status.
- Do **not** depend on color alone to communicate intervention state; always pair with explicit labels/text.
- Do **not** surface degraded/runtime-missing rows as “running” with muted styling.
- Do **not** reintroduce narrative-first card copy above intervention signals.
- Do **not** add alternate one-off urgency logic in UI; consume `recommendation.urgency` directly.

## Common Pitfalls
1. **False flow confidence:** cold or runtime-missing sessions look active because “running” styling is retained.
2. **Narrative overload:** long objective/summary blocks push intervention cues below fold.
3. **Ambiguous degraded state:** parked, stale, and disconnected all look visually identical.
4. **Action opacity:** recommendation exists but is not adjacent to why-now evidence.
5. **Filter/sort confusion:** current board state hidden from URL/state, making operators lose context.
6. **Tone drift:** CSS status classes and labels diverge from backend enums over time.

## Code Examples

### 1) Recommended card header pattern (state first)
```tsx
<div className="section-head">
  <StatusLine status={item.status.status} />
  <span className={`urgency urgency-${urgencyTone(item.recommendation.urgency)}`}>
    {item.recommendation.urgency}
  </span>
</div>
<p className="fleet-card-context"><b>Why now:</b> {whyNow(item)}</p>
<p className="fleet-card-context"><b>Next:</b> {item.recommendedAction}</p>
```

### 2) Recommended degraded freshness label mapping
```ts
function freshnessLabel(value: FleetSessionItem["heartbeatFreshness"]): string {
  if (value === "fresh") return "Live (<5 min)";
  if (value === "stale") return "Quiet (5–20 min)";
  return "Cold (>20 min) — degraded";
}
```

### 3) Anti-pattern to avoid
```tsx
// Avoid putting long narrative text before intervention cues.
<h3>{item.session.objective}</h3>
<p>{item.session.lastSummary}</p>
<StatusLine status={item.status.status} />
```

## Verification Targets
1. Add deterministic UI render checks (or stable DOM assertions) that verify status/urgency/why-now appear before narrative fields on fleet cards.
2. Add regression tests for explicit degraded wording when runtime is cold or runtime signal is absent.
3. Validate that top intervention targets remain visible without opening details.
4. Run focused UX dogfooding using known stale-state scenarios from prior phases.

Validation commands:

- `npm run test:andon`
- `npm test`

## Implementation Notes for Plan Phase
- Primary implementation targets: `apps/andon-dashboard/src/App.tsx`, `apps/andon-dashboard/src/styles.css`.
- Keep backend truth contracts unchanged; this phase is presentation hierarchy + semantic clarity.
- Preserve current routes and existing actions (`inspect`, `pause`, `resume`, `approve`) while improving cue prominence.
