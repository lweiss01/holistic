# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | M001/S02 planning | architecture | How S02 should detect natural breakpoints and proactive checkpoint triggers | Use deterministic daemon thresholds (2-hour elapsed or 5 meaningful files) plus explicit checkpoint completion metadata through CLI/MCP instead of transcript parsing or a new watcher. | The existing architecture already has repo-snapshot-based passive capture and checkpoint entrypoints. Deterministic thresholds satisfy R004/R005 without adding another watcher, and explicit completion metadata gives agents a reliable way to express natural breakpoints for R006/R007 while avoiding brittle free-form text inference and draft spam. | Yes | agent |
