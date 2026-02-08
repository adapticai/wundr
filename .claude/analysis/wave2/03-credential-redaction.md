# Wave 2 -- Credential Redaction Framework

## 1. Origin: OpenClaw's Redaction System

OpenClaw implements credential redaction across four files:

| File | Responsibility |
|------|---------------|
| `src/logging/redact.ts` | Regex-based text scrubbing for logs and tool output |
| `src/logging/redact-identifier.ts` | One-way SHA-256 hashing for identifiers that need correlation without exposure |
| `src/config/redact-snapshot.ts` | Config object/raw-text redaction with sentinel round-trip support |
| `src/gateway/ws-log.ts` | WebSocket log formatting that runs text through `redactSensitiveText` |

Key design decisions carried forward:

- **Partial masking**: Tokens >= 18 chars keep first 6 and last 4 characters (`sk-proj…cdef`), shorter tokens become `***`. This preserves debuggability while hiding secrets.
- **Sentinel round-trip**: Config display replaces secrets with `__REDACTED__`. On write-back, the sentinel is detected and the original value is restored from disk, preventing UI-originated credential corruption.
- **Mode toggle**: Redaction can be disabled (`"off"`) for debugging. Default is `"tools"` (redact tool output).
- **Custom patterns**: Users can supply regex overrides; defaults cover env assignments, JSON fields, CLI flags, Authorization headers, PEM blocks, and provider-specific token prefixes.

## 2. Wundr Integration Points

The Wundr orchestrator-daemon surfaces credentials in several places:

| Surface | Risk | Integration Approach |
|---------|------|---------------------|
| `Logger` class (`utils/logger.ts`) | API keys logged in debug/error output | Wrap message + args through `redactText` before console output |
| `OrchestratorWebSocketServer` (`core/websocket-server.ts`) | Tool results, task context, error messages sent over WS contain credentials | Redact JSON payloads in `send()`, `broadcast()`, and `broadcastToSession()` |
| `Config` module (`config/index.ts`) | `loadConfig()` reads `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `REDIS_PASSWORD`, `JWT_SECRET`, `NEOLITH_API_SECRET` from env | `redactConfigObject` for display; `restoreRedactedValues` for write-back |
| `SessionExecutor` / `ToolExecutor` | Tool inputs/outputs may echo credentials | Redact `ToolCallInfo.toolInput` and `ToolCallInfo.result` before WS broadcast |
| Environment variable logging | Startup prints accepted env vars | `formatEnvValue` with `redact: true` for sensitive keys |

## 3. Architecture

```
security/
  redact.ts          <-- single-file implementation (this wave)
  redact.test.ts     <-- tests (next wave)
  index.ts           <-- barrel export (next wave)
```

### 3.1 Module Layout

```
redact.ts
  |
  |-- Token pattern detection (regex-based)
  |     |-- DEFAULT_REDACT_PATTERNS: provider prefixes, env assignments, JSON, CLI, headers, PEM
  |     |-- Wundr additions: AWS keys (AKIA...), Anthropic keys (sk-ant-...), DB URLs with creds
  |     +-- parsePattern(): string -> RegExp | null
  |
  |-- Text redaction
  |     |-- maskToken(): partial mask with start/end preservation
  |     |-- redactPemBlock(): preserves BEGIN/END markers
  |     |-- redactText(): applies all patterns to a string
  |     +-- redactSensitiveText(): public API with mode check
  |
  |-- Object redaction (config display)
  |     |-- REDACTED_SENTINEL: "__WUNDR_REDACTED__"
  |     |-- isSensitiveKey(): key-name heuristic
  |     |-- redactConfigObject(): deep-walk replacement
  |     +-- restoreRedactedValues(): sentinel -> original on write-back
  |
  |-- Identifier hashing
  |     +-- redactIdentifier(): SHA-256 prefix for correlation IDs
  |
  |-- Environment variable formatting
  |     |-- SENSITIVE_ENV_KEYS: known secret env var names
  |     +-- formatEnvValue(): "<redacted>" for secrets, truncated for others
  |
  +-- WebSocket payload redaction
        +-- redactWsPayload(): deep-walk any WS message, redact string values via patterns
```

### 3.2 Pattern Coverage

**Carried from OpenClaw** (proven in production):

| Pattern | Example |
|---------|---------|
| ENV assignments | `OPENAI_API_KEY=sk-1234...` |
| JSON secret fields | `{"apiKey":"sk-..."}` |
| CLI flags | `--api-key sk-...` |
| Bearer tokens | `Authorization: Bearer eyJ...` |
| PEM private keys | `-----BEGIN RSA PRIVATE KEY-----` |
| OpenAI `sk-` prefix | `sk-proj-abc123...` |
| GitHub PAT `ghp_` | `ghp_xxxxxxxxxxxx` |
| GitHub fine-grained `github_pat_` | `github_pat_xxxxxxxxxxxx` |
| Slack tokens `xox[baprs]-` | `xoxb-123-456-abc` |
| Slack app tokens `xapp-` | `xapp-1-A01...` |
| Groq `gsk_` | `gsk_xxxxxxxxxxxx` |
| Google AI `AIza` | `AIzaSyxxxxxxxxxx` |
| Perplexity `pplx-` | `pplx-xxxxxxxxxxxx` |
| npm tokens `npm_` | `npm_xxxxxxxxxxxx` |
| Telegram bot tokens | `123456:ABCDEF...` |

**New patterns for Wundr**:

| Pattern | Example | Rationale |
|---------|---------|-----------|
| AWS access keys `AKIA` | `AKIAIOSFODNN7EXAMPLE` | Wundr may integrate with AWS services |
| Anthropic `sk-ant-` | `sk-ant-api03-xxxx` | Wundr has Anthropic config section |
| Database URLs with credentials | `postgres://user:pass@host/db` | Wundr has `DATABASE_URL` config |
| Redis URLs with passwords | `redis://:password@host:6379` | Wundr has `REDIS_URL` config |
| Generic JWT-shaped tokens | `eyJ...` (3 base64 segments) | JWT secret and tokens flow through WS |

### 3.3 Sensitive Environment Variable Names

Hardcoded list of env var names that should always be redacted when logged:

```
OPENAI_API_KEY, ANTHROPIC_API_KEY, DAEMON_JWT_SECRET,
REDIS_PASSWORD, DATABASE_URL, NEOLITH_API_KEY, NEOLITH_API_SECRET,
AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, GITHUB_TOKEN
```

### 3.4 Config Sentinel Round-Trip

```
  [Config on disk]
       |
       v
  loadConfig()  -->  redactConfigForDisplay()  -->  WS / API response
                                                        |
                                                        v
                                                  User sees sentinel
                                                        |
                                                        v
  restoreRedactedValues(incoming, onDisk)  <--  User submits config
       |
       v
  [Config written to disk with originals restored]
```

The sentinel value is `__WUNDR_REDACTED__` (distinct from OpenClaw's to avoid cross-contamination in shared tooling).

## 4. Public API

```typescript
// Text redaction
redactSensitiveText(text: string, options?: RedactOptions): string
getDefaultRedactPatterns(): string[]

// Config object redaction
REDACTED_SENTINEL: string  // "__WUNDR_REDACTED__"
redactConfigObject<T>(value: T): T
restoreRedactedValues(incoming: unknown, original: unknown): unknown

// Identifier hashing
redactIdentifier(value: string | undefined, opts?: { len?: number }): string

// Environment variable formatting
formatEnvValue(value: string, key?: string): string
isSensitiveEnvKey(key: string): boolean

// WebSocket payload redaction
redactWsPayload<T>(payload: T): T

// Logger integration
createRedactingLogger(name: string, level?: LogLevel): Logger
```

## 5. Integration Plan

### Phase 1 (this wave): Core implementation
- `security/redact.ts` with all patterns and functions
- Self-contained, zero new dependencies

### Phase 2 (next wave): Logger integration
- Modify `Logger` class to accept a redaction function
- Wire `createRedactingLogger` into existing subsystems

### Phase 3 (next wave): WebSocket integration
- Add redaction middleware to `OrchestratorWebSocketServer.send()`
- Ensure `notifyToolExecution` redacts tool inputs/outputs

### Phase 4 (next wave): Config display integration
- Wire `redactConfigObject` into any config-display API endpoint
- Wire `restoreRedactedValues` into any config-write handler

## 6. Testing Strategy

Key test cases (mirrored from OpenClaw's `redact.test.ts` and `redact-snapshot.test.ts`):

- ENV assignment masking preserves key, masks value
- JSON field masking
- CLI flag masking
- Bearer token masking
- PEM block redaction preserves markers
- Short token full masking (`***`)
- Custom pattern support
- Mode `"off"` bypass
- AWS key detection
- Anthropic key detection
- Database URL credential stripping
- JWT token detection
- Config object sentinel replacement
- Sentinel round-trip (redact -> restore = identity)
- Deeply nested config restoration
- Error on sentinel write without original
- WebSocket payload deep redaction
- Identifier SHA-256 hashing
- Sensitive env key detection

## 7. Security Considerations

- **No secrets in error messages**: If restoration fails, the error says "field is redacted" without echoing the value.
- **Longest-first replacement**: When redacting raw text, sensitive values are sorted by length descending to prevent partial matches creating a shorter leaked substring.
- **Regex safety**: Custom patterns are wrapped in try/catch; malformed patterns are silently dropped rather than crashing the daemon.
- **No persistent caching of secrets**: Patterns are compiled once, but actual secret values are never stored in the redaction module itself.
- **Defense in depth**: Text-based pattern matching catches secrets even when structural (key-name) detection misses them, and vice versa.
