# Stack Research

**Domain:** Agent runtime supervision dashboard  
**Researched:** 2026-04-29  
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js + TypeScript | Current repo standard | API/services/test tooling | Already the product baseline; lowest integration risk |
| SQLite (`node:sqlite`) | Current repo standard | Durable local telemetry store | Existing runtime and legacy Andon tables already depend on it |
| React + Vite | Current repo standard | Mission Control UI | Existing dashboard architecture; fast iteration for glanceability work |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SSE (`EventSource`) | Built-in browser API | Live updates from API to dashboard | Keep for low-latency board refresh without polling spikes |
| Native CSS custom properties | Existing | Status/system tokens | Keep visual language consistent while increasing signal hierarchy |
| Existing test runner (`tests/run-tests.ts`) | Existing | Regression coverage | Required for stuck-state and stale-objective prevention tests |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Holistic + Andon local dev scripts | Run API/dashboard together | Must verify runtime truth path after every state-model change |
| GSD planning workflow | Milestone docs + execution tracking | Use for requirements/roadmap/phase sequencing |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| SQLite local-first | External hosted telemetry DB | Only if multi-tenant cross-host supervision becomes required |
| SSE | WebSockets | If bi-directional real-time control channel is introduced |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Legacy-only session/event inference for live status | Causes stale objective/status drift | Runtime session/process/event truth model |
| Agent-name hard defaults (`codex`) | Mislabels actual runtime ownership | Runtime/source attribution with explicit unknown/disconnected states |

## Sources

- Existing repo implementation (`services/andon-api`, `services/runtime-service`, `apps/andon-dashboard`)
- Existing canon docs (`.planning/CANON-LAYERS.md`, `docs/andon-mvp.md`)

---
*Stack research for: runtime-truth Andon supervision*
