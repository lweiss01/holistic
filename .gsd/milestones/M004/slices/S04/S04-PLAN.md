# S04: Optimize Daemon State Persistence

**Goal:** Remove persistObservedState() calls from buffering paths. Only persist when checkpoint is actually created or hygiene runs
**Demo:** After this: Daemon runs for 1 hour with active file changes - state.json written < 5 times instead of 120+

## Tasks
