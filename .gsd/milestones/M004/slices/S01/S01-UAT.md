# S01 UAT: Git Commit Execution

## Pre-Test Setup
- Ensure you have a test repository with git initialized
- Make sure Holistic is installed and configured (`npm install -g holistic` or local build)
- Verify git is available: `git --version`

## Test Cases

### TC1: Successful Commit on Handoff ✅ MUST PASS

**Steps:**
1. `cd` to a test repository
2. Make some changes to files (e.g., `echo "test" >> README.md`)
3. Run `holistic checkpoint --reason "test"`
4. Run `holistic handoff` (follow prompts or use flags)
5. Check `git log -1 --stat`

**Expected:**
- ✅ Handoff completes without errors
- ✅ Console shows `Git commit: <7-char-sha> - docs(holistic): <message>`
- ✅ `git log -1` shows the commit with correct message
- ✅ Holistic files (`.holistic/*`, `HOLISTIC.md`, etc.) are in the commit
- ✅ `.holistic/context/pending-commit.txt` does not exist

**Pass Criteria:** Commit appears in git log with Holistic files staged

---

### TC2: No Changes to Commit ✅ SHOULD PASS

**Steps:**
1. `cd` to a clean test repository (no uncommitted changes)
2. Run `holistic checkpoint --reason "test"`
3. Run `holistic handoff`

**Expected:**
- ✅ Handoff completes successfully
- ✅ Console shows `Git commit: No changes to commit` (or similar message)
- ✅ No error messages or stack traces
- ✅ State is clean

**Pass Criteria:** Graceful handling with informative message

---

### TC3: Git Not Available ⚠️ NICE TO HAVE

**Steps:**
1. Temporarily make git unavailable (rename git executable or modify PATH)
2. Run `holistic handoff`
3. Restore git

**Expected:**
- ✅ Handoff completes but shows error
- ✅ Console shows `Git commit failed: Git is not available. Please install git and try again.`
- ✅ Pending commit state is preserved (`.holistic/context/pending-commit.txt` exists)
- ✅ Console suggests running `holistic commit-done` to clear or retry manually

**Pass Criteria:** Clear error message, state preserved for retry

---

### TC4: Not a Git Repository ⚠️ EDGE CASE

**Steps:**
1. `cd` to a directory without `.git`
2. Run `holistic init` (if needed to create Holistic state)
3. Run `holistic handoff`

**Expected:**
- ✅ Handoff shows error
- ✅ Console shows `Git commit failed: Not a git repository. Cannot commit changes.`
- ✅ Clear error message guides user

**Pass Criteria:** Actionable error message about missing git repo

---

### TC5: Permission Error ⚠️ EDGE CASE (Unix/Mac only)

**Steps:**
1. `cd` to a git repository
2. Make `.git` directory read-only: `chmod 000 .git`
3. Run `holistic handoff`
4. Restore permissions: `chmod 755 .git`

**Expected:**
- ✅ Handoff shows error
- ✅ Console shows `Git commit failed: <permission error>`
- ✅ Pending commit preserved for retry
- ✅ No crash or stack trace

**Pass Criteria:** Graceful error handling, no crash

**Note:** Skip this test on Windows (different permission model)

---

### TC6: Commit Hook Failure ⚠️ NICE TO HAVE

**Steps:**
1. Create a failing pre-commit hook in `.git/hooks/`:
   ```bash
   echo '#!/bin/sh\necho "Hook failed!"\nexit 1' > .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```
2. Run `holistic handoff`
3. Remove the hook: `rm .git/hooks/pre-commit`

**Expected:**
- ✅ Console shows `Git commit failed: <hook output>`
- ✅ Hook error message ("Hook failed!") is visible to user
- ✅ Pending commit preserved for retry
- ✅ User can fix hook and retry

**Pass Criteria:** Hook error surfaced to user, state preserved

---

## Success Criteria

**Minimum for Release:**
- TC1 (Successful Commit) ✅ MUST PASS
- TC2 (No Changes) ✅ SHOULD PASS
- No crashes or uncaught exceptions

**Full Success:**
- All test cases pass with expected results
- Console output is clear and actionable
- Error messages guide user to resolution
- State management works correctly (pending commit cleared on success, preserved on failure)

## Test Execution Notes

**Date:** _______________  
**Tester:** _______________  
**Environment:** _______________

| Test Case | Pass/Fail | Notes |
|-----------|-----------|-------|
| TC1: Successful Commit | ⬜ | |
| TC2: No Changes | ⬜ | |
| TC3: Git Not Available | ⬜ | |
| TC4: Not a Git Repository | ⬜ | |
| TC5: Permission Error | ⬜ | |
| TC6: Commit Hook Failure | ⬜ | |

**Overall Result:** ⬜ Pass / ⬜ Fail

**Issues Found:**
