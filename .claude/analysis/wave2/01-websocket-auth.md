# WebSocket Authentication for Orchestrator Daemon

## Status: Implemented

**Date**: 2026-02-09 **Severity**: CRITICAL -- prior to this change, any network-reachable client
could connect to the orchestrator daemon and spawn sessions, execute tasks, or read session data
with zero authentication.

---

## 1. Problem Statement

The `OrchestratorWebSocketServer` accepted every incoming WebSocket upgrade request unconditionally.
There was no mechanism to:

- Verify the identity of connecting clients.
- Reject unauthorized connections at the HTTP upgrade step.
- Validate credentials on individual messages (for long-lived connections).
- Limit the rate at which a single client can issue messages.
- Cap the number of concurrent connections per client identity.

This meant that any process with network access to the daemon port could:

1. Spawn agent sessions (consuming LLM tokens and compute).
2. Execute arbitrary tasks on existing sessions.
3. Read session status and streaming output for all sessions.
4. Issue a denial-of-service by flooding the server with connections or messages.

## 2. Design Principles

| Principle                  | Application                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Defense in depth**       | Auth at connection upgrade AND per-message validation.                                                                               |
| **No hardcoded secrets**   | All secrets come from env vars or external config, validated with Zod at startup.                                                    |
| **Timing-safe comparison** | `crypto.timingSafeEqual` for all secret comparisons (JWT signatures, API keys). Borrowed from OpenClaw `gateway/auth.ts`.            |
| **Backward compatible**    | When `DAEMON_AUTH_JWT_SECRET` is not set, the server starts without auth (with a loud warning). Existing deployments are not broken. |
| **Minimal dependencies**   | JWT signing/verification uses only Node.js `crypto`. No `jsonwebtoken` or other third-party packages.                                |
| **Zod-first validation**   | Every configuration surface and JWT payload is Zod-validated.                                                                        |

## 3. Architecture

```
                    +-----------------------+
                    |   HTTP Upgrade Req    |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |   AuthMiddleware      |
                    |  .install()           |
                    |                       |
                    |  1. authenticateConn  |  <-- Authenticator
                    |  2. addConnection     |  <-- RateLimiter
                    |  3. handleUpgrade     |  <-- ws.Server
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |  OrchestratorWSServer |
                    |  .handleConnection()  |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |  Per-message flow:    |
                    |                       |
                    |  1. validateMessage   |  <-- AuthMiddleware
                    |     - rate limit      |  <-- RateLimiter
                    |     - parse JSON      |
                    |     - per-msg auth    |  <-- Authenticator
                    |     - JWT expiry chk  |
                    |  2. handleMessage     |  <-- existing logic
                    +-----------------------+
```

### Module Breakdown

| File                    | Responsibility                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/types.ts`         | Zod schemas (`AuthConfigSchema`, `JwtPayloadSchema`, `AuthenticatedMessageSchema`), TypeScript interfaces (`AuthConfig`, `ClientIdentity`, `AuthResult`, `RateLimitEntry`). |
| `auth/jwt.ts`           | Pure-crypto HS256 JWT sign/verify. Uses `createHmac` + `timingSafeEqual`. Validates structure, algorithm, signature, expiry, issuer, audience, and Zod schema.              |
| `auth/rate-limiter.ts`  | Sliding-window message rate limiter + connection concurrency limiter. In-process, keyed by `clientId`. Periodic self-cleanup.                                               |
| `auth/authenticator.ts` | Combines JWT verification, API-key lookup (with `timingSafeEqual`), and loopback bypass into `authenticateConnection()` and `authenticateMessage()`.                        |
| `auth/middleware.ts`    | Glue layer. Installs on `httpServer` upgrade event. Decorates WebSocket instances with `__identity`. Provides `validateMessage()` for per-message gating.                   |
| `auth/index.ts`         | Public barrel export.                                                                                                                                                       |

### Modified Files

| File                          | Change                                                                                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/websocket-server.ts`    | Constructor accepts optional `AuthConfig`. When present, uses `noServer: true` and installs `AuthMiddleware` on the upgrade path. Per-message processing delegates to `validateMessage()`. Exposes `getClientIdentity()` and `isAuthEnabled()`. |
| `core/orchestrator-daemon.ts` | New `resolveAuthConfig()` reads env vars, Zod-validates, and passes the config to `OrchestratorWebSocketServer`.                                                                                                                                |

## 4. Authentication Methods

### 4.1 JWT (HS256)

- Client sends a `Bearer <token>` header or `?token=<token>` query param on upgrade.
- Token is verified with HMAC-SHA256 using `DAEMON_AUTH_JWT_SECRET`.
- Claims validated: `iss`, `aud`, `exp`, `sub`, and Zod schema.
- The `sub` claim becomes the `clientId` on the connection identity.
- Tokens can be generated with `createToken()` from `auth/jwt.ts`.

### 4.2 API Key

- Client sends `X-Api-Key: <key>` header or `?apiKey=<key>` query param.
- Key is compared against the configured list using `timingSafeEqual`.
- Each key maps to a `clientId` and optional `scopes` array.
- Keys are configured via `DAEMON_AUTH_API_KEYS` (JSON array).

### 4.3 Loopback Bypass

- When `DAEMON_AUTH_ALLOW_LOOPBACK=true`, connections from `127.0.0.1`, `::1`, or `::ffff:127.*` are
  accepted without credentials.
- Identity is set to `clientId: "loopback"`, `method: "loopback"`.
- Useful for local development but MUST be disabled in production.

## 5. Rate Limiting

| Parameter                  | Env Var                            | Default |
| -------------------------- | ---------------------------------- | ------- |
| Max messages per window    | `DAEMON_AUTH_RATE_LIMIT_MAX`       | 100     |
| Window duration (ms)       | `DAEMON_AUTH_RATE_LIMIT_WINDOW_MS` | 60,000  |
| Max connections per client | `DAEMON_AUTH_MAX_CONNECTIONS`      | 10      |

- Sliding window per `clientId`. Timestamps older than the window are pruned on each check.
- Connection count is tracked via `addConnection` / `removeConnection` lifecycle hooks.
- Stale buckets are garbage-collected every 2 minutes.

## 6. Configuration Reference

All configuration is via environment variables (no hardcoded secrets).

| Variable                           | Required             | Description                                                      |
| ---------------------------------- | -------------------- | ---------------------------------------------------------------- |
| `DAEMON_AUTH_JWT_SECRET`           | Yes (to enable auth) | HMAC-SHA256 secret, >= 32 characters.                            |
| `DAEMON_AUTH_MODE`                 | No                   | `jwt`, `api-key`, or `both`. Default: `both`.                    |
| `DAEMON_AUTH_JWT_ISSUER`           | No                   | JWT `iss` claim. Default: `wundr-orchestrator`.                  |
| `DAEMON_AUTH_JWT_AUDIENCE`         | No                   | JWT `aud` claim. Default: `wundr-daemon`.                        |
| `DAEMON_AUTH_JWT_EXPIRES_SEC`      | No                   | Token lifetime in seconds. Default: `3600`.                      |
| `DAEMON_AUTH_API_KEYS`             | No                   | JSON array: `[{"key":"...","clientId":"...","scopes":["..."]}]`. |
| `DAEMON_AUTH_ALLOW_LOOPBACK`       | No                   | `true` to allow unauthenticated loopback. Default: `false`.      |
| `DAEMON_AUTH_RATE_LIMIT_MAX`       | No                   | Max messages per window. Default: `100`.                         |
| `DAEMON_AUTH_RATE_LIMIT_WINDOW_MS` | No                   | Window duration ms. Default: `60000`.                            |
| `DAEMON_AUTH_MAX_CONNECTIONS`      | No                   | Max connections per client. Default: `10`.                       |

## 7. Per-Message Auth Flow

For long-lived WebSocket connections, JWT tokens may expire before the connection closes. The
middleware handles this:

1. On every incoming message, `validateMessage()` checks whether the connection-level JWT has
   expired. If so, the message is rejected with `token_expired` and the socket is closed with code
   `4001`.
2. Clients MAY include a fresh token in the message envelope (`{ auth: { token: "..." } }`) for
   re-validation. This allows token rotation without reconnecting.
3. API-key authenticated connections do not expire.

## 8. Security Considerations

- **Timing attacks**: All secret comparisons use `crypto.timingSafeEqual` via the `safeEqual` helper
  (same pattern as OpenClaw `gateway/auth.ts`).
- **Algorithm confusion**: The JWT verifier only accepts `HS256` and rejects all other algorithms,
  preventing algorithm downgrade attacks.
- **Secret strength**: Zod enforces a minimum 32-character secret length. API keys have the same
  minimum.
- **No `none` algorithm**: The explicit algorithm check prevents unsigned token acceptance.
- **Upgrade rejection**: Failed auth returns a proper `401` HTTP response and destroys the socket
  before the WebSocket handshake completes. No data leaks.
- **Rate limiting**: Prevents resource exhaustion even from authenticated clients.

## 9. Migration Path

1. **Phase 1 (current)**: Auth is opt-in. If `DAEMON_AUTH_JWT_SECRET` is not set, the server runs
   without auth (with a warning). Existing deployments continue to work.
2. **Phase 2 (recommended)**: Set `DAEMON_AUTH_JWT_SECRET` and `DAEMON_AUTH_ALLOW_LOOPBACK=true` for
   development environments. Set API keys for service-to-service callers.
3. **Phase 3 (production)**: Disable loopback bypass. Require JWT or API key for all connections.
   Distribute secrets via a secrets manager.

## 10. Files Created / Modified

### New Files

- `/packages/@wundr/orchestrator-daemon/src/auth/types.ts`
- `/packages/@wundr/orchestrator-daemon/src/auth/jwt.ts`
- `/packages/@wundr/orchestrator-daemon/src/auth/rate-limiter.ts`
- `/packages/@wundr/orchestrator-daemon/src/auth/authenticator.ts`
- `/packages/@wundr/orchestrator-daemon/src/auth/middleware.ts`
- `/packages/@wundr/orchestrator-daemon/src/auth/index.ts`

### Modified Files

- `/packages/@wundr/orchestrator-daemon/src/core/websocket-server.ts`
- `/packages/@wundr/orchestrator-daemon/src/core/orchestrator-daemon.ts`
