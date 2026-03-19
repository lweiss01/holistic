# AGENTS

## Holistic Protocol

Every agent working in this repo should:

1. Read [HOLISTIC.md](./HOLISTIC.md) first.
2. Review [Project History](./.holistic/context/project-history.md), [Regression Watch](./.holistic/context/regression-watch.md), and [Zero-Touch Architecture](./.holistic/context/zero-touch.md) before changing behavior that may already have been fixed.
3. Read the app-specific adapter in `.holistic/context/adapters/`.
4. If the Holistic daemon is installed, assume passive capture is already running in the background.
5. Run `holistic resume --agent <codex|claude|antigravity>` only when you need an explicit recap or recovery flow.
6. Recap the current state for the user and ask whether to continue, tweak the plan, or start something new.
7. Record a checkpoint when focus changes, before likely context compaction, and before handoff.

## Handoff Commands

- `holistic checkpoint --reason "<why>"`
- `holistic handoff`
- `holistic start-new --goal "<goal>"`
- `holistic watch`
