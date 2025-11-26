# WebSocket API Protocol Documentation

## Overview

The VP Daemon WebSocket API provides real-time bidirectional communication between VP daemon clients and the Neolith backend. This protocol supports authentication, event streaming, heartbeat monitoring, and automatic reconnection.

## Connection

### Endpoint

```
ws://your-domain.com/daemon/ws
wss://your-domain.com/daemon/ws (production)
```

### Connection Flow

1. Client establishes WebSocket connection
2. Client sends authentication message within 10 seconds
3. Server validates JWT access token
4. Server responds with authentication result
5. Client begins sending heartbeats
6. Client subscribes to event types
7. Server streams events to client
8. Client acknowledges received events

## Message Format

All messages follow a common structure:

```typescript
interface WSMessage {
  type: WSMessageType;      // Message type identifier
  id: string;               // Unique message ID (UUID)
  timestamp: string;        // ISO 8601 timestamp
  payload?: object;         // Type-specific payload
}
```

## Client → Server Messages

### 1. Authentication

Authenticate the WebSocket connection using a JWT access token.

```json
{
  "type": "auth",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "daemonId": "daemon_abc123",
    "vpId": "vp_xyz789"
  }
}
```

**Response (Success):**

```json
{
  "type": "auth_success",
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2024-01-15T10:30:00.500Z",
  "payload": {
    "sessionId": "session_def456",
    "scopes": ["messages:read", "messages:write", "channels:read"],
    "serverTime": "2024-01-15T10:30:00.500Z",
    "heartbeatIntervalMs": 30000
  }
}
```

**Response (Error):**

```json
{
  "type": "auth_error",
  "id": "660e8400-e29b-41d4-a716-446655440002",
  "timestamp": "2024-01-15T10:30:00.500Z",
  "payload": {
    "code": "AUTH_FAILED",
    "message": "Invalid access token"
  }
}
```

**Error Codes:**
- `AUTH_FAILED` - Invalid credentials
- `TOKEN_EXPIRED` - Access token has expired
- `INSUFFICIENT_SCOPE` - Token lacks required scopes
- `MAX_CONNECTIONS` - Too many connections for this VP

### 2. Heartbeat

Send periodic heartbeat to maintain connection and report metrics.

```json
{
  "type": "heartbeat",
  "id": "770e8400-e29b-41d4-a716-446655440003",
  "timestamp": "2024-01-15T10:30:30Z",
  "payload": {
    "status": "active",
    "metrics": {
      "memoryUsageBytes": 104857600,
      "uptimeSeconds": 3600,
      "messagesSent": 42,
      "messagesReceived": 128,
      "errors": 0
    }
  }
}
```

**Status Values:**
- `active` - Daemon is actively processing
- `idle` - Daemon is running but idle
- `busy` - Daemon is under heavy load

**Response:**

```json
{
  "type": "heartbeat_ack",
  "id": "880e8400-e29b-41d4-a716-446655440004",
  "timestamp": "2024-01-15T10:30:30.100Z",
  "payload": {
    "serverTime": "2024-01-15T10:30:30.100Z",
    "nextHeartbeat": "2024-01-15T10:31:00Z"
  }
}
```

**Important:**
- Send heartbeats at the interval specified in `auth_success` (typically 30 seconds)
- Missing 3 consecutive heartbeats will result in connection closure
- Include metrics to enable monitoring and diagnostics

### 3. Subscribe to Events

Subscribe to specific event types.

```json
{
  "type": "subscribe",
  "id": "990e8400-e29b-41d4-a716-446655440005",
  "timestamp": "2024-01-15T10:30:35Z",
  "payload": {
    "eventTypes": [
      "message.received",
      "message.sent",
      "presence.updated",
      "channel.joined"
    ],
    "channelIds": ["channel_1", "channel_2"]
  }
}
```

**Event Types:**

**Message Events:**
- `message.received` - New message in subscribed channel
- `message.sent` - Message successfully sent
- `message.updated` - Message edited
- `message.deleted` - Message deleted
- `message.reaction` - Reaction added to message

**Channel Events:**
- `channel.joined` - VP joined a channel
- `channel.left` - VP left a channel
- `channel.updated` - Channel metadata updated
- `channel.member_added` - Member added to channel
- `channel.member_removed` - Member removed from channel

**Presence Events:**
- `presence.updated` - User presence status changed
- `presence.user_online` - User came online
- `presence.user_offline` - User went offline

**VP Events:**
- `vp.status_changed` - VP status changed
- `vp.config_updated` - VP configuration updated
- `vp.mentioned` - VP was mentioned in a message

**System Events:**
- `system.rate_limited` - Rate limit applied
- `system.maintenance` - Scheduled maintenance
- `system.reconnect_required` - Server requesting reconnect

**Wildcard:**
- `*` - Subscribe to all event types

### 4. Unsubscribe from Events

Unsubscribe from event types.

```json
{
  "type": "unsubscribe",
  "id": "aa0e8400-e29b-41d4-a716-446655440006",
  "timestamp": "2024-01-15T10:35:00Z",
  "payload": {
    "eventTypes": ["presence.updated"]
  }
}
```

### 5. Acknowledge Events

Acknowledge receipt and processing of events.

```json
{
  "type": "ack",
  "id": "bb0e8400-e29b-41d4-a716-446655440007",
  "timestamp": "2024-01-15T10:30:45Z",
  "payload": {
    "eventIds": [
      "event_123",
      "event_124",
      "event_125"
    ]
  }
}
```

**Important:**
- Events with `requiresAck: true` must be acknowledged
- Unacknowledged events may be redelivered
- Acknowledge events in batches for efficiency

## Server → Client Messages

### 1. Event Notification

Receive event notifications for subscribed event types.

```json
{
  "type": "event",
  "id": "cc0e8400-e29b-41d4-a716-446655440008",
  "timestamp": "2024-01-15T10:30:40Z",
  "payload": {
    "eventId": "event_123",
    "eventType": "message.received",
    "data": {
      "messageId": "msg_456",
      "channelId": "channel_1",
      "content": "Hello from user!",
      "authorId": "user_789",
      "authorName": "John Doe",
      "timestamp": "2024-01-15T10:30:39Z"
    },
    "requiresAck": true
  }
}
```

### 2. Error Notification

Receive error notifications from the server.

```json
{
  "type": "error",
  "id": "dd0e8400-e29b-41d4-a716-446655440009",
  "timestamp": "2024-01-15T10:31:00Z",
  "payload": {
    "code": "INVALID_MESSAGE",
    "message": "Message payload is malformed",
    "details": {
      "field": "eventTypes",
      "error": "must be an array"
    }
  }
}
```

**Common Error Codes:**
- `INVALID_MESSAGE` - Malformed message
- `NOT_AUTHENTICATED` - Action requires authentication
- `INSUFFICIENT_SCOPE` - Token lacks required scope
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error

### 3. Rate Limit Notification

Receive rate limit notifications.

```json
{
  "type": "rate_limit",
  "id": "ee0e8400-e29b-41d4-a716-446655440010",
  "timestamp": "2024-01-15T10:31:10Z",
  "payload": {
    "action": "message.send",
    "retryAfter": 60,
    "currentRate": 120,
    "maxRate": 100
  }
}
```

### 4. Reconnect Request

Server requests client to reconnect.

```json
{
  "type": "reconnect",
  "id": "ff0e8400-e29b-41d4-a716-446655440011",
  "timestamp": "2024-01-15T10:32:00Z",
  "payload": {
    "reason": "Server maintenance",
    "delay": 5000
  }
}
```

**Client Actions:**
1. Close current connection gracefully
2. Wait for specified delay
3. Establish new connection
4. Re-authenticate
5. Re-subscribe to events
6. Request queued events using `/api/daemon/events?since=<timestamp>`

## WebSocket Close Codes

Standard and custom close codes used by the server:

| Code | Name | Description |
|------|------|-------------|
| 1000 | NORMAL | Normal closure |
| 1001 | GOING_AWAY | Server shutting down |
| 1002 | PROTOCOL_ERROR | Protocol violation |
| 4001 | AUTH_FAILED | Authentication failed |
| 4002 | AUTH_TIMEOUT | Authentication timeout (>10s) |
| 4003 | TOKEN_EXPIRED | Access token expired |
| 4004 | RATE_LIMITED | Rate limit exceeded |
| 4005 | INSUFFICIENT_SCOPE | Missing required scopes |
| 4006 | SESSION_TERMINATED | Session terminated by server |

## Connection Recovery

### Automatic Reconnection

Implement exponential backoff for reconnection:

```typescript
let reconnectDelay = 1000; // Start with 1 second
const maxDelay = 60000;    // Max 60 seconds

function reconnect() {
  setTimeout(() => {
    connect();
    reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
  }, reconnectDelay);
}

// Reset delay on successful connection
connection.on('auth_success', () => {
  reconnectDelay = 1000;
});
```

### Offline Message Queueing

When disconnected, events are queued server-side. Upon reconnection:

1. Authenticate successfully
2. Note the last received event timestamp
3. Fetch queued events via HTTP API:

```bash
GET /api/daemon/events?since=2024-01-15T10:30:00Z
Authorization: Bearer <access_token>
```

4. Process queued events
5. Resume normal WebSocket operation

## Example Client Implementation

```typescript
import WebSocket from 'ws';

class DaemonWSClient {
  private ws: WebSocket | null = null;
  private accessToken: string;
  private daemonId: string;
  private vpId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(url: string, accessToken: string, daemonId: string, vpId: string) {
    this.accessToken = accessToken;
    this.daemonId = daemonId;
    this.vpId = vpId;
    this.connect(url);
  }

  private connect(url: string): void {
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.authenticate();
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(JSON.parse(data.toString()));
    });

    this.ws.on('close', (code, reason) => {
      console.log(`Connection closed: ${code} - ${reason}`);
      this.stopHeartbeat();
      this.reconnect(url);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private authenticate(): void {
    this.send({
      type: 'auth',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: {
        accessToken: this.accessToken,
        daemonId: this.daemonId,
        vpId: this.vpId,
      },
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'auth_success':
        console.log('Authenticated successfully');
        this.startHeartbeat(message.payload.heartbeatIntervalMs);
        this.subscribe(['message.received', 'presence.updated']);
        break;

      case 'auth_error':
        console.error('Authentication failed:', message.payload.message);
        break;

      case 'event':
        console.log('Event received:', message.payload.eventType);
        if (message.payload.requiresAck) {
          this.acknowledge([message.payload.eventId]);
        }
        break;

      case 'heartbeat_ack':
        // Heartbeat acknowledged
        break;

      case 'error':
        console.error('Error:', message.payload.message);
        break;

      case 'reconnect':
        console.log('Reconnect requested:', message.payload.reason);
        this.ws?.close();
        break;
    }
  }

  private startHeartbeat(interval: number): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({
        type: 'heartbeat',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        payload: {
          status: 'active',
          metrics: {
            memoryUsageBytes: process.memoryUsage().heapUsed,
            uptimeSeconds: process.uptime(),
          },
        },
      });
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private subscribe(eventTypes: string[]): void {
    this.send({
      type: 'subscribe',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: { eventTypes },
    });
  }

  private acknowledge(eventIds: string[]): void {
    this.send({
      type: 'ack',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: { eventIds },
    });
  }

  private send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private reconnect(url: string): void {
    setTimeout(() => {
      this.connect(url);
    }, 5000);
  }

  close(): void {
    this.stopHeartbeat();
    this.ws?.close(1000, 'Client closing');
  }
}

// Usage
const client = new DaemonWSClient(
  'wss://api.neolith.io/daemon/ws',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'daemon_abc123',
  'vp_xyz789'
);
```

## Best Practices

### 1. Connection Management

- Always implement automatic reconnection with exponential backoff
- Handle all WebSocket close codes gracefully
- Store last event timestamp to retrieve missed events
- Limit reconnection attempts to prevent infinite loops

### 2. Heartbeat

- Send heartbeats at the interval specified by the server
- Include relevant metrics in heartbeat messages
- Monitor heartbeat acknowledgments for connection health
- Use heartbeat failures to trigger reconnection

### 3. Event Handling

- Subscribe only to needed event types to reduce bandwidth
- Batch acknowledge multiple events for efficiency
- Process events asynchronously to avoid blocking
- Handle duplicate events gracefully (idempotency)

### 4. Error Handling

- Log all errors for debugging
- Implement retry logic with backoff for transient errors
- Refresh access tokens before expiration
- Handle rate limits by backing off

### 5. Security

- Always use WSS (WebSocket Secure) in production
- Never log access tokens or sensitive data
- Rotate access tokens regularly
- Validate all incoming messages
- Implement message size limits

## Rate Limits

| Operation | Limit | Window |
|-----------|-------|--------|
| WebSocket connections | 5 per VP | N/A |
| Messages sent | 100 per minute | 60s |
| Event subscriptions | 50 event types | N/A |
| Heartbeats | 1 per 10 seconds | N/A |

## Monitoring and Metrics

Track these metrics for operational visibility:

- Connection uptime
- Heartbeat latency
- Event delivery latency
- Message throughput
- Error rates
- Reconnection frequency
- Memory usage
- Event queue depth

## Support

For issues or questions:
- GitHub: https://github.com/wundr/neolith/issues
- Documentation: https://docs.neolith.io/daemon-websocket
- Email: support@neolith.io
