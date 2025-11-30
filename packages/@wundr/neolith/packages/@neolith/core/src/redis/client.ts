/**
 * @genesis/core - Redis Client Factory
 *
 * Factory functions and singleton management for Redis connections
 * using ioredis with graceful degradation support.
 *
 * @packageDocumentation
 */

import Redis from 'ioredis';

import type { RedisOptions } from 'ioredis';

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Redis connection configuration.
 */
export interface RedisConfig {
  /** Redis host (default: localhost) */
  host?: string;

  /** Redis port (default: 6379) */
  port?: number;

  /** Redis password */
  password?: string;

  /** Redis database index (default: 0) */
  db?: number;

  /** Key prefix for all operations */
  keyPrefix?: string;

  /** Connection timeout in milliseconds (default: 10000) */
  connectTimeout?: number;

  /** Enable auto-reconnect (default: true) */
  lazyConnect?: boolean;

  /** Maximum reconnection attempts (default: 10) */
  maxRetriesPerRequest?: number;

  /** TLS options for secure connections */
  tls?: {
    rejectUnauthorized?: boolean;
  };

  /** Redis connection URL (overrides host/port) */
  url?: string;

  /** Enable offline queue (default: true) */
  enableOfflineQueue?: boolean;

  /** Retry strategy for reconnection */
  retryStrategy?: (times: number) => number | void | null;
}

/**
 * Default Redis configuration.
 */
export const DEFAULT_REDIS_CONFIG: Required<Omit<RedisConfig, 'password' | 'tls' | 'url' | 'retryStrategy'>> = {
  host: 'localhost',
  port: 6379,
  db: 0,
  keyPrefix: '',
  connectTimeout: 10000,
  lazyConnect: true, // Lazy connect to avoid errors during SSG/build
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
};

// =============================================================================
// Redis Client State
// =============================================================================

/**
 * Connection state for monitoring.
 */
export type RedisConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Redis client wrapper with connection state tracking.
 */
export interface RedisClientWrapper {
  /** The underlying ioredis client */
  client: Redis;

  /** Current connection state */
  state: RedisConnectionState;

  /** Whether the client is available for operations */
  isAvailable: boolean;

  /** Disconnect the client */
  disconnect: () => Promise<void>;

  /** Reconnect the client */
  reconnect: () => Promise<void>;
}

// =============================================================================
// Module-level State
// =============================================================================

let singletonClient: Redis | null = null;
let subscriberClient: Redis | null = null;
let connectionState: RedisConnectionState = 'disconnected';
let isInitialized = false;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new Redis client instance.
 *
 * @param config - Redis configuration options
 * @returns Configured Redis client
 *
 * @example
 * ```typescript
 * const redis = createRedisClient({
 *   host: 'localhost',
 *   port: 6379,
 *   password: 'secret',
 * });
 *
 * await redis.set('key', 'value');
 * ```
 */
export function createRedisClient(config?: RedisConfig): Redis {
  const options = buildRedisOptions(config);
  const client = config?.url ? new Redis(config.url, options) : new Redis(options);

  setupClientEventHandlers(client);

  return client;
}

/**
 * Creates a Redis client specifically for pub/sub subscriptions.
 * This client should not be used for regular commands while subscribed.
 *
 * @param config - Redis configuration options
 * @returns Configured Redis client for subscriptions
 */
export function createSubscriberClient(config?: RedisConfig): Redis {
  const options = buildRedisOptions(config);
  const client = config?.url ? new Redis(config.url, options) : new Redis(options);

  setupClientEventHandlers(client, 'subscriber');

  return client;
}

/**
 * Gets or creates the singleton Redis client.
 * This client is shared across the application for regular operations.
 *
 * @param config - Redis configuration (only used on first call)
 * @returns Singleton Redis client
 *
 * @example
 * ```typescript
 * import { redis } from '@genesis/core/redis';
 *
 * // Use the singleton
 * await redis.set('foo', 'bar');
 * const value = await redis.get('foo');
 * ```
 */
export function getRedisClient(config?: RedisConfig): Redis {
  if (!singletonClient || !isInitialized) {
    singletonClient = createRedisClient(config);
    isInitialized = true;
  }
  return singletonClient;
}

/**
 * Gets or creates a singleton subscriber client.
 * Use this for pub/sub operations.
 *
 * @param config - Redis configuration (only used on first call)
 * @returns Singleton subscriber client
 */
export function getSubscriberClient(config?: RedisConfig): Redis {
  if (!subscriberClient) {
    subscriberClient = createSubscriberClient(config);
  }
  return subscriberClient;
}

/**
 * Singleton Redis client for general use.
 * Lazily initialized on first access.
 */
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedisClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// =============================================================================
// Connection Management
// =============================================================================

/**
 * Gets the current connection state.
 */
export function getConnectionState(): RedisConnectionState {
  return connectionState;
}

/**
 * Checks if Redis is currently available.
 */
export function isRedisAvailable(): boolean {
  return connectionState === 'connected';
}

/**
 * Waits for Redis connection to be ready.
 *
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @returns Promise that resolves when connected or rejects on timeout
 */
export async function waitForConnection(timeoutMs: number = 10000): Promise<void> {
  if (connectionState === 'connected') {
    return;
  }

  const client = getRedisClient();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Redis connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const onReady = () => {
      clearTimeout(timeout);
      client.off('ready', onReady);
      client.off('error', onError);
      resolve();
    };

    const onError = (err: Error) => {
      clearTimeout(timeout);
      client.off('ready', onReady);
      client.off('error', onError);
      reject(err);
    };

    client.once('ready', onReady);
    client.once('error', onError);
  });
}

/**
 * Disconnects all Redis clients and cleans up resources.
 */
export async function disconnectRedis(): Promise<void> {
  const disconnectPromises: Promise<void>[] = [];

  if (singletonClient) {
    disconnectPromises.push(
      singletonClient.quit().then(() => {
        singletonClient = null;
      }),
    );
  }

  if (subscriberClient) {
    disconnectPromises.push(
      subscriberClient.quit().then(() => {
        subscriberClient = null;
      }),
    );
  }

  await Promise.all(disconnectPromises);
  connectionState = 'disconnected';
  isInitialized = false;
}

/**
 * Performs a health check on the Redis connection.
 *
 * @returns Health check result
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  try {
    const client = getRedisClient();
    const start = Date.now();
    const result = await client.ping();
    const latencyMs = Date.now() - start;

    if (result === 'PONG') {
      return { healthy: true, latencyMs };
    }

    return { healthy: false, error: `Unexpected ping response: ${result}` };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Builds Redis options from configuration.
 */
function buildRedisOptions(config?: RedisConfig): RedisOptions {
  const merged = { ...DEFAULT_REDIS_CONFIG, ...config };

  const options: RedisOptions = {
    host: merged.host,
    port: merged.port,
    db: merged.db,
    keyPrefix: merged.keyPrefix || undefined,
    connectTimeout: merged.connectTimeout,
    lazyConnect: merged.lazyConnect,
    maxRetriesPerRequest: merged.maxRetriesPerRequest,
    enableOfflineQueue: merged.enableOfflineQueue,
  };

  if (config?.password) {
    options.password = config.password;
  }

  if (config?.tls) {
    options.tls = config.tls;
  }

  // Default retry strategy with exponential backoff
  options.retryStrategy = config?.retryStrategy ?? ((times: number) => {
    if (times > 10) {
      // Stop retrying after 10 attempts
      return null;
    }
    // Exponential backoff: 50ms, 100ms, 200ms, ... up to 30 seconds
    return Math.min(times * 50, 30000);
  });

  return options;
}

/**
 * Sets up event handlers for connection state tracking.
 */
function setupClientEventHandlers(client: Redis, label: string = 'main'): void {
  client.on('connect', () => {
    connectionState = 'connecting';
    logDebug(`Redis ${label} client connecting...`);
  });

  client.on('ready', () => {
    connectionState = 'connected';
    logDebug(`Redis ${label} client ready`);
  });

  client.on('error', (err) => {
    connectionState = 'error';
    logError(`Redis ${label} client error:`, err);
  });

  client.on('close', () => {
    connectionState = 'disconnected';
    logDebug(`Redis ${label} client disconnected`);
  });

  client.on('reconnecting', () => {
    connectionState = 'connecting';
    logDebug(`Redis ${label} client reconnecting...`);
  });
}

/**
 * Debug logging helper.
 */
function logDebug(message: string): void {
  if (process.env.DEBUG?.includes('redis') || process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug(`[Redis] ${message}`);
  }
}

/**
 * Error logging helper.
 * Suppresses logs during build/SSG to avoid noisy output.
 */
function logError(message: string, error: Error): void {
  // Skip logging during Next.js build phase (SSG/SSR)
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(`[Redis] ${message}`, error.message);
}
