# Canonical stack: Holistic, OpenHarness, Andon

This file restates the **non-negotiable architecture** agreed for Andon + Holistic so later milestones do not drift back into treating Holistic as the full agent harness.

## Layers (Andon system design spec §4, §8.1)

1. **Layer 1–2 — Agent runtime & operational telemetry**  
   Live tasks, tool/file/command events, stream-shaped signals. **Reference harness:** [OpenHarness](https://github.com/HKUDS/OpenHarness). Andon ingests normalized events via the collector (`services/andon-collector`, e.g. `openharness-adapter.ts`).

2. **Layer 3 — Holistic (context / work memory)**  
   Objective, constraints, checkpoints, continuity, handoffs. Answers: *what is this work and what happened before?* Holistic **does not** replace Layer 1–2 for every low-level tick.

3. **Layer 4–6 — Andon + Command Center**  
   Supervision, status, recommendations, attention routing, broader operating surfaces.

## UI rule

Surface **both** live Andon/runtime fields **and** a **labeled Holistic grounding** block. Do not conflate them in copy or layout.

## Planning consequences

- **M005 S03**, **M007**, **M006** copy must keep OpenHarness (or compatible adapter) as the path for high-frequency runtime truth; Holistic CLI events complement but do not satisfy “full harness” alone.
- **M009** semantic drift compares **operational reality** to **Holistic-stated bounds**; it extends Layer 3 reasoning, it does not remove the need for Layer 1–2 ingestion.
