import type { HolisticContext } from "../../holistic-bridge-types/src/index.ts";
import type { AgentEvent, SessionRecord, StatusDecision } from "./types.ts";
interface StatusInput {
    session: SessionRecord;
    events: AgentEvent[];
    holisticContext: HolisticContext | null;
    now?: Date;
}
export declare function deriveStatus(input: StatusInput): StatusDecision;
export {};
//# sourceMappingURL=status-engine.d.ts.map