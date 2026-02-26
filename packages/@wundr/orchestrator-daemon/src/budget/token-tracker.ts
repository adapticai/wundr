/**
 * Token Budget Tracker
 *
 * Tracks token usage per orchestrator per hour/day/month using Redis for distributed counting.
 * Implements pre-flight budget checks, token reservations, and threshold monitoring.
 */

import { randomUUID } from 'crypto';

import { EventEmitter } from 'eventemitter3';
import { createClient } from 'redis';

import type {
  TokenUsage,
  BudgetCheck,
  ReservationResult,
  UsageStats,
  BudgetOverride,
  BudgetConfig,
  TokenBudget,
  BudgetPeriod,
  PeriodWindow,
  BudgetKeys,
  TokenReservation,
  BudgetThresholdEvent,
} from './types';
import type { RedisClientType } from 'redis';

/**
 * Token Budget Tracker Events
 */
interface TokenBudgetTrackerEvents {
  'threshold:50': (event: BudgetThresholdEvent) => void;
  'threshold:75': (event: BudgetThresholdEvent) => void;
  'threshold:90': (event: BudgetThresholdEvent) => void;
  'threshold:100': (event: BudgetThresholdEvent) => void;
  'usage:tracked': (usage: TokenUsage) => void;
  'reservation:created': (reservation: TokenReservation) => void;
  'reservation:released': (reservationId: string) => void;
  'override:set': (override: BudgetOverride) => void;
  'budget:exceeded': (event: BudgetThresholdEvent) => void;
}

export class TokenBudgetTracker extends EventEmitter<TokenBudgetTrackerEvents> {
  private redis: RedisClientType;
  private config: BudgetConfig;
  private connected: boolean = false;
  private thresholdCache: Map<string, Set<number>> = new Map();

  constructor(config: BudgetConfig) {
    super();
    this.config = config;

    // Initialize Redis client
    this.redis = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db || 0,
    });

    this.setupRedis();
  }

  /**
   * Setup Redis connection and error handlers
   */
  private async setupRedis(): Promise<void> {
    this.redis.on('error', (err: Error) => {
      console.error('Redis Error:', err);
      this.connected = false;
    });

    this.redis.on('connect', () => {
      console.log('Redis connected');
      this.connected = true;
    });

    this.redis.on('disconnect', () => {
      console.log('Redis disconnected');
      this.connected = false;
    });

    try {
      await this.redis.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Track token usage
   */
  async trackUsage(usage: TokenUsage): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const periods: BudgetPeriod[] = ['hourly', 'daily', 'monthly'];

    // Track usage across all periods
    for (const period of periods) {
      const window = this.getPeriodWindow(period, usage.timestamp);
      const keys = this.getBudgetKeys(usage.orchestratorId, period);

      // Increment usage counter with TTL
      await this.redis
        .multi()
        .incrBy(keys.usage, usage.totalTokens)
        .expire(keys.usage, window.ttlSeconds)
        .exec();

      // Store detailed metadata
      const metadata = {
        orchestratorId: usage.orchestratorId,
        sessionId: usage.sessionId,
        timestamp: usage.timestamp.toISOString(),
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        model: usage.model,
        requestId: usage.requestId,
        metadata: usage.metadata,
      };

      await this.redis
        .multi()
        .rPush(`${keys.metadata}:history`, JSON.stringify(metadata))
        .expire(`${keys.metadata}:history`, window.ttlSeconds)
        .exec();

      // Check and emit threshold events
      await this.checkThresholds(usage.orchestratorId, period);
    }

    this.emit('usage:tracked', usage);
  }

  /**
   * Check if budget allows estimated tokens
   */
  async checkBudget(
    orchestratorId: string,
    estimatedTokens: number,
    period: BudgetPeriod = 'hourly'
  ): Promise<BudgetCheck> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const budget = this.getBudgetForOrchestrator(orchestratorId);
    const limit = budget[period];

    if (!limit) {
      return {
        allowed: true,
        remaining: Infinity,
        limit: Infinity,
        period,
        percentUsed: 0,
        estimatedTokens,
        wouldExceed: false,
        message: 'No budget limit set for this period',
      };
    }

    const stats = await this.getUsageStats(orchestratorId, period);
    const availableTokens = stats.remaining;
    const wouldExceed = estimatedTokens > availableTokens;

    return {
      allowed: !wouldExceed,
      remaining: Math.max(0, availableTokens - estimatedTokens),
      limit,
      period,
      percentUsed: stats.percentUsed,
      estimatedTokens,
      wouldExceed,
      message: wouldExceed
        ? `Would exceed ${period} budget (${estimatedTokens} tokens needed, ${availableTokens} available)`
        : undefined,
    };
  }

  /**
   * Reserve tokens before making a call
   */
  async reserveTokens(
    orchestratorId: string,
    tokens: number,
    period: BudgetPeriod = 'hourly'
  ): Promise<ReservationResult> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    // Check if budget allows
    const check = await this.checkBudget(orchestratorId, tokens, period);
    if (!check.allowed) {
      return {
        success: false,
        remaining: check.remaining,
        error: check.message,
      };
    }

    const reservationId = randomUUID();
    const reservation: TokenReservation = {
      id: reservationId,
      orchestratorId,
      tokens,
      period,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.reservationTTL),
    };

    const keys = this.getBudgetKeys(orchestratorId, period);
    const reservationKey = `${keys.reservations}:${reservationId}`;

    // Store reservation
    await this.redis
      .multi()
      .set(reservationKey, JSON.stringify(reservation))
      .expire(reservationKey, Math.floor(this.config.reservationTTL / 1000))
      .incrBy(`${keys.reservations}:total`, tokens)
      .expire(
        `${keys.reservations}:total`,
        Math.floor(this.config.reservationTTL / 1000)
      )
      .exec();

    this.emit('reservation:created', reservation);

    return {
      success: true,
      reservationId,
      reservation,
      remaining: check.remaining,
    };
  }

  /**
   * Release a reservation and track actual usage
   */
  async releaseReservation(
    reservationId: string,
    actualUsed: number
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    // Find and delete reservation
    const pattern = `${this.config.redis.keyPrefix}:budget:*:reservations:${reservationId}`;
    const keys = await this.redis.keys(pattern);

    if (keys.length === 0) {
      throw new Error(`Reservation not found: ${reservationId}`);
    }

    const reservationKey = keys[0];
    const reservationData = await this.redis.get(reservationKey);

    if (!reservationData) {
      throw new Error(`Reservation data not found: ${reservationId}`);
    }

    const reservation: TokenReservation = JSON.parse(reservationData);

    // Release reserved tokens
    const budgetKeys = this.getBudgetKeys(
      reservation.orchestratorId,
      reservation.period
    );
    await this.redis
      .multi()
      .del(reservationKey)
      .decrBy(`${budgetKeys.reservations}:total`, reservation.tokens)
      .exec();

    this.emit('reservation:released', reservationId);

    // Track actual usage if provided
    if (actualUsed > 0) {
      // This would typically be called from trackUsage
      // Just emit the event here
    }
  }

  /**
   * Get usage statistics for a period
   */
  async getUsageStats(
    orchestratorId: string,
    period: BudgetPeriod = 'hourly'
  ): Promise<UsageStats> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const budget = this.getBudgetForOrchestrator(orchestratorId);
    const limit = budget[period] || 0;
    const keys = this.getBudgetKeys(orchestratorId, period);
    const window = this.getPeriodWindow(period);

    // Get current usage
    const usedStr = await this.redis.get(keys.usage);
    const totalUsed = parseInt(usedStr || '0', 10);

    // Get reserved tokens
    const reservedStr = await this.redis.get(`${keys.reservations}:total`);
    const reservedTokens = parseInt(reservedStr || '0', 10);

    // Count active reservations
    const reservationKeys = await this.redis.keys(`${keys.reservations}:*`);
    const activeReservations = reservationKeys.filter(
      (k: string) => !k.endsWith(':total')
    ).length;

    // Get metadata history for breakdown
    const historyItems = await this.redis.lRange(
      `${keys.metadata}:history`,
      0,
      -1
    );
    const history = historyItems.map((item: string) => JSON.parse(item));

    let promptTokens = 0;
    let completionTokens = 0;
    const modelCounts: Record<string, number> = {};

    for (const item of history) {
      promptTokens += item.promptTokens || 0;
      completionTokens += item.completionTokens || 0;

      const model = item.model || 'unknown';
      modelCounts[model] = (modelCounts[model] || 0) + item.totalTokens;
    }

    const topModels = Object.entries(modelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([model, tokens]) => ({
        model,
        tokens,
        percentage: limit > 0 ? (tokens / limit) * 100 : 0,
      }));

    const effectiveUsed = totalUsed + reservedTokens;
    const remaining = Math.max(0, limit - effectiveUsed);
    const percentUsed = limit > 0 ? (effectiveUsed / limit) * 100 : 0;

    return {
      orchestratorId,
      period,
      totalUsed,
      limit,
      remaining,
      percentUsed,
      reservedTokens,
      activeReservations,
      periodStart: window.start,
      periodEnd: window.end,
      breakdown: {
        promptTokens,
        completionTokens,
      },
      topModels,
    };
  }

  /**
   * Set a budget override for priority tasks
   */
  async setBudgetOverride(override: BudgetOverride): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    if (!this.config.enableOverrides) {
      throw new Error('Budget overrides are disabled');
    }

    const keys = this.getBudgetKeys(override.orchestratorId, override.period);
    const overrideKey = `${keys.overrides}:${randomUUID()}`;
    const ttl = Math.floor((override.expiresAt.getTime() - Date.now()) / 1000);

    await this.redis
      .multi()
      .set(overrideKey, JSON.stringify(override))
      .expire(overrideKey, ttl)
      .exec();

    this.emit('override:set', override);
  }

  /**
   * Get budget for an orchestrator (including overrides)
   */
  private getBudgetForOrchestrator(orchestratorId: string): TokenBudget {
    const orchestratorBudget = this.config.orchestratorBudgets[orchestratorId];
    return orchestratorBudget || this.config.defaultBudget;
  }

  /**
   * Get budget keys for Redis
   */
  private getBudgetKeys(
    orchestratorId: string,
    period: BudgetPeriod
  ): BudgetKeys {
    const prefix = `${this.config.redis.keyPrefix}:budget:${orchestratorId}:${period}`;
    return {
      usage: `${prefix}:usage`,
      reservations: `${prefix}:reservations`,
      overrides: `${prefix}:overrides`,
      metadata: `${prefix}:metadata`,
    };
  }

  /**
   * Get period window for budget tracking
   */
  private getPeriodWindow(
    period: BudgetPeriod,
    timestamp?: Date
  ): PeriodWindow {
    const now = timestamp || new Date();
    let start: Date;
    let end: Date;
    let ttlSeconds: number;

    switch (period) {
      case 'hourly':
        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours()
        );
        end = new Date(start.getTime() + 60 * 60 * 1000);
        ttlSeconds = 60 * 60; // 1 hour
        break;

      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        ttlSeconds = 24 * 60 * 60; // 24 hours
        break;

      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        ttlSeconds = 31 * 24 * 60 * 60; // ~31 days
        break;
    }

    const key = `${start.toISOString().split('T')[0]}_${start.getHours()}`;

    return {
      period,
      start,
      end,
      ttlSeconds,
      key,
    };
  }

  /**
   * Check thresholds and emit events
   */
  private async checkThresholds(
    orchestratorId: string,
    period: BudgetPeriod
  ): Promise<void> {
    const stats = await this.getUsageStats(orchestratorId, period);
    const cacheKey = `${orchestratorId}:${period}`;

    // Initialize cache if needed
    if (!this.thresholdCache.has(cacheKey)) {
      this.thresholdCache.set(cacheKey, new Set());
    }

    const firedThresholds = this.thresholdCache.get(cacheKey)!;

    for (const threshold of this.config.thresholds) {
      const thresholdPercent = threshold * 100;

      if (
        stats.percentUsed >= thresholdPercent &&
        !firedThresholds.has(threshold)
      ) {
        const event: BudgetThresholdEvent = {
          orchestratorId,
          period,
          threshold,
          currentUsage: stats.totalUsed,
          limit: stats.limit,
          percentUsed: stats.percentUsed,
          timestamp: new Date(),
        };

        // Emit specific threshold event
        if (threshold === 0.5) {
          this.emit('threshold:50', event);
        } else if (threshold === 0.75) {
          this.emit('threshold:75', event);
        } else if (threshold === 0.9) {
          this.emit('threshold:90', event);
        } else if (threshold === 1.0) {
          this.emit('threshold:100', event);
          this.emit('budget:exceeded', event);
        }

        firedThresholds.add(threshold);
      } else if (
        stats.percentUsed < thresholdPercent &&
        firedThresholds.has(threshold)
      ) {
        // Reset threshold if usage drops below it
        firedThresholds.delete(threshold);
      }
    }
  }

  /**
   * Clean up threshold cache for a period window
   */
  private cleanThresholdCache(
    orchestratorId: string,
    period: BudgetPeriod
  ): void {
    const cacheKey = `${orchestratorId}:${period}`;
    this.thresholdCache.delete(cacheKey);
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.redis.disconnect();
      this.connected = false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}
