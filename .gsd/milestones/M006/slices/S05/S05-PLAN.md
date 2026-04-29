# M006 S05 - Docs and Verification

## Tasks

- [x] Update architecture docs so they name `runtime-core` as the canonical runtime contract. *(`.planning/CANON-LAYERS.md`, `docs/andon-mvp.md`, `docs/andon-design-tokens.md`.)*
- [x] Record the realigned milestone intent and note that old slice meanings were replaced, not deleted. *(Roadmap + [M006-RECONCILIATION.md](../../M006-RECONCILIATION.md) + refreshed `S01-SUMMARY.md`.)*
- [x] Run the relevant automated checks for package build and runtime-table schema coverage. *(See `tests/runtime-core.test.ts`, `tests/runtime-storage.test.ts` via `npm test`.)*
- [x] Leave a concise summary of what later milestones may assume from M006. *(Handoff bullets in [M006-RECONCILIATION.md](../../M006-RECONCILIATION.md).)*

## Success Criteria

- The runtime foundation is documented clearly enough that M007 can begin without re-deciding the contract.
