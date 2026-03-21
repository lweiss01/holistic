import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { pathToFileURL } from "node:url";
import { captureRepoSnapshot } from './core/git.ts';
import { writeDerivedDocs } from './core/docs.ts';
import { requestAutoSync } from './core/sync.ts';
import {
  applyHandoff,
  canInferSessionStart,
  checkpointState,
  continueFromLatest,
  getResumePayload,
  getRuntimePaths,
  loadState,
  saveState,
  withStateLock,
} from './core/state.ts';
import type { AgentName, HolisticState, RuntimePaths } from './core/types.ts';

type SupportedToolName = "holistic_resume" | "holistic_checkpoint" | "holistic_handoff";

function asAgent(value: unknown): AgentName {
  const validAgents: AgentName[] = [
    "codex",
    "claude",
    "antigravity",
    "gemini",
    "copilot",
    "cursor",
    "goose",
    "gsd",
  ];

  if (typeof value === "string" && validAgents.includes(value as AgentName)) {
    return value as AgentName;
  }

  return "unknown";
}

function textResult(text: string, isError = false): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
    isError,
  };
}

function persistLocked(rootDir: string, state: HolisticState, paths: RuntimePaths): HolisticState {
  writeDerivedDocs(paths, state);
  state.repoSnapshot = captureRepoSnapshot(rootDir);
  saveState(paths, state, { locked: true });
  return state;
}

function mutateState(rootDir: string, mutator: (state: HolisticState, paths: RuntimePaths) => HolisticState): HolisticState {
  const paths = getRuntimePaths(rootDir);
  return withStateLock(paths, () => {
    const { state, paths: lockedPaths } = loadState(rootDir);
    const nextState = mutator(state, lockedPaths);
    return persistLocked(rootDir, nextState, lockedPaths);
  });
}

function ensureMcpResumeState(rootDir: string, agent: AgentName = "unknown"): HolisticState {
  const { state } = loadState(rootDir);
  if (state.activeSession) {
    return state;
  }

  if (!canInferSessionStart(rootDir, state)) {
    return state;
  }

  return mutateState(rootDir, (currentState) => continueFromLatest(rootDir, currentState, agent));
}

export function buildResumeNotificationText(state: HolisticState, agent: AgentName = "unknown"): string | null {
  const payload = getResumePayload(state, agent);
  if (payload.status === "empty") {
    return null;
  }

  const lines: string[] = [];
  lines.push("Holistic resume");

  if (state.phaseTracker.current) {
    lines.push(`Phase: ${state.phaseTracker.current.id} - ${state.phaseTracker.current.name}`);
  }

  lines.push("");
  lines.push(...payload.recap.map((line) => `- ${line}`));
  lines.push("");
  lines.push(`Choices: ${payload.choices.join(", ")}`);
  lines.push("Use holistic_resume for an explicit refresh.");
  return lines.join("\n");
}

export async function sendResumeNotification(server: Server, rootDir: string, agent: AgentName = "unknown"): Promise<boolean> {
  const state = ensureMcpResumeState(rootDir, agent);
  const text = buildResumeNotificationText(state, agent);
  if (!text) {
    return false;
  }

  await server.sendLoggingMessage({
    level: "info",
    logger: "holistic",
    data: text,
  });
  return true;
}

export function listHolisticTools(): ListToolsResult {
  return {
    tools: [
      {
        name: "holistic_resume",
        description: "Resume the current Holistic session and get project context.",
        inputSchema: {
          type: "object",
          properties: {
            agent: {
              type: "string",
              enum: ["codex", "claude", "antigravity", "gemini", "copilot", "cursor", "goose", "gsd"],
            },
            continue: {
              type: "boolean",
            },
          },
        },
      },
      {
        name: "holistic_checkpoint",
        description: "Create a Holistic checkpoint for the current work.",
        inputSchema: {
          type: "object",
          properties: {
            reason: { type: "string" },
            status: { type: "string" },
            done: { type: "array", items: { type: "string" } },
            next: { type: "array", items: { type: "string" } },
            impacts: { type: "array", items: { type: "string" } },
            regressions: { type: "array", items: { type: "string" } },
          },
          required: ["reason"],
        },
      },
      {
        name: "holistic_handoff",
        description: "Finalize the current Holistic session and prepare a handoff.",
        inputSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            done: { type: "array", items: { type: "string" } },
            next: { type: "array", items: { type: "string" } },
            impacts: { type: "array", items: { type: "string" } },
            regressions: { type: "array", items: { type: "string" } },
          },
        },
      },
    ],
  };
}

export function callHolisticTool(rootDir: string, name: string, args?: Record<string, unknown>): CallToolResult {
  switch (name) {
    case "holistic_resume": {
      const agent = asAgent(args?.agent);
      const shouldContinue = args?.continue === true;
      const state = shouldContinue
        ? mutateState(rootDir, (currentState) => continueFromLatest(rootDir, currentState, agent))
        : loadState(rootDir).state;
      return textResult(JSON.stringify(getResumePayload(state, agent), null, 2));
    }

    case "holistic_checkpoint": {
      const reason = typeof args?.reason === "string" ? args.reason : "";
      if (!reason) {
        return textResult("Checkpoint failed: reason is required.", true);
      }

      const state = mutateState(rootDir, (currentState) => checkpointState(rootDir, currentState, {
        reason,
        status: typeof args?.status === "string" ? args.status : undefined,
        done: Array.isArray(args?.done) ? args.done.filter((item): item is string => typeof item === "string") : undefined,
        next: Array.isArray(args?.next) ? args.next.filter((item): item is string => typeof item === "string") : undefined,
        impacts: Array.isArray(args?.impacts) ? args.impacts.filter((item): item is string => typeof item === "string") : undefined,
        regressions: Array.isArray(args?.regressions) ? args.regressions.filter((item): item is string => typeof item === "string") : undefined,
      }));
      requestAutoSync(rootDir, "checkpoint");

      return textResult(`Checkpoint created: ${state.activeSession?.checkpointCount ?? 0} total checkpoints.`);
    }

    case "holistic_handoff": {
      const { state } = loadState(rootDir);
      if (!state.activeSession) {
        return textResult("Handoff failed: no active session to hand off.", true);
      }

      const nextState = mutateState(rootDir, (currentState) => applyHandoff(rootDir, currentState, {
        summary: typeof args?.summary === "string" ? args.summary : undefined,
        done: Array.isArray(args?.done) ? args.done.filter((item): item is string => typeof item === "string") : undefined,
        next: Array.isArray(args?.next) ? args.next.filter((item): item is string => typeof item === "string") : undefined,
        impacts: Array.isArray(args?.impacts) ? args.impacts.filter((item): item is string => typeof item === "string") : undefined,
        regressions: Array.isArray(args?.regressions) ? args.regressions.filter((item): item is string => typeof item === "string") : undefined,
      }));
      requestAutoSync(rootDir, "handoff");

      return textResult(`Handoff complete. Summary: ${nextState.lastHandoff?.summary ?? "n/a"}`);
    }

    default:
      return textResult(`Unknown Holistic MCP tool: ${name}`, true);
  }
}

export function createHolisticMcpServer(rootDir: string): Server {
  const server = new Server(
    {
      name: "holistic",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.oninitialized = () => {
    void sendResumeNotification(server, rootDir).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to send Holistic resume notification: ${message}`);
    });
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => listHolisticTools());
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return callHolisticTool(
      rootDir,
      request.params.name,
      (request.params.arguments ?? {}) as Record<string, unknown>,
    );
  });

  return server;
}

export async function runMcpServer(rootDir: string): Promise<void> {
  const transport = new StdioServerTransport();
  const server = createHolisticMcpServer(rootDir);
  await server.connect(transport);
  console.error("Holistic MCP server running on stdio");
}

async function main(): Promise<void> {
  const rootDir = process.env.HOLISTIC_REPO || process.cwd();
  await runMcpServer(rootDir);
}

const isEntrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isEntrypoint) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
