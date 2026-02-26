import { EventEmitter } from 'events';

import type { OrganizationCharter } from './types.js';
import { cacheCharter, getEffectiveCharter } from './loader.js';

interface CharterSyncConfig {
  apiBaseUrl: string;
  orgId: string;
  syncIntervalMs?: number;
  cachePath?: string;
}

const DEFAULT_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Periodically syncs the organization charter from the Neolith API.
 * Emits 'charter:updated' when a version change is detected.
 * Falls back to the local cache when the API is unavailable.
 */
export class CharterSync extends EventEmitter {
  private readonly apiBaseUrl: string;
  private readonly orgId: string;
  private readonly syncIntervalMs: number;
  private readonly cachePath?: string;

  private timer: ReturnType<typeof setInterval> | null = null;
  private currentVersion: number | null = null;

  constructor(config: CharterSyncConfig) {
    super();
    this.apiBaseUrl = config.apiBaseUrl;
    this.orgId = config.orgId;
    this.syncIntervalMs = config.syncIntervalMs ?? DEFAULT_SYNC_INTERVAL_MS;
    this.cachePath = config.cachePath;
  }

  /**
   * Start the periodic sync loop.
   * Performs an immediate sync on startup.
   */
  start(): void {
    if (this.timer !== null) {
      return;
    }

    // Sync immediately, then on interval
    this.syncNow().catch((err) => {
      console.warn(`[CharterSync] Initial sync failed for org ${this.orgId}:`, err);
    });

    this.timer = setInterval(() => {
      this.syncNow().catch((err) => {
        console.warn(`[CharterSync] Periodic sync failed for org ${this.orgId}:`, err);
      });
    }, this.syncIntervalMs);
  }

  /**
   * Stop the periodic sync loop.
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Perform a single sync attempt.
   * Returns true if the charter changed (new version detected), false otherwise.
   */
  async syncNow(): Promise<boolean> {
    let charter: OrganizationCharter;

    try {
      charter = await getEffectiveCharter(this.orgId, this.apiBaseUrl);
    } catch (err) {
      console.warn(`[CharterSync] Could not retrieve charter for org ${this.orgId}:`, err);
      return false;
    }

    const previousVersion = this.currentVersion;
    const changed = previousVersion !== null && charter.version !== previousVersion;

    this.currentVersion = charter.version;

    // Always keep cache fresh after a successful API fetch
    try {
      await cacheCharter(charter, this.cachePath);
    } catch (err) {
      console.warn(`[CharterSync] Failed to cache charter for org ${this.orgId}:`, err);
    }

    if (changed) {
      this.emit('charter:updated', charter);
    }

    return changed;
  }
}
