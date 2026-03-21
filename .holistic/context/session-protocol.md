# Session Protocol

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

The protocol below is the current operating model, not the final ideal. When improving Holistic, prefer changes that make more of this protocol happen automatically without weakening durable continuity.

## Startup

1. Read `HOLISTIC.md`.
2. Review `project-history.md`, `regression-watch.md`, and `zero-touch.md` for durable project memory and automation expectations.
3. If the Holistic daemon is installed, let it capture repo activity in the background.
4. Run `holistic resume --agent <app>` only when you need an explicit recap or recovery flow.
5. Recap the work state to the user.
6. Ask whether to continue as planned, tweak the plan, or start something new.

## During The Session

Run `holistic checkpoint`:

- when the task focus changes
- before likely context compaction
- after meaningful progress
- when you fix something another agent might accidentally re-break later

Use `holistic watch` if you want foreground background checkpoints while working manually.

## Handoff

1. Run `holistic handoff`.
2. Confirm or edit the drafted summary.
3. Make sure the next step, impact, and regression risks are accurate.
4. Let Holistic write the docs and create the handoff commit.
5. Holistic sync helpers should push the current branch and mirror portable state to the dedicated state branch.
6. If you continue on another device, pull or restore the latest portable state before starting work.
