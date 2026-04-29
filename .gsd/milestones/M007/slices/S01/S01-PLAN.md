# M007 S01 - Runtime Service API

Realigned from the earlier event-forwarding plan. This slice creates the service boundary that later adapters plug into.

## Tasks

- [ ] Create `services/runtime-service` with a server entrypoint, adapter registry, and runtime-facing request handlers.
- [ ] Implement `POST /runtime/tasks`, `GET /runtime/sessions`, `GET /runtime/sessions/:id`, `GET /runtime/sessions/:id/events`, `POST /runtime/sessions/:id/pause`, `resume`, `stop`, `approve`, `deny`, and `GET /runtime/stream`.
- [ ] Keep runtime-service separate from `andon-api`; do not force Andon's existing API to own orchestration directly.
- [ ] Add automated coverage for route shape, empty states, and session/event query behavior.

## Success Criteria

- There is a dedicated runtime control-plane service boundary ready for adapters.
