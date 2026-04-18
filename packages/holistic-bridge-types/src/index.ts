export const HOLISTIC_PHASES = ["plan", "research", "execute", "test", "unknown"] as const;

export type HolisticPhase = (typeof HOLISTIC_PHASES)[number];

export interface HolisticContext {
  sessionId: string;
  objective: string;
  currentPhase: HolisticPhase;
  constraints: string[];
  priorAttempts: string[];
  acceptedApproaches: string[];
  rejectedApproaches: string[];
  expectedScope: string[];
  successCriteria: string[];
  updatedAt: string;
}

export interface HolisticBridge {
  getContext(sessionId: string): Promise<HolisticContext | null>;
}
