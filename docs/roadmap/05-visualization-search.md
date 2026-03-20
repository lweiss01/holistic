# Roadmap: Visualization & Search

**Priority:** Medium  
**Complexity:** Medium  
**Dependencies:** Core CLI (exists), Session history (exists)  
**Estimated effort:** 2-3 sessions  
**Affected areas:** `cli`, `docs`, `ux`, `state-management`

## Goal

Make accumulated Holistic history searchable, filterable, and visualizable. As sessions grow over weeks/months, provide tools to find specific decisions, trace when bugs were introduced, and understand project evolution.

## Current State

- ✅ Session archives in `.holistic/sessions/*.json`
- ✅ Project history and regression watch docs generated
- ✅ Structured metadata available (severity, areas, outcome)
- ❌ No search functionality
- ❌ No filtering by metadata
- ❌ No timeline visualization
- ❌ No session comparison
- ❌ No export formats beyond markdown

## Success Criteria

1. `holistic search` finds sessions/work by keyword
2. `holistic timeline` shows chronological session overview
3. `holistic diff <session1> <session2>` compares sessions
4. `holistic show <session-id>` displays full session details
5. `holistic filter --areas <tags> --severity <level>` narrows results
6. HTML export for rich visualization
7. Integration with structured metadata (severity, areas, outcome)

## Implementation Plan

### Phase 1: Search & Filter CLI (Session 1)

**Tasks:**

1. **Implement `holistic search` command:**
   ```typescript
   // src/cli.ts
   async function handleSearch(rootDir: string, parsed: ParsedArgs): Promise<number> {
     const { paths } = loadState(rootDir);
     const query = firstFlag(parsed.flags, "query", "");
     const areas = listFlag(parsed.flags, "areas");
     const severity = firstFlag(parsed.flags, "severity");
     const outcome = firstFlag(parsed.flags, "outcome");
     const agent = firstFlag(parsed.flags, "agent");
     const limit = Number.parseInt(firstFlag(parsed.flags, "limit", "20"), 10);
     
     const sessions = readArchivedSessions(paths);
     const results = searchSessions(sessions, {
       query,
       areas: areas as AreaTag[],
       severity: severity as Severity,
       outcome: outcome as OutcomeStatus,
       agent: agent as AgentName,
       limit
     });
     
     renderSearchResults(results);
     return 0;
   }
   ```

2. **Create search module `src/core/search.ts`:**
   ```typescript
   import type { SessionRecord, AreaTag, Severity, OutcomeStatus, AgentName } from "./types.ts";
   
   export interface SearchCriteria {
     query?: string;              // Keyword search across all text fields
     areas?: AreaTag[];           // Filter by affected areas
     severity?: Severity;         // Filter by minimum severity
     outcome?: OutcomeStatus;     // Filter by outcome status
     agent?: AgentName;           // Filter by agent
     dateFrom?: string;           // ISO date string
     dateTo?: string;             // ISO date string
     limit?: number;
   }
   
   export interface SearchResult {
     session: SessionRecord;
     score: number;               // Relevance score 0-100
     matches: {
       field: string;
       text: string;
       highlight: string;
     }[];
   }
   
   export function searchSessions(
     sessions: SessionRecord[],
     criteria: SearchCriteria
   ): SearchResult[] {
     let filtered = sessions;
     
     // Filter by metadata
     if (criteria.areas && criteria.areas.length > 0) {
       filtered = filtered.filter(s => 
         s.affectedAreas?.some(area => criteria.areas!.includes(area))
       );
     }
     
     if (criteria.severity) {
       const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];
       const minIndex = severityOrder.indexOf(criteria.severity);
       filtered = filtered.filter(s => 
         s.severity && severityOrder.indexOf(s.severity) <= minIndex
       );
     }
     
     if (criteria.outcome) {
       filtered = filtered.filter(s => s.outcomeStatus === criteria.outcome);
     }
     
     if (criteria.agent) {
       filtered = filtered.filter(s => s.agent === criteria.agent);
     }
     
     if (criteria.dateFrom) {
       filtered = filtered.filter(s => s.startedAt >= criteria.dateFrom!);
     }
     
     if (criteria.dateTo) {
       filtered = filtered.filter(s => s.startedAt <= criteria.dateTo!);
     }
     
     // Text search with scoring
     if (criteria.query) {
       const results = filtered
         .map(session => scoreSession(session, criteria.query!))
         .filter(result => result.score > 0)
         .sort((a, b) => b.score - a.score);
       
       return results.slice(0, criteria.limit || 20);
     }
     
     // No query - just return filtered sessions with neutral score
     return filtered
       .slice(0, criteria.limit || 20)
       .map(session => ({ session, score: 50, matches: [] }));
   }
   
   function scoreSession(session: SessionRecord, query: string): SearchResult {
     const lowerQuery = query.toLowerCase();
     const matches: SearchResult["matches"] = [];
     let score = 0;
     
     // Search in various fields with different weights
     const searchFields: { field: string; text: string; weight: number }[] = [
       { field: "title", text: session.title, weight: 10 },
       { field: "goal", text: session.currentGoal, weight: 8 },
       { field: "summary", text: session.latestStatus, weight: 6 },
       { field: "workDone", text: session.workDone.join(" "), weight: 5 },
       { field: "regressionRisks", text: session.regressionRisks.join(" "), weight: 7 },
       { field: "impactNotes", text: session.impactNotes.join(" "), weight: 6 },
       { field: "references", text: session.references.join(" "), weight: 4 },
       { field: "assumptions", text: session.assumptions.join(" "), weight: 3 },
       { field: "blockers", text: session.blockers.join(" "), weight: 5 },
     ];
     
     for (const { field, text, weight } of searchFields) {
       const lowerText = text.toLowerCase();
       if (lowerText.includes(lowerQuery)) {
         score += weight;
         
         // Extract context around match
         const index = lowerText.indexOf(lowerQuery);
         const start = Math.max(0, index - 40);
         const end = Math.min(text.length, index + query.length + 40);
         const context = text.slice(start, end);
         const highlighted = context.replace(
           new RegExp(query, 'gi'),
           (match) => `**${match}**`
         );
         
         matches.push({
           field,
           text: context,
           highlight: highlighted
         });
       }
     }
     
     // Boost score for exact title match
     if (session.title.toLowerCase() === lowerQuery) {
       score += 20;
     }
     
     // Boost for recent sessions
     const ageInDays = (Date.now() - new Date(session.startedAt).getTime()) / (1000 * 60 * 60 * 24);
     if (ageInDays < 7) score += 5;
     else if (ageInDays < 30) score += 2;
     
     return { session, score, matches };
   }
   
   export function renderSearchResults(results: SearchResult[]): void {
     if (results.length === 0) {
       console.log("No sessions found matching your criteria.");
       return;
     }
     
     console.log(`\nFound ${results.length} session(s):\n`);
     
     for (const { session, score, matches } of results) {
       console.log(`## ${session.title}`);
       console.log(`   Session: ${session.id}`);
       console.log(`   Score: ${score} | Agent: ${session.agent} | When: ${session.endedAt || session.updatedAt}`);
       if (session.severity) console.log(`   Severity: ${session.severity}`);
       if (session.outcomeStatus) console.log(`   Outcome: ${session.outcomeStatus}`);
       if (session.affectedAreas) console.log(`   Areas: ${session.affectedAreas.join(", ")}`);
       
       if (matches.length > 0) {
         console.log(`\n   Matches:`);
         for (const match of matches.slice(0, 2)) {
           console.log(`     ${match.field}: ${match.highlight}`);
         }
       }
       console.log("");
     }
   }
   ```

3. **Add filter helpers:**
   ```bash
   # Usage examples
   holistic search --query "daemon"
   holistic search --query "regression" --severity critical
   holistic search --areas daemon,sync --outcome success
   holistic search --agent codex --date-from 2026-03-01
   holistic search --query "bug fix" --limit 5
   ```

**Validation:**
```bash
# Search for sessions about daemon
holistic search --query "daemon"

# Find critical regressions
holistic search --severity critical --areas state-management

# Recent successful work
holistic search --outcome success --date-from 2026-03-15
```

---

### Phase 2: Timeline & Session Details (Session 2)

**Tasks:**

1. **Implement `holistic timeline` command:**
   ```typescript
   async function handleTimeline(rootDir: string, parsed: ParsedArgs): Promise<number> {
     const { paths } = loadState(rootDir);
     const format = firstFlag(parsed.flags, "format", "text");  // text | json | html
     const limit = Number.parseInt(firstFlag(parsed.flags, "limit", "50"), 10);
     
     const sessions = readArchivedSessions(paths).slice(0, limit);
     
     if (format === "json") {
       printJson(sessions);
     } else if (format === "html") {
       await generateTimelineHtml(sessions, rootDir);
     } else {
       renderTimelineText(sessions);
     }
     
     return 0;
   }
   ```

2. **Create timeline renderer `src/core/timeline.ts`:**
   ```typescript
   import type { SessionRecord } from "./types.ts";
   
   export function renderTimelineText(sessions: SessionRecord[]): void {
     console.log(`\n📅 Holistic Timeline (${sessions.length} sessions)\n`);
     
     let currentMonth = "";
     
     for (const session of sessions) {
       const date = new Date(session.startedAt);
       const month = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
       
       if (month !== currentMonth) {
         currentMonth = month;
         console.log(`\n### ${month}\n`);
       }
       
       const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
       const statusIcon = session.outcomeStatus === "success" ? "✓" :
                         session.outcomeStatus === "failed" ? "✗" :
                         session.outcomeStatus === "partial" ? "◐" : "○";
       
       const severityBadge = session.severity ? 
         `[${session.severity.toUpperCase()}]` : "";
       
       console.log(`${dateStr} ${statusIcon} ${session.title} ${severityBadge}`);
       console.log(`       ${session.latestStatus.slice(0, 80)}${session.latestStatus.length > 80 ? "..." : ""}`);
       
       if (session.affectedAreas && session.affectedAreas.length > 0) {
         console.log(`       Areas: ${session.affectedAreas.join(", ")}`);
       }
       
       console.log("");
     }
   }
   
   export async function generateTimelineHtml(sessions: SessionRecord[], rootDir: string): Promise<void> {
     const html = `<!DOCTYPE html>
     <html>
     <head>
       <title>Holistic Timeline</title>
       <style>
         body {
           font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           max-width: 1200px;
           margin: 40px auto;
           padding: 0 20px;
           background: #f5f5f5;
         }
         .timeline {
           position: relative;
           padding-left: 40px;
         }
         .timeline::before {
           content: '';
           position: absolute;
           left: 10px;
           top: 0;
           bottom: 0;
           width: 2px;
           background: #ddd;
         }
         .session {
           position: relative;
           background: white;
           padding: 20px;
           margin: 20px 0;
           border-radius: 8px;
           box-shadow: 0 2px 4px rgba(0,0,0,0.1);
         }
         .session::before {
           content: '';
           position: absolute;
           left: -30px;
           top: 25px;
           width: 12px;
           height: 12px;
           border-radius: 50%;
           background: #007bff;
           border: 2px solid white;
         }
         .session.success::before { background: #28a745; }
         .session.failed::before { background: #dc3545; }
         .session.partial::before { background: #ffc107; }
         
         .session-header {
           display: flex;
           justify-content: space-between;
           align-items: center;
           margin-bottom: 10px;
         }
         .session-title {
           font-size: 18px;
           font-weight: 600;
           color: #333;
         }
         .session-date {
           color: #666;
           font-size: 14px;
         }
         .session-summary {
           color: #555;
           margin: 10px 0;
         }
         .badges {
           display: flex;
           gap: 8px;
           margin: 10px 0;
         }
         .badge {
           padding: 4px 8px;
           border-radius: 4px;
           font-size: 12px;
           font-weight: 500;
         }
         .badge.critical { background: #fee; color: #c00; }
         .badge.high { background: #ffeaa7; color: #d63031; }
         .badge.medium { background: #dfe6e9; color: #2d3436; }
         .badge.low { background: #e8f5e9; color: #388e3c; }
         .badge.area { background: #e3f2fd; color: #1976d2; }
         
         .work-done {
           margin-top: 15px;
           padding-top: 15px;
           border-top: 1px solid #eee;
         }
         .work-done h4 {
           font-size: 14px;
           color: #666;
           margin: 0 0 10px 0;
         }
         .work-done ul {
           margin: 0;
           padding-left: 20px;
         }
         .work-done li {
           margin: 5px 0;
           color: #555;
         }
       </style>
     </head>
     <body>
       <h1>📅 Holistic Timeline</h1>
       <p>Project history across ${sessions.length} sessions</p>
       
       <div class="timeline">
         ${sessions.map(session => `
           <div class="session ${session.outcomeStatus || 'unknown'}">
             <div class="session-header">
               <div class="session-title">${session.title}</div>
               <div class="session-date">${new Date(session.startedAt).toLocaleDateString()}</div>
             </div>
             
             <div class="badges">
               ${session.severity ? `<span class="badge ${session.severity}">${session.severity}</span>` : ''}
               <span class="badge">${session.agent}</span>
               ${session.outcomeStatus ? `<span class="badge">${session.outcomeStatus}</span>` : ''}
               ${session.affectedAreas?.map(area => `<span class="badge area">${area}</span>`).join('') || ''}
             </div>
             
             <div class="session-summary">${session.latestStatus}</div>
             
             ${session.workDone.length > 0 ? `
               <div class="work-done">
                 <h4>Work Done:</h4>
                 <ul>
                   ${session.workDone.slice(0, 5).map(item => `<li>${item}</li>`).join('')}
                 </ul>
               </div>
             ` : ''}
             
             ${session.regressionRisks.length > 0 ? `
               <div class="work-done">
                 <h4>⚠️ Regression Watch:</h4>
                 <ul>
                   ${session.regressionRisks.slice(0, 3).map(item => `<li>${item}</li>`).join('')}
                 </ul>
               </div>
             ` : ''}
           </div>
         `).join('')}
       </div>
       
       <script>
         // Add interactivity: click session to expand/collapse
         document.querySelectorAll('.session').forEach(el => {
           el.addEventListener('click', () => {
             el.classList.toggle('expanded');
           });
         });
       </script>
     </body>
     </html>`;
     
     const fs = await import("node:fs");
     const path = await import("node:path");
     const outputPath = path.join(rootDir, ".holistic", "timeline.html");
     fs.writeFileSync(outputPath, html, "utf8");
     
     console.log(`✓ Timeline exported to: ${outputPath}`);
     console.log(`  Open in browser to view rich visualization.`);
   }
   ```

3. **Implement `holistic show <session-id>` command:**
   ```typescript
   async function handleShow(rootDir: string, parsed: ParsedArgs): Promise<number> {
     const { paths } = loadState(rootDir);
     const sessionId = firstFlag(parsed.flags, "id");
     const format = firstFlag(parsed.flags, "format", "text");
     
     if (!sessionId) {
       process.stderr.write("Error: --id required\n");
       return 1;
     }
     
     const sessionPath = path.join(paths.sessionsDir, `${sessionId}.json`);
     if (!fs.existsSync(sessionPath)) {
       process.stderr.write(`Error: Session ${sessionId} not found\n`);
       return 1;
     }
     
     const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as SessionRecord;
     
     if (format === "json") {
       printJson(session);
     } else {
       renderSessionDetail(session);
     }
     
     return 0;
   }
   
   function renderSessionDetail(session: SessionRecord): void {
     console.log(`\n## ${session.title}\n`);
     console.log(`Session ID: ${session.id}`);
     console.log(`Agent: ${session.agent}`);
     console.log(`Status: ${session.status}`);
     console.log(`Started: ${session.startedAt}`);
     console.log(`Ended: ${session.endedAt || "ongoing"}`);
     
     if (session.severity) console.log(`Severity: ${session.severity}`);
     if (session.outcomeStatus) console.log(`Outcome: ${session.outcomeStatus}`);
     if (session.affectedAreas) console.log(`Areas: ${session.affectedAreas.join(", ")}`);
     if (session.relatedSessions) console.log(`Related: ${session.relatedSessions.join(", ")}`);
     
     console.log(`\n### Goal\n${session.currentGoal}\n`);
     console.log(`### Summary\n${session.latestStatus}\n`);
     
     if (session.workDone.length > 0) {
       console.log(`### Work Done\n${session.workDone.map(i => `- ${i}`).join("\n")}\n`);
     }
     
     if (session.impactNotes.length > 0) {
       console.log(`### Impact\n${session.impactNotes.map(i => `- ${i}`).join("\n")}\n`);
     }
     
     if (session.regressionRisks.length > 0) {
       console.log(`### Regression Risks\n${session.regressionRisks.map(i => `- ${i}`).join("\n")}\n`);
     }
     
     if (session.references.length > 0) {
       console.log(`### References\n${session.references.map(i => `- ${i}`).join("\n")}\n`);
     }
     
     console.log(`### Checkpoints: ${session.checkpointCount}\n`);
   }
   ```

**Validation:**
```bash
# View timeline
holistic timeline

# Export HTML timeline
holistic timeline --format html
open .holistic/timeline.html

# Show specific session
holistic show --id session-2026-03-19T19-30-32-935Z
```

---

### Phase 3: Session Comparison & Advanced Queries (Session 3)

**Tasks:**

1. **Implement `holistic diff` command:**
   ```typescript
   async function handleDiff(rootDir: string, parsed: ParsedArgs): Promise<number> {
     const { paths } = loadState(rootDir);
     const id1 = firstFlag(parsed.flags, "from");
     const id2 = firstFlag(parsed.flags, "to");
     
     if (!id1 || !id2) {
       process.stderr.write("Error: --from and --to required\n");
       return 1;
     }
     
     const session1 = loadSessionById(paths, id1);
     const session2 = loadSessionById(paths, id2);
     
     if (!session1 || !session2) {
       process.stderr.write("Error: One or both sessions not found\n");
       return 1;
     }
     
     renderSessionDiff(session1, session2);
     return 0;
   }
   
   function renderSessionDiff(s1: SessionRecord, s2: SessionRecord): void {
     console.log(`\n## Comparing Sessions\n`);
     console.log(`FROM: ${s1.title} (${s1.id})`);
     console.log(`TO:   ${s2.title} (${s2.id})\n`);
     
     console.log(`### Time Span`);
     console.log(`${s1.startedAt} → ${s2.startedAt}\n`);
     
     console.log(`### Changed Areas`);
     const allAreas = new Set([...(s1.affectedAreas || []), ...(s2.affectedAreas || [])]);
     console.log(Array.from(allAreas).join(", ") || "No areas tracked\n");
     
     console.log(`### File Changes`);
     const newFiles = s2.changedFiles.filter(f => !s1.changedFiles.includes(f));
     console.log(`New files: ${newFiles.length > 0 ? newFiles.join(", ") : "none"}\n`);
     
     console.log(`### Work Progress`);
     const newWork = s2.workDone.filter(w => !s1.workDone.includes(w));
     if (newWork.length > 0) {
       console.log("Added work:");
       newWork.forEach(w => console.log(`  + ${w}`));
     }
     console.log("");
     
     console.log(`### Regressions`);
     const newRisks = s2.regressionRisks.filter(r => !s1.regressionRisks.includes(r));
     if (newRisks.length > 0) {
       console.log("New regression risks:");
       newRisks.forEach(r => console.log(`  ⚠️  ${r}`));
     }
     console.log("");
   }
   ```

2. **Add aggregation queries:**
   ```typescript
   // src/cli.ts
   async function handleStats(rootDir: string): Promise<number> {
     const { paths } = loadState(rootDir);
     const sessions = readArchivedSessions(paths);
     
     console.log(`\n📊 Holistic Statistics\n`);
     console.log(`Total sessions: ${sessions.length}`);
     
     // By agent
     const byAgent = groupBy(sessions, s => s.agent);
     console.log(`\nBy agent:`);
     Object.entries(byAgent).forEach(([agent, list]) => {
       console.log(`  ${agent}: ${list.length}`);
     });
     
     // By outcome
     const byOutcome = groupBy(sessions.filter(s => s.outcomeStatus), s => s.outcomeStatus!);
     console.log(`\nBy outcome:`);
     Object.entries(byOutcome).forEach(([outcome, list]) => {
       console.log(`  ${outcome}: ${list.length}`);
     });
     
     // By severity
     const bySeverity = groupBy(sessions.filter(s => s.severity), s => s.severity!);
     console.log(`\nBy severity:`);
     Object.entries(bySeverity).forEach(([severity, list]) => {
       console.log(`  ${severity}: ${list.length}`);
     });
     
     // Top areas
     const areaCount: Record<string, number> = {};
     sessions.forEach(s => {
       s.affectedAreas?.forEach(area => {
         areaCount[area] = (areaCount[area] || 0) + 1;
       });
     });
     console.log(`\nTop affected areas:`);
     Object.entries(areaCount)
       .sort((a, b) => b[1] - a[1])
       .slice(0, 5)
       .forEach(([area, count]) => console.log(`  ${area}: ${count}`));
     
     // Recent activity
     const last7Days = sessions.filter(s => {
       const age = Date.now() - new Date(s.startedAt).getTime();
       return age < 7 * 24 * 60 * 60 * 1000;
     });
     console.log(`\nLast 7 days: ${last7Days.length} sessions\n`);
     
     return 0;
   }
   
   function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
     return arr.reduce((acc, item) => {
       const key = fn(item);
       acc[key] = acc[key] || [];
       acc[key].push(item);
       return acc;
     }, {} as Record<string, T[]>);
   }
   ```

**Validation:**
```bash
# Compare two sessions
holistic diff --from session-2026-03-19T19-30-32-935Z --to session-2026-03-20T00-07-50-104Z

# View stats
holistic stats
```

---

## CLI Commands Summary

```bash
# Search
holistic search --query "daemon"
holistic search --areas daemon,sync --severity high
holistic search --outcome success --limit 10

# Timeline
holistic timeline                    # Text format
holistic timeline --format html      # Rich visualization
holistic timeline --limit 100        # Show more sessions

# Session details
holistic show --id session-2026-03-19T19-30-32-935Z
holistic show --id <id> --format json

# Comparison
holistic diff --from <id1> --to <id2>

# Statistics
holistic stats
```

---

## Testing Strategy

### Unit Tests
- Search scoring algorithm
- Metadata filtering logic
- Timeline grouping by date
- Session diff comparison

### Integration Tests
1. Search finds sessions with keyword
2. Filter by severity returns only matching sessions
3. Timeline HTML generates valid markup
4. Session diff shows correct changes
5. Stats aggregate correctly across all sessions

---

## Documentation

1. Update README with search/visualization examples
2. Add `docs/visualization.md` with:
   - Search syntax guide
   - Filter combinations
   - HTML timeline features
   - Advanced query patterns
3. Add screenshots of HTML timeline to docs
4. Update HOLISTIC.md to mention search capabilities

---

## Future Enhancements

- **Interactive web dashboard:** Full SPA with filtering, sorting, searching
- **Graph visualization:** Show session relationships, affected areas over time
- **Export formats:** CSV, PDF, Notion, Obsidian
- **Advanced analytics:**
  - Regression heatmap (which areas regress most)
  - Velocity tracking (checkpoints per day)
  - Agent comparison (success rate by agent)
- **AI-powered insights:** "Suggest next session based on history"
- **Slack/Discord integration:** Post daily/weekly summaries

---

## Success Metrics

- [ ] Search returns relevant results in <1s for 100+ sessions
- [ ] Timeline HTML loads in <2s for 50+ sessions
- [ ] Filters reduce results accurately based on metadata
- [ ] Session diff clearly shows what changed between two points
- [ ] Stats provide actionable insights about project health
- [ ] Users report finding old decisions faster than grepping raw JSON
- [ ] HTML export is shareable with team members
