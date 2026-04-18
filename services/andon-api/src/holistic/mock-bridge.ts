import type { HolisticBridge, HolisticContext } from "../../../../packages/holistic-bridge-types/src/index.ts";

const contexts = new Map<string, HolisticContext>([
  [
    "session-andon-mvp",
    {
      sessionId: "session-andon-mvp",
      objective: "Build the Andon MVP scaffold and deliver a local-first supervision prototype.",
      currentPhase: "execute",
      constraints: [
        "Single-agent only",
        "Local-first architecture",
        "Prefer simple rules over abstraction"
      ],
      priorAttempts: [
        "Holistic dogfooding already captures handoffs and checkpoints in this repo."
      ],
      acceptedApproaches: [
        "Use a small Node TypeScript API",
        "Use SQLite for local state",
        "Use React for the dashboard"
      ],
      rejectedApproaches: [
        "Introduce multi-agent orchestration",
        "Depend on a vector database",
        "Add heavy infrastructure before MVP proof"
      ],
      expectedScope: [
        "apps/andon-dashboard",
        "services/andon-api",
        "services/andon-collector",
        "packages/andon-core",
        "packages/holistic-bridge-types",
        "docs/andon-mvp.md",
        "scripts/andon-"
      ],
      successCriteria: [
        "Users can see an active session status",
        "Users can inspect a session timeline",
        "Users can read Holistic grounding for the session"
      ],
      updatedAt: new Date("2026-04-18T09:00:00.000Z").toISOString()
    }
  ]
]);

export const mockHolisticBridge: HolisticBridge = {
  async getContext(sessionId: string): Promise<HolisticContext | null> {
    return contexts.get(sessionId) ?? null;
  }
};
