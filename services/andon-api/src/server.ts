import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";

import type { AgentEvent } from "../../../packages/andon-core/src/index.ts";
import type { HolisticBridge } from "../../../packages/holistic-bridge-types/src/index.ts";

import { DEFAULT_API_PORT } from "./config.ts";
import { getDatabase } from "./db.ts";
import { mockHolisticBridge } from "./holistic/mock-bridge.ts";
import { getActiveSession, getSessionDetail, getSessionsList, getSessionTimeline, ingestEvents } from "./repository.ts";

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

        response.write("data: {\"type\":\"connected\"}\n\n");
        clients.add(response);

        request.on("close", () => {
          clients.delete(response);
        });
        return;
      }

      if (request.method === "GET" && timelineMatch) {
        const payload = getSessionTimeline(database, decodeURIComponent(timelineMatch[1]));
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

        for (const client of clients) {
          client.write("data: {\"type\":\"ping\"}\n\n");
        }

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
          for (const client of clients) {
            client.write("data: {\"type\":\"ping\"}\n\n");
          }
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
  const server = createAndonServer();
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
