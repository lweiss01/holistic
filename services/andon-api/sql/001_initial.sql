PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  runtime_name TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  objective TEXT NOT NULL,
  current_phase TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  last_event_at TEXT NOT NULL,
  last_summary TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  phase TEXT NOT NULL,
  state TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  runtime_name TEXT,
  type TEXT NOT NULL,
  phase TEXT,
  source TEXT NOT NULL,
  summary TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_sessions (
  id TEXT PRIMARY KEY,
  runtime_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  worktree_path TEXT,
  branch TEXT,
  status TEXT NOT NULL,
  activity TEXT NOT NULL,
  pid INTEGER,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS runtime_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES runtime_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  severity TEXT,
  message TEXT,
  activity TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS runtime_approvals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES runtime_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  resolved_at TEXT,
  prompt TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS runtime_processes (
  session_id TEXT PRIMARY KEY REFERENCES runtime_sessions(id) ON DELETE CASCADE,
  pid INTEGER,
  command TEXT,
  cwd TEXT,
  started_at TEXT NOT NULL,
  last_heartbeat_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_last_event_at ON sessions(last_event_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_session_state ON tasks(session_id, state);
CREATE INDEX IF NOT EXISTS idx_events_session_created_at ON events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_updated_at ON runtime_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_status ON runtime_sessions(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_events_session_timestamp ON runtime_events(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_approvals_status_requested_at ON runtime_approvals(status, requested_at DESC);
