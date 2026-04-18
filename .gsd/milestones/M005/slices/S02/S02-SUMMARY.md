# S02: Rules and API Test Coverage - Progress

## Landed

- Added `tests/andon.test.ts`
- Added focused coverage for:
  - unresolved questions -> `needs_input`
  - repeated failures -> `at_risk`
  - idle after failure/tool issue -> `blocked`
  - completion signal -> `awaiting_review`
  - stale session window -> `parked`
  - Holistic expected-scope drift -> `at_risk`
  - API active-session/detail/timeline/event-ingest loop
- Added collector gating so the demo heartbeat is skipped once a session is awaiting review or parked
- Refactored the API entrypoint to expose `createAndonHandler` and `createAndonServer` for in-process testing
- Fixed a real repository bug where SQLite rejected `undefined` optional session fields during event ingestion
- Added `npm run test:andon` as a focused verification command

## Current Verification

`npm run test:andon`

passes with 8 Andon-focused tests green.

## Remaining Work In This Slice

- Consider adding collector normalization tests once OpenHarness payload samples are available
