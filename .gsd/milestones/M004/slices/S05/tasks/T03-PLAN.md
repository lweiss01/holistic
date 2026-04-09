---
estimated_steps: 7
estimated_files: 3
skills_used: []
---

# T03: Throttle session hygiene to once per day

Add hygiene throttling to src/daemon.ts:
1. Add state.lastHygieneAt: string to HolisticState type
2. In runDaemonTick, check if hygiene ran in last 24 hours
3. Only call runSessionHygiene if 24+ hours elapsed
4. Update state.lastHygieneAt after running hygiene
5. Add unit test verifying throttle logic
6. Manual test: daemon runs for 25 hours, hygiene runs ~1 time not 1500

## Inputs

- `src/daemon.ts`

## Expected Output

- `Hygiene runs max once per 24 hours`
- `state.lastHygieneAt tracks last run`

## Verification

npm test -- daemon-hygiene.test.ts

## Observability Impact

Daemon logs show hygiene run timestamp and throttle status
