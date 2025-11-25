# @genesis/daemon-sdk

SDK for communicating with the Genesis Daemon service. Provides WebSocket-based real-time
communication with authentication, message handling, and presence management.

## Installation

```bash
npm install @genesis/daemon-sdk
```

## Configuration

The SDK requires configuration to connect to your Genesis Daemon instance:

```typescript
import { DaemonClient, DaemonConfig } from '@genesis/daemon-sdk';

const config: DaemonConfig = {
  // Required
  baseUrl: 'https://daemon.example.com/api', // HTTP API endpoint
  wsUrl: 'wss://daemon.example.com/ws', // WebSocket endpoint
  apiKey: 'your-api-key', // API key for authentication

  // Optional
  clientId: 'my-client-001', // Client identifier
  timeout: 30000, // Connection timeout (ms)
  autoReconnect: true, // Enable auto-reconnection
  maxReconnectAttempts: 5, // Max reconnection attempts
  reconnectDelay: 1000, // Initial reconnect delay (ms)
};

const client = new DaemonClient(config);
```

### Environment Variables

For production deployments, use environment variables:

```bash
GENESIS_DAEMON_URL=https://daemon.example.com/api
GENESIS_DAEMON_WS_URL=wss://daemon.example.com/ws
GENESIS_API_KEY=your-secure-api-key
```

```typescript
const config: DaemonConfig = {
  baseUrl: process.env.GENESIS_DAEMON_URL!,
  wsUrl: process.env.GENESIS_DAEMON_WS_URL!,
  apiKey: process.env.GENESIS_API_KEY!,
};
```

## Authentication Flow

The SDK uses API key authentication with automatic token refresh:

```
1. Client calls connect()
2. SDK authenticates with API key -> receives access + refresh tokens
3. SDK establishes WebSocket connection with access token
4. SDK automatically refreshes tokens before expiry
5. On disconnect, SDK attempts reconnection with current/refreshed tokens
```

### Manual Authentication

```typescript
import { AuthManager, validateApiKey } from '@genesis/daemon-sdk';

// Validate API key format
if (!validateApiKey(apiKey)) {
  throw new Error('Invalid API key format');
}

// Access auth manager for token inspection
const authManager = client.getAuthManager();

// Check authentication status
if (authManager.isAuthenticated()) {
  const token = authManager.getAccessToken();
  const scopes = authManager.getScopes();

  if (authManager.hasScope('messages:write')) {
    // Can send messages
  }
}

// Manual token refresh
await authManager.refreshAccessToken();

// Listen for token refresh events
authManager.onRefresh(tokens => {
  console.log('New access token:', tokens.accessToken);
});
```

## API Usage Examples

### Connecting to the Daemon

```typescript
import { DaemonClient, DaemonEventType, ConnectionState } from '@genesis/daemon-sdk';

const client = new DaemonClient(config);

// Set up event listeners before connecting
client.on(DaemonEventType.CONNECTED, () => {
  console.log('Connected to daemon');
});

client.on(DaemonEventType.AUTHENTICATED, auth => {
  console.log('Authenticated as:', auth.clientId);
  console.log('Scopes:', auth.scopes);
});

client.on(DaemonEventType.DISCONNECTED, ({ code, reason }) => {
  console.log(`Disconnected: ${code} - ${reason}`);
});

client.on(DaemonEventType.RECONNECTING, ({ attempt, maxAttempts }) => {
  console.log(`Reconnecting: attempt ${attempt}/${maxAttempts}`);
});

client.on(DaemonEventType.ERROR, error => {
  console.error('Error:', error.message);
});

// Connect
try {
  await client.connect();
  console.log('State:', client.getState()); // ConnectionState.AUTHENTICATED
} catch (error) {
  console.error('Connection failed:', error);
}
```

### Sending Messages

```typescript
import { MessagePriority } from '@genesis/daemon-sdk';

// Send a text message
const textMessage = await client.sendTextMessage('Hello, world!', ['agent-001', 'agent-002'], {
  priority: MessagePriority.HIGH,
});
console.log('Sent message:', textMessage.id);

// Send a command
const command = await client.sendCommand('analyze', 'analysis-agent', {
  data: { symbol: 'AAPL' },
  options: { depth: 'full' },
});

// Send an event
const event = await client.sendEvent('task.completed', {
  taskId: 'task-123',
  result: { success: true },
});

// Wait for acknowledgment
await client.sendTextMessage('Important message', ['agent-001'], {
  waitForAck: true,
  timeout: 5000,
  priority: MessagePriority.URGENT,
});
```

### Receiving Messages

```typescript
import { DaemonEventType, MessageType } from '@genesis/daemon-sdk';

client.on(DaemonEventType.MESSAGE, message => {
  switch (message.type) {
    case MessageType.TEXT:
      console.log(`Text from ${message.senderId}: ${message.content}`);
      break;

    case MessageType.COMMAND:
      console.log(`Command: ${message.command} for ${message.target}`);
      handleCommand(message);
      break;

    case MessageType.EVENT:
      console.log(`Event: ${message.eventName} from ${message.source}`);
      handleEvent(message);
      break;

    case MessageType.STATUS:
      console.log(`Status: ${message.code} - ${message.description}`);
      break;

    case MessageType.ERROR:
      console.error(`Error: ${message.errorCode} - ${message.errorMessage}`);
      break;
  }
});
```

### Presence Management

```typescript
import { PresenceStatus } from '@genesis/daemon-sdk';

// Update presence
await client.updatePresence(PresenceStatus.ONLINE, 'Ready to process tasks', {
  capabilities: ['analysis', 'generation'],
});

// Set busy status
await client.updatePresence(PresenceStatus.BUSY, 'Processing large dataset');

// Get current presence
const presence = client.getPresence();
console.log('Current status:', presence?.status);

// Listen for presence updates from others
client.on(DaemonEventType.PRESENCE, info => {
  console.log(`${info.clientId} is now ${info.status}`);
});
```

### Event Subscription Management

```typescript
// Subscribe and get unsubscribe function
const unsubscribe = client.on(DaemonEventType.MESSAGE, msg => {
  console.log('Message received:', msg);
});

// Later, unsubscribe
unsubscribe();

// Or manually unsubscribe
const handler = msg => console.log(msg);
client.on(DaemonEventType.MESSAGE, handler);
client.off(DaemonEventType.MESSAGE, handler);
```

### Graceful Shutdown

```typescript
// Disconnect and cleanup
await client.disconnect();

// Or full disposal (clears all handlers)
await client.dispose();
```

## Error Handling

```typescript
import { AuthenticationError } from '@genesis/daemon-sdk';

try {
  await client.connect();
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error(`Auth failed (${error.statusCode}): ${error.message}`);
    // Handle auth failure - perhaps prompt for new credentials
  } else {
    console.error('Connection error:', error);
    // Handle other connection errors
  }
}

// Listen for runtime errors
client.on(DaemonEventType.ERROR, error => {
  console.error('Runtime error:', error);
});

client.on(DaemonEventType.AUTH_FAILED, ({ error }) => {
  console.error('Authentication failed:', error);
});
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import type {
  DaemonConfig,
  AuthResponse,
  DaemonMessage,
  TextMessage,
  CommandMessage,
  EventMessage,
  PresenceInfo,
  SendMessageOptions,
} from '@genesis/daemon-sdk';
```

## License

MIT
