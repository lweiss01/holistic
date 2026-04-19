import fs from "node:fs";
import path from "node:path";

import type { HolisticBridge, HolisticContext, HolisticPhase } from "../../../../packages/holistic-bridge-types/src/index.ts";

/** Minimal Holistic `SessionRecord` fields used for Andon grounding. */
interface HolisticSessionJson {
  id: string;
  currentGoal?: string;
  title?: string;
  updatedAt?: string;
  assumptions?: string[];
  blockers?: string[];
  triedItems?: string[];
  workDone?: string[];
  changedFiles?: string[];
  nextSteps?: string[];
  status?: string;
}

interface HolisticStateJson {
  activeSession?: HolisticSessionJson | null;
}

function mapSessionStatusToPhase(status: string | undefined): HolisticPhase {
  if (status === "active") {
    return "execute";
  }
  return "unknown";
}

function sessionToContext(session: HolisticSessionJson): HolisticContext {
  const objective = session.currentGoal || session.title || "";
  return {
    sessionId: session.id,
    objective,
    currentPhase: mapSessionStatusToPhase(session.status),
    constraints: [...(session.assumptions ?? []), ...(session.blockers ?? [])],
    priorAttempts: session.triedItems ?? [],
    acceptedApproaches: session.workDone ?? [],
    rejectedApproaches: [],
    expectedScope: session.changedFiles ?? [],
    successCriteria: session.nextSteps ?? [],
    updatedAt: session.updatedAt ?? new Date().toISOString()
  };
}

function readStateJson(repoRoot: string): HolisticStateJson | null {
  const statePath = path.join(repoRoot, ".holistic", "state.json");
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8")) as HolisticStateJson;
  } catch {
    return null;
  }
}

function readSessionFile(filePath: string): HolisticSessionJson | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as HolisticSessionJson;
  } catch {
    return null;
  }
}

function resolveSession(repoRoot: string, sessionId: string): HolisticSessionJson | null {
  const state = readStateJson(repoRoot);
  if (state?.activeSession?.id === sessionId) {
    return state.activeSession;
  }

  const activePath = path.join(repoRoot, ".holistic", "sessions", `${sessionId}.json`);
  const fromActive = readSessionFile(activePath);
  if (fromActive?.id === sessionId) {
    return fromActive;
  }

  const archivePath = path.join(repoRoot, ".holistic", "sessions", "archive", `${sessionId}.json`);
  const fromArchive = readSessionFile(archivePath);
  if (fromArchive?.id === sessionId) {
    return fromArchive;
  }

  return null;
}

export function createFileHolisticBridge(repoRoot: string): HolisticBridge {
  const root = path.resolve(repoRoot);

  return {
    async getContext(sessionId: string): Promise<HolisticContext | null> {
      const session = resolveSession(root, sessionId);
      return session ? sessionToContext(session) : null;
    }
  };
}
