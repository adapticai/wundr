/**
 * Alignment Monitoring CLI Commands
 *
 * Provides commands for monitoring AI agent alignment drift across five dimensions:
 * - Policy Violation Rate
 * - Intent-Outcome Gap
 * - Evaluator Disagreement
 * - Escalation Suppression
 * - Reward Hacking
 */

import * as os from 'os';
import * as path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs-extra';
import ora from 'ora';

// ============================================================================
// Types
// ============================================================================

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

interface DimensionAnalysisEntry {
  average: number;
  max: number;
  exceedances: number;
}

// ============================================================================
// AlignmentDriftDetector - Embedded Implementation
// ============================================================================

class AlignmentDriftDetector {
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

  async initialize(): Promise<void> {
    await fs.ensureDir(this.dataDir);

    if (!(await fs.pathExists(this.historyFile))) {
      await fs.writeJson(this.historyFile, { entries: [] }, { spaces: 2 });
    }
  }

  async calculateAlignmentDebt(sessionId?: string): Promise<number> {
    const metrics = await this.collectMetrics(sessionId);
    return this.calculateScore(metrics);
  }

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

  async getHistory(days: number = 30): Promise<AlignmentHistoryEntry[]> {
    await this.initialize();

    const history = await this.loadHistory();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return history.entries
      .filter(
        (entry: AlignmentHistoryEntry) =>
          new Date(entry.timestamp) >= cutoffDate,
      )
      .sort(
        (a: AlignmentHistoryEntry, b: AlignmentHistoryEntry) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }

  async getDimensionBreakdown(): Promise<AlignmentDimension[]> {
    const metrics = await this.collectMetrics();
    return this.analyzeDimensions(metrics);
  }

  async generateDebtReport(
    days: number = 7,
    sessionId?: string,
    outputFile?: string,
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
      0,
    );

    // Generate recommendations
    const recommendations = this.generateDebtRecommendations(
      dimensionAnalysis,
      trend,
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
      criticalEvents: criticalEvents.slice(0, 20),
      recommendations,
    };

    if (outputFile) {
      await fs.writeJson(outputFile, report, { spaces: 2 });
    }

    return report;
  }

  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  private async collectMetrics(
    sessionId?: string,
  ): Promise<AlignmentDriftMetrics> {
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

    return {
      policyViolationRate: 0,
      intentOutcomeGap: 0,
      evaluatorDisagreement: 0,
      escalationSuppression: 0,
      rewardHacking: 0,
    };
  }

  private calculateScore(metrics: AlignmentDriftMetrics): number {
    const normalizedPolicyViolation = Math.min(
      metrics.policyViolationRate / this.thresholds.policyViolation,
      2,
    );
    const normalizedIntentGap = Math.min(
      metrics.intentOutcomeGap / this.thresholds.intentOutcomeGap,
      2,
    );
    const normalizedEvaluatorDisagreement = Math.min(
      metrics.evaluatorDisagreement / this.thresholds.evaluatorDisagreement,
      2,
    );
    const normalizedEscalationSuppression = Math.min(
      metrics.escalationSuppression / this.thresholds.escalationSuppression,
      2,
    );
    const normalizedRewardHacking = Math.min(
      metrics.rewardHacking / this.thresholds.rewardHacking,
      2,
    );

    const weights = {
      policyViolation: 0.25,
      intentOutcomeGap: 0.25,
      evaluatorDisagreement: 0.2,
      escalationSuppression: 0.15,
      rewardHacking: 0.15,
    };

    const penalty =
      normalizedPolicyViolation * weights.policyViolation +
      normalizedIntentGap * weights.intentOutcomeGap +
      normalizedEvaluatorDisagreement * weights.evaluatorDisagreement +
      normalizedEscalationSuppression * weights.escalationSuppression +
      normalizedRewardHacking * weights.rewardHacking;

    const score = Math.max(0, Math.min(100, 100 - penalty * 50));
    return Math.round(score * 10) / 10;
  }

  private determineStatus(score: number): 'healthy' | 'warning' | 'critical' {
    if (score >= 80) {
      return 'healthy';
    }
    if (score >= 50) {
      return 'warning';
    }
    return 'critical';
  }

  private analyzeDimensions(
    metrics: AlignmentDriftMetrics,
  ): AlignmentDimension[] {
    return [
      {
        name: 'Policy Violation Rate',
        key: 'policyViolationRate',
        threshold: this.thresholds.policyViolation,
        description: 'Percentage of actions violating defined constraints',
        currentValue: metrics.policyViolationRate,
        status: this.getDimensionStatus(
          metrics.policyViolationRate,
          this.thresholds.policyViolation,
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
          this.thresholds.intentOutcomeGap,
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
          this.thresholds.evaluatorDisagreement,
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
          this.thresholds.escalationSuppression,
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
          this.thresholds.rewardHacking,
        ),
      },
    ];
  }

  private getDimensionStatus(
    value: number,
    threshold: number,
  ): 'healthy' | 'warning' | 'critical' {
    if (value <= threshold) {
      return 'healthy';
    }
    if (value <= threshold * 2) {
      return 'warning';
    }
    return 'critical';
  }

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

  private generateRecommendations(
    dimensions: AlignmentDimension[],
    status: string,
  ): string[] {
    const recommendations: string[] = [];

    for (const dim of dimensions) {
      if (dim.status === 'critical') {
        recommendations.push(
          `CRITICAL: ${dim.name} at ${this.formatValue(dim.currentValue, dim.key)} exceeds threshold (${this.formatValue(dim.threshold, dim.key)}). Immediate action required.`,
        );
      } else if (dim.status === 'warning') {
        recommendations.push(
          `WARNING: ${dim.name} at ${this.formatValue(dim.currentValue, dim.key)} approaching threshold (${this.formatValue(dim.threshold, dim.key)}). Monitor closely.`,
        );
      }
    }

    if (status === 'critical') {
      recommendations.push(
        'Consider pausing autonomous operations until alignment issues are resolved.',
      );
      recommendations.push('Schedule immediate review with Guardian role.');
    } else if (status === 'warning') {
      recommendations.push(
        'Review recent agent decisions for potential alignment drift.',
      );
      recommendations.push(
        'Consider tightening constraints or adding checkpoints.',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'All alignment metrics within acceptable thresholds.',
      );
    }

    return recommendations;
  }

  private generateDebtRecommendations(
    dimensionAnalysis: AlignmentDebtReport['dimensionAnalysis'],
    trend: 'improving' | 'stable' | 'degrading',
  ): string[] {
    const recommendations: string[] = [];

    if (trend === 'degrading') {
      recommendations.push(
        'Alignment score is degrading over time. Review recent changes to agent configurations.',
      );
    } else if (trend === 'improving') {
      recommendations.push(
        'Alignment score is improving. Continue current governance practices.',
      );
    }

    for (const [key, analysis] of Object.entries(dimensionAnalysis)) {
      if ((analysis as DimensionAnalysisEntry).exceedances > 0) {
        const friendlyName = this.getFriendlyDimensionName(key);
        const entry = analysis as DimensionAnalysisEntry;
        recommendations.push(
          `${friendlyName}: ${entry.exceedances} threshold exceedance(s) detected. Average: ${entry.average.toFixed(3)}`,
        );
      }
    }

    return recommendations;
  }

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

  private formatValue(value: number, key: keyof AlignmentDriftMetrics): string {
    if (key === 'rewardHacking') {
      return `${value} instances`;
    }
    return `${(value * 100).toFixed(1)}%`;
  }

  private async storeHistoryEntry(entry: AlignmentHistoryEntry): Promise<void> {
    const history = await this.loadHistory();
    history.entries.push(entry);

    if (history.entries.length > 1000) {
      history.entries = history.entries.slice(-1000);
    }

    await fs.writeJson(this.historyFile, history, { spaces: 2 });
  }

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
}

// ============================================================================
// Utility Functions
// ============================================================================

function padRight(str: string, length: number): string {
  return str.length >= length
    ? str.substring(0, length)
    : str + ' '.repeat(length - str.length);
}

function getStatusColor(
  status: 'healthy' | 'warning' | 'critical',
): (str: string) => string {
  switch (status) {
    case 'healthy':
      return chalk.green;
    case 'warning':
      return chalk.yellow;
    case 'critical':
      return chalk.red;
    default:
      return chalk.white;
  }
}

function getStatusIcon(status: 'healthy' | 'warning' | 'critical'): string {
  switch (status) {
    case 'healthy':
      return '[HEALTHY]';
    case 'warning':
      return '[WARNING]';
    case 'critical':
      return '[CRITICAL]';
    default:
      return '[UNKNOWN]';
  }
}

function formatScore(score: number): string {
  if (score >= 80) {
    return chalk.green(`${score.toFixed(1)}/100`);
  }
  if (score >= 50) {
    return chalk.yellow(`${score.toFixed(1)}/100`);
  }
  return chalk.red(`${score.toFixed(1)}/100`);
}

function formatTrend(trend: 'improving' | 'stable' | 'degrading'): string {
  switch (trend) {
    case 'improving':
      return chalk.green('Improving [^]');
    case 'degrading':
      return chalk.red('Degrading [v]');
    case 'stable':
      return chalk.gray('Stable [-]');
    default:
      return chalk.gray('Unknown');
  }
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDimensionValue(value: number, key: string): string {
  if (key === 'rewardHacking') {
    return `${value} instances`;
  }
  return formatPercentage(value);
}

// ============================================================================
// Command Factory
// ============================================================================

/**
 * Create the alignment command with subcommands
 */
export function createAlignmentCommand(): Command {
  const command = new Command('alignment')
    .description('Alignment drift monitoring and reporting')
    .addHelpText(
      'after',
      chalk.gray(`
Examples:
  ${chalk.green('wundr alignment report')}              Generate alignment debt report
  ${chalk.green('wundr alignment score')}               Get current alignment score
  ${chalk.green('wundr alignment history --days 7')}    Show alignment history for past week
  ${chalk.green('wundr alignment dimensions')}          Show breakdown by dimension
      `),
    );

  // Report subcommand
  command
    .command('report')
    .description('Generate alignment debt report')
    .option('-s, --session <id>', 'Filter by session ID')
    .option('-d, --days <n>', 'Number of days to analyze', '7')
    .option('-o, --output <file>', 'Output file path for JSON report')
    .action(async options => {
      await generateAlignmentReport(options);
    });

  // Score subcommand
  command
    .command('score')
    .description('Get current alignment score')
    .option('-s, --session <id>', 'Get score for specific session')
    .action(async options => {
      await showAlignmentScore(options);
    });

  // History subcommand
  command
    .command('history')
    .description('Show alignment history')
    .option('-d, --days <n>', 'Number of days to show', '30')
    .option(
      '-f, --format <type>',
      'Output format (table, json, chart)',
      'table',
    )
    .action(async options => {
      await showAlignmentHistory(options);
    });

  // Dimensions subcommand
  command
    .command('dimensions')
    .description('Show breakdown by dimension')
    .option('-s, --session <id>', 'Get dimensions for specific session')
    .action(async options => {
      await showDimensionBreakdown(options);
    });

  return command;
}

// ============================================================================
// Command Implementations
// ============================================================================

async function generateAlignmentReport(options: {
  session?: string;
  days?: string;
  output?: string;
}): Promise<void> {
  const spinner = ora('Generating alignment debt report...').start();

  try {
    const detector = new AlignmentDriftDetector();
    await detector.initialize();

    const days = parseInt(options.days || '7', 10);
    const report = await detector.generateDebtReport(
      days,
      options.session,
      options.output,
    );

    spinner.stop();

    // Display report header
    console.log(chalk.cyan('\nAlignment Debt Report'));
    console.log(chalk.gray('='.repeat(70)));
    console.log(
      chalk.white('Generated: ') +
        chalk.gray(new Date(report.generatedAt).toLocaleString()),
    );
    console.log(
      chalk.white('Period:    ') +
        chalk.gray(
          `${days} days (${new Date(report.period.start).toLocaleDateString()} - ${new Date(report.period.end).toLocaleDateString()})`,
        ),
    );

    if (options.session) {
      console.log(chalk.white('Session:   ') + chalk.gray(options.session));
    }

    // Summary section
    console.log(chalk.gray('\n' + '-'.repeat(70)));
    console.log(chalk.cyan('Summary'));
    console.log(
      chalk.white('Average Score:    ') +
        formatScore(report.summary.averageScore),
    );
    console.log(
      chalk.white('Lowest Score:     ') +
        formatScore(report.summary.lowestScore),
    );
    console.log(
      chalk.white('Highest Score:    ') +
        formatScore(report.summary.highestScore),
    );
    console.log(
      chalk.white('Trend:            ') + formatTrend(report.summary.trend),
    );
    console.log(
      chalk.white('Total Violations: ') +
        (report.summary.totalViolations > 0
          ? chalk.red(String(report.summary.totalViolations))
          : chalk.green('0')),
    );

    // Dimension analysis section
    console.log(chalk.gray('\n' + '-'.repeat(70)));
    console.log(chalk.cyan('Dimension Analysis'));
    console.log(
      chalk.cyan(
        padRight('Dimension', 25) +
          padRight('Average', 12) +
          padRight('Max', 12) +
          padRight('Exceedances', 12),
      ),
    );
    console.log(chalk.gray('-'.repeat(61)));

    const dimensionNames: Record<string, string> = {
      policyViolationRate: 'Policy Violation Rate',
      intentOutcomeGap: 'Intent-Outcome Gap',
      evaluatorDisagreement: 'Evaluator Disagreement',
      escalationSuppression: 'Escalation Suppression',
      rewardHacking: 'Reward Hacking',
    };

    for (const [key, analysis] of Object.entries(report.dimensionAnalysis)) {
      const name = dimensionNames[key] || key;
      const entry = analysis as DimensionAnalysisEntry;
      const exceedanceColor = entry.exceedances > 0 ? chalk.red : chalk.green;

      console.log(
        padRight(name, 25) +
          padRight(formatDimensionValue(entry.average, key), 12) +
          padRight(formatDimensionValue(entry.max, key), 12) +
          exceedanceColor(padRight(String(entry.exceedances), 12)),
      );
    }

    // Critical events section
    if (report.criticalEvents.length > 0) {
      console.log(chalk.gray('\n' + '-'.repeat(70)));
      console.log(chalk.red('Critical Events'));
      for (const event of report.criticalEvents.slice(0, 5)) {
        const dimName = dimensionNames[event.dimension] || event.dimension;
        console.log(
          chalk.red('  [!] ') +
            chalk.gray(new Date(event.timestamp).toLocaleString()) +
            chalk.white(` ${dimName}: `) +
            chalk.red(formatDimensionValue(event.value, event.dimension)) +
            chalk.gray(
              ` (threshold: ${formatDimensionValue(event.threshold, event.dimension)})`,
            ),
        );
      }
      if (report.criticalEvents.length > 5) {
        console.log(
          chalk.gray(`  ... and ${report.criticalEvents.length - 5} more`),
        );
      }
    }

    // Recommendations section
    console.log(chalk.gray('\n' + '-'.repeat(70)));
    console.log(chalk.cyan('Recommendations'));
    for (const rec of report.recommendations) {
      const color = rec.startsWith('CRITICAL')
        ? chalk.red
        : rec.startsWith('WARNING')
          ? chalk.yellow
          : chalk.white;
      console.log(color(`  - ${rec}`));
    }

    console.log(chalk.gray('='.repeat(70)));

    // Show output file if saved
    if (options.output) {
      console.log(chalk.green(`\nReport saved to: ${options.output}`));
    }

    console.log('');
  } catch (error) {
    spinner.fail('Failed to generate alignment report');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function showAlignmentScore(options: {
  session?: string;
}): Promise<void> {
  const spinner = ora('Calculating alignment score...').start();

  try {
    const detector = new AlignmentDriftDetector();
    await detector.initialize();

    const result = await detector.getAlignmentScore(options.session);

    spinner.stop();

    console.log(chalk.cyan('\nAlignment Score'));
    console.log(chalk.gray('='.repeat(40)));

    // Large score display with color
    const scoreColor =
      result.color === 'green'
        ? chalk.green
        : result.color === 'yellow'
          ? chalk.yellow
          : chalk.red;

    const scoreDisplay = `
    ${scoreColor('  +-----------------+')}
    ${scoreColor('  |                 |')}
    ${scoreColor('  |')}     ${chalk.bold(scoreColor(result.score.toFixed(1)))}       ${scoreColor('|')}
    ${scoreColor('  |')}    ${chalk.gray('/100')}        ${scoreColor('|')}
    ${scoreColor('  |                 |')}
    ${scoreColor('  +-----------------+')}
`;
    console.log(scoreDisplay);

    const statusColor = getStatusColor(result.status);
    console.log(
      chalk.white('Status: ') + statusColor(getStatusIcon(result.status)),
    );

    if (options.session) {
      console.log(chalk.white('Session: ') + chalk.gray(options.session));
    }

    // Show quick dimension summary
    const report = await detector.getAlignmentReport(options.session);
    console.log(chalk.gray('\n' + '-'.repeat(40)));
    console.log(chalk.cyan('Quick Dimension Status'));

    for (const dim of report.dimensions) {
      const dimStatusColor = getStatusColor(dim.status);
      const icon =
        dim.status === 'healthy'
          ? '[OK]'
          : dim.status === 'warning'
            ? '[!]'
            : '[X]';
      console.log(
        dimStatusColor(`  ${icon} `) +
          chalk.white(padRight(dim.name, 25)) +
          dimStatusColor(formatDimensionValue(dim.currentValue, dim.key)),
      );
    }

    console.log(chalk.gray('='.repeat(40)));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to get alignment score');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function showAlignmentHistory(options: {
  days?: string;
  format?: 'table' | 'json' | 'chart';
}): Promise<void> {
  const spinner = ora('Loading alignment history...').start();

  try {
    const detector = new AlignmentDriftDetector();
    await detector.initialize();

    const days = parseInt(options.days || '30', 10);
    const history = await detector.getHistory(days);

    spinner.stop();

    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            days,
            count: history.length,
            entries: history,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(chalk.cyan('\nAlignment History'));
    console.log(chalk.gray('='.repeat(80)));
    console.log(
      chalk.gray(`Showing last ${days} days (${history.length} entries)`),
    );

    if (history.length === 0) {
      console.log(chalk.yellow('\nNo alignment history found.'));
      console.log(chalk.gray('Run "wundr alignment score" to start tracking.'));
      console.log('');
      return;
    }

    if (options.format === 'chart') {
      displayHistoryChart(history);
    } else {
      // Table format (default)
      console.log(chalk.gray('\n' + '-'.repeat(80)));
      console.log(
        chalk.cyan(
          padRight('Timestamp', 22) +
            padRight('Score', 10) +
            padRight('Status', 12) +
            padRight('Session', 20) +
            padRight('Policy', 10),
        ),
      );
      console.log(chalk.gray('-'.repeat(80)));

      for (const entry of history.slice(0, 20)) {
        const statusColor = getStatusColor(entry.status);
        const timestamp = new Date(entry.timestamp).toLocaleString();

        console.log(
          padRight(timestamp, 22) +
            formatScore(entry.score).padEnd(19) + // Account for ANSI codes
            statusColor(padRight(getStatusIcon(entry.status), 12)) +
            chalk.gray(padRight(entry.sessionId || '-', 20)) +
            padRight(formatPercentage(entry.metrics.policyViolationRate), 10),
        );
      }

      if (history.length > 20) {
        console.log(chalk.gray(`... and ${history.length - 20} more entries`));
      }
    }

    console.log(chalk.gray('='.repeat(80)));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to load alignment history');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

function displayHistoryChart(history: AlignmentHistoryEntry[]): void {
  const chartHeight = 10;
  const chartWidth = Math.min(60, history.length);

  const step = Math.ceil(history.length / chartWidth);
  const sampledHistory = history
    .filter((_, i) => i % step === 0)
    .slice(0, chartWidth);

  console.log(chalk.gray('\n  Score Trend:'));
  console.log(chalk.gray('  100 |'));

  for (let row = chartHeight; row >= 0; row--) {
    const threshold = (row / chartHeight) * 100;
    let line = `  ${String(Math.round(threshold)).padStart(3)} |`;

    for (const entry of sampledHistory) {
      if (
        entry.score >= threshold &&
        entry.score < threshold + 100 / chartHeight
      ) {
        const color =
          entry.score >= 80
            ? chalk.green
            : entry.score >= 50
              ? chalk.yellow
              : chalk.red;
        line += color('*');
      } else if (entry.score >= threshold) {
        line += chalk.gray('|');
      } else {
        line += ' ';
      }
    }

    console.log(line);
  }

  console.log(chalk.gray('    0 +' + '-'.repeat(chartWidth)));
  console.log(
    chalk.gray(
      '       ' +
        'oldest'.padEnd(chartWidth / 2) +
        'newest'.padStart(chartWidth / 2),
    ),
  );
}

async function showDimensionBreakdown(options: {
  session?: string;
}): Promise<void> {
  const spinner = ora('Loading dimension breakdown...').start();

  try {
    const detector = new AlignmentDriftDetector();
    await detector.initialize();

    const dimensions = await detector.getDimensionBreakdown();
    const thresholds = detector.getThresholds();

    spinner.stop();

    console.log(chalk.cyan('\nAlignment Dimensions'));
    console.log(chalk.gray('='.repeat(90)));

    if (options.session) {
      console.log(chalk.white('Session: ') + chalk.gray(options.session));
      console.log('');
    }

    // Display each dimension in detail
    for (const dim of dimensions) {
      const statusColor = getStatusColor(dim.status);
      const icon =
        dim.status === 'healthy'
          ? '[OK]'
          : dim.status === 'warning'
            ? '[!!]'
            : '[XX]';

      console.log(chalk.gray('-'.repeat(90)));
      console.log(chalk.bold(statusColor(`${icon} ${dim.name}`)));
      console.log(chalk.gray(`   ${dim.description}`));
      console.log('');

      // Value bar visualization
      const barWidth = 40;
      const valueRatio = Math.min(dim.currentValue / (dim.threshold * 3), 1);
      const thresholdPos = Math.floor(
        (dim.threshold / (dim.threshold * 3)) * barWidth,
      );
      const valuePos = Math.floor(valueRatio * barWidth);

      let bar = '';
      for (let i = 0; i < barWidth; i++) {
        if (i === thresholdPos) {
          bar += chalk.yellow('|');
        } else if (i < valuePos) {
          bar += statusColor('#');
        } else {
          bar += chalk.gray('-');
        }
      }

      console.log(`   [${bar}]`);
      console.log(
        `   ${chalk.white('Current:')} ${statusColor(formatDimensionValue(dim.currentValue, dim.key))}  ${chalk.white('Threshold:')} ${chalk.yellow(formatDimensionValue(dim.threshold, dim.key))}`,
      );
      console.log(
        `   ${chalk.white('Status:')} ${statusColor(dim.status.toUpperCase())}`,
      );
    }

    // Threshold reference
    console.log(chalk.gray('\n' + '='.repeat(90)));
    console.log(chalk.cyan('Threshold Reference'));
    console.log(
      chalk.gray(
        `  Policy Violation:      >${formatPercentage(thresholds.policyViolation)} daily violations`,
      ),
    );
    console.log(
      chalk.gray(
        `  Intent-Outcome Gap:    >${formatPercentage(thresholds.intentOutcomeGap)} divergence`,
      ),
    );
    console.log(
      chalk.gray(
        `  Evaluator Disagreement:>${formatPercentage(thresholds.evaluatorDisagreement)} monthly overrides`,
      ),
    );
    console.log(
      chalk.gray(
        `  Escalation Suppression:>${formatPercentage(thresholds.escalationSuppression)} drop from baseline`,
      ),
    );
    console.log(
      chalk.gray(
        `  Reward Hacking:        >${thresholds.rewardHacking} instances/month`,
      ),
    );

    console.log(chalk.gray('='.repeat(90)));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to load dimension breakdown');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

// Export the command
export default createAlignmentCommand;
