# AGENTS

<!-- ═══════════════════════════════════════════════════════════════════
     AGENT AUTO-START INSTRUCTIONS
     ═══════════════════════════════════════════════════════════════════

  YOU ARE READING THIS FILE AUTOMATICALLY AT SESSION START. GOOD.
  Now do the following BEFORE responding to the user or doing any work:

  1. Read HOLISTIC.md in full.
  2. Summarise to the user: what was last worked on, what's planned next,
     and flag any KNOWN FIXES they should be aware of.
  3. Ask: "Continue as planned, tweak the plan, or do something different?"
  4. Run: holistic resume --agent <your-agent-name>

  DO NOT skip step 1. HOLISTIC.md is the source of truth.
  ══════════════════════════════════════════════════════════════════ -->

## Holistic Protocol

### Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

Agents should treat that as the ultimate UX target. Prefer decisions that reduce manual ceremony while making checkpoint, resume, handoff, and regression-awareness more automatic and more reliable.

Every agent working in this repo should:

1. Read [HOLISTIC.md](./HOLISTIC.md) first.
2. Review [Project History](./.holistic/context/project-history.md), [Regression Watch](./.holistic/context/regression-watch.md), and [Zero-Touch Architecture](./.holistic/context/zero-touch.md) before changing behavior that may already have been fixed.
3. Read the app-specific adapter in `.holistic/context/adapters/`.
4. If the Holistic daemon is installed, assume passive capture is already running in the background.
5. Run `holistic resume --agent <codex|claude|antigravity|gemini|copilot|cursor|goose|gsd>` only when you need an explicit recap or recovery flow.
6. Recap the current state for the user and ask whether to continue, tweak the plan, or start something new.
7. Record a checkpoint when focus changes, before likely context compaction, and before handoff.

## Handoff Commands

- `holistic checkpoint --reason "<why>"`
- `holistic checkpoint --fixed "<bug>" --fix-files "<file>" --fix-risk "<what would reintroduce it>"`
- `holistic set-phase --phase "<id>" --name "<name>" --goal "<goal>"`
- `holistic complete-phase --phase "<id>" --next-phase "<id>" --next-name "<name>" --next-goal "<goal>"`
- `holistic handoff`
- `holistic start-new --goal "<goal>"`
- `holistic watch`

## Adding a New Agent Adapter

To add instructions for a new agent, create a file at:

`.holistic/context/adapters/<agent-name>.md`

Copy any existing adapter as a template and customise the agent name and startup steps.
Do not edit Holistic source files to register agents — adapters are data, not code.
