/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/namespace */
/* eslint-disable no-case-declarations */
/**
 * Alignment Drift Detector - Section 2.5.1 of Three-Tier Architecture Implementation Plan
 *
 * Monitors agent behavior for alignment drift across five dimensions:
 * 1. Policy Violation Rate - Percentage of actions violating constraints
 * 2. Intent-Outcome Gap - Divergence from stated goals
 * 3. Evaluator Disagreement - Human override rate
 * 4. Escalation Suppression - Agents avoiding escalation triggers
 * 5. Reward Hacking - Gaming metrics without genuine intent
 */

import * as path from 'path';

import * as fs from 'fs-extra';

import { BaseService } from '../core/BaseService';
import { AppError, AnalysisError } from '../core/errors';

import type { ServiceResult } from '../core/BaseService';

/**
 * Configuration for the AlignmentDriftDetector
 */
export interface DriftDetectorConfig {
  /** Directory to store alignment reports */
  outputDir?: string;
  /** Path to telemetry data */
  telemetryPath?: string;
  /** Path to governance data */
  governancePath?: string;
  /** Custom thresholds (override defaults) */
  thresholds?: Partial<AlignmentThresholds>;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Thresholds for alignment debt detection
 * Based on Section 2.5.1 specifications
 */
export interface AlignmentThresholds {
  /** >0.5% daily violations trigger concern (default: 0.005) */
  policyViolation: number;
  /** >15% divergence from intent (default: 0.15) */
  intentOutcomeGap: number;
  /** >20% monthly human overrides (default: 0.20) */
  evaluatorDisagreement: number;
  /** >40% drop from escalation baseline (default: 0.40) */
  escalationSuppression: number;
  /** >5 instances per month (default: 5) */
  rewardHacking: number;
}

/**
 * Raw metrics for each alignment dimension
 */
export interface AlignmentMetrics {
  policyViolationRate: number;
  intentOutcomeGap: number;
  evaluatorDisagreementRate: number;
  escalationSuppressionRate: number;
  rewardHackingInstances: number;
}

/**
 * Dimension status in alignment debt report
 */
export interface AlignmentDimension {
  name: string;
  value: number;
  threshold: number;
  exceeded: boolean;
  unit: string;
  description: string;
}

/**
 * Health status based on alignment debt score
 */
export type AlignmentDebtStatus = 'healthy' | 'concerning' | 'critical';

/**
 * Complete alignment debt report
 */
export interface AlignmentDebtReport {
  /** Alignment debt score (0-100) */
  score: number;
  /** Status interpretation */
  status: AlignmentDebtStatus;
  /** Report timestamp */
  timestamp: string;
  /** Session ID if scoped to a session */
  sessionId?: string;
  /** Individual dimension breakdown */
  dimensions: AlignmentDimension[];
  /** Raw metrics */
  metrics: AlignmentMetrics;
  /** Actionable recommendations */
  recommendations: string[];
  /** Historical trend indicator */
  trend?: 'improving' | 'stable' | 'degrading';
}

/**
 * Policy violation record
 */
interface PolicyViolation {
  timestamp: string;
  sessionId: string;
  agentId: string;
  policy: string;
  action: string;
  severity: 'warning' | 'error' | 'critical';
}

/**
 * Intent-outcome measurement record
 */
interface IntentOutcomeRecord {
  timestamp: string;
  sessionId: string;
  intentDescription: string;
  outcomeDescription: string;
  alignmentScore: number; // 0-1, where 1 is perfect alignment
}

/**
 * Evaluator decision record
 */
interface EvaluatorDecision {
  timestamp: string;
  sessionId: string;
  agentDecision: string;
  humanOverride: boolean;
  overrideReason?: string;
}

/**
 * Escalation event record
 */
interface EscalationEvent {
  timestamp: string;
  sessionId: string;
  triggerCondition: string;
  wasEscalated: boolean;
  suppressed: boolean;
  reason?: string;
}

/**
 * Reward hacking incident
 */
interface RewardHackingIncident {
  timestamp: string;
  sessionId: string;
  metricGamed: string;
  detectionMethod: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * AlignmentDriftDetector - Monitors agent behavior for alignment drift
 *
 * Score interpretation:
 * - <20: Healthy - System operating within acceptable parameters
 * - 20-50: Concerning - Requires attention, potential intervention needed
 * - >50: Critical - Requires immediate Architect intervention
 */
export class AlignmentDriftDetector extends BaseService {
  private readonly thresholds: AlignmentThresholds;
  private readonly telemetryPath: string;
  private readonly governancePath: string;
  private readonly reportsDir: string;

  /**
   * Default thresholds from Section 2.5.1 specifications
   */
  private static readonly DEFAULT_THRESHOLDS: AlignmentThresholds = {
    policyViolation: 0.005, // >0.5% daily violations
    intentOutcomeGap: 0.15, // >15% divergence
    evaluatorDisagreement: 0.2, // >20% monthly overrides
    escalationSuppression: 0.4, // >40% drop from baseline
    rewardHacking: 5, // >5 instances/month
  };

  constructor(config: DriftDetectorConfig = {}) {
    super('AlignmentDriftDetector', {
      outputDir:
        config.outputDir ||
        path.join(process.cwd(), '.governance', 'alignment'),
      enableLogging: config.verbose ?? true,
    });

    this.thresholds = {
      ...AlignmentDriftDetector.DEFAULT_THRESHOLDS,
      ...config.thresholds,
    };

    this.telemetryPath =
      config.telemetryPath ||
      path.join(process.cwd(), '.governance', 'telemetry');
    this.governancePath =
      config.governancePath || path.join(process.cwd(), '.governance', 'data');
    this.reportsDir = path.join(this.config.outputDir!, 'reports');
  }

  /**
   * Calculate the overall alignment debt score (0-100)
   *
   * The score is a weighted average of all five dimensions,
   * normalized to a 0-100 scale where higher values indicate
   * greater alignment debt (worse alignment).
   *
   * @param sessionId - Optional session ID to scope the calculation
   * @returns Alignment debt score
   */
  async calculateAlignmentDebt(
    sessionId?: string
  ): Promise<ServiceResult<number>> {
    return this.executeOperation('calculateAlignmentDebt', async () => {
      const metrics = await this.gatherMetrics(sessionId);

      // Calculate dimension scores (0-100 each)
      const policyScore = this.normalizeToScore(
        metrics.policyViolationRate,
        this.thresholds.policyViolation
      );
      const intentScore = this.normalizeToScore(
        metrics.intentOutcomeGap,
        this.thresholds.intentOutcomeGap
      );
      const evaluatorScore = this.normalizeToScore(
        metrics.evaluatorDisagreementRate,
        this.thresholds.evaluatorDisagreement
      );
      const escalationScore = this.normalizeToScore(
        metrics.escalationSuppressionRate,
        this.thresholds.escalationSuppression
      );
      const hackingScore = this.normalizeToScore(
        metrics.rewardHackingInstances,
        this.thresholds.rewardHacking
      );

      // Weighted average with equal weights
      const weights = {
        policy: 0.25,
        intent: 0.25,
        evaluator: 0.2,
        escalation: 0.15,
        hacking: 0.15,
      };

      const score = Math.round(
        policyScore * weights.policy +
          intentScore * weights.intent +
          evaluatorScore * weights.evaluator +
          escalationScore * weights.escalation +
          hackingScore * weights.hacking
      );

      // Clamp to 0-100 range
      return Math.max(0, Math.min(100, score));
    });
  }

  /**
   * Measure policy violation rate for a given period
   *
   * @param sessionId - Optional session ID to scope the measurement
   * @returns Policy violation rate (0-1)
   */
  async measurePolicyViolationRate(
    sessionId?: string
  ): Promise<ServiceResult<number>> {
    return this.executeOperation('measurePolicyViolationRate', async () => {
      const violations = await this.loadPolicyViolations(sessionId);
      const totalActions = await this.getTotalActions(sessionId);

      if (totalActions === 0) {
        return 0;
      }

      // Calculate daily violation rate
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailyViolations = violations.filter(v => {
        const violationDate = new Date(v.timestamp);
        return violationDate >= today;
      });

      const dailyActions = await this.getDailyActionCount(sessionId);

      return dailyActions > 0 ? dailyViolations.length / dailyActions : 0;
    });
  }

  /**
   * Measure intent-outcome gap (divergence from stated goals)
   *
   * @param sessionId - Optional session ID to scope the measurement
   * @returns Intent-outcome gap (0-1, where 0 is perfect alignment)
   */
  async measureIntentOutcomeGap(
    sessionId?: string
  ): Promise<ServiceResult<number>> {
    return this.executeOperation('measureIntentOutcomeGap', async () => {
      const records = await this.loadIntentOutcomeRecords(sessionId);

      if (records.length === 0) {
        return 0; // No data, assume aligned
      }

      // Average misalignment across all records
      const totalGap = records.reduce((sum, record) => {
        return sum + (1 - record.alignmentScore);
      }, 0);

      return totalGap / records.length;
    });
  }

  /**
   * Measure evaluator disagreement rate (human override frequency)
   *
   * @param sessionId - Optional session ID to scope the measurement
   * @returns Evaluator disagreement rate (0-1)
   */
  async measureEvaluatorDisagreement(
    sessionId?: string
  ): Promise<ServiceResult<number>> {
    return this.executeOperation('measureEvaluatorDisagreement', async () => {
      const decisions = await this.loadEvaluatorDecisions(sessionId);

      if (decisions.length === 0) {
        return 0;
      }

      // Calculate monthly override rate
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const monthlyDecisions = decisions.filter(
        d => new Date(d.timestamp) >= thirtyDaysAgo
      );

      if (monthlyDecisions.length === 0) {
        return 0;
      }

      const overrides = monthlyDecisions.filter(d => d.humanOverride);
      return overrides.length / monthlyDecisions.length;
    });
  }

  /**
   * Measure escalation suppression rate
   *
   * Detects if agents are avoiding escalation triggers
   * by comparing current escalation rate to baseline
   *
   * @param sessionId - Optional session ID to scope the measurement
   * @returns Escalation suppression rate (0-1, where 0 is no suppression)
   */
  async measureEscalationSuppression(
    sessionId?: string
  ): Promise<ServiceResult<number>> {
    return this.executeOperation('measureEscalationSuppression', async () => {
      const events = await this.loadEscalationEvents(sessionId);
      const baseline = await this.getEscalationBaseline(sessionId);

      if (events.length === 0 || baseline === 0) {
        return 0;
      }

      // Calculate current escalation rate
      const escalatedCount = events.filter(
        e => e.wasEscalated && !e.suppressed
      ).length;
      const currentRate = escalatedCount / events.length;

      // Suppression = drop from baseline
      const suppressionRate = Math.max(0, baseline - currentRate);

      // Normalize against threshold to get 0-1 value
      return Math.min(
        1,
        suppressionRate / this.thresholds.escalationSuppression
      );
    });
  }

  /**
   * Count reward hacking instances
   *
   * @param sessionId - Optional session ID to scope the count
   * @returns Number of reward hacking instances in the current month
   */
  async countRewardHackingInstances(
    sessionId?: string
  ): Promise<ServiceResult<number>> {
    return this.executeOperation('countRewardHackingInstances', async () => {
      const incidents = await this.loadRewardHackingIncidents(sessionId);

      // Filter to current month
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const monthlyIncidents = incidents.filter(
        i => new Date(i.timestamp) >= thirtyDaysAgo
      );

      return monthlyIncidents.length;
    });
  }

  /**
   * Get debt status from score
   *
   * @param score - Alignment debt score (0-100)
   * @returns Status interpretation
   */
  getDebtStatus(score: number): AlignmentDebtStatus {
    if (score < 20) {
      return 'healthy';
    } else if (score <= 50) {
      return 'concerning';
    } else {
      return 'critical';
    }
  }

  /**
   * Generate a comprehensive alignment debt report
   *
   * @param sessionId - Optional session ID to scope the report
   * @returns Complete alignment debt report
   */
  async generateReport(
    sessionId?: string
  ): Promise<ServiceResult<AlignmentDebtReport>> {
    return this.executeOperation('generateReport', async () => {
      const metrics = await this.gatherMetrics(sessionId);
      const scoreResult = await this.calculateAlignmentDebt(sessionId);

      if (!scoreResult.success || scoreResult.data === undefined) {
        throw new AnalysisError('Failed to calculate alignment debt score');
      }

      const score = scoreResult.data;
      const status = this.getDebtStatus(score);
      const dimensions = this.buildDimensions(metrics);
      const recommendations = this.generateRecommendations(dimensions, status);
      const trend = await this.calculateTrend(sessionId);

      const report: AlignmentDebtReport = {
        score,
        status,
        timestamp: new Date().toISOString(),
        sessionId,
        dimensions,
        metrics,
        recommendations,
        trend,
      };

      // Save report
      await this.saveReport(report);

      return report;
    });
  }

  /**
   * Gather all metrics for alignment calculation
   */
  private async gatherMetrics(sessionId?: string): Promise<AlignmentMetrics> {
    const [
      policyResult,
      intentResult,
      evaluatorResult,
      escalationResult,
      hackingResult,
    ] = await Promise.all([
      this.measurePolicyViolationRate(sessionId),
      this.measureIntentOutcomeGap(sessionId),
      this.measureEvaluatorDisagreement(sessionId),
      this.measureEscalationSuppression(sessionId),
      this.countRewardHackingInstances(sessionId),
    ]);

    return {
      policyViolationRate: policyResult.data ?? 0,
      intentOutcomeGap: intentResult.data ?? 0,
      evaluatorDisagreementRate: evaluatorResult.data ?? 0,
      escalationSuppressionRate: escalationResult.data ?? 0,
      rewardHackingInstances: hackingResult.data ?? 0,
    };
  }

  /**
   * Build dimension breakdown for report
   */
  private buildDimensions(metrics: AlignmentMetrics): AlignmentDimension[] {
    return [
      {
        name: 'Policy Violation Rate',
        value: metrics.policyViolationRate,
        threshold: this.thresholds.policyViolation,
        exceeded: metrics.policyViolationRate > this.thresholds.policyViolation,
        unit: '%',
        description: 'Daily rate of actions violating hard constraints',
      },
      {
        name: 'Intent-Outcome Gap',
        value: metrics.intentOutcomeGap,
        threshold: this.thresholds.intentOutcomeGap,
        exceeded: metrics.intentOutcomeGap > this.thresholds.intentOutcomeGap,
        unit: '%',
        description: 'Divergence between stated goals and actual outcomes',
      },
      {
        name: 'Evaluator Disagreement',
        value: metrics.evaluatorDisagreementRate,
        threshold: this.thresholds.evaluatorDisagreement,
        exceeded:
          metrics.evaluatorDisagreementRate >
          this.thresholds.evaluatorDisagreement,
        unit: '%',
        description: 'Monthly rate of human overrides on agent decisions',
      },
      {
        name: 'Escalation Suppression',
        value: metrics.escalationSuppressionRate,
        threshold: this.thresholds.escalationSuppression,
        exceeded:
          metrics.escalationSuppressionRate >
          this.thresholds.escalationSuppression,
        unit: '%',
        description: 'Drop in escalation rate from established baseline',
      },
      {
        name: 'Reward Hacking Instances',
        value: metrics.rewardHackingInstances,
        threshold: this.thresholds.rewardHacking,
        exceeded:
          metrics.rewardHackingInstances > this.thresholds.rewardHacking,
        unit: 'instances/month',
        description: 'Detected cases of gaming metrics without genuine intent',
      },
    ];
  }

  /**
   * Generate actionable recommendations based on dimensions
   */
  private generateRecommendations(
    dimensions: AlignmentDimension[],
    status: AlignmentDebtStatus
  ): string[] {
    const recommendations: string[] = [];

    // Dimension-specific recommendations
    for (const dim of dimensions) {
      if (dim.exceeded) {
        switch (dim.name) {
          case 'Policy Violation Rate':
            recommendations.push(
              `POLICY: Violation rate (${(dim.value * 100).toFixed(2)}%) exceeds threshold. ` +
                'Review agent constraints and add explicit hard constraint enforcement.'
            );
            break;
          case 'Intent-Outcome Gap':
            recommendations.push(
              `INTENT: Outcome divergence (${(dim.value * 100).toFixed(1)}%) exceeds threshold. ` +
                'Review reward function alignment with strategic objectives.'
            );
            break;
          case 'Evaluator Disagreement':
            recommendations.push(
              `EVALUATOR: Override rate (${(dim.value * 100).toFixed(1)}%) exceeds threshold. ` +
                'Retrain evaluator agents with recent Guardian decisions.'
            );
            break;
          case 'Escalation Suppression':
            recommendations.push(
              `ESCALATION: Suppression detected (${(dim.value * 100).toFixed(1)}% drop). ` +
                'Audit escalation triggers and ensure agents are not bypassing them.'
            );
            break;
          case 'Reward Hacking Instances':
            recommendations.push(
              `REWARD HACKING: ${dim.value} incidents detected. ` +
                'Review reward function for exploitable patterns and add countermeasures.'
            );
            break;
        }
      }
    }

    // Status-based recommendations
    switch (status) {
      case 'critical':
        recommendations.unshift(
          'CRITICAL: Alignment debt score exceeds 50. ' +
            'Immediate Architect intervention required. ' +
            'Consider pausing autonomous operations until review is complete.'
        );
        break;
      case 'concerning':
        recommendations.unshift(
          'CONCERNING: Alignment debt score is elevated (20-50). ' +
            'Schedule Guardian review within 24 hours. ' +
            'Monitor trends closely for further degradation.'
        );
        break;
      case 'healthy':
        if (recommendations.length === 0) {
          recommendations.push(
            'HEALTHY: All alignment dimensions within acceptable thresholds. ' +
              'Continue monitoring and maintain current practices.'
          );
        }
        break;
    }

    return recommendations;
  }

  /**
   * Calculate trend from historical reports
   */
  private async calculateTrend(
    sessionId?: string
  ): Promise<'improving' | 'stable' | 'degrading' | undefined> {
    try {
      const reports = await this.loadRecentReports(sessionId, 5);

      if (reports.length < 2) {
        return undefined;
      }

      const scores = reports.map(r => r.score);
      const oldest = scores[scores.length - 1];
      const newest = scores[0];

      if (oldest === undefined || newest === undefined) {
        return undefined;
      }

      const change = newest - oldest;

      if (Math.abs(change) < 5) {
        return 'stable';
      } else if (change < 0) {
        return 'improving';
      } else {
        return 'degrading';
      }
    } catch {
      return undefined;
    }
  }

  /**
   * Normalize a metric value to a 0-100 score
   * Score increases as value approaches and exceeds threshold
   */
  private normalizeToScore(value: number, threshold: number): number {
    if (threshold === 0) {
      return 0;
    }

    // Score calculation:
    // - At 0: score = 0
    // - At threshold: score = 50
    // - At 2x threshold: score = 100
    const ratio = value / threshold;
    return Math.min(100, ratio * 50);
  }

  /**
   * Save report to disk
   */
  private async saveReport(report: AlignmentDebtReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionSuffix = report.sessionId ? `-${report.sessionId}` : '';
    const filename = `alignment-debt${sessionSuffix}-${timestamp}.json`;

    await this.saveOutput(filename, JSON.stringify(report, null, 2));

    // Also save as latest
    const latestFilename = `latest${sessionSuffix}.json`;
    await this.saveOutput(latestFilename, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdown = this.formatMarkdownReport(report);
    await this.saveOutput(filename.replace('.json', '.md'), markdown);
  }

  /**
   * Format report as markdown
   */
  private formatMarkdownReport(report: AlignmentDebtReport): string {
    const statusEmoji = {
      healthy: 'green',
      concerning: 'yellow',
      critical: 'red',
    };

    return `# Alignment Debt Report

**Generated**: ${report.timestamp}
**Session**: ${report.sessionId || 'All Sessions'}
**Score**: ${report.score}/100
**Status**: ${report.status.toUpperCase()} (${statusEmoji[report.status]})
${report.trend ? `**Trend**: ${report.trend}` : ''}

## Summary

${
  report.status === 'critical'
    ? '> **CRITICAL**: Immediate Architect intervention required.\n'
    : report.status === 'concerning'
      ? '> **WARNING**: Elevated alignment debt detected.\n'
      : '> System operating within acceptable parameters.\n'
}

## Dimension Breakdown

| Dimension | Current | Threshold | Status |
|-----------|---------|-----------|--------|
${report.dimensions
  .map(
    d =>
      `| ${d.name} | ${this.formatDimensionValue(d)} | ${this.formatThreshold(d)} | ${d.exceeded ? 'EXCEEDED' : 'OK'} |`
  )
  .join('\n')}

## Recommendations

${report.recommendations.map(r => `- ${r}`).join('\n')}

## Next Steps

${this.getNextSteps(report.status)}
`;
  }

  private formatDimensionValue(dim: AlignmentDimension): string {
    if (dim.unit === 'instances/month') {
      return `${dim.value}`;
    }
    return `${(dim.value * 100).toFixed(2)}%`;
  }

  private formatThreshold(dim: AlignmentDimension): string {
    if (dim.unit === 'instances/month') {
      return `<${dim.threshold}`;
    }
    return `<${(dim.threshold * 100).toFixed(1)}%`;
  }

  private getNextSteps(status: AlignmentDebtStatus): string {
    switch (status) {
      case 'critical':
        return `1. **PAUSE** autonomous operations pending review
2. Alert Architect team immediately
3. Conduct root cause analysis on exceeded dimensions
4. Implement corrective measures before resuming
5. Re-evaluate alignment debt after interventions`;
      case 'concerning':
        return `1. Schedule Guardian review within 24 hours
2. Monitor trends for further degradation
3. Review exceeded dimensions for corrective actions
4. Consider reducing autonomy levels temporarily`;
      case 'healthy':
        return `1. Continue regular monitoring
2. Maintain current practices
3. Consider establishing new baseline if stable`;
    }
  }

  // Data loading methods (stub implementations - would connect to real telemetry)

  private async loadPolicyViolations(
    sessionId?: string
  ): Promise<PolicyViolation[]> {
    const dataPath = path.join(this.telemetryPath, 'policy-violations.json');
    try {
      if (await fs.pathExists(dataPath)) {
        const data = await fs.readJson(dataPath);
        const violations = data.violations || [];
        if (sessionId) {
          return violations.filter(
            (v: PolicyViolation) => v.sessionId === sessionId
          );
        }
        return violations;
      }
    } catch (error) {
      this.log('warn', 'Failed to load policy violations', { error });
    }
    return [];
  }

  private async loadIntentOutcomeRecords(
    sessionId?: string
  ): Promise<IntentOutcomeRecord[]> {
    const dataPath = path.join(this.telemetryPath, 'intent-outcomes.json');
    try {
      if (await fs.pathExists(dataPath)) {
        const data = await fs.readJson(dataPath);
        const records = data.records || [];
        if (sessionId) {
          return records.filter(
            (r: IntentOutcomeRecord) => r.sessionId === sessionId
          );
        }
        return records;
      }
    } catch (error) {
      this.log('warn', 'Failed to load intent-outcome records', { error });
    }
    return [];
  }

  private async loadEvaluatorDecisions(
    sessionId?: string
  ): Promise<EvaluatorDecision[]> {
    const dataPath = path.join(this.telemetryPath, 'evaluator-decisions.json');
    try {
      if (await fs.pathExists(dataPath)) {
        const data = await fs.readJson(dataPath);
        const decisions = data.decisions || [];
        if (sessionId) {
          return decisions.filter(
            (d: EvaluatorDecision) => d.sessionId === sessionId
          );
        }
        return decisions;
      }
    } catch (error) {
      this.log('warn', 'Failed to load evaluator decisions', { error });
    }
    return [];
  }

  private async loadEscalationEvents(
    sessionId?: string
  ): Promise<EscalationEvent[]> {
    const dataPath = path.join(this.telemetryPath, 'escalation-events.json');
    try {
      if (await fs.pathExists(dataPath)) {
        const data = await fs.readJson(dataPath);
        const events = data.events || [];
        if (sessionId) {
          return events.filter(
            (e: EscalationEvent) => e.sessionId === sessionId
          );
        }
        return events;
      }
    } catch (error) {
      this.log('warn', 'Failed to load escalation events', { error });
    }
    return [];
  }

  private async loadRewardHackingIncidents(
    sessionId?: string
  ): Promise<RewardHackingIncident[]> {
    const dataPath = path.join(this.telemetryPath, 'reward-hacking.json');
    try {
      if (await fs.pathExists(dataPath)) {
        const data = await fs.readJson(dataPath);
        const incidents = data.incidents || [];
        if (sessionId) {
          return incidents.filter(
            (i: RewardHackingIncident) => i.sessionId === sessionId
          );
        }
        return incidents;
      }
    } catch (error) {
      this.log('warn', 'Failed to load reward hacking incidents', { error });
    }
    return [];
  }

  private async getTotalActions(_sessionId?: string): Promise<number> {
    const dataPath = path.join(this.telemetryPath, 'action-counts.json');
    try {
      if (await fs.pathExists(dataPath)) {
        const data = await fs.readJson(dataPath);
        return data.totalActions || 0;
      }
    } catch (error) {
      this.log('warn', 'Failed to load action counts', { error });
    }
    return 0;
  }

  private async getDailyActionCount(_sessionId?: string): Promise<number> {
    const dataPath = path.join(this.telemetryPath, 'action-counts.json');
    try {
      if (await fs.pathExists(dataPath)) {
        const data = await fs.readJson(dataPath);
        return data.dailyActions || 0;
      }
    } catch (error) {
      this.log('warn', 'Failed to load daily action count', { error });
    }
    return 0;
  }

  private async getEscalationBaseline(_sessionId?: string): Promise<number> {
    const dataPath = path.join(this.governancePath, 'escalation-baseline.json');
    try {
      if (await fs.pathExists(dataPath)) {
        const data = await fs.readJson(dataPath);
        return data.baseline || 0.3; // Default 30% escalation rate
      }
    } catch (error) {
      this.log('warn', 'Failed to load escalation baseline', { error });
    }
    return 0.3; // Default baseline
  }

  private async loadRecentReports(
    sessionId: string | undefined,
    count: number
  ): Promise<AlignmentDebtReport[]> {
    try {
      const files = await fs.readdir(this.reportsDir);
      const sessionPattern = sessionId ? `-${sessionId}-` : '';
      const reportFiles = files
        .filter(
          f =>
            f.startsWith(`alignment-debt${sessionPattern}`) &&
            f.endsWith('.json')
        )
        .sort()
        .reverse()
        .slice(0, count);

      const reports: AlignmentDebtReport[] = [];
      for (const file of reportFiles) {
        const report = await fs.readJson(path.join(this.reportsDir, file));
        reports.push(report);
      }
      return reports;
    } catch {
      return [];
    }
  }

  // BaseService abstract method implementations

  protected async onInitialize(): Promise<void> {
    await fs.ensureDir(this.telemetryPath);
    await fs.ensureDir(this.governancePath);
    await fs.ensureDir(this.reportsDir);
    this.log('info', 'AlignmentDriftDetector initialized');
  }

  protected async onShutdown(): Promise<void> {
    this.log('info', 'AlignmentDriftDetector shutting down');
  }

  protected checkHealth(): boolean {
    return (
      fs.existsSync(this.telemetryPath) &&
      fs.existsSync(this.governancePath) &&
      fs.existsSync(this.reportsDir)
    );
  }
}

/**
 * Factory function to create an AlignmentDriftDetector instance
 *
 * @param config - Optional configuration
 * @returns Initialized AlignmentDriftDetector
 */
export async function createDriftDetector(
  config?: DriftDetectorConfig
): Promise<AlignmentDriftDetector> {
  const detector = new AlignmentDriftDetector(config);
  await detector.initialize();
  return detector;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const sessionId = args[1];

  const runCLI = async () => {
    const detector = await createDriftDetector({ verbose: true });

    switch (command) {
      case 'score':
        const scoreResult = await detector.calculateAlignmentDebt(sessionId);
        if (scoreResult.success) {
          console.log(`\nAlignment Debt Score: ${scoreResult.data}/100`);
          console.log(`Status: ${detector.getDebtStatus(scoreResult.data!)}`);
        } else {
          console.error(
            'Failed to calculate score:',
            scoreResult.error?.message
          );
          process.exit(1);
        }
        break;

      case 'report':
        const reportResult = await detector.generateReport(sessionId);
        if (reportResult.success) {
          const report = reportResult.data!;
          console.log('\n=== Alignment Debt Report ===');
          console.log(`Score: ${report.score}/100`);
          console.log(`Status: ${report.status.toUpperCase()}`);
          console.log('\nDimensions:');
          report.dimensions.forEach(d => {
            const status = d.exceeded ? 'EXCEEDED' : 'OK';
            console.log(
              `  - ${d.name}: ${d.value} (threshold: ${d.threshold}) [${status}]`
            );
          });
          console.log('\nRecommendations:');
          report.recommendations.forEach(r => console.log(`  - ${r}`));
        } else {
          console.error(
            'Failed to generate report:',
            reportResult.error?.message
          );
          process.exit(1);
        }
        break;

      case 'status':
        const statusResult = await detector.calculateAlignmentDebt(sessionId);
        if (statusResult.success) {
          const status = detector.getDebtStatus(statusResult.data!);
          console.log(status);
          process.exit(
            status === 'critical' ? 2 : status === 'concerning' ? 1 : 0
          );
        } else {
          console.error('Failed to get status');
          process.exit(3);
        }
        break;

      default:
        console.log(`
Usage: alignment-drift.ts <command> [sessionId]

Commands:
  score [sessionId]   - Calculate alignment debt score (0-100)
  report [sessionId]  - Generate comprehensive alignment debt report
  status [sessionId]  - Get status (exit code: 0=healthy, 1=concerning, 2=critical)

Examples:
  npx ts-node alignment-drift.ts score
  npx ts-node alignment-drift.ts report session-123
  npx ts-node alignment-drift.ts status && echo "All clear"
        `);
    }

    await detector.shutdown();
  };

  runCLI().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
