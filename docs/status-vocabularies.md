# Status vocabularies

Holistic and the Andon add-on use four different status types. They are not
redundant, but they were easy to confuse, and until recently two of them shared
the name `SessionStatus`. This is the map.

## The four types

| Type | Defined in | Answers | Values |
|---|---|---|---|
| `HolisticSessionLifecycle` | `src/core/types.ts` | Where is this session record in its life? | `active`, `handed_off`, `superseded` |
| `SessionStatus` | `packages/andon-core/src/types.ts` | What does a supervisor need to know right now? | `running`, `queued`, `needs_input`, `at_risk`, `blocked`, `awaiting_review`, `parked` |
| `RuntimeStatus` | `packages/runtime-core/src/types.ts` | What is the runtime process actually doing? | `starting`, `running`, `waiting_for_input`, `waiting_for_approval`, `awaiting_review`, `awaiting_assignment`, `blocked`, `paused`, `completed`, `failed`, `cancelled`, `parked`, `unknown` |
| `MissionPrimaryStatus` | `services/andon-api/src/operational-projection.ts` | What single label should Mission Control show? | `running`, `awaiting_assignment`, `waiting_for_review`, `waiting_on_human_input`, `needs_intervention`, `parked_idle`, `done_historical`, `unknown` |

## Which is authoritative

**`RuntimeStatus` is the source of truth for live state.** It is written by the
runtime service and by the runtime-writer from `state.json`, and it is the only
one derived from direct observation rather than inference.

**`MissionPrimaryStatus` is authoritative for display.** The operational
projection combines runtime status, signal freshness, and process liveness into
the one label an operator should act on, and it carries a `confidence` and a
`sourceOfTruth` alongside it precisely because it is a judgement.

**`SessionStatus` (andon-core) is a legacy inference** produced by the status
engine from an event tail. It is still computed and shown on the session detail
page under "Legacy status engine", explicitly labelled non-authoritative.

**`HolisticSessionLifecycle` is unrelated to all three.** It describes a record,
not an agent. A `handed_off` session can still be the most useful thing in the
repo.

## Why the name changed

`src/core/types.ts` previously exported this as `SessionStatus`, colliding with
the andon-core type of the same name. The two describe different things: one is
the state of a stored record, the other is what an agent is doing. Reading code
that imported one while meaning the other was a genuine hazard, so the core type
is now `HolisticSessionLifecycle`.

## Event vocabularies

Andon's `EventType` and the runtime's `HolisticRuntimeEvent["type"]` overlap
heavily but diverged historically. The mapping lives in
`services/andon-api/src/repository.ts` as two data structures rather than a
switch:

- `RUNTIME_EVENT_PASSTHROUGH`: names identical in both vocabularies.
- `RUNTIME_EVENT_RENAMES`: the ten names that differ.

Anything unrecognised becomes `telemetry.noop`, so an unknown event can never
masquerade as a meaningful one in replay.

## Where mapping happens

| Function | File | Direction |
|---|---|---|
| `legacyEventToRuntimeEventType` | `repository.ts` | Andon event to runtime event |
| `legacyAgentEventToMirrorRuntimeStatus` | `repository.ts` | Andon event to `RuntimeStatus` |
| `runtimeStatusToFleetStatus` | `repository.ts` | `RuntimeStatus` to `SessionStatus` |
| `runtimeActivityToPhase` | `repository.ts` | runtime activity to session phase |
| `projectOperationalSession` | `operational-projection.ts` | everything to `MissionPrimaryStatus` |

## If you are adding a status

Prefer extending `RuntimeStatus` and letting the projection derive the rest. A
new value in `MissionPrimaryStatus` needs a matching presentation in the
dashboard view model, and a new value in the andon-core `SessionStatus` mostly
just adds another thing to map.
