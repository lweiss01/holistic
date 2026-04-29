# M006 S01 - Runtime Core Package

Realigned from the earlier SSE slice. This slice now defines the shared runtime contract for the rest of the program.

## Tasks

- [x] Create `packages/runtime-core` with focused source files for types, events, adapter interfaces, capabilities, and exports. *(npm package **`@andon/runtime-core`**.)*
- [x] Define `RuntimeId`, `RuntimeStatus`, `RuntimeActivity`, `RuntimeTaskInput`, `RuntimeSession`, and `HolisticRuntimeEvent`.
- [x] Define `AgentRuntimeAdapter` and `RuntimeCapabilities` without leaking provider-specific shapes into the shared contract.
- [x] Re-export the package from a single public entrypoint so later services and adapters can depend on it cleanly.
- [x] Add automated coverage that proves the package builds and the exported shapes are stable enough for downstream imports. *(See `tests/runtime-core.test.ts`.)*

## Success Criteria

- `packages/runtime-core` becomes the canonical runtime contract for this repo.
