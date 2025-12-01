/**
 * Mock Redis Client for Testing
 *
 * Provides a fully functional in-memory Redis mock implementation
 * for testing presence and heartbeat services without a real Redis connection.
 *
 * Implements:
 * - Key-value operations: get, set, del, mget, mset
 * - Hash operations: hget, hset, hdel, hgetall, hmset
 * - Set operations: sadd, srem, smembers, sismember, scard
 * - Sorted set operations: zadd, zrem, zrange, zrangebyscore
 * - Pub/Sub: publish, subscribe, unsubscribe, psubscribe
 * - TTL operations: expire, ttl, expireat, pexpire
 * - Utility: exists, keys, scan, flushall
 *
 * @module @genesis/core/test-utils/mock-redis
 */

import { vi } from 'vitest';

// =============================================================================
// TYPES
// =============================================================================

export type RedisValue = string | null;
export type RedisHashValue = Record<string, string>;

export interface MockRedisStore {
  strings: Map<string, string>;
  hashes: Map<string, Map<string, string>>;
  sets: Map<string, Set<string>>;
  sortedSets: Map<string, Map<string, number>>;
  ttls: Map<string, number>;
}

export interface SubscriptionCallback {
  (channel: string, message: string): void;
}

export interface PatternSubscriptionCallback {
  (pattern: string, channel: string, message: string): void;
}

export interface MockRedis {
  // Store access for assertions
  _store: MockRedisStore;
  _subscriptions: Map<string, Set<SubscriptionCallback>>;
  _patternSubscriptions: Map<string, Set<PatternSubscriptionCallback>>;
  _publishedMessages: Array<{ channel: string; message: string }>;

  // String operations
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  mget: ReturnType<typeof vi.fn>;
  mset: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  decr: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  setnx: ReturnType<typeof vi.fn>;

  // Hash operations
  hget: ReturnType<typeof vi.fn>;
  hset: ReturnType<typeof vi.fn>;
  hdel: ReturnType<typeof vi.fn>;
  hgetall: ReturnType<typeof vi.fn>;
  hmset: ReturnType<typeof vi.fn>;
  hmget: ReturnType<typeof vi.fn>;
  hincrby: ReturnType<typeof vi.fn>;
  hexists: ReturnType<typeof vi.fn>;
  hkeys: ReturnType<typeof vi.fn>;
  hvals: ReturnType<typeof vi.fn>;
  hlen: ReturnType<typeof vi.fn>;

  // Set operations
  sadd: ReturnType<typeof vi.fn>;
  srem: ReturnType<typeof vi.fn>;
  smembers: ReturnType<typeof vi.fn>;
  sismember: ReturnType<typeof vi.fn>;
  scard: ReturnType<typeof vi.fn>;
  sdiff: ReturnType<typeof vi.fn>;
  sinter: ReturnType<typeof vi.fn>;
  sunion: ReturnType<typeof vi.fn>;

  // Sorted set operations
  zadd: ReturnType<typeof vi.fn>;
  zrem: ReturnType<typeof vi.fn>;
  zrange: ReturnType<typeof vi.fn>;
  zrangebyscore: ReturnType<typeof vi.fn>;
  zrevrange: ReturnType<typeof vi.fn>;
  zscore: ReturnType<typeof vi.fn>;
  zcard: ReturnType<typeof vi.fn>;
  zrank: ReturnType<typeof vi.fn>;

  // Pub/Sub operations
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  psubscribe: ReturnType<typeof vi.fn>;
  punsubscribe: ReturnType<typeof vi.fn>;

  // TTL operations
  expire: ReturnType<typeof vi.fn>;
  expireat: ReturnType<typeof vi.fn>;
  pexpire: ReturnType<typeof vi.fn>;
  ttl: ReturnType<typeof vi.fn>;
  pttl: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;

  // Utility operations
  exists: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
  scan: ReturnType<typeof vi.fn>;
  type: ReturnType<typeof vi.fn>;
  flushall: ReturnType<typeof vi.fn>;
  flushdb: ReturnType<typeof vi.fn>;

  // Connection operations
  ping: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;

  // Pipeline/Multi operations
  multi: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  pipeline: ReturnType<typeof vi.fn>;

  // Helper methods for testing
  _reset: () => void;
  _setExpiry: (key: string, seconds: number) => void;
  _getExpiry: (key: string) => number | null;
  _simulateExpiry: (key: string) => void;
  _triggerSubscription: (channel: string, message: string) => void;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Creates a mock Redis client for testing
 *
 * @example
 * ```typescript
 * const redis = createMockRedis();
 *
 * // Use in service tests
 * const presenceService = new PresenceService(redis);
 *
 * // Verify operations
 * await redis.set('key', 'value');
 * expect(redis.set).toHaveBeenCalledWith('key', 'value');
 *
 * // Access internal store for assertions
 * expect(redis._store.strings.get('key')).toBe('value');
 * ```
 */
export function createMockRedis(): MockRedis {
  // Internal storage
  const store: MockRedisStore = {
    strings: new Map(),
    hashes: new Map(),
    sets: new Map(),
    sortedSets: new Map(),
    ttls: new Map(),
  };

  const subscriptions = new Map<string, Set<SubscriptionCallback>>();
  const patternSubscriptions = new Map<
    string,
    Set<PatternSubscriptionCallback>
  >();
  const publishedMessages: Array<{ channel: string; message: string }> = [];

  // Helper to check if key is expired
  const isExpired = (key: string): boolean => {
    const expiry = store.ttls.get(key);
    if (expiry === undefined) {
      return false;
    }
    return Date.now() >= expiry;
  };

  // Helper to clean expired keys
  const cleanExpired = (key: string): void => {
    if (isExpired(key)) {
      store.strings.delete(key);
      store.hashes.delete(key);
      store.sets.delete(key);
      store.sortedSets.delete(key);
      store.ttls.delete(key);
    }
  };

  const redis: MockRedis = {
    // Expose internal store for assertions
    _store: store,
    _subscriptions: subscriptions,
    _patternSubscriptions: patternSubscriptions,
    _publishedMessages: publishedMessages,

    // ==========================================================================
    // STRING OPERATIONS
    // ==========================================================================

    get: vi.fn(async (key: string): Promise<RedisValue> => {
      cleanExpired(key);
      return store.strings.get(key) ?? null;
    }),

    set: vi.fn(
      async (
        key: string,
        value: string,
        options?: { EX?: number; PX?: number; NX?: boolean; XX?: boolean }
      ): Promise<'OK' | null> => {
        if (options?.NX && store.strings.has(key)) {
          return null;
        }
        if (options?.XX && !store.strings.has(key)) {
          return null;
        }

        store.strings.set(key, value);

        if (options?.EX) {
          store.ttls.set(key, Date.now() + options.EX * 1000);
        }
        if (options?.PX) {
          store.ttls.set(key, Date.now() + options.PX);
        }

        return 'OK';
      }
    ),

    del: vi.fn(async (...keys: string[]): Promise<number> => {
      let count = 0;
      for (const key of keys) {
        if (
          store.strings.delete(key) ||
          store.hashes.delete(key) ||
          store.sets.delete(key) ||
          store.sortedSets.delete(key)
        ) {
          count++;
        }
        store.ttls.delete(key);
      }
      return count;
    }),

    mget: vi.fn(async (...keys: string[]): Promise<RedisValue[]> => {
      return keys.map(key => {
        cleanExpired(key);
        return store.strings.get(key) ?? null;
      });
    }),

    mset: vi.fn(async (keyValues: Record<string, string>): Promise<'OK'> => {
      for (const [key, value] of Object.entries(keyValues)) {
        store.strings.set(key, value);
      }
      return 'OK';
    }),

    incr: vi.fn(async (key: string): Promise<number> => {
      cleanExpired(key);
      const current = parseInt(store.strings.get(key) ?? '0', 10);
      const newValue = current + 1;
      store.strings.set(key, String(newValue));
      return newValue;
    }),

    decr: vi.fn(async (key: string): Promise<number> => {
      cleanExpired(key);
      const current = parseInt(store.strings.get(key) ?? '0', 10);
      const newValue = current - 1;
      store.strings.set(key, String(newValue));
      return newValue;
    }),

    setex: vi.fn(
      async (key: string, seconds: number, value: string): Promise<'OK'> => {
        store.strings.set(key, value);
        store.ttls.set(key, Date.now() + seconds * 1000);
        return 'OK';
      }
    ),

    setnx: vi.fn(async (key: string, value: string): Promise<number> => {
      if (store.strings.has(key)) {
        return 0;
      }
      store.strings.set(key, value);
      return 1;
    }),

    // ==========================================================================
    // HASH OPERATIONS
    // ==========================================================================

    hget: vi.fn(async (key: string, field: string): Promise<RedisValue> => {
      cleanExpired(key);
      const hash = store.hashes.get(key);
      return hash?.get(field) ?? null;
    }),

    hset: vi.fn(
      async (key: string, field: string, value: string): Promise<number> => {
        cleanExpired(key);
        let hash = store.hashes.get(key);
        if (!hash) {
          hash = new Map();
          store.hashes.set(key, hash);
        }
        const isNew = !hash.has(field);
        hash.set(field, value);
        return isNew ? 1 : 0;
      }
    ),

    hdel: vi.fn(async (key: string, ...fields: string[]): Promise<number> => {
      cleanExpired(key);
      const hash = store.hashes.get(key);
      if (!hash) {
        return 0;
      }
      let count = 0;
      for (const field of fields) {
        if (hash.delete(field)) {
          count++;
        }
      }
      return count;
    }),

    hgetall: vi.fn(
      async (key: string): Promise<Record<string, string> | null> => {
        cleanExpired(key);
        const hash = store.hashes.get(key);
        if (!hash || hash.size === 0) {
          return null;
        }
        return Object.fromEntries(hash);
      }
    ),

    hmset: vi.fn(
      async (key: string, data: Record<string, string>): Promise<'OK'> => {
        cleanExpired(key);
        let hash = store.hashes.get(key);
        if (!hash) {
          hash = new Map();
          store.hashes.set(key, hash);
        }
        for (const [field, value] of Object.entries(data)) {
          hash.set(field, value);
        }
        return 'OK';
      }
    ),

    hmget: vi.fn(
      async (key: string, ...fields: string[]): Promise<RedisValue[]> => {
        cleanExpired(key);
        const hash = store.hashes.get(key);
        return fields.map(field => hash?.get(field) ?? null);
      }
    ),

    hincrby: vi.fn(
      async (
        key: string,
        field: string,
        increment: number
      ): Promise<number> => {
        cleanExpired(key);
        let hash = store.hashes.get(key);
        if (!hash) {
          hash = new Map();
          store.hashes.set(key, hash);
        }
        const current = parseInt(hash.get(field) ?? '0', 10);
        const newValue = current + increment;
        hash.set(field, String(newValue));
        return newValue;
      }
    ),

    hexists: vi.fn(async (key: string, field: string): Promise<number> => {
      cleanExpired(key);
      const hash = store.hashes.get(key);
      return hash?.has(field) ? 1 : 0;
    }),

    hkeys: vi.fn(async (key: string): Promise<string[]> => {
      cleanExpired(key);
      const hash = store.hashes.get(key);
      return hash ? Array.from(hash.keys()) : [];
    }),

    hvals: vi.fn(async (key: string): Promise<string[]> => {
      cleanExpired(key);
      const hash = store.hashes.get(key);
      return hash ? Array.from(hash.values()) : [];
    }),

    hlen: vi.fn(async (key: string): Promise<number> => {
      cleanExpired(key);
      const hash = store.hashes.get(key);
      return hash?.size ?? 0;
    }),

    // ==========================================================================
    // SET OPERATIONS
    // ==========================================================================

    sadd: vi.fn(async (key: string, ...members: string[]): Promise<number> => {
      cleanExpired(key);
      let set = store.sets.get(key);
      if (!set) {
        set = new Set();
        store.sets.set(key, set);
      }
      let added = 0;
      for (const member of members) {
        if (!set.has(member)) {
          set.add(member);
          added++;
        }
      }
      return added;
    }),

    srem: vi.fn(async (key: string, ...members: string[]): Promise<number> => {
      cleanExpired(key);
      const set = store.sets.get(key);
      if (!set) {
        return 0;
      }
      let removed = 0;
      for (const member of members) {
        if (set.delete(member)) {
          removed++;
        }
      }
      return removed;
    }),

    smembers: vi.fn(async (key: string): Promise<string[]> => {
      cleanExpired(key);
      const set = store.sets.get(key);
      return set ? Array.from(set) : [];
    }),

    sismember: vi.fn(async (key: string, member: string): Promise<number> => {
      cleanExpired(key);
      const set = store.sets.get(key);
      return set?.has(member) ? 1 : 0;
    }),

    scard: vi.fn(async (key: string): Promise<number> => {
      cleanExpired(key);
      const set = store.sets.get(key);
      return set?.size ?? 0;
    }),

    sdiff: vi.fn(async (...keys: string[]): Promise<string[]> => {
      if (keys.length === 0) {
        return [];
      }
      const firstSet = store.sets.get(keys[0]) ?? new Set();
      const result = new Set(firstSet);

      for (let i = 1; i < keys.length; i++) {
        const otherSet = store.sets.get(keys[i]) ?? new Set();
        for (const member of otherSet) {
          result.delete(member);
        }
      }

      return Array.from(result);
    }),

    sinter: vi.fn(async (...keys: string[]): Promise<string[]> => {
      if (keys.length === 0) {
        return [];
      }
      const firstSet = store.sets.get(keys[0]) ?? new Set();
      const result = new Set(firstSet);

      for (let i = 1; i < keys.length; i++) {
        const otherSet = store.sets.get(keys[i]) ?? new Set();
        for (const member of result) {
          if (!otherSet.has(member)) {
            result.delete(member);
          }
        }
      }

      return Array.from(result);
    }),

    sunion: vi.fn(async (...keys: string[]): Promise<string[]> => {
      const result = new Set<string>();
      for (const key of keys) {
        const set = store.sets.get(key);
        if (set) {
          for (const member of set) {
            result.add(member);
          }
        }
      }
      return Array.from(result);
    }),

    // ==========================================================================
    // SORTED SET OPERATIONS
    // ==========================================================================

    zadd: vi.fn(
      async (
        key: string,
        ...scoreMembers: Array<number | string>
      ): Promise<number> => {
        cleanExpired(key);
        let sortedSet = store.sortedSets.get(key);
        if (!sortedSet) {
          sortedSet = new Map();
          store.sortedSets.set(key, sortedSet);
        }

        let added = 0;
        for (let i = 0; i < scoreMembers.length; i += 2) {
          const score = scoreMembers[i] as number;
          const member = scoreMembers[i + 1] as string;
          if (!sortedSet.has(member)) {
            added++;
          }
          sortedSet.set(member, score);
        }

        return added;
      }
    ),

    zrem: vi.fn(async (key: string, ...members: string[]): Promise<number> => {
      cleanExpired(key);
      const sortedSet = store.sortedSets.get(key);
      if (!sortedSet) {
        return 0;
      }
      let removed = 0;
      for (const member of members) {
        if (sortedSet.delete(member)) {
          removed++;
        }
      }
      return removed;
    }),

    zrange: vi.fn(
      async (key: string, start: number, stop: number): Promise<string[]> => {
        cleanExpired(key);
        const sortedSet = store.sortedSets.get(key);
        if (!sortedSet) {
          return [];
        }

        const sorted = Array.from(sortedSet.entries()).sort(
          (a, b) => a[1] - b[1]
        );
        const actualStop = stop < 0 ? sorted.length + stop + 1 : stop + 1;
        return sorted.slice(start, actualStop).map(([member]) => member);
      }
    ),

    zrangebyscore: vi.fn(
      async (key: string, min: number, max: number): Promise<string[]> => {
        cleanExpired(key);
        const sortedSet = store.sortedSets.get(key);
        if (!sortedSet) {
          return [];
        }

        return Array.from(sortedSet.entries())
          .filter(([, score]) => score >= min && score <= max)
          .sort((a, b) => a[1] - b[1])
          .map(([member]) => member);
      }
    ),

    zrevrange: vi.fn(
      async (key: string, start: number, stop: number): Promise<string[]> => {
        cleanExpired(key);
        const sortedSet = store.sortedSets.get(key);
        if (!sortedSet) {
          return [];
        }

        const sorted = Array.from(sortedSet.entries()).sort(
          (a, b) => b[1] - a[1]
        );
        const actualStop = stop < 0 ? sorted.length + stop + 1 : stop + 1;
        return sorted.slice(start, actualStop).map(([member]) => member);
      }
    ),

    zscore: vi.fn(
      async (key: string, member: string): Promise<string | null> => {
        cleanExpired(key);
        const sortedSet = store.sortedSets.get(key);
        const score = sortedSet?.get(member);
        return score !== undefined ? String(score) : null;
      }
    ),

    zcard: vi.fn(async (key: string): Promise<number> => {
      cleanExpired(key);
      const sortedSet = store.sortedSets.get(key);
      return sortedSet?.size ?? 0;
    }),

    zrank: vi.fn(
      async (key: string, member: string): Promise<number | null> => {
        cleanExpired(key);
        const sortedSet = store.sortedSets.get(key);
        if (!sortedSet || !sortedSet.has(member)) {
          return null;
        }

        const sorted = Array.from(sortedSet.entries()).sort(
          (a, b) => a[1] - b[1]
        );
        return sorted.findIndex(([m]) => m === member);
      }
    ),

    // ==========================================================================
    // PUB/SUB OPERATIONS
    // ==========================================================================

    publish: vi.fn(
      async (channel: string, message: string): Promise<number> => {
        publishedMessages.push({ channel, message });

        // Notify direct subscribers
        const channelSubs = subscriptions.get(channel);
        if (channelSubs) {
          for (const callback of channelSubs) {
            callback(channel, message);
          }
        }

        // Notify pattern subscribers
        for (const [pattern, callbacks] of patternSubscriptions) {
          const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
          );
          if (regex.test(channel)) {
            for (const callback of callbacks) {
              callback(pattern, channel, message);
            }
          }
        }

        return (channelSubs?.size ?? 0) + patternSubscriptions.size;
      }
    ),

    subscribe: vi.fn(
      async (
        channel: string,
        callback: SubscriptionCallback
      ): Promise<void> => {
        let subs = subscriptions.get(channel);
        if (!subs) {
          subs = new Set();
          subscriptions.set(channel, subs);
        }
        subs.add(callback);
      }
    ),

    unsubscribe: vi.fn(async (channel: string): Promise<void> => {
      subscriptions.delete(channel);
    }),

    psubscribe: vi.fn(
      async (
        pattern: string,
        callback: PatternSubscriptionCallback
      ): Promise<void> => {
        let subs = patternSubscriptions.get(pattern);
        if (!subs) {
          subs = new Set();
          patternSubscriptions.set(pattern, subs);
        }
        subs.add(callback);
      }
    ),

    punsubscribe: vi.fn(async (pattern: string): Promise<void> => {
      patternSubscriptions.delete(pattern);
    }),

    // ==========================================================================
    // TTL OPERATIONS
    // ==========================================================================

    expire: vi.fn(async (key: string, seconds: number): Promise<number> => {
      const keyExists =
        store.strings.has(key) ||
        store.hashes.has(key) ||
        store.sets.has(key) ||
        store.sortedSets.has(key);

      if (!keyExists) {
        return 0;
      }
      store.ttls.set(key, Date.now() + seconds * 1000);
      return 1;
    }),

    expireat: vi.fn(async (key: string, timestamp: number): Promise<number> => {
      const keyExists =
        store.strings.has(key) ||
        store.hashes.has(key) ||
        store.sets.has(key) ||
        store.sortedSets.has(key);

      if (!keyExists) {
        return 0;
      }
      store.ttls.set(key, timestamp * 1000);
      return 1;
    }),

    pexpire: vi.fn(
      async (key: string, milliseconds: number): Promise<number> => {
        const keyExists =
          store.strings.has(key) ||
          store.hashes.has(key) ||
          store.sets.has(key) ||
          store.sortedSets.has(key);

        if (!keyExists) {
          return 0;
        }
        store.ttls.set(key, Date.now() + milliseconds);
        return 1;
      }
    ),

    ttl: vi.fn(async (key: string): Promise<number> => {
      const expiry = store.ttls.get(key);
      if (expiry === undefined) {
        return -1;
      }
      if (Date.now() >= expiry) {
        return -2;
      }
      return Math.ceil((expiry - Date.now()) / 1000);
    }),

    pttl: vi.fn(async (key: string): Promise<number> => {
      const expiry = store.ttls.get(key);
      if (expiry === undefined) {
        return -1;
      }
      if (Date.now() >= expiry) {
        return -2;
      }
      return expiry - Date.now();
    }),

    persist: vi.fn(async (key: string): Promise<number> => {
      if (store.ttls.has(key)) {
        store.ttls.delete(key);
        return 1;
      }
      return 0;
    }),

    // ==========================================================================
    // UTILITY OPERATIONS
    // ==========================================================================

    exists: vi.fn(async (...keys: string[]): Promise<number> => {
      let count = 0;
      for (const key of keys) {
        cleanExpired(key);
        if (
          store.strings.has(key) ||
          store.hashes.has(key) ||
          store.sets.has(key) ||
          store.sortedSets.has(key)
        ) {
          count++;
        }
      }
      return count;
    }),

    keys: vi.fn(async (pattern: string): Promise<string[]> => {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );

      const allKeys = new Set([
        ...store.strings.keys(),
        ...store.hashes.keys(),
        ...store.sets.keys(),
        ...store.sortedSets.keys(),
      ]);

      return Array.from(allKeys).filter(key => {
        cleanExpired(key);
        return regex.test(key) && !isExpired(key);
      });
    }),

    scan: vi.fn(
      async (
        cursor: number,
        options?: { MATCH?: string; COUNT?: number }
      ): Promise<{ cursor: number; keys: string[] }> => {
        const pattern = options?.MATCH ?? '*';
        const count = options?.COUNT ?? 10;
        const matchingKeys = await redis.keys(pattern);

        const start = cursor;
        const end = Math.min(start + count, matchingKeys.length);
        const nextCursor = end >= matchingKeys.length ? 0 : end;

        return {
          cursor: nextCursor,
          keys: matchingKeys.slice(start, end),
        };
      }
    ),

    type: vi.fn(async (key: string): Promise<string> => {
      cleanExpired(key);
      if (store.strings.has(key)) {
        return 'string';
      }
      if (store.hashes.has(key)) {
        return 'hash';
      }
      if (store.sets.has(key)) {
        return 'set';
      }
      if (store.sortedSets.has(key)) {
        return 'zset';
      }
      return 'none';
    }),

    flushall: vi.fn(async (): Promise<'OK'> => {
      store.strings.clear();
      store.hashes.clear();
      store.sets.clear();
      store.sortedSets.clear();
      store.ttls.clear();
      subscriptions.clear();
      patternSubscriptions.clear();
      publishedMessages.length = 0;
      return 'OK';
    }),

    flushdb: vi.fn(async (): Promise<'OK'> => {
      return redis.flushall();
    }),

    // ==========================================================================
    // CONNECTION OPERATIONS
    // ==========================================================================

    ping: vi.fn(async (): Promise<'PONG'> => 'PONG'),

    quit: vi.fn(async (): Promise<'OK'> => 'OK'),

    disconnect: vi.fn(async (): Promise<void> => undefined),

    // ==========================================================================
    // PIPELINE/MULTI OPERATIONS
    // ==========================================================================

    multi: vi.fn(() => {
      const commands: Array<{ method: string; args: unknown[] }> = [];

      return {
        get: (key: string) => {
          commands.push({ method: 'get', args: [key] });
          return this;
        },
        set: (key: string, value: string) => {
          commands.push({ method: 'set', args: [key, value] });
          return this;
        },
        del: (...keys: string[]) => {
          commands.push({ method: 'del', args: keys });
          return this;
        },
        hset: (key: string, field: string, value: string) => {
          commands.push({ method: 'hset', args: [key, field, value] });
          return this;
        },
        hget: (key: string, field: string) => {
          commands.push({ method: 'hget', args: [key, field] });
          return this;
        },
        sadd: (key: string, ...members: string[]) => {
          commands.push({ method: 'sadd', args: [key, ...members] });
          return this;
        },
        srem: (key: string, ...members: string[]) => {
          commands.push({ method: 'srem', args: [key, ...members] });
          return this;
        },
        expire: (key: string, seconds: number) => {
          commands.push({ method: 'expire', args: [key, seconds] });
          return this;
        },
        exec: async () => {
          const results = [];
          for (const cmd of commands) {
            const method = (redis as Record<string, unknown>)[cmd.method];
            if (typeof method === 'function') {
              results.push(await method(...cmd.args));
            }
          }
          return results;
        },
      };
    }),

    exec: vi.fn(async (): Promise<unknown[]> => []),

    pipeline: vi.fn(() => redis.multi()),

    // ==========================================================================
    // TESTING HELPERS
    // ==========================================================================

    _reset: () => {
      store.strings.clear();
      store.hashes.clear();
      store.sets.clear();
      store.sortedSets.clear();
      store.ttls.clear();
      subscriptions.clear();
      patternSubscriptions.clear();
      publishedMessages.length = 0;
      vi.clearAllMocks();
    },

    _setExpiry: (key: string, seconds: number) => {
      store.ttls.set(key, Date.now() + seconds * 1000);
    },

    _getExpiry: (key: string): number | null => {
      return store.ttls.get(key) ?? null;
    },

    _simulateExpiry: (key: string) => {
      store.ttls.set(key, Date.now() - 1);
      cleanExpired(key);
    },

    _triggerSubscription: (channel: string, message: string) => {
      const channelSubs = subscriptions.get(channel);
      if (channelSubs) {
        for (const callback of channelSubs) {
          callback(channel, message);
        }
      }
    },
  };

  return redis;
}

// =============================================================================
// EXPORTED UTILITIES
// =============================================================================

/**
 * Create a mock Redis subscriber client (for pub/sub)
 */
export function createMockRedisSubscriber(): MockRedis {
  return createMockRedis();
}

/**
 * Create a pair of connected mock Redis clients for pub/sub testing
 */
export function createMockRedisPair(): {
  publisher: MockRedis;
  subscriber: MockRedis;
} {
  const publisher = createMockRedis();
  const subscriber = createMockRedis();

  // Link the subscriptions
  subscriber._subscriptions = publisher._subscriptions;
  subscriber._patternSubscriptions = publisher._patternSubscriptions;

  return { publisher, subscriber };
}

export default createMockRedis;
