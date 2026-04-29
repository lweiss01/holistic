import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AgentEvent,
  FleetResponse,
  FleetSessionItem,
  RecommendationUrgency,
  SessionDetailResponse,
  SessionRecord,
  SessionStatus,
  TimelineResponse,
} from "../../../packages/andon-core/src/index.ts";
import {
  getFleet,
  getSessionDetail,
  getSessionsList,
  getTimeline,
  postCallback,
  subscribeToStream,
} from "./api.ts";

/* ───────────────────────────── hooks ───────────────────────────── */

function useLiveStream(onPing: () => void) {
  useEffect(() => subscribeToStream(onPing), [onPing]);
}

function useHeartbeat(onTick: () => void, intervalMs = 90_000) {
  useEffect(() => {
    const id = setInterval(onTick, intervalMs);
    return () => clearInterval(id);
  }, [onTick, intervalMs]);
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("andon-theme") as "light" | "dark") ?? "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("andon-theme", theme);
  }, [theme]);

  return {
    theme,
    toggle: () => setTheme((value) => (value === "light" ? "dark" : "light")),
  };
}

/* ───────────────────────────── utilities ───────────────────────────── */

const statusLabels: Record<SessionStatus, string> = {
  running: "Flowing",
  queued: "Queued",
  needs_input: "Needs input",
  at_risk: "At risk",
  blocked: "Stopped",
  awaiting_review: "Review",
  parked: "Parked",
};

const phaseLabels: Record<string, string> = {
  plan: "Plan",
  research: "Research",
  execute: "Execute",
  test: "Test",
};

const phaseMarks: Record<string, string> = {
  plan: "計画",
  research: "調査",
  execute: "実装",
  test: "検証",
};

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function repoName(repoPath: string): string {
  return repoPath.split(/[\\/]/).filter(Boolean).at(-1) ?? repoPath;
}

function formatHourLabel(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function trimLine(value: string | null | undefined, max = 110): string {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function statusTone(status: string | undefined | null): string {
  return (status ?? "parked").replace(/_/g, "-");
}

function eventTone(type: string): string {
  if (type.includes("failed") || type.includes("blocked")) return "critical";
  if (type.includes("risk") || type.includes("scope") || type.includes("retry")) return "warning";
  if (type.includes("checkpoint") || type.includes("session")) return "memory";
  if (type.includes("test")) return "test";
  return "neutral";
}

function urgencyTone(urgency: RecommendationUrgency | undefined): string {
  if (urgency === "high") return "critical";
  if (urgency === "medium") return "warning";
  return "quiet";
}

function byAttention(a: SessionRecord, b: SessionRecord) {
  return new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime();
}

function needsHuman(status: SessionStatus): boolean {
  return status === "blocked" || status === "needs_input" || status === "awaiting_review" || status === "at_risk";
}

function whyNow(item: FleetSessionItem): string {
  return trimLine(item.blockedReason ?? item.status.evidence[0] ?? item.status.explanation, 120);
}

function freshnessSortValue(value: FleetSessionItem["heartbeatFreshness"]): number {
  if (value === "fresh") return 3;
  if (value === "stale") return 2;
  return 1;
}

/** Matches Andon API heartbeat windows (5m / 20m). */
function freshnessLabel(value: FleetSessionItem["heartbeatFreshness"]): string {
  if (value === "fresh") return "Live (<5 min)";
  if (value === "stale") return "Quiet (5–20 min)";
  return "Cold (>20 min)";
}

function riskReasonToStatus(reasonLabel: string): SessionStatus | "all" {
  const label = reasonLabel.toLowerCase();
  if (label.includes("human answer")) return "needs_input";
  if (label.includes("blocked") || label.includes("failing")) return "blocked";
  if (label.includes("review")) return "awaiting_review";
  if (label.includes("risk") || label.includes("drift")) return "at_risk";
  return "all";
}

/* ───────────────────────────── shared components ───────────────────────────── */

function Navigation({
  theme,
  onToggleTheme,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <header className="nav">
      <a className="brand" href="/" aria-label="Andon home">
        <span className="brand-mark" aria-hidden="true">全</span>
        <span>
          <strong>HOLISTIC</strong>
          <em>Andon</em>
        </span>
      </a>

      <nav className="nav-links" aria-label="Dashboard navigation">
        <a href="/">Live</a>
        <a href="/history">History</a>
      </nav>

      <button className="theme-button" type="button" onClick={onToggleTheme}>
        {theme === "light" ? "Dark" : "Light"}
      </button>
    </header>
  );
}

function MessageState({
  title,
  description,
  retryText,
  onRetry,
}: {
  title: string;
  description: string;
  retryText?: string;
  onRetry?: () => void;
}) {
  return (
    <section className="empty-state">
      <p className="kicker">Andon</p>
      <h1>{title}</h1>
      <p>{description}</p>
      {onRetry && (
        <button className="button primary" type="button" onClick={onRetry}>
          {retryText ?? "Retry"}
        </button>
      )}
    </section>
  );
}

function StatusLine({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span className={`status-line status-${tone}`}>
      <span />
      {statusLabels[status as SessionStatus] ?? status.replace(/_/g, " ")}
    </span>
  );
}

function PhaseRail({ activePhase }: { activePhase: string }) {
  const phases = ["plan", "research", "execute", "test"];

  return (
    <ol className="phase-rail" aria-label="Session phase">
      {phases.map((phase) => (
        <li
          key={phase}
          className={phase === activePhase ? "is-active" : undefined}
        >
          <span className="phase-jp">{phaseMarks[phase]}</span>
          <span>{phaseLabels[phase]}</span>
        </li>
      ))}
    </ol>
  );
}

function QuoteBlock() {
  return (
    <aside className="quote-card" aria-label="Andon principle">
      <p>“Surface the problem early. Keep the work humane.”</p>
      <span>改善</span>
    </aside>
  );
}

function EvidenceList({ evidence }: { evidence: string[] }) {
  if (evidence.length === 0) {
    return <p className="muted">No warning evidence recorded.</p>;
  }

  return (
    <ul className="evidence-list">
      {evidence.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function EventList({ events }: { events: AgentEvent[] }) {
  if (events.length === 0) {
    return <p className="muted">No events recorded yet.</p>;
  }

  return (
    <ol className="event-list">
      {events.map((item) => (
        <li key={item.id} className={`event-${eventTone(item.type)}`}>
          <time>{formatTime(item.timestamp)}</time>
          <div>
            <span>{item.type}</span>
            {item.summary && <p>{item.summary}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function SessionMiniCard({ session }: { session: SessionRecord }) {
  return (
    <a className="session-card" href={`/session/${session.id}`}>
      <div>
        <StatusLine status={session.endedAt ? "parked" : "running"} />
        <h3>{session.objective}</h3>
      </div>
      <dl>
        <div>
          <dt>Agent</dt>
          <dd>{session.agentName}</dd>
        </div>
        <div>
          <dt>Repo</dt>
          <dd>{repoName(session.repoPath)}</dd>
        </div>
        <div>
          <dt>Phase</dt>
          <dd>{phaseLabels[session.currentPhase] ?? session.currentPhase}</dd>
        </div>
        <div>
          <dt>Last signal</dt>
          <dd>{timeAgo(session.lastEventAt)}</dd>
        </div>
      </dl>
    </a>
  );
}

/* ───────────────────────────── pages ───────────────────────────── */

function MissionControlPage() {
  const [data, setData] = useState<FleetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = new URLSearchParams(window.location.search);
  const [statusFilter, setStatusFilter] = useState<"all" | SessionStatus>(() => {
    const raw = search.get("status");
    if (!raw) return "all";
    return (Object.keys(statusLabels).includes(raw) ? raw : "all") as "all" | SessionStatus;
  });
  const [repoFilter, setRepoFilter] = useState<string>(() => search.get("repo") ?? "all");
  const [sortBy, setSortBy] = useState<"attention" | "freshness" | "recent">(() => {
    const raw = search.get("sort");
    return raw === "freshness" || raw === "recent" ? raw : "attention";
  });

  const loadData = useCallback(() => {
    setError(null);
    getFleet()
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => loadData(), [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

  const rawSessions = data?.sessions ?? [];
  const sessions = rawSessions.map((item) => ({
    ...item,
    availableActions: item.availableActions ?? ["inspect"],
    attentionBreakdown: item.attentionBreakdown ?? { status: 0, urgency: 0, freshness: 0 }
  }));
  const totals = data?.totals ?? {
    totalSessions: 0,
    activeAgents: 0,
    needsHuman: 0,
    blocked: 0,
    atRisk: 0,
    awaitingReview: 0,
    completedToday: 0
  };
  const riskReasons = data?.riskReasons ?? [];
  const recentEvents = data?.recentEvents ?? [];
  const heatmap = data?.heatmap ?? [];
  const attentionQueue = sessions.filter((item) => needsHuman(item.status.status)).slice(0, 6);
  const repoOptions = useMemo(
    () => ["all", ...Array.from(new Set(sessions.map((item) => item.repoName))).sort()],
    [sessions]
  );
  const visibleSessions = useMemo(() => {
    const filtered = sessions.filter((item) => {
      if (statusFilter !== "all" && item.status.status !== statusFilter) {
        return false;
      }
      if (repoFilter !== "all" && item.repoName !== repoFilter) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "freshness") {
        const byFreshness = freshnessSortValue(b.heartbeatFreshness) - freshnessSortValue(a.heartbeatFreshness);
        if (byFreshness !== 0) return byFreshness;
      } else if (sortBy === "recent") {
        const byRecent = new Date(b.session.lastEventAt).getTime() - new Date(a.session.lastEventAt).getTime();
        if (byRecent !== 0) return byRecent;
      } else {
        const byAttention = b.attentionRank - a.attentionRank;
        if (byAttention !== 0) return byAttention;
      }
      return new Date(b.session.lastEventAt).getTime() - new Date(a.session.lastEventAt).getTime();
    });
  }, [sessions, statusFilter, repoFilter, sortBy]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (statusFilter === "all") params.delete("status");
    else params.set("status", statusFilter);
    if (repoFilter === "all") params.delete("repo");
    else params.set("repo", repoFilter);
    if (sortBy === "attention") params.delete("sort");
    else params.set("sort", sortBy);
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [statusFilter, repoFilter, sortBy]);

  useEffect(() => {
    if (repoFilter !== "all" && !repoOptions.includes(repoFilter)) {
      setRepoFilter("all");
    }
  }, [repoFilter, repoOptions]);

  if (error) {
    return (
      <MessageState
        title="The line is unreachable"
        description={error}
        retryText="Try again"
        onRetry={loadData}
      />
    );
  }

  if (!data) {
    return <MessageState title="Reading fleet state" description="Loading mission control…" />;
  }

  const handleAction = async (sessionId: string, action: "approve" | "pause" | "resume") => {
    await postCallback(sessionId, action);
    await loadData();
  };

  return (
    <main className="mission-control">
      <section className="hero-panel compact">
        <p className="kicker">Mission Control</p>
        <h1>Fleet overview</h1>
        <p className="hero-copy">Generated {timeAgo(data.generatedAt)}. Runtime truth and intervention priority are ranked in one board.</p>
        {sessions.length === 0 && (
          <p className="hero-copy mission-empty-hint">
            No sessions on this board right now (empty database or old idle runs hidden). Recent signals and the 24h heatmap still reflect stored activity; use <a href="/history">History</a> for the full ledger.
          </p>
        )}
        <div className="mission-legend">
          <span><b>Freshness</b> Runtime heartbeat recency</span>
          <span><b>Attention rank</b> Priority score from status + urgency + recency</span>
        </div>
        <div className="fleet-totals">
          <div><dt>Total sessions</dt><dd>{totals.totalSessions}</dd></div>
          <div><dt>Active agents</dt><dd>{totals.activeAgents}</dd></div>
          <div><dt>Needs human</dt><dd>{totals.needsHuman}</dd></div>
          <div><dt>Blocked</dt><dd>{totals.blocked}</dd></div>
          <div><dt>At risk</dt><dd>{totals.atRisk}</dd></div>
          <div><dt>Awaiting review</dt><dd>{totals.awaitingReview}</dd></div>
          <div><dt>Completed today</dt><dd>{totals.completedToday}</dd></div>
        </div>
        <div className="risk-rollup">
          <p className="kicker">Top risk reasons</p>
          <div className="risk-chips">
            {riskReasons.length === 0 ? (
              <span className="risk-chip">No active risk clusters</span>
            ) : (
              riskReasons.map((reason) => (
                <button
                  key={reason.label}
                  type="button"
                  className="risk-chip"
                  onClick={() => {
                    const target = riskReasonToStatus(reason.label);
                    setStatusFilter(target);
                    setSortBy("attention");
                  }}
                >
                  {reason.label} ({reason.count})
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="work-grid mission-grid">
        <article className="panel attention-panel">
          <div className="section-head">
            <p className="kicker">Attention Queue</p>
            <span className="muted">{attentionQueue.length} item(s)</span>
          </div>
          {attentionQueue.length === 0 ? <p className="muted">No sessions currently need intervention.</p> : (
            <ol className="attention-list">
              {attentionQueue.map((item) => (
                <li key={item.session.id}>
                  <div>
                    <StatusLine status={item.status.status} />
                    <strong>{item.session.agentName}</strong>
                    <p><b>Why now:</b> {whyNow(item)}</p>
                    <p><b>Next:</b> {item.recommendedAction}</p>
                    <small>{item.repoName} · waiting {timeAgo(item.session.lastEventAt)}</small>
                  </div>
                  <div className="attention-actions">
                    <a className="text-link" href={`/session/${item.session.id}`}>Inspect</a>
                    {item.availableActions.includes("approve") ? (
                      <button className="button secondary" type="button" onClick={() => handleAction(item.session.id, "approve")}>Approve</button>
                    ) : item.availableActions.includes("resume") ? (
                      <button className="button secondary" type="button" onClick={() => handleAction(item.session.id, "resume")}>Resume</button>
                    ) : item.availableActions.includes("pause") ? (
                      <button className="button secondary" type="button" onClick={() => handleAction(item.session.id, "pause")}>Pause</button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="panel timeline-panel">
          <div className="section-head">
            <p className="kicker">Agent Grid</p>
            <a href="/history">History</a>
          </div>
          <div className="fleet-controls">
            <label>
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | SessionStatus)}>
                <option value="all">All</option>
                {Object.keys(statusLabels).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status as SessionStatus]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Repo</span>
              <select value={repoFilter} onChange={(event) => setRepoFilter(event.target.value)}>
                {repoOptions.map((repo) => (
                  <option key={repo} value={repo}>
                    {repo === "all" ? "All repos" : repo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "attention" | "freshness" | "recent")}>
                <option value="attention">Attention rank</option>
                <option value="freshness">Freshness</option>
                <option value="recent">Recent activity</option>
              </select>
            </label>
          </div>
          <section className="fleet-grid">
            {visibleSessions.map((item: FleetSessionItem) => (
              <a key={item.session.id} className="fleet-card" href={`/session/${item.session.id}`}>
                <div className="section-head">
                  <StatusLine status={item.status.status} />
                  <span className={`urgency urgency-${urgencyTone(item.recommendation.urgency)}`}>{item.recommendation.urgency}</span>
                </div>
                <h3>{item.session.agentName}</h3>
                <p className="fleet-card-copy">{item.activeTask?.title ?? item.session.objective}</p>
                <dl className="metric-list">
                  <div><dt>Repo</dt><dd>{item.repoName}</dd></div>
                  <div><dt>Runtime</dt><dd>{item.session.runtime}</dd></div>
                  <div><dt>Phase</dt><dd>{phaseLabels[item.session.currentPhase] ?? item.session.currentPhase}</dd></div>
                  <div><dt>Freshness</dt><dd title={item.heartbeatFreshness}>{freshnessLabel(item.heartbeatFreshness)}</dd></div>
                  <div><dt>Attention rank</dt><dd>{item.attentionRank}</dd></div>
                  <div><dt>Next action</dt><dd>{item.recommendedAction}</dd></div>
                </dl>
                <details className="fleet-score-details">
                  <summary>Rank details</summary>
                  <p className="fleet-score-breakdown">
                    score = status {item.attentionBreakdown.status}
                    {" + "}urgency {item.attentionBreakdown.urgency}
                    {" + "}freshness {item.attentionBreakdown.freshness}
                  </p>
                </details>
                <p className="fleet-card-context"><b>Why now:</b> {whyNow(item)}</p>
                <p className="fleet-card-context"><b>Latest change:</b> {trimLine(item.session.lastSummary ?? item.status.explanation, 95)}</p>
              </a>
            ))}
            {visibleSessions.length === 0 && (
              <p className="muted">
                {sessions.length === 0
                  ? "No agent sessions on the board."
                  : "No sessions match the current filters."}
              </p>
            )}
          </section>
        </article>

        <article className="panel">
          <p className="kicker">Activity Heatmap (24h)</p>
          <p className="muted heatmap-caption">Signal volume by hour (fleet-wide).</p>
          <div className="heatmap">
            {heatmap.length === 0 ? (
              <p className="muted">No signals recorded in the last 24 hours.</p>
            ) : (
              heatmap.map((cell) => (
                <div key={cell.hourStart} className="heatmap-cell" title={`${formatHourLabel(cell.hourStart)}: ${cell.count} signal(s)`}>
                  <span style={{ height: `${Math.max(8, Math.min(100, cell.count * 10))}%` }} />
                  <small>{formatHourLabel(cell.hourStart)}</small>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="section-head">
            <p className="kicker">Recent Signals</p>
            <span className="muted">{recentEvents.length}</span>
          </div>
          <div className="recent-signals">
            {recentEvents.slice(0, 12).map((item) => (
              <a key={item.id} href={`/session/${item.sessionId}`}>
                <span className={`event-pill event-${eventTone(item.type)}`}>{item.type}</span>
                <p>{item.summary ?? "No summary provided."}</p>
                <small>{item.agentName} · {item.repoName} · {timeAgo(item.createdAt)}</small>
              </a>
            ))}
            {recentEvents.length === 0 && <p className="muted">No fleet events yet.</p>}
          </div>
        </article>
      </section>
    </main>
  );
}

function ActiveSessionPage() {
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [timeline, setTimeline] = useState<AgentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getSessionsList()
      .then(async (sessionsResponse) => {
        const first = [...sessionsResponse.sessions].sort(byAttention).find((item) => item.endedAt === null) ?? sessionsResponse.sessions[0];
        if (!first) {
          setData(null);
          setTimeline([]);
          return;
        }
        const detail = await getSessionDetail(first.id);
        setData(detail);
        const t = await getTimeline(first.id, { tail: 10 });
        setTimeline([...t.items].reverse());
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => loadData(), [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

  if (error) {
    return <MessageState title="The line is unreachable" description={error} retryText="Try again" onRetry={loadData} />;
  }
  if (!data) {
    return <MessageState title="No active session" description="Use Mission Control to open a specific station." />;
  }

  const { session, status, recommendation, activeTask, holisticContext } = data;
  const repo = repoName(session.repoPath);
  const worktree = session.worktreePath !== session.repoPath ? repoName(session.worktreePath) : null;
  const tone = statusTone(status.status);
  const latestEvent = timeline[0];

  return (
    <main className={`dashboard tone-${tone}`}>
      <section className="hero-grid">
        <div className="hero-panel">
          <p className="kicker">Live agent line</p>
          <div className="hero-title-row">
            <h1>{activeTask?.title ?? session.objective}</h1>
            <StatusLine status={status.status} />
          </div>
          <p className="hero-copy">{status.explanation}</p>
          <div className="context-strip">
            <span><b>Repo</b>{repo}</span>
            <span><b>Agent</b>{session.agentName}</span>
            <span><b>Runtime</b>{session.runtime}</span>
            <span><b>Last signal</b>{timeAgo(session.lastEventAt)}</span>
            {worktree && <span><b>Worktree</b>{worktree}</span>}
          </div>
        </div>
        <QuoteBlock />
      </section>
      <PhaseRail activePhase={session.currentPhase} />
      <section className="work-grid">
        <article className="panel attention-panel">
          <div className="section-head">
            <p className="kicker">Needs attention</p>
            <span className={`urgency urgency-${urgencyTone(recommendation.urgency)}`}>{recommendation.urgency}</span>
          </div>
          <h2>{recommendation.title}</h2>
          <p>{recommendation.description}</p>
        </article>
        <article className="panel"><p className="kicker">Evidence</p><EvidenceList evidence={status.evidence} /></article>
        <article className="panel">
          <p className="kicker">Holistic grounding</p>
          {holisticContext ? (
            <div className="grounding-grid">
              <div><h3>Expected scope</h3><EvidenceList evidence={holisticContext.expectedScope ?? []} /></div>
              <div><h3>Constraints</h3><EvidenceList evidence={holisticContext.constraints ?? []} /></div>
              <div><h3>Rejected approaches</h3><EvidenceList evidence={holisticContext.rejectedApproaches ?? []} /></div>
            </div>
          ) : (
            <p className="muted">No Holistic context loaded.</p>
          )}
        </article>
        <article className="panel timeline-panel"><div className="section-head"><p className="kicker">Recent signals</p><a href={`/session/${session.id}/timeline`}>Full replay</a></div><EventList events={timeline} /></article>
        <article className="panel quiet-panel">
          <p className="kicker">Current task</p>
          <dl className="metric-list">
            <div><dt>Title</dt><dd>{activeTask?.title ?? "No active task"}</dd></div>
            <div><dt>Phase</dt><dd>{phaseLabels[session.currentPhase]}</dd></div>
            <div><dt>Started</dt><dd>{formatDateTime(session.startedAt)}</dd></div>
            <div><dt>Latest event</dt><dd>{latestEvent?.summary ?? latestEvent?.type ?? "—"}</dd></div>
          </dl>
          <a className="text-link" href={`/session/${session.id}`}>Inspect station →</a>
        </article>
      </section>
    </main>
  );
}

function DetailPage({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getSessionDetail(sessionId).then(setData).catch((r: Error) => setError(r.message));
  }, [sessionId]);

  useEffect(() => loadData(), [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

  if (error) return <MessageState title="Station unavailable" description={error} onRetry={loadData} />;
  if (!data) return <MessageState title="Opening station" description="Loading session detail…" />;

  const { session, status, recommendation, holisticContext, activeTask } = data;
  const repo = repoName(session.repoPath);

  return (
    <main className={`detail-page tone-${statusTone(status.status)}`}>
      <section className="hero-panel compact">
        <p className="kicker">Station detail</p>
        <div className="hero-title-row">
          <h1>{session.agentName}</h1>
          <StatusLine status={status.status} />
        </div>
        <p className="hero-copy">{session.objective}</p>
        <div className="context-strip">
          <span><b>Repo</b>{repo}</span>
          <span><b>Runtime</b>{session.runtime}</span>
          <span><b>Phase</b>{phaseLabels[session.currentPhase]}</span>
          <span><b>Last signal</b>{timeAgo(session.lastEventAt)}</span>
        </div>
      </section>

      <PhaseRail activePhase={session.currentPhase} />

      <section className="work-grid detail-grid">
        <article className="panel attention-panel">
          <p className="kicker">Recommendation</p>
          <h2>{recommendation.title}</h2>
          <p>{recommendation.description}</p>
          <span className={`urgency urgency-${urgencyTone(recommendation.urgency)}`}>
            {recommendation.urgency}
          </span>
        </article>

        <article className="panel">
          <p className="kicker">Assessment evidence</p>
          <EvidenceList evidence={status.evidence} />
        </article>

        <article className="panel">
          <p className="kicker">Task</p>
          <dl className="metric-list">
            <div><dt>Current</dt><dd>{activeTask?.title ?? "No active task"}</dd></div>
            <div><dt>Started</dt><dd>{formatDateTime(session.startedAt)}</dd></div>
            <div><dt>Last summary</dt><dd>{session.lastSummary ?? "—"}</dd></div>
          </dl>
        </article>

        <article className="panel">
          <p className="kicker">Holistic grounding</p>
          {holisticContext ? (
            <div className="grounding-grid">
              <div>
                <h3>Expected scope</h3>
                <EvidenceList evidence={holisticContext.expectedScope ?? []} />
              </div>
              <div>
                <h3>Constraints</h3>
                <EvidenceList evidence={holisticContext.constraints ?? []} />
              </div>
              <div>
                <h3>Rejected approaches</h3>
                <EvidenceList evidence={holisticContext.rejectedApproaches ?? []} />
              </div>
            </div>
          ) : (
            <p className="muted">No Holistic context loaded for this session.</p>
          )}
        </article>
      </section>

      <p className="page-return"><a href="/">← Back to Mission Control</a> · <a href={`/session/${session.id}/timeline`}>View replay →</a></p>
    </main>
  );
}

const TIMELINE_FETCH_PAGE = 400;
const MAX_TIMELINE_ROWS_RENDERED = 600;

function TimelinePage({ sessionId }: { sessionId: string }) {
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadInitial = useCallback(() => {
    setError(null);
    getTimeline(sessionId, { limit: TIMELINE_FETCH_PAGE, offset: 0 })
      .then(setTimeline)
      .catch((r: Error) => setError(r.message));
  }, [sessionId]);

  useEffect(() => loadInitial(), [loadInitial]);
  useLiveStream(loadInitial);
  useHeartbeat(loadInitial);

  const loadOlder = useCallback(() => {
    if (!timeline?.hasMore || loadingMore) return;
    setLoadingMore(true);
    getTimeline(sessionId, { limit: TIMELINE_FETCH_PAGE, offset: timeline.items.length })
      .then((next) =>
        setTimeline({
          ...next,
          items: [...timeline.items, ...next.items],
        })
      )
      .catch((r: Error) => setError(r.message))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, sessionId, timeline]);

  if (error) return <MessageState title="Replay unavailable" description={error} onRetry={loadInitial} />;
  if (!timeline) return <MessageState title="Loading replay" description="Reading session events…" />;

  const itemsNewestFirst = [...timeline.items].reverse();
  const rendered = itemsNewestFirst.slice(0, MAX_TIMELINE_ROWS_RENDERED);
  const omitted = itemsNewestFirst.length - rendered.length;

  return (
    <main className="timeline-page">
      <section className="hero-panel compact">
        <p className="kicker">Session replay</p>
        <h1>{timeline.total} recorded signals</h1>
        <p className="hero-copy">
          Showing {timeline.items.length} of {timeline.total}. Newest signals appear first.
        </p>
        {timeline.hasMore && (
          <button className="button secondary" type="button" onClick={loadOlder}>
            {loadingMore ? "Loading…" : "Load older signals"}
          </button>
        )}
      </section>

      <article className="panel timeline-panel">
        <EventList events={rendered} />
        {omitted > 0 && (
          <p className="muted">{omitted} events hidden for UI performance.</p>
        )}
      </article>

      <p className="page-return"><a href={`/session/${sessionId}`}>← Back to station</a></p>
    </main>
  );
}

function HistoryPage() {
  const [data, setData] = useState<{ sessions: SessionRecord[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getSessionsList().then(setData).catch((r: Error) => setError(r.message));
  }, []);

  useEffect(() => loadData(), [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

  const sessions = useMemo(() => [...(data?.sessions ?? [])].sort(byAttention), [data]);

  if (error) return <MessageState title="History unavailable" description={error} onRetry={loadData} />;
  if (!data) return <MessageState title="Reading history" description="Loading previous agent sessions…" />;
  if (sessions.length === 0) {
    return <MessageState title="No recorded sessions" description="Past agent work will collect here." />;
  }

  return (
    <main className="history-page">
      <section className="hero-panel compact">
        <p className="kicker">Session wall</p>
        <h1>{sessions.length} agent session{sessions.length === 1 ? "" : "s"}</h1>
        <p className="hero-copy">A quieter ledger of what agents have touched, when they last signaled, and where the work stood.</p>
      </section>

      <section className="session-wall">
        {sessions.map((session) => (
          <SessionMiniCard key={session.id} session={session} />
        ))}
      </section>
    </main>
  );
}

/* ───────────────────────────── router ───────────────────────────── */

function pickRoute(pathname: string): ReactNode {
  const timelineMatch = pathname.match(/^\/session\/([^/]+)\/timeline$/);
  if (timelineMatch) return <TimelinePage sessionId={decodeURIComponent(timelineMatch[1])} />;

  const detailMatch = pathname.match(/^\/session\/([^/]+)$/);
  if (detailMatch) return <DetailPage sessionId={decodeURIComponent(detailMatch[1])} />;

  if (pathname === "/history") return <HistoryPage />;

  return <MissionControlPage />;
}

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <div className="app-shell">
      <Navigation theme={theme} onToggleTheme={toggle} />
      {pickRoute(window.location.pathname)}
    </div>
  );
}
