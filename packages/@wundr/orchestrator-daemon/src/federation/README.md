# Federation - Multi-Orchestrator Coordination

Phase 5.1 implementation of the Orchestrator Daemon federation system, enabling multiple orchestrators to coordinate, delegate tasks, and share context.

## Overview

The OrchestratorConnection class provides WebSocket-based communication between orchestrators in a federated network. It handles:

- Message passing and routing
- Capability checking and matching
- Task delegation and acceptance
- Heartbeat monitoring
- Connection health tracking
- Graceful disconnection

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Federation Layer                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Orchestrator A  │◄───────►│ Orchestrator B  │           │
│  │                 │  WebSocket│                 │           │
│  │ Connection ─────┼─────────┼───── Connection │           │
│  │ - Capabilities  │         │  - Capabilities  │           │
│  │ - Message Queue │         │  - Message Queue │           │
│  │ - Heartbeat     │         │  - Heartbeat     │           │
│  └─────────────────┘         └─────────────────┘           │
│                                                               │
│  Message Types:                                              │
│  - delegation: Task delegation requests                      │
│  - callback: Task progress/completion                        │
│  - broadcast: Federation-wide announcements                  │
│  - heartbeat: Connection health monitoring                   │
│  - status: Connection status updates                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## OrchestratorConnection Class

### Constructor

```typescript
import { OrchestratorConnection } from '@wundr.io/orchestrator-daemon/federation';

const connection = new OrchestratorConnection({
  id: 'remote-orchestrator-1',
  socket: websocketInstance,
  capabilities: ['code-generation', 'testing', 'analysis'],
  heartbeatTimeout: 60000, // Optional, default: 60s
  maxQueueSize: 1000,      // Optional, default: 1000
});
```

### Properties

- `id: string` - Unique identifier for the remote orchestrator
- `socket: WebSocket` - WebSocket connection instance
- `capabilities: OrchestratorCapability[]` - Array of orchestrator capabilities
- `status: ConnectionStatus` - Current connection status (readonly)
- `lastHeartbeat: Date` - Timestamp of last heartbeat (readonly)
- `messageQueue: FederationMessage[]` - Queued messages (readonly)

### Methods

#### checkCapability(required: OrchestratorCapability[]): boolean

Check if the orchestrator has all required capabilities.

```typescript
const canHandleTask = connection.checkCapability([
  'code-generation',
  'testing'
]);
```

#### acceptDelegation(request: DelegationRequest): Promise<DelegationResponse>

Accept or reject a task delegation request.

```typescript
const response = await connection.acceptDelegation({
  fromOrchestratorId: 'orch-1',
  toOrchestratorId: 'orch-2',
  task: {
    id: 'task-123',
    type: 'code',
    description: 'Implement feature',
    priority: 'high',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  priority: 'high',
});

if (response.accepted) {
  console.log('Task accepted');
} else {
  console.log('Task rejected:', response.reason);
}
```

#### sendMessage(message: FederationMessage): Promise<void>

Send a message to the connected orchestrator.

```typescript
await connection.sendMessage({
  type: 'callback',
  payload: {
    taskId: 'task-123',
    status: 'completed',
    result: { success: true },
  },
  from: 'orch-1',
  to: 'orch-2',
  timestamp: new Date(),
  correlationId: 'task-123',
});
```

#### getStatus(): ConnectionHealth

Get connection status and health information.

```typescript
const status = connection.getStatus();
console.log({
  status: status.status,        // 'connected', 'active', etc.
  uptime: status.uptime,         // milliseconds
  messagesSent: status.messagesSent,
  messagesReceived: status.messagesReceived,
  errors: status.errors,
  lastHeartbeat: status.lastHeartbeat,
});
```

#### handleHeartbeat(): void

Update the last heartbeat timestamp.

```typescript
connection.handleHeartbeat();
```

#### isHealthy(): boolean

Check if connection is active and responsive.

```typescript
if (connection.isHealthy()) {
  // Connection is good
} else {
  // Connection degraded or lost
}
```

#### disconnect(): Promise<void>

Gracefully close the connection, sending any queued messages first.

```typescript
await connection.disconnect();
```

### Events

The OrchestratorConnection class extends EventEmitter and emits the following events:

#### message

Emitted when any message is received.

```typescript
connection.on('message', (message: FederationMessage) => {
  console.log('Message received:', message.type);
});
```

#### delegation

Emitted when a delegation request is received.

```typescript
connection.on('delegation', (request: DelegationRequest) => {
  console.log('Delegation for task:', request.task.id);
});
```

#### callback

Emitted when a task callback is received.

```typescript
connection.on('callback', (callback: TaskCallback) => {
  console.log('Task update:', callback.taskId, callback.status);
});
```

#### heartbeat

Emitted when a heartbeat is received or updated.

```typescript
connection.on('heartbeat', (timestamp: Date) => {
  console.log('Heartbeat at:', timestamp);
});
```

#### status

Emitted when connection status is updated.

```typescript
connection.on('status', (health: ConnectionHealth) => {
  console.log('Status:', health.status);
});
```

#### broadcast

Emitted when a broadcast message is received.

```typescript
connection.on('broadcast', (payload: BroadcastPayload) => {
  console.log('Broadcast on topic:', payload.topic);
});
```

#### error

Emitted when an error occurs.

```typescript
connection.on('error', (error: Error) => {
  console.error('Connection error:', error);
});
```

#### close

Emitted when the connection is closed.

```typescript
connection.on('close', (code: number, reason: string) => {
  console.log('Connection closed:', code, reason);
});
```

## Types

### OrchestratorCapability

```typescript
type OrchestratorCapability =
  | 'code-generation'
  | 'research'
  | 'analysis'
  | 'testing'
  | 'deployment'
  | 'monitoring'
  | 'security'
  | 'data-processing'
  | 'ml-training'
  | 'custom';
```

### ConnectionStatus

```typescript
type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'active'
  | 'idle'
  | 'degraded'
  | 'disconnected'
  | 'error';
```

### FederationMessageType

```typescript
type FederationMessageType =
  | 'delegation'
  | 'callback'
  | 'broadcast'
  | 'heartbeat'
  | 'status';
```

### FederationMessage

```typescript
interface FederationMessage {
  type: FederationMessageType;
  payload: unknown;
  from: string;
  to: string;
  timestamp: Date;
  correlationId?: string;
}
```

### DelegationRequest

```typescript
interface DelegationRequest {
  fromOrchestratorId: string;
  toOrchestratorId: string;
  task: Task;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiredCapabilities?: Partial<OrchestratorCapabilities>;
  context?: SharedContext;
  timeout?: number;
  callbackId?: string;
}
```

### DelegationResponse

```typescript
interface DelegationResponse {
  taskId: string;
  accepted: boolean;
  reason?: string;
  estimatedCompletion?: Date;
  assignedResources?: {
    sessions: number;
    tokens: number;
  };
}
```

## Usage Examples

### Basic Connection

```typescript
import * as WebSocket from 'ws';
import { OrchestratorConnection } from '@wundr.io/orchestrator-daemon/federation';

const socket = new WebSocket.WebSocket('ws://remote:8788/federation');

const connection = new OrchestratorConnection({
  id: 'remote-orch-1',
  socket,
  capabilities: ['code-generation', 'testing'],
});

connection.on('message', (msg) => {
  console.log('Received:', msg.type);
});

await new Promise((resolve) => socket.on('open', resolve));
console.log('Connected!');
```

### Task Delegation

```typescript
// Check if remote has required capabilities
if (connection.checkCapability(['code-generation', 'testing'])) {
  // Delegate task
  await connection.sendMessage({
    type: 'delegation',
    payload: {
      fromOrchestratorId: 'local',
      toOrchestratorId: 'remote-orch-1',
      task: {
        id: 'task-456',
        type: 'code',
        description: 'Implement login feature',
        priority: 'high',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      priority: 'high',
    },
    from: 'local',
    to: 'remote-orch-1',
    timestamp: new Date(),
  });
}
```

### Handling Delegations

```typescript
connection.on('delegation', async (request) => {
  console.log('Received task:', request.task.description);

  const response = await connection.acceptDelegation(request);

  if (response.accepted) {
    // Execute task
    executeTask(request.task);

    // Send progress updates
    await connection.sendMessage({
      type: 'callback',
      payload: {
        taskId: request.task.id,
        status: 'progress',
        progress: 50,
      },
      from: connection.id,
      to: request.fromOrchestratorId,
      timestamp: new Date(),
    });
  }
});
```

### Monitoring Connection Health

```typescript
// Check health periodically
setInterval(() => {
  if (!connection.isHealthy()) {
    console.warn('Connection unhealthy, reconnecting...');
    reconnect();
  }

  const status = connection.getStatus();
  console.log('Status:', status.status);
  console.log('Uptime:', status.uptime);
}, 10000);
```

## Message Queue

Messages sent when the connection is not open are automatically queued. The queue has a maximum size (default: 1000) and messages are sent in FIFO order when the connection becomes available.

```typescript
// Messages are queued if connection not ready
await connection.sendMessage(message1);
await connection.sendMessage(message2);

// When connection opens, queued messages are sent automatically
socket.on('open', () => {
  // Queue is now being processed
});
```

## Heartbeat Monitoring

Connections automatically monitor heartbeat and will mark themselves as degraded if no heartbeat is received within the timeout period (default: 60 seconds).

```typescript
// Manually send heartbeat
connection.handleHeartbeat();

// Listen for heartbeat events
connection.on('heartbeat', (timestamp) => {
  console.log('Heartbeat received:', timestamp);
});

// Check if connection is still healthy
if (!connection.isHealthy()) {
  console.warn('No heartbeat for too long');
}
```

## Error Handling

```typescript
connection.on('error', (error) => {
  console.error('Connection error:', error.message);

  // Attempt recovery
  if (error.message.includes('timeout')) {
    connection.handleHeartbeat();
  }
});

connection.on('close', (code, reason) => {
  console.log('Connection closed:', code, reason);

  if (code !== 1000) {
    // Abnormal closure, attempt reconnect
    setTimeout(reconnect, 5000);
  }
});
```

## Best Practices

1. **Always check capabilities** before delegating tasks
2. **Handle all event types** (delegation, callback, error, close)
3. **Monitor connection health** periodically
4. **Gracefully disconnect** when shutting down
5. **Implement reconnection logic** for resilience
6. **Use correlation IDs** to track related messages
7. **Set appropriate timeouts** based on network conditions
8. **Limit queue size** to prevent memory issues

## Testing

See `__tests__/connection.test.ts` for comprehensive test examples.

```bash
npm test -- connection.test.ts
```

## Related Files

- `connection.ts` - OrchestratorConnection implementation
- `types.ts` - Type definitions
- `examples/connection-example.ts` - Usage examples
- `__tests__/connection.test.ts` - Test suite

## Next Steps

- Phase 5.2: Implement FederationRegistry for orchestrator discovery
- Phase 5.3: Implement TaskDelegator for intelligent task routing
- Phase 5.4: Add load balancing and failover strategies
