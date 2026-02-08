# WebSocket Protocol v2 Design Document

## Status: Draft
## Author: Engineering
## Date: 2025-02-09

---

## 1. Overview

Protocol v2 replaces the ad-hoc `type`-discriminated message format in the
orchestrator daemon with a structured JSON-RPC 2.0 inspired wire protocol.
The redesign draws heavily from OpenClaw's gateway protocol (`req`/`res`/`event`
frame model, protocol negotiation on connect, scope-based authorization, and
server-push event subscriptions) while adding Wundr-specific concerns: agent
orchestration, team coordination, tool approval flows, memory queries, and
binary file transfer.

### Goals

1. **Formal message envelope** -- every frame is a typed `Request`,
   `Response`, or `Notification` with a correlation ID so clients can match
   replies.
2. **Authentication handshake** -- first message must be `auth.connect`;
   server validates JWT or API key before accepting further traffic.
3. **Subscription model** -- clients subscribe to session/agent/team event
   streams and receive server-push `Notification` frames.
4. **Binary support** -- a binary frame header allows file uploads/downloads
   without base64 bloat.
5. **Protocol versioning** -- clients declare `minProtocol`/`maxProtocol`; the
   server picks the highest mutually supported version.
6. **Heartbeat** -- automatic ping/pong with configurable interval and server
   disconnect on timeout.

---

## 2. Wire Format

### 2.1 Text Frames (JSON)

All JSON messages share a discriminated union on the `type` field.

```
Request      { type: "req",   id, method, params? }
Response     { type: "res",   id, ok, payload?, error? }
Notification { type: "event", event, payload?, seq?, subscriptionId? }
```

The `id` field is a client-generated unique string (UUIDv4 recommended).
Responses echo back the same `id`. Notifications carry a monotonic `seq`
for ordering and an optional `subscriptionId` linking the event to a
client subscription.

### 2.2 Binary Frames

Binary messages use a compact header:

```
[1 byte version] [1 byte flags] [16 bytes correlationId] [4 bytes metaLen]
[metaLen bytes JSON metadata] [remaining bytes = payload]
```

Flags:
- bit 0: compressed (zlib)
- bit 1: chunked (more fragments follow)
- bit 2: final fragment

---

## 3. Authentication Handshake

Inspired by OpenClaw's `connect` method: the **first** frame after the
WebSocket upgrade MUST be:

```json
{
  "type": "req",
  "id": "<uuid>",
  "method": "auth.connect",
  "params": {
    "minProtocol": 2,
    "maxProtocol": 2,
    "auth": {
      "type": "jwt" | "api-key",
      "token": "<credential>"
    },
    "client": {
      "id": "<client-id>",
      "version": "<client-version>",
      "platform": "<os/arch>"
    },
    "capabilities": ["streaming", "binary", "tool-approval"]
  }
}
```

Server responds with:

```json
{
  "type": "res",
  "id": "<echo-id>",
  "ok": true,
  "payload": {
    "type": "hello",
    "protocol": 2,
    "connectionId": "<server-conn-id>",
    "server": {
      "version": "<daemon-version>",
      "capabilities": ["streaming", "binary", "tool-approval", "teams"]
    },
    "methods": ["session.create", "prompt.submit", ...],
    "events": ["stream.chunk", "tool.request", ...],
    "policy": {
      "maxPayloadBytes": 10485760,
      "heartbeatIntervalMs": 30000,
      "heartbeatTimeoutMs": 90000
    }
  }
}
```

If authentication fails, the server sends an error response and closes
the socket with code 1008.

---

## 4. Method Catalog

### 4.1 Auth Domain

| Method | Direction | Description |
|--------|-----------|-------------|
| `auth.connect` | client -> server | Initial handshake with credentials |
| `auth.refresh` | client -> server | Refresh a JWT before expiry |
| `auth.logout` | client -> server | Graceful disconnect |

### 4.2 Session Domain

| Method | Direction | Description |
|--------|-----------|-------------|
| `session.create` | client -> server | Spawn a new agent session |
| `session.resume` | client -> server | Re-attach to an existing session |
| `session.stop` | client -> server | Terminate a session |
| `session.list` | client -> server | List active sessions |
| `session.status` | client -> server | Get session status |

### 4.3 Prompt Domain

| Method | Direction | Description |
|--------|-----------|-------------|
| `prompt.submit` | client -> server | Submit a prompt to a session |
| `prompt.cancel` | client -> server | Cancel an in-flight prompt |

### 4.4 Stream Domain (Events)

| Event | Direction | Description |
|-------|-----------|-------------|
| `stream.start` | server -> client | Stream begins for a prompt |
| `stream.chunk` | server -> client | Incremental text/thinking/tool_use chunk |
| `stream.end` | server -> client | Stream completed |
| `stream.error` | server -> client | Stream failed with error |

### 4.5 Tool Domain

| Method/Event | Direction | Description |
|-------------|-----------|-------------|
| `tool.request` | server -> client | Agent wants to use a tool; needs approval |
| `tool.approve` | client -> server | Approve the tool request |
| `tool.deny` | client -> server | Deny the tool request |
| `tool.result` | server -> client | Tool execution result |
| `tool.status` | server -> client | Tool execution status update |

### 4.6 Agent Domain

| Method/Event | Direction | Description |
|-------------|-----------|-------------|
| `agent.spawn` | client -> server | Spawn a new sub-agent |
| `agent.status` | server -> client (event) / client -> server (request) | Agent health/state |
| `agent.stop` | client -> server | Stop a running agent |

### 4.7 Team Domain

| Method/Event | Direction | Description |
|-------------|-----------|-------------|
| `team.create` | client -> server | Create a multi-agent team |
| `team.status` | server -> client (event) / client -> server (request) | Team coordination state |
| `team.message` | bidirectional | Inter-agent message relay |
| `team.dissolve` | client -> server | Tear down a team |

### 4.8 Memory Domain

| Method | Direction | Description |
|--------|-----------|-------------|
| `memory.query` | client -> server | Search memory by text or embedding |
| `memory.store` | client -> server | Persist a memory entry |
| `memory.delete` | client -> server | Remove a memory entry |

### 4.9 Config Domain

| Method | Direction | Description |
|--------|-----------|-------------|
| `config.get` | client -> server | Read configuration value(s) |
| `config.set` | client -> server | Write configuration value(s) |

### 4.10 Health Domain

| Method/Event | Direction | Description |
|-------------|-----------|-------------|
| `health.ping` | client -> server | Latency probe (returns `health.pong`) |
| `health.status` | client -> server | Full daemon health report |
| `health.heartbeat` | server -> client | Periodic keepalive tick |

---

## 5. Subscription Model

Clients subscribe to event streams with:

```json
{
  "type": "req",
  "id": "sub-1",
  "method": "subscribe",
  "params": {
    "events": ["stream.*", "tool.*"],
    "filter": { "sessionId": "sess-abc" }
  }
}
```

Server responds with a `subscriptionId`. Subsequent events matching the
filter include that ID. Clients unsubscribe with:

```json
{
  "type": "req",
  "id": "unsub-1",
  "method": "unsubscribe",
  "params": { "subscriptionId": "<id>" }
}
```

Glob patterns (`stream.*`, `tool.*`, `*`) are supported for event names.

---

## 6. Error Model

Errors use a structured shape matching OpenClaw's model:

```json
{
  "code": "UNAUTHORIZED",
  "message": "JWT expired",
  "details": { "expiredAt": "2025-01-01T00:00:00Z" },
  "retryable": true,
  "retryAfterMs": 1000
}
```

Standard error codes:
- `INVALID_REQUEST` -- malformed frame or params
- `UNAUTHORIZED` -- auth failure
- `FORBIDDEN` -- insufficient scope
- `NOT_FOUND` -- unknown session/agent/team
- `CONFLICT` -- duplicate session ID, etc.
- `RATE_LIMITED` -- too many requests
- `INTERNAL` -- server error
- `UNAVAILABLE` -- subsystem down
- `TIMEOUT` -- operation timed out
- `PROTOCOL_MISMATCH` -- version negotiation failed

---

## 7. Heartbeat/Keepalive

After successful `auth.connect`, the server sends `health.heartbeat`
events at the interval specified in `policy.heartbeatIntervalMs`. If the
server receives no frames (including pong) within
`policy.heartbeatTimeoutMs`, it closes the connection with code 1001.

Clients may also send `health.ping` at any time; the server replies with
a `health.pong` response containing the server timestamp for RTT
calculation.

---

## 8. Protocol Versioning

The `auth.connect` params include `minProtocol` and `maxProtocol`.
The server picks `min(maxProtocol, SERVER_PROTOCOL_VERSION)`. If
that value is less than `minProtocol`, the server rejects with
`PROTOCOL_MISMATCH`. The chosen version is returned in the hello
response.

This allows rolling upgrades: new clients that support v2+v3 can still
talk to v2-only servers.

---

## 9. Scope-based Authorization

Inspired by OpenClaw's scope model:

| Scope | Access |
|-------|--------|
| `daemon.admin` | Full access to all methods |
| `daemon.read` | Read-only: `session.list`, `session.status`, `health.*`, `config.get` |
| `daemon.write` | Read + write: `session.create`, `prompt.submit`, `tool.approve`, etc. |
| `daemon.approve` | Tool approval only |
| `daemon.teams` | Team management |

Scopes are encoded in the JWT claims or mapped from API key roles.

---

## 10. Implementation Plan

### Files

| File | Purpose |
|------|---------|
| `protocol-v2.ts` | Zod schemas for all message types, error codes, constants |
| `rpc-handler.ts` | Request routing, authentication, scope checking |
| `subscription-manager.ts` | Event subscription lifecycle, glob matching, filtering |
| `message-router.ts` | Frame dispatch, binary decoding, heartbeat timer |

### Migration from v1

The existing `OrchestratorWebSocketServer` will be preserved for backward
compatibility. A v2 handler will be mounted at path `/v2` (or detected
via the `auth.connect` handshake). The v1 `type`-discriminated messages
continue to work on the default path.

---

## 11. Relationship to OpenClaw Gateway

| OpenClaw Concept | v2 Equivalent |
|-----------------|---------------|
| `connect` method + `hello-ok` | `auth.connect` + hello response |
| `req`/`res`/`event` frames | Same frame model, Zod instead of TypeBox |
| `ErrorCodes` + `ErrorShape` | Same structure, extended codes |
| Scope-based auth (`operator.admin` etc.) | `daemon.admin` / `daemon.read` / `daemon.write` |
| `listGatewayMethods()` / `GATEWAY_EVENTS` | `PROTOCOL_V2_METHODS` / `PROTOCOL_V2_EVENTS` |
| Node subscription manager | `SubscriptionManager` with glob patterns |
| `broadcastToSession` | Subscription-based event routing |
