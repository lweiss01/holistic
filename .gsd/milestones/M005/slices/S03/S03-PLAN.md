# S03: OpenHarness Adapter Coverage

**Goal:** Add automated normalization validation for the OpenHarness adapter to ensure the translation from stream payloads to internal AgentEvent shapes is rock-solid.
**Demo:** Running `npm run test:andon` verifies that the various OpenHarness standard event types correctly map into the Andon status tracking data structures.

## Tasks
- [x] **T01: Add adapter normalization testing** - Assert that raw stringly-typed dictionary payloads from OpenHarness translate to the correct schemas with the right IDs, phases, and fallback summaries.
  - Files: `tests/andon.test.ts`, `services/andon-collector/src/openharness-adapter.ts`
  - Verify: `npm run test:andon`

## Success Criteria

- A new suite handles simulated OpenHarness inputs natively.
- Ensures unexpected types are dropped safely without throwing.
- Ensures all standard types map their fields stably.
