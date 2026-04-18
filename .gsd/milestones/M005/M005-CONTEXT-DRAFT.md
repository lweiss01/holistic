# M005: Andon MVP - Context Draft

**Status:** Active draft seeded from the initial MVP scaffold session  
**Gathered from:** Andon MVP implementation kickoff (2026-04-18)  
**Next:** Execute `M005/S01` first, then refine the roadmap based on the live dashboard run

---

## Why This Milestone

Andon is the supervision layer that sits on top of Holistic. Holistic provides the durable intent and grounding; Andon should answer the live operational questions:

- What is the agent doing?
- Is it healthy?
- What should I do next?

The first MVP is intentionally local-first and single-agent only.

## What Exists Already

- Monorepo scaffold under `apps/`, `services/`, and `packages/`
- SQLite schema and seed flow
- Shared TypeScript event/status/recommendation model
- Small Node API with active session, detail, timeline, health, and event-ingest endpoints
- Rules-based status engine
- Recommendation engine
- Mock Holistic bridge
- React dashboard for active session, timeline, and detail views
- Collector path that can normalize an OpenHarness-oriented event stream into the shared event model

## Remaining Gaps From Initial Scaffold

1. **Live dashboard verification** - build passed, but the dashboard still needs a real interactive run with the API up
2. **Automated test coverage** - no test suite yet for rules, API routes, or collector normalization
3. **Real OpenHarness validation** - adapter is based on inferred and official docs, not on captured real payloads from a live OpenHarness session
4. **Post-run polish** - the live session may expose missing UX signals, weak explanations, or thin recommendation wording

## Product Constraints

- Keep the MVP single-agent only
- Stay local-first
- Prefer simple rules over complex orchestration
- Use Holistic only for grounding in v1
- Treat OpenHarness as an optional runtime source, not a required platform dependency

## Milestone Success Shape

At the end of M005, a developer should be able to run the API and dashboard locally, see a session move through meaningful statuses, inspect timeline/detail grounded in Holistic context, and trust the collector path enough to start integrating a real runtime source.

## Immediate Direction

The next move is not more abstraction. The next move is a live run:

- start the API
- start the dashboard
- walk the three pages
- ingest live events while watching the UI
- capture defects and missing signals immediately
