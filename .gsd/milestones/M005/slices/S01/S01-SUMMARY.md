# S01: Live Dashboard Run - Summary

## Outcome

The Andon MVP was exercised live with the local SQLite seed data, the Andon API, and the React dashboard running together.

Validated paths:

- Active session page loaded live API data
- Timeline page rendered seeded event history correctly
- Detail page showed Holistic grounding and expected scope context
- Collector event ingestion updated the active-session status from `parked` to `running`

## What Happened

1. Ran the database migration and seed scripts successfully
2. Started the dashboard dev server and confirmed it served on `127.0.0.1:4173`
3. Observed browser-side `Failed to fetch` errors on active, timeline, and detail views
4. Traced the problem to the API process being launched from the sandbox and dying after startup
5. Relaunched the API outside the sandbox and confirmed `GET /health` was reachable on `127.0.0.1:4318`
6. Re-ran the live browser walkthrough and confirmed all three pages loaded
7. Posted a collector heartbeat and verified the UI updated from `parked` to `running`

## Findings

### Confirmed

- The MVP shape is operational when both services are actually reachable from the browser
- Status and recommendation text are understandable enough for a first pass
- The timeline/detail split works well for this scope

### Important operational note

- In this environment, background API processes started inside the sandbox are not durable enough for a live dashboard session. The dashboard itself was fine; the fetch failures were caused by the API process dying after launch.

## Follow-up Implications

- `S02` should focus on automated coverage for rules and API behavior so the live path is protected
- `S03` should validate the OpenHarness adapter against real runtime payloads
- `S04` can refine UX wording and any live-run polish now that the baseline interaction loop is proven
