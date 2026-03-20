# Roadmap: Cross-Device State Sync

**Priority:** High  
**Complexity:** Medium-High  
**Dependencies:** Daemon (for auto-sync), Git integration (already exists)  
**Estimated effort:** 2-3 sessions  
**Affected areas:** `sync`, `git-integration`, `cli`, `state-management`

## Goal

Make cross-device continuity seamless by automating state synchronization via the dedicated `holistic/state` branch. Users should be able to start work on laptop, continue on tablet, finish on desktop - without manual git branch manipulation.

## Current State

- ✅ Dedicated state branch concept documented in `zero-touch.md`
- ✅ Manual sync scripts exist (`.holistic/system/sync-state.ps1`, `restore-state.sh`)
- ❌ Not integrated into CLI workflow
- ❌ No auto-sync after handoff
- ❌ No conflict resolution strategy
- ❌ No pull/merge on session start
- ❌ Manual script execution required

## Success Criteria

1. `holistic handoff` automatically pushes state to `holistic/state` branch
2. `holistic resume` automatically pulls latest state on new device
3. Conflict resolution when two devices both create handoffs offline
4. State branch never merges into working branch (remains orphan)
5. Works without daemon (manual sync) and with daemon (auto-sync)
6. Clear user feedback about sync status and conflicts
7. Portable across all git remotes (GitHub, GitLab, self-hosted, etc.)

## Implementation Plan

### Phase 1: CLI Integration for Sync (Session 1)

**Tasks:**

1. **Add `holistic sync` command:**
   ```typescript
   // src/cli.ts
   async function handleSync(rootDir: string, parsed: ParsedArgs): Promise<number> {
     const { state, paths } = loadState(rootDir);
     const remote = firstFlag(parsed.flags, "remote", "origin");
     const stateBranch = firstFlag(parsed.flags, "state-branch", "holistic/state");
     
     // Steps:
     // 1. Create orphan state branch if it doesn't exist locally
     // 2. Commit current .holistic/ to state branch
     // 3. Push to remote state branch
     // 4. Update state.lastSyncedAt timestamp
     
     return 0;
   }
   ```

2. **Add `holistic pull` command:**
   ```typescript
   async function handlePull(rootDir: string, parsed: ParsedArgs): Promise<number> {
     const { state, paths } = loadState(rootDir);
     const remote = firstFlag(parsed.flags, "remote", "origin");
     const stateBranch = firstFlag(parsed.flags, "state-branch", "holistic/state");
     
     // Steps:
     // 1. Fetch remote state branch
     // 2. Check for conflicts with local state
     // 3. If clean: checkout state branch files into .holistic/
     // 4. If conflicts: show diff and prompt for resolution
     // 5. Update state.lastPulledAt timestamp
     
     return 0;
   }
   ```

3. **Create sync helper module `src/core/sync.ts`:**
   ```typescript
   import { execSync } from "node:child_process";
   import fs from "node:fs";
   import path from "node:path";
   
   export interface SyncConfig {
     remote: string;
     stateBranch: string;
     autoSync: boolean;
   }
   
   export interface SyncResult {
     success: boolean;
     action: "pushed" | "pulled" | "conflict" | "skip";
     message: string;
     conflicts?: string[];
   }
   
   export function pushStateToRemote(rootDir: string, config: SyncConfig): SyncResult {
     try {
       // Create orphan branch if needed
       const branchExists = execSync(`git rev-parse --verify ${config.stateBranch}`, { cwd: rootDir, stdio: "pipe" });
       
       if (!branchExists) {
         execSync(`git checkout --orphan ${config.stateBranch}`, { cwd: rootDir });
         execSync(`git rm -rf .`, { cwd: rootDir });
       } else {
         execSync(`git checkout ${config.stateBranch}`, { cwd: rootDir });
       }
       
       // Copy .holistic/ to root for clean commit
       execSync(`git add .holistic/`, { cwd: rootDir });
       execSync(`git commit -m "holistic: sync state at ${new Date().toISOString()}"`, { cwd: rootDir });
       
       // Push to remote
       execSync(`git push ${config.remote} ${config.stateBranch}`, { cwd: rootDir });
       
       // Return to working branch
       execSync(`git checkout -`, { cwd: rootDir });
       
       return {
         success: true,
         action: "pushed",
         message: `State synced to ${config.remote}/${config.stateBranch}`
       };
     } catch (error) {
       return {
         success: false,
         action: "skip",
         message: error instanceof Error ? error.message : String(error)
       };
     }
   }
   
   export function pullStateFromRemote(rootDir: string, config: SyncConfig): SyncResult {
     // Implementation for pulling and merging state
     // Returns conflict info if local and remote both changed
   }
   
   export function resolveStateConflict(
     rootDir: string, 
     strategy: "local" | "remote" | "merge"
   ): SyncResult {
     // Implementation for conflict resolution
   }
   ```

4. **Update `HolisticState` type to track sync status:**
   ```typescript
   export interface HolisticState {
     // ... existing fields ...
     syncStatus?: {
       lastSyncedAt: string | null;
       lastPulledAt: string | null;
       remote: string;
       stateBranch: string;
       hasConflicts: boolean;
     };
   }
   ```

**Validation:**
```bash
# Device A: Make changes and sync
holistic checkpoint --reason "Test sync"
holistic sync
git log holistic/state  # Verify commit exists

# Device B: Clone repo and pull state
git clone <repo>
cd <repo>
holistic pull
cat .holistic/state.json  # Should show Device A's checkpoint
```

---

### Phase 2: Auto-Sync Integration (Session 2)

**Tasks:**

1. **Auto-sync on handoff:**
   ```typescript
   // src/core/state.ts - in applyHandoff()
   export function applyHandoff(rootDir: string, state: HolisticState, input: HandoffInput): HolisticState {
     // ... existing handoff logic ...
     
     // Auto-sync if enabled
     if (state.syncStatus?.autoSync) {
       const syncResult = pushStateToRemote(rootDir, {
         remote: state.syncStatus.remote,
         stateBranch: state.syncStatus.stateBranch,
         autoSync: true
       });
       
       if (syncResult.success) {
         nextState.syncStatus.lastSyncedAt = now();
       }
     }
     
     return nextState;
   }
   ```

2. **Auto-pull on resume:**
   ```typescript
   // src/core/state.ts - in continueFromLatest()
   export function continueFromLatest(rootDir: string, state: HolisticState, agent: AgentName): HolisticState {
     // Auto-pull if enabled
     if (state.syncStatus?.autoSync) {
       const pullResult = pullStateFromRemote(rootDir, {
         remote: state.syncStatus.remote,
         stateBranch: state.syncStatus.stateBranch,
         autoSync: true
       });
       
       if (pullResult.action === "conflict") {
         // Prompt user for conflict resolution
         process.stdout.write(`⚠️  State sync conflict detected!\n`);
         process.stdout.write(`Local and remote both have changes.\n\n`);
         // ... show conflict resolution options ...
       } else if (pullResult.success) {
         state.syncStatus.lastPulledAt = now();
       }
     }
     
     // ... rest of resume logic ...
   }
   ```

3. **Add sync config to `holistic init`:**
   ```typescript
   async function handleInit(rootDir: string, parsed: ParsedArgs): Promise<number> {
     const result = initializeHolistic(rootDir, {
       // ... existing options ...
       enableAutoSync: firstFlag(parsed.flags, "auto-sync") === "true",
       remote: firstFlag(parsed.flags, "remote", "origin"),
       stateBranch: firstFlag(parsed.flags, "state-branch", "holistic/state")
     });
     
     // ... existing init logic ...
   }
   ```

4. **Update `.holistic/config.json` schema:**
   ```json
   {
     "projectName": "holistic",
     "remote": "origin",
     "stateBranch": "holistic/state",
     "sync": {
       "enabled": true,
       "autoSync": true,
       "pullOnResume": true,
       "pushOnHandoff": true,
       "conflictStrategy": "prompt"  // "local" | "remote" | "merge" | "prompt"
     }
   }
   ```

**Validation:**
```bash
# Device A: Enable auto-sync
holistic init --auto-sync

# Make changes and handoff
echo "test" >> README.md
holistic checkpoint --reason "test"
holistic handoff  # Should auto-sync

# Verify remote state branch updated
git ls-remote origin holistic/state  # Should show recent commit

# Device B: Resume should auto-pull
holistic resume  # Should show Device A's handoff
```

---

### Phase 3: Conflict Resolution (Session 3)

**Tasks:**

1. **Detect conflicts:**
   ```typescript
   export function detectStateConflict(
     localState: HolisticState,
     remoteState: HolisticState
   ): ConflictInfo | null {
     // Conflict exists if:
     // 1. Both have pending commits
     // 2. Both have different activeSession IDs
     // 3. lastHandoff timestamps diverge
     
     if (localState.lastHandoff?.sessionId !== remoteState.lastHandoff?.sessionId) {
       return {
         type: "divergent-handoffs",
         local: localState.lastHandoff,
         remote: remoteState.lastHandoff,
         canAutoMerge: false
       };
     }
     
     if (localState.activeSession && remoteState.activeSession && 
         localState.activeSession.id !== remoteState.activeSession.id) {
       return {
         type: "concurrent-sessions",
         local: localState.activeSession,
         remote: remoteState.activeSession,
         canAutoMerge: true  // Can merge pending work
       };
     }
     
     return null;
   }
   ```

2. **Auto-merge when safe:**
   ```typescript
   export function autoMergeState(
     local: HolisticState,
     remote: HolisticState
   ): HolisticState {
     // Safe auto-merge rules:
     // 1. Combine pendingWork from both
     // 2. Use newer lastHandoff
     // 3. Preserve local activeSession if exists, else remote
     // 4. Merge unique items from arrays (workDone, references, etc.)
     
     return {
       ...local,
       pendingWork: [...local.pendingWork, ...remote.pendingWork],
       lastHandoff: (local.lastHandoff?.createdAt || "") > (remote.lastHandoff?.createdAt || "")
         ? local.lastHandoff
         : remote.lastHandoff,
       // ... merge other fields ...
     };
   }
   ```

3. **Interactive conflict resolution:**
   ```typescript
   async function handleConflict(
     local: HolisticState,
     remote: HolisticState,
     conflict: ConflictInfo
   ): Promise<HolisticState> {
     const rl = createInterface({ input, output });
     
     process.stdout.write(`\n⚠️  State Sync Conflict\n\n`);
     process.stdout.write(`Conflict type: ${conflict.type}\n\n`);
     
     if (conflict.type === "divergent-handoffs") {
       process.stdout.write(`Local handoff:  ${local.lastHandoff?.summary}\n`);
       process.stdout.write(`Remote handoff: ${remote.lastHandoff?.summary}\n\n`);
       
       const choice = await rl.question(`Resolution:\n  1. Keep local\n  2. Keep remote\n  3. Merge both as pending work\n\nChoice [1-3]: `);
       
       switch (choice) {
         case "1":
           return local;
         case "2":
           return remote;
         case "3":
           return autoMergeState(local, remote);
         default:
           throw new Error("Invalid choice");
       }
     }
     
     // ... handle other conflict types ...
   }
   ```

4. **Add `holistic sync-status` command:**
   ```typescript
   async function handleSyncStatus(rootDir: string): Promise<number> {
     const { state } = loadState(rootDir);
     
     process.stdout.write(`Holistic Sync Status\n\n`);
     process.stdout.write(`Remote: ${state.syncStatus?.remote || "not configured"}\n`);
     process.stdout.write(`State branch: ${state.syncStatus?.stateBranch || "not configured"}\n`);
     process.stdout.write(`Auto-sync: ${state.syncStatus?.autoSync ? "enabled" : "disabled"}\n`);
     process.stdout.write(`Last synced: ${state.syncStatus?.lastSyncedAt || "never"}\n`);
     process.stdout.write(`Last pulled: ${state.syncStatus?.lastPulledAt || "never"}\n`);
     process.stdout.write(`Conflicts: ${state.syncStatus?.hasConflicts ? "⚠️  YES" : "✓ No"}\n\n`);
     
     // Check if remote is ahead
     const remoteCommit = execSync(`git rev-parse origin/${state.syncStatus?.stateBranch}`, { cwd: rootDir, stdio: "pipe" }).toString().trim();
     const localCommit = execSync(`git rev-parse ${state.syncStatus?.stateBranch}`, { cwd: rootDir, stdio: "pipe" }).toString().trim();
     
     if (remoteCommit !== localCommit) {
       process.stdout.write(`⚠️  Remote state is ahead. Run \`holistic pull\` to sync.\n`);
     } else {
       process.stdout.write(`✓ Local and remote are in sync.\n`);
     }
     
     return 0;
   }
   ```

**Validation:**
```bash
# Device A: Create handoff offline
git config remote.origin.url /dev/null  # Simulate offline
holistic handoff

# Device B: Create different handoff offline
holistic handoff

# Device A: Go online and sync
git config remote.origin.url <real-url>
holistic sync

# Device B: Try to pull
holistic pull
# Should detect conflict and prompt for resolution
```

---

## Testing Strategy

### Unit Tests
- State conflict detection logic
- Auto-merge rules
- Orphan branch creation
- Git command error handling

### Integration Tests

1. **Happy path - single device:**
   ```bash
   # Init with auto-sync
   # Make changes
   # Handoff (auto-pushes)
   # Resume on same device (no-op pull)
   ```

2. **Cross-device - no conflicts:**
   ```bash
   # Device A: handoff and sync
   # Device B: pull and resume
   # Verify Device B sees Device A's work
   ```

3. **Cross-device - concurrent work:**
   ```bash
   # Device A: offline, create handoff
   # Device B: offline, create different handoff
   # Device A: sync
   # Device B: pull -> conflict
   # Resolve with merge strategy
   # Verify both handoffs preserved as pending work
   ```

4. **Orphan branch isolation:**
   ```bash
   # Verify state branch has no common history with main
   git merge-base main holistic/state  # Should fail
   ```

5. **Daemon + auto-sync:**
   ```bash
   # Device A: daemon running, auto-sync enabled
   # Make changes -> auto-checkpoint -> auto-sync
   # Device B: resume -> auto-pull -> see Device A's checkpoint
   ```

---

## Configuration

Add to `.holistic/config.json`:
```json
{
  "sync": {
    "enabled": true,
    "autoSync": true,
    "pullOnResume": true,
    "pushOnHandoff": true,
    "pushOnCheckpoint": false,
    "conflictStrategy": "prompt",
    "stateBranch": "holistic/state",
    "remote": "origin",
    "retryAttempts": 3,
    "retryDelay": 5000
  }
}
```

---

## CLI Commands Summary

```bash
# Manual sync
holistic sync                 # Push current state to remote
holistic pull                 # Pull remote state and merge

# Status
holistic sync-status          # Show sync state and conflicts

# Configuration
holistic config sync.enabled true
holistic config sync.autoSync true
holistic config sync.conflictStrategy merge

# Conflict resolution (when prompted)
holistic resolve-conflict --strategy local   # Keep local state
holistic resolve-conflict --strategy remote  # Use remote state
holistic resolve-conflict --strategy merge   # Auto-merge both
```

---

## Documentation Updates

1. Update `README.md` with cross-device setup instructions
2. Add `docs/cross-device-sync.md` with:
   - How state sync works
   - Setting up on multiple devices
   - Conflict resolution strategies
   - Troubleshooting offline scenarios
3. Update `zero-touch.md` to reflect automated sync
4. Add sync status to `holistic resume` output

---

## Future Enhancements

- **Cloud-native backends:** Sync via S3/Google Cloud Storage instead of git
- **Real-time sync:** WebSocket-based instant sync across devices
- **Selective sync:** Choose which sessions/pending work to sync
- **Sync analytics:** Track which device created which sessions
- **Mobile app:** Native mobile client that syncs state
- **Conflict visualization:** Web UI showing state diff and merge preview

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| State branch accidentally merges into main | Critical | Git hooks to prevent merge, documentation warnings |
| Sync fails mid-operation, corrupt state | High | Atomic commits, rollback on error, state backups |
| Large repos slow down sync | Medium | Only sync `.holistic/` (small), use shallow fetches |
| Network issues cause sync failures | Medium | Retry logic with exponential backoff, queue for later |
| Two devices create same session ID (timestamp collision) | Low | Use higher-precision timestamps + device ID suffix |

---

## Success Metrics

- [ ] Auto-sync works on all platforms (Windows, macOS, Linux)
- [ ] Zero manual git commands needed for cross-device continuity
- [ ] Conflict resolution succeeds >95% of time with auto-merge
- [ ] State branch remains orphan (no common history with working branches)
- [ ] Sync operation completes in <3 seconds on average
- [ ] Users report "it just works" across devices
- [ ] No data loss in conflict scenarios (both states preserved)
