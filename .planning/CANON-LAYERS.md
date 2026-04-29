# Canonical stack: Holistic runtime adapters and Andon

This file restates the architecture agreed for the runtime-first Andon program so later milestones do not drift back into treating an external harness as the product's primary control plane.

## Layers

1. **Layer 1-2 - Runtime contract and operational telemetry**
   Holistic owns the protocol for runtime sessions, lifecycle state, heartbeats, approvals, and normalized events.
   The shared contract lives in `packages/runtime-core`.
   The first shipped adapter is `runtime-local`, and later adapters can wrap Codex, Claude Code, OpenHarness, or custom runners without changing Andon's core types.

2. **Layer 3 - Holistic context and work memory**
   Holistic owns objective, constraints, checkpoints, continuity, handoffs, and repo/worktree association.
   It answers: what is this work, what matters, and what happened before?
   Holistic does not replace Layer 1-2 runtime truth for every low-level tick.

3. **Layer 4-6 - Andon and Mission Control**
   Andon owns live supervision, fleet ranking, recommendations, attention routing, and the dashboard/operator surfaces.

## UI rule

Surface both live runtime state and a labeled Holistic grounding block.
Do not conflate runtime activity, dashboard explanations, and Holistic memory in copy or layout.

## Planning consequences

- **M006** defines the runtime contract, persistence tables, and repository plumbing.
- **M007** adds `runtime-service`, the local adapter, structured NDJSON events, heartbeats, and stream endpoints.
- **M008** adds approvals, guardrails, graceful stop behavior, and worktree isolation.
- **M009** derives fleet intelligence by comparing runtime reality, approvals, overlap, and Holistic grounding.
- **M010** consumes that substrate through the fleet Mission Control homepage and drill-down views.
- **OpenHarness** remains a useful adapter target and compatibility fixture, but it is not the architectural owner of Layer 1-2 in this repo.
