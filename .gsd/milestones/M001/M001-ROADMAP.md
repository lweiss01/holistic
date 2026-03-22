# M001: Core Workflow Tightening

**Vision:** Make Holistic a true "silent partner" - automatic capture, minimal ceremony, consistent experience across tools. Users work for weeks without thinking about Holistic, yet have perfect continuity when switching agents or devices.

## Success Criteria

- MCP-connected agent greets with recap automatically (no user prompting)
- Non-MCP agent starts with `/holistic` one-word command and gets same greeting
- Daemon checkpoints proactively (time intervals, file thresholds, natural breakpoints) instead of only on quiet ticks
- Stale sessions archive automatically based on time + relevance, unarchive when used
- Health warnings surface when automatic capture fails, not when user "forgets" to checkpoint
- Tool comparison table exists showing which tools are automatic vs manual
- All slash commands have visible helper text

## Key Risks / Unknowns

- **MCP notification actionability** - notification may send but agent may not act on it (testing shows it appears in logs but not agent context)
- **Checkpoint spam threshold** - finding right balance between too aggressive (spam) and too conservative (missing important moments)
- **Archive thrashing** - sessions archiving/unarchiving repeatedly if thresholds are wrong
- **Agent instruction adherence** - non-MCP agents may not follow `/holistic` pattern consistently without proper instruction
- **GitHub PR noise from state sync** - same-repo `holistic/state` pushes trigger "Compare & pull request" prompts that would feel confusing in real project repos

## Proof Strategy

- **MCP notification actionability** -> retire in S01 by proving agent greets automatically in fresh Claude Desktop conversation
- **Checkpoint spam threshold** -> retire in S02 by running daemon with real work patterns and verifying checkpoint frequency feels right
- **Archive thrashing** -> retire in S03 by creating test sessions, archiving them, and confirming they don't unarchive spuriously
- **Agent instruction adherence** -> retire in S05 by testing `/holistic` in web-based Claude and verifying agent follows the pattern
- **GitHub PR noise from state sync** -> retire in S07 by validating a same-repo sync strategy that does not leave users with lingering GitHub PR prompts or branch-noise confusion

## Verification Classes

- **Contract verification:** Unit tests for archive logic, checkpoint trigger logic, slash command registration
- **Integration verification:** End-to-end MCP notification test, daemon checkpoint test with real repo changes, archive/unarchive flow test
- **Operational verification:** Run Holistic for 1 week of normal work, verify checkpoints feel natural, no spam, no gaps
- **UAT / human verification:** User starts conversation in Claude Desktop (should auto-greet), user types `/holistic` in web tool (should work same way)

## Milestone Definition of Done

This milestone is complete only when all are true:

- Fresh MCP conversation auto-greets with recap (no user action needed)
- `/holistic` command works in non-MCP tools with same greeting pattern
- Daemon checkpoints happen at meaningful moments (not just quiet ticks)
- 30+ day old unreferenced sessions are in archive subdirectory
- Archived sessions unarchive when explicitly used (diff, handoff reference)
- Health warnings detect daemon/checkpoint failures
- README has tool comparison table (MCP auto vs manual)
- AGENTS.md documents `/holistic` pattern clearly
- All 14 active requirements mapped and validated through slices

## Requirement Coverage

- Covers: R001-R014 (all active requirements)
- Partially covers: none
- Leaves for later: none (M001 is self-contained)
- Orphan risks: none

## Slices

- [x] **S01: Automatic Startup Notifications** `risk:high` `depends:[]`
  > After this: MCP clients auto-greet with recap when conversation starts; non-MCP clients respond to `/holistic` with same pattern; greeting includes last handoff summary + 3-question prompt

- [x] **S01.5: ASCII Splash Screen & Branding** `risk:low` `depends:[S01]`
  > After this: CLI commands show branded ASCII splash on init/bootstrap; README has visual identity; clear value proposition visible in repo

- [ ] **S02: Proactive Automatic Capture** `risk:medium` `depends:[S01]`
  > After this: daemon checkpoints on time elapsed (2hr) OR significant files (5+); agents initiate checkpoints at natural breakpoints in conversation; handoff drafts trigger after 30min idle or completion signals; `/checkpoint` and `/handoff` slash commands available as safety valves

- [ ] **S03: Automatic Memory Hygiene** `risk:low` `depends:[]`
  > After this: sessions >30 days old AND unreferenced move to .holistic/sessions/archive/ automatically; archived sessions move back to active when used in diff/handoff/reference; archive check runs on session start and periodically in daemon

- [ ] **S04: Edge-Case Health Diagnostics** `risk:low` `depends:[S01]`
  > After this: startup notification includes warning if daemon hasn't checkpointed in 3+ days or unusual patterns detected (50+ files, no checkpoint); warnings are diagnostic (system health) not nags (user blame)

- [ ] **S05: Documentation & Tool Parity** `risk:low` `depends:[S01,S02]`
  > After this: README tool comparison table shows which tools support MCP auto vs require `/holistic` manual; AGENTS.md documents `/holistic` pattern with clear instructions; all slash commands have helper text visible to agents

- [ ] **S06: Real-World Dogfooding** `risk:medium` `depends:[S02,S03]`
  > After this: Holistic validated in 2-3 different repos (newsthread Android app, others); rough edges identified and documented; confidence that "set and forget" works in practice with real workflows

- [ ] **S07: Technical Polish & Cross-Platform** `risk:low` `depends:[]`
  > After this: CRLF warnings fixed with proper .gitattributes; npm pack/install tested on Mac/Windows/Linux; error messages are helpful and actionable; bootstrap experience validated on clean machines; same-repo state sync no longer creates confusing GitHub PR/banner prompts for normal project repos

- [x] **S08: npm Publishing Preparation** `risk:low` `depends:[S06,S07]`
  > After this: CHANGELOG.md exists; package.json has proper keywords; README is npm-ready; global install verified; ready for npm publish as 0.2.0

- [ ] **S09: Launch Communications** `risk:low` `depends:[S08]`
  > After this: LinkedIn post drafted; demo GIF/video ready; GitHub README has clear value prop; support plan ready for early adopters; beta feedback mechanism in place

## Boundary Map

### S01 -> S02
Produces:
- `sendResumeNotification()` enhancement - sends actionable notification, not just log message
- `/holistic` slash command handler - triggers same greeting pattern as MCP auto
- `buildStartupGreeting()` - formats last handoff + 3 questions consistently
- MCP notification includes health warnings (if S04 data available)

Consumes: nothing (first slice)

### S01 -> S04
Produces:
- Startup notification delivery mechanism that S04 can inject health warnings into

Consumes: nothing (first slice)

### S01 -> S05
Produces:
- `/holistic` command pattern that S05 needs to document

Consumes: nothing (first slice)

### S02 -> S05
Produces:
- `/checkpoint` and `/handoff` slash commands that S05 needs to document
- Daemon checkpoint trigger logic that S05 can reference in docs

Consumes from S01:
- Slash command infrastructure (if `/holistic` establishes pattern)

### S03 -> (standalone)
Produces:
- `.holistic/sessions/archive/` directory structure
- `archiveStaleSessionsauto()` - runs on session start and daemon tick
- `unarchiveSession()` - automatic when session referenced/used
- Archive rules: 30+ days old AND unreferenced in recent work

Consumes: nothing (standalone, no dependencies)

### S04 -> S01
Produces:
- `buildHealthWarnings()` - detects daemon failures, checkpoint gaps, unusual patterns
- Health warning data structure that S01 injects into startup notification

Consumes from S01:
- Startup notification mechanism to inject warnings into

### S05 -> (documentation)
Produces:
- README tool comparison table (MCP auto vs manual `/holistic`)
- AGENTS.md `/holistic` pattern documentation
- Slash command helper text for `/holistic`, `/checkpoint`, `/handoff`

Consumes from S01:
- `/holistic` command pattern to document

Consumes from S02:
- `/checkpoint` and `/handoff` commands to document
- Daemon trigger logic to explain in docs
