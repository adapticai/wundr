/**
 * Alignment Drift Detector
 * Monitors five dimensions of alignment drift for AI agent governance.
 *
 * Dimensions:
 * 1. Policy Violation Rate - % of actions violating constraints
 * 2. Intent-Outcome Gap - Divergence from stated goals
 * 3. Evaluator Disagreement - Human override rate
 * 4. Escalation Suppression - Agents avoiding escalation triggers
 * 5. Reward Hacking - Gaming metrics without achieving intent
 */

import * as os from 'os';
import * as path from 'path';

import * as fs from 'fs-extra';

// Types
export interface AlignmentDriftMetrics {
  policyViolationRate: number; // % of actions violating constraints (0-1)
  intentOutcomeGap: number; // Divergence from stated goals (0-1)
  evaluatorDisagreement: number; // Human override rate (0-1)
  escalationSuppression: number; // Agents avoiding triggers (0-1)
  rewardHacking: number; // Gaming metrics instances count
}

export interface AlignmentDimension {
  name: string;
  key: keyof AlignmentDriftMetrics;
  threshold: number;
  description: string;
  currentValue: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface AlignmentReport {
  timestamp: string;
  sessionId?: string;
  overallScore: number; // 0-100 (100 = perfect alignment)
  status: 'healthy' | 'warning' | 'critical';
  metrics: AlignmentDriftMetrics;
  dimensions: AlignmentDimension[];
  recommendations: string[];
  history?: AlignmentHistoryEntry[];
}

export interface AlignmentHistoryEntry {
  timestamp: string;
  sessionId?: string;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  metrics: AlignmentDriftMetrics;
}

export interface AlignmentDebtReport {
  generatedAt: string;
  period: {
    start: string;
    end: string;
    days: number;
  };
  summary: {
    averageScore: number;
    lowestScore: number;
    highestScore: number;
    trend: 'improving' | 'stable' | 'degrading';
    totalViolations: number;
  };
  dimensionAnalysis: {
    [key: string]: {
      average: number;
      max: number;
      exceedances: number;
    };
  };
  criticalEvents: Array<{
    timestamp: string;
    dimension: string;
    value: number;
    threshold: number;
  }>;
  recommendations: string[];
}

export class AlignmentDriftDetector {
  private readonly dataDir: string;
  private readonly historyFile: string;

  // Thresholds from Three-Tier Architecture spec
  private readonly thresholds = {
    policyViolation: 0.005, // >0.5% daily violations triggers alert
    intentOutcomeGap: 0.15, // >15% divergence is concerning
    evaluatorDisagreement: 0.2, // >20% monthly overrides
    escalationSuppression: 0.4, // >40% drop from baseline
    rewardHacking: 5, // >5 instances/month
  };

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(os.homedir(), '.wundr', 'alignment');
    this.historyFile = path.join(this.dataDir, 'history.json');
  }

  /**
   * Initialize the detector and ensure directories exist
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.dataDir);

    if (!(await fs.pathExists(this.historyFile))) {
      await fs.writeJson(this.historyFile, { entries: [] }, { spaces: 2 });
    }
  }

  /**
   * Calculate alignment debt score (0-100, where 100 = perfect alignment)
   */
  async calculateAlignmentDebt(sessionId?: string): Promise<number> {
    const metrics = await this.collectMetrics(sessionId);
    return this.calculateScore(metrics);
  }

  /**
   * Get current alignment status with full report
   */
  async getAlignmentReport(sessionId?: string): Promise<AlignmentReport> {
    await this.initialize();

    const metrics = await this.collectMetrics(sessionId);
    const score = this.calculateScore(metrics);
    const status = this.determineStatus(score);
    const dimensions = this.analyzeDimensions(metrics);
    const recommendations = this.generateRecommendations(dimensions, status);

    const report: AlignmentReport = {
      timestamp: new Date().toISOString(),
      sessionId,
      overallScore: score,
      status,
      metrics,
      dimensions,
      recommendations,
    };

    // Store in history
    await this.storeHistoryEntry({
      timestamp: report.timestamp,
      sessionId,
      score,
      status,
      metrics,
    });

    return report;
  }

  /**
   * Get alignment score with color status
   */
  async getAlignmentScore(sessionId?: string): Promise<{
    score: number;
    status: 'healthy' | 'warning' | 'critical';
    color: 'green' | 'yellow' | 'red';
  }> {
    const score = await this.calculateAlignmentDebt(sessionId);
    const status = this.determineStatus(score);

    return {
      score,
      status,
      color:
        status === 'healthy'
          ? 'green'
          : status === 'warning'
            ? 'yellow'
            : 'red',
    };
  }

  /**
   * Get alignment history
   */
  async getHistory(days: number = 30): Promise<AlignmentHistoryEntry[]> {
    await this.initialize();

    const history = await this.loadHistory();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return history.entries
      .filter(
        (entry: AlignmentHistoryEntry) =>
          new Date(entry.timestamp) >= cutoffDate
      )
      .sort(
        (a: AlignmentHistoryEntry, b: AlignmentHistoryEntry) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  /**
   * Get breakdown by dimension
   */
  async getDimensionBreakdown(): Promise<AlignmentDimension[]> {
    const metrics = await this.collectMetrics();
    return this.analyzeDimensions(metrics);
  }

  /**
   * Generate alignment debt report for a period
   */
  async generateDebtReport(
    days: number = 7,
    sessionId?: string,
    outputFile?: string
  ): Promise<AlignmentDebtReport> {
    await this.initialize();

    const history = await this.getHistory(days);
    const filteredHistory = sessionId
      ? history.filter(h => h.sessionId === sessionId)
      : history;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Calculate summary statistics
    const scores = filteredHistory.map(h => h.score);
    const averageScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 100;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 100;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 100;

    // Calculate trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (scores.length >= 2) {
      const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
      const secondHalf = scores.slice(Math.floor(scores.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (secondAvg > firstAvg + 5) {
        trend = 'improving';
      } else if (secondAvg < firstAvg - 5) {
        trend = 'degrading';
      }
    }

    // Analyze dimensions across history
    const dimensionAnalysis: AlignmentDebtReport['dimensionAnalysis'] = {};
    const dimensionKeys: (keyof AlignmentDriftMetrics)[] = [
      'policyViolationRate',
      'intentOutcomeGap',
      'evaluatorDisagreement',
      'escalationSuppression',
      'rewardHacking',
    ];

    for (const key of dimensionKeys) {
      const values = filteredHistory.map(h => h.metrics[key]);
      const threshold = this.getThresholdForKey(key);

      dimensionAnalysis[key] = {
        average:
          values.length > 0
            ? values.reduce((a, b) => a + b, 0) / values.length
            : 0,
        max: values.length > 0 ? Math.max(...values) : 0,
        exceedances: values.filter(v => v > threshold).length,
      };
    }

    // Find critical events
    const criticalEvents: AlignmentDebtReport['criticalEvents'] = [];
    for (const entry of filteredHistory) {
      for (const key of dimensionKeys) {
        const threshold = this.getThresholdForKey(key);
        if (entry.metrics[key] > threshold * 2) {
          // Critical = 2x threshold
          criticalEvents.push({
            timestamp: entry.timestamp,
            dimension: key,
            value: entry.metrics[key],
            threshold,
          });
        }
      }
    }

    // Calculate total violations
    const totalViolations = Object.values(dimensionAnalysis).reduce(
      (sum, dim) => sum + dim.exceedances,
      0
    );

    // Generate recommendations
    const recommendations = this.generateDebtRecommendations(
      dimensionAnalysis,
      trend
    );

    const report: AlignmentDebtReport = {
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days,
      },
      summary: {
        averageScore,
        lowestScore,
        highestScore,
        trend,
        totalViolations,
      },
      dimensionAnalysis,
      criticalEvents: criticalEvents.slice(0, 20), // Top 20 critical events
      recommendations,
    };

    // Save report if output file specified
    if (outputFile) {
      await fs.writeJson(outputFile, report, { spaces: 2 });
    }

    return report;
  }

  /**
   * Collect metrics from session data
   */
  private async collectMetrics(
    sessionId?: string
  ): Promise<AlignmentDriftMetrics> {
    // Try to load session-specific metrics
    const sessionMetricsFile = sessionId
      ? path.join(this.dataDir, 'sessions', `${sessionId}.json`)
      : path.join(this.dataDir, 'current-metrics.json');

    if (await fs.pathExists(sessionMetricsFile)) {
      try {
        const data = await fs.readJson(sessionMetricsFile);
        return {
          policyViolationRate: data.policyViolationRate ?? 0,
          intentOutcomeGap: data.intentOutcomeGap ?? 0,
          evaluatorDisagreement: data.evaluatorDisagreement ?? 0,
          escalationSuppression: data.escalationSuppression ?? 0,
          rewardHacking: data.rewardHacking ?? 0,
        };
      } catch {
        // Fall through to defaults
      }
    }

    // Return default metrics (healthy baseline)
    return {
      policyViolationRate: 0,
      intentOutcomeGap: 0,
      evaluatorDisagreement: 0,
      escalationSuppression: 0,
      rewardHacking: 0,
    };
  }

  /**
   * Calculate alignment score from metrics (0-100)
   */
  private calculateScore(metrics: AlignmentDriftMetrics): number {
    // Normalize each metric against its threshold (0-1 scale where 0 is best)
    const normalizedPolicyViolation = Math.min(
      metrics.policyViolationRate / this.thresholds.policyViolation,
      2
    );
    const normalizedIntentGap = Math.min(
      metrics.intentOutcomeGap / this.thresholds.intentOutcomeGap,
      2
    );
    const normalizedEvaluatorDisagreement = Math.min(
      metrics.evaluatorDisagreement / this.thresholds.evaluatorDisagreement,
      2
    );
    const normalizedEscalationSuppression = Math.min(
      metrics.escalationSuppression / this.thresholds.escalationSuppression,
      2
    );
    const normalizedRewardHacking = Math.min(
      metrics.rewardHacking / this.thresholds.rewardHacking,
      2
    );

    // Weight factors (total = 1.0)
    const weights = {
      policyViolation: 0.25, // High weight - direct constraint violations
      intentOutcomeGap: 0.25, // High weight - core alignment metric
      evaluatorDisagreement: 0.2, // Medium weight - human feedback signal
      escalationSuppression: 0.15, // Medium weight - safety mechanism health
      rewardHacking: 0.15, // Medium weight - incentive alignment
    };

    // Calculate weighted penalty
    const penalty =
      normalizedPolicyViolation * weights.policyViolation +
      normalizedIntentGap * weights.intentOutcomeGap +
      normalizedEvaluatorDisagreement * weights.evaluatorDisagreement +
      normalizedEscalationSuppression * weights.escalationSuppression +
      normalizedRewardHacking * weights.rewardHacking;

    // Convert to 0-100 score (100 = perfect, 0 = worst)
    const score = Math.max(0, Math.min(100, 100 - penalty * 50));

    return Math.round(score * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Determine overall status from score
   */
  private determineStatus(score: number): 'healthy' | 'warning' | 'critical' {
    if (score >= 80) {
      return 'healthy';
    }
    if (score >= 50) {
      return 'warning';
    }
    return 'critical';
  }

  /**
   * Analyze each dimension
   */
  private analyzeDimensions(
    metrics: AlignmentDriftMetrics
  ): AlignmentDimension[] {
    const dimensions: AlignmentDimension[] = [
      {
        name: 'Policy Violation Rate',
        key: 'policyViolationRate',
        threshold: this.thresholds.policyViolation,
        description: 'Percentage of actions violating defined constraints',
        currentValue: metrics.policyViolationRate,
        status: this.getDimensionStatus(
          metrics.policyViolationRate,
          this.thresholds.policyViolation
        ),
      },
      {
        name: 'Intent-Outcome Gap',
        key: 'intentOutcomeGap',
        threshold: this.thresholds.intentOutcomeGap,
        description: 'Divergence between stated goals and actual outcomes',
        currentValue: metrics.intentOutcomeGap,
        status: this.getDimensionStatus(
          metrics.intentOutcomeGap,
          this.thresholds.intentOutcomeGap
        ),
      },
      {
        name: 'Evaluator Disagreement',
        key: 'evaluatorDisagreement',
        threshold: this.thresholds.evaluatorDisagreement,
        description: 'Rate of human overrides on agent decisions',
        currentValue: metrics.evaluatorDisagreement,
        status: this.getDimensionStatus(
          metrics.evaluatorDisagreement,
          this.thresholds.evaluatorDisagreement
        ),
      },
      {
        name: 'Escalation Suppression',
        key: 'escalationSuppression',
        threshold: this.thresholds.escalationSuppression,
        description: 'Drop in escalation triggers compared to baseline',
        currentValue: metrics.escalationSuppression,
        status: this.getDimensionStatus(
          metrics.escalationSuppression,
          this.thresholds.escalationSuppression
        ),
      },
      {
        name: 'Reward Hacking',
        key: 'rewardHacking',
        threshold: this.thresholds.rewardHacking,
        description: 'Instances of gaming metrics without achieving intent',
        currentValue: metrics.rewardHacking,
        status: this.getDimensionStatus(
          metrics.rewardHacking,
          this.thresholds.rewardHacking
        ),
      },
    ];

    return dimensions;
  }

  /**
   * Get status for a single dimension
   */
  private getDimensionStatus(
    value: number,
    threshold: number
  ): 'healthy' | 'warning' | 'critical' {
    if (value <= threshold) {
      return 'healthy';
    }
    if (value <= threshold * 2) {
      return 'warning';
    }
    return 'critical';
  }

  /**
   * Get threshold for a metric key
   */
  private getThresholdForKey(key: keyof AlignmentDriftMetrics): number {
    const thresholdMap: Record<keyof AlignmentDriftMetrics, number> = {
      policyViolationRate: this.thresholds.policyViolation,
      intentOutcomeGap: this.thresholds.intentOutcomeGap,
      evaluatorDisagreement: this.thresholds.evaluatorDisagreement,
      escalationSuppression: this.thresholds.escalationSuppression,
      rewardHacking: this.thresholds.rewardHacking,
    };
    return thresholdMap[key];
  }

  /**
   * Generate recommendations based on dimension analysis
   */
  private generateRecommendations(
    dimensions: AlignmentDimension[],
    status: string
  ): string[] {
    const recommendations: string[] = [];

    for (const dim of dimensions) {
      if (dim.status === 'critical') {
        recommendations.push(
          `CRITICAL: ${dim.name} at ${this.formatValue(dim.currentValue, dim.key)} exceeds threshold (${this.formatValue(dim.threshold, dim.key)}). Immediate action required.`
        );
      } else if (dim.status === 'warning') {
        recommendations.push(
          `WARNING: ${dim.name} at ${this.formatValue(dim.currentValue, dim.key)} approaching threshold (${this.formatValue(dim.threshold, dim.key)}). Monitor closely.`
        );
      }
    }

    if (status === 'critical') {
      recommendations.push(
        'Consider pausing autonomous operations until alignment issues are resolved.'
      );
      recommendations.push('Schedule immediate review with Guardian role.');
    } else if (status === 'warning') {
      recommendations.push(
        'Review recent agent decisions for potential alignment drift.'
      );
      recommendations.push(
        'Consider tightening constraints or adding checkpoints.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'All alignment metrics within acceptable thresholds.'
      );
    }

    return recommendations;
  }

  /**
   * Generate recommendations for debt report
   */
  private generateDebtRecommendations(
    dimensionAnalysis: AlignmentDebtReport['dimensionAnalysis'],
    trend: 'improving' | 'stable' | 'degrading'
  ): string[] {
    const recommendations: string[] = [];

    // Trend-based recommendations
    if (trend === 'degrading') {
      recommendations.push(
        'Alignment score is degrading over time. Review recent changes to agent configurations.'
      );
    } else if (trend === 'improving') {
      recommendations.push(
        'Alignment score is improving. Continue current governance practices.'
      );
    }

    // Dimension-specific recommendations
    for (const [key, analysis] of Object.entries(dimensionAnalysis)) {
      if (analysis.exceedances > 0) {
        const friendlyName = this.getFriendlyDimensionName(key);
        recommendations.push(
          `${friendlyName}: ${analysis.exceedances} threshold exceedance(s) detected. Average: ${analysis.average.toFixed(3)}`
        );
      }
    }

    return recommendations;
  }

  /**
   * Get friendly name for dimension
   */
  private getFriendlyDimensionName(key: string): string {
    const names: Record<string, string> = {
      policyViolationRate: 'Policy Violation Rate',
      intentOutcomeGap: 'Intent-Outcome Gap',
      evaluatorDisagreement: 'Evaluator Disagreement',
      escalationSuppression: 'Escalation Suppression',
      rewardHacking: 'Reward Hacking',
    };
    return names[key] || key;
  }

  /**
   * Format value for display
   */
  private formatValue(value: number, key: keyof AlignmentDriftMetrics): string {
    if (key === 'rewardHacking') {
      return `${value} instances`;
    }
    return `${(value * 100).toFixed(1)}%`;
  }

  /**
   * Store history entry
   */
  private async storeHistoryEntry(entry: AlignmentHistoryEntry): Promise<void> {
    const history = await this.loadHistory();
    history.entries.push(entry);

    // Keep last 1000 entries
    if (history.entries.length > 1000) {
      history.entries = history.entries.slice(-1000);
    }

    await fs.writeJson(this.historyFile, history, { spaces: 2 });
  }

  /**
   * Load history from file
   */
  private async loadHistory(): Promise<{ entries: AlignmentHistoryEntry[] }> {
    try {
      if (await fs.pathExists(this.historyFile)) {
        return await fs.readJson(this.historyFile);
      }
    } catch {
      // Fall through to default
    }
    return { entries: [] };
  }

  /**
   * Record metrics for a session (for testing or external updates)
   */
  async recordMetrics(
    metrics: Partial<AlignmentDriftMetrics>,
    sessionId?: string
  ): Promise<void> {
    await this.initialize();

    const sessionDir = path.join(this.dataDir, 'sessions');
    await fs.ensureDir(sessionDir);

    const metricsFile = sessionId
      ? path.join(sessionDir, `${sessionId}.json`)
      : path.join(this.dataDir, 'current-metrics.json');

    const existingMetrics = await this.collectMetrics(sessionId);
    const updatedMetrics = { ...existingMetrics, ...metrics };

    await fs.writeJson(metricsFile, updatedMetrics, { spaces: 2 });
  }

  /**
   * Get thresholds (for display)
   */
  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }
}

export default AlignmentDriftDetector;
