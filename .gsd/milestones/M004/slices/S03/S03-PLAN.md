# S03: Add File I/O Error Handling

**Goal:** Wrap all fs.*Sync() calls in critical paths with try/catch and return {success, error} objects. Update call sites to handle errors gracefully
**Demo:** After this: chmod 000 .holistic/state.json, run checkpoint - shows error instead of crashing

## Tasks
