import fs from "node:fs";
import path from "node:path";
import { renderCliFallbackNote } from './cli-fallback.ts';
import { readArchivedSessions } from './state.ts';
import type { HolisticState, ImpactNote, RegressionRisk, RuntimePaths, SessionRecord, ValidationItem } from './types.ts';

function renderSessionCloseBlock(hasMcp: boolean): string {
  if (hasMcp) {
    return `## Before ending this session\n\nCall \`holistic_handoff\` with a summary of what you did and what should happen next. This keeps repo memory current for the next agent.\n`;
  }
  return `## Before ending this session\n\nRun:\n\`\`\`\nholistic handoff --summary "..." --next "..."\n\`\`\`\nThis keeps repo memory current for the next agent.\n`;
}

function renderList(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return `- ${emptyText}`;
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function renderStructuredImpacts(impacts: ImpactNote[]): string {
  return impacts.map((impact) => {
    let line = `- ${impact.description}`;
    const metadata: string[] = [];
    if (impact.severity) {
      metadata.push(`severity: ${impact.severity}`);
    }
    if (impact.affectedAreas && impact.affectedAreas.length > 0) {
      metadata.push(`areas: ${impact.affectedAreas.join(", ")}`);
    }
    if (impact.outcome) {
      metadata.push(`outcome: ${impact.outcome}`);
    }
    if (metadata.length > 0) {
      line += ` _[${metadata.join(" | ")}]_`;
    }
    return line;
  }).join("\n");
}

function renderValidationChecklist(items: ValidationItem[]): string {
  return items.map((item) => {
    let line = `  - ${item.description}`;
    if (item.command) {
      line += `\n    - Command: \`${item.command}\``;
    }
    if (item.expectedOutcome) {
      line += `\n    - Expected: ${item.expectedOutcome}`;
    }
    return line;
  }).join("\n");
}

function renderStructuredRegressions(regressions: RegressionRisk[]): string {
  return regressions.map((risk) => {
    let line = `- ${risk.description}`;
    const metadata: string[] = [];
    if (risk.severity) {
      metadata.push(`severity: ${risk.severity}`);
    }
    if (risk.affectedAreas && risk.affectedAreas.length > 0) {
      metadata.push(`areas: ${risk.affectedAreas.join(", ")}`);
    }
    if (metadata.length > 0) {
      line += ` _[${metadata.join(" | ")}]_`;
    }
    if (risk.validationChecklist && risk.validationChecklist.length > 0) {
      line += `\n  - Validation checklist:\n${renderValidationChecklist(risk.validationChecklist)}`;
    }
    return line;
  }).join("\n");
}

function currentSnapshot(state: HolisticState): {
  title: string;
  goal: string;
  status: string;
  tried: string[];
  next: string[];
  assumptions: string[];
  blockers: string[];
  refs: string[];
  impacts: string[];
  regressions: string[];
  changedFiles: string[];
  plan: string[];
  session: SessionRecord | null;
} {
  if (state.activeSession) {
    const session = state.activeSession;
    return {
      title: session.title,
      goal: session.currentGoal,
      status: session.latestStatus,
      tried: session.triedItems,
      next: session.nextSteps,
      assumptions: session.assumptions,
      blockers: session.blockers,
      refs: session.references,
      impacts: session.impactNotes,
      regressions: session.regressionRisks,
      changedFiles: session.changedFiles,
      plan: session.currentPlan,
      session,
    };
  }

  return {
    title: state.lastHandoff ? "Resume from last handoff" : "Ready for work",
    goal: state.lastHandoff?.nextAction || "Review recent repo activity and decide what to work on.",
    status: state.lastHandoff?.summary || "Holistic is set up and tracking this repo.",
    tried: [],
    next: state.lastHandoff ? [state.lastHandoff.nextAction] : [],
    assumptions: [],
    blockers: state.lastHandoff?.blockers || [],
    refs: [],
    impacts: [],
    regressions: [],
    changedFiles: [],
    plan: [],
    session: null,
  };
}

function parseKnownFixes(regressions: string[]): { fixes: string[]; other: string[] } {
  const fixes: string[] = [];
  const other: string[] = [];
  for (const r of regressions) {
    if (r.startsWith("[FIX] ")) {
      fixes.push(r);
    } else {
      other.push(r);
    }
  }
  return { fixes, other };
}

function renderKnownFixes(fixes: string[]): string {
  if (fixes.length === 0) {
    return "";
  }
  const items = fixes.map((fix) => {
    // Format: [FIX] <description> | files: <files> | risk: <risk>
    const withoutPrefix = fix.slice("[FIX] ".length);
    const parts = withoutPrefix.split(" | ");
    const description = parts[0] ?? withoutPrefix;
    const filesPart = parts.find((p) => p.startsWith("files: "));
    const riskPart = parts.find((p) => p.startsWith("risk: "));
    let entry = `- ${description}`;
    if (filesPart) {
      entry += `\n  Sensitive files: ${filesPart.slice("files: ".length)}`;
    }
    if (riskPart) {
      entry += `\n  Risk: ${riskPart.slice("risk: ".length)}`;
    }
    return entry;
  }).join("\n");
  return `## Known Fixes - Do Not Regress

⚠️  If you are about to edit a file listed here, STOP and read the fix entry first.

${items}

`;
}

function renderHolisticMd(state: HolisticState): string {
  const snapshot = currentSnapshot(state);
  const pendingPreview = state.pendingWork.slice(0, 5);
  const resumeFallbackNote = renderCliFallbackNote(state.docIndex.contextDir, "resume --agent <your-agent-name>");
  const adapterLinks = Object.entries(state.docIndex.adapterDocs)
    .map(([name, target]) => `- ${name}: [${target}](${target})`)
    .join("\n");

  const { fixes, other: otherRegressions } = parseKnownFixes(snapshot.regressions);
  const knownFixesBlock = renderKnownFixes(fixes);

  return `# HOLISTIC

<!-- ═══════════════════════════════════════════════════════════════════════
     AGENT INSTRUCTIONS - READ THIS ENTIRE FILE BEFORE DOING ANYTHING ELSE
     ═══════════════════════════════════════════════════════════════════════

  1. Read this file top-to-bottom.
  2. Read AGENTS.md for the setup steps specific to your agent.
  3. Summarise to the user: what was last worked on, what's planned next.
  4. Ask: "What would you like to work on - continue recent work, or start something new?"
  5. Open the session with the repo-local Holistic helper for this repo.

  ⚠️  If you are about to edit a file listed under KNOWN FIXES, STOP and
     read that fix entry carefully before proceeding.
  ════════════════════════════════════════════════════════════════════════ -->

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

${resumeFallbackNote}

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

That is the intended end state for this project. Prefer changes that reduce ceremony, keep continuity durable, and make Holistic fade further into the background of normal work.

${knownFixesBlock}## Current Objective

**${snapshot.title}**

${snapshot.goal}

## Latest Work Status

${snapshot.status}

## What Was Tried

${renderList(snapshot.tried, "Nothing recorded yet.")}

## What To Try Next

${renderList(snapshot.next, "Ask the user what they'd like to work on.")}

## Active Plan

${renderList(snapshot.plan, "None yet - will be set once work begins.")}

## Overall Impact So Far

${renderList(snapshot.impacts, "Nothing recorded yet.")}

## Regression Watch

${renderList(otherRegressions, "Review the regression watch document before changing related behavior.")}

## Key Assumptions

${renderList(snapshot.assumptions, "None recorded.")}

## Blockers

${renderList(snapshot.blockers, "None.")}

## Changed Files In Current Session

${renderList(snapshot.changedFiles, "No repo changes detected for the active session.")}

## Pending Work Queue

${pendingPreview.length === 0 ? "- None." : pendingPreview.map((item) => `- ${item.title}: ${item.recommendedNextStep}`).join("\n")}

## Long-Term Memory

- Project history: [${state.docIndex.historyDoc}](${state.docIndex.historyDoc})
- Regression watch: [${state.docIndex.regressionDoc}](${state.docIndex.regressionDoc})
- Zero-touch architecture: [${state.docIndex.zeroTouchDoc}](${state.docIndex.zeroTouchDoc})
- Portable sync model: handoffs are intended to be committed and synced so any device with repo access can continue.

## Supporting Documents

- State file: [${state.docIndex.stateFile}](${state.docIndex.stateFile})
- Current plan: [${state.docIndex.currentPlanDoc}](${state.docIndex.currentPlanDoc})
- Session protocol: [${state.docIndex.protocolDoc}](${state.docIndex.protocolDoc})
- Session archive: [${state.docIndex.sessionsDir}](${state.docIndex.sessionsDir})
- Adapter docs:
${adapterLinks}

## Historical Memory

- Last updated: ${state.updatedAt}
- Last handoff: ${state.lastHandoff ? `${state.lastHandoff.summary}` : "None yet."}
- Pending sessions remembered: ${state.pendingWork.length}
`;
}

function renderAgentsMd(state: HolisticState): string {
  const resumeFallbackNote = renderCliFallbackNote(state.docIndex.contextDir, "resume --agent <your-agent-name>");
  const checkpointFallbackNote = renderCliFallbackNote(state.docIndex.contextDir, "checkpoint --reason \"<why>\"");
  const checkpointFixNote = renderCliFallbackNote(state.docIndex.contextDir, "checkpoint --fixed \"<bug>\" --fix-files \"<file>\" --fix-risk \"<what would reintroduce it>\"");
  const handoffFallbackNote = renderCliFallbackNote(state.docIndex.contextDir, "handoff");
  const startNewNote = renderCliFallbackNote(state.docIndex.contextDir, "start-new --goal \"<goal>\"");
  const watchNote = renderCliFallbackNote(state.docIndex.contextDir, "watch");
  return `# AGENTS

<!-- ═══════════════════════════════════════════════════════════════════
     AGENT AUTO-START INSTRUCTIONS
     ═══════════════════════════════════════════════════════════════════

  YOU ARE READING THIS FILE AUTOMATICALLY AT SESSION START. GOOD.
  Now do the following BEFORE responding to the user or doing any work:

  1. Read HOLISTIC.md in full.
  2. Summarise to the user: what was last worked on, what's planned next,
     and flag any KNOWN FIXES they should be aware of.
  3. Ask: "What would you like to work on - continue recent work, or start something new?"
  4. Open the session with the repo-local Holistic helper for this repo.

  DO NOT skip step 1. HOLISTIC.md is the source of truth.
  ══════════════════════════════════════════════════════════════════ -->

## Holistic Protocol

### Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

Agents should treat that as the ultimate UX target. Prefer decisions that reduce manual ceremony while making checkpoint, resume, handoff, and regression-awareness more automatic and more reliable.

Every agent working in this repo should:

1. Read [HOLISTIC.md](./HOLISTIC.md) first.
2. Review [Project History](./.holistic/context/project-history.md), [Regression Watch](./.holistic/context/regression-watch.md), and [Zero-Touch Architecture](./.holistic/context/zero-touch.md) before changing behavior that may already have been fixed.
3. Read the app-specific adapter in \`${state.docIndex.contextDir}/adapters/\`.
4. If the Holistic daemon is installed, assume passive capture is already running in the background.
5. Use the repo-local Holistic helper for explicit recap or recovery flows in this repo.
6. Recap the current state for the user and ask whether to continue, tweak the plan, or start something new.
7. Record a checkpoint when focus changes, before likely context compaction, and before handoff.

${resumeFallbackNote}

## Handoff Commands

- ${checkpointFallbackNote.slice(3)}
- ${checkpointFixNote.slice(3)}
- \`holistic set-phase --phase "<id>" --name "<name>" --goal "<goal>"\`
- \`holistic complete-phase --phase "<id>" --next-phase "<id>" --next-name "<name>" --next-goal "<goal>"\`
- ${handoffFallbackNote.slice(3)}
- ${startNewNote.slice(3)}
- ${watchNote.slice(3)}

## Before Ending a Session

${renderSessionCloseBlock(false)}
## Adding a New Agent Adapter

To add instructions for a new agent, create a file at:

\`${state.docIndex.contextDir}/adapters/<agent-name>.md\`

Copy any existing adapter as a template and customise the agent name and startup steps.
Do not edit Holistic source files to register agents - adapters are data, not code.
`;
}

function renderContextReadme(state: HolisticState): string {
  return `# Holistic Context

This folder holds repo-visible memory that any agent can reuse.

- [Current Plan](./current-plan.md)
- [Session Protocol](./session-protocol.md)
- [Project History](./project-history.md)
- [Regression Watch](./regression-watch.md)
- [Zero-Touch Architecture](./zero-touch.md)
- [Codex Adapter](./adapters/codex.md)
- [Claude/Cowork Adapter](./adapters/claude-cowork.md)
- [Antigravity Adapter](./adapters/antigravity.md)

Project: ${state.projectName}
Updated: ${state.updatedAt}
`;
}

function renderCurrentPlan(state: HolisticState): string {
  const snapshot = currentSnapshot(state);
  return `# Current Plan

## Goal

${snapshot.goal}

## Latest Status

${snapshot.status}

## Planned Next Steps

${renderList(snapshot.plan.length > 0 ? snapshot.plan : snapshot.next, "No plan captured yet.")}

## Project Impact

${renderList(snapshot.impacts, "No impact notes captured yet.")}

## References

${renderList(snapshot.refs, "No linked references yet.")}
`;
}

function renderProtocol(state: HolisticState): string {
  const resumeFallbackNote = renderCliFallbackNote(state.docIndex.contextDir, "resume --agent <app>");
  const checkpointFallbackNote = renderCliFallbackNote(state.docIndex.contextDir, "checkpoint --reason \"<what changed>\"");
  const handoffFallbackNote = renderCliFallbackNote(state.docIndex.contextDir, "handoff");
  return `# Session Protocol

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

The protocol below is the current operating model, not the final ideal. When improving Holistic, prefer changes that make more of this protocol happen automatically without weakening durable continuity.

## Startup

1. Read \`HOLISTIC.md\`.
2. Review \`project-history.md\`, \`regression-watch.md\`, and \`zero-touch.md\` for durable project memory and automation expectations.
3. If the Holistic daemon is installed, let it capture repo activity in the background.
4. Use the repo-local Holistic helper for explicit recap or recovery flows in this repo.
5. Recap the work state to the user.
6. Ask whether to continue as planned, tweak the plan, or start something new.

${resumeFallbackNote}

## During The Session

Use the repo-local Holistic helper for checkpoints in this repo:

- when the task focus changes
- before likely context compaction
- after meaningful progress
- when you fix something another agent might accidentally re-break later

Use the repo-local Holistic helper with \`watch\` if you want foreground background checkpoints while working manually.

${checkpointFallbackNote}

## Handoff

1. Use the repo-local Holistic helper to run \`handoff\`.
2. Confirm or edit the drafted summary.
3. Make sure the next step, impact, and regression risks are accurate.
4. Let Holistic write the docs and prepare the handoff commit.
5. If you want the handoff docs committed, make that git commit explicitly.
6. Holistic sync helpers should mirror portable state to the dedicated portable state ref without pushing your working branch.
7. If you continue on another device, pull or restore the latest portable state before starting work.

${handoffFallbackNote}
`;
}

interface AdapterProfile {
  appName: string;
  commandName: string;
  hasMcp: boolean;
  toolingNotes: string[];
  startupNotes: string[];
  checkpointNotes: string[];
  handoffNotes: string[];
}

function renderAdapter(state: HolisticState, profile: AdapterProfile): string {
  const { appName, commandName, hasMcp, toolingNotes, startupNotes, checkpointNotes, handoffNotes } = profile;
  const resumeFallbackNote = renderCliFallbackNote(state.docIndex.contextDir, `resume --agent ${commandName}`);
  const checkpointFallbackNote = renderCliFallbackNote(state.docIndex.contextDir, "checkpoint --reason \"<what changed>\"");
  const handoffFallbackNote = renderCliFallbackNote(state.docIndex.contextDir, "handoff");
  return `# ${appName} Adapter

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

Use this adapter to move toward that outcome: less manual setup, less re-briefing, and more continuity preserved by default.

## Tool-Specific Notes

${renderList(toolingNotes, "No tool-specific notes recorded.")}

## Startup Contract

1. Read \`HOLISTIC.md\`.
2. Review \`project-history.md\`, \`regression-watch.md\`, and \`zero-touch.md\` for durable memory before editing related code.
3. If the Holistic daemon is installed, treat passive session capture as already active.
4. Use the repo-local Holistic helper when you need an explicit recap or recovery flow.
5. Recap the current state for the user in the first 30 seconds.
6. Ask: continue as planned, tweak the plan, or start something new.

### Startup Notes For ${appName}

${renderList(startupNotes, "Use the default startup contract.")}

${resumeFallbackNote}

## Checkpoint Contract

Use the repo-local Holistic helper for checkpoints in this repo when:

- the task focus changes
- you are about to compact or clear context
- you finish a meaningful chunk of work
- you fix or alter behavior that could regress later

Include impact notes and regression risks when they matter.

### Checkpoint Notes For ${appName}

${renderList(checkpointNotes, "Use the default checkpoint contract.")}

${checkpointFallbackNote}

## Handoff Contract

- Preferred: map your session-end workflow to the repo-local Holistic helper with \`handoff\`
- Fallback: ask the user to run the repo-local Holistic helper with \`handoff\` before leaving the session

### Handoff Notes For ${appName}

${renderList(handoffNotes, "Use the default handoff contract.")}

${handoffFallbackNote}

${renderSessionCloseBlock(hasMcp)}`;
}

const ADAPTER_PROFILES: AdapterProfile[] = [
  {
    appName: "Codex",
    commandName: "codex",
    hasMcp: false,
    toolingNotes: [
      "Codex is usually repo-instruction driven, so the first prompt matters more than custom app hooks.",
      "Prefer explicit Holistic recap commands before large context shifts or fresh chat starts.",
    ],
    startupNotes: [
      "Use the repo-local resume helper early in a fresh Codex chat so the recap lands before implementation starts.",
      "If the chat is already deep, checkpoint first before asking Codex to compact or pivot.",
    ],
    checkpointNotes: [
      "Checkpoint before asking Codex to refactor broadly or touch multiple subsystems in one pass.",
    ],
    handoffNotes: [
      "Treat the handoff as the durable replacement for a long final Codex recap message.",
    ],
  },
  {
    appName: "Claude/Cowork",
    commandName: "claude",
    hasMcp: true,
    toolingNotes: [
      "Claude/Cowork can use Holistic through MCP-style tool calls when available.",
      "When MCP is active, prefer Holistic tools over free-form summaries for startup and session close.",
    ],
    startupNotes: [
      "Use \`holistic_resume\` or the mapped startup hook instead of manually reconstructing prior work.",
      "Let the initial recap shape the first answer before editing code.",
    ],
    checkpointNotes: [
      "Checkpoint after meaningful implementation slices, especially before asking Claude to branch into analysis-heavy discussion.",
    ],
    handoffNotes: [
      "Prefer \`holistic_handoff\` when the tool is available so the handoff fields stay structured.",
    ],
  },
  {
    appName: "Antigravity",
    commandName: "antigravity",
    hasMcp: false,
    toolingNotes: [
      "Antigravity sessions tend to benefit from concise startup context and explicit next-step framing.",
    ],
    startupNotes: [
      "Read the Holistic recap before steering Antigravity toward a new plan or implementation pass.",
    ],
    checkpointNotes: [
      "Checkpoint before switching from exploration to execution so the inferred next step stays current.",
    ],
    handoffNotes: [
      "Keep handoffs concrete: summary, next step, and regression risk are more useful than a long narrative.",
    ],
  },
  {
    appName: "Gemini",
    commandName: "gemini",
    hasMcp: false,
    toolingNotes: [
      "Gemini should use repo-visible docs first: \`HOLISTIC.md\`, \`GEMINI.md\`, and the Holistic context folder.",
      "Treat \`GEMINI.md\` as the app-local companion to the shared Holistic memory.",
    ],
    startupNotes: [
      "Open with the shared Holistic recap, then align Gemini-specific behavior from \`GEMINI.md\`.",
    ],
    checkpointNotes: [
      "Checkpoint when Gemini is about to pivot from research to edits or from one subsystem to another.",
    ],
    handoffNotes: [
      "Use the handoff to leave a crisp resume point for the next non-Gemini agent too, not just Gemini.",
    ],
  },
  {
    appName: "GitHub Copilot",
    commandName: "copilot",
    hasMcp: false,
    toolingNotes: [
      "Copilot should pick up repo guidance from \`.github/copilot-instructions.md\` alongside the shared Holistic docs.",
      "Keep Holistic as the continuity layer and Copilot instructions as the tool-specific behavior layer.",
    ],
    startupNotes: [
      "Review \`.github/copilot-instructions.md\` after the Holistic recap so Copilot gets both continuity and local coding rules.",
    ],
    checkpointNotes: [
      "Checkpoint after multi-file edits so Copilot sessions do not lose why a change set exists.",
    ],
    handoffNotes: [
      "End with a real handoff instead of relying on editor chat history surviving between Copilot sessions.",
    ],
  },
  {
    appName: "Cursor",
    commandName: "cursor",
    hasMcp: false,
    toolingNotes: [
      "Cursor should combine Holistic repo memory with project-level editor rules from \`.cursorrules\`.",
      "Use Holistic for continuity and \`.cursorrules\` for Cursor-specific operating guidance.",
    ],
    startupNotes: [
      "Read the Holistic recap before acting on workspace-wide Cursor suggestions or agent mode plans.",
    ],
    checkpointNotes: [
      "Checkpoint before large agent-mode edits so the repo keeps a durable explanation of intent.",
    ],
    handoffNotes: [
      "Do not assume Cursor chat history is enough; finish with a Holistic handoff when ending the session.",
    ],
  },
  {
    appName: "Goose",
    commandName: "goose",
    hasMcp: false,
    toolingNotes: [
      "Goose is terminal-first, so explicit repo-local commands fit naturally here.",
      "Prefer concrete CLI invocations over implicit editor state when refreshing continuity.",
    ],
    startupNotes: [
      "Run the repo-local resume helper early in the shell session so Goose starts from the shared recap.",
    ],
    checkpointNotes: [
      "Checkpoint after command-driven milestones, especially before longer shell sequences or tool handoffs.",
    ],
    handoffNotes: [
      "Use the handoff before closing the shell or moving to another machine so command history is not the only trace.",
    ],
  },
  {
    appName: "GSD",
    commandName: "gsd",
    hasMcp: false,
    toolingNotes: [
      "GSD has its own planning and workflow artifacts; Holistic should complement them, not replace them.",
      "Use Holistic for cross-agent continuity and GSD for execution structure inside a session.",
    ],
    startupNotes: [
      "Start from the Holistic recap, then align against any active GSD milestone, slice, or task files.",
    ],
    checkpointNotes: [
      "Checkpoint when a GSD slice changes direction or when work crosses from one task context into another.",
    ],
    handoffNotes: [
      "Keep the handoff focused on what the next agent needs to resume, even if fuller detail exists in GSD artifacts.",
    ],
  },
  {
    appName: "GSD2",
    commandName: "gsd2",
    hasMcp: false,
    toolingNotes: [
      "GSD2 should be treated as a distinct workflow surface, not an alias of GSD.",
      "Use Holistic as the shared continuity layer across GSD2 sessions and across non-GSD2 agents touching the same repo.",
    ],
    startupNotes: [
      "Load Holistic context first, then reconcile it with any GSD2-native state or workflow entrypoint.",
    ],
    checkpointNotes: [
      "Checkpoint when GSD2 changes execution mode, task boundary, or planned next step.",
    ],
    handoffNotes: [
      "Write handoffs for the next agent, not just for the next GSD2 runtime instance.",
    ],
  },
];

function renderProjectHistory(paths: RuntimePaths, state: HolisticState): string {
  const sessions = state.activeSession ? [state.activeSession, ...readArchivedSessions(paths)] : readArchivedSessions(paths);
  const body = sessions.length === 0
    ? "No archived sessions yet. Use handoffs to build durable project history."
    : sessions.map((session) => {
        let sessionBlock = `## ${session.title}\n\n- Session: ${session.id}\n- Agent: ${session.agent}\n- Status: ${session.status}\n- When: ${session.endedAt || session.updatedAt}\n- Goal: ${session.currentGoal}`;
        
        // Add structured metadata if present
        if (session.severity) {
          sessionBlock += `\n- Severity: ${session.severity}`;
        }
        if (session.outcomeStatus) {
          sessionBlock += `\n- Outcome: ${session.outcomeStatus}`;
        }
        if (session.affectedAreas && session.affectedAreas.length > 0) {
          sessionBlock += `\n- Affected areas: ${session.affectedAreas.join(", ")}`;
        }
        if (session.relatedSessions && session.relatedSessions.length > 0) {
          sessionBlock += `\n- Related sessions: ${session.relatedSessions.join(", ")}`;
        }
        
        sessionBlock += `\n- Summary: ${session.latestStatus}\n- Work done:\n${renderList(session.workDone, "No completed work recorded.")}`;
        
        // Use structured impacts if available, fall back to plain text
        if (session.impactNotesStructured && session.impactNotesStructured.length > 0) {
          sessionBlock += `\n- Why it mattered:\n${renderStructuredImpacts(session.impactNotesStructured)}`;
        } else {
          sessionBlock += `\n- Why it mattered:\n${renderList(session.impactNotes, "No impact notes recorded.")}`;
        }
        
        // Use structured regressions if available, fall back to plain text
        if (session.regressionRisksStructured && session.regressionRisksStructured.length > 0) {
          sessionBlock += `\n- Regression risks:\n${renderStructuredRegressions(session.regressionRisksStructured)}`;
        } else {
          sessionBlock += `\n- Regression risks:\n${renderList(session.regressionRisks, "No specific regression risks recorded.")}`;
        }
        
        sessionBlock += `\n- References:\n${renderList(session.references, "No references recorded.")}\n`;
        
        return sessionBlock;
      }).join("\n");

  return `# Project History\n\nThis archive is the durable memory of what agents changed, why they changed it, and what the project impact was. Review it before revisiting a feature area.\n\n${body}\n`;
}

function renderRegressionWatch(paths: RuntimePaths, state: HolisticState): string {
  const sessions = (state.activeSession ? [state.activeSession, ...readArchivedSessions(paths)] : readArchivedSessions(paths))
    .filter((session) => session.regressionRisks.length > 0 || session.regressionRisksStructured?.length || session.impactNotes.length > 0 || session.impactNotesStructured?.length || session.workDone.length > 0);
  const body = sessions.length === 0
    ? "No regression watch items yet. Add them during checkpoints and handoffs when a change must stay fixed."
    : sessions.map((session) => {
        let sessionBlock = `## ${session.title}\n\n- Goal: ${session.currentGoal}`;
        
        // Add structured metadata if present
        if (session.severity) {
          sessionBlock += `\n- Severity: ${session.severity}`;
        }
        if (session.affectedAreas && session.affectedAreas.length > 0) {
          sessionBlock += `\n- Affected areas: ${session.affectedAreas.join(", ")}`;
        }
        if (session.relatedSessions && session.relatedSessions.length > 0) {
          sessionBlock += `\n- Related sessions: ${session.relatedSessions.join(", ")}`;
        }
        
        sessionBlock += `\n- Durable changes:\n${renderList(session.workDone, "No durable changes recorded.")}`;
        
        // Use structured impacts if available, fall back to plain text
        if (session.impactNotesStructured && session.impactNotesStructured.length > 0) {
          sessionBlock += `\n- Why this matters:\n${renderStructuredImpacts(session.impactNotesStructured)}`;
        } else {
          sessionBlock += `\n- Why this matters:\n${renderList(session.impactNotes, "No impact notes recorded.")}`;
        }
        
        // Use structured regressions if available, fall back to plain text
        if (session.regressionRisksStructured && session.regressionRisksStructured.length > 0) {
          sessionBlock += `\n- Do not regress:\n${renderStructuredRegressions(session.regressionRisksStructured)}`;
        } else {
          sessionBlock += `\n- Do not regress:\n${renderList(session.regressionRisks, "No explicit regression risk recorded.")}`;
        }
        
        sessionBlock += `\n- Source session: ${session.id}\n`;
        
        return sessionBlock;
      }).join("\n");

  return `# Regression Watch\n\nUse this before changing existing behavior. It is the short list of fixes and outcomes that future agents should preserve.\n\n${body}\n`;
}

function renderZeroTouchDoc(state: HolisticState): string {
  return `# Zero-Touch Architecture

Holistic cannot force every app or agent to execute startup logic just because a repo exists. Zero-touch behavior therefore has two layers.

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

Zero-touch architecture exists to close the gap between the current protocol and that goal.

## Repo Layer

- \`HOLISTIC.md\`, \`AGENTS.md\`, project history, and regression watch stay inside the repo so any agent that reads repo instructions can recover context.
- This layer travels with git and works cross-agent as long as the tool respects repo-visible instructions.
- The portable expectation is that handoff docs get committed and synced so another device can continue later.

## Machine Layer

- A background Holistic daemon can watch the repo and create passive checkpoints without you manually starting a session.
- Generated restore scripts can pull the dedicated Holistic portable state ref into the working tree when it is safe to do so.
- This is the only realistic way to get close to seamless cross-tool capture when apps do not expose a startup hook.
- It requires a one-time machine install or service registration outside the repo.

## Hard Limit

- If a tool ignores repo instructions and there is no daemon or app integration, the repo alone cannot make that tool participate.
- Holistic can preserve memory and offer recovery, but it cannot force arbitrary apps to cooperate from inside git-tracked files.

## Current Recommendation

- Keep using repo-visible memory as the portable source of truth.
- Treat the dedicated Holistic portable state ref as the clean cross-device distribution channel for that memory.
- Add the Holistic daemon as the passive capture layer on devices where you want unattended local capture.
- Add app-specific integrations when a tool exposes startup hooks or slash-command automation.
- Holistic should recognize workflow systems, not become one.
- Prefer lightweight workflow context references over baking phases, slices, or other planning structures into the core product.
- Prefer workflow-disappearance improvements over adding more visible user ceremony.

Project: ${state.projectName}
Updated: ${state.updatedAt}
`;
}

function renderIdeCursorRulesContent(state: HolisticState): string {
  const snapshot = currentSnapshot(state);
  const { fixes, other: otherRegressions } = parseKnownFixes(snapshot.regressions);
  const resumeCmd = renderCliFallbackNote(state.docIndex.contextDir, "resume --agent cursor");
  const handoffCmd = renderCliFallbackNote(state.docIndex.contextDir, "handoff");

  const fixLines = fixes.length > 0
    ? `## Do Not Regress - Known Fixes\n\n${fixes.map((f) => `- ${f}`).join("\n")}\n`
    : "";
  const regressionLines = otherRegressions.length > 0
    ? `## Regression Watch\n\n${otherRegressions.map((r) => `- ${r}`).join("\n")}\n`
    : "";

  return `# Holistic - ${state.projectName}

## Session Start

At the start of every session, before doing anything else:
1. Read \`HOLISTIC.md\` in full.
2. Read \`AGENTS.md\`.
3. Summarise to the user: what was last worked on, what's planned next, and any known fixes to protect.
4. Ask: "Continue as planned, tweak the plan, or do something different?"
5. ${resumeCmd}

## Current Objective

${snapshot.goal}

## Latest Status

${snapshot.status}

${fixLines}${regressionLines}${renderSessionCloseBlock(false)}`;
}

function renderCursorRules(state: HolisticState): string {
  return renderIdeCursorRulesContent(state);
}

function renderWindsurfRules(state: HolisticState): string {
  return renderIdeCursorRulesContent(state);
}

function renderCopilotInstructions(state: HolisticState): string {
  return renderIdeCursorRulesContent(state);
}

function renderRootAgentDoc(agentName: string, commandName: string, hasMcp: boolean): string {
  return `## Holistic - cross-agent session tracking

**At the start of every session, before doing anything else:**
1. Read \`HOLISTIC.md\` in full.
2. Read \`AGENTS.md\` - find the section for your agent and follow its setup steps.
3. Summarise to the user: what was last worked on, what's planned next, and any known fixes to protect.
4. Ask: "Continue as planned, tweak the plan, or do something different?"
5. Use \`./.holistic/system/holistic resume --agent ${commandName}\` on macOS/Linux or \`.\\.holistic\\system\\holistic.cmd resume --agent ${commandName}\` on Windows to register the session.

**After significant work or on any git commit (hook fires automatically):**
- Run \`holistic checkpoint --reason '<what you just did>'\`
- To record a fix that must not regress: \`holistic checkpoint --fixed '<bug>' --fix-files '<file>' --fix-risk '<what reintroduces it>'\`

**At the end of every session:**
- Run \`holistic handoff\` - this opens a dialog to capture the summary and prepares a pending handoff commit.
- If you want the Holistic files committed, make that git commit explicitly.

**Never touch files listed in the KNOWN FIXES section of HOLISTIC.md without reading that section first.**

${renderSessionCloseBlock(hasMcp)}`;
}

function renderRootHistoryMd(paths: RuntimePaths, state: HolisticState): string {
  const sessions = state.activeSession
    ? [state.activeSession, ...readArchivedSessions(paths)]
    : readArchivedSessions(paths);

  const header = `# History - ${state.projectName}

_Append-only log of every Holistic session. Newest entries at the bottom._

---
`;

  if (sessions.length === 0) {
    return header + "_No sessions recorded yet._\n";
  }

  const entries = [...sessions].reverse().map((session) => {
    const when = session.endedAt || session.updatedAt;
    let entry = `## Session \`${session.id}\` | ${when} | ${session.agent}\n\n`;
    entry += `**Branch:** \`${session.branch}\`  \n`;
    entry += `**Status:** ${session.status}  \n`;
    entry += `**Goal:** ${session.currentGoal || "_unset_"}  \n`;
    entry += `**Checkpoints:** ${session.checkpointCount}\n`;

    if (session.workDone.length > 0) {
      entry += `\n**Work done:**\n${session.workDone.map((w) => `✅ ${w}`).join("\n")}\n`;
    }

    if (session.nextSteps.length > 0) {
      entry += `\n**Recommended next steps:**\n${session.nextSteps.map((s) => `- ${s}`).join("\n")}\n`;
    }

    if (session.changedFiles.length > 0) {
      entry += `\n**Files changed:**\n${session.changedFiles.map((f) => `- \`${f}\``).join("\n")}\n`;
    }

    return entry;
  });

  return header + entries.join("\n---\n\n") + "\n";
}

export function writeDerivedDocs(paths: RuntimePaths, state: HolisticState): void {
  fs.mkdirSync(paths.holisticDir, { recursive: true });
  fs.mkdirSync(paths.contextDir, { recursive: true });
  fs.mkdirSync(paths.adaptersDir, { recursive: true });
  fs.mkdirSync(paths.sessionsDir, { recursive: true });
  fs.writeFileSync(paths.masterDoc, renderHolisticMd(state), "utf8");
  fs.writeFileSync(paths.agentsDoc, renderAgentsMd(state), "utf8");
  fs.writeFileSync(paths.currentPlanDoc, renderCurrentPlan(state), "utf8");
  fs.writeFileSync(paths.protocolDoc, renderProtocol(state), "utf8");
  fs.writeFileSync(paths.historyDoc, renderProjectHistory(paths, state), "utf8");
  fs.writeFileSync(paths.regressionDoc, renderRegressionWatch(paths, state), "utf8");
  fs.writeFileSync(paths.zeroTouchDoc, renderZeroTouchDoc(state), "utf8");
  fs.writeFileSync(`${paths.contextDir}/README.md`, renderContextReadme(state), "utf8");
  for (const profile of ADAPTER_PROFILES) {
    const fileName = profile.commandName === "claude" ? "claude-cowork.md" : `${profile.commandName}.md`;
    fs.writeFileSync(path.join(paths.adaptersDir, fileName), renderAdapter(state, profile), "utf8");
  }
  if (paths.rootClaudeDoc) {
    fs.writeFileSync(paths.rootClaudeDoc, renderRootAgentDoc("Claude/Cowork", "claude", true), "utf8");
  }
  if (paths.rootGeminiDoc) {
    fs.writeFileSync(paths.rootGeminiDoc, renderRootAgentDoc("Gemini", "gemini", false), "utf8");
  }
  if (paths.rootHistoryDoc) {
    fs.writeFileSync(paths.rootHistoryDoc, renderRootHistoryMd(paths, state), "utf8");
  }
  if (paths.rootCursorRulesDoc) {
    fs.writeFileSync(paths.rootCursorRulesDoc, renderCursorRules(state), "utf8");
  }
  if (paths.rootWindsurfRulesDoc) {
    fs.writeFileSync(paths.rootWindsurfRulesDoc, renderWindsurfRules(state), "utf8");
  }
  if (paths.rootCopilotInstructionsDoc) {
    fs.mkdirSync(path.dirname(paths.rootCopilotInstructionsDoc), { recursive: true });
    fs.writeFileSync(paths.rootCopilotInstructionsDoc, renderCopilotInstructions(state), "utf8");
  }
}
