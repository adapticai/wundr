/**
 * Guardian Daily Report Generator
 * Generates alignment drift reports using Handlebars templates
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import * as Handlebars from 'handlebars';

import type {
  VPAlignmentDriftMetrics as AlignmentDriftMetrics,
  InterventionType,
} from './types';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for the report generator
 */
export interface ReportGeneratorConfig {
  /** Directory containing report templates */
  templateDir: string;
  /** Directory to save generated reports */
  outputDir: string;
  /** Organization name for reports */
  organizationName?: string;
  /** Include timestamps in filenames */
  timestampFilenames?: boolean;
  /** Date format for reports (default: YYYY-MM-DD) */
  dateFormat?: string;
}

// ============================================================================
// Data Types
// ============================================================================

/**
 * Drift data for a single session
 */
export interface SessionDriftData {
  /** Session identifier */
  sessionId: string;
  /** Drift score (0-100, higher = more drift) */
  score: number;
  /** Primary issue causing drift */
  primaryIssue: string;
  /** Timestamp of the session */
  timestamp?: Date;
  /** Agent identifier */
  agentId?: string;
}

/**
 * Dimension status indicating threshold compliance
 */
export type DimensionStatus = 'OK' | 'WARNING' | 'CRITICAL';

/**
 * Individual dimension data for breakdown
 */
export interface DimensionBreakdownItem {
  /** Dimension name */
  name: string;
  /** Current value as percentage */
  value: number;
  /** Threshold description */
  threshold: string;
  /** Status indicator */
  status: DimensionStatus;
}

/**
 * Severity level for intervention recommendations
 */
export type InterventionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Recommendation for intervention action
 */
export interface InterventionRecommendation {
  /** Severity of the recommendation */
  severity: InterventionSeverity;
  /** Recommended action to take */
  action: string;
  /** Dimension that triggered this recommendation */
  dimension: string;
  /** Rationale for the recommendation */
  rationale: string;
  /** Urgency in hours */
  urgency: number;
  /** Intervention type reference */
  type?: InterventionType;
}

/**
 * Overall status of the alignment report
 */
export type AlignmentStatus = 'HEALTHY' | 'ATTENTION_NEEDED' | 'CRITICAL';

/**
 * Data required for daily report generation
 */
export interface DailyReportData {
  /** Report date */
  date: string;
  /** Aggregate drift score (0-100) */
  aggregateDriftScore: number;
  /** Overall status */
  status: AlignmentStatus;
  /** Top sessions by drift score */
  topSessions: SessionDriftData[];
  /** Breakdown by alignment dimension */
  dimensionBreakdown: AlignmentDriftMetrics;
  /** Recommended interventions */
  interventions: InterventionRecommendation[];
  /** Session IDs requiring guardian review */
  reviewQueue: string[];
}

/**
 * Weekly trend data point
 */
export interface WeeklyTrendDataPoint {
  /** Date of the data point */
  date: string;
  /** Aggregate drift score */
  aggregateDriftScore: number;
  /** Status on that day */
  status: AlignmentStatus;
}

/**
 * Data required for weekly report generation
 */
export interface WeeklyReportData {
  /** Week start date */
  weekStart: string;
  /** Week end date */
  weekEnd: string;
  /** Average drift score for the week */
  averageDriftScore: number;
  /** Trend direction */
  trend: 'improving' | 'stable' | 'degrading';
  /** Daily data points */
  dailyData: WeeklyTrendDataPoint[];
  /** Top 20 sessions by drift score */
  topSessions: SessionDriftData[];
  /** Summary of interventions taken */
  interventionsSummary: {
    total: number;
    byType: Record<InterventionType, number>;
    successful: number;
  };
  /** Sessions that needed review */
  reviewedSessions: {
    total: number;
    approved: number;
    escalated: number;
  };
}

// ============================================================================
// Report Generator Class
// ============================================================================

/**
 * Generates daily and weekly Guardian alignment reports
 */
export class ReportGenerator {
  private config: ReportGeneratorConfig;
  private templateEngine: typeof Handlebars;
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(config: ReportGeneratorConfig) {
    this.config = {
      timestampFilenames: true,
      dateFormat: 'YYYY-MM-DD',
      ...config,
    };
    this.templateEngine = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Helper to increment index for 1-based ranking
    this.templateEngine.registerHelper('inc', (value: number) => value + 1);

    // Helper for status badge formatting
    this.templateEngine.registerHelper('statusBadge', (status: string) => {
      const badges: Record<string, string> = {
        OK: '[OK]',
        WARNING: '[WARNING]',
        CRITICAL: '[CRITICAL]',
        HEALTHY: '[HEALTHY]',
        ATTENTION_NEEDED: '[ATTENTION NEEDED]',
      };
      return badges[status] || `[${status}]`;
    });

    // Helper for percentage formatting
    this.templateEngine.registerHelper('pct', (value: number, decimals = 1) => {
      return (value * 100).toFixed(decimals);
    });

    // Helper for conditional comparison
    this.templateEngine.registerHelper(
      'ifGt',
      function (
        this: unknown,
        a: number,
        b: number,
        options: Handlebars.HelperOptions
      ) {
        return a > b ? options.fn(this) : options.inverse(this);
      }
    );
  }

  /**
   * Load a template by name from the templates directory
   */
  private async loadTemplate(
    name: string
  ): Promise<HandlebarsTemplateDelegate> {
    // Check cache first
    const cached = this.templateCache.get(name);
    if (cached) {
      return cached;
    }

    const templatePath = path.join(this.config.templateDir, `${name}.md`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const compiled = this.templateEngine.compile(templateContent);

    // Cache the compiled template
    this.templateCache.set(name, compiled);
    return compiled;
  }

  /**
   * Format session data into a markdown table
   */
  private formatSessionTable(sessions: SessionDriftData[]): string {
    if (sessions.length === 0) {
      return '| - | No sessions with drift detected | - | - |\n';
    }

    return sessions
      .map((session, index) => {
        const rank = index + 1;
        const score = session.score.toFixed(1);
        return `| ${rank} | ${session.sessionId} | ${score} | ${session.primaryIssue} |`;
      })
      .join('\n');
  }

  /**
   * Format alignment drift metrics into dimension breakdown
   */
  private formatDimensionBreakdown(metrics: AlignmentDriftMetrics): {
    policyViolation: DimensionBreakdownItem;
    intentOutcomeGap: DimensionBreakdownItem;
    evaluatorDisagreement: DimensionBreakdownItem;
    escalationSuppression: DimensionBreakdownItem;
    rewardHacking: DimensionBreakdownItem;
  } {
    const getStatus = (
      value: number,
      warningThreshold: number,
      criticalThreshold: number
    ): DimensionStatus => {
      if (value >= criticalThreshold) {
        return 'CRITICAL';
      }
      if (value >= warningThreshold) {
        return 'WARNING';
      }
      return 'OK';
    };

    return {
      policyViolation: {
        name: 'Policy Violation Rate',
        value: metrics.policyViolationRate * 100,
        threshold: '<0.5%',
        status: getStatus(metrics.policyViolationRate, 0.003, 0.005),
      },
      intentOutcomeGap: {
        name: 'Intent-Outcome Gap',
        value: metrics.intentOutcomeGap * 100,
        threshold: '<15%',
        status: getStatus(metrics.intentOutcomeGap, 0.1, 0.15),
      },
      evaluatorDisagreement: {
        name: 'Evaluator Disagreement',
        value: metrics.evaluatorDisagreement * 100,
        threshold: '<20%',
        status: getStatus(metrics.evaluatorDisagreement, 0.15, 0.2),
      },
      escalationSuppression: {
        name: 'Escalation Suppression',
        value: metrics.escalationSuppression * 100,
        threshold: '<40% drop',
        status: getStatus(metrics.escalationSuppression, 0.3, 0.4),
      },
      rewardHacking: {
        name: 'Reward Hacking Instances',
        value: metrics.rewardHacking,
        threshold: '<5/month',
        status:
          metrics.rewardHacking >= 5
            ? 'CRITICAL'
            : metrics.rewardHacking >= 3
              ? 'WARNING'
              : 'OK',
      },
    };
  }

  /**
   * Format intervention recommendations for template rendering
   */
  private formatInterventions(
    recommendations: InterventionRecommendation[]
  ): Array<{
    severity: string;
    action: string;
    dimension: string;
    rationale: string;
    urgency: number;
  }> {
    return recommendations.map(rec => ({
      severity: rec.severity,
      action: rec.action,
      dimension: rec.dimension,
      rationale: rec.rationale,
      urgency: rec.urgency,
    }));
  }

  /**
   * Format review queue session IDs for template rendering
   */
  private formatReviewQueue(sessions: string[]): string[] {
    return sessions.map(
      sessionId => `Session ${sessionId} - Requires manual review`
    );
  }

  /**
   * Generate a daily alignment report
   */
  async generateDailyReport(data: DailyReportData): Promise<string> {
    const template = await this.loadTemplate('daily-report');

    const dimensions = this.formatDimensionBreakdown(data.dimensionBreakdown);

    const templateData = {
      date: data.date,
      aggregateDriftScore: data.aggregateDriftScore.toFixed(1),
      status: data.status,
      topSessions: data.topSessions.slice(0, 10).map((session, index) => ({
        rank: index + 1,
        sessionId: session.sessionId,
        score: session.score.toFixed(1),
        primaryIssue: session.primaryIssue,
      })),
      dimensions: {
        policyViolation: {
          value: dimensions.policyViolation.value.toFixed(2),
          status: dimensions.policyViolation.status,
        },
        intentOutcomeGap: {
          value: dimensions.intentOutcomeGap.value.toFixed(1),
          status: dimensions.intentOutcomeGap.status,
        },
        evaluatorDisagreement: {
          value: dimensions.evaluatorDisagreement.value.toFixed(1),
          status: dimensions.evaluatorDisagreement.status,
        },
        escalationSuppression: {
          value: dimensions.escalationSuppression.value.toFixed(1),
          status: dimensions.escalationSuppression.status,
        },
        rewardHacking: {
          value: dimensions.rewardHacking.value,
          status: dimensions.rewardHacking.status,
        },
      },
      interventions: this.formatInterventions(data.interventions),
      reviewQueue: this.formatReviewQueue(data.reviewQueue),
    };

    return template(templateData);
  }

  /**
   * Generate a weekly alignment report
   */
  async generateWeeklyReport(data: WeeklyReportData): Promise<string> {
    const template = await this.loadTemplate('weekly-report');

    const trendEmoji = {
      improving: 'Improving',
      stable: 'Stable',
      degrading: 'Degrading',
    };

    const templateData = {
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      averageDriftScore: data.averageDriftScore.toFixed(1),
      trend: trendEmoji[data.trend],
      trendDirection: data.trend,
      dailyData: data.dailyData.map(day => ({
        date: day.date,
        score: day.aggregateDriftScore.toFixed(1),
        status: day.status,
      })),
      topSessions: data.topSessions.slice(0, 20).map((session, index) => ({
        rank: index + 1,
        sessionId: session.sessionId,
        score: session.score.toFixed(1),
        primaryIssue: session.primaryIssue,
      })),
      interventionsSummary: {
        total: data.interventionsSummary.total,
        byType: Object.entries(data.interventionsSummary.byType).map(
          ([type, count]) => ({
            type,
            count,
          })
        ),
        successful: data.interventionsSummary.successful,
        successRate:
          data.interventionsSummary.total > 0
            ? (
                (data.interventionsSummary.successful /
                  data.interventionsSummary.total) *
                100
              ).toFixed(1)
            : '0.0',
      },
      reviewedSessions: {
        total: data.reviewedSessions.total,
        approved: data.reviewedSessions.approved,
        escalated: data.reviewedSessions.escalated,
        approvalRate:
          data.reviewedSessions.total > 0
            ? (
                (data.reviewedSessions.approved / data.reviewedSessions.total) *
                100
              ).toFixed(1)
            : '0.0',
      },
    };

    return template(templateData);
  }

  /**
   * Save a generated report to the output directory
   */
  async saveReport(report: string, filename: string): Promise<string> {
    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });

    // Add timestamp if configured
    let finalFilename = filename;
    if (this.config.timestampFilenames && !filename.includes('-')) {
      const timestamp = new Date().toISOString().split('T')[0];
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      finalFilename = `${base}-${timestamp}${ext}`;
    }

    const outputPath = path.join(this.config.outputDir, finalFilename);
    await fs.writeFile(outputPath, report, 'utf-8');

    return outputPath;
  }

  /**
   * Clear the template cache
   */
  clearTemplateCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<ReportGeneratorConfig> {
    return { ...this.config };
  }
}

export default ReportGenerator;
