# M004: 

## Vision
Holistic's auto-commit feature currently doesn't execute any git commits - it only writes intent to a text file. The sync scripts have hardcoded paths breaking portability. File I/O operations lack error handling causing crashes. The daemon writes state.json on every tick even when nothing changed. This milestone fixes all critical commit issues, portability bugs, and reliability gaps.

## Planning Note
Two additional bug fixes were verified during dogfooding on 2026-04-03 and are now landed outside the original slice wording:
- checkpoint-created sessions now inherit carryover context after handoff instead of seeding boilerplate fallback text
- fresh repos can create an initial checkpoint before `holistic init` because lock acquisition now creates its parent directory

The remaining open bug-hunt scope in this milestone is whatever still reproduces after those two fixes, with S05 currently focused on deduplication, detached HEAD branch naming, and hygiene throttling.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Implement Git Commit Execution | high | — | ✅ | After handoff, git log shows actual commit with correct message and staged Holistic files |
| S02 | Fix Sync Script Portability | medium | S01 | ✅ | Sync scripts work on any machine - can cd to subdirectory and run script successfully |
| S03 | Add File I/O Error Handling | high | — | ⬜ | chmod 000 .holistic/state.json, run checkpoint - shows error instead of crashing |
| S04 | Optimize Daemon State Persistence | medium | S03 | ⬜ | Daemon runs for 1 hour with active file changes - state.json written < 5 times instead of 120+ |
| S05 | Fix Deduplication & Minor Bugs | low | — | ⬜ | Detached HEAD shows commit SHA, hygiene runs once per day, no duplicate session IDs |
| S06 | Use Git LS-Files for Snapshot | medium | S03 | ⬜ | Snapshot capture on 1000+ file repo completes 10x faster than before |
