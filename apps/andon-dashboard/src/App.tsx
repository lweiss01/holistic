import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import type {
  ActiveSessionResponse,
  AgentEvent,
  SessionDetailResponse,
  SessionRecord,
  TimelineResponse
} from "../../../packages/andon-core/src/index.ts";

import {
  getActiveSession,
  getSessionDetail,
  getSessionsList,
  getTimeline,
  postCallback,
  subscribeToStream
} from "./api.ts";

/* ═══════════════════════════════════════════════╗
   HOOKS
╚══════════════════════════════════════════════════ */
function useLiveStream(onPing: () => void) {
  useEffect(() => subscribeToStream(onPing), [onPing]);
}

/** Poll every 15 seconds so the dashboard never goes stale,
 *  even when Holistic isn't actively emitting events. */
function useHeartbeat(onTick: () => void, intervalMs = 15_000) {
  useEffect(() => {
    const id = setInterval(onTick, intervalMs);
    return () => clearInterval(id);
  }, [onTick, intervalMs]);
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('andon-theme') as 'light' | 'dark') ?? 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('andon-theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  return { theme, toggle };
}

/* ═══════════════════════════════════════════════╗
   UTILITIES
╚══════════════════════════════════════════════════ */
function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function repoName(repoPath: string): string {
  return repoPath.split(/[\\/]/).filter(Boolean).at(-1) ?? repoPath;
}

function typeClass(type: string): string {
  if (type.includes("failed") || type.includes("blocked")) return "t-type t-type-error";
  if (type.includes("risk") || type.includes("scope") || type.includes("retry")) return "t-type t-type-warn";
  if (type.includes("session") || type.includes("phase") || type.includes("checkpoint")) return "t-type t-type-system";
  return "t-type t-type-default";
}

function dotClass(type: string): string {
  if (type.includes("failed") || type.includes("blocked")) return "t-dot t-dot-blocked";
  if (type.includes("risk") || type.includes("scope") || type.includes("retry")) return "t-dot t-dot-risk";
  if (type.includes("session.started") || type.includes("session.checkpoint")) return "t-dot t-dot-running";
  return "t-dot t-dot-system";
}

/* ═══════════════════════════════════════════════╗
   SHARED COMPONENTS
╚══════════════════════════════════════════════════ */
// Status as a colored rule + text label — not a pill badge
function StatusIndicator({ value }: { value: string }) {
  const label: Record<string, string> = {
    running:         "Running",
    queued:          "Queued",
    needs_input:     "Needs Input",
    at_risk:         "At Risk",
    blocked:         "Blocked",
    awaiting_review: "Awaiting Review",
    parked:          "Parked"
  };
  return (
    <span className={`status-indicator status-${value.replace(/_/g, "-")}`}>
      <span className="status-indicator-bar" />
      {label[value] ?? value.replace(/_/g, " ")}
    </span>
  );
}

// Keep StatusPill as an alias for table views
const StatusPill = StatusIndicator;

function MessageState({ title, description, retryText, onRetry }: {
  title: string; description: string; retryText?: string; onRetry?: () => void;
}) {
  return (
    <div className="panel message-state">
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry && <button className="btn btn-secondary" onClick={onRetry}>{retryText ?? "Retry"}</button>}
    </div>
  );
}

function Navigation({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="lamp-bar" />
        <div className="brand-lockup">
          <span className="brand-wordmark">Andon</span>
          <span className="brand-tagline">Agent Supervision</span>
        </div>
      </div>
      <div className="topbar-right">
        <nav className="topbar-nav">
          <a href="/">Monitor</a>
          <a href="/history">History</a>
        </nav>
        <button className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════╗
   MOCKUP A — ACTIVE SESSION FOCUS BOARD
╚══════════════════════════════════════════════════ */
function ActiveSessionPage() {
  const [data, setData] = useState<ActiveSessionResponse | null>(null);
  const [timeline, setTimeline] = useState<AgentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getActiveSession()
      .then((result) => {
        setData(result);
        if (result.session) {
          getTimeline(result.session.id)
            .then((t) => setTimeline(t.items.slice(-10).reverse()))
            .catch(() => setTimeline([]));
        }
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData); // Poll every 15s — catches work not emitting explicit events

  if (error) return <MessageState title="Connection Error" description={`Cannot reach the Andon API: ${error}`} retryText="Retry" onRetry={loadData} />;
  if (!data) return <MessageState title="Connecting…" description="Fetching live session data from the Andon API." />;
  if (!data.session || !data.status || !data.recommendation) {
    return (
      <MessageState
        title="No Active Session"
        description="No agent session is currently running. Start a Holistic session and it will appear here in real time."
        retryText="Check Again"
        onRetry={loadData}
      />
    );
  }

  const { session, status, recommendation, activeTask } = data;
  const repo = repoName(session.repoPath);
  const worktree = session.worktreePath !== session.repoPath ? repoName(session.worktreePath) : null;
  const statusSlug = status.status.replace(/_/g, "-");

  const handleAction = async (action: "approve" | "pause" | "resume") => {
    try { await postCallback(session.id, action); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  let actionBtn: ReactNode = null;
  if (status.status === "awaiting_review") {
    actionBtn = <button className="btn btn-primary" onClick={() => handleAction("approve")}>Approve &amp; Close</button>;
  } else if (status.status === "parked") {
    actionBtn = <button className="btn btn-secondary" onClick={() => handleAction("resume")}>Resume Session</button>;
  } else if (status.status === "blocked" || status.status === "at_risk") {
    actionBtn = <button className="btn btn-warning" onClick={() => handleAction("pause")}>Pause &amp; Redirect</button>;
  } else {
    actionBtn = <button className="btn btn-danger" onClick={() => handleAction("pause")}>Pause Session</button>;
  }

  return (
    <div className="page-grid">
      {/* ── LEFT: Main status panel ── */}
      <div className="page-grid-main">
        <div className={`panel panel-${statusSlug}`}>
          <p className="eyebrow">Andon — Active Session</p>

          <div className="task-header">
            <p className="task-title">{activeTask?.title ?? session.objective}</p>
            <div className="chip-row">
              <StatusIndicator value={status.status} />
              <span className="chip"><span className="chip-label">Repo</span>{repo}</span>
              <span className="chip"><span className="chip-label">Phase</span>{session.currentPhase}</span>
              {worktree && <span className="chip"><span className="chip-label">Worktree</span>{worktree}</span>}
              <span className="chip"><span className="chip-label">Agent</span>{session.agentName}</span>
            </div>
          </div>

          {/* Why section */}
          {status.evidence.length > 0 && (
            <>
              <p className="eyebrow">Why</p>
              <ul className="reason-list">
                {status.evidence.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </>
          )}

          <hr className="section-divider" />

          {/* Last 10 events */}
          <p className="eyebrow">Last {timeline.length} Events</p>
          {timeline.length === 0
            ? <p className="meta">No events recorded yet.</p>
            : (
              <ul className="timeline">
                {timeline.map((item) => (
                  <li key={item.id} className="timeline-item">
                    <div className={dotClass(item.type)} />
                    <div className="t-body">
                      <span className={typeClass(item.type)}>{item.type}</span>
                      {item.summary && <p className="t-summary">{item.summary}</p>}
                    </div>
                    <span className="t-time">{formatTime(item.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>

      {/* ── RIGHT: Sidebar ── */}
      <div className="page-grid-aside">
        {/* Suggested Action */}
        <div className="panel">
          <p className="eyebrow">Focus Now</p>
          <p className="focus-title">{recommendation.title}</p>
          <p style={{ color: "var(--fg-secondary)", fontSize: "var(--text-sm)", marginBottom: "var(--sp-4)" }}>
            {recommendation.description}
          </p>
          <p className={`meta urgency-${recommendation.urgency}`} style={{ marginBottom: "var(--sp-4)" }}>
            Urgency: {recommendation.urgency}
          </p>
          {actionBtn}
        </div>

        {/* Active task meta */}
        <div className="panel">
          <p className="eyebrow">Active Task</p>
          <h3 style={{ marginBottom: "var(--sp-3)" }}>{activeTask?.title ?? "No active task"}</h3>
          <div className="signal-grid">
            <div className="signal-tile">
              <p className="signal-tile-label">Last Event</p>
              <p className="signal-tile-value">{timeAgo(session.lastEventAt)}</p>
            </div>
            <div className="signal-tile">
              <p className="signal-tile-label">Phase</p>
              <p className="signal-tile-value">{session.currentPhase}</p>
            </div>
          </div>
          <p style={{ marginTop: "var(--sp-4)" }}>
            <a href={`/session/${session.id}`} style={{ fontSize: "var(--text-xs)" }}>
              View full detail →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════╗
   MOCKUP C — AGENT DETAIL INSPECTOR
╚══════════════════════════════════════════════════ */
function DetailPage({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getSessionDetail(sessionId).then(setData).catch((r: Error) => setError(r.message));
  }, [sessionId]);

  useEffect(() => { loadData(); }, [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

  if (error) return <MessageState title="Connection Error" description={`Failed to load session: ${error}`} retryText="Retry" onRetry={loadData} />;
  if (!data) return <MessageState title="Loading…" description="Fetching session diagnostics…" />;

  const { session, status, recommendation, holisticContext } = data;
  const repo = repoName(session.repoPath);
  const worktree = session.worktreePath !== session.repoPath ? repoName(session.worktreePath) : null;
  const statusSlug = status.status.replace(/_/g, "-");

  // Derive rough drift severity from evidence
  const scopeDrift = status.evidence.some((e) => e.toLowerCase().includes("scope")) ? "medium" : "none";
  const strategyDrift = status.evidence.some((e) => e.toLowerCase().includes("rejected") || e.toLowerCase().includes("repeated")) ? "medium" : "none";
  const contextDrift = status.evidence.some((e) => e.toLowerCase().includes("context") || e.toLowerCase().includes("drift")) ? "medium" : "low";

  return (
    <div className="page-grid">
      <div className="page-grid-main">
        {/* Primary header */}
        <div className={`panel panel-status-${statusSlug}`} style={{ marginBottom: "var(--sp-4)" }}>
          <p className="eyebrow">Agent Detail — {session.agentName}</p>
          <div className="task-header">
            <p className="task-title">{session.objective}</p>
            <div className="chip-row">
              <StatusPill value={status.status} />
              <span className="chip"><span className="chip-label">Repo</span>{repo}</span>
              {worktree && <span className="chip"><span className="chip-label">Worktree</span>{worktree}</span>}
              <span className="chip"><span className="chip-label">Phase</span>{session.currentPhase}</span>
            </div>
          </div>
        </div>

        {/* Holistic Grounding */}
        <div className="panel" style={{ marginBottom: "var(--sp-4)" }}>
          <p className="eyebrow">Holistic Grounding</p>
          {holisticContext ? (
            <>
              {holisticContext.expectedScope.length > 0 && (
                <>
                  <p className="meta" style={{ marginBottom: "var(--sp-1)" }}>Expected scope</p>
                  <ul className="compact-list">
                    {holisticContext.expectedScope.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                </>
              )}
              {holisticContext.rejectedApproaches.length > 0 && (
                <>
                  <p className="meta" style={{ marginTop: "var(--sp-4)", marginBottom: "var(--sp-1)" }}>Rejected approaches</p>
                  <ul className="compact-list">
                    {holisticContext.rejectedApproaches.map((r) => <li key={r} style={{ color: "var(--red)" }}>{r}</li>)}
                  </ul>
                </>
              )}
              {holisticContext.constraints.length > 0 && (
                <>
                  <p className="meta" style={{ marginTop: "var(--sp-4)", marginBottom: "var(--sp-1)" }}>Constraints</p>
                  <ul className="compact-list">
                    {holisticContext.constraints.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="meta">No Holistic context loaded for this session.</p>
          )}
        </div>

        {/* Drift Flags */}
        <div className="panel">
          <p className="eyebrow">Drift Flags</p>
          <div>
            <div className="drift-row">
              <span className="drift-label">Scope drift</span>
              <span className={`drift-badge drift-badge-${scopeDrift}`}>{scopeDrift}</span>
            </div>
            <div className="drift-row">
              <span className="drift-label">Strategy drift</span>
              <span className={`drift-badge drift-badge-${strategyDrift}`}>{strategyDrift}</span>
            </div>
            <div className="drift-row">
              <span className="drift-label">Context drift</span>
              <span className={`drift-badge drift-badge-${contextDrift}`}>{contextDrift}</span>
            </div>
          </div>

          {status.evidence.length > 0 && (
            <>
              <hr className="section-divider" />
              <p className="eyebrow">Assessment evidence</p>
              <ul className="reason-list">
                {status.evidence.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT sidebar ── */}
      <div className="page-grid-aside">
        {/* Live Signals */}
        <div className="panel">
          <p className="eyebrow">Live Signals</p>
          <div className="signal-grid">
            <div className="signal-item">
              <p className="signal-label">Last Event</p>
              <p className="signal-value">{timeAgo(session.lastEventAt)}</p>
            </div>
            <div className="signal-item">
              <p className="signal-label">Phase</p>
              <p className="signal-value">{session.currentPhase}</p>
            </div>
            <div className="signal-item">
              <p className="signal-label">Runtime</p>
              <p className="signal-value">{session.runtime}</p>
            </div>
            <div className="signal-item">
              <p className="signal-label">Status</p>
              <p className="signal-value" style={{ textTransform: "capitalize" }}>{status.status.replace(/_/g, " ")}</p>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="panel">
          <p className="eyebrow">Recommendations</p>
          <p className="intervention-title">{recommendation.title}</p>
          <p style={{ color: "var(--fg-secondary)", fontSize: "var(--text-sm)", marginBottom: "var(--sp-3)" }}>
            {recommendation.description}
          </p>
          <p className={`meta urgency-${recommendation.urgency}`} style={{ marginBottom: "var(--sp-4)" }}>
            Urgency: {recommendation.urgency}
          </p>
        </div>

        <div className="panel">
          <p className="meta" style={{ marginBottom: "var(--sp-3)" }}>
            Started {formatDateTime(session.startedAt)}
          </p>
          <p style={{ marginBottom: "var(--sp-3)" }}>
            <a href={`/session/${session.id}/timeline`} style={{ fontSize: "var(--text-xs)" }}>
              View full timeline →
            </a>
          </p>
          <p>
            <a href="/" style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
              ← Back to Live Monitor
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════╗
   MOCKUP D — SESSION REPLAY / TIMELINE
╚══════════════════════════════════════════════════ */
function TimelinePage({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getTimeline(sessionId).then(setData).catch((r: Error) => setError(r.message));
  }, [sessionId]);

  useEffect(() => { loadData(); }, [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

  if (error) return <MessageState title="Connection Error" description={`Failed to load timeline: ${error}`} retryText="Retry" onRetry={loadData} />;
  if (!data) return <MessageState title="Loading Timeline" description="Fetching event history…" />;
  if (data.items.length === 0) return <MessageState title="No Events Yet" description="No events have been recorded for this session." retryText="Refresh" onRetry={loadData} />;

  const items = [...data.items].reverse();

  return (
    <div className="panel">
      <p className="eyebrow">Session Replay</p>
      <ul className="timeline">
        {items.map((item) => (
          <li key={item.id} className="timeline-item">
            <div className={dotClass(item.type)} />
            <div className="t-body">
              <span className={typeClass(item.type)}>{item.type}</span>
              {item.summary && (
                <p className="t-summary">{item.summary}</p>
              )}
              {item.phase && (
                <span className="meta" style={{ display: "inline-block", marginTop: "var(--sp-1)" }}>
                  phase: {item.phase}
                </span>
              )}
            </div>
            <span className="t-time">{formatTime(item.timestamp)}</span>
          </li>
        ))}
      </ul>
      <hr className="divider" />
      <p>
        <a href={`/session/${sessionId}`} style={{ fontSize: "var(--text-xs)" }}>← Back to Detail View</a>
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════╗
   HISTORY PAGE — SESSION WALLBOARD
╚══════════════════════════════════════════════════ */
function HistoryPage() {
  const [data, setData] = useState<{ sessions: SessionRecord[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getSessionsList().then(setData).catch((r: Error) => setError(r.message));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

  if (error) return <MessageState title="Connection Error" description={`Failed to load history: ${error}`} retryText="Retry" onRetry={loadData} />;
  if (!data) return <MessageState title="Loading…" description="Fetching session records…" />;
  if (data.sessions.length === 0) return <MessageState title="No Sessions Yet" description="No sessions have been recorded yet." />;

  return (
    <div className="panel">
      <p className="eyebrow">Session History</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Started</th>
            <th>Agent</th>
            <th>Repo</th>
            <th>Phase</th>
            <th>Objective</th>
            <th>Ended</th>
          </tr>
        </thead>
        <tbody>
          {data.sessions.map((session) => (
            <tr key={session.id}>
              <td className="meta">{formatDateTime(session.startedAt)}</td>
              <td style={{ color: "var(--fg-primary)" }}>{session.agentName}</td>
              <td className="meta">{repoName(session.repoPath)}</td>
              <td><StatusPill value={session.currentPhase} /></td>
              <td>
                <a href={`/session/${session.id}`}>{session.objective}</a>
              </td>
              <td className="meta">{formatDateTime(session.endedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════╗
   ROUTER
╚══════════════════════════════════════════════════ */
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
    <main className="app-shell">
      <Navigation theme={theme} onToggleTheme={toggle} />
      {pickRoute(window.location.pathname)}
    </main>
  );
}
