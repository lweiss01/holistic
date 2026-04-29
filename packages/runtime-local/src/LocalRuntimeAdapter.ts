import type {
  AgentRuntimeAdapter,
  HolisticRuntimeEvent,
  RuntimeCapabilities,
  RuntimeSession,
  RuntimeStatus,
  RuntimeTaskInput
} from "../../runtime-core/src/index.ts";
import { parseRuntimeChunk } from "./parser.ts";
import { startLocalProcess } from "./process.ts";

type LocalSessionState = {
  session: RuntimeSession;
  queue: RuntimeEventQueue;
  child: ReturnType<typeof startLocalProcess>;
  stdoutRemainder: string;
  stderrRemainder: string;
  heartbeatId: NodeJS.Timeout | null;
  ended: boolean;
};

class RuntimeEventQueue {
  private readonly pending: HolisticRuntimeEvent[] = [];
  private readonly waiters: Array<(item: IteratorResult<HolisticRuntimeEvent>) => void> = [];
  private ended = false;

  push(event: HolisticRuntimeEvent): void {
    if (this.ended) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: event, done: false });
      return;
    }
    this.pending.push(event);
  }

  close(): void {
    if (this.ended) return;
    this.ended = true;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.({ value: undefined, done: true });
    }
  }

  async *stream(): AsyncIterable<HolisticRuntimeEvent> {
    while (true) {
      const next = await this.next();
      if (next.done) {
        return;
      }
      yield next.value;
    }
  }

  private next(): Promise<IteratorResult<HolisticRuntimeEvent>> {
    if (this.pending.length > 0) {
      return Promise.resolve({ value: this.pending.shift()!, done: false });
    }
    if (this.ended) {
      return Promise.resolve({ value: undefined, done: true });
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }
}

export interface LocalRuntimeAdapterOptions {
  heartbeatIntervalMs?: number;
}

export class LocalRuntimeAdapter implements AgentRuntimeAdapter {
  readonly id = "local" as const;
  readonly label = "Local Runtime";
  readonly capabilities: RuntimeCapabilities = {
    canPause: true,
    canResume: true,
    canStop: true,
    canRequestApproval: true,
    canStreamStructuredEvents: true,
    canCreateWorktree: true,
    canReportToolUse: true,
    canReportTokenUsage: false
  };

  private readonly sessions = new Map<string, LocalSessionState>();
  private readonly heartbeatIntervalMs: number;

  constructor(options: LocalRuntimeAdapterOptions = {}) {
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30_000;
  }

  async startTask(input: RuntimeTaskInput): Promise<RuntimeSession> {
    const now = new Date().toISOString();
    const sessionId = `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const child = startLocalProcess({
      sessionId,
      repoPath: input.repoPath,
      prompt: input.prompt,
      command: typeof input.metadata?.localCommand === "string" ? input.metadata.localCommand : undefined,
      args: Array.isArray(input.metadata?.localArgs) ? input.metadata.localArgs.map(String) : undefined,
      env: input.metadata?.localEnv && typeof input.metadata.localEnv === "object"
        ? Object.fromEntries(
          Object.entries(input.metadata.localEnv as Record<string, unknown>).map(([key, value]) => [key, String(value)])
        )
        : undefined
    });

    const session: RuntimeSession = {
      id: sessionId,
      runtimeId: this.id,
      agentName: input.agentName,
      repoName: input.repoName,
      repoPath: input.repoPath,
      worktreePath: input.worktreePath,
      branch: input.branch,
      status: "running",
      activity: "planning",
      startedAt: now,
      updatedAt: now,
      pid: child.pid ?? undefined,
      metadata: input.metadata
    };

    const queue = new RuntimeEventQueue();
    const state: LocalSessionState = {
      session,
      queue,
      child,
      stdoutRemainder: "",
      stderrRemainder: "",
      heartbeatId: null,
      ended: false
    };

    this.sessions.set(sessionId, state);
    queue.push(this.makeLifecycleEvent(session, "session.started", "Local runtime task started.", "success"));
    queue.push({
      id: `heartbeat-${session.id}-${Date.now()}`,
      sessionId: session.id,
      type: "session.heartbeat",
      timestamp: session.updatedAt,
      message: "Local runtime heartbeat.",
      activity: session.activity,
      severity: "info",
      payload: {
        pid: session.pid ?? null
      }
    });

    child.stdout.on("data", (chunk: Buffer) => {
      this.handleChunk(state, "stdout", String(chunk));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      this.handleChunk(state, "stderr", String(chunk));
    });

    child.once("exit", (code, signal) => {
      this.handleExit(state, code, signal ?? null);
    });

    state.heartbeatId = setInterval(() => {
      if (state.ended) {
        return;
      }
      state.session.updatedAt = new Date().toISOString();
      state.queue.push({
        id: `heartbeat-${state.session.id}-${Date.now()}`,
        sessionId: state.session.id,
        type: "session.heartbeat",
        timestamp: state.session.updatedAt,
        message: "Local runtime heartbeat.",
        activity: state.session.activity,
        severity: "info",
        payload: {
          pid: state.session.pid ?? null
        }
      });
    }, this.heartbeatIntervalMs);

    return session;
  }

  async pauseTask(sessionId: string): Promise<void> {
    const state = this.requireSession(sessionId);
    this.setStatus(state, "paused", "waiting", "session.paused", "Local runtime paused.");
  }

  async resumeTask(sessionId: string): Promise<void> {
    const state = this.requireSession(sessionId);
    this.setStatus(state, "running", "editing", "session.resumed", "Local runtime resumed.");
  }

  async stopTask(sessionId: string): Promise<void> {
    const state = this.requireSession(sessionId);
    if (!state.ended) {
      state.child.kill();
    }
    this.setStatus(state, "cancelled", "idle", "session.cancelled", "Local runtime stop requested.");
    state.session.completedAt = new Date().toISOString();
    state.ended = true;
    this.cleanupSession(state);
  }

  async getStatus(sessionId: string): Promise<RuntimeSession> {
    return this.requireSession(sessionId).session;
  }

  async *streamEvents(sessionId: string): AsyncIterable<HolisticRuntimeEvent> {
    const state = this.requireSession(sessionId);
    yield* state.queue.stream();
  }

  private requireSession(sessionId: string): LocalSessionState {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`Unknown runtime session '${sessionId}'.`);
    }
    return state;
  }

  private handleChunk(state: LocalSessionState, stream: "stdout" | "stderr", chunk: string): void {
    const parsed = parseRuntimeChunk(
      state.session.id,
      stream,
      chunk,
      stream === "stdout" ? state.stdoutRemainder : state.stderrRemainder
    );

    if (stream === "stdout") {
      state.stdoutRemainder = parsed.remainder;
    } else {
      state.stderrRemainder = parsed.remainder;
    }

    for (const event of parsed.events) {
      state.session.updatedAt = event.timestamp;
      if (event.activity) {
        state.session.activity = event.activity;
      }
      if (event.type === "session.completed") {
        state.session.status = "completed";
        state.session.completedAt = event.timestamp;
      } else if (event.type === "session.failed") {
        state.session.status = "failed";
        state.session.completedAt = event.timestamp;
      }
      state.queue.push(event);
    }
  }

  private handleExit(state: LocalSessionState, code: number | null, signal: NodeJS.Signals | null): void {
    if (state.ended) {
      return;
    }

    state.ended = true;
    state.session.updatedAt = new Date().toISOString();
    state.session.completedAt = state.session.updatedAt;

    if (state.session.status === "cancelled") {
      // already emitted on stopTask
    } else if (code === 0) {
      state.session.status = "completed";
      state.queue.push(this.makeLifecycleEvent(state.session, "session.completed", "Local runtime completed successfully.", "success"));
    } else {
      state.session.status = "failed";
      state.queue.push({
        id: `session-failed-${state.session.id}-${Date.now()}`,
        sessionId: state.session.id,
        type: "session.failed",
        timestamp: state.session.updatedAt,
        message: signal
          ? `Local runtime exited by signal ${signal}.`
          : `Local runtime exited with code ${code ?? "unknown"}.`,
        activity: "idle",
        severity: "error",
        payload: {
          code,
          signal
        }
      });
    }

    this.cleanupSession(state);
  }

  private cleanupSession(state: LocalSessionState): void {
    if (state.heartbeatId) {
      clearInterval(state.heartbeatId);
      state.heartbeatId = null;
    }
    state.queue.close();
  }

  private setStatus(
    state: LocalSessionState,
    status: RuntimeStatus,
    activity: RuntimeSession["activity"],
    eventType: HolisticRuntimeEvent["type"],
    message: string
  ): void {
    state.session.status = status;
    state.session.activity = activity;
    state.session.updatedAt = new Date().toISOString();
    state.queue.push(this.makeLifecycleEvent(state.session, eventType, message, "info"));
  }

  private makeLifecycleEvent(
    session: RuntimeSession,
    type: HolisticRuntimeEvent["type"],
    message: string,
    severity: HolisticRuntimeEvent["severity"]
  ): HolisticRuntimeEvent {
    return {
      id: `${type.replace(".", "-")}-${session.id}-${Date.now()}`,
      sessionId: session.id,
      type,
      timestamp: session.updatedAt,
      message,
      activity: session.activity,
      severity,
      payload: {
        status: session.status,
        pid: session.pid ?? null
      }
    };
  }
}
