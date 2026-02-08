/**
 * Auth Profile Manager - Multi-key credential management with rotation and cooldown
 *
 * Manages multiple API credentials per provider with round-robin rotation,
 * exponential backoff cooldowns on failure, and billing-aware disabling.
 *
 * Directly inspired by OpenClaw's auth-profiles/ subsystem:
 * - Round-robin ordering by lastUsed (oldest first)
 * - Cooldown escalation: 1min -> 5min -> 25min -> 60min
 * - Billing failures use longer backoff: 5h base, doubling, 24h max
 * - Failure window: error counts reset after 24h of no failures
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CredentialType = 'api_key' | 'token' | 'oauth';

export type FailureReason =
  | 'auth'
  | 'billing'
  | 'rate_limit'
  | 'timeout'
  | 'format'
  | 'network'
  | 'unknown';

export interface AuthProfile {
  id: string;
  provider: string;
  type: CredentialType;
  /** The actual credential value (API key, bearer token, etc.) */
  credential: string;
  /** Optional expiry timestamp in ms since epoch */
  expiresAt?: number;
  /** Optional label for display */
  label?: string;
  /** Provider-specific metadata (e.g. org ID, project ID) */
  metadata?: Record<string, string>;
}

export interface ProfileUsageStats {
  lastUsed?: number;
  cooldownUntil?: number;
  disabledUntil?: number;
  disabledReason?: FailureReason;
  errorCount: number;
  failureCounts: Partial<Record<FailureReason, number>>;
  lastFailureAt?: number;
}

export interface AuthProfileStoreData {
  profiles: Record<string, AuthProfile>;
  order?: Record<string, string[]>;
  usageStats: Record<string, ProfileUsageStats>;
}

export interface AuthProfileManagerConfig {
  /** Initial profiles to load */
  profiles?: AuthProfile[];
  /** Per-provider explicit ordering */
  order?: Record<string, string[]>;
  /** Cooldown configuration */
  cooldowns?: {
    billingBackoffHours?: number;
    billingMaxHours?: number;
    failureWindowHours?: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BILLING_BACKOFF_HOURS = 5;
const DEFAULT_BILLING_MAX_HOURS = 24;
const DEFAULT_FAILURE_WINDOW_HOURS = 24;

// ---------------------------------------------------------------------------
// Cooldown calculation (matches OpenClaw exactly)
// ---------------------------------------------------------------------------

/**
 * Calculate cooldown duration for general failures.
 * Escalation: 1min, 5min, 25min, 60min (capped).
 */
export function calculateCooldownMs(errorCount: number): number {
  const normalized = Math.max(1, errorCount);
  return Math.min(
    60 * 60 * 1000, // 1 hour max
    60 * 1000 * 5 ** Math.min(normalized - 1, 3),
  );
}

/**
 * Calculate disabled duration for billing failures.
 * Escalation: 5h, 10h, 20h, 24h (capped).
 */
export function calculateBillingDisableMs(
  errorCount: number,
  baseHours: number = DEFAULT_BILLING_BACKOFF_HOURS,
  maxHours: number = DEFAULT_BILLING_MAX_HOURS,
): number {
  const normalized = Math.max(1, errorCount);
  const baseMs = Math.max(60_000, baseHours * 60 * 60 * 1000);
  const maxMs = Math.max(baseMs, maxHours * 60 * 60 * 1000);
  const exponent = Math.min(normalized - 1, 10);
  const raw = baseMs * 2 ** exponent;
  return Math.min(maxMs, raw);
}

// ---------------------------------------------------------------------------
// AuthProfileManager class
// ---------------------------------------------------------------------------

interface AuthProfileManagerEvents {
  'profile:used': (profileId: string, provider: string) => void;
  'profile:failure': (profileId: string, provider: string, reason: FailureReason) => void;
  'profile:cooldown': (profileId: string, provider: string, until: number) => void;
  'profile:disabled': (profileId: string, provider: string, reason: FailureReason, until: number) => void;
  'profile:recovered': (profileId: string, provider: string) => void;
}

export class AuthProfileManager extends EventEmitter<AuthProfileManagerEvents> {
  private profiles: Map<string, AuthProfile> = new Map();
  private usageStats: Map<string, ProfileUsageStats> = new Map();
  private explicitOrder: Map<string, string[]> = new Map();

  private readonly billingBackoffHours: number;
  private readonly billingMaxHours: number;
  private readonly failureWindowMs: number;

  constructor(config?: AuthProfileManagerConfig) {
    super();
    this.billingBackoffHours = config?.cooldowns?.billingBackoffHours ?? DEFAULT_BILLING_BACKOFF_HOURS;
    this.billingMaxHours = config?.cooldowns?.billingMaxHours ?? DEFAULT_BILLING_MAX_HOURS;
    this.failureWindowMs = (config?.cooldowns?.failureWindowHours ?? DEFAULT_FAILURE_WINDOW_HOURS) * 60 * 60 * 1000;

    if (config?.profiles) {
      for (const profile of config.profiles) {
        this.addProfile(profile);
      }
    }
    if (config?.order) {
      for (const [provider, order] of Object.entries(config.order)) {
        this.explicitOrder.set(provider.toLowerCase(), order);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Profile management
  // -------------------------------------------------------------------------

  addProfile(profile: AuthProfile): void {
    this.profiles.set(profile.id, profile);
    if (!this.usageStats.has(profile.id)) {
      this.usageStats.set(profile.id, {
        errorCount: 0,
        failureCounts: {},
      });
    }
  }

  removeProfile(profileId: string): void {
    this.profiles.delete(profileId);
    this.usageStats.delete(profileId);
  }

  getProfile(profileId: string): AuthProfile | null {
    return this.profiles.get(profileId) ?? null;
  }

  // -------------------------------------------------------------------------
  // Profile ordering (mirrors OpenClaw's resolveAuthProfileOrder)
  // -------------------------------------------------------------------------

  /**
   * Get ordered list of profile IDs for a provider, respecting cooldown and
   * round-robin rotation.
   *
   * Algorithm:
   * 1. If explicit order exists, use it (but sort by cooldown availability)
   * 2. Otherwise, round-robin: sort by lastUsed (oldest first)
   * 3. Cooldown profiles sink to end, sorted by soonest recovery
   * 4. Filter out expired tokens and profiles with empty credentials
   */
  getProfileOrder(provider: string): string[] {
    const normalizedProvider = provider.toLowerCase();
    const now = Date.now();

    // Gather all profiles for this provider
    const candidateIds = this.getProfileIdsForProvider(normalizedProvider);
    if (candidateIds.length === 0) {
      return [];
    }

    // Filter out invalid profiles
    const valid = candidateIds.filter((id) => this.isProfileValid(id, now));

    // Check for explicit ordering
    const explicitOrder = this.explicitOrder.get(normalizedProvider);
    if (explicitOrder && explicitOrder.length > 0) {
      // Filter to only valid profiles that appear in explicit order
      const ordered = explicitOrder.filter((id) => valid.includes(id));
      // Add any valid profiles not in explicit order at the end
      const remaining = valid.filter((id) => !ordered.includes(id));
      return this.sortByCooldownAvailability([...ordered, ...remaining], now);
    }

    // Round-robin: sort by lastUsed (oldest first), cooldown at end
    return this.sortByRoundRobin(valid, now);
  }

  /**
   * Get the next available profile for a provider.
   * Returns null if all profiles are in cooldown.
   */
  getNextProfile(provider: string): AuthProfile | null {
    const order = this.getProfileOrder(provider);
    for (const profileId of order) {
      if (!this.isInCooldown(profileId)) {
        return this.profiles.get(profileId) ?? null;
      }
    }
    return null;
  }

  /**
   * Check if ANY profile is available (not in cooldown) for a provider.
   */
  hasAvailableProfile(provider: string): boolean {
    const order = this.getProfileOrder(provider);
    return order.some((id) => !this.isInCooldown(id));
  }

  // -------------------------------------------------------------------------
  // Usage tracking
  // -------------------------------------------------------------------------

  /**
   * Mark a profile as successfully used. Resets error state.
   */
  markUsed(profileId: string): void {
    const stats = this.usageStats.get(profileId);
    if (!stats) {
      return;
    }
    const profile = this.profiles.get(profileId);
    const hadCooldown = stats.cooldownUntil !== undefined || stats.disabledUntil !== undefined;

    stats.lastUsed = Date.now();
    stats.errorCount = 0;
    stats.cooldownUntil = undefined;
    stats.disabledUntil = undefined;
    stats.disabledReason = undefined;
    stats.failureCounts = {};

    this.emit('profile:used', profileId, profile?.provider ?? 'unknown');

    if (hadCooldown && profile) {
      this.emit('profile:recovered', profileId, profile.provider);
    }
  }

  /**
   * Mark a profile as failed. Applies appropriate cooldown based on reason.
   */
  markFailure(profileId: string, reason: FailureReason): void {
    const stats = this.usageStats.get(profileId);
    if (!stats) {
      return;
    }
    const profile = this.profiles.get(profileId);
    const now = Date.now();

    // Check if failure window has expired (reset error counts)
    const windowExpired =
      typeof stats.lastFailureAt === 'number' &&
      stats.lastFailureAt > 0 &&
      now - stats.lastFailureAt > this.failureWindowMs;

    if (windowExpired) {
      stats.errorCount = 0;
      stats.failureCounts = {};
    }

    stats.errorCount += 1;
    stats.failureCounts[reason] = (stats.failureCounts[reason] ?? 0) + 1;
    stats.lastFailureAt = now;

    this.emit('profile:failure', profileId, profile?.provider ?? 'unknown', reason);

    if (reason === 'billing') {
      const billingCount = stats.failureCounts.billing ?? 1;
      const disableMs = calculateBillingDisableMs(
        billingCount,
        this.billingBackoffHours,
        this.billingMaxHours,
      );
      stats.disabledUntil = now + disableMs;
      stats.disabledReason = 'billing';
      this.emit(
        'profile:disabled',
        profileId,
        profile?.provider ?? 'unknown',
        reason,
        stats.disabledUntil,
      );
    } else {
      const cooldownMs = calculateCooldownMs(stats.errorCount);
      stats.cooldownUntil = now + cooldownMs;
      this.emit(
        'profile:cooldown',
        profileId,
        profile?.provider ?? 'unknown',
        stats.cooldownUntil,
      );
    }
  }

  /**
   * Clear cooldown for a specific profile.
   */
  clearCooldown(profileId: string): void {
    const stats = this.usageStats.get(profileId);
    if (stats) {
      stats.errorCount = 0;
      stats.cooldownUntil = undefined;
      stats.disabledUntil = undefined;
      stats.disabledReason = undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Cooldown queries
  // -------------------------------------------------------------------------

  /**
   * Check if a profile is currently in cooldown or disabled.
   */
  isInCooldown(profileId: string): boolean {
    const stats = this.usageStats.get(profileId);
    if (!stats) {
      return false;
    }
    const now = Date.now();
    const unusableUntil = this.getUnusableUntil(stats);
    return unusableUntil !== null && now < unusableUntil;
  }

  /**
   * Get the timestamp until which a profile is unusable.
   * Returns null if the profile is available.
   */
  getUnusableUntil(stats: ProfileUsageStats): number | null {
    const values = [stats.cooldownUntil, stats.disabledUntil]
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
    if (values.length === 0) {
      return null;
    }
    return Math.max(...values);
  }

  /**
   * Get usage stats for a profile (for monitoring/display).
   */
  getProfileStats(profileId: string): ProfileUsageStats | null {
    return this.usageStats.get(profileId) ?? null;
  }

  // -------------------------------------------------------------------------
  // Serialization (for persistence)
  // -------------------------------------------------------------------------

  /**
   * Export current state for persistence.
   */
  exportState(): AuthProfileStoreData {
    const profiles: Record<string, AuthProfile> = {};
    for (const [id, profile] of this.profiles) {
      profiles[id] = profile;
    }
    const usageStats: Record<string, ProfileUsageStats> = {};
    for (const [id, stats] of this.usageStats) {
      usageStats[id] = stats;
    }
    const order: Record<string, string[]> = {};
    for (const [provider, providerOrder] of this.explicitOrder) {
      order[provider] = providerOrder;
    }
    return { profiles, order, usageStats };
  }

  /**
   * Import state from persistence.
   */
  importState(data: AuthProfileStoreData): void {
    for (const [id, profile] of Object.entries(data.profiles)) {
      this.profiles.set(id, profile);
    }
    for (const [id, stats] of Object.entries(data.usageStats)) {
      this.usageStats.set(id, stats);
    }
    if (data.order) {
      for (const [provider, order] of Object.entries(data.order)) {
        this.explicitOrder.set(provider.toLowerCase(), order);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private getProfileIdsForProvider(provider: string): string[] {
    const ids: string[] = [];
    for (const [id, profile] of this.profiles) {
      if (profile.provider.toLowerCase() === provider) {
        ids.push(id);
      }
    }
    return ids;
  }

  private isProfileValid(profileId: string, now: number): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return false;
    }
    // Check credential is not empty
    if (!profile.credential.trim()) {
      return false;
    }
    // Check expiry
    if (
      typeof profile.expiresAt === 'number' &&
      Number.isFinite(profile.expiresAt) &&
      profile.expiresAt > 0 &&
      now >= profile.expiresAt
    ) {
      return false;
    }
    return true;
  }

  private sortByCooldownAvailability(profileIds: string[], now: number): string[] {
    const available: string[] = [];
    const inCooldown: Array<{ id: string; until: number }> = [];

    for (const id of profileIds) {
      const stats = this.usageStats.get(id);
      const until = stats ? (this.getUnusableUntil(stats) ?? 0) : 0;
      if (until > 0 && now < until) {
        inCooldown.push({ id, until });
      } else {
        available.push(id);
      }
    }

    const cooldownSorted = inCooldown
      .sort((a, b) => a.until - b.until)
      .map((e) => e.id);

    return [...available, ...cooldownSorted];
  }

  private sortByRoundRobin(profileIds: string[], now: number): string[] {
    const available: string[] = [];
    const inCooldown: Array<{ id: string; until: number }> = [];

    for (const id of profileIds) {
      const stats = this.usageStats.get(id);
      const until = stats ? (this.getUnusableUntil(stats) ?? 0) : 0;
      if (until > 0 && now < until) {
        inCooldown.push({ id, until });
      } else {
        available.push(id);
      }
    }

    // Sort available by lastUsed (oldest first = round-robin)
    available.sort((a, b) => {
      const statsA = this.usageStats.get(a);
      const statsB = this.usageStats.get(b);
      const lastA = statsA?.lastUsed ?? 0;
      const lastB = statsB?.lastUsed ?? 0;
      return lastA - lastB;
    });

    // Sort cooldown by soonest recovery
    const cooldownSorted = inCooldown
      .sort((a, b) => a.until - b.until)
      .map((e) => e.id);

    return [...available, ...cooldownSorted];
  }
}
