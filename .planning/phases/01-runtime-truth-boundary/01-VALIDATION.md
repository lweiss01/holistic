---
phase: 01
slug: runtime-truth-boundary
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-29
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | custom node test harness (`tests/run-tests.ts`) |
| **Config file** | none |
| **Quick run command** | `node --experimental-strip-types tests/run-tests.ts andon` |
| **Full suite command** | `node --experimental-strip-types tests/run-tests.ts` |
| **Estimated runtime** | ~30-90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --experimental-strip-types tests/run-tests.ts andon`
- **After every plan wave:** Run `node --experimental-strip-types tests/run-tests.ts`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | RTM-01 | integration | `node --experimental-strip-types tests/run-tests.ts andon` | ✅ | ✅ green |
| 01-01-02 | 01 | 1 | RTM-02 | integration | `node --experimental-strip-types tests/run-tests.ts andon` | ✅ | ✅ green |
| 01-01-03 | 01 | 1 | RTM-03 | integration | `node --experimental-strip-types tests/run-tests.ts andon` | ✅ | ✅ green |
| 01-01-04 | 01 | 1 | RTM-04 | integration | `node --experimental-strip-types tests/run-tests.ts andon` | ✅ | ✅ green |
| 01-02-01 | 02 | 2 | RTM-01 | integration | `node --experimental-strip-types tests/run-tests.ts andon` | ✅ | ✅ green |
| 01-02-02 | 02 | 2 | RTM-02 | integration | `node --experimental-strip-types tests/run-tests.ts andon` | ✅ | ✅ green |
| 01-02-03 | 02 | 2 | RTM-03 | integration | `node --experimental-strip-types tests/run-tests.ts andon` | ✅ | ✅ green |
| 01-02-04 | 02 | 2 | RTM-04 | integration | `node --experimental-strip-types tests/run-tests.ts andon` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/andon.test.ts` — added RTM regressions and runtime-missing visibility coverage
- [x] `tests/run-tests.ts` — focused Andon execution path remains callable

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Legacy unrelated status-engine failures outside RTM scope | n/a | Existing non-phase tests remain red and are tracked separately | Re-run `npm run test:andon`; verify failures remain limited to `lastMeaningfulEvent` + `status Why` tests and do not affect RTM assertions |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-29

## Validation Audit 2026-04-29

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

## Validation Audit 2026-04-29 (Re-audit)

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

- Re-ran `node --experimental-strip-types tests/run-tests.ts --grep "Andon fleet"`: all RTM/Fleet validation tests passed.
- Re-ran `npm run test:andon` and `npm test`: two pre-existing non-RTM Andon failures remain (`lastMeaningfulEvent` and `status Why`), unchanged from prior phase notes.
