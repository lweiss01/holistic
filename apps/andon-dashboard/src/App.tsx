import { useCallback, useEffect, useMemo, useState } from "react";
import type { OperationalCategory, SessionRecord } from "../../../packages/andon-core/src/index.ts";
import {
  getAndonHealth,
  getHistory,
  getMissionControl,
  getSessionDetail,
  getSessionReplay,
  subscribeToStream,
  type AndonHealthResponse,
  type MissionControlResponse,
  type SessionReplayResponse,
} from "./api.ts";
import {
  buildMissionControlBoardViewModel,
  getCategoryPresentation,
  type MissionLaneViewModel,
  type MissionSessionViewModel,
} from "./mission-control-view-model.ts";

function useLiveStream(onPing: () => void) {
  useEffect(() => subscribeToStream(onPing), [onPing]);
}

function useHeartbeat(onTick: () => void, intervalMs = 30_000) {
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

function formatClock(value = new Date()): string {
  return value.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function repoName(repoPath: string): string {
  return repoPath.split(/[\\/]/).filter(Boolean).at(-1) ?? repoPath;
}

function trimLine(value: string | null | undefined, max = 110): string {
  if (!value) return "-";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function Navigation({
  theme,
  onToggleTheme,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <header className="top-shell">
      <a className="brand" href="/" aria-label="HOLISTIC Andon Mission Control">
        <span className="brand-mark" aria-hidden="true">H</span>
        <span>
          <strong>HOLISTIC</strong>
          <em>Mission Control</em>
        </span>
      </a>

      <nav className="nav-links" aria-label="Primary navigation">
        <a href="/">Mission Control</a>
        <a href="/needs-action">Needs Action</a>
        <a href="/review">Review</a>
        <a href="/history">History</a>
        <a href="/health">Health</a>
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
    <main className="message-state">
      <p className="eyebrow">Mission Control</p>
      <h1>{title}</h1>
      <p>{description}</p>
      {onRetry && (
        <button className="button primary" type="button" onClick={onRetry}>
          {retryText ?? "Retry"}
        </button>
      )}
    </main>
  );
}

function StatusMarker({ item, compact = false }: { item: MissionSessionViewModel; compact?: boolean }) {
  return (
    <span
      className={`status-marker marker-${item.presentation.marker} tone-${item.presentation.tone} ${compact ? "is-compact" : ""}`}
      aria-hidden="true"
    />
  );
}

function CategoryBadge({ category }: { category: OperationalCategory }) {
  const presentation = getCategoryPresentation(category);
  return (
    <span className={`category-badge tone-${presentation.tone}`}>
      <span className={`badge-shape marker-${presentation.marker}`} aria-hidden="true" />
      {presentation.label}
    </span>
  );
}

function SignalStrip({
  data,
  historyCount,
}: {
  data: MissionControlResponse;
  historyCount: number;
}) {
  const ordered: OperationalCategory[] = ["needs_action", "degraded_active", "review", "live", "unknown"];

  return (
    <section className="signal-strip" aria-label="Operational status counts">
      {ordered.map((category) => {
        const presentation = getCategoryPresentation(category);
        const href =
          category === "needs_action" ? "/needs-action"
            : category === "review" ? "/review"
              : "/";
        return (
          <a key={category} className={`signal-cell tone-${presentation.tone}`} href={href}>
            <span className={`signal-shape marker-${presentation.marker}`} aria-hidden="true" />
            <span>{presentation.label}</span>
            <strong>{data.totals[category] ?? 0}</strong>
          </a>
        );
      })}
      <a className="signal-cell tone-history is-secondary" href="/history">
        <span className="signal-shape marker-outline" aria-hidden="true" />
        <span>History</span>
        <strong>{historyCount}</strong>
      </a>
    </section>
  );
}

function SessionRow({ item }: { item: MissionSessionViewModel }) {
  return (
    <article className={`session-row tone-${item.presentation.tone}`} data-category={item.category}>
      <div className="session-row-state">
        <StatusMarker item={item} />
        <CategoryBadge category={item.category} />
      </div>
      <a className="session-row-main" href={`/session/${encodeURIComponent(item.id)}`}>
        <strong>{item.agentName}</strong>
        <span>{item.repoName}</span>
        <p>{item.objective}</p>
      </a>
      <div className="session-row-meta">
        <span>{item.lastSignalAge}</span>
        <span>{item.freshness}</span>
        {item.confidenceLabel && <span>{item.confidenceLabel}</span>}
      </div>
      <div className="session-row-action">
        <b>{item.nextAction}</b>
        <small>{item.reason}</small>
      </div>
      <a className="row-link" href={`/session/${encodeURIComponent(item.id)}/replay`}>
        Replay
      </a>
    </article>
  );
}

function MissionLane({ lane }: { lane: MissionLaneViewModel }) {
  const primaryCategory = lane.categories[0];
  const presentation = getCategoryPresentation(primaryCategory);

  return (
    <section className={`mission-lane lane-${lane.id} tone-${presentation.tone}`} aria-labelledby={`${lane.id}-title`}>
      <div className="lane-status">
        <span className={`lane-light marker-${presentation.marker}`} aria-hidden="true" />
        <div>
          <p className="eyebrow">{lane.description}</p>
          <h2 id={`${lane.id}-title`}>{lane.label}</h2>
        </div>
        <strong>{lane.count}</strong>
      </div>

      <div className="lane-items">
        {lane.visibleSessions.length === 0 ? (
          <p className="lane-empty">Clear</p>
        ) : (
          lane.visibleSessions.map((item) => <SessionRow key={item.id} item={item} />)
        )}
        {lane.hiddenCount > 0 && (
          <a className="more-link" href={`/${lane.id === "needs_action" ? "needs-action" : lane.id === "review" ? "review" : ""}`}>
            +{lane.hiddenCount} more
          </a>
        )}
      </div>
    </section>
  );
}

function MissionControlPage({ focusCategory = null }: { focusCategory?: OperationalCategory | null }) {
  const [data, setData] = useState<MissionControlResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const loadData = useCallback(() => {
    setError(null);
    getMissionControl()
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => loadData(), [loadData]);
  useLiveStream(loadData);
  useHeartbeat(() => {
    setNow(new Date());
    loadData();
  });

  const board = useMemo(
    () => data ? buildMissionControlBoardViewModel(data, { focusCategory, laneLimit: focusCategory ? 8 : 3 }) : null,
    [data, focusCategory],
  );

  if (error) {
    return (
      <MessageState
        title="Mission Control is unreachable"
        description={error}
        retryText="Try again"
        onRetry={loadData}
      />
    );
  }

  if (!data || !board) {
    return <MessageState title="Reading operational truth" description="Loading the current runtime projection." />;
  }

  const lanes = focusCategory
    ? board.lanes.filter((lane) => lane.categories.includes(focusCategory))
    : board.lanes;
  const headline =
    focusCategory === "needs_action" ? "Needs Action"
      : focusCategory === "review" ? "Review"
        : "Mission Control";

  return (
    <main className="mission-control" aria-label="Andon Mission Control">
      <section className="mission-header">
        <div>
          <p className="eyebrow">Operational board</p>
          <h1>{headline}</h1>
        </div>
        <div className="mission-clock" aria-label="Refresh status">
          <strong>{formatClock(now)}</strong>
          <span>API {board.generatedAge} ago</span>
        </div>
      </section>

      <SignalStrip data={data} historyCount={board.historyCount} />

      {board.operationalTotal === 0 ? (
        <section className="all-clear" aria-label="Empty operational board">
          <span className="all-clear-light" aria-hidden="true" />
          <div>
            <h2>No operational sessions</h2>
            <p>Mission Control has no live, waiting, degraded, review, or unknown sessions from the server projection.</p>
          </div>
        </section>
      ) : (
        <section className={`board-grid ${focusCategory ? "is-focused" : ""}`} aria-label="Operational lanes">
          {lanes.map((lane) => <MissionLane key={lane.id} lane={lane} />)}
        </section>
      )}
    </main>
  );
}

function HistoryPage() {
  const [data, setData] = useState<MissionControlResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadData = useCallback(() => {
    setError(null);
    getHistory().then(setData).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => loadData(), [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

  if (error) return <MessageState title="History is unreachable" description={error} onRetry={loadData} />;
  if (!data) return <MessageState title="Reading history" description="Loading historical sessions." />;

  return (
    <main className="secondary-page">
      <section className="page-heading">
        <p className="eyebrow">Historical sessions</p>
        <h1>History</h1>
        <p>Historical rows stay out of Mission Control and collect here for audit and replay.</p>
      </section>
      <section className="history-list">
        {data.sessions.length === 0 ? (
          <p className="muted">No historical sessions recorded.</p>
        ) : (
          data.sessions.map((item) => <HistoryRow key={item.session.id} item={item.session} />)
        )}
      </section>
    </main>
  );
}

function HistoryRow({ item }: { item: SessionRecord }) {
  return (
    <a className="history-row" href={`/session/${encodeURIComponent(item.id)}`}>
      <strong>{item.agentName}</strong>
      <span>{repoName(item.repoPath)}</span>
      <p>{trimLine(item.objective, 96)}</p>
      <time>{formatDateTime(item.endedAt ?? item.lastEventAt)}</time>
    </a>
  );
}

function HealthPage() {
  const [data, setData] = useState<AndonHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getAndonHealth().then(setData).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => loadData(), [loadData]);
  useHeartbeat(loadData);

  if (error) return <MessageState title="Health is unreachable" description={error} onRetry={loadData} />;
  if (!data) return <MessageState title="Reading Andon health" description="Loading service diagnostics." />;

  return (
    <main className="secondary-page">
      <section className="page-heading">
        <p className="eyebrow">Debug</p>
        <h1>Andon Health</h1>
        <p>{data.databasePath}</p>
      </section>
      <section className="health-grid">
        {Object.entries(data.counts).map(([label, value]) => (
          <div key={label} className="health-cell">
            <span>{label.replace(/([A-Z])/g, " $1")}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      {data.warnings.length > 0 && (
        <section className="health-warnings">
          {data.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </section>
      )}
    </main>
  );
}

function DetailPage({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getSessionDetail>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getSessionDetail(sessionId).then(setData).catch((reason: Error) => setError(reason.message));
  }, [sessionId]);

  useEffect(() => loadData(), [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

  if (error) return <MessageState title="Session detail is unreachable" description={error} onRetry={loadData} />;
  if (!data) return <MessageState title="Opening session" description="Loading session detail." />;

  return (
    <main className="secondary-page detail-page">
      <section className="page-heading">
        <p className="eyebrow">Session detail</p>
        <h1>{data.session.agentName}</h1>
        <p>{data.session.objective}</p>
      </section>
      <section className="detail-grid">
        <div><span>Repo</span><strong>{repoName(data.session.repoPath)}</strong></div>
        <div><span>Status</span><strong>{data.status.status.replace(/_/g, " ")}</strong></div>
        <div><span>Phase</span><strong>{data.session.currentPhase}</strong></div>
        <div><span>Last signal</span><strong>{formatDateTime(data.session.lastEventAt)}</strong></div>
      </section>
      <section className="detail-panel">
        <h2>{data.recommendation.title}</h2>
        <p>{data.recommendation.description}</p>
        <a className="button secondary" href={`/session/${encodeURIComponent(sessionId)}/replay`}>Open replay</a>
      </section>
      <p className="page-return"><a href="/">Back to Mission Control</a></p>
    </main>
  );
}

function ReplayPage({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionReplayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setError(null);
    getSessionReplay(sessionId).then(setData).catch((reason: Error) => setError(reason.message));
  }, [sessionId]);

  useEffect(() => loadData(), [loadData]);
  useLiveStream(loadData);
  useHeartbeat(loadData);

  if (error) return <MessageState title="Replay is unreachable" description={error} onRetry={loadData} />;
  if (!data) return <MessageState title="Opening replay" description="Loading meaningful replay events." />;

  return (
    <main className="secondary-page">
      <section className="page-heading">
        <p className="eyebrow">Session replay</p>
        <h1>{data.events.length} events</h1>
        <p>{data.hiddenTelemetryCount} heartbeat/no-op telemetry event(s) hidden by the API.</p>
      </section>
      <ol className="replay-list">
        {data.events.map((event) => (
          <li key={event.id}>
            <time>{formatDateTime(event.timestamp)}</time>
            <strong>{event.kind}</strong>
            <span>{event.type}</span>
            <p>{event.summary ?? "No summary"}</p>
          </li>
        ))}
      </ol>
      <p className="page-return"><a href={`/session/${encodeURIComponent(sessionId)}`}>Back to session</a></p>
    </main>
  );
}

function pickRoute(pathname: string) {
  const replayMatch = pathname.match(/^\/session\/([^/]+)\/replay$/);
  if (replayMatch) return <ReplayPage sessionId={decodeURIComponent(replayMatch[1])} />;

  const legacyTimelineMatch = pathname.match(/^\/session\/([^/]+)\/timeline$/);
  if (legacyTimelineMatch) return <ReplayPage sessionId={decodeURIComponent(legacyTimelineMatch[1])} />;

  const detailMatch = pathname.match(/^\/session\/([^/]+)$/);
  if (detailMatch) return <DetailPage sessionId={decodeURIComponent(detailMatch[1])} />;

  if (pathname === "/needs-action") return <MissionControlPage focusCategory="needs_action" />;
  if (pathname === "/review") return <MissionControlPage focusCategory="review" />;
  if (pathname === "/history") return <HistoryPage />;
  if (pathname === "/health") return <HealthPage />;

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
