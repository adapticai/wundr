# Orchestrator Daemon Integration

Orchestrator daemon module for Neolith. Enables orchestrators (AI agents) to run as background daemons within their Neolith instance, handling automated interactions in channels.

## Architecture

### Key Concepts

1. **Orchestrators as Users**: Orchestrators log in like normal users via email/password or Google OAuth
2. **Background Daemon**: Their Neolith instance runs a daemon in the background for automation
3. **Auto-start on Login**: Daemon automatically starts when an orchestrator user logs in
4. **Health Monitoring**: Continuous health checks with auto-restart on failure
5. **Message Processing**: Handles incoming messages and generates AI responses

## Components

### OrchestratorDaemon

Core daemon class that handles message processing and automation.

```typescript
import { createOrchestratorDaemon, type OrchestratorWithUser } from '@neolith/core';

// Create daemon for an orchestrator user
const orchestrator: OrchestratorWithUser = /* user data */;

const daemon = createOrchestratorDaemon({
  orchestratorId: orchestrator.id,
  orchestrator,
  heartbeatInterval: 30000,
  maxConcurrentConversations: 10,
  autoRespond: true,
});

// Start daemon
await daemon.start();

// Handle incoming message
await daemon.handleMessage({
  id: 'msg_123',
  content: 'Hello @orchestrator',
  channelId: 'ch_456',
  authorId: 'user_789',
  timestamp: new Date(),
});

// Get health status
const health = daemon.getHealthStatus();
console.log('Status:', health.status);
console.log('Uptime:', health.uptime);
console.log('Messages processed:', health.totalMessagesProcessed);

// Stop daemon
await daemon.stop();
```

### OrchestratorDaemonManager

Manages multiple daemon instances with health monitoring and auto-restart.

```typescript
import { getDaemonManager, type OrchestratorWithUser } from '@neolith/core';

// Get singleton manager instance
const manager = getDaemonManager({
  autoStart: true,
  healthCheckInterval: 60000,
  autoRestart: true,
  maxRestartAttempts: 3,
});

// Start daemon for orchestrator
const orchestrator: OrchestratorWithUser = /* user data */;
await manager.startDaemon(orchestrator);

// Check if daemon is running
const isRunning = manager.isDaemonRunning(orchestrator.id);

// Get daemon instance
const daemon = manager.getDaemon(orchestrator.id);

// Get daemon status
const status = manager.getDaemonStatus(orchestrator.id);

// Stop daemon
await manager.stopDaemon(orchestrator.id);

// Stop all daemons
await manager.stopAllDaemons();
```

### Auto-start on Login

Hook into user login to auto-start daemon for orchestrators:

```typescript
import { getDaemonManager, type OrchestratorWithUser } from '@neolith/core';

// In your auth handler
async function handleUserLogin(user: OrchestratorWithUser) {
  // ... authentication logic ...

  // Auto-start daemon if orchestrator
  const manager = getDaemonManager();
  await manager.onUserLogin(user);
}

// In your logout handler
async function handleUserLogout(userId: string) {
  // Stop daemon on logout
  const manager = getDaemonManager();
  await manager.onUserLogout(userId);
}
```

## Configuration

### Environment Variables

```bash
# Enable orchestrator mode
ORCHESTRATOR_MODE=true
NEXT_PUBLIC_ORCHESTRATOR_MODE=true

# Auto-start daemon on login
DAEMON_AUTO_START=true
NEXT_PUBLIC_DAEMON_AUTO_START=true

# Heartbeat interval (milliseconds)
DAEMON_HEARTBEAT_INTERVAL=30000

# Health check interval (milliseconds)
DAEMON_HEALTH_CHECK_INTERVAL=60000

# Auto-restart on failure
DAEMON_AUTO_RESTART=true

# Max restart attempts
DAEMON_MAX_RESTART_ATTEMPTS=3

# Verbose logging
DAEMON_VERBOSE=false

# Max concurrent conversations
DAEMON_MAX_CONCURRENT_CONVERSATIONS=10
```

### Programmatic Configuration

```typescript
import {
  buildDaemonManagerConfig,
  buildDaemonConfig,
  initializeDaemonManager
} from '@neolith/core';

// Build config from environment
const managerConfig = buildDaemonManagerConfig();
const daemonConfig = buildDaemonConfig();

// Initialize manager with custom config
const manager = initializeDaemonManager({
  autoStart: true,
  healthCheckInterval: 60000,
  autoRestart: true,
  maxRestartAttempts: 5,
  verbose: true,
});
```

## Events

### Daemon Events

```typescript
daemon.on('started', () => {
  console.log('Daemon started');
});

daemon.on('stopped', () => {
  console.log('Daemon stopped');
});

daemon.on('error', (error) => {
  console.error('Daemon error:', error);
});

daemon.on('message:processed', (message) => {
  console.log('Message processed:', message.id);
});

daemon.on('message:send', (message) => {
  console.log('Sending response:', message.content);
});

daemon.on('action:execute', (action) => {
  console.log('Executing action:', action.type);
});

daemon.on('status:changed', (status) => {
  console.log('Status changed:', status);
});

daemon.on('heartbeat', (health) => {
  console.log('Heartbeat:', health);
});
```

### Manager Events

```typescript
manager.on('daemon:started', ({ orchestratorId, orchestrator }) => {
  console.log(`Daemon started for ${orchestrator.user.name}`);
});

manager.on('daemon:stopped', ({ orchestratorId }) => {
  console.log('Daemon stopped:', orchestratorId);
});

manager.on('daemon:error', ({ orchestratorId, error }) => {
  console.error('Daemon error:', orchestratorId, error);
});

manager.on('daemon:restarted', ({ orchestratorId, restartCount }) => {
  console.log(`Daemon restarted (attempt ${restartCount}):`, orchestratorId);
});

manager.on('daemon:health', ({ orchestratorId, health }) => {
  console.log('Health check:', orchestratorId, health);
});

manager.on('daemon:message-processed', ({ orchestratorId, message }) => {
  console.log('Message processed:', orchestratorId, message);
});
```

## Integration Example

### Next.js App Router

```typescript
// app/api/auth/login/route.ts
import { getDaemonManager } from '@neolith/core';
import { orchestratorService } from '@neolith/core';

export async function POST(request: Request) {
  const { email, password } = await request.json();

  // Authenticate user
  const user = await authenticateUser(email, password);

  // Check if user is an orchestrator
  if (user.isOrchestrator) {
    const orchestrator = await orchestratorService.getVP(user.id);

    if (orchestrator) {
      // Auto-start daemon
      const manager = getDaemonManager();
      await manager.onUserLogin(orchestrator);
    }
  }

  return Response.json({ user });
}
```

### React Hook

```typescript
// hooks/useOrchestratorDaemon.ts
import { useEffect, useState } from 'react';
import { getDaemonManager } from '@neolith/core';
import type { DaemonHealthStatus } from '@neolith/core';

export function useOrchestratorDaemon(orchestratorId?: string) {
  const [status, setStatus] = useState<DaemonHealthStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!orchestratorId) return;

    const manager = getDaemonManager();

    // Initial status
    const daemonStatus = manager.getDaemonStatus(orchestratorId);
    setStatus(daemonStatus);
    setIsRunning(manager.isDaemonRunning(orchestratorId));

    // Listen for health updates
    const handleHealth = ({ orchestratorId: id, health }: any) => {
      if (id === orchestratorId) {
        setStatus(health);
        setIsRunning(health.status === 'running');
      }
    };

    manager.on('daemon:health', handleHealth);

    return () => {
      manager.off('daemon:health', handleHealth);
    };
  }, [orchestratorId]);

  return { status, isRunning };
}
```

## Message Processing Flow

1. **Message Received**: Channel message arrives via WebSocket/polling
2. **Daemon Check**: Manager checks if daemon is running for mentioned orchestrator
3. **Queue or Process**: Message queued if daemon busy, otherwise processed immediately
4. **Mention Detection**: Checks if orchestrator is mentioned in message
5. **AI Generation**: Generates response using orchestrator's charter/personality
6. **Send Response**: Sends response back to channel
7. **Update Metrics**: Tracks message count and conversation state

## Health Monitoring

- **Heartbeat**: Periodic heartbeat signals daemon is alive
- **Health Checks**: Manager performs periodic health checks on all daemons
- **Auto-restart**: Daemons automatically restart on error (configurable attempts)
- **Status Tracking**: Real-time status: stopped, initializing, running, error, stopping

## Database Schema

Orchestrators are stored as users with special flags:

```prisma
model user {
  id                 String   @id @default(cuid())
  email              String   @unique
  name               String?
  isOrchestrator     Boolean  @default(false) @map("is_vp")
  orchestratorConfig Json?    @map("vp_config")
  // ... other fields

  orchestrator       orchestrator?
}

model orchestrator {
  id              String            @id @default(cuid())
  discipline      String
  role            String
  capabilities    Json              @default("[]")
  daemonEndpoint  String?           @map("daemon_endpoint")
  status          OrchestratorStatus @default(OFFLINE)
  userId          String            @unique @map("user_id")
  organizationId  String            @map("organization_id")
  // ... other fields

  user           user              @relation(fields: [userId], references: [id])
  organization   organization      @relation(fields: [organizationId], references: [id])
}
```

## Future Enhancements

### Planned Features

1. **Web Workers**: Move daemon to web worker for true background processing
2. **Service Worker**: Integrate with service worker for offline support
3. **AI Integration**: Connect to Claude API for intelligent responses
4. **Memory System**: Integrate with orchestrator-daemon memory manager
5. **Session Management**: Full session management with context preservation
6. **WebSocket Server**: Direct WebSocket connection to daemon
7. **Task Queue**: Redis-backed task queue for scalability
8. **Distributed Daemons**: Support for running daemons on separate servers

## Testing

```typescript
import { createOrchestratorDaemon, OrchestratorDaemonManager } from '@neolith/core';

describe('OrchestratorDaemon', () => {
  it('should start and stop daemon', async () => {
    const daemon = createOrchestratorDaemon({
      orchestratorId: 'orch_123',
      orchestrator: mockOrchestrator,
    });

    await daemon.start();
    expect(daemon.isRunning()).toBe(true);

    await daemon.stop();
    expect(daemon.isRunning()).toBe(false);
  });

  it('should process messages', async () => {
    const daemon = createOrchestratorDaemon({
      orchestratorId: 'orch_123',
      orchestrator: mockOrchestrator,
    });

    await daemon.start();

    const message = {
      id: 'msg_123',
      content: 'Hello @orchestrator',
      channelId: 'ch_456',
      authorId: 'user_789',
      timestamp: new Date(),
    };

    await daemon.handleMessage(message);

    const health = daemon.getHealthStatus();
    expect(health.totalMessagesProcessed).toBe(1);
  });
});

describe('OrchestratorDaemonManager', () => {
  afterEach(() => {
    OrchestratorDaemonManager.resetInstance();
  });

  it('should manage multiple daemons', async () => {
    const manager = OrchestratorDaemonManager.getInstance();

    await manager.startDaemon(mockOrchestrator1);
    await manager.startDaemon(mockOrchestrator2);

    expect(manager.isDaemonRunning(mockOrchestrator1.id)).toBe(true);
    expect(manager.isDaemonRunning(mockOrchestrator2.id)).toBe(true);

    await manager.stopAllDaemons();

    expect(manager.isDaemonRunning(mockOrchestrator1.id)).toBe(false);
    expect(manager.isDaemonRunning(mockOrchestrator2.id)).toBe(false);
  });
});
```

## License

MIT
