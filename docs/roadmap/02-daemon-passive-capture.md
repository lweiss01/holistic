# Roadmap: Daemon Passive Capture

**Priority:** High  
**Complexity:** Medium  
**Dependencies:** None (daemon scaffold already exists)  
**Estimated effort:** 2-3 sessions  
**Affected areas:** `daemon`, `state-management`, `git-integration`

## Goal

Enable true zero-touch background capture where the daemon watches the repo and creates automatic checkpoints when meaningful changes occur, without requiring manual `holistic checkpoint` commands.

## Current State

- ✅ Daemon scaffold exists in `src/daemon.ts`
- ✅ `holistic watch` foreground mode works
- ✅ Checkpoint logic is solid
- ❌ No background file watcher
- ❌ No auto-start/service installation
- ❌ No smart debouncing
- ❌ Daemon status/health checks missing

## Success Criteria

1. Daemon runs in background and survives terminal close
2. Auto-detects meaningful repo changes (commits, file edits, branch switches)
3. Creates checkpoints automatically without user intervention
4. Configurable watch interval and sensitivity
5. Platform-specific service installers (Windows Task Scheduler, macOS LaunchAgent, Linux systemd)
6. `holistic daemon status` shows if running and last checkpoint time
7. Graceful restart after crash or reboot

## Implementation Plan

### Phase 1: Background File Watcher (Session 1)

**Tasks:**
1. Add `chokidar` dependency for robust file watching
2. Implement smart change detection:
   - Watch `.git/index` for commits
   - Watch `.git/HEAD` for branch switches
   - Watch tracked files for content changes
   - Ignore `.holistic/` and other generated files
3. Add debouncing logic:
   - Aggregate changes over configurable window (default 30s)
   - Only checkpoint if changes meet threshold (e.g., >3 files or commit happened)
4. Update `src/daemon.ts` to use watcher instead of timer
5. Add configuration options to `.holistic/config.json`:
   ```json
   {
     "daemon": {
       "watchInterval": 30,
       "minFilesForCheckpoint": 3,
       "includePatterns": ["**/*"],
       "excludePatterns": [".holistic/**", "node_modules/**"],
       "checkpointOnCommit": true,
       "checkpointOnBranchSwitch": true
     }
   }
   ```

**Validation:**
```bash
# Start daemon in foreground
holistic daemon --foreground

# In another terminal, make changes
echo "test" >> README.md
git add README.md
git commit -m "test"

# Verify checkpoint was created
cat .holistic/state.json | grep checkpointCount
```

**Regressions to guard:**
- Daemon must not checkpoint on `.holistic/` changes (infinite loop)
- Daemon must not spam checkpoints on rapid sequential edits
- Daemon must not interfere with manual checkpoints/handoffs

---

### Phase 2: Service Installation & Auto-Start (Session 2)

**Tasks:**

#### Windows (Task Scheduler)
1. Create PowerShell script `.holistic/system/install-daemon-windows.ps1`:
   ```powershell
   $action = New-ScheduledTaskAction -Execute "node" -Argument "--experimental-strip-types $PWD/node_modules/holistic/src/daemon.ts --repo $PWD"
   $trigger = New-ScheduledTaskTrigger -AtLogon
   $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
   Register-ScheduledTask -TaskName "Holistic-$($PWD -replace '[:\\]','-')" -Action $action -Trigger $trigger -Settings $settings
   ```

2. Add uninstall script `.holistic/system/uninstall-daemon-windows.ps1`

#### macOS (LaunchAgent)
1. Create plist template `.holistic/system/com.holistic.daemon.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>Label</key>
     <string>com.holistic.daemon.{{REPO_HASH}}</string>
     <key>ProgramArguments</key>
     <array>
       <string>/usr/local/bin/node</string>
       <string>--experimental-strip-types</string>
       <string>{{HOLISTIC_PATH}}/src/daemon.ts</string>
       <string>--repo</string>
       <string>{{REPO_PATH}}</string>
     </array>
     <key>RunAtLoad</key>
     <true/>
     <key>KeepAlive</key>
     <true/>
     <key>StandardOutPath</key>
     <string>{{REPO_PATH}}/.holistic/daemon.log</string>
     <key>StandardErrorPath</key>
     <string>{{REPO_PATH}}/.holistic/daemon.error.log</string>
   </dict>
   </plist>
   ```

2. Create install script `.holistic/system/install-daemon-macos.sh`:
   ```bash
   #!/bin/bash
   PLIST_PATH="$HOME/Library/LaunchAgents/com.holistic.daemon.$(echo $PWD | md5).plist"
   sed "s|{{REPO_PATH}}|$PWD|g; s|{{HOLISTIC_PATH}}|$(npm root -g)/holistic|g; s|{{REPO_HASH}}|$(echo $PWD | md5)|g" \
     .holistic/system/com.holistic.daemon.plist > "$PLIST_PATH"
   launchctl load "$PLIST_PATH"
   ```

#### Linux (systemd)
1. Create service template `.holistic/system/holistic-daemon@.service`:
   ```ini
   [Unit]
   Description=Holistic daemon for %i
   After=network.target

   [Service]
   Type=simple
   ExecStart=/usr/bin/node --experimental-strip-types %h/.local/share/holistic/src/daemon.ts --repo %i
   Restart=on-failure
   RestartSec=10

   [Install]
   WantedBy=default.target
   ```

2. Create install script `.holistic/system/install-daemon-linux.sh`

**CLI Integration:**
```bash
holistic daemon install          # Auto-detect platform and install
holistic daemon uninstall        # Remove service
holistic daemon status           # Check if running
holistic daemon logs             # Tail daemon output
holistic daemon restart          # Restart the service
```

**Validation:**
- Reboot machine, verify daemon starts automatically
- Kill daemon process, verify it restarts within 10s
- Check logs show checkpoint activity

---

### Phase 3: Daemon Health & Status (Session 3)

**Tasks:**
1. Add PID file to `.holistic/daemon.pid`
2. Add heartbeat timestamp to `.holistic/daemon-heartbeat.json`:
   ```json
   {
     "pid": 12345,
     "lastHeartbeat": "2026-03-20T14:22:15.442Z",
     "lastCheckpoint": "2026-03-20T14:20:30.100Z",
     "checkpointsSinceStart": 5,
     "startedAt": "2026-03-20T12:00:00.000Z",
     "repoPath": "/Users/lweis/Documents/holistic"
   }
   ```

3. Implement `holistic daemon status` command:
   ```
   Holistic Daemon Status
   
   Status: Running ✓
   PID: 12345
   Uptime: 2h 22m
   Last heartbeat: 3s ago
   Last checkpoint: 1m 45s ago
   Checkpoints since start: 5
   Repo: /Users/lweis/Documents/holistic
   ```

4. Add `holistic daemon logs [--tail N] [--follow]` command

5. Implement graceful shutdown on SIGTERM/SIGINT:
   - Flush current checkpoint if changes pending
   - Write final heartbeat
   - Clean up watchers
   - Remove PID file

**Validation:**
```bash
# Start daemon
holistic daemon install

# Check status
holistic daemon status  # Should show "Running"

# Make changes and verify checkpoint
echo "test" >> README.md
sleep 35  # Wait for debounce window
holistic daemon status  # checkpointsSinceStart incremented

# Check logs
holistic daemon logs --tail 10

# Graceful stop
holistic daemon stop
holistic daemon status  # Should show "Not running"
```

---

## Testing Strategy

### Unit Tests
- File watcher debouncing logic
- Change detection thresholds
- Checkpoint triggering conditions
- PID file management

### Integration Tests
1. **Auto-checkpoint on commit:**
   ```bash
   # Start daemon, make commit, verify checkpoint created
   ```

2. **No checkpoint on .holistic changes:**
   ```bash
   # Start daemon, modify .holistic/state.json, verify no new checkpoint
   ```

3. **Graceful restart:**
   ```bash
   # Start daemon, kill -9, verify restart within 10s, state preserved
   ```

4. **Cross-device sync:**
   ```bash
   # Device A: daemon running, make changes, auto-checkpoint
   # Device B: pull state branch, verify checkpoint visible
   ```

### Platform-Specific Tests
- Windows: Task Scheduler integration
- macOS: LaunchAgent plist validation
- Linux: systemd service registration

---

## Configuration

Add to `.holistic/config.json`:
```json
{
  "daemon": {
    "enabled": true,
    "watchInterval": 30,
    "minFilesForCheckpoint": 3,
    "checkpointOnCommit": true,
    "checkpointOnBranchSwitch": true,
    "logLevel": "info",
    "maxLogSize": "10MB",
    "includePatterns": ["**/*"],
    "excludePatterns": [
      ".holistic/**",
      "node_modules/**",
      ".git/**",
      "*.log"
    ]
  }
}
```

---

## Documentation Updates

1. Update `README.md` with daemon installation instructions
2. Add `docs/daemon-guide.md` with:
   - How the daemon works
   - Installation per platform
   - Configuration options
   - Troubleshooting
3. Update `HOLISTIC.md` to mention passive capture when daemon is installed
4. Add daemon status to `holistic resume` output

---

## Future Enhancements

- **Smart checkpoint naming:** "Auto-checkpoint after commit: feat(cli): add daemon status"
- **Checkpoint compression:** Consolidate rapid auto-checkpoints into one meaningful checkpoint
- **Multi-repo support:** One daemon instance watching multiple repos
- **Cloud sync integration:** Auto-push state branch after checkpoint
- **Mobile notification:** Alert when important checkpoint happens
- **Web dashboard:** Visual timeline of auto-checkpoints

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Daemon causes high CPU usage | High | Add configurable watch interval, use efficient file watcher (chokidar) |
| Infinite checkpoint loop | Critical | Strict exclusion of `.holistic/` from watch patterns |
| Daemon doesn't restart after crash | Medium | Platform service managers handle restart automatically |
| Conflicts with manual checkpoints | Medium | Checkpoint logic merges manual + auto changes gracefully |
| Large repos slow down watcher | Medium | Configurable include/exclude patterns, watch only tracked files |

---

## Success Metrics

- [ ] Daemon starts automatically on system boot (all platforms)
- [ ] Auto-checkpoints created within 30s of meaningful changes
- [ ] Zero manual `holistic checkpoint` commands needed for normal work
- [ ] Daemon uptime >99% (restarts after crashes)
- [ ] CPU usage <1% when idle, <5% during active file changes
- [ ] Cross-device sync shows auto-checkpoints without manual intervention
- [ ] Users report "it just works" - no visible daemon management needed
