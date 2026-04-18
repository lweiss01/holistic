import { fileURLToPath } from "node:url";

import type { ActiveSessionResponse, AgentEvent } from "../../../packages/andon-core/src/index.ts";

import { normalizeOpenHarnessStreamEvent } from "./openharness-adapter.ts";

const apiBaseUrl = process.env.ANDON_API_BASE_URL ?? "http://localhost:4318";

const sampleEvent: AgentEvent = {
  id: `collector-heartbeat-${Date.now()}`,
  sessionId: "session-andon-mvp",
  runtime: "codex",
  type: "agent.summary_emitted",
  phase: "execute",
  source: "collector",
  timestamp: new Date().toISOString(),
  summary: "Collector heartbeat: agent is still progressing through the MVP scaffold.",
  payload: {
    workComplete: false
  }
};

export function shouldPostProgressHeartbeat(activeSession: ActiveSessionResponse | null): boolean {
  if (!activeSession?.session || !activeSession.status) {
    return false;
  }

  if (activeSession.session.endedAt) {
    return false;
  }

  if (!activeSession.activeTask) {
    return false;
  }

  return !["awaiting_review", "parked"].includes(activeSession.status.status);
}

async function getActiveSession(): Promise<ActiveSessionResponse | null> {
  const response = await fetch(`${apiBaseUrl}/sessions/active`);
  if (!response.ok) {
    throw new Error(`Collector could not load active session (${response.status})`);
  }

  return (await response.json()) as ActiveSessionResponse;
}

async function readOpenHarnessEventsFromStdin(): Promise<AgentEvent[]> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }

  const payload = Buffer.concat(chunks).toString("utf8").trim();
  if (payload.length === 0) {
    return [];
  }

  return payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const raw = JSON.parse(line) as Record<string, unknown>;
      const normalized = normalizeOpenHarnessStreamEvent(raw, {
        sessionId: process.env.ANDON_SESSION_ID ?? "session-andon-mvp",
        taskId: process.env.ANDON_TASK_ID ?? undefined
      });

      return normalized ? [normalized] : [];
    });
}

async function main(): Promise<void> {
  if (!process.argv.includes("--openharness-stdin")) {
    const activeSession = await getActiveSession();
    if (!shouldPostProgressHeartbeat(activeSession)) {
      console.log("Collector skipped heartbeat because the session is no longer actively progressing.");
      return;
    }
  }

  const events =
    process.argv.includes("--openharness-stdin") || process.env.ANDON_COLLECTOR_MODE === "openharness-stream"
      ? await readOpenHarnessEventsFromStdin()
      : [sampleEvent];

  const response = await fetch(`${apiBaseUrl}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ events })
  });

  if (!response.ok) {
    throw new Error(`Collector failed with ${response.status}`);
  }

  const payload = (await response.json()) as { inserted: number };
  console.log(`Collector posted ${payload.inserted} event(s).`);
}

function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
