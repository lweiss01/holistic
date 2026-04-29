# M005: Andon MVP

## Vision

Ship the first local-first Andon prototype that can supervise one active coding-agent session: ingest events, compute status, explain why that status was assigned, recommend the next human action, and show a grounded timeline/detail view powered by Holistic context.

## Architecture note

Holistic supplies Layer 3 grounding (intent, continuity, checkpoints) via the bridge, not a replacement for Layer 1-2 runtime telemetry.
This MVP remains runtime-agnostic at the core.
The existing OpenHarness collector adapter is a useful compatibility fixture, but the primary runtime architecture now starts in later milestones with `packages/runtime-core` and `services/runtime-service`.

## Planning note

The scaffold is already in place. This milestone is about proving the loop live, then hardening the parts that are still provisional. The first slice should be operational and visual, not theoretical.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Live Dashboard Run | medium | - | [x] | API and dashboard run together locally; active session, timeline, and detail views are exercised live; defects are captured with concrete repro notes |
| S02 | Rules and API Test Coverage | medium | S01 | [ ] | Status engine, recommendation engine, core API routes, and seed/migration flow are protected by automated tests |
| S03 | Runtime Adapter Fixture Validation | medium | S01 | [ ] | Collector normalization is tested against realistic runtime payloads; mapping gaps are documented and fixed |
| S04 | Dashboard Polish From Live Findings | low | S01 | [ ] | UI explanations, health signals, empty/error states, and recommendation language feel trustworthy after real usage |

## Exit Criteria

- Andon can be run locally without guesswork
- The dashboard has been exercised against a live API session, not just a build
- Core rules and endpoints are covered by tests
- At least one runtime-shaped event source is validated against realistic data, not just inferred schemas
- Remaining non-MVP ideas are clearly deferred instead of leaking into the current scope
