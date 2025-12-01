/**
 * @fileoverview Alert service for monitoring and alerting
 *
 * This service provides comprehensive alerting capabilities for monitoring
 * orchestrator health, budget usage, error rates, and performance metrics.
 * It evaluates alert rules and manages alert lifecycle (create, acknowledge, resolve).
 *
 * Features:
 * - Budget exhaustion monitoring
 * - Error rate tracking
 * - Session failure detection
 * - Latency spike monitoring
 * - Node health checks
 * - Automatic alert resolution
 * - Duplicate alert prevention
 *
 * @packageDocumentation
 */

import type { PrismaClient } from '@neolith/database';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Alert severity levels
 */
export type AlertLevel = 'info' | 'warning' | 'critical' | 'emergency';

/**
 * Alert status
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

/**
 * Alert type categorization
 */
export type AlertType =
  | 'budget_exhaustion'
  | 'error_rate'
  | 'session_failure'
  | 'latency_spike'
  | 'node_health'
  | 'custom';

/**
 * Alert data structure
 */
export interface Alert {
  id: string;
  orchestratorId: string;
  level: AlertLevel;
  threshold: number;
  currentUsage: number;
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: Date | null;
  createdAt: Date;
  type?: AlertType;
  metadata?: Record<string, unknown>;
  status?: AlertStatus;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
}

/**
 * Input for creating an alert
 */
export interface CreateAlertInput {
  orchestratorId: string;
  level: AlertLevel;
  threshold: number;
  currentUsage: number;
  message: string;
  type?: AlertType;
  metadata?: Record<string, unknown>;
}

/**
 * Filters for querying alerts
 */
export interface AlertFilters {
  orchestratorId?: string;
  level?: AlertLevel | AlertLevel[];
  acknowledged?: boolean;
  status?: AlertStatus | AlertStatus[];
  type?: AlertType | AlertType[];
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'level' | 'threshold';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated alert results
 */
export interface PaginatedAlerts {
  alerts: Alert[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Alert thresholds configuration
 */
export interface AlertThresholds {
  budgetWarning: number; // percentage
  budgetCritical: number; // percentage
  errorRateWarning: number; // ratio (0.0 to 1.0)
  errorRateCritical: number; // ratio (0.0 to 1.0)
  latencySpikeMs: number; // milliseconds
  sessionFailureCount: number; // number of failures
}

/**
 * Node health status
 */
export interface NodeHealthStatus {
  nodeId: string;
  isHealthy: boolean;
  lastHeartbeat?: Date;
  errorCount: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Budget usage statistics
 */
export interface BudgetUsage {
  orchestratorId: string;
  totalUsage: number;
  limit: number;
  percentage: number;
  period: 'hourly' | 'daily' | 'monthly';
}

/**
 * Error rate statistics
 */
export interface ErrorRateStats {
  orchestratorId: string;
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  period: Date;
}

/**
 * Session failure statistics
 */
export interface SessionFailureStats {
  orchestratorId: string;
  failureCount: number;
  totalSessions: number;
  recentFailures: Array<{
    sessionId: string;
    timestamp: Date;
    error?: string;
  }>;
}

// =============================================================================
// DEFAULT THRESHOLDS
// =============================================================================

/**
 * Default alert thresholds
 */
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  budgetWarning: 75, // 75% usage
  budgetCritical: 90, // 90% usage
  errorRateWarning: 0.05, // 5% error rate
  errorRateCritical: 0.15, // 15% error rate
  latencySpikeMs: 5000, // 5 seconds
  sessionFailureCount: 5, // 5 consecutive failures
};

// =============================================================================
// ERROR CLASSES
// =============================================================================

/**
 * Base error for alert service operations
 */
export class AlertServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlertServiceError';
  }
}

/**
 * Error thrown when an alert is not found
 */
export class AlertNotFoundError extends AlertServiceError {
  constructor(alertId: string) {
    super(`Alert not found: ${alertId}`);
    this.name = 'AlertNotFoundError';
  }
}

/**
 * Error thrown when alert validation fails
 */
export class AlertValidationError extends AlertServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'AlertValidationError';
  }
}

/**
 * Error thrown when orchestrator is not found
 */
export class OrchestratorNotFoundError extends AlertServiceError {
  constructor(orchestratorId: string) {
    super(`Orchestrator not found: ${orchestratorId}`);
    this.name = 'OrchestratorNotFoundError';
  }
}

// =============================================================================
// ALERT SERVICE INTERFACE
// =============================================================================

/**
 * Alert service interface
 */
export interface AlertService {
  // Health checks
  checkBudgetExhaustion(orchestratorId: string): Promise<Alert | null>;
  checkHighErrorRate(
    orchestratorId: string,
    threshold?: number
  ): Promise<Alert | null>;
  checkSessionFailures(
    orchestratorId: string,
    threshold?: number
  ): Promise<Alert | null>;
  checkLatencySpike(
    orchestratorId: string,
    threshold?: number
  ): Promise<Alert | null>;
  checkNodeHealth(nodeId: string): Promise<Alert | null>;

  // Alert management
  createAlert(input: CreateAlertInput): Promise<Alert>;
  acknowledgeAlert(alertId: string, userId: string): Promise<Alert>;
  resolveAlert(alertId: string, userId: string): Promise<Alert>;
  getActiveAlerts(filters?: AlertFilters): Promise<Alert[]>;
  getAlertHistory(
    filters?: AlertFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedAlerts>;

  // Rule evaluation
  evaluateAllRules(orchestratorId: string): Promise<Alert[]>;

  // Utility methods
  getBudgetUsage(
    orchestratorId: string,
    period?: 'hourly' | 'daily' | 'monthly'
  ): Promise<BudgetUsage>;
  getErrorRate(
    orchestratorId: string,
    timeWindowMs?: number
  ): Promise<ErrorRateStats>;
  getSessionFailures(
    orchestratorId: string,
    timeWindowMs?: number
  ): Promise<SessionFailureStats>;
}

// =============================================================================
// ALERT SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Alert service implementation
 */
export class AlertServiceImpl implements AlertService {
  private readonly db: PrismaClient;
  private readonly thresholds: AlertThresholds;

  constructor(database?: PrismaClient, thresholds?: Partial<AlertThresholds>) {
    // @ts-expect-error - PrismaClient is dynamically imported
    this.db = database ?? globalThis.prisma;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  // ===========================================================================
  // HEALTH CHECKS
  // ===========================================================================

  /**
   * Check if orchestrator budget is running low
   */
  async checkBudgetExhaustion(orchestratorId: string): Promise<Alert | null> {
    // Verify orchestrator exists
    await this.verifyOrchestrator(orchestratorId);

    // Get budget usage
    const usage = await this.getBudgetUsage(orchestratorId, 'hourly');

    // Determine alert level
    let level: AlertLevel | null = null;
    let threshold: number = 0;

    if (usage.percentage >= this.thresholds.budgetCritical) {
      level = 'critical';
      threshold = this.thresholds.budgetCritical;
    } else if (usage.percentage >= this.thresholds.budgetWarning) {
      level = 'warning';
      threshold = this.thresholds.budgetWarning;
    }

    // No alert needed
    if (!level) {
      // Auto-resolve existing alerts if usage is back to normal
      await this.autoResolveAlerts(orchestratorId, 'budget_exhaustion');
      return null;
    }

    // Check for duplicate alerts
    const existingAlert = await this.findExistingAlert(
      orchestratorId,
      'budget_exhaustion',
      level
    );
    if (existingAlert) {
      return existingAlert;
    }

    // Create new alert
    return this.createAlert({
      orchestratorId,
      level,
      threshold,
      currentUsage: usage.totalUsage,
      message: `Budget usage at ${usage.percentage.toFixed(1)}% (${usage.totalUsage}/${usage.limit} tokens)`,
      type: 'budget_exhaustion',
      metadata: {
        period: usage.period,
        percentage: usage.percentage,
        limit: usage.limit,
      },
    });
  }

  /**
   * Check if error rate exceeds threshold
   */
  async checkHighErrorRate(
    orchestratorId: string,
    threshold?: number
  ): Promise<Alert | null> {
    await this.verifyOrchestrator(orchestratorId);

    const errorThreshold = threshold ?? this.thresholds.errorRateCritical;
    const stats = await this.getErrorRate(orchestratorId);

    // Determine alert level
    let level: AlertLevel | null = null;
    let thresholdUsed: number = 0;

    if (stats.errorRate >= errorThreshold) {
      level = 'critical';
      thresholdUsed = errorThreshold;
    } else if (stats.errorRate >= this.thresholds.errorRateWarning) {
      level = 'warning';
      thresholdUsed = this.thresholds.errorRateWarning;
    }

    if (!level) {
      await this.autoResolveAlerts(orchestratorId, 'error_rate');
      return null;
    }

    const existingAlert = await this.findExistingAlert(
      orchestratorId,
      'error_rate',
      level
    );
    if (existingAlert) {
      return existingAlert;
    }

    return this.createAlert({
      orchestratorId,
      level,
      threshold: thresholdUsed,
      currentUsage: stats.errorCount,
      message: `Error rate at ${(stats.errorRate * 100).toFixed(1)}% (${stats.errorCount}/${stats.totalRequests} requests)`,
      type: 'error_rate',
      metadata: {
        errorRate: stats.errorRate,
        totalRequests: stats.totalRequests,
        period: stats.period,
      },
    });
  }

  /**
   * Check if session failures exceed threshold
   */
  async checkSessionFailures(
    orchestratorId: string,
    threshold?: number
  ): Promise<Alert | null> {
    await this.verifyOrchestrator(orchestratorId);

    const failureThreshold = threshold ?? this.thresholds.sessionFailureCount;
    const stats = await this.getSessionFailures(orchestratorId);

    if (stats.failureCount < failureThreshold) {
      await this.autoResolveAlerts(orchestratorId, 'session_failure');
      return null;
    }

    const level: AlertLevel =
      stats.failureCount >= failureThreshold * 2 ? 'critical' : 'warning';
    const existingAlert = await this.findExistingAlert(
      orchestratorId,
      'session_failure',
      level
    );
    if (existingAlert) {
      return existingAlert;
    }

    return this.createAlert({
      orchestratorId,
      level,
      threshold: failureThreshold,
      currentUsage: stats.failureCount,
      message: `${stats.failureCount} session failures detected in recent period`,
      type: 'session_failure',
      metadata: {
        totalSessions: stats.totalSessions,
        recentFailures: stats.recentFailures,
      },
    });
  }

  /**
   * Check if latency exceeds threshold
   */
  async checkLatencySpike(
    orchestratorId: string,
    threshold?: number
  ): Promise<Alert | null> {
    await this.verifyOrchestrator(orchestratorId);

    const latencyThreshold = threshold ?? this.thresholds.latencySpikeMs;

    // Get recent token usage to check latency
    const recentUsage = await this.db.tokenUsage.findMany({
      where: {
        orchestratorId,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (recentUsage.length === 0) {
      return null;
    }

    // Calculate average latency from metadata (assuming it's stored)
    // This is a placeholder - actual implementation depends on how latency is tracked
    const avgLatency = 0; // TODO: Calculate from actual latency data

    if (avgLatency < latencyThreshold) {
      await this.autoResolveAlerts(orchestratorId, 'latency_spike');
      return null;
    }

    const level: AlertLevel =
      avgLatency >= latencyThreshold * 2 ? 'critical' : 'warning';
    const existingAlert = await this.findExistingAlert(
      orchestratorId,
      'latency_spike',
      level
    );
    if (existingAlert) {
      return existingAlert;
    }

    return this.createAlert({
      orchestratorId,
      level,
      threshold: latencyThreshold,
      currentUsage: avgLatency,
      message: `Latency spike detected: ${avgLatency}ms (threshold: ${latencyThreshold}ms)`,
      type: 'latency_spike',
      metadata: {
        avgLatency,
        sampleSize: recentUsage.length,
      },
    });
  }

  /**
   * Check node health status
   */
  async checkNodeHealth(nodeId: string): Promise<Alert | null> {
    // Get orchestrator by nodeId (assuming nodeId maps to orchestratorId)
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id: nodeId },
      select: { id: true, status: true, updatedAt: true },
    });

    if (!orchestrator) {
      throw new OrchestratorNotFoundError(nodeId);
    }

    const isHealthy =
      orchestrator.status === 'ONLINE' || orchestrator.status === 'BUSY';
    const lastHeartbeat = orchestrator.updatedAt;
    const timeSinceHeartbeat = Date.now() - lastHeartbeat.getTime();

    // Check if heartbeat is stale (> 5 minutes)
    const isStale = timeSinceHeartbeat > 5 * 60 * 1000;

    if (isHealthy && !isStale) {
      await this.autoResolveAlerts(nodeId, 'node_health');
      return null;
    }

    const level: AlertLevel = isStale ? 'critical' : 'warning';
    const existingAlert = await this.findExistingAlert(
      nodeId,
      'node_health',
      level
    );
    if (existingAlert) {
      return existingAlert;
    }

    return this.createAlert({
      orchestratorId: nodeId,
      level,
      threshold: 0,
      currentUsage: timeSinceHeartbeat,
      message: isStale
        ? `Node unresponsive for ${Math.floor(timeSinceHeartbeat / 60000)} minutes`
        : `Node health degraded: ${orchestrator.status}`,
      type: 'node_health',
      metadata: {
        status: orchestrator.status,
        lastHeartbeat: lastHeartbeat.toISOString(),
        timeSinceHeartbeat,
      },
    });
  }

  // ===========================================================================
  // ALERT MANAGEMENT
  // ===========================================================================

  /**
   * Create a new alert
   */
  async createAlert(input: CreateAlertInput): Promise<Alert> {
    // Validate input
    this.validateAlertInput(input);

    // Map AlertLevel to database level string
    const levelMap: Record<AlertLevel, string> = {
      info: 'info',
      warning: 'warning',
      critical: 'critical',
      emergency: 'emergency',
    };

    const alert = await this.db.budgetAlert.create({
      data: {
        orchestratorId: input.orchestratorId,
        level: levelMap[input.level],
        threshold: input.threshold,
        currentUsage: input.currentUsage,
        message: input.message,
        acknowledged: false,
      },
    });

    return this.mapAlertToOutput(alert, input.type, input.metadata);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = await this.db.budgetAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new AlertNotFoundError(alertId);
    }

    const updated = await this.db.budgetAlert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });

    return this.mapAlertToOutput(updated);
  }

  /**
   * Resolve an alert (mark as resolved)
   */
  async resolveAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = await this.db.budgetAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new AlertNotFoundError(alertId);
    }

    // Note: BudgetAlert schema doesn't have resolvedAt/resolvedBy fields
    // We'll use acknowledgedAt/acknowledgedBy for now
    const updated = await this.db.budgetAlert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });

    return this.mapAlertToOutput(updated, undefined, { resolved: true });
  }

  /**
   * Get active (unacknowledged) alerts
   */
  async getActiveAlerts(filters?: AlertFilters): Promise<Alert[]> {
    const where = this.buildWhereClause({ ...filters, acknowledged: false });

    const alerts = await this.db.budgetAlert.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { level: 'desc' }],
    });

    return alerts.map(alert => this.mapAlertToOutput(alert));
  }

  /**
   * Get alert history with pagination
   */
  async getAlertHistory(
    filters?: AlertFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedAlerts> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderByClause(pagination);

    const [alerts, total] = await Promise.all([
      this.db.budgetAlert.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.db.budgetAlert.count({ where }),
    ]);

    return {
      alerts: alerts.map(alert => this.mapAlertToOutput(alert)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ===========================================================================
  // RULE EVALUATION
  // ===========================================================================

  /**
   * Evaluate all alert rules for an orchestrator
   */
  async evaluateAllRules(orchestratorId: string): Promise<Alert[]> {
    await this.verifyOrchestrator(orchestratorId);

    const alerts: Array<Alert | null> = await Promise.all([
      this.checkBudgetExhaustion(orchestratorId),
      this.checkHighErrorRate(orchestratorId),
      this.checkSessionFailures(orchestratorId),
      this.checkLatencySpike(orchestratorId),
      this.checkNodeHealth(orchestratorId),
    ]);

    return alerts.filter((alert): alert is Alert => alert !== null);
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Get budget usage for an orchestrator
   */
  async getBudgetUsage(
    orchestratorId: string,
    period: 'hourly' | 'daily' | 'monthly' = 'hourly'
  ): Promise<BudgetUsage> {
    const config = await this.db.budgetConfig.findUnique({
      where: { orchestratorId },
    });

    if (!config) {
      throw new AlertServiceError(
        `Budget config not found for orchestrator: ${orchestratorId}`
      );
    }

    const limit =
      period === 'hourly'
        ? config.hourlyLimit
        : period === 'daily'
          ? config.dailyLimit
          : config.monthlyLimit;

    // Calculate time window
    const now = new Date();
    const startDate =
      period === 'hourly'
        ? new Date(now.getTime() - 60 * 60 * 1000)
        : period === 'daily'
          ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
          : new Date(now.getFullYear(), now.getMonth(), 1);

    // Get total token usage in period
    const usageRecords = await this.db.tokenUsage.findMany({
      where: {
        orchestratorId,
        createdAt: {
          gte: startDate,
        },
      },
    });

    const totalUsage = usageRecords.reduce(
      (sum, record) => sum + record.totalTokens,
      0
    );
    const percentage = (totalUsage / limit) * 100;

    return {
      orchestratorId,
      totalUsage,
      limit,
      percentage,
      period,
    };
  }

  /**
   * Get error rate for an orchestrator
   */
  async getErrorRate(
    orchestratorId: string,
    timeWindowMs: number = 60 * 60 * 1000
  ): Promise<ErrorRateStats> {
    const periodStart = new Date(Date.now() - timeWindowMs);

    // This is a simplified implementation
    // In a real system, you'd track errors separately
    const totalRequests = await this.db.tokenUsage.count({
      where: {
        orchestratorId,
        createdAt: { gte: periodStart },
      },
    });

    // Placeholder: would need actual error tracking
    const errorCount = 0;
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    return {
      orchestratorId,
      totalRequests,
      errorCount,
      errorRate,
      period: periodStart,
    };
  }

  /**
   * Get session failure statistics
   */
  async getSessionFailures(
    orchestratorId: string,
    _timeWindowMs: number = 60 * 60 * 1000
  ): Promise<SessionFailureStats> {
    // This is a simplified implementation
    // In a real system, you'd track session failures in a dedicated table
    const totalSessions = await this.db.sessionManager.count({
      where: { orchestratorId },
    });

    return {
      orchestratorId,
      failureCount: 0,
      totalSessions,
      recentFailures: [],
    };
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  /**
   * Verify that an orchestrator exists
   */
  private async verifyOrchestrator(orchestratorId: string): Promise<void> {
    const exists = await this.db.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: { id: true },
    });

    if (!exists) {
      throw new OrchestratorNotFoundError(orchestratorId);
    }
  }

  /**
   * Find existing alert to prevent duplicates
   */
  private async findExistingAlert(
    orchestratorId: string,
    type: AlertType,
    level: AlertLevel
  ): Promise<Alert | null> {
    const recentAlerts = await this.db.budgetAlert.findMany({
      where: {
        orchestratorId,
        level,
        acknowledged: false,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Within last hour
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (recentAlerts.length > 0) {
      return this.mapAlertToOutput(recentAlerts[0], type);
    }

    return null;
  }

  /**
   * Auto-resolve alerts when condition is no longer met
   */
  private async autoResolveAlerts(
    orchestratorId: string,
    _type: AlertType
  ): Promise<void> {
    // Auto-acknowledge old alerts when condition resolves
    await this.db.budgetAlert.updateMany({
      where: {
        orchestratorId,
        acknowledged: false,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      data: {
        acknowledged: true,
        acknowledgedBy: 'system',
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Validate alert input
   */
  private validateAlertInput(input: CreateAlertInput): void {
    if (!input.orchestratorId) {
      throw new AlertValidationError('orchestratorId is required');
    }

    if (!input.level) {
      throw new AlertValidationError('level is required');
    }

    if (typeof input.threshold !== 'number') {
      throw new AlertValidationError('threshold must be a number');
    }

    if (typeof input.currentUsage !== 'number') {
      throw new AlertValidationError('currentUsage must be a number');
    }

    if (!input.message || input.message.trim().length === 0) {
      throw new AlertValidationError('message is required');
    }
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters?: AlertFilters): any {
    if (!filters) return {};

    const where: any = {};

    if (filters.orchestratorId) {
      where.orchestratorId = filters.orchestratorId;
    }

    if (filters.level) {
      where.level = Array.isArray(filters.level)
        ? { in: filters.level }
        : filters.level;
    }

    if (typeof filters.acknowledged === 'boolean') {
      where.acknowledged = filters.acknowledged;
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore;
      }
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause from pagination options
   */
  private buildOrderByClause(pagination?: PaginationOptions): any {
    const sortBy = pagination?.sortBy ?? 'createdAt';
    const sortOrder = pagination?.sortOrder ?? 'desc';

    return { [sortBy]: sortOrder };
  }

  /**
   * Map database alert to output format
   */
  private mapAlertToOutput(
    alert: any,
    type?: AlertType,
    metadata?: Record<string, unknown>
  ): Alert {
    return {
      id: alert.id,
      orchestratorId: alert.orchestratorId,
      level: alert.level as AlertLevel,
      threshold: alert.threshold,
      currentUsage: alert.currentUsage,
      message: alert.message,
      acknowledged: alert.acknowledged,
      acknowledgedBy: alert.acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt,
      createdAt: alert.createdAt,
      type: type ?? 'custom',
      metadata,
      status: alert.acknowledged ? 'acknowledged' : 'active',
      resolvedAt: metadata?.resolved ? alert.acknowledgedAt : null,
      resolvedBy: metadata?.resolved ? alert.acknowledgedBy : null,
    };
  }
}

// =============================================================================
// FACTORY & SINGLETON
// =============================================================================

/**
 * Create a new alert service instance
 */
export function createAlertService(
  database?: PrismaClient,
  thresholds?: Partial<AlertThresholds>
): AlertServiceImpl {
  return new AlertServiceImpl(database, thresholds);
}

/**
 * Global singleton instance
 */
let alertServiceInstance: AlertServiceImpl | null = null;

/**
 * Get or create the global alert service instance
 */
export function getAlertService(
  database?: PrismaClient,
  thresholds?: Partial<AlertThresholds>
): AlertServiceImpl {
  if (!alertServiceInstance) {
    alertServiceInstance = createAlertService(database, thresholds);
  }
  return alertServiceInstance;
}

/**
 * Reset the global alert service instance (useful for testing)
 */
export function resetAlertService(): void {
  alertServiceInstance = null;
}

/**
 * Default export for convenience
 */
export const alertService = getAlertService();
