import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type {
  AgentRuntimeAdapter,
  HolisticRuntimeEvent,
  RuntimeId,
  RuntimeSession,
  RuntimeTaskInput
} from "../../../packages/runtime-core/src/index.ts";
import {
  getRuntimeApproval,
  getRuntimeEvents,
  getRuntimeSession,
  getRuntimeProcess,
  listPendingRuntimeApprovals,
  listRuntimeSessions,
  upsertRuntimeApproval,
  upsertRuntimeProcess,
  upsertRuntimeSession,
  insertRuntimeEvent,
  type RuntimeApprovalRecord
} from "../../andon-api/src/runtime-repository.ts";
import { LocalRuntimeAdapter } from "../../../packages/runtime-local/src/index.ts";
import { DEFAULT_RUNTIME_SERVICE_PORT } from "./config.ts";
import { getRuntimeDatabase } from "./db.ts";
import { createRuntimeAdapterRegistry, type RuntimeAdapterRegistry } from "./adapter-registry.ts";
import { enrichRuntimeSession } from "./runtime-freshness.ts";

interface JsonResponse {
  body: string;
  headers: Record<string, string>;
  status: number;
}

function jsonResponse(body: unknown, status = 200): JsonResponse {
  return {
    status,
    body: JSON.stringify(body),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Content-Type": "application/json"
    }
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? (JSON.parse(raw) as unknown) : null;
}

function makeEventId(prefix: string, sessionId: string): string {
  return `${prefix}-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureRuntimeTaskInput(body: unknown): RuntimeTaskInput {
  if (!body || typeof body !== "object") {
    throw new Error("Runtime task payload is required.");
  }

  const candidate = body as Record<string, unknown>;
  const runtimeId = String(candidate.runtimeId ?? "") as RuntimeId;
  const prompt = String(candidate.prompt ?? "").trim();
  const repoPath = String(candidate.repoPath ?? "").trim();
  const repoName = String(candidate.repoName ?? "").trim();
  const agentName = String(candidate.agentName ?? "").trim();

  if (!runtimeId || !prompt || !repoPath || !repoName || !agentName) {
    throw new Error("runtimeId, prompt, repoPath, repoName, and agentName are required.");
  }
  const metadata = candidate.metadata && typeof candidate.metadata === "object"
    ? { ...(candidate.metadata as Record<string, unknown>) }
    : {};
  const topLevelObjective = typeof candidate.objective === "string" && candidate.objective.trim().length > 0
    ? candidate.objective.trim()
    : null;
  const metadataPrompt = typeof metadata.prompt === "string" && metadata.prompt.trim().length > 0
    ? metadata.prompt.trim()
    : prompt;
  const metadataObjective = typeof metadata.objective === "string" && metadata.objective.trim().length > 0
    ? metadata.objective.trim()
    : (topLevelObjective ?? metadataPrompt);
  metadata.prompt = metadataPrompt;
  metadata.objective = metadataObjective;
  if (!(typeof metadata.agentName === "string" && metadata.agentName.trim().length > 0)) {
    metadata.agentName = agentName;
  }

  return {
    runtimeId,
    prompt,
    repoPath,
    repoName,
    agentName,
    branch: candidate.branch ? String(candidate.branch) : undefined,
    worktreePath: candidate.worktreePath ? String(candidate.worktreePath) : undefined,
    constraints: Array.isArray(candidate.constraints) ? candidate.constraints.map(String) : undefined,
    contextFiles: Array.isArray(candidate.contextFiles) ? candidate.contextFiles.map(String) : undefined,
    metadata
  };
}

function runtimeEventFromSession(session: RuntimeSession, type: HolisticRuntimeEvent["type"], message: string): HolisticRuntimeEvent {
  return {
    id: makeEventId(type.replace(".", "-"), session.id),
    sessionId: session.id,
    type,
    timestamp: new Date().toISOString(),
    message,
    activity: session.activity,
    severity: "info",
    payload: {
      status: session.status,
      runtimeId: session.runtimeId
    }
  };
}

function broadcastRuntimeUpdate(clients: Set<ServerResponse>): void {
  if (clients.size === 0) {
    return;
  }

  const line = `data: ${JSON.stringify({ type: "runtime_update" })}\n\n`;
  for (const client of clients) {
    try {
      client.write(line);
    } catch {
      clients.delete(client);
    }
  }
}

function persistSessionUpdate(
  database: DatabaseSync,
  session: RuntimeSession,
  event: HolisticRuntimeEvent
): void {
  upsertRuntimeSession(database, session);
  insertRuntimeEvent(database, event);
  upsertRuntimeProcess(database, {
    sessionId: session.id,
    pid: session.pid ?? null,
    command: null,
    cwd: session.repoPath,
    startedAt: session.startedAt,
    lastHeartbeatAt: session.updatedAt
  });
}

async function consumeAdapterStream(
  database: DatabaseSync,
  adapter: AgentRuntimeAdapter,
  sessionId: string,
  clients: Set<ServerResponse>
): Promise<void> {
  try {
    for await (const event of adapter.streamEvents(sessionId)) {
      const existing = getRuntimeSession(database, sessionId);
      if (existing) {
        const nextStatus = runtimeStatusFromEventType(event.type) ?? existing.status;
        const updated = {
          ...existing,
          status: nextStatus,
          activity: event.activity ?? existing.activity,
          updatedAt: event.timestamp,
          completedAt: nextStatus === "completed" || nextStatus === "failed" || nextStatus === "cancelled"
            ? (existing.completedAt ?? event.timestamp)
            : existing.completedAt
        };
        upsertRuntimeSession(database, updated);
        upsertRuntimeProcess(database, {
          sessionId,
          pid: updated.pid ?? null,
          command: null,
          cwd: updated.repoPath,
          startedAt: updated.startedAt,
          lastHeartbeatAt: event.timestamp
        });
      }

      insertRuntimeEvent(database, {
        ...event,
        sessionId,
        payload: event.payload ?? {}
      });
      broadcastRuntimeUpdate(clients);
    }
  } catch {
    // Stream errors should not crash the service; adapters can reconnect/restart in later slices.
  }
}

function runtimeStatusFromEventType(type: HolisticRuntimeEvent["type"]): RuntimeSession["status"] | null {
  if (type === "session.paused") return "paused";
  if (type === "session.resumed") return "running";
  if (type === "session.failed") return "failed";
  if (type === "session.cancelled") return "cancelled";
  if (type === "session.completed") return "completed";
  if (type === "session.started" || type === "session.heartbeat") return "running";
  if (type === "approval.requested") return "waiting_for_approval";
  if (type === "approval.granted" || type === "approval.denied") return "running";
  return null;
}

async function transitionSession(
  database: DatabaseSync,
  adapter: AgentRuntimeAdapter,
  sessionId: string,
  action: "pause" | "resume" | "stop"
): Promise<RuntimeSession> {
  if (action === "pause") {
    await adapter.pauseTask(sessionId);
  } else if (action === "resume") {
    await adapter.resumeTask(sessionId);
  } else {
    await adapter.stopTask(sessionId);
  }

  const session = await adapter.getStatus(sessionId);
  const eventType = action === "pause"
    ? "session.paused"
    : action === "resume"
      ? "session.resumed"
      : "session.cancelled";

  persistSessionUpdate(database, session, runtimeEventFromSession(session, eventType, `Runtime session ${action}d via API.`));
  return session;
}

function writeJson(response: ServerResponse, payload: JsonResponse): void {
  response.writeHead(payload.status, payload.headers);
  response.end(payload.body);
}

function resolveSessionAdapter(registry: RuntimeAdapterRegistry, sessionId: string, database: DatabaseSync): AgentRuntimeAdapter {
  const session = getRuntimeSession(database, sessionId);
  if (!session) {
    throw new Error("Runtime session not found.");
  }
  return registry.require(session.runtimeId);
}

export function createRuntimeServiceHandler(
  database = getRuntimeDatabase(),
  registry: RuntimeAdapterRegistry = createDefaultRuntimeRegistry()
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const clients = new Set<ServerResponse>();

  return async (request, response) => {
    try {
      if (!request.url || !request.method) {
        writeJson(response, jsonResponse({ error: "Missing request metadata." }, 400));
        return;
      }

      if (request.method === "OPTIONS") {
        writeJson(response, jsonResponse({ ok: true }, 204));
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
      const sessionMatch = url.pathname.match(/^\/runtime\/sessions\/([^/]+)$/);
      const eventsMatch = url.pathname.match(/^\/runtime\/sessions\/([^/]+)\/events$/);
      const actionMatch = url.pathname.match(/^\/runtime\/sessions\/([^/]+)\/(pause|resume|stop|approve|deny)$/);

      if (request.method === "GET" && url.pathname === "/health") {
        writeJson(response, jsonResponse({ ok: true, service: "runtime-service" }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/runtime/stream") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
        });
        clients.add(response);
        response.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

        request.on("close", () => clients.delete(response));
        return;
      }

      if (request.method === "GET" && url.pathname === "/runtime/sessions") {
        const sessions = listRuntimeSessions(database);
        writeJson(response, jsonResponse({
          sessions: sessions.map((session) => enrichRuntimeSession(session)),
          adapters: registry.listIds()
        }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/runtime/approvals/pending") {
        writeJson(response, jsonResponse({ approvals: listPendingRuntimeApprovals(database) }));
        return;
      }

      if (request.method === "GET" && sessionMatch) {
        const sessionId = decodeURIComponent(sessionMatch[1]);
        const session = getRuntimeSession(database, sessionId);
        if (!session) {
          writeJson(response, jsonResponse({ error: "Runtime session not found." }, 404));
          return;
        }
        writeJson(response, jsonResponse({
          session: enrichRuntimeSession(session),
          process: getRuntimeProcess(database, sessionId)
        }));
        return;
      }

      if (request.method === "GET" && eventsMatch) {
        const sessionId = decodeURIComponent(eventsMatch[1]);
        if (!getRuntimeSession(database, sessionId)) {
          writeJson(response, jsonResponse({ error: "Runtime session not found." }, 404));
          return;
        }
        writeJson(response, jsonResponse({ sessionId, events: getRuntimeEvents(database, sessionId) }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/runtime/tasks") {
        const input = ensureRuntimeTaskInput(await readJsonBody(request));
        const adapter = registry.require(input.runtimeId);
        const session = await adapter.startTask(input);
        persistSessionUpdate(database, session, runtimeEventFromSession(session, "session.started", "Runtime task started."));
        broadcastRuntimeUpdate(clients);
        void consumeAdapterStream(database, adapter, session.id, clients);
        writeJson(response, jsonResponse({ session }, 202));
        return;
      }

      if (request.method === "POST" && actionMatch) {
        const sessionId = decodeURIComponent(actionMatch[1]);
        const action = actionMatch[2] as "pause" | "resume" | "stop" | "approve" | "deny";

        if (!getRuntimeSession(database, sessionId)) {
          writeJson(response, jsonResponse({ error: "Runtime session not found." }, 404));
          return;
        }

        if (action === "approve" || action === "deny") {
          const body = await readJsonBody(request);
          const candidate = body && typeof body === "object" ? body as Record<string, unknown> : {};
          const approvalId = String(candidate.approvalId ?? `approval-${sessionId}-${Date.now()}`);
          const current = getRuntimeApproval(database, approvalId);
          const record: RuntimeApprovalRecord = {
            id: approvalId,
            sessionId,
            status: action === "approve" ? "granted" : "denied",
            requestedAt: current?.requestedAt ?? new Date().toISOString(),
            resolvedAt: new Date().toISOString(),
            prompt: String(candidate.prompt ?? current?.prompt ?? "Runtime approval response"),
            payload: candidate.payload && typeof candidate.payload === "object"
              ? candidate.payload as Record<string, unknown>
              : {}
          };

          upsertRuntimeApproval(database, record);

          insertRuntimeEvent(database, {
            id: makeEventId(`approval-${action}`, sessionId),
            sessionId,
            type: action === "approve" ? "approval.granted" : "approval.denied",
            timestamp: new Date().toISOString(),
            severity: action === "approve" ? "success" : "warning",
            message: action === "approve" ? "Runtime approval granted." : "Runtime approval denied.",
            payload: { approvalId }
          });

          broadcastRuntimeUpdate(clients);
          writeJson(response, jsonResponse({ approval: record }));
          return;
        }

        const adapter = resolveSessionAdapter(registry, sessionId, database);
        const session = await transitionSession(database, adapter, sessionId, action);
        broadcastRuntimeUpdate(clients);
        writeJson(response, jsonResponse({ session }));
        return;
      }

      writeJson(response, jsonResponse({ error: "Route not found." }, 404));
    } catch (error) {
      writeJson(response, jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500));
    }
  };
}

export function createRuntimeServiceServer(
  database = getRuntimeDatabase(),
  registry: RuntimeAdapterRegistry = createDefaultRuntimeRegistry()
): Server {
  return createServer(createRuntimeServiceHandler(database, registry));
}

function createDefaultRuntimeRegistry(): RuntimeAdapterRegistry {
  const registry = createRuntimeAdapterRegistry();
  registry.register(new LocalRuntimeAdapter());
  return registry;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createRuntimeServiceServer();
  server.listen(DEFAULT_RUNTIME_SERVICE_PORT, "127.0.0.1", () => {
    console.log(`Runtime service listening on http://127.0.0.1:${DEFAULT_RUNTIME_SERVICE_PORT}`);
  });
}
