/**
 * @genesis/core - Orchestrator Message Router
 *
 * Routes messages to orchestrator users through their active daemon instances.
 * Handles message delivery, queuing for offline orchestrators, and session management.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';
import type { PrismaClient } from '@neolith/database';
import type Redis from 'ioredis';
import { prisma } from '@neolith/database';

import { GenesisError } from '../errors';
import type {
  MessageWithRelations,
} from '../types/message';
import type {
  DaemonSession,
  DaemonSessionStatus,
  DaemonEventType,
} from '../types/daemon';
import type { PresenceServiceImpl } from './presence-service';
import {
  createRedisClient,
  isRedisAvailable,
} from '../redis/client';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Status of a routed message.
 */
export type MessageRoutingStatus =
  | 'pending'      // Message queued for delivery
  | 'routing'      // Actively being routed
  | 'delivered'    // Successfully delivered to orchestrator daemon
  | 'failed'       // Failed to deliver after retries
  | 'offline';     // Orchestrator offline, queued for later

/**
 * Message routing metadata.
 */
export interface MessageRoutingMetadata {
  /** Whether this message is directed to an orchestrator */
  isForOrchestrator: boolean;

  /** Target orchestrator ID if applicable */
  targetOrchestratorId?: string;

  /** Current routing status */
  routingStatus: MessageRoutingStatus;

  /** When the message was delivered */
  deliveredAt?: Date;

  /** Number of delivery attempts */
  deliveryAttempts: number;

  /** Last error if delivery failed */
  lastError?: string;

  /** Session ID the message was routed through */
  sessionId?: string;
}

/**
 * Configuration for message routing retry logic.
 */
export interface RoutingRetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;

  /** Initial retry delay in milliseconds */
  initialDelayMs: number;

  /** Backoff multiplier for retry delays */
  backoffMultiplier: number;

  /** Maximum retry delay in milliseconds */
  maxDelayMs: number;
}

/**
 * Configuration for offline message queuing.
 */
export interface OfflineQueueConfig {
  /** Maximum number of queued messages per orchestrator */
  maxQueueSize: number;

  /** How long to keep queued messages (seconds) */
  queueTtlSeconds: number;

  /** Whether to enable offline queuing */
  enabled: boolean;
}

/**
 * Orchestrator routing service configuration.
 */
export interface OrchestratorRouterConfig {
  /** Redis client for session management */
  redis?: Redis;

  /** Prisma client for database operations */
  prisma?: PrismaClient;

  /** Retry configuration */
  retry?: Partial<RoutingRetryConfig>;

  /** Offline queue configuration */
  offlineQueue?: Partial<OfflineQueueConfig>;

  /** Message delivery timeout in milliseconds */
  deliveryTimeoutMs?: number;
}

/**
 * Result of a message routing operation.
 */
export interface RouteMessageResult {
  /** Whether the message was successfully routed */
  success: boolean;

  /** Routing status */
  status: MessageRoutingStatus;

  /** Session ID if routed */
  sessionId?: string;

  /** Error message if failed */
  error?: string;

  /** Number of delivery attempts made */
  attempts: number;
}

/**
 * Information about an orchestrator's active session.
 */
export interface OrchestratorSessionInfo {
  /** Session ID */
  sessionId: string;

  /** Daemon instance ID */
  daemonId: string;

  /** Session status */
  status: DaemonSessionStatus;

  /** Last active timestamp */
  lastActiveAt: Date;

  /** Session creation timestamp */
  createdAt: Date;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY_CONFIG: RoutingRetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};

/**
 * Default offline queue configuration.
 */
const DEFAULT_OFFLINE_QUEUE_CONFIG: OfflineQueueConfig = {
  maxQueueSize: 100,
  queueTtlSeconds: 86400, // 24 hours
  enabled: true,
};

/**
 * Redis key patterns for routing.
 */
const ROUTING_KEYS = {
  /** Active session for orchestrator: routing:session:{orchestratorId} */
  session: (orchestratorId: string) => `routing:session:${orchestratorId}`,

  /** Message queue for offline orchestrator: routing:queue:{orchestratorId} */
  queue: (orchestratorId: string) => `routing:queue:${orchestratorId}`,

  /** Routing metadata: routing:metadata:{messageId} */
  metadata: (messageId: string) => `routing:metadata:${messageId}`,

  /** Delivery confirmation: routing:delivered:{messageId} */
  delivered: (messageId: string) => `routing:delivered:${messageId}`,
} as const;

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when orchestrator routing fails.
 */
export class OrchestratorRoutingError extends GenesisError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'ORCHESTRATOR_ROUTING_ERROR', 500, metadata);
    this.name = 'OrchestratorRoutingError';
  }
}

/**
 * Error thrown when orchestrator is offline.
 */
export class OrchestratorOfflineError extends GenesisError {
  constructor(orchestratorId: string) {
    super(
      `Orchestrator is offline: ${orchestratorId}`,
      'ORCHESTRATOR_OFFLINE',
      503,
      { orchestratorId },
    );
    this.name = 'OrchestratorOfflineError';
  }
}

/**
 * Error thrown when no active session is found.
 */
export class NoActiveSessionError extends GenesisError {
  constructor(orchestratorId: string) {
    super(
      `No active session found for orchestrator: ${orchestratorId}`,
      'NO_ACTIVE_SESSION',
      404,
      { orchestratorId },
    );
    this.name = 'NoActiveSessionError';
  }
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Orchestrator message routing service.
 *
 * Routes messages to orchestrator daemon instances, handles offline queuing,
 * and manages delivery confirmation.
 */
export class OrchestratorRouter {
  private readonly redis: Redis;
  private readonly db: PrismaClient;
  private readonly retryConfig: RoutingRetryConfig;
  private readonly offlineQueueConfig: OfflineQueueConfig;
  private readonly eventEmitter: EventEmitter;
  private presenceService?: PresenceServiceImpl;

  /**
   * Creates a new OrchestratorRouter instance.
   */
  constructor(config: OrchestratorRouterConfig = {}) {
    this.redis = config.redis ?? createRedisClient();
    this.db = config.prisma ?? prisma;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
    this.offlineQueueConfig = { ...DEFAULT_OFFLINE_QUEUE_CONFIG, ...config.offlineQueue };
    // Note: deliveryTimeoutMs stored in config but not currently used in implementation
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100);
  }

  /**
   * Sets the presence service dependency.
   * Used for checking orchestrator online status.
   */
  setPresenceService(presenceService: PresenceServiceImpl): void {
    this.presenceService = presenceService;
  }

  // ===========================================================================
  // Core Routing Methods
  // ===========================================================================

  /**
   * Routes a message to an orchestrator's active daemon session.
   *
   * @param message - The message to route
   * @param orchestratorId - The target orchestrator ID
   * @returns Routing result with status and session info
   */
  async routeMessage(
    message: MessageWithRelations,
    orchestratorId: string,
  ): Promise<RouteMessageResult> {
    let attempts = 0;
    let lastError: string | undefined;

    try {
      // Check if orchestrator is online
      const isOnline = await this.isOrchestratorOnline(orchestratorId);

      if (!isOnline) {
        // Queue for offline delivery if enabled
        if (this.offlineQueueConfig.enabled) {
          await this.queueMessageForOffline(message, orchestratorId);
          return {
            success: true,
            status: 'offline',
            attempts: 1,
          };
        } else {
          return {
            success: false,
            status: 'failed',
            error: 'Orchestrator is offline and queuing is disabled',
            attempts: 1,
          };
        }
      }

      // Get active session
      const session = await this.getOrchestratorSession(orchestratorId);

      if (!session) {
        throw new NoActiveSessionError(orchestratorId);
      }

      // Attempt delivery with retries
      while (attempts < this.retryConfig.maxAttempts) {
        attempts++;

        try {
          await this.deliverToSession(message, session);

          // Mark as delivered
          await this.markDelivered(message.id, session.sessionId);

          this.emitRoutingEvent('message.routed', {
            messageId: message.id,
            orchestratorId,
            sessionId: session.sessionId,
            attempts,
          });

          return {
            success: true,
            status: 'delivered',
            sessionId: session.sessionId,
            attempts,
          };
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';

          // Wait before retry
          if (attempts < this.retryConfig.maxAttempts) {
            const delay = this.calculateRetryDelay(attempts);
            await this.sleep(delay);
          }
        }
      }

      // All retries failed
      this.emitRoutingEvent('message.routing_failed', {
        messageId: message.id,
        orchestratorId,
        attempts,
        error: lastError,
      });

      return {
        success: false,
        status: 'failed',
        error: lastError,
        attempts,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      this.emitRoutingEvent('message.routing_error', {
        messageId: message.id,
        orchestratorId,
        error: errorMsg,
      });

      return {
        success: false,
        status: 'failed',
        error: errorMsg,
        attempts,
      };
    }
  }

  /**
   * Gets the active session for an orchestrator.
   *
   * @param orchestratorId - The orchestrator ID
   * @returns Session info or null if no active session
   */
  async getOrchestratorSession(orchestratorId: string): Promise<OrchestratorSessionInfo | null> {
    if (!isRedisAvailable()) {
      return null;
    }

    const key = ROUTING_KEYS.session(orchestratorId);

    try {
      const sessionData = await this.redis.get(key);

      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData) as OrchestratorSessionInfo;

      // Verify session is still active
      if (session.status !== 'active') {
        return null;
      }

      return session;
    } catch (error) {
      this.logError('Failed to get orchestrator session', error);
      return null;
    }
  }

  /**
   * Checks if an orchestrator is currently online.
   *
   * @param orchestratorId - The orchestrator ID
   * @returns True if orchestrator is online
   */
  async isOrchestratorOnline(orchestratorId: string): Promise<boolean> {
    if (!this.presenceService) {
      // Fallback: check Redis directly
      const session = await this.getOrchestratorSession(orchestratorId);
      return session !== null;
    }

    const presence = await this.presenceService.getVPPresence(orchestratorId);
    return presence?.status === 'ONLINE';
  }

  /**
   * Queues a message for delivery when orchestrator comes online.
   *
   * @param message - The message to queue
   * @param orchestratorId - The target orchestrator ID
   */
  async queueMessageForOffline(
    message: MessageWithRelations,
    orchestratorId: string,
  ): Promise<void> {
    if (!isRedisAvailable()) {
      throw new OrchestratorRoutingError('Redis not available for offline queuing');
    }

    const queueKey = ROUTING_KEYS.queue(orchestratorId);

    try {
      // Check queue size
      const queueSize = await this.redis.llen(queueKey);

      if (queueSize >= this.offlineQueueConfig.maxQueueSize) {
        // Remove oldest message to make room
        await this.redis.lpop(queueKey);
      }

      // Add message to queue
      const queuedMessage = {
        messageId: message.id,
        channelId: message.channelId,
        authorId: message.authorId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        queuedAt: new Date().toISOString(),
      };

      await this.redis.rpush(queueKey, JSON.stringify(queuedMessage));
      await this.redis.expire(queueKey, this.offlineQueueConfig.queueTtlSeconds);

      this.emitRoutingEvent('message.queued', {
        messageId: message.id,
        orchestratorId,
        queueSize: queueSize + 1,
      });
    } catch (error) {
      throw new OrchestratorRoutingError('Failed to queue message for offline delivery', {
        messageId: message.id,
        orchestratorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Registers an active daemon session for an orchestrator.
   *
   * @param orchestratorId - The orchestrator ID
   * @param session - Session information
   */
  async registerSession(
    orchestratorId: string,
    session: Pick<DaemonSession, 'id' | 'daemonId' | 'status' | 'createdAt'>,
  ): Promise<void> {
    if (!isRedisAvailable()) {
      return;
    }

    const key = ROUTING_KEYS.session(orchestratorId);
    const sessionInfo: OrchestratorSessionInfo = {
      sessionId: session.id,
      daemonId: session.daemonId,
      status: session.status,
      lastActiveAt: new Date(),
      createdAt: session.createdAt,
    };

    try {
      await this.redis.setex(
        key,
        3600, // 1 hour TTL
        JSON.stringify(sessionInfo),
      );

      this.emitRoutingEvent('session.registered', {
        orchestratorId,
        sessionId: session.id,
      });

      // Process any queued messages
      await this.processQueuedMessages(orchestratorId);
    } catch (error) {
      this.logError('Failed to register session', error);
    }
  }

  /**
   * Unregisters a daemon session when it disconnects.
   *
   * @param orchestratorId - The orchestrator ID
   */
  async unregisterSession(orchestratorId: string): Promise<void> {
    if (!isRedisAvailable()) {
      return;
    }

    const key = ROUTING_KEYS.session(orchestratorId);

    try {
      await this.redis.del(key);

      this.emitRoutingEvent('session.unregistered', {
        orchestratorId,
      });
    } catch (error) {
      this.logError('Failed to unregister session', error);
    }
  }

  /**
   * Updates session activity timestamp.
   *
   * @param orchestratorId - The orchestrator ID
   */
  async updateSessionActivity(orchestratorId: string): Promise<void> {
    if (!isRedisAvailable()) {
      return;
    }

    const key = ROUTING_KEYS.session(orchestratorId);

    try {
      const sessionData = await this.redis.get(key);

      if (sessionData) {
        const session = JSON.parse(sessionData) as OrchestratorSessionInfo;
        session.lastActiveAt = new Date();

        await this.redis.setex(key, 3600, JSON.stringify(session));
      }
    } catch (error) {
      this.logError('Failed to update session activity', error);
    }
  }

  // ===========================================================================
  // Queue Processing
  // ===========================================================================

  /**
   * Processes queued messages when orchestrator comes online.
   *
   * @param orchestratorId - The orchestrator ID
   */
  private async processQueuedMessages(orchestratorId: string): Promise<void> {
    if (!isRedisAvailable()) {
      return;
    }

    const queueKey = ROUTING_KEYS.queue(orchestratorId);

    try {
      const queueSize = await this.redis.llen(queueKey);

      if (queueSize === 0) {
        return;
      }

      this.emitRoutingEvent('queue.processing_started', {
        orchestratorId,
        queueSize,
      });

      let processed = 0;
      let failed = 0;

      // Process messages one by one
      while (true) {
        const messageData = await this.redis.lpop(queueKey);

        if (!messageData) {
          break;
        }

        try {
          const queuedMessage = JSON.parse(messageData);

          // Get full message from database
          const message = await this.db.message.findUnique({
            where: { id: queuedMessage.messageId },
            include: {
              author: true,
              reactions: true,
              parent: true,
            },
          });

          if (message) {
            const result = await this.routeMessage(
              message as MessageWithRelations,
              orchestratorId,
            );

            if (result.success) {
              processed++;
            } else {
              failed++;
            }
          }
        } catch (error) {
          failed++;
          this.logError('Failed to process queued message', error);
        }
      }

      this.emitRoutingEvent('queue.processing_completed', {
        orchestratorId,
        processed,
        failed,
      });
    } catch (error) {
      this.logError('Failed to process queued messages', error);
    }
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Delivers a message to a daemon session.
   */
  private async deliverToSession(
    message: MessageWithRelations,
    session: OrchestratorSessionInfo,
  ): Promise<void> {
    if (!isRedisAvailable()) {
      throw new OrchestratorRoutingError('Redis not available for message delivery');
    }

    // Publish event to daemon's event queue
    const eventQueueKey = `daemon:events:${session.daemonId}`;
    const event = {
      id: `evt_${Date.now()}_${crypto.randomUUID().split('-')[0]}`,
      type: 'message.received' as DaemonEventType,
      daemonId: session.daemonId,
      orchestratorId: message.channelId, // This would be the orchestrator ID from the channel context
      payload: {
        messageId: message.id,
        channelId: message.channelId,
        content: message.content,
        authorId: message.authorId,
        timestamp: message.createdAt.toISOString(),
      },
      timestamp: new Date(),
      requiresAck: true,
    };

    try {
      await this.redis.lpush(eventQueueKey, JSON.stringify(event));
      await this.redis.ltrim(eventQueueKey, 0, 999); // Keep last 1000 events
      await this.redis.expire(eventQueueKey, 86400); // 24 hours

      // Publish to real-time channel
      await this.redis.publish(`daemon:${session.daemonId}:events`, JSON.stringify(event));
    } catch (error) {
      throw new OrchestratorRoutingError('Failed to deliver message to session', {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Marks a message as delivered.
   */
  private async markDelivered(messageId: string, sessionId: string): Promise<void> {
    if (!isRedisAvailable()) {
      return;
    }

    const key = ROUTING_KEYS.delivered(messageId);
    const deliveryInfo = {
      sessionId,
      deliveredAt: new Date().toISOString(),
    };

    try {
      await this.redis.setex(key, 3600, JSON.stringify(deliveryInfo));
    } catch (error) {
      this.logError('Failed to mark message as delivered', error);
    }
  }

  /**
   * Calculates retry delay with exponential backoff.
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.retryConfig.initialDelayMs * Math.pow(
      this.retryConfig.backoffMultiplier,
      attempt - 1,
    );
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Sleep helper for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Emits a routing event.
   */
  private emitRoutingEvent(
    eventType: string,
    data: Record<string, unknown>,
  ): void {
    this.eventEmitter.emit(eventType, {
      type: eventType,
      timestamp: new Date(),
      ...data,
    });
  }

  /**
   * Error logging helper.
   */
  private logError(message: string, error: unknown): void {
    // eslint-disable-next-line no-console
    console.error(
      `[OrchestratorRouter] ${message}:`,
      error instanceof Error ? error.message : error,
    );
  }

  /**
   * Gets the event emitter for advanced use cases.
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Subscribes to routing events.
   */
  on(event: string, callback: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Removes all event listeners.
   */
  removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new orchestrator router instance.
 */
export function createOrchestratorRouter(
  config?: OrchestratorRouterConfig,
): OrchestratorRouter {
  return new OrchestratorRouter(config);
}

/**
 * Default orchestrator router instance.
 */
export const orchestratorRouter = createOrchestratorRouter();
