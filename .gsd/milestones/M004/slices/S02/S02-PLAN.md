# S02: Fix Sync Script Portability

**Goal:** Update buildShellSyncScript() and buildPowerShellSyncScript() to generate scripts with dynamic ROOT resolution using script directory as anchor
**Demo:** After this: Sync scripts work on any machine - can cd to subdirectory and run script successfully

## Tasks
- [x] **T01: Update shell script template for dynamic ROOT** — Update shell script template in buildHelperScripts() to replace:
  ROOT='/absolute/path'
With:
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

This resolves from .holistic/system/script.sh up two levels to repo root.
Add validation that ROOT/.git exists, error if not.
  - Estimate: 20m
  - Files: src/core/setup.ts
  - Verify: grep -q 'SCRIPT_DIR.*dirname' src/core/setup.ts
- [x] **T02: Update PowerShell script template for dynamic ROOT** — Update PowerShell script template in buildHelperScripts() to replace:
  $root = 'C:\\absolute\\path'
With:
  $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

This resolves from .holistic\system\script.ps1 up two levels to repo root.
Add validation that $root\.git exists, error if not.
  - Estimate: 20m
  - Files: src/core/setup.ts
  - Verify: grep -q 'Split-Path.*PSScriptRoot' src/core/setup.ts
- [x] **T03: End-to-end verification of portable sync scripts** — Regenerate helper scripts in test repo and verify:
1. Run holistic init to regenerate scripts
2. cd to subdirectory (e.g., src/)
3. Run ../.holistic/system/sync-state.sh
4. Verify script succeeds and uses correct repo root
5. Move repo to different path
6. Run script again, verify it still works
7. Test on Windows with PowerShell script
  - Estimate: 30m
  - Verify: Manual: cd src && ../.holistic/system/sync-state.sh succeeds
