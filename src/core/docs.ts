import fs from "node:fs";
import path from "node:path";
import { readArchivedSessions } from './state.ts';
import type { HolisticState, ImpactNote, RegressionRisk, RuntimePaths, SessionRecord, ValidationItem } from './types.ts';

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
    title: state.lastHandoff ? "Resume from last handoff" : "No active session",
    goal: state.lastHandoff?.nextAction || "Start a new Holistic session.",
    status: state.lastHandoff?.summary || "No active handoff captured yet.",
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
  return `## Known Fixes — Do Not Regress

⚠️  If you are about to edit a file listed here, STOP and read the fix entry first.

${items}

`;
}

function renderHolisticMd(state: HolisticState): string {
  const snapshot = currentSnapshot(state);
  const pendingPreview = state.pendingWork.slice(0, 5);
  const adapterLinks = Object.entries(state.docIndex.adapterDocs)
    .map(([name, target]) => `- ${name}: [${target}](${target})`)
    .join("\n");

  const { fixes, other: otherRegressions } = parseKnownFixes(snapshot.regressions);
  const knownFixesBlock = renderKnownFixes(fixes);

  return `# HOLISTIC

<!-- ═══════════════════════════════════════════════════════════════════════
     AGENT INSTRUCTIONS — READ THIS ENTIRE FILE BEFORE DOING ANYTHING ELSE
     ═══════════════════════════════════════════════════════════════════════

  1. Read this file top-to-bottom.
  2. Read AGENTS.md for the setup steps specific to your agent.
  3. Summarise to the user: what was last worked on, what's planned next.
  4. Ask: "Continue as planned, tweak the plan, or do something different?"
  5. Run \`holistic resume --agent <your-agent-name>\` to open a session.

  ⚠️  If you are about to edit a file listed under KNOWN FIXES, STOP and
     read that fix entry carefully before proceeding.
  ════════════════════════════════════════════════════════════════════════ -->

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

That is the intended end state for this project. Prefer changes that reduce ceremony, keep continuity durable, and make Holistic fade further into the background of normal work.

${knownFixesBlock}## Current Objective

**${snapshot.title}**

${snapshot.goal}

## Latest Work Status

${snapshot.status}

## What Was Tried

${renderList(snapshot.tried, "No tried items captured yet.")}

## What To Try Next

${renderList(snapshot.next, "Run `holistic start-new --goal \"Describe the task\"` to begin capturing work.")}

## Active Plan

${renderList(snapshot.plan, "No active plan has been captured yet.")}

## Overall Impact So Far

${renderList(snapshot.impacts, "No durable impact notes recorded yet.")}

## Regression Watch

${renderList(otherRegressions, "Review the regression watch document before changing related behavior.")}

## Key Assumptions

${renderList(snapshot.assumptions, "No explicit assumptions recorded yet.")}

## Blockers

${renderList(snapshot.blockers, "No blockers recorded.")}

## Changed Files In Current Session

${renderList(snapshot.changedFiles, "No repo changes detected for the active session.")}

## Pending Work Queue

${pendingPreview.length === 0 ? "- No queued work." : pendingPreview.map((item) => `- ${item.title}: ${item.recommendedNextStep}`).join("\n")}

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
- Last handoff: ${state.lastHandoff ? `${state.lastHandoff.summary}` : "No explicit handoff captured yet."}
- Pending sessions remembered: ${state.pendingWork.length}
`;
}

function renderAgentsMd(state: HolisticState): string {
  return `# AGENTS

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
3. Read the app-specific adapter in \`${state.docIndex.contextDir}/adapters/\`.
4. If the Holistic daemon is installed, assume passive capture is already running in the background.
5. Run \`holistic resume --agent <codex|claude|antigravity|gemini|copilot|cursor|goose|gsd>\` only when you need an explicit recap or recovery flow.
6. Recap the current state for the user and ask whether to continue, tweak the plan, or start something new.
7. Record a checkpoint when focus changes, before likely context compaction, and before handoff.

## Handoff Commands

- \`holistic checkpoint --reason "<why>"\`
- \`holistic checkpoint --fixed "<bug>" --fix-files "<file>" --fix-risk "<what would reintroduce it>"\`
- \`holistic handoff\`
- \`holistic start-new --goal "<goal>"\`
- \`holistic watch\`

## Adding a New Agent Adapter

To add instructions for a new agent, create a file at:

\`${state.docIndex.contextDir}/adapters/<agent-name>.md\`

Copy any existing adapter as a template and customise the agent name and startup steps.
Do not edit Holistic source files to register agents — adapters are data, not code.
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

function renderProtocol(): string {
  return `# Session Protocol

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

The protocol below is the current operating model, not the final ideal. When improving Holistic, prefer changes that make more of this protocol happen automatically without weakening durable continuity.

## Startup

1. Read \`HOLISTIC.md\`.
2. Review \`project-history.md\`, \`regression-watch.md\`, and \`zero-touch.md\` for durable project memory and automation expectations.
3. If the Holistic daemon is installed, let it capture repo activity in the background.
4. Run \`holistic resume --agent <app>\` only when you need an explicit recap or recovery flow.
5. Recap the work state to the user.
6. Ask whether to continue as planned, tweak the plan, or start something new.

## During The Session

Run \`holistic checkpoint\`:

- when the task focus changes
- before likely context compaction
- after meaningful progress
- when you fix something another agent might accidentally re-break later

Use \`holistic watch\` if you want foreground background checkpoints while working manually.

## Handoff

1. Run \`holistic handoff\`.
2. Confirm or edit the drafted summary.
3. Make sure the next step, impact, and regression risks are accurate.
4. Let Holistic write the docs and create the handoff commit.\n5. Holistic sync helpers should push the current branch and mirror portable state to the dedicated state branch.\n6. If you continue on another device, pull or restore the latest portable state before starting work.
`;
}

function renderAdapter(appName: string, commandName: string): string {
  return `# ${appName} Adapter

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

Use this adapter to move toward that outcome: less manual setup, less re-briefing, and more continuity preserved by default.

## Startup Contract

1. Read \`HOLISTIC.md\`.
2. Review \`project-history.md\`, \`regression-watch.md\`, and \`zero-touch.md\` for durable memory before editing related code.
3. If the Holistic daemon is installed, treat passive session capture as already active.
4. Run \`holistic resume --agent ${commandName}\` when you need an explicit recap or recovery flow.
5. Recap the current state for the user in the first 30 seconds.
6. Ask: continue as planned, tweak the plan, or start something new.

## Checkpoint Contract

Run \`holistic checkpoint\` when:

- the task focus changes
- you are about to compact or clear context
- you finish a meaningful chunk of work
- you fix or alter behavior that could regress later

Include impact notes and regression risks when they matter.

## Handoff Contract

- Preferred: map your session-end workflow to \`holistic handoff\`
- Fallback: ask the user to run \`holistic handoff\` before leaving the session
`;
}

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

Project: ${state.projectName}
Updated: ${state.updatedAt}
`;
}

function renderRootAgentDoc(agentName: string, commandName: string): string {
  return `## Holistic — cross-agent session tracking

**At the start of every session, before doing anything else:**
1. Read \`HOLISTIC.md\` in full.
2. Read \`AGENTS.md\` — find the section for your agent and follow its setup steps.
3. Summarise to the user: what was last worked on, what's planned next, and any known fixes to protect.
4. Ask: "Continue as planned, tweak the plan, or do something different?"
5. Run \`holistic resume --agent ${commandName}\` to register the session.

**After significant work or on any git commit (hook fires automatically):**
- Run \`holistic checkpoint --reason '<what you just did>'\`
- To record a fix that must not regress: \`holistic checkpoint --fixed '<bug>' --fix-files '<file>' --fix-risk '<what reintroduces it>'\`

**At the end of every session:**
- Run \`holistic handoff\` — this opens a dialog to capture the summary.
- Then commit: \`git add HOLISTIC.md AGENTS.md CLAUDE.md GEMINI.md HISTORY.md .holistic/ && git commit -m 'docs(holistic): handoff'\`

**Never touch files listed in the KNOWN FIXES section of HOLISTIC.md without reading that section first.**
`;
}

function renderRootHistoryMd(paths: RuntimePaths, state: HolisticState): string {
  const sessions = state.activeSession
    ? [state.activeSession, ...readArchivedSessions(paths)]
    : readArchivedSessions(paths);

  const header = `# History — ${state.projectName}

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
  fs.writeFileSync(paths.protocolDoc, renderProtocol(), "utf8");
  fs.writeFileSync(paths.historyDoc, renderProjectHistory(paths, state), "utf8");
  fs.writeFileSync(paths.regressionDoc, renderRegressionWatch(paths, state), "utf8");
  fs.writeFileSync(paths.zeroTouchDoc, renderZeroTouchDoc(state), "utf8");
  fs.writeFileSync(`${paths.contextDir}/README.md`, renderContextReadme(state), "utf8");
  fs.writeFileSync(`${paths.adaptersDir}/codex.md`, renderAdapter("Codex", "codex"), "utf8");
  fs.writeFileSync(`${paths.adaptersDir}/claude-cowork.md`, renderAdapter("Claude/Cowork", "claude"), "utf8");
  fs.writeFileSync(`${paths.adaptersDir}/antigravity.md`, renderAdapter("Antigravity", "antigravity"), "utf8");
  // Root-level files auto-read by specific agents
  fs.writeFileSync(path.join(paths.rootDir, "CLAUDE.md"), renderRootAgentDoc("Claude/Cowork", "claude"), "utf8");
  fs.writeFileSync(path.join(paths.rootDir, "GEMINI.md"), renderRootAgentDoc("Antigravity/Gemini", "antigravity"), "utf8");
  fs.writeFileSync(path.join(paths.rootDir, "HISTORY.md"), renderRootHistoryMd(paths, state), "utf8");
}







