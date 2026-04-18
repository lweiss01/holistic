export declare const HOLISTIC_PHASES: readonly ["plan", "research", "execute", "test", "unknown"];
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
//# sourceMappingURL=index.d.ts.map