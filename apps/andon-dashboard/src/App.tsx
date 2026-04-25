import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ActiveSessionResponse,
  AgentEvent,
  RecommendationUrgency,
  SessionDetailResponse,
  SessionRecord,
  SessionStatus,
  TimelineResponse,
} from "../../../packages/andon-core/src/index.ts";
import {
  getActiveSession,
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

function ActiveSessionPage() {
  const [data, setData] = useState<ActiveSessionResponse | null>(null);
  const [timeline, setTimeline] = useState<AgentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getActiveSession()
      .then((result) => {
        setData(result);
        if (!result.session) {
          setTimeline([]);
          return;
        }
        getTimeline(result.session.id, { tail: 10 })
          .then((t) => setTimeline([...t.items].reverse()))
          .catch(() => setTimeline([]));
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => loadData(), [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

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
    return <MessageState title="Reading the line" description="Loading live Andon state…" />;
  }

  if (!data.session || !data.status || !data.recommendation) {
    return (
      <MessageState
        title="No active session"
        description="When an agent starts work, this board will show its phase, status, evidence, and next action."
      />
    );
  }

  const { session, status, recommendation, activeTask, holisticContext } = data;
  const repo = repoName(session.repoPath);
  const worktree =
    session.worktreePath !== session.repoPath ? repoName(session.worktreePath) : null;
  const tone = statusTone(status.status);
  const latestEvent = timeline[0];

  const handleAction = async (action: "approve" | "pause" | "resume") => {
    try {
      await postCallback(session.id, action);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const action =
    status.status === "awaiting_review"
      ? { label: "Approve handoff", intent: "primary" as const, fn: () => handleAction("approve") }
      : status.status === "parked"
        ? { label: "Resume session", intent: "primary" as const, fn: () => handleAction("resume") }
        : status.status === "blocked" || status.status === "at_risk"
          ? { label: "Pause and redirect", intent: "danger" as const, fn: () => handleAction("pause") }
          : { label: "Pause session", intent: "secondary" as const, fn: () => handleAction("pause") };

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
            <span className={`urgency urgency-${urgencyTone(recommendation.urgency)}`}>
              {recommendation.urgency}
            </span>
          </div>
          <h2>{recommendation.title}</h2>
          <p>{recommendation.description}</p>
          <button
            className={`button ${action.intent}`}
            type="button"
            onClick={action.fn}
          >
            {action.label}
          </button>
        </article>

        <article className="panel">
          <p className="kicker">Evidence</p>
          <EvidenceList evidence={status.evidence} />
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

        <article className="panel timeline-panel">
          <div className="section-head">
            <p className="kicker">Recent signals</p>
            <a href={`/session/${session.id}/timeline`}>Full replay</a>
          </div>
          <EventList events={timeline} />
        </article>

        <article className="panel quiet-panel">
          <p className="kicker">Current task</p>
          <dl className="metric-list">
            <div>
              <dt>Title</dt>
              <dd>{activeTask?.title ?? "No active task"}</dd>
            </div>
            <div>
              <dt>Phase</dt>
              <dd>{phaseLabels[session.currentPhase]}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{formatDateTime(session.startedAt)}</dd>
            </div>
            <div>
              <dt>Latest event</dt>
              <dd>{latestEvent?.summary ?? latestEvent?.type ?? "—"}</dd>
            </div>
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

      <p className="page-return"><a href="/">← Back to live line</a> · <a href={`/session/${session.id}/timeline`}>View replay →</a></p>
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

  return <ActiveSessionPage />;
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
