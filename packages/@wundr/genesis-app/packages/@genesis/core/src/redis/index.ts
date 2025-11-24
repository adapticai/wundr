/**
 * @genesis/core - Redis Module
 *
 * Central export for Redis client factory and utilities.
 *
 * @packageDocumentation
 */

export {
  // Factory functions
  createRedisClient,
  createSubscriberClient,
  getRedisClient,
  getSubscriberClient,

  // Singleton
  redis,

  // Connection management
  getConnectionState,
  isRedisAvailable,
  waitForConnection,
  disconnectRedis,
  healthCheck,

  // Types
  type RedisConfig,
  type RedisConnectionState,
  type RedisClientWrapper,

  // Constants
  DEFAULT_REDIS_CONFIG,
} from './client';
