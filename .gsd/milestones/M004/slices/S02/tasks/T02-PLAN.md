---
estimated_steps: 6
estimated_files: 1
skills_used: []
---

# T02: Update PowerShell script template for dynamic ROOT

Update PowerShell script template in buildHelperScripts() to replace:
  $root = 'C:\\absolute\\path'
With:
  $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

This resolves from .holistic\system\script.ps1 up two levels to repo root.
Add validation that $root\.git exists, error if not.

## Inputs

- `src/core/setup.ts`

## Expected Output

- `PowerShell sync script template with dynamic ROOT`

## Verification

grep -q 'Split-Path.*PSScriptRoot' src/core/setup.ts

## Observability Impact

Script logs resolved ROOT path on execution
