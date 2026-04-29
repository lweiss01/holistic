# M006 S01 — summary (current realignment)

**Supersedes:** earlier draft text that described SSE-only work under the old slice meaning. Current S01 is **runtime core contract only**.

## Delivered

- **`packages/runtime-core`** (npm **`@andon/runtime-core`**, private): `src/types.ts`, `events.ts`, `capabilities.ts`, `adapter.ts`, public **`src/index.ts`** re-exports.
- **Contract coverage:** `RuntimeId`, `RuntimeStatus`, `RuntimeActivity`, `RuntimeTaskInput`, `RuntimeSession`, `HolisticRuntimeEvent` (+ event type / severity unions), `RuntimeCapabilities`, `AgentRuntimeAdapter`.
- **Tests:** `tests/runtime-core.test.ts` (enum/export stability + adapter shape exercise), wired from `tests/run-tests.ts`.

## Not in S01 (later milestones)

- Process launch, NDJSON streaming, HTTP routes — **M007+**
- Persisting runtime rows — **M006 S02–S03** (implemented separately in `services/andon-api`)

See [M006-RECONCILIATION.md](../../M006-RECONCILIATION.md) for full milestone status.
