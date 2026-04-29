# Feature Research

**Domain:** Agent supervision dashboard (runtime-first)  
**Researched:** 2026-04-29  
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time agent liveness | Core promise of Andon | MEDIUM | Must be runtime-backed, not narrative-backed |
| Accurate intervention status | Operator needs immediate actionability | MEDIUM | `needs_input`, `blocked`, `review` must be evidence-based |
| Stable objective/task identity | Prevent stale mission cards | MEDIUM | Objective should change with actual runtime session context |
| Honest disconnected state | Prevent false confidence | LOW | Explicitly show degraded/offline runtime feed |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Glance-first visual hierarchy | Operators decide in seconds | MEDIUM | State-first cards + intervention strip |
| Runtime-vs-context separation | Trustworthy control plane with useful narrative context | MEDIUM | Live state from runtime; narrative in details/timeline |
| Regression-proof truth model tests | Prevent recurring dashboard drift | MEDIUM | Add tests for sticky status/objective regressions |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Inferred live state from chat-like events | Seems easy with existing data | Produces stale/incorrect supervision | Runtime-only live classification with explicit degraded mode |
| Overly dense cards | Feels “informative” | Reduces scan speed and hides intervention signals | Default glance mode + expandable details |

## MVP Definition

### Launch With (v1)

- [ ] Runtime-only live classification for card status.
- [ ] Clear intervention lane with high-signal visual cues.
- [ ] Explicit disconnected/degraded runtime state.
- [ ] Objective/status stickiness regressions fixed and tested.

### Add After Validation (v1.x)

- [ ] Additional fleet segmentation presets (team/repo/runtime cohorts).
- [ ] Adaptive sorting tuned by operator behavior.

### Future Consideration (v2+)

- [ ] Cross-host/global fleet federation.
- [ ] Predictive intervention ranking.

---
*Feature research for: Andon runtime-truth glanceability*
