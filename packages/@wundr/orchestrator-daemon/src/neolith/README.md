# Neolith API Client

A TypeScript client for communicating with the Neolith web application from the orchestrator-daemon.

## Features

- **JWT Authentication**: Secure authentication with automatic token management
- **Auto Token Refresh**: Automatically refreshes access tokens before expiry
- **Retry Logic**: Built-in retry mechanism with exponential backoff
- **Type Safety**: Full TypeScript types for all API operations
- **Message Operations**: Read and send messages to channels
- **Heartbeat Management**: Send periodic heartbeats with metrics
- **Status Updates**: Update orchestrator operational status
- **Configuration**: Retrieve orchestrator configuration

## Installation

```bash
npm install @wundr.io/orchestrator-daemon
```

## Quick Start

```typescript
import { NeolithApiClient } from '@wundr.io/orchestrator-daemon';

// Create client
const client = new NeolithApiClient({
  baseUrl: 'https://neolith.wundr.io',
  apiKey: 'vp_abc123_xyz',
  apiSecret: 'secret_key',
});

// Authenticate
await client.authenticate(['messages:read', 'messages:write']);

// Send heartbeat
await client.sendHeartbeat({
  status: 'active',
  metrics: {
    memoryUsageMB: 256,
    cpuUsagePercent: 15.5,
  },
});

// Get messages
const { messages } = await client.getMessages('chan_123', { limit: 50 });

// Send message
await client.sendMessage('chan_123', 'Hello from daemon!');
```

## API Reference

### Constructor

```typescript
new NeolithApiClient(config: NeolithApiConfig)
```

Configuration options:

- `baseUrl` (required): Base URL of the Neolith web app
- `apiKey` (required): API key for authentication
- `apiSecret` (required): API secret for authentication
- `retryAttempts` (optional): Number of retry attempts for failed requests (default: 3)
- `retryDelay` (optional): Initial delay between retries in ms (default: 1000)
- `tokenRefreshBuffer` (optional): Time before token expiry to refresh in ms (default: 300000 / 5 minutes)

### Authentication

#### `authenticate(scopes?: string[]): Promise<AuthResponse>`

Authenticate with the Neolith API and obtain JWT tokens.

**Parameters:**
- `scopes` (optional): Array of permission scopes to request

**Returns:**
- Authentication response with tokens and orchestrator info

**Example:**
```typescript
const auth = await client.authenticate(['messages:read', 'messages:write']);
console.log('Authenticated as:', auth.orchestrator.user.name);
```

#### `refreshAccessToken(): Promise<RefreshResponse>`

Manually refresh the access token. Usually called automatically when needed.

**Returns:**
- New access token and expiry time

#### `isAuthenticated(): boolean`

Check if the client is currently authenticated.

**Returns:**
- `true` if authenticated, `false` otherwise

#### `clearAuth(): void`

Clear authentication state (tokens, session ID).

### Heartbeats

#### `sendHeartbeat(options?: HeartbeatOptions): Promise<HeartbeatResponse>`

Send a heartbeat to indicate the daemon is alive and optionally include metrics.

**Parameters:**
- `options.sessionId` (optional): Session ID (defaults to current session)
- `options.status` (optional): Status - 'active', 'idle', or 'busy' (default: 'active')
- `options.metrics` (optional): Performance metrics object

**Metrics fields:**
- `memoryUsageMB`: Memory usage in megabytes
- `cpuUsagePercent`: CPU usage percentage
- `activeConnections`: Number of active connections
- `messagesProcessed`: Total messages processed
- `errorsCount`: Number of errors encountered
- `uptimeSeconds`: Uptime in seconds
- `lastTaskCompletedAt`: ISO timestamp of last completed task
- `queueDepth`: Number of tasks in queue

**Returns:**
- Server response with timing information

**Example:**
```typescript
await client.sendHeartbeat({
  status: 'active',
  metrics: {
    memoryUsageMB: 256,
    cpuUsagePercent: 15.5,
    activeConnections: 5,
    messagesProcessed: 42,
  },
});
```

### Messages

#### `getMessages(channelId: string, options?: GetMessagesOptions): Promise<MessagesResponse>`

Retrieve messages from a channel.

**Parameters:**
- `channelId` (required): The channel ID to fetch messages from
- `options.limit` (optional): Maximum number of messages to return (max: 100)
- `options.before` (optional): Message ID to fetch messages before
- `options.after` (optional): Message ID to fetch messages after

**Returns:**
- Array of messages with author information

**Example:**
```typescript
const { messages } = await client.getMessages('chan_123', {
  limit: 50,
  before: 'msg_456',
});

messages.forEach(msg => {
  console.log(`${msg.author.name}: ${msg.content}`);
});
```

#### `sendMessage(channelId: string, content: string, options?: SendMessageOptions): Promise<SendMessageResponse>`

Send a message to a channel.

**Parameters:**
- `channelId` (required): The channel ID to send the message to
- `content` (required): The message content
- `options.threadId` (optional): Parent message ID for threaded replies
- `options.attachments` (optional): Array of attachment references
- `options.metadata` (optional): Custom metadata object

**Returns:**
- Message ID of the created message

**Example:**
```typescript
// Simple message
const { messageId } = await client.sendMessage('chan_123', 'Hello!');

// Threaded reply with metadata
await client.sendMessage('chan_123', 'Reply message', {
  threadId: 'msg_456',
  metadata: {
    source: 'automated',
    priority: 'high',
  },
});
```

### Status

#### `updateStatus(status: OrchestratorStatus, options?: UpdateStatusOptions): Promise<{ success: true }>`

Update the orchestrator's operational status.

**Parameters:**
- `status` (required): New status - 'active', 'paused', or 'error'
- `options.message` (optional): Human-readable status message

**Returns:**
- Success confirmation

**Example:**
```typescript
await client.updateStatus('active', {
  message: 'Processing incoming requests',
});

// Later...
await client.updateStatus('paused', {
  message: 'Performing maintenance',
});
```

### Configuration

#### `getConfig(): Promise<OrchestratorConfig>`

Retrieve the full orchestrator configuration.

**Returns:**
- Complete configuration object including orchestrator details, capabilities, and operational settings

**Example:**
```typescript
const config = await client.getConfig();
console.log('Role:', config.orchestrator.role);
console.log('Heartbeat interval:', config.operationalConfig.heartbeatIntervalMs);
console.log('Scopes:', config.scopes);
```

## Advanced Usage

### Automatic Token Refresh

The client automatically refreshes access tokens before they expire. You can configure the refresh buffer:

```typescript
const client = new NeolithApiClient({
  baseUrl: 'https://neolith.wundr.io',
  apiKey: process.env.API_KEY!,
  apiSecret: process.env.API_SECRET!,
  tokenRefreshBuffer: 5 * 60 * 1000, // Refresh 5 minutes before expiry
});
```

### Retry Logic

Failed requests are automatically retried with exponential backoff:

```typescript
const client = new NeolithApiClient({
  baseUrl: 'https://neolith.wundr.io',
  apiKey: process.env.API_KEY!,
  apiSecret: process.env.API_SECRET!,
  retryAttempts: 5, // Retry up to 5 times
  retryDelay: 2000, // Start with 2 second delay
});
```

### Periodic Heartbeat Loop

Set up a periodic heartbeat to keep the orchestrator online:

```typescript
const client = new NeolithApiClient({ /* config */ });
await client.authenticate();

const config = await client.getConfig();
const intervalMs = config.operationalConfig.heartbeatIntervalMs;

setInterval(async () => {
  try {
    await client.sendHeartbeat({
      status: 'active',
      metrics: {
        memoryUsageMB: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
        uptimeSeconds: Math.floor(process.uptime()),
      },
    });
  } catch (error) {
    console.error('Heartbeat failed:', error);
  }
}, intervalMs);
```

### Error Handling

All methods throw errors on failure. Wrap calls in try-catch blocks:

```typescript
try {
  await client.sendMessage('chan_123', 'Hello!');
} catch (error) {
  console.error('Failed to send message:', error.message);
  // Handle error (retry, log, etc.)
}
```

## API Routes

The client interacts with these Neolith API endpoints:

- `POST /api/daemon/auth` - Authenticate and get tokens
- `POST /api/daemon/auth/refresh` - Refresh access token
- `POST /api/daemon/heartbeat` - Send heartbeat with metrics
- `GET /api/daemon/messages` - Get messages from a channel
- `POST /api/daemon/messages` - Send a message to a channel
- `PUT /api/daemon/status` - Update orchestrator status
- `GET /api/daemon/config` - Get orchestrator configuration

## Environment Variables

Common environment variables for configuration:

```bash
NEOLITH_URL=https://neolith.wundr.io
NEOLITH_API_KEY=vp_abc123_xyz
NEOLITH_API_SECRET=secret_key_here
```

## Examples

See the [usage examples](./examples/usage-example.ts) for comprehensive examples including:

- Basic authentication
- Sending heartbeats with metrics
- Reading and sending messages
- Status updates
- Token refresh handling
- Error handling
- Full daemon integration

Run examples:
```bash
ts-node src/neolith/examples/usage-example.ts basic
ts-node src/neolith/examples/usage-example.ts heartbeat
ts-node src/neolith/examples/usage-example.ts messaging
```

## TypeScript Types

All types are exported and fully documented:

```typescript
import type {
  NeolithApiConfig,
  AuthResponse,
  HeartbeatMetrics,
  Message,
  OrchestratorConfig,
} from '@wundr.io/orchestrator-daemon';
```

## License

MIT
