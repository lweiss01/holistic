import type { RuntimeSession } from "../../../packages/runtime-core/src/index.ts";

export const RUNTIME_FRESHNESS_STATES = [
  "active",
  "quiet",
  "stale",
  "stalled",
  "needs_attention"
] as const;

export type RuntimeFreshness = (typeof RUNTIME_FRESHNESS_STATES)[number];

export interface RuntimeFreshnessMeta {
  freshness: RuntimeFreshness;
  ageMs: number;
  ageMinutes: number;
  lastHeartbeatAt: string;
}

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const QUIET_WINDOW_MS = 5 * 60 * 1000;
const STALE_WINDOW_MS = 15 * 60 * 1000;
const STALLED_WINDOW_MS = 30 * 60 * 1000;

export function deriveRuntimeFreshness(lastHeartbeatAt: string, now = Date.now()): RuntimeFreshnessMeta {
  const ageMs = Math.max(0, now - new Date(lastHeartbeatAt).getTime());
  const ageMinutes = Math.floor(ageMs / 60000);

  let freshness: RuntimeFreshness = "needs_attention";
  if (ageMs <= ACTIVE_WINDOW_MS) {
    freshness = "active";
  } else if (ageMs <= QUIET_WINDOW_MS) {
    freshness = "quiet";
  } else if (ageMs <= STALE_WINDOW_MS) {
    freshness = "stale";
  } else if (ageMs <= STALLED_WINDOW_MS) {
    freshness = "stalled";
  }

  return {
    freshness,
    ageMs,
    ageMinutes,
    lastHeartbeatAt
  };
}

export function enrichRuntimeSession(session: RuntimeSession, now = Date.now()): RuntimeSession & { freshness: RuntimeFreshnessMeta } {
  const lastHeartbeatAt = session.updatedAt;
  return {
    ...session,
    freshness: deriveRuntimeFreshness(lastHeartbeatAt, now)
  };
}
