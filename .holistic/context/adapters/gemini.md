# Gemini Adapter

## Startup Contract

1. Read `HOLISTIC.md`.
2. Review `project-history.md`, `regression-watch.md`, and `zero-touch.md` for durable memory before editing related code.
3. If the Holistic daemon is installed, treat passive session capture as already active.
4. Run `holistic resume --agent gemini` when you need an explicit recap or recovery flow.
5. Recap the current state for the user in the first 30 seconds.
6. Ask: continue as planned, tweak the plan, or start something new.

## Checkpoint Contract

Run `holistic checkpoint` when:

- the task focus changes
- you are about to compact or clear context
- you finish a meaningful chunk of work
- you fix or alter behavior that could regress later

Include impact notes and regression risks when they matter.

## Handoff Contract

- Preferred: map your session-end workflow to `holistic handoff`
- Fallback: ask the user to run `holistic handoff` before leaving the session
