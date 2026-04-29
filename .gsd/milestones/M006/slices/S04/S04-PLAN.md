# M006 S04 - Additive Compatibility

## Tasks

- [x] Audit current `andon-api` read paths and shared types for places that will need runtime-aware extension later. *(Completed in [M006-RECONCILIATION.md](../../M006-RECONCILIATION.md) with explicit `server.ts` + `repository.ts` path mapping.)*
- [x] Add only additive compatibility hooks or shared exports in this slice; no process orchestration or new dashboard behavior yet.
- [x] Prove existing session, detail, and timeline APIs behave unchanged after the runtime tables and repositories are introduced. *(Runtime DDL + `runtime-repository.ts` are unused by `server.ts`; MVP routes still use `repository.ts` only.)*
- [x] Capture any compatibility gaps that must be handled in M007 or M010 rather than papering over them here. *(HTTP wiring to runtime store → **M007**; fleet UX → **M010**.)*

## Success Criteria

- Runtime persistence lands without breaking the existing Andon MVP surface.

