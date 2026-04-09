# S04: Optimize Daemon State Persistence

**Goal:** Remove persistObservedState() calls from buffering paths. Only persist when checkpoint is actually created or hygiene runs
**Demo:** After this: Daemon runs for 1 hour with active file changes - state.json written < 5 times instead of 120+

## Tasks
- [ ] **T01: Audit persistObservedState call sites** — Identify all persistObservedState() call sites in src/daemon.ts:
1. Buffering path (files changed, no checkpoint yet)
2. Quiet tick counting path
3. Time-based check path without checkpoint

Document which calls should remain (checkpoint/branch/hygiene) and which should be removed (buffering).
  - Estimate: 15m
  - Verify: rg 'persistObservedState' src/daemon.ts | wc -l
- [ ] **T02: Remove persistObservedState from buffering paths** — Remove persistObservedState() from buffering paths:
1. Remove call after "Buffered X changed files" (line ~185)
2. Keep calls in checkpoint/branch-switch/hygiene paths
3. Verify state.passiveCapture updates are still tracked in-memory
4. Add comment explaining why buffering doesn't persist
  - Estimate: 20m
  - Files: src/daemon.ts
  - Verify: grep -A 5 'Buffered.*changed file' src/daemon.ts | grep -v 'persistObservedState'
- [ ] **T03: Add persistence logging for verification** — Verify state persistence only happens on meaningful events:
1. Add logging to persistLocked() and persistObservedState() calls
2. Run daemon with console.log before each persist call
3. Verify persistence happens only when:
   - Checkpoint created
   - Branch switched
   - Hygiene ran
4. Verify buffering activity doesn't trigger persistence
  - Estimate: 20m
  - Files: src/daemon.ts
  - Verify: grep -q 'persistLocked\|persistObservedState' src/daemon.ts
- [ ] **T04: Operational verification of reduced state writes** — Operational test:
1. Start daemon in test repo
2. Use inotifywait/fswatch to monitor .holistic/state.json writes
3. Make file changes every 2 minutes for 1 hour
4. Count state.json write events
5. Should be <5 writes (checkpoints) vs 60+ (old buffering writes)
6. Document results
  - Estimate: 65m
  - Verify: Manual: inotifywait -m .holistic/state.json during 1-hour daemon run shows <5 write events
