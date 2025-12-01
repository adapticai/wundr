# ADR-004: Event-Driven Communication Architecture

## Status

Accepted

## Context

The unified Wundr platform requires seamless communication between code analysis, environment setup,
and plugin systems. Traditional synchronous communication patterns would create tight coupling and
limit scalability. An event-driven architecture will enable loose coupling, better error handling,
and support for real-time features.

## Decision Drivers

- **Loose Coupling**: Components should be independent and replaceable
- **Scalability**: Support for high-throughput event processing
- **Real-time Features**: Live progress updates and notifications
- **Error Resilience**: System should continue operating despite component failures
- **Extensibility**: Easy addition of new event types and handlers
- **Debugging**: Clear event flow and debugging capabilities

## Considered Options

### Event System Architecture

1. **In-Process Event Bus with Redis Pub/Sub** (Selected)
2. Message Queue (RabbitMQ, Apache Kafka)
3. Event Streaming Platform (Apache Kafka, AWS Kinesis)
4. REST API with Webhooks

### Event Persistence Strategy

1. **Event Sourcing with Append-Only Log** (Selected)
2. Traditional Database Storage
3. In-Memory Only
4. Hybrid Approach

### Real-time Communication

1. **WebSockets with Socket.io** (Selected)
2. Server-Sent Events (SSE)
3. HTTP Long Polling
4. GraphQL Subscriptions Only

## Decision

### Core Event Architecture

#### 1. Hybrid Event System

The platform will implement a hybrid event system combining:

- **In-Process Event Bus**: For low-latency, high-frequency events within services
- **Redis Pub/Sub**: For inter-service communication and persistence
- **WebSocket Broadcasting**: For real-time client updates
- **Event Sourcing**: For audit trail and state reconstruction

#### 2. Event Categories

```typescript
enum EventCategory {
  DOMAIN = 'domain', // Business logic events
  SYSTEM = 'system', // System lifecycle events
  INTEGRATION = 'integration', // External system events
  UI = 'ui', // User interface events
  PLUGIN = 'plugin', // Plugin system events
}

enum EventPriority {
  CRITICAL = 0, // System critical events
  HIGH = 1, // Important business events
  NORMAL = 2, // Standard events
  LOW = 3, // Logging and metrics events
}
```

#### 3. Event Structure

```typescript
interface WundrEvent {
  id: string; // Unique event identifier
  type: string; // Event type (dot notation)
  category: EventCategory; // Event category
  priority: EventPriority; // Processing priority
  version: string; // Event schema version
  timestamp: Date; // Event creation time
  source: string; // Event source service/component
  correlationId?: string; // Request/session correlation
  causationId?: string; // Parent event ID
  aggregate: {
    // Domain aggregate info
    type: string;
    id: string;
    version: number;
  };
  data: Record<string, any>; // Event payload
  metadata: {
    // Event metadata
    userId?: string;
    traceId?: string;
    retryCount?: number;
    [key: string]: any;
  };
}
```

## Event System Implementation

### 1. Event Bus Core

```typescript
interface EventBus {
  // Event publishing
  publish(event: WundrEvent): Promise<void>;
  publishBatch(events: WundrEvent[]): Promise<void>;

  // Event subscription
  subscribe(pattern: string, handler: EventHandler): Subscription;
  unsubscribe(subscription: Subscription): void;

  // Event querying (for event sourcing)
  getEvents(aggregateId: string, fromVersion?: number): Promise<WundrEvent[]>;
  getEventsByCorrelation(correlationId: string): Promise<WundrEvent[]>;
}

interface EventHandler {
  handle(event: WundrEvent): Promise<void>;
  canHandle(event: WundrEvent): boolean;
  priority?: number;
}
```

### 2. Event Store

```typescript
class EventStore {
  async append(events: WundrEvent[]): Promise<void> {
    // Append events to PostgreSQL and Redis
    const transaction = await this.db.transaction();
    try {
      // Store in PostgreSQL for persistence
      await this.persistEvents(events, transaction);

      // Publish to Redis for real-time processing
      await this.publishToRedis(events);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getEvents(
    aggregateType: string,
    aggregateId: string,
    fromVersion?: number
  ): Promise<WundrEvent[]> {
    // Retrieve events for aggregate reconstruction
    return this.db.query(
      `
      SELECT * FROM events 
      WHERE aggregate_type = $1 AND aggregate_id = $2 
      AND aggregate_version >= $3
      ORDER BY aggregate_version ASC
    `,
      [aggregateType, aggregateId, fromVersion || 0]
    );
  }
}
```

### 3. Event Publishing Patterns

#### Fire-and-Forget Publishing

```typescript
class AnalysisService {
  async startAnalysis(projectId: string): Promise<void> {
    const analysis = await this.createAnalysis(projectId);

    // Publish domain event
    await this.eventBus.publish({
      type: 'analysis.started',
      category: EventCategory.DOMAIN,
      priority: EventPriority.HIGH,
      aggregate: { type: 'Analysis', id: analysis.id, version: 1 },
      data: { projectId, analysisId: analysis.id, type: analysis.type },
    });
  }
}
```

#### Event Choreography

```typescript
// Multiple services react to domain events
class NotificationService {
  @EventHandler('analysis.started')
  async onAnalysisStarted(event: WundrEvent): Promise<void> {
    const { projectId, analysisId } = event.data;
    await this.sendNotification(projectId, 'Analysis started', analysisId);
  }
}

class MetricsService {
  @EventHandler('analysis.*')
  async onAnalysisEvent(event: WundrEvent): Promise<void> {
    await this.recordMetric(event.type, event.timestamp);
  }
}

class WebSocketService {
  @EventHandler('analysis.*')
  async onAnalysisEvent(event: WundrEvent): Promise<void> {
    const { projectId } = event.data;
    await this.broadcast(`project.${projectId}`, event);
  }
}
```

## Real-time Communication

### WebSocket Event Broadcasting

```typescript
class WebSocketManager {
  private io: SocketIO.Server;
  private rooms = new Map<string, Set<string>>();

  constructor(eventBus: EventBus) {
    // Subscribe to all events for broadcasting
    eventBus.subscribe('*', this.broadcastEvent.bind(this));
  }

  async broadcastEvent(event: WundrEvent): Promise<void> {
    const { type, data } = event;

    // Determine target rooms based on event type
    const rooms = this.getTargetRooms(event);

    for (const room of rooms) {
      this.io.to(room).emit(type, {
        id: event.id,
        type: event.type,
        data: event.data,
        timestamp: event.timestamp,
      });
    }
  }

  private getTargetRooms(event: WundrEvent): string[] {
    const { type, data } = event;
    const rooms: string[] = [];

    // Global events
    if (type.startsWith('system.')) {
      rooms.push('system');
    }

    // Project-specific events
    if (data.projectId) {
      rooms.push(`project.${data.projectId}`);
    }

    // User-specific events
    if (data.userId || event.metadata.userId) {
      rooms.push(`user.${data.userId || event.metadata.userId}`);
    }

    return rooms;
  }
}
```

### Client-Side Event Handling

```typescript
// Frontend event subscription
class EventClient {
  private socket: SocketIO.Socket;
  private handlers = new Map<string, Set<EventHandler>>();

  connect(token: string): void {
    this.socket = io('/ws', {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      // Join relevant rooms
      this.socket.emit('join', ['system', `user.${this.userId}`]);
    });

    // Route events to handlers
    this.socket.onAny((event, data) => {
      this.handleEvent(event, data);
    });
  }

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  private handleEvent(eventType: string, data: any): void {
    // Handle specific event type
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }

    // Handle wildcard subscriptions
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handler({ type: eventType, ...data }));
    }
  }
}
```

## Event Processing Patterns

### 1. Event Sourcing Implementation

```typescript
abstract class AggregateRoot {
  private events: WundrEvent[] = [];
  private version = 0;

  protected applyEvent(event: WundrEvent): void {
    this.events.push(event);
    this.version++;
    this.when(event);
  }

  protected abstract when(event: WundrEvent): void;

  getUncommittedEvents(): WundrEvent[] {
    return [...this.events];
  }

  markEventsAsCommitted(): void {
    this.events = [];
  }

  static fromHistory<T extends AggregateRoot>(events: WundrEvent[], constructor: new () => T): T {
    const aggregate = new constructor();
    events.forEach(event => aggregate.when(event));
    return aggregate;
  }
}

// Example aggregate
class Analysis extends AggregateRoot {
  public id!: string;
  public status!: AnalysisStatus;
  public results?: AnalysisResults;

  start(projectId: string, type: AnalysisType): void {
    this.applyEvent({
      type: 'analysis.started',
      category: EventCategory.DOMAIN,
      priority: EventPriority.HIGH,
      aggregate: { type: 'Analysis', id: this.id, version: this.version + 1 },
      data: { projectId, type },
    });
  }

  complete(results: AnalysisResults): void {
    this.applyEvent({
      type: 'analysis.completed',
      category: EventCategory.DOMAIN,
      priority: EventPriority.HIGH,
      aggregate: { type: 'Analysis', id: this.id, version: this.version + 1 },
      data: { results },
    });
  }

  protected when(event: WundrEvent): void {
    switch (event.type) {
      case 'analysis.started':
        this.id = event.aggregate.id;
        this.status = AnalysisStatus.RUNNING;
        break;
      case 'analysis.completed':
        this.status = AnalysisStatus.COMPLETED;
        this.results = event.data.results;
        break;
    }
    this.version = event.aggregate.version;
  }
}
```

### 2. Saga Pattern for Complex Workflows

```typescript
class SetupWorkflowSaga {
  @EventHandler('setup.session.started')
  async onSetupStarted(event: WundrEvent): Promise<void> {
    const { sessionId, profileId } = event.data;

    // Start validation step
    await this.eventBus.publish({
      type: 'setup.step.validate.start',
      data: { sessionId, profileId },
    });
  }

  @EventHandler('setup.step.validate.completed')
  async onValidationCompleted(event: WundrEvent): Promise<void> {
    const { sessionId, success } = event.data;

    if (success) {
      // Proceed to installation
      await this.eventBus.publish({
        type: 'setup.step.install.start',
        data: { sessionId },
      });
    } else {
      // Fail the workflow
      await this.eventBus.publish({
        type: 'setup.session.failed',
        data: { sessionId, reason: 'Validation failed' },
      });
    }
  }
}
```

### 3. Event Replay and Testing

```typescript
class EventReplayService {
  async replayEvents(
    aggregateType: string,
    aggregateId: string,
    targetVersion?: number
  ): Promise<AggregateRoot> {
    const events = await this.eventStore.getEvents(aggregateType, aggregateId, 0, targetVersion);

    return AggregateRoot.fromHistory(events, this.getAggregateConstructor(aggregateType));
  }

  async replayProjection(projectionName: string, fromTimestamp?: Date): Promise<void> {
    const events = await this.eventStore.getEventsByTimestamp(fromTimestamp);
    const projection = this.projections.get(projectionName);

    for (const event of events) {
      await projection.handle(event);
    }
  }
}

// Testing with event replay
describe('Analysis Workflow', () => {
  it('should complete analysis successfully', async () => {
    const events = [
      createEvent('analysis.started', { projectId: '123' }),
      createEvent('analysis.file.processed', { fileName: 'test.js' }),
      createEvent('analysis.completed', { results: mockResults }),
    ];

    const analysis = Analysis.fromHistory(events, Analysis);
    expect(analysis.status).toBe(AnalysisStatus.COMPLETED);
  });
});
```

## Error Handling and Resilience

### 1. Dead Letter Queue

```typescript
class DeadLetterHandler {
  async handleFailedEvent(event: WundrEvent, error: Error): Promise<void> {
    const deadLetterEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        retryCount: (event.metadata.retryCount || 0) + 1,
        lastError: error.message,
        deadLetteredAt: new Date(),
      },
    };

    // Store in dead letter queue
    await this.deadLetterQueue.enqueue(deadLetterEvent);

    // Alert if retry limit exceeded
    if (deadLetterEvent.metadata.retryCount > 3) {
      await this.alertingService.alert('Event processing failed permanently', {
        eventId: event.id,
        eventType: event.type,
        error: error.message,
      });
    }
  }
}
```

### 2. Circuit Breaker Pattern

```typescript
class EventHandlerCircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;

  async execute(handler: EventHandler, event: WundrEvent): Promise<void> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      await handler.handle(event);
      this.onSuccess();
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }
}
```

## Performance Optimizations

### 1. Event Batching

```typescript
class EventBatcher {
  private batch: WundrEvent[] = [];
  private batchTimer?: NodeJS.Timeout;

  publish(event: WundrEvent): void {
    this.batch.push(event);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), this.batchInterval);
    }
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const events = [...this.batch];
    this.batch = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    await this.eventStore.appendBatch(events);
  }
}
```

### 2. Event Compression

```typescript
class EventCompressor {
  compress(events: WundrEvent[]): WundrEvent[] {
    const compressed: WundrEvent[] = [];
    const stateMap = new Map<string, any>();

    for (const event of events) {
      const key = `${event.aggregate.type}:${event.aggregate.id}`;

      if (this.isCompressible(event)) {
        stateMap.set(key, this.mergeState(stateMap.get(key), event.data));
      } else {
        // Emit accumulated state if any
        if (stateMap.has(key)) {
          compressed.push(this.createCompressedEvent(key, stateMap.get(key)));
          stateMap.delete(key);
        }
        compressed.push(event);
      }
    }

    // Emit remaining accumulated states
    for (const [key, state] of stateMap.entries()) {
      compressed.push(this.createCompressedEvent(key, state));
    }

    return compressed;
  }
}
```

## Monitoring and Observability

### Event Metrics

```typescript
interface EventMetrics {
  totalEvents: number;
  eventsByType: Map<string, number>;
  avgProcessingTime: number;
  failureRate: number;
  deadLetterQueueSize: number;
  circuitBreakerState: Map<string, CircuitState>;
}

class EventMetricsCollector {
  @EventHandler('*')
  async recordEvent(event: WundrEvent): Promise<void> {
    await this.metricsStore.increment(`events.${event.type}.count`);
    await this.metricsStore.histogram(
      `events.${event.type}.processing_time`,
      Date.now() - event.timestamp.getTime()
    );
  }
}
```

This event-driven architecture provides the foundation for a scalable, resilient, and maintainable
system that supports real-time features and loose coupling between components.
