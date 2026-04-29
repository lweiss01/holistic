import type { AgentRuntimeAdapter, RuntimeId } from "../../../packages/runtime-core/src/index.ts";

export class RuntimeAdapterRegistry {
  private readonly adapters = new Map<RuntimeId, AgentRuntimeAdapter>();

  register(adapter: AgentRuntimeAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(runtimeId: RuntimeId): AgentRuntimeAdapter | null {
    return this.adapters.get(runtimeId) ?? null;
  }

  require(runtimeId: RuntimeId): AgentRuntimeAdapter {
    const adapter = this.get(runtimeId);
    if (!adapter) {
      throw new Error(`No runtime adapter registered for '${runtimeId}'.`);
    }
    return adapter;
  }

  listIds(): RuntimeId[] {
    return [...this.adapters.keys()];
  }
}

export function createRuntimeAdapterRegistry(): RuntimeAdapterRegistry {
  return new RuntimeAdapterRegistry();
}
