# Zero-Touch Architecture

Holistic cannot force every app or agent to execute startup logic just because a repo exists. Zero-touch behavior therefore has two layers.

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

Zero-touch architecture exists to close the gap between the current protocol and that goal.

## Repo Layer

- `HOLISTIC.md`, `AGENTS.md`, project history, and regression watch stay inside the repo so any agent that reads repo instructions can recover context.
- This layer travels with git and works cross-agent as long as the tool respects repo-visible instructions.
- The portable expectation is that handoff docs get committed and synced so another device can continue later.

## Machine Layer

- A background Holistic daemon can watch the repo and create passive checkpoints without you manually starting a session.
- Generated restore scripts can pull the dedicated Holistic state branch into the working tree when it is safe to do so.
- This is the only realistic way to get close to seamless cross-tool capture when apps do not expose a startup hook.
- It requires a one-time machine install or service registration outside the repo.

## Hard Limit

- If a tool ignores repo instructions and there is no daemon or app integration, the repo alone cannot make that tool participate.
- Holistic can preserve memory and offer recovery, but it cannot force arbitrary apps to cooperate from inside git-tracked files.

## Current Recommendation

- Keep using repo-visible memory as the portable source of truth.
- Treat the dedicated Holistic state branch as the clean cross-device distribution channel for that memory.
- Add the Holistic daemon as the passive capture layer on devices where you want unattended local capture.
- Add app-specific integrations when a tool exposes startup hooks or slash-command automation.
- Prefer workflow-disappearance improvements over adding more visible user ceremony.

Project: holistic
Updated: 2026-03-20T22:24:49.716Z
