import fs from "node:fs";
import path from "node:path";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import type { AgentEvent } from "../../../packages/andon-core/src/index.ts";
import type { HolisticBridge } from "../../../packages/holistic-bridge-types/src/index.ts";

import { DEFAULT_API_PORT } from "./config.ts";
import { getDatabase } from "./db.ts";
import { createFileHolisticBridge } from "./holistic/file-bridge.ts";
import { mockHolisticBridge } from "./holistic/mock-bridge.ts";
import {
  getActiveSession,
  getSessionDetail,
  getSessionsList,
  getSessionTimeline,
  ingestEvents,
  type TimelinePageOptions
} from "./repository.ts";

export function resolveHolisticBridge(): HolisticBridge {
  const raw = process.env.HOLISTIC_REPO?.trim();
  if (!raw) {
    return mockHolisticBridge;
  }
  const resolved = path.resolve(raw);
  if (!fs.existsSync(resolved)) {
    console.warn(`HOLISTIC_REPO points at a missing path (${resolved}); using mock Holistic bridge.`);
    return mockHolisticBridge;
  }
  console.log(`Andon API: file-backed Holistic bridge → ${resolved}`);
  return createFileHolisticBridge(resolved);
}

/** Slim SSE payload — clients refetch via HTTP (avoids large JSON on every event). */
function broadcastSessionUpdate(clients: Set<ServerResponse>): void {
  if (clients.size === 0) {
    return;
  }

  const line = `data: ${JSON.stringify({ type: "session_update" })}\n\n`;
  for (const client of clients) {
    try {
      client.write(line);
    } catch {
      clients.delete(client);
    }
  }
}

function parseTimelineQuery(url: URL): TimelinePageOptions {
  const tail = url.searchParams.get("tail");
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");
  const opts: TimelinePageOptions = {};
  if (tail !== null && tail !== "") {
    const n = Number(tail);
    if (Number.isFinite(n)) {
      opts.tail = n;
    }
    return opts;
  }
  if (limit !== null && limit !== "") {
    const n = Number(limit);
    if (Number.isFinite(n)) {
      opts.limit = n;
    }
  }
  if (offset !== null && offset !== "") {
    const n = Number(offset);
    if (Number.isFinite(n)) {
      opts.offset = n;
    }
  }
  return opts;
}

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

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? (JSON.parse(raw) as unknown) : null;
}

export function createAndonHandler(
  database = getDatabase(),
  holisticBridge: HolisticBridge = mockHolisticBridge
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const clients = new Set<ServerResponse>();
  let streamBroadcastTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleStreamBroadcast = (): void => {
    if (clients.size === 0) {
      return;
    }
    if (streamBroadcastTimer) {
      clearTimeout(streamBroadcastTimer);
    }
    streamBroadcastTimer = setTimeout(() => {
      streamBroadcastTimer = null;
      broadcastSessionUpdate(clients);
    }, 80);
  };

  return async (request, response) => {
    try {
      if (!request.url || !request.method) {
        const result = jsonResponse({ error: "Missing request metadata." }, 400);
        response.writeHead(result.status, result.headers);
        response.end(result.body);
        return;
      }

      if (request.method === "OPTIONS") {
        const result = jsonResponse({ ok: true }, 204);
        response.writeHead(result.status, result.headers);
        response.end();
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
      const sessionMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
      const timelineMatch = url.pathname.match(/^\/sessions\/([^/]+)\/timeline$/);
      const callbackMatch = url.pathname.match(/^\/sessions\/([^/]+)\/callbacks\/([^/]+)$/);

      if (request.method === "GET" && url.pathname === "/health") {
        const result = jsonResponse({ ok: true, service: "andon-api" });
        response.writeHead(result.status, result.headers);
        response.end(result.body);
        return;
      }

      if (request.method === "GET" && url.pathname === "/sessions") {
        const payload = getSessionsList(database);
        const result = jsonResponse({ sessions: payload });
        response.writeHead(result.status, result.headers);
        response.end(result.body);
        return;
      }

      if (request.method === "GET" && url.pathname === "/sessions/active") {
        const payload = await getActiveSession(database, holisticBridge);
        const result = jsonResponse(payload);
        response.writeHead(result.status, result.headers);
        response.end(result.body);
        return;
      }

      if (request.method === "GET" && url.pathname === "/sessions/stream") {
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
        broadcastSessionUpdate(clients);

        request.on("close", () => {
          clients.delete(response);
        });
        return;
      }

      if (request.method === "GET" && timelineMatch) {
        const sessionId = decodeURIComponent(timelineMatch[1]);
        const payload = getSessionTimeline(database, sessionId, parseTimelineQuery(url));
        if (!payload) {
          const result = jsonResponse({ error: "Session not found." }, 404);
          response.writeHead(result.status, result.headers);
          response.end(result.body);
          return;
        }

        const result = jsonResponse(payload);
        response.writeHead(result.status, result.headers);
        response.end(result.body);
        return;
      }

      if (request.method === "GET" && sessionMatch) {
        const payload = await getSessionDetail(database, holisticBridge, decodeURIComponent(sessionMatch[1]));
        if (!payload) {
          const result = jsonResponse({ error: "Session not found." }, 404);
          response.writeHead(result.status, result.headers);
          response.end(result.body);
          return;
        }

        const result = jsonResponse(payload);
        response.writeHead(result.status, result.headers);
        response.end(result.body);
        return;
      }

      if (request.method === "POST" && url.pathname === "/events") {
        const body = (await readJsonBody(request)) as AgentEvent | { events: AgentEvent[] } | null;
        const events = Array.isArray(body)
          ? body
          : body && "events" in body
            ? body.events
            : body
              ? [body]
              : [];

        const payload = ingestEvents(database, events);

        scheduleStreamBroadcast();

        const result = jsonResponse(payload, 202);
        response.writeHead(result.status, result.headers);
        response.end(result.body);
        return;
      }

      if (request.method === "POST" && callbackMatch) {
        const sessionId = decodeURIComponent(callbackMatch[1]);
        const action = decodeURIComponent(callbackMatch[2]);
        const timestamp = new Date().toISOString();
        const baseEvent = {
          id: `callback-${action}-${Date.now()}`,
          sessionId,
          source: "user" as const,
          timestamp,
          payload: {}
        };
        
        let generatedEvent: AgentEvent | null = null;
        if (action === "approve") {
          generatedEvent = { ...baseEvent, type: "session.ended", summary: "Human supervisor approved the work." };
        } else if (action === "pause") {
          generatedEvent = { ...baseEvent, type: "session.ended", summary: "Human manually paused the session." };
        } else if (action === "resume") {
          generatedEvent = { ...baseEvent, type: "user.resumed", summary: "Human resumed the session." };
        }
        
        if (generatedEvent) {
          ingestEvents(database, [generatedEvent]);
          scheduleStreamBroadcast();
          const result = jsonResponse({ ok: true });
          response.writeHead(result.status, result.headers);
          response.end(result.body);
        } else {
          const result = jsonResponse({ error: "Invalid callback action." }, 400);
          response.writeHead(result.status, result.headers);
          response.end(result.body);
        }
        return;
      }

      const result = jsonResponse({ error: "Route not found." }, 404);
      response.writeHead(result.status, result.headers);
      response.end(result.body);
    } catch (error) {
      const result = jsonResponse(
        {
          error: error instanceof Error ? error.message : "Unknown error"
        },
        500
      );
      response.writeHead(result.status, result.headers);
      response.end(result.body);
    }
  };
}

export function createAndonServer(
  database = getDatabase(),
  holisticBridge: HolisticBridge = mockHolisticBridge
): Server {
  return createServer(createAndonHandler(database, holisticBridge));
}

function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMainModule()) {
  const server = createAndonServer(getDatabase(), resolveHolisticBridge());
  server.listen(DEFAULT_API_PORT, "127.0.0.1", () => {
    console.log("");
    console.log("  ✅ Andon API (backend) is running.");
    console.log(`     Events endpoint : http://127.0.0.1:${DEFAULT_API_PORT}/events  ← do not open in browser`);
    console.log(`     Dashboard UI     : http://127.0.0.1:5173  ← open this in your browser`);
    console.log("");
    console.log("  To start the dashboard UI, run in a separate terminal:");
    console.log("     cd apps/andon-dashboard && npm run dev");
    console.log("");
  });
}
