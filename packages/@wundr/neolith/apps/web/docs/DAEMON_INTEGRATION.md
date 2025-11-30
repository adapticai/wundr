# Orchestrator Daemon Integration

This document describes how the Neolith web application connects to and interacts with the orchestrator-daemon.

## Overview

The daemon integration provides real-time communication between the web UI and the orchestrator-daemon WebSocket server. This enables:

- Spawning new orchestrator sessions
- Real-time streaming output from sessions
- Monitoring session status and metrics
- Tracking daemon health and performance
- Tool execution notifications

## Architecture

```
┌─────────────────┐         WebSocket         ┌──────────────────┐
│                 │    ws://localhost:8787     │                  │
│  Neolith Web UI │◄──────────────────────────►│ Orchestrator     │
│                 │                            │ Daemon           │
└─────────────────┘                            └──────────────────┘
       │                                              │
       │ React Hooks                                  │
       │ (useDaemon)                                  │
       │                                              │
       ▼                                              ▼
┌─────────────────┐                          ┌──────────────────┐
│  DaemonClient   │                          │ Session Manager  │
│  (lib/daemon-   │                          │ Memory Manager   │
│   client.ts)    │                          │ LLM Integration  │
└─────────────────┘                          └──────────────────┘
```

## Components

### 1. DaemonClient (`/lib/daemon-client.ts`)

Low-level WebSocket client that manages the connection to the orchestrator-daemon.

**Features:**
- Automatic reconnection with exponential backoff
- Type-safe message handling
- Event-based architecture
- Heartbeat/keepalive support
- Session tracking

**Usage:**
```typescript
import { getDaemonClient } from '@/lib/daemon-client';

const client = getDaemonClient();
await client.connect();

client.on('connected', () => {
  console.log('Connected to daemon');
});

client.on('session_spawned', (session) => {
  console.log('New session:', session.id);
});
```

### 2. useDaemon Hook (`/hooks/use-daemon.ts`)

React hook that provides a clean API for components to interact with the daemon.

**Features:**
- Automatic connection management
- Session state tracking
- Real-time streaming handlers
- Error handling
- Reconnection state

**Usage:**
```typescript
import { useDaemon } from '@/hooks';

function MyComponent() {
  const {
    connected,
    sessions,
    spawnSession,
    executeTask,
  } = useDaemon({ autoConnect: true });

  // Use the hook...
}
```

### 3. useSessionMonitor Hook (`/hooks/use-daemon.ts`)

Hook for monitoring a specific session with streaming support.

**Usage:**
```typescript
import { useSessionMonitor } from '@/hooks';

function SessionView({ sessionId }: { sessionId: string }) {
  const { session, streamOutput } = useSessionMonitor(sessionId);

  return <pre>{streamOutput}</pre>;
}
```

## Configuration

### Environment Variables

Add to your `.env.local`:

```bash
# WebSocket URL for orchestrator-daemon
NEXT_PUBLIC_DAEMON_WS_URL=ws://localhost:8787

# For production with SSL:
# NEXT_PUBLIC_DAEMON_WS_URL=wss://daemon.yourapp.com
```

### Connection Options

```typescript
const { connected } = useDaemon({
  // Auto-connect when component mounts
  autoConnect: true,

  // Custom WebSocket URL (overrides env var)
  url: 'ws://localhost:8787',

  // Event handlers for streaming
  handlers: {
    onStreamChunk: (chunk) => {
      console.log('Chunk:', chunk.chunk);
    },
    onToolCallStart: (info) => {
      console.log('Tool starting:', info.toolName);
    },
    onTaskCompleted: (sessionId, taskId, result) => {
      console.log('Task done:', result);
    },
  },
});
```

## WebSocket Protocol

### Client → Server Messages

#### Spawn Session
```json
{
  "type": "spawn_session",
  "payload": {
    "orchestratorId": "vp_123",
    "task": {
      "type": "code",
      "description": "Implement feature X",
      "priority": "high",
      "status": "pending"
    },
    "sessionType": "claude-code",
    "memoryProfile": "default"
  }
}
```

#### Execute Task
```json
{
  "type": "execute_task",
  "payload": {
    "sessionId": "session_abc123",
    "task": "Analyze the codebase",
    "context": {},
    "streamResponse": true
  }
}
```

#### Get Session Status
```json
{
  "type": "session_status",
  "payload": {
    "sessionId": "session_abc123"
  }
}
```

#### Stop Session
```json
{
  "type": "stop_session",
  "payload": {
    "sessionId": "session_abc123"
  }
}
```

#### Get Daemon Status
```json
{
  "type": "daemon_status"
}
```

#### Heartbeat
```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### Session Spawned
```json
{
  "type": "session_spawned",
  "session": {
    "id": "session_abc123",
    "orchestratorId": "vp_123",
    "task": { ... },
    "type": "claude-code",
    "status": "initializing",
    "startedAt": "2024-01-01T00:00:00Z",
    "metrics": { ... }
  }
}
```

#### Stream Chunk
```json
{
  "type": "stream_chunk",
  "data": {
    "sessionId": "session_abc123",
    "chunk": "Here is the analysis...",
    "metadata": {
      "type": "text",
      "index": 0
    }
  }
}
```

#### Tool Call Start
```json
{
  "type": "tool_call_start",
  "data": {
    "sessionId": "session_abc123",
    "toolName": "read_file",
    "toolInput": { "path": "/src/index.ts" },
    "status": "started",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

#### Tool Call Result
```json
{
  "type": "tool_call_result",
  "data": {
    "sessionId": "session_abc123",
    "toolName": "read_file",
    "status": "completed",
    "result": { "content": "..." },
    "timestamp": "2024-01-01T00:00:01Z"
  }
}
```

#### Task Completed
```json
{
  "type": "task_completed",
  "sessionId": "session_abc123",
  "taskId": "task_xyz",
  "result": { ... }
}
```

#### Daemon Status Update
```json
{
  "type": "daemon_status_update",
  "status": {
    "status": "running",
    "uptime": 123456,
    "activeSessions": 3,
    "queuedTasks": 1,
    "metrics": {
      "totalSessionsSpawned": 42,
      "totalTasksProcessed": 156,
      "totalTokensUsed": 98765,
      "successRate": 0.95
    },
    "subsystems": {
      "sessionManager": { "status": "running" },
      "memoryManager": { "status": "running" },
      "llmClient": { "status": "running" }
    }
  }
}
```

## Usage Examples

See `/docs/daemon-integration-example.tsx` for complete examples including:

1. Basic connection management
2. Session spawning and management
3. Real-time streaming output
4. Session monitoring
5. Daemon status dashboard

## API Routes

The Neolith backend provides HTTP API routes for daemon communication in `/app/api/daemon/`:

- `POST /api/daemon` - Register daemon
- `GET /api/daemon` - Get daemon status
- `DELETE /api/daemon` - Unregister daemon
- `POST /api/daemon/sessions` - Create session
- `GET /api/daemon/sessions` - List sessions
- `PATCH /api/daemon/sessions` - Update session
- `DELETE /api/daemon/sessions` - Delete session
- `POST /api/daemon/heartbeat` - Send heartbeat
- `GET /api/daemon/events` - Get events (SSE)
- `GET /api/daemon/ws` - WebSocket info

## Error Handling

The daemon client handles errors automatically:

```typescript
const { error, connected } = useDaemon({
  autoConnect: true,
  handlers: {
    // Custom error handling
  },
});

if (error) {
  console.error('Daemon error:', error.message);
}

if (!connected) {
  // Show reconnecting UI
}
```

### Reconnection

Automatic reconnection with exponential backoff:
- 1st attempt: 3 seconds
- 2nd attempt: 6 seconds
- 3rd attempt: 12 seconds
- etc., up to max 10 attempts

## Performance Considerations

### Heartbeat Interval
Default: 30 seconds. Keeps connection alive.

### Message Throttling
Stream chunks are sent as they arrive. For high-frequency updates, consider debouncing in the UI.

### Memory Management
Sessions are tracked in memory. Clean up old sessions:

```typescript
const { stopSession, sessions } = useDaemon();

// Stop inactive sessions
sessions
  .filter(s => s.status === 'completed')
  .forEach(s => stopSession(s.id));
```

## Security

### WebSocket Authentication
Connection is established without authentication initially. Implement token-based auth if needed:

```typescript
// In daemon-client.ts, modify connect():
this.ws.addEventListener('open', () => {
  // Send auth token
  this.send({ type: 'auth', token: 'your-jwt-token' });
});
```

### CORS Configuration
For production, configure CORS on the daemon server to only allow your web domain.

### SSL/TLS
Use `wss://` in production:
```bash
NEXT_PUBLIC_DAEMON_WS_URL=wss://daemon.yourapp.com
```

## Troubleshooting

### Connection Fails
1. Check daemon is running: `curl http://localhost:8787/health`
2. Verify WebSocket URL in `.env.local`
3. Check browser console for WebSocket errors

### No Messages Received
1. Verify daemon is sending messages
2. Check event handler registration in `useDaemon`
3. Inspect WebSocket frames in browser DevTools

### Sessions Not Updating
1. Ensure session ID matches
2. Check that daemon is emitting session events
3. Verify event listeners are registered

## Development

### Start the Daemon
```bash
cd packages/@wundr/orchestrator-daemon
npm run start:dev
```

### Start the Web UI
```bash
cd packages/@wundr/neolith/apps/web
npm run dev
```

### Test WebSocket Connection
```bash
# In browser console:
const ws = new WebSocket('ws://localhost:8787');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.send(JSON.stringify({ type: 'ping' }));
```

## Future Enhancements

- [ ] Token-based authentication
- [ ] Message compression for large payloads
- [ ] Binary protocol for efficiency
- [ ] Multi-daemon load balancing
- [ ] Offline queue for messages
- [ ] GraphQL subscriptions alternative
- [ ] Redis pub/sub for multi-server support

## References

- [orchestrator-daemon README](/packages/@wundr/orchestrator-daemon/README.md)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
