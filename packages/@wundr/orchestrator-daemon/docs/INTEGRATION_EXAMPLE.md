# Neolith Backend Integration Example

This document provides a complete example of integrating the Orchestrator Daemon WebSocket server with the Neolith backend.

## Complete Server Implementation

### 1. Custom Next.js Server with WebSocket Support

Create `apps/web/server.ts`:

```typescript
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { DaemonWebSocketServer } from '@wundr/orchestrator-daemon';
import { prisma } from '@neolith/database';
import { redis, DaemonAuthService } from '@neolith/core';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Create daemon auth service
  const authService = new DaemonAuthService({
    prisma,
    redis,
    jwtSecret: process.env.DAEMON_JWT_SECRET!,
    issuer: 'neolith-platform',
    audience: 'neolith-api',
  });

  // Create WebSocket server
  const wsServer = new DaemonWebSocketServer({
    server: httpServer,
    prisma,
    redis,
    authService,
    path: '/daemon/ws',
    heartbeatInterval: 30000,
    authTimeout: 10000,
    maxConnectionsPerVP: 5,
  });

  // Monitor WebSocket events
  wsServer.on('connection:authenticated', (connectionId, metadata) => {
    console.log(`[WS] Connection authenticated: ${metadata.orchestratorId} (${connectionId})`);
  });

  wsServer.on('connection:closed', (connectionId, code, reason) => {
    console.log(`[WS] Connection closed: ${connectionId} (${code}: ${reason})`);
  });

  wsServer.on('event:routed', (eventId, connectionId) => {
    console.log(`[WS] Event routed: ${eventId} → ${connectionId}`);
  });

  wsServer.on('event:queued', (eventId, orchestratorId) => {
    console.log(`[WS] Event queued for offline VP: ${eventId} → ${orchestratorId}`);
  });

  // Start servers
  wsServer.start().then(() => {
    httpServer.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> WebSocket server ready at ws://${hostname}:${port}/daemon/ws`);
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await wsServer.stop();
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
});
```

### 2. Update package.json

```json
{
  "scripts": {
    "dev": "tsx watch server.ts",
    "build": "next build",
    "start": "NODE_ENV=production tsx server.ts"
  }
}
```

### 3. Environment Configuration

`.env`:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/neolith"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secret (use a strong random secret in production)
DAEMON_JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Server
HOSTNAME="localhost"
PORT=3000
NODE_ENV="development"

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000
WS_AUTH_TIMEOUT=10000
WS_MAX_CONNECTIONS_PER_VP=5
```

## Client Integration Example

### Orchestrator Daemon Client

```typescript
import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface DaemonConfig {
  wsUrl: string;
  accessToken: string;
  daemonId: string;
  orchestratorId: string;
  autoReconnect?: boolean;
  heartbeatInterval?: number;
}

export class OrchestratorDaemonClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: DaemonConfig;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 60000;
  private isConnecting = false;
  private isAuthenticated = false;

  constructor(config: DaemonConfig) {
    super();
    this.config = {
      autoReconnect: true,
      heartbeatInterval: 30000,
      ...config,
    };
    this.connect();
  }

  private connect(): void {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.on('open', () => {
      this.isConnecting = false;
      this.reconnectDelay = 1000; // Reset backoff
      this.emit('connected');
      this.authenticate();
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(JSON.parse(data.toString()));
    });

    this.ws.on('close', (code, reason) => {
      this.isConnecting = false;
      this.isAuthenticated = false;
      this.stopHeartbeat();
      this.emit('disconnected', code, reason.toString());

      if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private authenticate(): void {
    this.send({
      type: 'auth',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: {
        accessToken: this.config.accessToken,
        daemonId: this.config.daemonId,
        orchestratorId: this.config.orchestratorId,
      },
    });
  }

  private handleMessage(message: any): void {
    this.emit('message', message);

    switch (message.type) {
      case 'auth_success':
        this.isAuthenticated = true;
        this.emit('authenticated', message.payload);
        this.startHeartbeat(message.payload.heartbeatIntervalMs);
        break;

      case 'auth_error':
        this.emit('auth_error', message.payload);
        this.ws?.close();
        break;

      case 'event':
        this.emit('event', message.payload);
        if (message.payload.requiresAck) {
          this.acknowledge([message.payload.eventId]);
        }
        break;

      case 'heartbeat_ack':
        this.emit('heartbeat_ack', message.payload);
        break;

      case 'error':
        this.emit('server_error', message.payload);
        break;

      case 'reconnect':
        this.emit('reconnect_requested', message.payload);
        setTimeout(() => {
          this.ws?.close();
        }, message.payload.delay);
        break;

      case 'rate_limit':
        this.emit('rate_limited', message.payload);
        break;
    }
  }

  private startHeartbeat(interval: number): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  public send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public sendHeartbeat(metrics?: any): void {
    this.send({
      type: 'heartbeat',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: {
        status: 'active',
        metrics,
      },
    });
  }

  public subscribe(eventTypes: string[], channelIds?: string[]): void {
    this.send({
      type: 'subscribe',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: {
        eventTypes,
        channelIds,
      },
    });
  }

  public unsubscribe(eventTypes: string[]): void {
    this.send({
      type: 'unsubscribe',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: {
        eventTypes,
      },
    });
  }

  public acknowledge(eventIds: string[]): void {
    this.send({
      type: 'ack',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: {
        eventIds,
      },
    });
  }

  public close(): void {
    this.config.autoReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close(1000, 'Client closing');
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }
}

// Usage Example
const client = new OrchestratorDaemonClient({
  wsUrl: 'ws://localhost:3000/daemon/ws',
  accessToken: 'your-jwt-token',
  daemonId: 'daemon_123',
  orchestratorId: 'vp_456',
});

client.on('authenticated', (payload) => {
  console.log('Authenticated with session:', payload.sessionId);

  // Subscribe to events
  client.subscribe([
    'message.received',
    'presence.updated',
    'vp.mentioned',
  ]);
});

client.on('event', (payload) => {
  console.log('Event received:', payload.eventType, payload.data);

  // Handle event
  switch (payload.eventType) {
    case 'message.received':
      console.log('New message:', payload.data.content);
      break;
    case 'vp.mentioned':
      console.log('You were mentioned!');
      break;
  }
});

client.on('error', (error) => {
  console.error('WebSocket error:', error);
});

client.on('disconnected', (code, reason) => {
  console.log(`Disconnected: ${code} - ${reason}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  client.close();
  process.exit(0);
});
```

## Publishing Events from Neolith Backend

### Message Handler Example

```typescript
// apps/web/app/api/messages/route.ts
import { prisma, redis } from '@neolith/core';
import type { DaemonEvent } from '@neolith/core';

export async function POST(request: Request) {
  const { channelId, content, authorId } = await request.json();

  // Create message in database
  const message = await prisma.message.create({
    data: {
      channelId,
      content,
      authorId,
    },
  });

  // Get channel members
  const members = await prisma.channelMember.findMany({
    where: { channelId },
    include: {
      user: {
        select: { isVP: true, id: true },
      },
    },
  });

  // Publish events to Orchestrator daemons
  for (const member of members) {
    if (member.user.isVP && member.userId !== authorId) {
      const event: DaemonEvent = {
        id: `event_${Date.now()}_${crypto.randomUUID()}`,
        type: 'message.received',
        daemonId: '', // Will be routed to all daemon instances for this VP
        orchestratorId: member.userId,
        payload: {
          messageId: message.id,
          channelId: message.channelId,
          content: message.content,
          authorId,
          timestamp: message.createdAt.toISOString(),
        },
        timestamp: new Date(),
        workspaceId: channelId,
        channelId,
        requiresAck: true,
        priority: 1,
      };

      // Publish to Redis for WebSocket distribution
      await redis.publish('daemon:events', JSON.stringify(event));
    }
  }

  return Response.json({ message });
}
```

## Docker Compose Setup

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: neolith
      POSTGRES_PASSWORD: password
      POSTGRES_DB: neolith
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  neolith-web:
    build: .
    environment:
      DATABASE_URL: postgresql://neolith:password@postgres:5432/neolith
      REDIS_URL: redis://redis:6379
      DAEMON_JWT_SECRET: ${DAEMON_JWT_SECRET}
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    command: npm start

volumes:
  postgres_data:
  redis_data:
```

## Monitoring and Observability

### Prometheus Metrics

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

const register = new Registry();

const wsConnections = new Gauge({
  name: 'ws_connections_total',
  help: 'Total WebSocket connections',
  labelNames: ['state'],
  registers: [register],
});

const wsEvents = new Counter({
  name: 'ws_events_total',
  help: 'Total events routed',
  labelNames: ['type', 'status'],
  registers: [register],
});

const wsLatency = new Histogram({
  name: 'ws_event_latency_seconds',
  help: 'Event delivery latency',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// Update metrics
wsServer.on('connection:authenticated', () => {
  wsConnections.inc({ state: 'authenticated' });
});

wsServer.on('connection:closed', () => {
  wsConnections.dec({ state: 'authenticated' });
});

wsServer.on('event:routed', (eventId) => {
  wsEvents.inc({ type: 'routed', status: 'success' });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Testing

```typescript
import { DaemonWebSocketServer } from '@wundr/orchestrator-daemon';
import { createServer } from 'http';
import WebSocket from 'ws';

describe('WebSocket Integration', () => {
  let httpServer;
  let wsServer;

  beforeAll(async () => {
    httpServer = createServer();
    wsServer = new DaemonWebSocketServer({
      server: httpServer,
      prisma: mockPrisma,
      redis: mockRedis,
      authService: mockAuthService,
    });

    await new Promise(resolve => {
      httpServer.listen(8080, resolve);
    });

    await wsServer.start();
  });

  afterAll(async () => {
    await wsServer.stop();
    await new Promise(resolve => {
      httpServer.close(resolve);
    });
  });

  test('should handle full connection lifecycle', (done) => {
    const ws = new WebSocket('ws://localhost:8080/daemon/ws');

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'auth',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        payload: {
          accessToken: 'test-token',
          daemonId: 'test-daemon',
          orchestratorId: 'test-vp',
        },
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === 'auth_success') {
        expect(message.payload.sessionId).toBeDefined();
        ws.close();
        done();
      }
    });
  });
});
```

## Production Checklist

- [ ] Use WSS (WebSocket Secure) with valid SSL certificates
- [ ] Configure Redis for high availability (Redis Sentinel/Cluster)
- [ ] Set up database connection pooling
- [ ] Enable Prometheus metrics and alerting
- [ ] Configure log aggregation (ELK, CloudWatch, etc.)
- [ ] Set up health checks and readiness probes
- [ ] Configure rate limiting per VP
- [ ] Implement IP allowlisting for daemon connections
- [ ] Set up monitoring for WebSocket connection count
- [ ] Configure alerts for high event queue depth
- [ ] Enable Redis persistence (AOF + RDB)
- [ ] Set up automated backups for PostgreSQL
- [ ] Configure graceful shutdown with connection draining
- [ ] Test disaster recovery procedures
- [ ] Document runbook for common issues
