# M006 S03 - Repository Plumbing

## Tasks

- [x] Add repository/store helpers for runtime sessions, runtime events, runtime approvals, and runtime processes. *(See `services/andon-api/src/runtime-repository.ts`.)*
- [x] Keep serialization boundaries explicit so payload JSON stays opaque outside store code.
- [x] Add query helpers needed by future `runtime-service` reads: list sessions, read one session, list events by session, read pending approvals, and read process metadata.
- [x] Add tests for repository behavior, including empty-state reads and append-only event history. *(See `tests/runtime-storage.test.ts`.)*

## Success Criteria

- Later milestones can build services on top of repositories instead of embedding raw SQL everywhere.
