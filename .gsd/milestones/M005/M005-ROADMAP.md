# M005: Andon MVP

## Vision
Ship the first local-first Andon prototype that can supervise one active coding-agent session: ingest events, compute status, explain why that status was assigned, recommend the next human action, and show a grounded timeline/detail view powered by Holistic context.

## Architecture note (Layers 1–3)

**Holistic** supplies **Layer 3** grounding (intent, continuity, checkpoints) via the bridge — not a replacement for **Layer 1–2** runtime telemetry. For live task/tool/file signals, the integration direction is **[OpenHarness](https://github.com/HKUDS/OpenHarness)** (see `docs/andon-mvp.md`, `services/andon-collector/src/openharness-adapter.ts`, and [`.planning/CANON-LAYERS.md`](../../../.planning/CANON-LAYERS.md)).

## Planning Note
The scaffold is already in place. This milestone is about proving the loop live, then hardening the parts that are still provisional. The first slice should be operational and visual, not theoretical.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Live Dashboard Run | medium | - | [x] | API and dashboard run together locally; active session, timeline, and detail views are exercised live; defects are captured with concrete repro notes |
| S02 | Rules and API Test Coverage | medium | S01 | [ ] | Status engine, recommendation engine, core API routes, and seed/migration flow are protected by automated tests |
| S03 | OpenHarness Runtime Validation | medium | S01 | [ ] | Collector normalization is tested against real OpenHarness output or hook payloads; mapping gaps are documented and fixed |
| S04 | Dashboard Polish From Live Findings | low | S01 | [ ] | UI explanations, health signals, empty/error states, and recommendation language feel trustworthy after real usage |

## Exit Criteria

- Andon can be run locally without guesswork
- The dashboard has been exercised against a live API session, not just a build
- Core rules and endpoints are covered by tests
- OpenHarness integration path is validated against real runtime data, not just inferred schemas
- Remaining non-MVP ideas are clearly deferred instead of leaking into the current scope
