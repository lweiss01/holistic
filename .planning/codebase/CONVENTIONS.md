# Coding Conventions

**Analysis Date:** 2026-04-29

## Naming Patterns

**Files:**
- Use `kebab-case` for most files (`tests/runtime-service.test.ts`, `services/andon-api/src/runtime-repository.ts`, `apps/andon-dashboard/src/mission-control-view-model.ts`).
- Use lowercase directory names with hyphens for services/apps (`services/andon-api`, `apps/andon-dashboard`).
- Use `*.test.ts` for tests in `tests/` and `src/__tests__/`.

**Functions:**
- Use `camelCase` for functions (`getSessionTimeline`, `buildMissionSessionViewModels`, `makeTempDir`).
- Predicate/boolean helpers are commonly `is*`/`should*` (`isMissionSessionDegraded`, `shouldPostProgressHeartbeat`).

**Variables:**
- Use `camelCase` for locals/constants; use `UPPER_SNAKE_CASE` for exported constants (`DEFAULT_TIMELINE_LIMIT`, `MAX_EVENTS_FOR_RULES`).

**Types:**
- Use PascalCase for interfaces/types (`MissionSessionViewModel`, `SessionRecord`, `RuntimeSession`).

## Code Style

**Formatting:**
- No dedicated formatter config detected (`.prettierrc*`, `prettier.config.*`, `biome.json` not detected at repo root).
- Style is consistent TypeScript with semicolons, double quotes, and trailing commas across files like `services/andon-api/src/repository.ts` and `apps/andon-dashboard/src/App.tsx`.
- Numeric separators are used for readability (`90_000`, `10_000`) in `apps/andon-dashboard/src/App.tsx` and `services/andon-api/src/repository.ts`.

**Linting:**
- No ESLint config detected (`eslint.config.*`, `.eslintrc*` not detected at repo root).
- TypeScript strictness is enforced in `tsconfig.json` (`"strict": true`, `NodeNext` module settings).

## Import Organization

**Order:**
1. Node built-ins first (`node:*`) as seen in `tests/run-tests.ts` and `tests/andon.test.ts`.
2. External packages next (for example `react` in `apps/andon-dashboard/src/App.tsx`).
3. Internal/project imports last, usually relative and grouped by area (`../services/...`, `../packages/...`).

**Path Aliases:**
- No TypeScript path aliases detected in `tsconfig.json`; use relative imports with explicit `.ts` suffixes.

## Error Handling

**Patterns:**
- Prefer explicit null/empty guards before downstream logic (`if (!row) return null;` in `services/andon-api/src/repository.ts`).
- Wrap transactional work in `try/catch` with rollback and rethrow (`ingestEvents` in `services/andon-api/src/repository.ts`).
- Tests use explicit setup validation and clear failure errors (`throw new Error("...")` in `tests/runtime-service.test.ts`).

## Logging

**Framework:** `console` in test runner.

**Patterns:**
- Test runner prints `PASS`/`FAIL` and exits non-zero on failures in `tests/run-tests.ts`.
- API/service code favors structured return payloads over logging for core control flow (`services/andon-api/src/repository.ts`).

## Comments

**When to Comment:**
- Comments are sparse; used mostly for intent on non-obvious behavior and boundary logic (for example timeline and limits comments in `services/andon-api/src/repository.ts`).

**JSDoc/TSDoc:**
- Occasional short JSDoc-style blocks in tests (`src/__tests__/mcp-notification.test.ts`), not pervasive.

## Function Design

**Size:** Larger orchestration functions are accepted in app/API layers (`MissionControlPage` in `apps/andon-dashboard/src/App.tsx`, `getFleet` in `services/andon-api/src/repository.ts`).

**Parameters:** Functions generally accept typed object parameters for complex inputs (`deriveStatus({ session, events, holisticContext })` usage in `services/andon-api/src/repository.ts`).

**Return Values:** Use explicit typed return shapes and nullability (`SessionDetailResponse | null`, `TimelineResponse | null`).

## Module Design

**Exports:** Prefer named exports for utilities/helpers; default export mainly for React app root (`export default function App()` in `apps/andon-dashboard/src/App.tsx`).

**Barrel Files:** Shared domain types and logic are imported via package index barrels (`packages/andon-core/src/index.ts`, `packages/runtime-core/src/index.ts`).

---

*Convention analysis: 2026-04-29*
