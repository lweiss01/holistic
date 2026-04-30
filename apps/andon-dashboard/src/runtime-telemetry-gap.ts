import type { FleetResponse } from "../../../packages/andon-core/src/index.ts";

/** Matches Mission Control banner: legacy activity without runtime-backed fleet rows. */
export function shouldShowRuntimeTelemetryGap(data: FleetResponse): boolean {
  return data.sessions.length === 0 && data.recentEvents.length > 0;
}
