import type { RuntimeCapabilities } from "./capabilities.ts";
import type { HolisticRuntimeEvent } from "./events.ts";
import type { RuntimeId, RuntimeSession, RuntimeTaskInput } from "./types.ts";

export interface AgentRuntimeAdapter {
  id: RuntimeId;
  label: string;
  capabilities: RuntimeCapabilities;
  startTask(input: RuntimeTaskInput): Promise<RuntimeSession>;
  pauseTask(sessionId: string): Promise<void>;
  resumeTask(sessionId: string): Promise<void>;
  stopTask(sessionId: string): Promise<void>;
  getStatus(sessionId: string): Promise<RuntimeSession>;
  streamEvents(sessionId: string): AsyncIterable<HolisticRuntimeEvent>;
}
