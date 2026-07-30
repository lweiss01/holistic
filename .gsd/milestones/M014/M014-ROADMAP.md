# M014: Path Normalization Utility

## Vision

The scope-expansion detector uses `isPathOutsideScope(path, scope)` with a `startsWith` check against `holisticContext.expectedScope`. The PostToolUse payload audit confirmed three different path forms arrive in the hook stream on Windows. Without normalization, every path reads as uniformly in-scope or out-of-scope — a silent, total failure of the scope detector. This milestone delivers a tested normalization utility before any collector is wired, so the detector is never in a broken state.

## Owner

Andon

## Slice Overview

| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | `normalizePath` utility + unit tests | medium | — | [ ] | `normalizePath(absOrRelPath, cwd)` converts all observed path forms (abs backslash, rel backslash, forward-slash agent-typed, different-drive) to repo-relative forward-slash; unit tests cover all four forms from `docs/posttooluse-payload.md` Section 7 plus the `D:/C:` drive-letter edge case |
| S02 | Wire normalization into scope check | medium | S01 | [ ] | `isPathOutsideScope` in `packages/andon-core/src/status-engine.ts` uses the normalization utility (or equivalent logic) so the `startsWith` check against `expectedScope` is correct on Windows; existing tests still pass |

## Exit Criteria

- `normalizePath("D:\\Projects\\active\\holistic\\AGENTS.md", "D:\\Projects\\active\\holistic")` returns `"AGENTS.md"`.
- `normalizePath("packages\\andon-core\\src\\status-engine.ts", cwd)` (repo-relative backslash from Glob/Grep response) returns `"packages/andon-core/src/status-engine.ts"`.
- Both forms pass a `startsWith("packages/andon-core")` scope check correctly.
- A path on a different drive (e.g., `C:\\Users\\...`) is not treated as repo-relative.
- `isPathOutsideScope` in `status-engine.ts` uses this normalization; the scope check is not silently broken on Windows.

## Notes

No dependency on M011. Can start in parallel with the Holistic milestones — the payload audit (`docs/posttooluse-payload.md`) is already complete and is the direct input for this work.

## References

- `docs/posttooluse-payload.md` Section 7 (path-shape note — critical; read before implementing)
- `docs/SPEC-decisions-capture-andon.md` Section 3.2 (scope-expansion detector)
- `docs/SPEC-andon-ingestion-contract-addendum.md` Section 4 (build order step 1 note about path form confirmation)
- `packages/andon-core/src/status-engine.ts` — `isPathOutsideScope` consumer
