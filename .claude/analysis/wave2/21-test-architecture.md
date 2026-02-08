# 21 - Test Architecture: Comprehensive Testing Framework

**Status**: Implementing
**Priority**: P0 (blocks all Wave 2 quality gates)
**Target**: 80%+ coverage (from current ~16%)

---

## 1. Current State Assessment

### Existing Test Infrastructure
- **Root**: Jest (`jest.config.json`) with `ts-jest` preset, `node` environment
- **orchestrator-daemon**: Jest (`jest.config.js`), roots in `tests/`
- **security package**: Jest (`jest.config.js`) with `__tests__` + `*.test.ts` patterns
- **neolith sub-packages**: Vitest (monorepo workspace approach)
- **web-client**: Jest with React Testing Library

### Existing Test Coverage (orchestrator-daemon)
Existing `__tests__/` directories contain tests for:
- `config/__tests__/config.test.ts` -- 300 lines, comprehensive env-based config tests
- `mcp/__tests__/tool-registry.test.ts` -- 265 lines, file/bash/web tools + safety checks
- `federation/__tests__/connection.test.ts` -- 351 lines, WebSocket mock + delegation
- `federation/__tests__/registry.test.ts` -- federation registry tests
- `federation/__tests__/task-delegator.test.ts` -- task delegation tests
- `monitoring/__tests__/endpoint.test.ts` -- 289 lines, HTTP metrics + health endpoints

### Gaps
- **auth/** -- No tests for JWT, authenticator, rate-limiter, or middleware (0% coverage)
- **memory/** -- No tests for MemoryManager (0% coverage)
- **session/** -- No tests for session-manager, session-executor, tool-executor (0% coverage)
- **core/** -- No tests for websocket-server or orchestrator-daemon (0% coverage)
- **distributed/** -- No tests for load-balancer, daemon-node, session-serializer
- **budget/** -- No tests for cost-calculator, budget-manager
- **charter/** -- No tests for charter loader
- **security/** -- New module, needs full test suite

### Test Runner Fragmentation
The monorepo uses both Jest and Vitest. The decision here is to **migrate orchestrator-daemon to Vitest** for:
- Native ESM support
- Faster execution (no ts-jest compilation overhead)
- Consistent with neolith sub-packages
- Better TypeScript integration via `esbuild`
- Compatible with OpenClaw's approach

---

## 2. Architecture Design

### 2.1 Test Runner: Vitest

**Configuration approach** (aligned with OpenClaw's `vitest.config.ts`):
- `pool: "forks"` for process isolation (auth/crypto tests need it)
- V8 coverage provider
- CI-aware worker count
- 120s timeout for integration tests, 30s for unit tests
- `__tests__/` pattern alongside source (co-located tests)

### 2.2 Directory Structure

```
packages/@wundr/orchestrator-daemon/
  vitest.config.ts                    # Package-level vitest config
  src/
    __tests__/
      helpers/
        index.ts                      # Barrel export
        mock-factories.ts             # Session, Agent, Message, Config factories
        test-fixtures.ts              # Config presets, memory configs, charter data
        ws-test-client.ts             # WebSocket test client for protocol testing
        setup.ts                      # Global test setup (env vars, timers)
      unit/
        auth/
          jwt.test.ts                 # JWT sign/verify, expiry, tamper detection
          authenticator.test.ts       # Connection + message auth flows
          rate-limiter.test.ts        # Sliding window, connection concurrency
          middleware.test.ts          # Upgrade hook, per-message validation
        memory/
          memory-manager.test.ts      # Tiered memory, compaction, retrieval
        session/
          session-manager.test.ts     # Session lifecycle
          session-executor.test.ts    # Task execution
          tool-executor.test.ts       # Tool execution
        core/
          websocket-server.test.ts    # Server start/stop, message dispatch
        budget/
          cost-calculator.test.ts     # Token cost calculations
        charter/
          charter-loader.test.ts      # YAML parsing, validation
        distributed/
          load-balancer.test.ts       # Strategy selection
          session-serializer.test.ts  # Serialize/deserialize
      integration/
        auth-websocket.test.ts        # Full auth + WS upgrade flow
        session-lifecycle.test.ts     # Spawn -> execute -> complete -> cleanup
        memory-persistence.test.ts    # Memory across session lifecycle
      security/
        jwt-security.test.ts          # Timing attacks, algorithm confusion, token tampering
        input-validation.test.ts      # XSS, injection, oversized payloads
        rate-limit-security.test.ts   # DDoS patterns, connection floods
        credential-handling.test.ts   # Secret exposure, safe comparison
      protocol/
        ws-messages.test.ts           # All WSMessage types serialize/deserialize
        ws-streaming.test.ts          # Stream start/chunk/end protocol
        ws-error-handling.test.ts     # Malformed messages, connection errors
```

### 2.3 Test Categories

| Category | Purpose | Timeout | Isolation |
|----------|---------|---------|-----------|
| **Unit** | Single module, mocked deps | 30s | Thread |
| **Integration** | Cross-module interactions | 120s | Fork |
| **Security** | Vulnerability regression | 60s | Fork |
| **Protocol** | WebSocket message format | 30s | Thread |

### 2.4 Coverage Configuration

```
Thresholds (global):
  lines:      80%
  functions:  80%
  branches:   70%
  statements: 80%

Module-specific overrides:
  auth/**:      90% (security-critical)
  security/**:  90% (security-critical)
  core/**:      75% (server wiring is hard to unit-test)
```

### 2.5 Coverage Exclusions

- `src/index.ts` -- barrel export
- `src/bin/**` -- CLI entry points (tested via e2e)
- `src/**/examples/**` -- example code
- `src/**/*.example.ts` -- example files
- `src/**/*.d.ts` -- type declarations

---

## 3. Test Helpers Design

### 3.1 Mock Factories (`mock-factories.ts`)

Provides type-safe factory functions for constructing test objects:

```typescript
createMockSession(overrides?)      -> Session
createMockTask(overrides?)         -> Task
createMockMemoryContext(overrides?) -> MemoryContext
createMockMemoryEntry(overrides?)  -> MemoryEntry
createMockAuthConfig(overrides?)   -> AuthConfig
createMockClientIdentity(overrides?) -> ClientIdentity
createMockDaemonConfig(overrides?) -> DaemonConfig
createMockWebSocket()              -> MockWebSocket (EventEmitter-based)
```

Design principles:
- Every factory returns valid defaults that pass Zod validation
- Overrides are deep-merged with spread to avoid mutation
- Unique IDs generated via incrementing counter (deterministic in tests)

### 3.2 Test Fixtures (`test-fixtures.ts`)

Pre-built data sets for common test scenarios:

```typescript
FIXTURES.config.minimal       -- Minimum viable config
FIXTURES.config.full          -- All options populated
FIXTURES.config.distributed   -- Multi-node cluster config
FIXTURES.auth.validJwtSecret  -- 32+ char secret
FIXTURES.auth.validApiKey     -- 32+ char API key with clientId
FIXTURES.memory.default       -- Default memory config
FIXTURES.memory.aggressive    -- Low thresholds for compaction tests
FIXTURES.charter.basic        -- Minimal charter
```

### 3.3 WebSocket Test Client (`ws-test-client.ts`)

Purpose-built client for testing the WebSocket protocol:

```typescript
class WsTestClient {
  connect(port, options?)        -> Promise<void>
  send(message: WSMessage)       -> void
  waitForMessage(type, timeout?) -> Promise<WSResponse>
  waitForMessages(count)         -> Promise<WSResponse[]>
  close()                        -> void
  get messages                   -> WSResponse[]  // all received
  get isConnected                -> boolean
}
```

Features:
- Promise-based message waiting with timeout
- Message type filtering
- Auto-cleanup on test teardown
- JWT/API-key auth in connection headers

---

## 4. CI Integration

### 4.1 Test Scripts (package.json)

```json
{
  "test": "vitest run",
  "test:watch": "vitest watch",
  "test:unit": "vitest run --project unit",
  "test:integration": "vitest run --project integration",
  "test:security": "vitest run --project security",
  "test:coverage": "vitest run --coverage",
  "test:ci": "vitest run --coverage --reporter=junit --outputFile=test-results.xml"
}
```

### 4.2 CI Pipeline

```yaml
steps:
  - name: Unit Tests
    run: pnpm --filter @wundr.io/orchestrator-daemon test:unit
  - name: Integration Tests
    run: pnpm --filter @wundr.io/orchestrator-daemon test:integration
  - name: Security Tests
    run: pnpm --filter @wundr.io/orchestrator-daemon test:security
  - name: Coverage Report
    run: pnpm --filter @wundr.io/orchestrator-daemon test:coverage
  - name: Check Thresholds
    run: | # vitest coverage thresholds will fail the step if not met
```

---

## 5. Migration Path (Jest -> Vitest)

### Phase 1 (This Wave)
1. Add `vitest` + `@vitest/coverage-v8` as dev dependencies
2. Create `vitest.config.ts` with full config
3. Create test helpers infrastructure
4. Write new tests using Vitest (`describe`, `it`, `expect`, `vi`)
5. Keep existing Jest tests functional (they still work via `jest` command)

### Phase 2 (Wave 3)
1. Migrate existing `__tests__/` from Jest to Vitest syntax
2. Replace `jest.fn()` with `vi.fn()`, etc.
3. Remove Jest config and dependencies
4. Unify all packages on Vitest

### Compatibility Notes
- Vitest's API is intentionally Jest-compatible
- Most existing tests need only import changes: `jest.fn()` -> `vi.fn()`
- `jest.useFakeTimers()` -> `vi.useFakeTimers()`
- `done` callbacks should be replaced with async/await patterns

---

## 6. Coverage Roadmap

### Wave 2 Priority (security modules)
| Module | Target | Tests |
|--------|--------|-------|
| `auth/jwt.ts` | 95% | sign, verify, tamper, expiry, algorithm |
| `auth/authenticator.ts` | 90% | JWT, API-key, loopback, missing creds |
| `auth/rate-limiter.ts` | 90% | message rate, connections, cleanup |
| `auth/middleware.ts` | 85% | upgrade hook, message validation |
| `memory/memory-manager.ts` | 85% | CRUD, compaction, retrieval, export |

### Wave 3 Priority (core modules)
| Module | Target | Tests |
|--------|--------|-------|
| `session/session-manager.ts` | 80% | lifecycle, limits, cleanup |
| `session/session-executor.ts` | 80% | execution, streaming, errors |
| `core/websocket-server.ts` | 75% | start/stop, messages, broadcast |
| `distributed/*` | 70% | load balancing, serialization |
| `budget/*` | 80% | cost calculation, budget tracking |
| `charter/*` | 80% | YAML loading, validation |

---

## 7. Related Documents
- `05-security-audit.md` -- Security findings that tests must regress
- `06-input-validation.md` -- Input validation rules to test
- `07-memory-system.md` -- Memory tier specs to validate
- `16-websocket-protocol-v2.md` -- Protocol messages to test
