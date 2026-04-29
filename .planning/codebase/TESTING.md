# Testing Patterns

**Analysis Date:** 2026-04-29

## Test Framework

**Runner:**
- Custom Node/TypeScript runner: `node --experimental-strip-types ./tests/run-tests.ts` (from `package.json`).
- Config: no Jest/Vitest config detected (`jest.config.*` and `vitest.config.*` not found).

**Assertion Library:**
- Node built-in `assert` (`node:assert/strict` and `node:assert`) used across tests such as `tests/andon.test.ts` and `src/__tests__/redact.test.ts`.

**Run Commands:**
```bash
npm test                     # Run full custom test suite
npm run test:andon           # Filter suite by --grep Andon
npm run test:smoke           # Run smoke script
```

## Test File Organization

**Location:**
- Primary tests in top-level `tests/`.
- Additional unit tests in `src/__tests__/` and merged into the main runner by `tests/run-tests.ts`.

**Naming:**
- `*.test.ts` naming convention (`tests/runtime-service.test.ts`, `src/__tests__/mcp-notification.test.ts`).

**Structure:**
```
tests/*.test.ts
src/__tests__/*.test.ts
tests/run-tests.ts
```

## Test Structure

**Suite Organization:**
```typescript
const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  { name: "scenario description", run: async () => { /* assertions */ } },
];

export { tests };
```

**Patterns:**
- Setup pattern: helper constructors/factories (`makeTempDir`, `createDatabase`, `makeFleetItem`) in files like `tests/andon.test.ts` and `tests/runtime-service.test.ts`.
- Teardown pattern: explicit `try/finally` cleanup for DB/server resources (`database.close()`, `server.close()`).
- Assertion pattern: `assert.equal`, `assert.ok`, `assert.match`, `assert.deepEqual`, plus strict variants.

## Mocking

**Framework:** No dedicated mocking library detected.

**Patterns:**
```typescript
const server = createServer(createRuntimeServiceHandler(database));
const response = await fetch(`${base}/runtime/sessions`);
assert.equal(response.status, 200);
```

**What to Mock:**
- Minimal direct stubbing/faking in unit tests (for example fake stdin in `tests/run-tests.ts`).
- Prefer local in-memory/temp infrastructure (SQLite temp DB + HTTP server) over heavy mocks (`tests/andon.test.ts`, `tests/runtime-service.test.ts`).

**What NOT to Mock:**
- Core repository/API behavior is usually exercised end-to-end through real handlers and database interactions.

## Fixtures and Factories

**Test Data:**
```typescript
function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return { id: "session-andon-test", agentName: "codex", ...overrides };
}
```

**Location:**
- Fixtures and builders are typically local to each test file, not centralized.

## Coverage

**Requirements:** No coverage threshold tooling/config detected.

**View Coverage:**
```bash
Not detected (no coverage command configured in package scripts)
```

## Test Types

**Unit Tests:**
- Pure function/domain tests in files like `src/__tests__/redact.test.ts`, `src/__tests__/mcp-notification.test.ts`, and `tests/mission-control-view-model.test.ts`.

**Integration Tests:**
- Strong integration emphasis for runtime/API flows using temporary SQLite + HTTP endpoints in `tests/andon.test.ts` and `tests/runtime-service.test.ts`.

**E2E Tests:**
- Browser/UI E2E framework not detected.

## Common Patterns

**Async Testing:**
```typescript
server.listen(0, "127.0.0.1");
await once(server, "listening");
const response = await fetch(`${base}/events`, { method: "POST", body: JSON.stringify(payload) });
assert.equal(response.status, 202);
```

**Error Testing:**
```typescript
const missingDetail = await fetch(`${base}/runtime/sessions/missing`);
assert.equal(missingDetail.status, 404);
```

---

*Testing analysis: 2026-04-29*
