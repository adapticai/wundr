/**
 * Usage Reporter - Token usage tracking and reporting
 */

import { EventEmitter } from 'eventemitter3';

import { getCostCalculator } from './cost-calculator';
import { UsageReporterConfigSchema } from './types';

import type { CostCalculator } from './cost-calculator';
import type {
  TokenUsageRecord,
  ReportParams,
  UsageReport,
  UsageSummary,
  UsageBreakdown,
  Anomaly,
  UsageDataPoint,
  UsageStatistics,
  BudgetStatus,
  UsageReporterConfig,
  CostParams,
  CostEstimate,
} from './types';

/**
 * In-memory storage interface (for databases, implement this)
 */
export interface UsageStorage {
  saveUsageRecord(record: TokenUsageRecord): Promise<void>;
  getUsageRecords(params: {
    orchestratorId?: string;
    sessionId?: string;
    startTime: Date;
    endTime: Date;
  }): Promise<TokenUsageRecord[]>;
  deleteOldRecords(olderThan: Date): Promise<number>;
}

/**
 * Simple in-memory storage implementation
 */
class InMemoryStorage implements UsageStorage {
  private records: TokenUsageRecord[] = [];

  async saveUsageRecord(record: TokenUsageRecord): Promise<void> {
    this.records.push(record);
  }

  async getUsageRecords(params: {
    orchestratorId?: string;
    sessionId?: string;
    startTime: Date;
    endTime: Date;
  }): Promise<TokenUsageRecord[]> {
    return this.records.filter(r => {
      const matchesOrchestrator =
        !params.orchestratorId || r.orchestratorId === params.orchestratorId;
      const matchesSession =
        !params.sessionId || r.sessionId === params.sessionId;
      const inTimeRange =
        r.timestamp >= params.startTime && r.timestamp <= params.endTime;
      return matchesOrchestrator && matchesSession && inTimeRange;
    });
  }

  async deleteOldRecords(olderThan: Date): Promise<number> {
    const initialLength = this.records.length;
    this.records = this.records.filter(r => r.timestamp >= olderThan);
    return initialLength - this.records.length;
  }
}

/**
 * Usage Reporter Events
 */
interface UsageReporterEvents {
  'usage-recorded': (record: TokenUsageRecord) => void;
  'anomaly-detected': (anomaly: Anomaly) => void;
  'budget-warning': (status: BudgetStatus) => void;
  'budget-exceeded': (status: BudgetStatus) => void;
}

/**
 * Usage Reporter
 */
export class UsageReporter extends EventEmitter<UsageReporterEvents> {
  private storage: UsageStorage;
  private costCalculator: CostCalculator;
  private config: UsageReporterConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    config?: Partial<UsageReporterConfig>,
    storage?: UsageStorage,
    costCalculator?: CostCalculator
  ) {
    super();
    this.config = UsageReporterConfigSchema.parse(config || {});
    this.storage = storage || new InMemoryStorage();
    this.costCalculator = costCalculator || getCostCalculator();

    if (this.config.enabled && this.config.retentionDays > 0) {
      this.startCleanupSchedule();
    }
  }

  /**
   * Record a token usage event
   */
  public async recordUsage(usage: TokenUsageRecord): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Save to storage
    if (this.config.persistToDatabase) {
      await this.storage.saveUsageRecord(usage);
    }

    // Emit event
    this.emit('usage-recorded', usage);

    // Check for anomalies if enabled
    if (this.config.anomalyDetection.enabled) {
      const anomalies = await this.detectAnomalies(usage.orchestratorId);
      for (const anomaly of anomalies) {
        this.emit('anomaly-detected', anomaly);
      }
    }
  }

  /**
   * Generate a usage report
   */
  public async getReport(params: ReportParams): Promise<UsageReport> {
    // Fetch records from storage
    const records = await this.storage.getUsageRecords({
      orchestratorId: params.orchestratorId,
      sessionId: params.sessionId,
      startTime: params.startTime,
      endTime: params.endTime,
    });

    // Calculate summary
    const summary = this.calculateSummary(records);

    // Calculate breakdown
    const breakdown = this.calculateBreakdown(records, params.groupBy);

    // Detect anomalies if requested
    let anomalies: Anomaly[] | undefined;
    if (params.includeAnomalies && this.config.anomalyDetection.enabled) {
      if (params.orchestratorId) {
        anomalies = await this.detectAnomalies(params.orchestratorId);
      }
    }

    // Calculate cost estimate
    const costEstimate = this.costCalculator.calculateCostEstimate(
      records,
      this.config.defaultCurrency,
      true,
      'monthly'
    );

    return {
      period: {
        startTime: params.startTime,
        endTime: params.endTime,
        granularity: params.granularity,
      },
      summary,
      breakdown,
      anomalies,
      costEstimate,
    };
  }

  /**
   * Get cost estimate for a time period
   */
  public async getCostEstimate(params: CostParams): Promise<CostEstimate> {
    const records = await this.storage.getUsageRecords({
      orchestratorId: params.orchestratorId,
      sessionId: params.sessionId,
      startTime: params.startTime,
      endTime: params.endTime,
    });

    return this.costCalculator.calculateCostEstimate(
      records,
      params.currency || this.config.defaultCurrency,
      params.includeProjection || false,
      'monthly'
    );
  }

  /**
   * Detect anomalies in usage patterns
   */
  public async detectAnomalies(orchestratorId: string): Promise<Anomaly[]> {
    const config = this.config.anomalyDetection;
    const anomalies: Anomaly[] = [];

    // Get recent usage data
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    const records = await this.storage.getUsageRecords({
      orchestratorId,
      startTime,
      endTime,
    });

    if (records.length < config.minDataPoints) {
      // Not enough data for anomaly detection
      return anomalies;
    }

    // Group by time windows (1 hour windows)
    const windowSize = 60 * 60 * 1000; // 1 hour in ms
    const windows = this.groupByTimeWindows(records, windowSize);

    // Calculate statistics
    const stats = this.calculateStatistics(windows.map(w => w.totalTokens));

    // Detect spikes
    for (const window of windows) {
      const deviation =
        Math.abs(window.totalTokens - stats.mean) / stats.stdDev;

      if (deviation > config.spikeThreshold) {
        const anomaly: Anomaly = {
          id: `spike-${orchestratorId}-${window.timestamp.getTime()}`,
          orchestratorId,
          sessionId: window.sessionId,
          timestamp: window.timestamp,
          type: 'spike',
          severity:
            deviation > config.spikeThreshold * 2
              ? 'critical'
              : deviation > config.spikeThreshold * 1.5
                ? 'high'
                : 'medium',
          description: `Token usage spike detected: ${window.totalTokens} tokens (${deviation.toFixed(1)} std devs from mean)`,
          actualValue: window.totalTokens,
          expectedValue: stats.mean,
          deviationPercentage:
            ((window.totalTokens - stats.mean) / stats.mean) * 100,
        };
        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  /**
   * Get budget status for an orchestrator
   */
  public async getBudgetStatus(
    orchestratorId: string,
    period: 'hourly' | 'daily' | 'monthly',
    limit: number
  ): Promise<BudgetStatus> {
    const now = new Date();
    let startTime: Date;
    let resetAt: Date;

    switch (period) {
      case 'hourly':
        startTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours()
        );
        resetAt = new Date(startTime.getTime() + 60 * 60 * 1000);
        break;
      case 'daily':
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        resetAt = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startTime = new Date(now.getFullYear(), now.getMonth(), 1);
        resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
    }

    const records = await this.storage.getUsageRecords({
      orchestratorId,
      startTime,
      endTime: now,
    });

    const used = records.reduce((sum, r) => sum + r.totalTokens, 0);
    const remaining = Math.max(0, limit - used);
    const percentage = (used / limit) * 100;

    let status: BudgetStatus['status'];
    if (percentage >= 100) {
      status = 'exceeded';
    } else if (
      percentage >=
      this.config.anomalyDetection.budgetCriticalThreshold * 100
    ) {
      status = 'critical';
    } else if (
      percentage >=
      this.config.anomalyDetection.budgetWarningThreshold * 100
    ) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    const budgetStatus: BudgetStatus = {
      orchestratorId,
      period,
      limit,
      used,
      remaining,
      percentage,
      status,
      resetAt,
    };

    // Emit events for warnings and exceeded
    if (status === 'warning') {
      this.emit('budget-warning', budgetStatus);
    } else if (status === 'exceeded' || status === 'critical') {
      this.emit('budget-exceeded', budgetStatus);
    }

    return budgetStatus;
  }

  /**
   * Calculate usage summary
   */
  private calculateSummary(records: TokenUsageRecord[]): UsageSummary {
    const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = records.reduce(
      (sum, r) => sum + r.outputTokens,
      0
    );
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);

    const uniqueOrchestrators = new Set(records.map(r => r.orchestratorId))
      .size;
    const uniqueSessions = new Set(records.map(r => r.sessionId)).size;

    const averageTokensPerSession =
      uniqueSessions > 0 ? totalTokens / uniqueSessions : 0;

    // Find peak usage
    let peakUsageTimestamp: Date | undefined;
    let peakUsageTokens: number | undefined;

    if (records.length > 0) {
      const sorted = [...records].sort((a, b) => b.totalTokens - a.totalTokens);
      peakUsageTimestamp = sorted[0].timestamp;
      peakUsageTokens = sorted[0].totalTokens;
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalRecords: records.length,
      uniqueOrchestrators,
      uniqueSessions,
      averageTokensPerSession,
      peakUsageTimestamp,
      peakUsageTokens,
    };
  }

  /**
   * Calculate usage breakdown
   */
  private calculateBreakdown(
    records: TokenUsageRecord[],
    groupBy?: ('orchestrator' | 'session' | 'model' | 'tool')[]
  ): UsageBreakdown[] {
    if (!groupBy || groupBy.length === 0) {
      groupBy = ['orchestrator', 'model'];
    }

    const breakdowns: UsageBreakdown[] = [];
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);

    for (const groupType of groupBy) {
      const groups = new Map<string, TokenUsageRecord[]>();

      for (const record of records) {
        let key: string;
        switch (groupType) {
          case 'orchestrator':
            key = record.orchestratorId;
            break;
          case 'session':
            key = record.sessionId;
            break;
          case 'model':
            key = record.modelId;
            break;
          case 'tool':
            key = record.toolName || 'unknown';
            break;
        }

        const existing = groups.get(key) || [];
        existing.push(record);
        groups.set(key, existing);
      }

      for (const [key, groupRecords] of groups) {
        const inputTokens = groupRecords.reduce(
          (sum, r) => sum + r.inputTokens,
          0
        );
        const outputTokens = groupRecords.reduce(
          (sum, r) => sum + r.outputTokens,
          0
        );
        const groupTotal = groupRecords.reduce(
          (sum, r) => sum + r.totalTokens,
          0
        );
        const cost =
          this.costCalculator.calculateCostEstimate(groupRecords).totalCost;

        breakdowns.push({
          key,
          type: groupType,
          inputTokens,
          outputTokens,
          totalTokens: groupTotal,
          percentage: totalTokens > 0 ? (groupTotal / totalTokens) * 100 : 0,
          recordCount: groupRecords.length,
          cost,
        });
      }
    }

    // Sort by total tokens descending
    return breakdowns.sort((a, b) => b.totalTokens - a.totalTokens);
  }

  /**
   * Group records by time windows
   */
  private groupByTimeWindows(
    records: TokenUsageRecord[],
    windowSizeMs: number
  ): UsageDataPoint[] {
    const windows = new Map<number, TokenUsageRecord[]>();

    for (const record of records) {
      const windowStart =
        Math.floor(record.timestamp.getTime() / windowSizeMs) * windowSizeMs;
      const existing = windows.get(windowStart) || [];
      existing.push(record);
      windows.set(windowStart, existing);
    }

    return Array.from(windows.entries()).map(([timestamp, windowRecords]) => ({
      timestamp: new Date(timestamp),
      orchestratorId: windowRecords[0].orchestratorId,
      sessionId: windowRecords[0].sessionId,
      totalTokens: windowRecords.reduce((sum, r) => sum + r.totalTokens, 0),
      inputTokens: windowRecords.reduce((sum, r) => sum + r.inputTokens, 0),
      outputTokens: windowRecords.reduce((sum, r) => sum + r.outputTokens, 0),
    }));
  }

  /**
   * Calculate statistics for anomaly detection
   */
  private calculateStatistics(values: number[]): UsageStatistics {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        q1: 0,
        q3: 0,
        dataPoints: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const median = sorted[Math.floor(sorted.length / 2)];
    const q1 = sorted[Math.floor(sorted.length / 4)];
    const q3 = sorted[Math.floor((sorted.length * 3) / 4)];

    return {
      mean,
      median,
      stdDev,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      q1,
      q3,
      dataPoints: values.length,
    };
  }

  /**
   * Start cleanup schedule for old records
   */
  private startCleanupSchedule(): void {
    // Run cleanup daily
    this.cleanupInterval = setInterval(
      () => this.cleanupOldRecords(),
      24 * 60 * 60 * 1000
    );
  }

  /**
   * Cleanup old records
   */
  private async cleanupOldRecords(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const deleted = await this.storage.deleteOldRecords(cutoffDate);

    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} old usage records`);
    }
  }

  /**
   * Shutdown reporter
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.removeAllListeners();
  }
}
