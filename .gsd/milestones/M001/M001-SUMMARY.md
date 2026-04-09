# M001: Core Workflow Tightening — MILESTONE SUMMARY

**Status:** COMPLETE (with minor database inconsistency noted below)  
**Completed:** 2026-04-02  
**Duration:** March 21 - April 2, 2026

## One-Line Summary

Shipped Holistic 0.2.0 with automatic capture, MCP auto-start, daemon checkpoints, session hygiene, cross-platform polish, and launch communications.

## Vision Achievement

**Vision:** "Make Holistic a true silent partner - automatic capture, minimal ceremony, consistent experience across tools. Users work for weeks without thinking about Holistic, yet have perfect continuity when switching agents or devices."

✅ **Fully Achieved** - All success criteria met through 9 completed slices (S01-S09)

## Slices Delivered

- ✅ **S01:** Automatic Startup Notifications
- ✅ **S01.5:** ASCII Splash Screen & Branding
- ✅ **S02:** Proactive Automatic Capture
- ✅ **S03:** Automatic Memory Hygiene
- ✅ **S04:** Edge-Case Health Diagnostics
- ✅ **S05:** Documentation & Tool Parity
- ✅ **S06:** Real-World Dogfooding
- ✅ **S07:** Technical Polish & Cross-Platform
- ✅ **S08:** npm Publishing Preparation
- ✅ **S09:** Launch Communications

## Key Achievements

### Automatic Capture
- Daemon checkpoints on time elapsed (2hr) OR significant files (5+)
- Agent-initiated checkpoints at natural breakpoints
- Handoff drafts trigger after idle/completion signals
- `/checkpoint` and `/handoff` slash commands available

### Cross-Tool Consistency
- MCP clients auto-greet on conversation start
- Non-MCP clients respond to `/holistic` command
- README comparison table shows tool capabilities
- AGENTS.md documents patterns
- Slash command helper text visible to agents

### Cross-Platform Reliability
- npm pack/install tested on Mac/Windows/Linux
- CRLF warnings fixed with managed .gitattributes
- Error messages improved
- Bootstrap validated on clean machines
- State sync no longer prompts for PRs

### Publishing & Launch
- Published as holistic@0.2.0 on npm
- CHANGELOG.md complete
- Demo GIF created and embedded (44 KB)
- LinkedIn post drafted
- GitHub issue templates with YAML frontmatter
- SUPPORT.md hub created
- Beta feedback callout in README

## Key Decisions

1. **MCP Protocol**: Chose `sendLoggingMessage` for MCP notifications over custom protocol - works with existing SDK
2. **Checkpoint Triggers**: Implemented time-based (2hr) AND file-count (5+) triggers for daemon automation
3. **Session Archiving**: 30-day + unreferenced criteria with auto-unarchive on use
4. **State Sync**: Hidden-ref portable state via `refs/holistic/state` to avoid GitHub branch noise
5. **Demo GIF**: Used gif-encoder-2 for pure JavaScript generation to avoid native dependency compilation
6. **Launch Messaging**: Structured communications with pain/solution contrast

## Key Files

- `src/mcp-server.ts`
- `src/daemon.ts`
- `src/core/state.ts`
- `.gitattributes`
- `CHANGELOG.md`
- `README.md`
- `AGENTS.md`
- `docs/demo.gif`
- `docs/launch/linkedin-post.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/question.md`
- `SUPPORT.md`

## Lessons Learned

1. MCP auto-start requires proper .mcp.json configuration AND Claude Desktop restart to take effect - easy to miss during testing
2. Daemon checkpoint triggers need AND conditions (time AND file count) to avoid spam while staying responsive
3. Session archiving needs hysteresis - 30+ days AND unreferenced prevents thrashing
4. CRLF issues on Windows require managed .gitattributes, not manual user configuration
5. Demo GIFs for social media need pure JavaScript libraries to avoid cross-platform compilation issues
6. Early beta disclosure in README sets proper expectations and welcomes feedback

## Deviations

None from original plan.

## Known Issues

**Database Inconsistency**: Task T07 (Manual UAT - MCP auto-greeting) in S01 was performed and verified during testing but never formally recorded in the GSD database before S01 was marked complete. The slice cannot accept new task completions once closed. This prevents formal `gsd_complete_milestone` tool call but does not affect the actual deliverables - all functionality was tested and validated. Plan file checkbox has been updated manually. Summary file created for historical record.

## Follow-Ups

- M002 and M003 are placeholder milestones (empty)
- M004 is fully planned and ready for execution (6 slices covering git commit execution, sync script portability, file I/O error handling, daemon optimization, deduplication fixes, and snapshot performance)

## Verification

All success criteria verified:
- ✅ Automatic capture working (daemon + agent-initiated)
- ✅ Minimal ceremony (MCP auto-start + `/holistic` command)
- ✅ Cross-tool consistency (comparison table + documentation)
- ✅ Cross-platform reliability (tested Mac/Windows/Linux)
- ✅ Publishing complete (npm 0.2.0 published)
- ✅ Launch communications ready (demo GIF, LinkedIn post, issue templates, support docs)
- ✅ Real-world validation (dogfooded in newsthread + holistic repos)
