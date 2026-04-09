---
estimated_steps: 8
estimated_files: 1
skills_used: []
---

# T03: End-to-end verification of portable sync scripts

Regenerate helper scripts in test repo and verify:
1. Run holistic init to regenerate scripts
2. cd to subdirectory (e.g., src/)
3. Run ../.holistic/system/sync-state.sh
4. Verify script succeeds and uses correct repo root
5. Move repo to different path
6. Run script again, verify it still works
7. Test on Windows with PowerShell script

## Inputs

- `src/core/setup.ts`

## Expected Output

- `Verified scripts work from subdirectories and after repo move`

## Verification

Manual: cd src && ../.holistic/system/sync-state.sh succeeds

## Observability Impact

Script execution logs show resolved ROOT matches actual repo root
