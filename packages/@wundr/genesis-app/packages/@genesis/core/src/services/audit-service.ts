/**
 * @fileoverview Audit log service for enterprise compliance tracking
 *
 * This service provides comprehensive audit logging for enterprise compliance.
 * It requires the AuditLog and AuditLogExport models to be added to the Prisma schema.
 *
 * Required Prisma schema additions:
 * ```prisma
 * model AuditLog {
 *   id           String   @id @default(cuid())
 *   timestamp    DateTime @default(now())
 *   action       String
 *   category     String
 *   severity     String
 *   actorId      String
 *   actorType    String
 *   actorName    String
 *   actorEmail   String?
 *   resourceType String
 *   resourceId   String
 *   resourceName String?
 *   workspaceId  String
 *   ipAddress    String?
 *   userAgent    String?
 *   sessionId    String?
 *   changes      String?  @db.Text
 *   metadata     String?  @db.Text
 *   success      Boolean  @default(true)
 *   errorMessage String?
 *
 *   @@index([workspaceId])
 *   @@index([timestamp])
 *   @@index([actorId])
 *   @@index([action])
 * }
 *
 * model AuditLogExport {
 *   id          String    @id @default(cuid())
 *   workspaceId String
 *   requestedBy String
 *   filter      String    @db.Text
 *   format      String
 *   status      String    @default("pending")
 *   fileUrl     String?
 *   fileSize    Int?
 *   entryCount  Int?
 *   createdAt   DateTime  @default(now())
 *   completedAt DateTime?
 *   expiresAt   DateTime?
 *   error       String?
 *
 *   @@index([workspaceId])
 *   @@index([status])
 * }
 * ```
 */

import type {
  AuditLogEntry,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  AuditChange,
  AuditLogFilter,
  AuditLogPagination,
  AuditLogSort,
  AuditLogResponse,
  AuditLogStats,
  AuditLogExport,
  AuditContext,
} from '../types/audit';
import {
  CRITICAL_ACTIONS,
  WARNING_ACTIONS,
  DEFAULT_AUDIT_RETENTION_DAYS,
  DEFAULT_AUDIT_BATCH_SIZE,
  DEFAULT_AUDIT_PAGE_SIZE,
} from '../types/audit';

// =============================================================================
// DATABASE CLIENT INTERFACES
// =============================================================================

/**
 * Audit log database delegate interface
 * This abstracts the Prisma client to allow for future schema additions
 */
export interface AuditLogDelegate {
  createMany(args: {
    data: Array<Record<string, unknown>>;
  }): Promise<{ count: number }>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    take?: number;
    skip?: number;
  }): Promise<Array<Record<string, unknown>>>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  groupBy(args: {
    by: string[];
    where: Record<string, unknown>;
    _count: boolean;
    orderBy?: Record<string, unknown>;
    take?: number;
  }): Promise<Array<Record<string, unknown>>>;
  deleteMany(args: {
    where: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

export interface AuditLogExportDelegate {
  create(args: {
    data: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  findUnique(args: {
    where: { id: string };
  }): Promise<Record<string, unknown> | null>;
}

export interface AuditDatabaseClient {
  auditLog: AuditLogDelegate;
  auditLogExport: AuditLogExportDelegate;
  $queryRaw<T>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
}

/**
 * Redis client interface for pub/sub and queue operations
 */
export interface AuditRedisClient {
  publish(channel: string, message: string): Promise<number>;
  lpush(key: string, ...values: string[]): Promise<number>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface AuditServiceConfig {
  prisma: AuditDatabaseClient;
  redis: AuditRedisClient;
  retentionDays?: number;
  batchSize?: number;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface LogParams {
  action: AuditAction;
  actorId: string;
  actorType: 'user' | 'vp' | 'system' | 'api';
  actorName: string;
  actorEmail?: string;
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  workspaceId: string;
  changes?: AuditChange[];
  metadata?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
  context?: AuditContext;
}

// =============================================================================
// ERRORS
// =============================================================================

export class AuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditError';
  }
}

export class AuditExportNotFoundError extends AuditError {
  constructor(exportId: string) {
    super(`Audit export not found: ${exportId}`);
    this.name = 'AuditExportNotFoundError';
  }
}

export class AuditValidationError extends AuditError {
  constructor(message: string) {
    super(message);
    this.name = 'AuditValidationError';
  }
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface AuditService {
  log(params: LogParams): Promise<string>;
  query(
    filter: AuditLogFilter,
    pagination?: AuditLogPagination,
    sort?: AuditLogSort
  ): Promise<AuditLogResponse>;
  getStats(
    workspaceId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<AuditLogStats>;
  requestExport(
    workspaceId: string,
    requestedBy: string,
    filter: AuditLogFilter,
    format: 'json' | 'csv' | 'pdf'
  ): Promise<AuditLogExport>;
  getExport(exportId: string): Promise<AuditLogExport | null>;
  cleanup(): Promise<number>;
  flush(): Promise<void>;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class AuditServiceImpl implements AuditService {
  private prisma: AuditDatabaseClient;
  private redis: AuditRedisClient;
  private retentionDays: number;
  private batchSize: number;
  private batchQueue: Omit<AuditLogEntry, 'id'>[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: AuditServiceConfig) {
    this.prisma = config.prisma;
    this.redis = config.redis;
    this.retentionDays = config.retentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS;
    this.batchSize = config.batchSize ?? DEFAULT_AUDIT_BATCH_SIZE;
  }

  /**
   * Log an audit event
   */
  async log(params: LogParams): Promise<string> {
    const entry: Omit<AuditLogEntry, 'id'> = {
      timestamp: new Date(),
      action: params.action,
      category: this.getCategory(params.action),
      severity: this.getSeverity(params.action),
      actorId: params.actorId,
      actorType: params.actorType,
      actorName: params.actorName,
      actorEmail: params.actorEmail,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceName: params.resourceName,
      workspaceId: params.workspaceId,
      ipAddress: params.context?.ipAddress,
      userAgent: params.context?.userAgent,
      sessionId: params.context?.sessionId,
      changes: params.changes,
      metadata: {
        ...params.metadata,
        requestId: params.context?.requestId,
      },
      success: params.success ?? true,
      errorMessage: params.errorMessage,
    };

    // Add to batch queue
    this.batchQueue.push(entry);

    // Flush if batch is full
    if (this.batchQueue.length >= this.batchSize) {
      await this.flushBatch();
    } else if (!this.batchTimeout) {
      // Set timeout to flush after 5 seconds
      this.batchTimeout = setTimeout(() => this.flushBatch(), 5000);
    }

    // Publish real-time event for critical actions
    if (entry.severity === 'critical') {
      await this.publishCriticalEvent(entry);
    }

    return 'queued';
  }

  /**
   * Flush batch queue to database
   */
  private async flushBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchQueue.length === 0) return;

    const entries = [...this.batchQueue];
    this.batchQueue = [];

    try {
      await this.prisma.auditLog.createMany({
        data: entries.map((entry) => ({
          ...entry,
          changes: entry.changes ? JSON.stringify(entry.changes) : null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        })),
      });
    } catch (error) {
      // Re-queue failed entries
      this.batchQueue.push(...entries);
      throw error;
    }
  }

  /**
   * Query audit logs with filters
   */
  async query(
    filter: AuditLogFilter,
    pagination?: AuditLogPagination,
    sort?: AuditLogSort
  ): Promise<AuditLogResponse> {
    const limit = pagination?.limit ?? DEFAULT_AUDIT_PAGE_SIZE;
    const offset = pagination?.offset ?? 0;
    const orderBy = sort
      ? { [sort.field === 'actor' ? 'actorName' : sort.field]: sort.direction }
      : { timestamp: 'desc' as const };

    const where = this.buildWhereClause(filter);

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      entries: entries.map((e) => this.mapEntry(e)),
      total,
      pagination: {
        hasMore: total > offset + limit,
        nextCursor: total > offset + limit ? String(offset + limit) : undefined,
      },
    };
  }

  /**
   * Build where clause from filter
   */
  private buildWhereClause(filter: AuditLogFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {
      workspaceId: filter.workspaceId,
    };

    if (filter.actions?.length) {
      where.action = { in: filter.actions };
    }

    if (filter.categories?.length) {
      where.category = { in: filter.categories };
    }

    if (filter.severities?.length) {
      where.severity = { in: filter.severities };
    }

    if (filter.actorIds?.length) {
      where.actorId = { in: filter.actorIds };
    }

    if (filter.actorTypes?.length) {
      where.actorType = { in: filter.actorTypes };
    }

    if (filter.resourceTypes?.length) {
      where.resourceType = { in: filter.resourceTypes };
    }

    if (filter.resourceIds?.length) {
      where.resourceId = { in: filter.resourceIds };
    }

    if (filter.dateRange) {
      where.timestamp = {
        gte: filter.dateRange.start,
        lte: filter.dateRange.end,
      };
    }

    if (filter.success !== undefined) {
      where.success = filter.success;
    }

    if (filter.search) {
      where.OR = [
        { actorName: { contains: filter.search, mode: 'insensitive' } },
        { resourceName: { contains: filter.search, mode: 'insensitive' } },
        { action: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  /**
   * Map database entry to typed entry
   */
  private mapEntry(entry: Record<string, unknown>): AuditLogEntry {
    return {
      id: entry.id as string,
      timestamp: entry.timestamp as Date,
      action: entry.action as AuditAction,
      category: entry.category as AuditCategory,
      severity: entry.severity as AuditSeverity,
      actorId: entry.actorId as string,
      actorType: entry.actorType as 'user' | 'vp' | 'system' | 'api',
      actorName: entry.actorName as string,
      actorEmail: entry.actorEmail as string | undefined,
      resourceType: entry.resourceType as string,
      resourceId: entry.resourceId as string,
      resourceName: entry.resourceName as string | undefined,
      workspaceId: entry.workspaceId as string,
      ipAddress: entry.ipAddress as string | undefined,
      userAgent: entry.userAgent as string | undefined,
      sessionId: entry.sessionId as string | undefined,
      changes: entry.changes ? JSON.parse(entry.changes as string) : undefined,
      metadata: entry.metadata ? JSON.parse(entry.metadata as string) : undefined,
      success: entry.success as boolean,
      errorMessage: entry.errorMessage as string | undefined,
    };
  }

  /**
   * Get statistics for audit logs
   */
  async getStats(
    workspaceId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<AuditLogStats> {
    const where: Record<string, unknown> = { workspaceId };
    if (dateRange) {
      where.timestamp = { gte: dateRange.start, lte: dateRange.end };
    }

    const [totalEntries, byCategory, bySeverity, byAction, byActor, timeline] =
      await Promise.all([
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.groupBy({
          by: ['category'],
          where,
          _count: true,
        }),
        this.prisma.auditLog.groupBy({
          by: ['severity'],
          where,
          _count: true,
        }),
        this.prisma.auditLog.groupBy({
          by: ['action'],
          where,
          _count: true,
          orderBy: { _count: { action: 'desc' } },
          take: 10,
        }),
        this.prisma.auditLog.groupBy({
          by: ['actorId', 'actorName'],
          where,
          _count: true,
          orderBy: { _count: { actorId: 'desc' } },
          take: 10,
        }),
        this.getTimeline(workspaceId, dateRange),
      ]);

    return {
      totalEntries,
      byCategory: Object.fromEntries(
        byCategory.map((c: Record<string, unknown>) => [c.category, c._count])
      ) as Record<AuditCategory, number>,
      bySeverity: Object.fromEntries(
        bySeverity.map((s: Record<string, unknown>) => [s.severity, s._count])
      ) as Record<AuditSeverity, number>,
      byAction: Object.fromEntries(
        byAction.map((a: Record<string, unknown>) => [a.action, a._count])
      ),
      byActor: byActor.map((a: Record<string, unknown>) => ({
        actorId: a.actorId as string,
        actorName: a.actorName as string,
        count: a._count as number,
      })),
      timeline,
    };
  }

  /**
   * Get timeline data for charts
   */
  private async getTimeline(
    workspaceId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<Array<{ date: string; count: number }>> {
    const start =
      dateRange?.start ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = dateRange?.end ?? new Date();

    const results = await this.prisma.$queryRaw<
      Array<{ date: string; count: bigint }>
    >`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM "AuditLog"
      WHERE "workspaceId" = ${workspaceId}
        AND timestamp >= ${start}
        AND timestamp <= ${end}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;

    return results.map((r) => ({
      date: r.date,
      count: Number(r.count),
    }));
  }

  /**
   * Request an export of audit logs
   */
  async requestExport(
    workspaceId: string,
    requestedBy: string,
    filter: AuditLogFilter,
    format: 'json' | 'csv' | 'pdf'
  ): Promise<AuditLogExport> {
    const exportRecord = await this.prisma.auditLogExport.create({
      data: {
        workspaceId,
        requestedBy,
        filter: JSON.stringify(filter),
        format,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Queue export job
    await this.redis.lpush('audit:export:queue', exportRecord.id as string);

    // Log the export request
    await this.log({
      action: 'export.requested',
      actorId: requestedBy,
      actorType: 'user',
      actorName: 'User',
      resourceType: 'audit_export',
      resourceId: exportRecord.id as string,
      workspaceId,
      metadata: { format, filter },
    });

    return {
      id: exportRecord.id as string,
      workspaceId,
      requestedBy,
      filter,
      format,
      status: 'pending',
      createdAt: exportRecord.createdAt as Date,
      expiresAt: (exportRecord.expiresAt as Date | null) ?? undefined,
    };
  }

  /**
   * Get export status
   */
  async getExport(exportId: string): Promise<AuditLogExport | null> {
    const record = await this.prisma.auditLogExport.findUnique({
      where: { id: exportId },
    });

    if (!record) return null;

    return {
      id: record.id as string,
      workspaceId: record.workspaceId as string,
      requestedBy: record.requestedBy as string,
      filter: JSON.parse(record.filter as string),
      format: record.format as 'json' | 'csv' | 'pdf',
      status: record.status as 'pending' | 'processing' | 'completed' | 'failed',
      fileUrl: (record.fileUrl as string | null) ?? undefined,
      fileSize: (record.fileSize as number | null) ?? undefined,
      entryCount: (record.entryCount as number | null) ?? undefined,
      createdAt: record.createdAt as Date,
      completedAt: (record.completedAt as Date | null) ?? undefined,
      expiresAt: (record.expiresAt as Date | null) ?? undefined,
      error: (record.error as string | null) ?? undefined,
    };
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanup(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Get category for action
   */
  private getCategory(action: AuditAction): AuditCategory {
    if (action.startsWith('user.login') || action.startsWith('user.logout')) {
      return 'authentication';
    }
    if (action.includes('permission') || action.includes('role')) {
      return 'authorization';
    }
    if (action.includes('downloaded') || action.includes('export')) {
      return 'data_access';
    }
    if (
      action.includes('created') ||
      action.includes('updated') ||
      action.includes('deleted')
    ) {
      return 'data_modification';
    }
    if (action.includes('settings') || action.includes('integration')) {
      return 'system_configuration';
    }
    if (
      action.includes('mfa') ||
      action.includes('password') ||
      action.includes('api_key')
    ) {
      return 'security';
    }
    return 'compliance';
  }

  /**
   * Get severity for action
   */
  private getSeverity(action: AuditAction): AuditSeverity {
    if (CRITICAL_ACTIONS.includes(action)) return 'critical';
    if (WARNING_ACTIONS.includes(action)) return 'warning';
    return 'info';
  }

  /**
   * Publish critical event for real-time alerting
   */
  private async publishCriticalEvent(
    entry: Omit<AuditLogEntry, 'id'>
  ): Promise<void> {
    await this.redis.publish(
      `audit:critical:${entry.workspaceId}`,
      JSON.stringify(entry)
    );
  }

  /**
   * Force flush any pending batch entries
   */
  async flush(): Promise<void> {
    await this.flushBatch();
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an audit service instance
 */
export function createAuditService(config: AuditServiceConfig): AuditService {
  return new AuditServiceImpl(config);
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let auditServiceInstance: AuditService | null = null;

/**
 * Get the singleton audit service instance
 */
export function getAuditService(): AuditService {
  if (!auditServiceInstance) {
    throw new AuditError(
      'Audit service not initialized. Call createAuditService first.'
    );
  }
  return auditServiceInstance;
}

/**
 * Initialize the singleton audit service
 */
export function initAuditService(config: AuditServiceConfig): AuditService {
  auditServiceInstance = createAuditService(config);
  return auditServiceInstance;
}

/**
 * Default audit service export (requires initialization)
 */
export const auditService = {
  get instance(): AuditService {
    return getAuditService();
  },
};
