import type { HolisticContext } from "../../holistic-bridge-types/src/index.ts";
import type { AgentEvent, Recommendation, SessionRecord, StatusDecision } from "./types.ts";
interface RecommendationInput {
    session: SessionRecord;
    status: StatusDecision;
    events: AgentEvent[];
    holisticContext: HolisticContext | null;
}
export declare function deriveRecommendation(input: RecommendationInput): Recommendation;
export {};
//# sourceMappingURL=recommendation-engine.d.ts.map