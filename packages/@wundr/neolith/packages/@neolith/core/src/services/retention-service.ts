/**
 * @fileoverview Data retention service for compliance management
 *
 * Provides enterprise-grade data retention capabilities including:
 * - Retention policy management
 * - Automated data retention jobs
 * - Legal hold support
 * - Data export for compliance
 *
 * @packageDocumentation
 */

import { GenesisError } from '../errors';

import type {
  RetentionPolicy,
  RetentionRule,
  RetentionJob,
  RetentionJobStatus,
  RetentionResourceType,
  RetentionAction,
  RetentionStats,
  RetentionError,
  LegalHold,
  DataExport,
  DataExportScope,
} from '../types/retention';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when a retention policy is not found.
 */
export class RetentionPolicyNotFoundError extends GenesisError {
  constructor(policyId: string) {
    super(
      `Retention policy not found: ${policyId}`,
      'RETENTION_POLICY_NOT_FOUND',
      404,
      { policyId }
    );
    this.name = 'RetentionPolicyNotFoundError';
  }
}

/**
 * Error thrown when a legal hold is not found.
 */
export class LegalHoldNotFoundError extends GenesisError {
  constructor(holdId: string) {
    super(`Legal hold not found: ${holdId}`, 'LEGAL_HOLD_NOT_FOUND', 404, {
      holdId,
    });
    this.name = 'LegalHoldNotFoundError';
  }
}

/**
 * Error thrown when a retention job fails.
 */
export class RetentionJobError extends GenesisError {
  constructor(message: string, jobId?: string) {
    super(message, 'RETENTION_JOB_ERROR', 500, { jobId });
    this.name = 'RetentionJobError';
  }
}

/**
 * Error thrown when a data export is not found.
 */
export class DataExportNotFoundError extends GenesisError {
  constructor(exportId: string) {
    super(`Data export not found: ${exportId}`, 'DATA_EXPORT_NOT_FOUND', 404, {
      exportId,
    });
    this.name = 'DataExportNotFoundError';
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Redis client interface for queue operations.
 */
export interface RedisClient {
  lpush(key: string, value: string): Promise<number>;
  rpop(key: string): Promise<string | null>;
  llen(key: string): Promise<number>;
}

/**
 * Database record type for retention policy storage.
 */
export interface RetentionPolicyRecord {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isEnabled: boolean;
  rules: string; // JSON string of RetentionRule[]
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Database record type for retention job storage.
 */
export interface RetentionJobRecord {
  id: string;
  workspaceId: string;
  policyId: string;
  status: string;
  resourceType: string;
  action: string;
  itemsProcessed: number;
  itemsTotal: number;
  itemsFailed: number;
  errors: string; // JSON string of RetentionError[]
  startedAt: Date;
  completedAt?: Date | null;
  scheduledAt?: Date | null;
}

/**
 * Database record type for legal hold storage.
 */
export interface LegalHoldRecord {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  scope: string; // JSON string of LegalHoldScope
  createdBy: string;
  createdAt: Date;
  releasedAt?: Date | null;
  releasedBy?: string | null;
}

/**
 * Database record type for data export storage.
 */
export interface DataExportRecord {
  id: string;
  workspaceId: string;
  requestedBy: string;
  type: string;
  scope: string; // JSON string of DataExportScope
  status: string;
  format: string;
  fileUrl?: string | null;
  fileSize?: number | null;
  createdAt: Date;
  completedAt?: Date | null;
  expiresAt?: Date | null;
  error?: string | null;
}

/**
 * Database record for items subject to retention.
 */
export interface RetentionItemRecord {
  id: string;
  createdAt: Date;
  senderId?: string | null;
  userId?: string | null;
  channelId?: string | null;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  archivedAt?: Date | null;
  anonymizedAt?: Date | null;
  isArchived?: boolean;
  content?: string | null;
  fileSize?: number | null;
}

/**
 * Generic database model interface for retention operations.
 * This allows the service to work with any Prisma-compatible database client.
 *
 * @typeParam T - The record type for this model
 */
export interface RetentionDatabaseModel<T = RetentionItemRecord> {
  /** Find a single record by ID */
  findUnique(args: { where: { id: string } }): Promise<T | null>;
  /** Find multiple records matching criteria */
  findMany(args: Record<string, unknown>): Promise<T[]>;
  /** Find the first record matching criteria */
  findFirst(args: Record<string, unknown>): Promise<T | null>;
  /** Create a new record */
  create(args: { data: Record<string, unknown> }): Promise<T>;
  /** Update an existing record */
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<T>;
  /** Delete a record */
  delete(args: { where: { id: string } }): Promise<T>;
  /** Count records matching criteria */
  count(args?: Record<string, unknown>): Promise<number>;
  /** Perform aggregation queries */
  aggregate?(args: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/**
 * Aggregation result for file size calculations.
 */
export interface FileSizeAggregateResult {
  _sum: {
    fileSize: number | null;
  };
}

/**
 * Database client interface for retention service.
 * This interface defines the required models for the retention service.
 */
export interface RetentionDatabaseClient {
  /** Model for retention policy records */
  retentionPolicy: RetentionDatabaseModel<RetentionPolicyRecord>;
  /** Model for retention job records */
  retentionJob: RetentionDatabaseModel<RetentionJobRecord>;
  /** Model for legal hold records */
  legalHold: RetentionDatabaseModel<LegalHoldRecord>;
  /** Model for data export records */
  dataExport: RetentionDatabaseModel<DataExportRecord>;
  /** Model for message records */
  message: RetentionDatabaseModel<RetentionItemRecord>;
  /** Model for attachment/file records with aggregation support */
  attachment: RetentionDatabaseModel<RetentionItemRecord> & {
    aggregate: (
      args: Record<string, unknown>
    ) => Promise<FileSizeAggregateResult>;
  };
  /** Model for channel records */
  channel: RetentionDatabaseModel<RetentionItemRecord>;
}

/**
 * Configuration for the retention service.
 */
export interface RetentionServiceConfig {
  prisma: RetentionDatabaseClient;
  redis: RedisClient;
  defaultRetentionDays?: number;
  batchSize?: number;
}

/**
 * Result of processing a retention rule.
 */
interface RuleProcessingResult {
  processed: number;
  failed: number;
  errors: RetentionError[];
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Data retention service for managing compliance-related data lifecycle.
 *
 * @example
 * ```typescript
 * const retentionService = new RetentionService({
 *   prisma,
 *   redis,
 *   batchSize: 500,
 * });
 *
 * // Create a retention policy
 * const policy = await retentionService.createPolicy(
 *   'workspace-id',
 *   'Message Retention',
 *   [{ resourceType: 'message', action: 'delete', retentionDays: 90, priority: 1 }],
 *   'admin-user-id'
 * );
 *
 * // Run retention job
 * const job = await retentionService.runRetentionJob(policy.id);
 * ```
 */
export class RetentionService {
  private prisma: RetentionDatabaseClient;
  private redis: RedisClient;
  private readonly _defaultRetentionDays: number;
  private batchSize: number;

  constructor(config: RetentionServiceConfig) {
    this.prisma = config.prisma;
    this.redis = config.redis;
    this._defaultRetentionDays = config.defaultRetentionDays ?? 365;
    this.batchSize = config.batchSize ?? 1000;
  }

  /** Get the default retention period in days */
  get defaultRetentionDays(): number {
    return this._defaultRetentionDays;
  }

  // ===========================================================================
  // Policy Management
  // ===========================================================================

  /**
   * Create a retention policy.
   *
   * @param workspaceId - The workspace ID
   * @param name - Policy name
   * @param rules - Retention rules
   * @param createdBy - User ID who created the policy
   * @param description - Optional policy description
   * @returns The created retention policy
   */
  async createPolicy(
    workspaceId: string,
    name: string,
    rules: Omit<RetentionRule, 'id'>[],
    createdBy: string,
    description?: string
  ): Promise<RetentionPolicy> {
    const rulesWithIds = rules.map((r, i) => ({
      ...r,
      id: `rule-${Date.now()}-${i}`,
    }));

    const policy = await this.prisma.retentionPolicy.create({
      data: {
        workspaceId,
        name,
        description,
        isDefault: false,
        isEnabled: true,
        rules: JSON.stringify(rulesWithIds),
        createdBy,
      },
    });

    return this.mapPolicy(policy);
  }

  /**
   * Update a retention policy.
   *
   * @param policyId - The policy ID to update
   * @param updates - Fields to update
   * @returns The updated retention policy
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<
      Pick<RetentionPolicy, 'name' | 'description' | 'isEnabled' | 'rules'>
    >
  ): Promise<RetentionPolicy> {
    const data: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      data.name = updates.name;
    }
    if (updates.description !== undefined) {
      data.description = updates.description;
    }
    if (updates.isEnabled !== undefined) {
      data.isEnabled = updates.isEnabled;
    }
    if (updates.rules !== undefined) {
      data.rules = JSON.stringify(updates.rules);
    }

    const policy = await this.prisma.retentionPolicy.update({
      where: { id: policyId },
      data,
    });

    return this.mapPolicy(policy);
  }

  /**
   * Get a retention policy by ID.
   *
   * @param policyId - The policy ID
   * @returns The retention policy or null if not found
   */
  async getPolicy(policyId: string): Promise<RetentionPolicy | null> {
    const policy = await this.prisma.retentionPolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      return null;
    }
    return this.mapPolicy(policy);
  }

  /**
   * Get retention policies for workspace.
   *
   * @param workspaceId - The workspace ID
   * @returns Array of retention policies
   */
  async getPolicies(workspaceId: string): Promise<RetentionPolicy[]> {
    const policies = await this.prisma.retentionPolicy.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return policies.map(p => this.mapPolicy(p));
  }

  /**
   * Delete a retention policy.
   *
   * @param policyId - The policy ID to delete
   */
  async deletePolicy(policyId: string): Promise<void> {
    await this.prisma.retentionPolicy.delete({
      where: { id: policyId },
    });
  }

  /**
   * Map database policy record to typed retention policy.
   *
   * @param policy - The database policy record
   * @returns The typed retention policy
   */
  private mapPolicy(policy: RetentionPolicyRecord): RetentionPolicy {
    return {
      id: policy.id,
      workspaceId: policy.workspaceId,
      name: policy.name,
      description: policy.description ?? undefined,
      isDefault: policy.isDefault,
      isEnabled: policy.isEnabled,
      rules: JSON.parse(policy.rules) as RetentionRule[],
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
      createdBy: policy.createdBy,
    };
  }

  // ===========================================================================
  // Retention Job Execution
  // ===========================================================================

  /**
   * Run retention job for a policy.
   *
   * @param policyId - The policy ID to execute
   * @returns The completed retention job
   */
  async runRetentionJob(policyId: string): Promise<RetentionJob> {
    const policy = await this.prisma.retentionPolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      throw new RetentionPolicyNotFoundError(policyId);
    }

    const rules: RetentionRule[] = JSON.parse(policy.rules as string);
    const workspaceId = policy.workspaceId as string;

    // Check for legal holds
    const activeHolds = await this.getActiveLegalHolds(workspaceId);

    // Create job record
    const job = await this.prisma.retentionJob.create({
      data: {
        workspaceId,
        policyId,
        status: 'running',
        resourceType: rules[0]?.resourceType ?? 'message',
        action: rules[0]?.action ?? 'delete',
        itemsProcessed: 0,
        itemsTotal: 0,
        itemsFailed: 0,
        errors: '[]',
        startedAt: new Date(),
      },
    });

    // Process each rule
    let totalProcessed = 0;
    let totalFailed = 0;
    const errors: RetentionError[] = [];

    for (const rule of rules) {
      try {
        const result = await this.processRule(
          workspaceId,
          rule,
          activeHolds,
          job.id as string
        );
        totalProcessed += result.processed;
        totalFailed += result.failed;
        errors.push(...result.errors);
      } catch (error) {
        errors.push({
          resourceId: 'rule',
          resourceType: rule.resourceType,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    // Update job record
    const updatedJob = await this.prisma.retentionJob.update({
      where: { id: job.id as string },
      data: {
        status: 'completed' as RetentionJobStatus,
        itemsProcessed: totalProcessed,
        itemsFailed: totalFailed,
        errors: JSON.stringify(errors),
        completedAt: new Date(),
      },
    });

    return this.mapJob(updatedJob);
  }

  /**
   * Process a single retention rule.
   */
  private async processRule(
    workspaceId: string,
    rule: RetentionRule,
    legalHolds: LegalHold[],
    jobId: string
  ): Promise<RuleProcessingResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - rule.retentionDays);

    let processed = 0;
    let failed = 0;
    const errors: RetentionError[] = [];

    // Get items to process in batches
    let hasMore = true;
    let cursor: string | undefined;

    while (hasMore) {
      const items = await this.getItemsForRetention(
        workspaceId,
        rule.resourceType,
        cutoffDate,
        this.batchSize,
        cursor
      );

      if (items.length === 0) {
        hasMore = false;
        continue;
      }

      // Filter out items under legal hold
      const eligibleItems = items.filter(
        item => !this.isUnderLegalHold(item, legalHolds)
      );

      // Process each item
      for (const item of eligibleItems) {
        try {
          await this.processItem(item, rule.action, rule.resourceType);
          processed++;
        } catch (error) {
          failed++;
          errors.push({
            resourceId: item.id,
            resourceType: rule.resourceType,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
        }
      }

      cursor = items[items.length - 1]?.id;
      hasMore = items.length === this.batchSize;

      // Update job progress
      await this.prisma.retentionJob.update({
        where: { id: jobId },
        data: { itemsProcessed: processed },
      });
    }

    return { processed, failed, errors };
  }

  /**
   * Get items eligible for retention action.
   */
  private async getItemsForRetention(
    workspaceId: string,
    resourceType: RetentionResourceType,
    cutoffDate: Date,
    limit: number,
    cursor?: string
  ): Promise<Array<{ id: string; createdAt: Date; [key: string]: unknown }>> {
    const cursorCondition = cursor ? { id: { gt: cursor } } : {};

    switch (resourceType) {
      case 'message': {
        const messages = await this.prisma.message.findMany({
          where: {
            createdAt: { lt: cutoffDate },
            channel: { workspaceId },
            isDeleted: false,
            ...cursorCondition,
          },
          take: limit,
          orderBy: { id: 'asc' },
        });
        return messages as Array<{ id: string; createdAt: Date }>;
      }

      case 'file': {
        const files = await this.prisma.attachment.findMany({
          where: {
            createdAt: { lt: cutoffDate },
            message: { channel: { workspaceId } },
            ...cursorCondition,
          },
          take: limit,
          orderBy: { id: 'asc' },
        });
        return files as Array<{ id: string; createdAt: Date }>;
      }

      case 'channel': {
        const channels = await this.prisma.channel.findMany({
          where: {
            createdAt: { lt: cutoffDate },
            workspaceId,
            isArchived: true,
            ...cursorCondition,
          },
          take: limit,
          orderBy: { id: 'asc' },
        });
        return channels as Array<{ id: string; createdAt: Date }>;
      }

      default:
        return [];
    }
  }

  /**
   * Process a single item based on action.
   */
  private async processItem(
    item: { id: string; [key: string]: unknown },
    action: RetentionAction,
    resourceType: RetentionResourceType
  ): Promise<void> {
    switch (action) {
      case 'delete':
        await this.deleteItem(item, resourceType);
        break;

      case 'archive':
        await this.archiveItem(item, resourceType);
        break;

      case 'anonymize':
        await this.anonymizeItem(item, resourceType);
        break;
    }
  }

  /**
   * Delete an item.
   */
  private async deleteItem(
    item: { id: string; [key: string]: unknown },
    resourceType: RetentionResourceType
  ): Promise<void> {
    switch (resourceType) {
      case 'message':
        await this.prisma.message.update({
          where: { id: item.id },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
          },
        });
        break;

      case 'file':
        await this.prisma.attachment.update({
          where: { id: item.id },
          data: { deletedAt: new Date() },
        });
        break;

      case 'channel':
        await this.prisma.channel.update({
          where: { id: item.id },
          data: { deletedAt: new Date() },
        });
        break;
    }
  }

  /**
   * Archive an item.
   */
  private async archiveItem(
    item: { id: string; [key: string]: unknown },
    resourceType: RetentionResourceType
  ): Promise<void> {
    switch (resourceType) {
      case 'message':
        await this.prisma.message.update({
          where: { id: item.id },
          data: { archivedAt: new Date() },
        });
        break;

      case 'channel':
        await this.prisma.channel.update({
          where: { id: item.id },
          data: {
            isArchived: true,
            archivedAt: new Date(),
          },
        });
        break;
    }
  }

  /**
   * Anonymize an item.
   */
  private async anonymizeItem(
    item: { id: string; [key: string]: unknown },
    resourceType: RetentionResourceType
  ): Promise<void> {
    switch (resourceType) {
      case 'message':
        await this.prisma.message.update({
          where: { id: item.id },
          data: {
            content: '[Content removed due to retention policy]',
            userId: null,
            anonymizedAt: new Date(),
          },
        });
        break;
    }
  }

  /**
   * Check if item is under legal hold.
   */
  private isUnderLegalHold(
    item: { id: string; createdAt: Date; [key: string]: unknown },
    holds: LegalHold[]
  ): boolean {
    for (const hold of holds) {
      if (!hold.isActive) {
        continue;
      }

      // Check date range
      if (hold.scope.dateRange) {
        const itemDate = item.createdAt;
        if (
          itemDate >= hold.scope.dateRange.start &&
          itemDate <= hold.scope.dateRange.end
        ) {
          return true;
        }
      }

      // Check user IDs
      if (hold.scope.userIds?.length) {
        const senderId = item.senderId as string | undefined;
        const userId = item.userId as string | undefined;
        const itemUserId = senderId ?? userId;
        if (itemUserId && hold.scope.userIds.includes(itemUserId)) {
          return true;
        }
      }

      // Check channel IDs
      if (hold.scope.channelIds?.length) {
        const channelId = item.channelId as string | undefined;
        if (channelId && hold.scope.channelIds.includes(channelId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Map database job record to typed retention job.
   *
   * @param job - The database job record
   * @returns The typed retention job
   */
  private mapJob(job: RetentionJobRecord): RetentionJob {
    return {
      id: job.id,
      workspaceId: job.workspaceId,
      policyId: job.policyId,
      status: job.status as RetentionJobStatus,
      resourceType: job.resourceType as RetentionResourceType,
      action: job.action as RetentionAction,
      itemsProcessed: job.itemsProcessed,
      itemsTotal: job.itemsTotal,
      itemsFailed: job.itemsFailed,
      errors: JSON.parse(job.errors) as RetentionError[],
      startedAt: job.startedAt,
      completedAt: job.completedAt ?? undefined,
      scheduledAt: job.scheduledAt ?? undefined,
    };
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get retention statistics for a workspace.
   *
   * @param workspaceId - The workspace ID
   * @returns Retention statistics
   */
  async getStats(workspaceId: string): Promise<RetentionStats> {
    const [
      messageCount,
      fileCount,
      channelCount,
      storageStats,
      pendingDeletions,
      lastJob,
    ] = await Promise.all([
      this.prisma.message.count({
        where: { channel: { workspaceId } },
      }),
      this.prisma.attachment.count({
        where: { message: { channel: { workspaceId } } },
      }),
      this.prisma.channel.count({
        where: { workspaceId },
      }),
      this.getStorageStats(workspaceId),
      this.prisma.message.count({
        where: {
          channel: { workspaceId },
          isDeleted: true,
          deletedAt: { not: null },
        },
      }),
      this.prisma.retentionJob.findFirst({
        where: { workspaceId },
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    return {
      workspaceId,
      totalStorageBytes: storageStats.total,
      storageByType: {
        message: storageStats.messages,
        file: storageStats.files,
        channel: 0,
        thread: 0,
        reaction: 0,
        call_recording: 0,
        audit_log: 0,
        vp_conversation: 0,
      },
      itemCounts: {
        message: messageCount,
        file: fileCount,
        channel: channelCount,
        thread: 0,
        reaction: 0,
        call_recording: 0,
        audit_log: 0,
        vp_conversation: 0,
      },
      oldestItem: {
        message: null,
        file: null,
        channel: null,
        thread: null,
        reaction: null,
        call_recording: null,
        audit_log: null,
        vp_conversation: null,
      },
      pendingDeletions,
      lastJobRun: (lastJob?.completedAt as Date | undefined) ?? undefined,
    };
  }

  /**
   * Get storage statistics for a workspace.
   *
   * @param workspaceId - The workspace ID
   * @returns Storage statistics including total, message, and file storage in bytes
   */
  private async getStorageStats(workspaceId: string): Promise<{
    total: number;
    messages: number;
    files: number;
  }> {
    const fileStats = (await this.prisma.attachment.aggregate({
      where: { message: { channel: { workspaceId } } },
      _sum: { fileSize: true },
    })) as { _sum: { fileSize: number | null } };

    const fileSize = Number(fileStats._sum?.fileSize ?? 0);

    return {
      total: fileSize,
      messages: 0, // Text storage would require content length calculation
      files: fileSize,
    };
  }

  // ===========================================================================
  // Legal Holds
  // ===========================================================================

  /**
   * Get active legal holds for workspace.
   *
   * @param workspaceId - The workspace ID
   * @returns Array of active legal holds
   */
  async getActiveLegalHolds(workspaceId: string): Promise<LegalHold[]> {
    const holds = await this.prisma.legalHold.findMany({
      where: {
        workspaceId,
        isActive: true,
      },
    });

    return holds.map(hold => this.mapLegalHold(hold));
  }

  /**
   * Get all legal holds for workspace.
   *
   * @param workspaceId - The workspace ID
   * @returns Array of all legal holds
   */
  async getLegalHolds(workspaceId: string): Promise<LegalHold[]> {
    const holds = await this.prisma.legalHold.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return holds.map(hold => this.mapLegalHold(hold));
  }

  /**
   * Create a legal hold.
   *
   * @param workspaceId - The workspace ID
   * @param name - Legal hold name
   * @param scope - Scope of the legal hold
   * @param createdBy - User ID who created the hold
   * @param description - Optional description
   * @returns The created legal hold
   */
  async createLegalHold(
    workspaceId: string,
    name: string,
    scope: LegalHold['scope'],
    createdBy: string,
    description?: string
  ): Promise<LegalHold> {
    const hold = await this.prisma.legalHold.create({
      data: {
        workspaceId,
        name,
        description,
        isActive: true,
        scope: JSON.stringify(scope),
        createdBy,
      },
    });

    return this.mapLegalHold(hold);
  }

  /**
   * Release a legal hold.
   *
   * @param holdId - The legal hold ID
   * @param releasedBy - User ID who released the hold
   * @returns The released legal hold
   */
  async releaseLegalHold(
    holdId: string,
    releasedBy: string
  ): Promise<LegalHold> {
    const hold = await this.prisma.legalHold.update({
      where: { id: holdId },
      data: {
        isActive: false,
        releasedAt: new Date(),
        releasedBy,
      },
    });

    return this.mapLegalHold(hold);
  }

  /**
   * Map database legal hold record to typed legal hold.
   *
   * @param hold - The database legal hold record
   * @returns The typed legal hold
   */
  private mapLegalHold(hold: LegalHoldRecord): LegalHold {
    return {
      id: hold.id,
      workspaceId: hold.workspaceId,
      name: hold.name,
      description: hold.description ?? undefined,
      isActive: hold.isActive,
      scope: JSON.parse(hold.scope) as LegalHold['scope'],
      createdBy: hold.createdBy,
      createdAt: hold.createdAt,
      releasedAt: hold.releasedAt ?? undefined,
      releasedBy: hold.releasedBy ?? undefined,
    };
  }

  // ===========================================================================
  // Data Export
  // ===========================================================================

  /**
   * Request data export.
   *
   * @param workspaceId - The workspace ID
   * @param requestedBy - User ID requesting the export
   * @param type - Type of export
   * @param scope - Scope of data to export
   * @param format - Export format
   * @returns The data export record
   */
  async requestExport(
    workspaceId: string,
    requestedBy: string,
    type: DataExport['type'],
    scope: DataExportScope,
    format: 'json' | 'zip'
  ): Promise<DataExport> {
    const exportRecord = await this.prisma.dataExport.create({
      data: {
        workspaceId,
        requestedBy,
        type,
        scope: JSON.stringify(scope),
        format,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Queue export job
    await this.redis.lpush('retention:export:queue', exportRecord.id as string);

    return this.mapDataExport(exportRecord);
  }

  /**
   * Get export status.
   *
   * @param exportId - The export ID
   * @returns The data export record or null
   */
  async getExport(exportId: string): Promise<DataExport | null> {
    const record = await this.prisma.dataExport.findUnique({
      where: { id: exportId },
    });

    if (!record) {
      return null;
    }
    return this.mapDataExport(record);
  }

  /**
   * Get all exports for a workspace.
   *
   * @param workspaceId - The workspace ID
   * @returns Array of data exports
   */
  async getExports(workspaceId: string): Promise<DataExport[]> {
    const records = await this.prisma.dataExport.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(r => this.mapDataExport(r));
  }

  /**
   * Map database data export record to typed data export.
   *
   * @param record - The database data export record
   * @returns The typed data export
   */
  private mapDataExport(record: DataExportRecord): DataExport {
    return {
      id: record.id,
      workspaceId: record.workspaceId,
      requestedBy: record.requestedBy,
      type: record.type as DataExport['type'],
      scope: JSON.parse(record.scope) as DataExportScope,
      status: record.status as DataExport['status'],
      format: record.format as 'json' | 'zip',
      fileUrl: record.fileUrl ?? undefined,
      fileSize: record.fileSize ?? undefined,
      createdAt: record.createdAt,
      completedAt: record.completedAt ?? undefined,
      expiresAt: record.expiresAt ?? undefined,
      error: record.error ?? undefined,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new retention service instance.
 *
 * @param config - Service configuration
 * @returns RetentionService instance
 */
export function createRetentionService(
  config: RetentionServiceConfig
): RetentionService {
  return new RetentionService(config);
}
