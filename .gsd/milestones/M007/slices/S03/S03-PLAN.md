# M007 S03 - Heartbeats, Stale Detection, and Verification

## Tasks

- [x] Add heartbeat emission and storage for active runtime sessions.
- [x] Implement staged runtime freshness states such as active, quiet, stale, stalled, and needs attention.
- [x] Expose live runtime events through `GET /runtime/stream`.
- [x] Add tests proving a fake runtime can be started, emits events, records heartbeats, and ends as completed or failed.

## Success Criteria

- Runtime truth is live and durable enough for later fleet UI and intelligence work.
