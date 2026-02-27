/**
 * Status Service
 * Monitors and reports system and component status
 * @module lib/services/status-service
 */

import { prisma } from '@neolith/database';
import type { PresenceStatusType } from '@/lib/validations/presence';

/**
 * User status information
 */
export interface UserStatus {
  userId: string;
  status: PresenceStatusType;
  customStatus: string | null;
  lastSeen: Date;
  isOnline: boolean;
}

/**
 * DND Schedule configuration
 */
export interface DNDSchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  timezone: string;
}

/**
 * Auto-away configuration
 */
export interface AutoAwayConfig {
  enabled: boolean;
  idleTimeoutMs: number;
}

/**
 * Status update options
 */
export interface StatusUpdateOptions {
  customStatus?: string | null;
  dndUntil?: Date;
}

/**
 * Component health status shape returned by status queries
 */
export interface ComponentHealthRecord {
  id: string;
  componentId: string;
  status: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory listener registry: componentId -> Set of callbacks
 */
const listenerRegistry = new Map<string, Set<Function>>();

/**
 * Status Service class
 */
class StatusServiceClass {
  private currentStatus: PresenceStatusType = 'online';
  private customStatus: string | null = null;
  private lastActivityTime: number = Date.now();
  private autoAwayConfig: AutoAwayConfig = {
    enabled: false,
    idleTimeoutMs: 5 * 60 * 1000,
  };
  private dndSchedule: DNDSchedule | null = null;
  private subscribers: Set<(status: UserStatus) => void> = new Set();

  getCurrentStatus(): PresenceStatusType {
    return this.currentStatus;
  }

  getCustomStatus(): string | null {
    return this.customStatus;
  }

  async updateStatus(
    status: PresenceStatusType,
    options?: StatusUpdateOptions
  ): Promise<boolean> {
    this.currentStatus = status;
    if (options?.customStatus !== undefined) {
      this.customStatus = options.customStatus;
    }
    this.notifySubscribers();
    return true;
  }

  async setCustomStatus(message: string | null): Promise<boolean> {
    this.customStatus = message;
    this.notifySubscribers();
    return true;
  }

  async clearCustomStatus(): Promise<boolean> {
    this.customStatus = null;
    this.notifySubscribers();
    return true;
  }

  subscribe(callback: (status: UserStatus) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  configureAutoAway(config: Partial<AutoAwayConfig>): void {
    this.autoAwayConfig = { ...this.autoAwayConfig, ...config };
  }

  configureDNDSchedule(schedule: DNDSchedule | null): void {
    this.dndSchedule = schedule;
  }

  getTimeSinceLastActivity(): number {
    return Date.now() - this.lastActivityTime;
  }

  /**
   * Check whether the current local time falls within the configured DND window.
   * Time strings are expected in "HH:MM" 24-hour format.
   */
  isInDNDWindow(): boolean {
    if (!this.dndSchedule || !this.dndSchedule.enabled) {
      return false;
    }

    const { startTime, endTime, daysOfWeek, timezone } = this.dndSchedule;

    try {
      const now = new Date(
        new Date().toLocaleString('en-US', { timeZone: timezone })
      );
      const currentDay = now.getDay(); // 0 = Sunday

      if (!daysOfWeek.includes(currentDay)) {
        return false;
      }

      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      // Handle schedules that wrap midnight (e.g. 22:00 -> 06:00)
      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch {
      return false;
    }
  }

  private notifySubscribers(): void {
    const status: UserStatus = {
      userId: 'current-user',
      status: this.currentStatus,
      customStatus: this.customStatus,
      lastSeen: new Date(),
      isOnline: this.currentStatus !== 'offline',
    };
    this.subscribers.forEach(callback => callback(status));
  }
}

// Singleton instance
const statusServiceInstance = new StatusServiceClass();

/**
 * Get status service instance
 */
export function getStatusService(): StatusServiceClass {
  return statusServiceInstance;
}

/**
 * Get system status by checking DB connectivity and aggregating health metrics.
 * Falls back to a computed status when no systemHealth table records exist.
 */
export async function getSystemStatus(): Promise<any> {
  try {
    // Attempt to read from an optional systemHealth aggregate table
    const records = await (prisma as any).systemHealth.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (records && records.length > 0) {
      return records[0];
    }
  } catch {
    // systemHealth table may not exist; fall through to connectivity check
  }

  // Fallback: derive status from a basic connectivity probe
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      message: 'Database connectivity OK',
      checkedAt: new Date(),
    };
  } catch (err: any) {
    return {
      status: 'unhealthy',
      message: err?.message ?? 'Database connectivity failed',
      checkedAt: new Date(),
    };
  }
}

/**
 * Get the most recent health record for a specific component.
 */
export async function getComponentStatus(
  componentId: string
): Promise<ComponentHealthRecord | null> {
  try {
    const record = await (prisma as any).componentHealth.findFirst({
      where: { componentId },
      orderBy: { updatedAt: 'desc' },
    });
    return record ?? null;
  } catch {
    return null;
  }
}

/**
 * Create or update a component status record in the database.
 */
export async function updateComponentStatus(
  componentId: string,
  status: any
): Promise<void> {
  try {
    await (prisma as any).componentHealth.upsert({
      where: { componentId },
      update: {
        status: status?.status ?? status,
        message: status?.message ?? null,
        metadata: status?.metadata ?? null,
        updatedAt: new Date(),
      },
      create: {
        componentId,
        status: status?.status ?? status,
        message: status?.message ?? null,
        metadata: status?.metadata ?? null,
      },
    });
  } catch {
    // Swallow write errors so callers are not disrupted
  }
}

/**
 * Perform a basic connectivity health check via a raw SQL probe.
 */
export async function performHealthCheck(): Promise<{
  healthy: boolean;
  latencyMs: number;
  checkedAt: Date;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      healthy: true,
      latencyMs: Date.now() - start,
      checkedAt: new Date(),
    };
  } catch (err: any) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      checkedAt: new Date(),
      error: err?.message ?? 'Unknown error',
    };
  }
}

/**
 * Retrieve status change history for a component, ordered by most recent first.
 */
export async function getStatusHistory(
  componentId: string,
  timeRange?: { from?: Date; to?: Date }
): Promise<any[]> {
  try {
    const where: Record<string, any> = { componentId };

    if (timeRange?.from || timeRange?.to) {
      where.createdAt = {};
      if (timeRange.from) {
        where.createdAt.gte = timeRange.from;
      }
      if (timeRange.to) {
        where.createdAt.lte = timeRange.to;
      }
    }

    const records = await (prisma as any).componentHealthHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return records ?? [];
  } catch {
    return [];
  }
}

/**
 * Register a listener callback for a given component. Stored in-process memory
 * (acceptable for single-instance deployments). Returns an unsubscribe function.
 */
export async function registerStatusListener(
  componentId: string,
  callback: Function
): Promise<() => void> {
  if (!listenerRegistry.has(componentId)) {
    listenerRegistry.set(componentId, new Set());
  }
  listenerRegistry.get(componentId)!.add(callback);

  return () => {
    listenerRegistry.get(componentId)?.delete(callback);
  };
}

/**
 * Get service uptime in seconds.
 * Attempts to derive uptime from the earliest status record in the database;
 * falls back to process.uptime() when no records are found.
 */
export async function getUptime(componentId?: string): Promise<{
  uptimeSeconds: number;
  since: Date | null;
  source: 'database' | 'process';
}> {
  try {
    const where = componentId ? { componentId } : {};
    const earliest = await (prisma as any).componentHealth.findFirst({
      where,
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    if (earliest?.createdAt) {
      const since: Date = earliest.createdAt;
      const uptimeSeconds = Math.floor((Date.now() - since.getTime()) / 1000);
      return { uptimeSeconds, since, source: 'database' };
    }
  } catch {
    // Table may not exist; fall through to process uptime
  }

  return {
    uptimeSeconds: Math.floor(process.uptime()),
    since: null,
    source: 'process',
  };
}
