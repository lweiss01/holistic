---
estimated_steps: 7
estimated_files: 1
skills_used: []
---

# T01: Update shell script template for dynamic ROOT

Update shell script template in buildHelperScripts() to replace:
  ROOT='/absolute/path'
With:
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

This resolves from .holistic/system/script.sh up two levels to repo root.
Add validation that ROOT/.git exists, error if not.

## Inputs

- `src/core/setup.ts`

## Expected Output

- `Shell sync script template with dynamic ROOT`

## Verification

grep -q 'SCRIPT_DIR.*dirname' src/core/setup.ts

## Observability Impact

Script logs resolved ROOT path on execution
