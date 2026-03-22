import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { pathToFileURL } from "node:url";
import { captureRepoSnapshot } from './core/git.ts';
import { writeDerivedDocs } from './core/docs.ts';
import { refreshHolisticHooks } from './core/setup.ts';
import { requestAutoSync } from './core/sync.ts';
import {
  applyHandoff,
  buildStartupGreeting,
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

type SupportedToolName = "holistic_resume" | "holistic_checkpoint" | "holistic_handoff" | "holistic_slash";
const DEFAULT_MCP_AGENT: AgentName = "claude";

function asAgent(value: unknown, fallback: AgentName = "unknown"): AgentName {
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

  return fallback;
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

function ensureMcpResumeState(rootDir: string, agent: AgentName = DEFAULT_MCP_AGENT): HolisticState {
  const { state } = loadState(rootDir);
  if (state.activeSession) {
    return state;
  }

  if (!canInferSessionStart(rootDir, state)) {
    return state;
  }

  return mutateState(rootDir, (currentState) => continueFromLatest(rootDir, currentState, agent));
}

export function buildResumeNotificationText(state: HolisticState, agent: AgentName = DEFAULT_MCP_AGENT): string | null {
  const greeting = buildStartupGreeting(state, agent);
  if (!greeting) {
    return null;
  }

  // Add hint about using the tool for debugging
  return `${greeting}\n\nUse holistic_resume tool for an explicit refresh.`;
}

export async function sendResumeNotification(server: Server, rootDir: string, agent: AgentName = DEFAULT_MCP_AGENT): Promise<boolean> {
  const state = ensureMcpResumeState(rootDir, agent);
  const text = buildResumeNotificationText(state, agent);
  if (!text) {
    return false;
  }

  // Send as logging message for debugging visibility.
  // NOTE: This is diagnostic only - agents discover context by calling holistic_resume tool.
  // The enhanced tool description signals importance to agents at startup.
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
        description: "🎯 Resume Holistic session and get full project context. Call this FIRST at conversation start to load: current objective, recent work, regression watch, and next steps. Essential for maintaining continuity across sessions.",
        inputSchema: {
          type: "object",
          properties: {
            agent: {
              type: "string",
              enum: ["codex", "claude", "antigravity", "gemini", "copilot", "cursor", "goose", "gsd"],
              description: "Agent name for context retrieval (optional, defaults to claude)",
            },
            continue: {
              type: "boolean",
              description: "Auto-infer and start a session from recent work if none exists (optional)",
            },
          },
        },
      },
      {
        name: "holistic_slash",
        description: "Lightweight startup command: load Holistic context and get project recap. Equivalent to typing '/holistic' - use this at conversation start for quick context refresh.",
        inputSchema: {
          type: "object",
          properties: {
            agent: {
              type: "string",
              enum: ["codex", "claude", "antigravity", "gemini", "copilot", "cursor", "goose", "gsd"],
              description: "Agent name (optional, defaults to claude)",
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
      const agent = asAgent(args?.agent, DEFAULT_MCP_AGENT);
      const shouldContinue = args?.continue === true;
      const state = shouldContinue
        ? mutateState(rootDir, (currentState) => continueFromLatest(rootDir, currentState, agent))
        : loadState(rootDir).state;
      
      // Return formatted greeting for agent consumption
      const greeting = buildStartupGreeting(state, agent);
      if (!greeting) {
        return textResult("No active Holistic session or pending work found. Use holistic_resume with continue:true to infer a session from recent work.");
      }
      
      return textResult(greeting);
    }

    case "holistic_slash": {
      // Lightweight /holistic command - auto-infer session if needed
      const agent = asAgent(args?.agent, DEFAULT_MCP_AGENT);
      const state = mutateState(rootDir, (currentState) => {
        // Auto-infer session from recent work if none exists
        if (!currentState.activeSession && canInferSessionStart(rootDir, currentState)) {
          return continueFromLatest(rootDir, currentState, agent);
        }
        return currentState;
      });
      
      const greeting = buildStartupGreeting(state, agent);
      if (!greeting) {
        return textResult("No active Holistic session or pending work found in this repo yet.");
      }
      
      return textResult(greeting);
    }

    case "holistic_checkpoint": {
      const reason = typeof args?.reason === "string" ? args.reason : "";
      if (!reason) {
        return textResult("Checkpoint failed: reason is required.", true);
      }

      const state = mutateState(rootDir, (currentState) => checkpointState(rootDir, currentState, {
        agent: asAgent(args?.agent, DEFAULT_MCP_AGENT),
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
    // Refresh hooks on each client connection so templates stay current
    // across long-lived MCP server processes.
    const hookResult = refreshHolisticHooks(rootDir);
    for (const warning of hookResult.warnings) {
      console.error(warning);
    }

    void sendResumeNotification(server, rootDir, DEFAULT_MCP_AGENT).catch((error: unknown) => {
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

export async function waitForStdioShutdown(stdin: Pick<NodeJS.ReadStream, "once" | "resume"> = process.stdin): Promise<void> {
  stdin.resume();
  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    stdin.once("close", finish);
    stdin.once("end", finish);
  });
}

export async function runMcpServer(rootDir: string): Promise<void> {
  const hookResult = refreshHolisticHooks(rootDir);
  for (const warning of hookResult.warnings) {
    console.error(warning);
  }
  const transport = new StdioServerTransport();
  const server = createHolisticMcpServer(rootDir);
  await server.connect(transport);
  console.error("Holistic MCP server running on stdio");
  await waitForStdioShutdown();
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
