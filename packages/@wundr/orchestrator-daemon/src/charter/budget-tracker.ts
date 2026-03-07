/**
 * Budget Tracker
 *
 * Tracks token consumption per orchestrator with in-memory storage bucketed by
 * hour and day. Periodic flushing to a persistent store is supported via a
 * pluggable `FlushHandler` callback so the caller decides the persistence
 * strategy (database, file, etc.) without coupling this module to any specific
 * backend.
 *
 * Design notes:
 * - All timestamps are UTC epoch milliseconds (Date.now()).
 * - Hourly and daily buckets are keyed by the ISO hour/day string so they
 *   naturally roll over without any timer-based cleanup.
 * - Active session tracking is separate from token usage and is incremented /
 *   decremented explicitly by the caller via `incrementActiveSessions` and
 *   `decrementActiveSessions`.
 *
 * @module @wundr/orchestrator-daemon/charter/budget-tracker
 */

import type { Charter } from './loader';
import { Logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Callback invoked when the tracker flushes usage data to persistent storage.
 * Receives a snapshot of all recorded usage for every tracked orchestrator.
 */
export type FlushHandler = (
  snapshot: ReadonlyMap<string, OrchestratorUsageRecord>
) => Promise<void>;

/**
 * Token usage recorded for a single time window.
 */
export interface WindowUsage {
  /** ISO 8601 key identifying this window (e.g. "2026-03-07T14" for an hour). */
  windowKey: string;
  /** Cumulative tokens consumed during this window. */
  tokens: number;
}

/**
 * Complete usage record for a single orchestrator.
 */
export interface OrchestratorUsageRecord {
  orchestratorId: string;
  /** Hourly usage buckets keyed by "YYYY-MM-DDTHH" (UTC). */
  hourly: Map<string, number>;
  /** Daily usage buckets keyed by "YYYY-MM-DD" (UTC). */
  daily: Map<string, number>;
  /** Number of currently active (running) sessions for this orchestrator. */
  activeSessions: number;
  /** Timestamp (ms) of the last token recording. */
  lastUpdatedAt: number;
}

/**
 * Serialisable usage report for a single orchestrator, suitable for
 * returning to callers or logging.
 */
export interface UsageReport {
  orchestratorId: string;
  /** Tokens consumed in the current UTC hour. */
  hourlyTokens: number;
  /** Tokens consumed in the current UTC day. */
  dailyTokens: number;
  /** Number of active sessions at the time of the report. */
  activeSessions: number;
  /** Timestamp (ms) of the most recent token recording. */
  lastUpdatedAt: number;
  /** Current UTC hour key (YYYY-MM-DDTHH). */
  currentHourKey: string;
  /** Current UTC day key (YYYY-MM-DD). */
  currentDayKey: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Return the current UTC hour as "YYYY-MM-DDTHH". */
function hourKey(now: number = Date.now()): string {
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hour = String(d.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}`;
}

/** Return the current UTC day as "YYYY-MM-DD". */
function dayKey(now: number = Date.now()): string {
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// BudgetTracker
// ============================================================================

/**
 * Tracks token usage and session counts for one or more orchestrators.
 *
 * @example
 * ```ts
 * const tracker = new BudgetTracker({
 *   flushIntervalMs: 60_000, // flush to DB every minute
 *   onFlush: async snapshot => { await db.upsertUsage(snapshot); },
 * });
 *
 * tracker.start();
 *
 * // On each LLM response:
 * tracker.recordTokenUsage(orchestratorId, response.usage.totalTokens);
 *
 * // Check before spawning a new session:
 * if (!tracker.isWithinBudget(orchestratorId, charter)) {
 *   throw new Error('Token budget exhausted');
 * }
 *
 * tracker.stop();
 * ```
 */
export class BudgetTracker {
  private readonly logger: Logger;
  private readonly flushIntervalMs: number;
  private readonly onFlush: FlushHandler | undefined;

  /** In-memory usage store keyed by orchestratorId. */
  private readonly store: Map<string, OrchestratorUsageRecord> = new Map();

  /** Timer handle for the periodic flush. */
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: {
    /** How often to flush in-memory data to persistent storage (ms). Default: 60 000. */
    flushIntervalMs?: number;
    /** Called with a snapshot of all usage when the flush interval fires. */
    onFlush?: FlushHandler;
  }) {
    this.logger = new Logger('BudgetTracker');
    this.flushIntervalMs = options?.flushIntervalMs ?? 60_000;
    this.onFlush = options?.onFlush;
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Start the periodic flush timer.
   * Calling `start()` more than once is a no-op.
   */
  start(): void {
    if (this.flushTimer !== null) {
      return;
    }

    if (!this.onFlush) {
      return; // Nothing to flush to.
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch(err => {
        this.logger.warn('Periodic budget flush failed', err);
      });
    }, this.flushIntervalMs);
  }

  /**
   * Stop the periodic flush timer and perform a final flush.
   */
  async stop(): Promise<void> {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }

  /**
   * Immediately flush the current snapshot to the persistent store.
   * Returns silently if no `onFlush` handler is configured.
   */
  async flush(): Promise<void> {
    if (!this.onFlush) {
      return;
    }

    try {
      await this.onFlush(
        this.store as ReadonlyMap<string, OrchestratorUsageRecord>
      );
      this.logger.debug(
        `Budget snapshot flushed for ${this.store.size} orchestrator(s).`
      );
    } catch (err) {
      this.logger.warn('Budget flush handler threw an error', err);
    }
  }

  // --------------------------------------------------------------------------
  // Record usage
  // --------------------------------------------------------------------------

  /**
   * Record that `tokens` tokens were consumed by `orchestratorId`.
   *
   * The tokens are added to both the current hourly and daily buckets.
   */
  recordTokenUsage(orchestratorId: string, tokens: number): void {
    if (!orchestratorId || tokens <= 0) {
      return;
    }

    const record = this.getOrCreateRecord(orchestratorId);
    const now = Date.now();
    const hKey = hourKey(now);
    const dKey = dayKey(now);

    record.hourly.set(hKey, (record.hourly.get(hKey) ?? 0) + tokens);
    record.daily.set(dKey, (record.daily.get(dKey) ?? 0) + tokens);
    record.lastUpdatedAt = now;

    this.logger.debug(
      `Token usage recorded for "${orchestratorId}": +${tokens} tokens ` +
        `(hour: ${record.hourly.get(hKey)}, day: ${record.daily.get(dKey)})`
    );
  }

  // --------------------------------------------------------------------------
  // Session count management
  // --------------------------------------------------------------------------

  /**
   * Increment the active-session counter for an orchestrator.
   * Call this when a new session is spawned.
   */
  incrementActiveSessions(orchestratorId: string): void {
    const record = this.getOrCreateRecord(orchestratorId);
    record.activeSessions = Math.max(0, record.activeSessions) + 1;
  }

  /**
   * Decrement the active-session counter for an orchestrator.
   * Call this when a session terminates. Will not go below zero.
   */
  decrementActiveSessions(orchestratorId: string): void {
    const record = this.getOrCreateRecord(orchestratorId);
    record.activeSessions = Math.max(0, record.activeSessions - 1);
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Return the number of tokens consumed by `orchestratorId` in the
   * current UTC hour. Returns 0 for unknown orchestrators.
   */
  getHourlyUsage(orchestratorId: string, now?: number): number {
    const record = this.store.get(orchestratorId);
    if (!record) {
      return 0;
    }
    return record.hourly.get(hourKey(now)) ?? 0;
  }

  /**
   * Return the number of tokens consumed by `orchestratorId` on the
   * current UTC day. Returns 0 for unknown orchestrators.
   */
  getDailyUsage(orchestratorId: string, now?: number): number {
    const record = this.store.get(orchestratorId);
    if (!record) {
      return 0;
    }
    return record.daily.get(dayKey(now)) ?? 0;
  }

  /**
   * Check whether `orchestratorId` is within the token budget defined in
   * `charter`. Returns `true` if both hourly and daily limits are respected.
   *
   * An orchestrator with no recorded usage is always within budget.
   */
  isWithinBudget(orchestratorId: string, charter: Charter): boolean {
    const limits = charter.resourceLimits;
    const now = Date.now();

    const hourlyUsage = this.getHourlyUsage(orchestratorId, now);
    if (hourlyUsage >= limits.tokenBudget.hourly) {
      return false;
    }

    const dailyUsage = this.getDailyUsage(orchestratorId, now);
    if (dailyUsage >= limits.tokenBudget.daily) {
      return false;
    }

    return true;
  }

  /**
   * Return a detailed usage report for `orchestratorId`.
   *
   * If the orchestrator has no recorded usage, an empty report is returned
   * with all counters at zero.
   */
  getUsageReport(orchestratorId: string, now?: number): UsageReport {
    const hKey = hourKey(now);
    const dKey = dayKey(now);
    const record = this.store.get(orchestratorId);

    if (!record) {
      return {
        orchestratorId,
        hourlyTokens: 0,
        dailyTokens: 0,
        activeSessions: 0,
        lastUpdatedAt: 0,
        currentHourKey: hKey,
        currentDayKey: dKey,
      };
    }

    return {
      orchestratorId,
      hourlyTokens: record.hourly.get(hKey) ?? 0,
      dailyTokens: record.daily.get(dKey) ?? 0,
      activeSessions: record.activeSessions,
      lastUpdatedAt: record.lastUpdatedAt,
      currentHourKey: hKey,
      currentDayKey: dKey,
    };
  }

  /**
   * Return usage reports for all tracked orchestrators.
   */
  getAllUsageReports(now?: number): UsageReport[] {
    return Array.from(this.store.keys()).map(id =>
      this.getUsageReport(id, now)
    );
  }

  /**
   * Remove stale hourly buckets older than `maxAgeMs` (default: 25 hours)
   * and daily buckets older than `maxDays` (default: 8 days) to prevent
   * unbounded memory growth.
   *
   * Call this periodically in long-running daemons.
   */
  pruneOldBuckets(
    now?: number,
    opts?: { maxAgeMs?: number; maxDays?: number }
  ): void {
    const currentNow = now ?? Date.now();
    const maxAgeMs = opts?.maxAgeMs ?? 25 * 60 * 60 * 1000; // 25 hours
    const maxDays = opts?.maxDays ?? 8;

    for (const record of this.store.values()) {
      for (const key of Array.from(record.hourly.keys())) {
        // Parse "YYYY-MM-DDTHH" back to a timestamp for age comparison.
        const ts = Date.parse(key + ':00:00Z');
        if (!isNaN(ts) && currentNow - ts > maxAgeMs) {
          record.hourly.delete(key);
        }
      }

      for (const key of Array.from(record.daily.keys())) {
        const ts = Date.parse(key + 'T00:00:00Z');
        if (!isNaN(ts) && currentNow - ts > maxDays * 24 * 60 * 60 * 1000) {
          record.daily.delete(key);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private getOrCreateRecord(orchestratorId: string): OrchestratorUsageRecord {
    let record = this.store.get(orchestratorId);
    if (!record) {
      record = {
        orchestratorId,
        hourly: new Map(),
        daily: new Map(),
        activeSessions: 0,
        lastUpdatedAt: Date.now(),
      };
      this.store.set(orchestratorId, record);
    }
    return record;
  }
}
