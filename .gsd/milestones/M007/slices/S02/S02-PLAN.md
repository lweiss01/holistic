# M007 S02 - Local Adapter and Structured Events

## Tasks

- [ ] Create `packages/runtime-local` with a local adapter that implements `AgentRuntimeAdapter`.
- [ ] Spawn a local process, assign a runtime session, and persist process metadata.
- [ ] Parse newline-delimited JSON events first, then fall back to tolerant log handling for malformed chunks.
- [ ] Emit normalized lifecycle, command, file, test, warning, and completion/failure events.
- [ ] Add a fake runner fixture for tests so end-to-end runtime behavior can be verified without a real external agent.

## Success Criteria

- The first shipped runtime is local and proves the contract without depending on an external harness.
