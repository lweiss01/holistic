# S05 — Build E: Command Center handoff

**Goal:** No Command Center UI ships in this repo; **stabilize and document** HTTP + SSE contracts so an external “Command Center” can embed or poll Andon without breaking changes.

## Tasks

- [ ] **T01: Contract doc** — Add `docs/andon-api-contract.md` (or extend `docs/andon-mvp.md`) listing: auth (none for local MVP), base URL, active session, session detail, sessions list, timeline query params, SSE event names and payload shapes, callback POST body.
  - Files: `docs/andon-api-contract.md`, cross-links from `docs/andon-design-tokens.md` §7 Build E

- [ ] **T02: Versioning policy** — Note additive vs breaking changes; optional `Accept` or `X-Andon-Client` header for future negotiation (document only if not implemented).

- [ ] **T03: CORS / embedding** — If needed for local demos: document `ANDON_API_*` env for dashboard origin; avoid widening CORS in production defaults (127.0.0.1 only).

- [ ] **T04: Contract tests (optional but preferred)** — Add a small `tests/andon-api-contract.test.ts` that asserts stable route list + HTTP methods (no live server) or documents golden JSON fixtures checked by a script; run `npm test`.

## Success criteria

- Another team could integrate read-only supervision in a day using the doc alone.

## Proof level

Doc review + **`npm test`** if T04 added; otherwise document a copy-paste curl/SSE checklist in the contract doc and run manually once.
