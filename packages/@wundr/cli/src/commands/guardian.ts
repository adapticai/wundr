/**
 * Guardian Dashboard CLI Commands
 *
 * Provides CLI access to the Guardian Dashboard for alignment monitoring,
 * drift detection, and intervention management.
 *
 * Commands:
 * - wundr guardian report - Generate daily alignment report
 * - wundr guardian review - Show sessions requiring review
 * - wundr guardian interventions - List recent interventions
 * - wundr guardian dashboard - Open/display dashboard
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';

import {
  AlignmentDebtCalculator,
  DriftScoreAggregator,
  InterventionRecommender,
  type InterventionRecommendation,
  type InterventionSeverity,
  type AggregatedDriftReport,
  type SessionDriftData,
  type HealthStatus,
} from '@wundr.io/guardian-dashboard';

// ============================================================================
// Constants
// ============================================================================

const GUARDIAN_BASE_DIR = path.join(os.homedir(), '.wundr', 'guardian');
const INTERVENTIONS_FILE = path.join(GUARDIAN_BASE_DIR, 'interventions.json');
const REVIEW_QUEUE_FILE = path.join(GUARDIAN_BASE_DIR, 'review-queue.json');
const SESSIONS_STATE_FILE = path.join(
  os.homedir(),
  '.wundr',
  'sessions',
  'state.json'
);
const REPORTS_DIR = path.join(GUARDIAN_BASE_DIR, 'reports');

// ============================================================================
// Types
// ============================================================================

interface ReportOptions {
  date?: string;
  output?: string;
  format?: 'md' | 'json' | 'html';
}

interface InterventionsOptions {
  days?: string;
  session?: string;
}

interface StoredIntervention {
  id: string;
  sessionId: string;
  timestamp: string;
  severity: InterventionSeverity;
  dimension: string;
  action: string;
  rationale: string;
  status: 'pending' | 'applied' | 'dismissed';
  resolvedAt?: string;
}

interface ReviewQueueItem {
  sessionId: string;
  flaggedAt: string;
  reason: string;
  severity: InterventionSeverity;
  driftScore: number;
  metrics?: {
    policyViolationRate?: number;
    intentOutcomeGap?: number;
    evaluatorDisagreement?: number;
  };
  reviewed?: boolean;
  reviewedAt?: string;
}

interface GuardianState {
  interventions: StoredIntervention[];
  reviewQueue: ReviewQueueItem[];
}

// ============================================================================
// Utility Functions
// ============================================================================

function getTimestamp(): string {
  return new Date().toISOString();
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function padRight(str: string, length: number): string {
  return str.length >= length
    ? str.substring(0, length)
    : str + ' '.repeat(length - str.length);
}

function truncate(str: string, length: number): string {
  if (str.length <= length) {
    return str;
  }
  return str.substring(0, length - 3) + '...';
}

async function ensureGuardianDir(): Promise<void> {
  await fs.mkdir(GUARDIAN_BASE_DIR, { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

/**
 * Get color function based on severity
 */
function getSeverityColor(
  severity: InterventionSeverity
): (str: string) => string {
  switch (severity) {
    case 'critical':
      return chalk.red;
    case 'high':
      return chalk.yellow;
    case 'medium':
      return chalk.blue;
    case 'low':
      return chalk.gray;
    default:
      return chalk.white;
  }
}

/**
 * Get color function based on health status
 */
function getStatusColor(status: HealthStatus): (str: string) => string {
  switch (status) {
    case 'HEALTHY':
      return chalk.green;
    case 'CONCERNING':
      return chalk.yellow;
    case 'CRITICAL':
      return chalk.red;
    default:
      return chalk.white;
  }
}

/**
 * Format severity badge
 */
function getSeverityBadge(severity: InterventionSeverity): string {
  const badges: Record<InterventionSeverity, string> = {
    critical: '[CRITICAL]',
    high: '[HIGH]',
    medium: '[MEDIUM]',
    low: '[LOW]',
  };
  return badges[severity] ?? '[UNKNOWN]';
}

/**
 * Load guardian state from disk
 */
async function loadGuardianState(): Promise<GuardianState> {
  try {
    await ensureGuardianDir();

    let interventions: StoredIntervention[] = [];
    let reviewQueue: ReviewQueueItem[] = [];

    try {
      const interventionsContent = await fs.readFile(
        INTERVENTIONS_FILE,
        'utf-8'
      );
      interventions = JSON.parse(interventionsContent) as StoredIntervention[];
    } catch {
      // File doesn't exist yet
    }

    try {
      const reviewQueueContent = await fs.readFile(REVIEW_QUEUE_FILE, 'utf-8');
      reviewQueue = JSON.parse(reviewQueueContent) as ReviewQueueItem[];
    } catch {
      // File doesn't exist yet
    }

    return { interventions, reviewQueue };
  } catch {
    return { interventions: [], reviewQueue: [] };
  }
}

/**
 * Save guardian state to disk
 */
async function saveGuardianState(state: GuardianState): Promise<void> {
  await ensureGuardianDir();
  await fs.writeFile(
    INTERVENTIONS_FILE,
    JSON.stringify(state.interventions, null, 2)
  );
  await fs.writeFile(
    REVIEW_QUEUE_FILE,
    JSON.stringify(state.reviewQueue, null, 2)
  );
}

/**
 * Load session drift data from sessions state
 */
async function loadSessionDriftData(): Promise<SessionDriftData[]> {
  try {
    const content = await fs.readFile(SESSIONS_STATE_FILE, 'utf-8');
    const state = JSON.parse(content) as {
      sessions?: Array<{
        sessionId: string;
        startedAt: string;
        metrics?: { errors?: number };
      }>;
    };

    // Convert session data to drift data format
    return (state.sessions ?? []).map(session => ({
      sessionId: session.sessionId,
      timestamp: new Date(session.startedAt),
      driftScore: calculateDriftScoreFromSession(session),
      metrics: {
        testCoverage: 80, // Default values - would come from actual session data
        codePatternAdherence: 85,
        documentationCoverage: 70,
        securityCompliance: 90,
        performanceBenchmark: 75,
      },
    }));
  } catch {
    return [];
  }
}

/**
 * Calculate drift score from session data
 */
function calculateDriftScoreFromSession(session: {
  metrics?: { errors?: number };
}): number {
  // Simplified drift calculation - in production would use actual metrics
  const baseScore = 85;
  const errorPenalty = (session.metrics?.errors ?? 0) * 5;
  return Math.max(0, Math.min(100, baseScore - errorPenalty));
}

// ============================================================================
// Command Implementations
// ============================================================================

/**
 * Generate daily alignment report
 */
async function generateReport(options: ReportOptions): Promise<void> {
  const spinner = ora('Generating alignment report...').start();

  try {
    await ensureGuardianDir();

    // Parse date option
    const reportDate = options.date ? new Date(options.date) : new Date();
    const dateStr = formatDate(reportDate);

    // Load session data
    const sessionData = await loadSessionDriftData();
    const guardianState = await loadGuardianState();

    // Create aggregator and calculate report
    const aggregator = new DriftScoreAggregator();
    aggregator.addSessions(sessionData);

    const report = aggregator.aggregateSessionScores(sessionData);

    // Get intervention recommendations
    const recommender = new InterventionRecommender();
    const recommendations =
      sessionData.length > 0
        ? recommender.recommendInterventions({
            policyViolationRate: 0.02,
            intentOutcomeGap: 0.1,
            evaluatorDisagreementRate: 0.15,
          })
        : [];

    spinner.stop();

    // Format output
    const format = options.format ?? 'md';

    if (format === 'json') {
      const jsonReport = {
        date: dateStr,
        generatedAt: getTimestamp(),
        summary: {
          totalSessions: report.totalSessions,
          averageDriftScore: report.averageScore,
          minScore: report.minScore,
          maxScore: report.maxScore,
          overallStatus: report.overallStatus,
          trend: report.trend,
        },
        criticalSessions: report.criticalSessions.length,
        concerningSessions: report.concerningSessions.length,
        interventions: recommendations,
        reviewQueue: guardianState.reviewQueue.filter(r => !r.reviewed).length,
      };

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(jsonReport, null, 2));
        console.log(chalk.green(`Report saved to: ${options.output}`));
      } else {
        console.log(JSON.stringify(jsonReport, null, 2));
      }
      return;
    }

    // Markdown format
    const mdReport = generateMarkdownReport(
      dateStr,
      report,
      recommendations,
      guardianState
    );

    if (options.output) {
      await fs.writeFile(options.output, mdReport);
      console.log(chalk.green(`Report saved to: ${options.output}`));
    } else {
      // Display in terminal
      displayTerminalReport(dateStr, report, recommendations, guardianState);
    }
  } catch (error) {
    spinner.fail('Failed to generate report');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(
  dateStr: string,
  report: AggregatedDriftReport,
  recommendations: InterventionRecommendation[],
  guardianState: GuardianState
): string {
  let md = '# Guardian Daily Alignment Report\n\n';
  md += `**Date:** ${dateStr}\n`;
  md += `**Generated:** ${getTimestamp()}\n\n`;

  md += '## Summary\n\n';
  md += '| Metric | Value |\n';
  md += '|--------|-------|\n';
  md += `| Total Sessions | ${report.totalSessions} |\n`;
  md += `| Average Drift Score | ${report.averageScore.toFixed(1)} |\n`;
  md += `| Overall Status | ${report.overallStatus} |\n`;
  md += `| Trend | ${report.trend} |\n`;
  md += `| Critical Sessions | ${report.criticalSessions.length} |\n`;
  md += `| Concerning Sessions | ${report.concerningSessions.length} |\n`;
  md += '\n';

  if (recommendations.length > 0) {
    md += '## Intervention Recommendations\n\n';
    for (const rec of recommendations) {
      md += `### ${rec.dimension} (${rec.severity.toUpperCase()})\n\n`;
      md += `- **Action:** ${rec.action}\n`;
      md += `- **Rationale:** ${rec.rationale}\n`;
      md += `- **Urgency:** ${rec.urgency} hours\n\n`;
    }
  }

  const pendingReviews = guardianState.reviewQueue.filter(r => !r.reviewed);
  if (pendingReviews.length > 0) {
    md += '## Sessions Requiring Review\n\n';
    md += '| Session ID | Severity | Drift Score | Reason |\n';
    md += '|------------|----------|-------------|--------|\n';
    for (const item of pendingReviews) {
      md += `| ${item.sessionId} | ${item.severity.toUpperCase()} | ${item.driftScore.toFixed(1)} | ${item.reason} |\n`;
    }
    md += '\n';
  }

  return md;
}

/**
 * Display report in terminal with colors
 */
function displayTerminalReport(
  dateStr: string,
  report: AggregatedDriftReport,
  recommendations: InterventionRecommendation[],
  guardianState: GuardianState
): void {
  console.log(chalk.cyan('\n' + '='.repeat(70)));
  console.log(chalk.cyan.bold('       GUARDIAN DAILY ALIGNMENT REPORT'));
  console.log(chalk.cyan('='.repeat(70)));

  console.log(chalk.gray(`Date: ${dateStr}`));
  console.log(chalk.gray(`Generated: ${getTimestamp()}\n`));

  // Summary section
  console.log(chalk.bold('Summary'));
  console.log(chalk.gray('-'.repeat(40)));

  const statusColor = getStatusColor(report.overallStatus);
  console.log(`Total Sessions:     ${chalk.white(report.totalSessions)}`);
  console.log(
    `Average Drift Score: ${chalk.white(report.averageScore.toFixed(1))}`
  );
  console.log(`Overall Status:     ${statusColor(report.overallStatus)}`);
  console.log(`Trend:              ${chalk.white(report.trend)}`);
  console.log(
    `Critical Sessions:  ${report.criticalSessions.length > 0 ? chalk.red(report.criticalSessions.length) : chalk.green('0')}`
  );
  console.log(
    `Concerning Sessions: ${report.concerningSessions.length > 0 ? chalk.yellow(report.concerningSessions.length) : chalk.green('0')}`
  );
  console.log('');

  // Interventions section
  if (recommendations.length > 0) {
    console.log(chalk.bold('Intervention Recommendations'));
    console.log(chalk.gray('-'.repeat(40)));

    for (const rec of recommendations) {
      const severityColor = getSeverityColor(rec.severity);
      console.log(
        `${severityColor(getSeverityBadge(rec.severity))} ${chalk.white(rec.dimension)}`
      );
      console.log(`  Action: ${rec.action}`);
      console.log(`  Urgency: ${rec.urgency}h`);
      console.log('');
    }
  } else {
    console.log(chalk.green('No interventions required.'));
    console.log('');
  }

  // Review queue
  const pendingReviews = guardianState.reviewQueue.filter(r => !r.reviewed);
  if (pendingReviews.length > 0) {
    console.log(chalk.bold('Sessions Requiring Review'));
    console.log(chalk.gray('-'.repeat(40)));
    console.log(
      chalk.yellow(
        `${pendingReviews.length} session(s) flagged for Guardian attention.`
      )
    );
    console.log(chalk.gray('Run "wundr guardian review" for details.\n'));
  }

  console.log(chalk.cyan('='.repeat(70)));
}

/**
 * Show sessions requiring Guardian review
 */
async function showReviewQueue(): Promise<void> {
  const spinner = ora('Loading review queue...').start();

  try {
    const state = await loadGuardianState();
    const pendingReviews = state.reviewQueue.filter(r => !r.reviewed);

    spinner.stop();

    console.log(chalk.cyan('\nGuardian Review Queue'));
    console.log(chalk.gray('='.repeat(90)));

    if (pendingReviews.length === 0) {
      console.log(chalk.green('\nNo sessions require Guardian review.'));
      console.log(
        chalk.gray('All systems operating within acceptable parameters.\n')
      );
      return;
    }

    // Table header
    console.log(
      chalk.cyan(
        padRight('Session ID', 20) +
          padRight('Severity', 12) +
          padRight('Drift Score', 14) +
          padRight('Flagged At', 22) +
          padRight('Reason', 22)
      )
    );
    console.log(chalk.gray('-'.repeat(90)));

    // Table rows
    for (const item of pendingReviews) {
      const severityColor = getSeverityColor(item.severity);
      const flaggedAt = new Date(item.flaggedAt).toLocaleString();

      console.log(
        padRight(item.sessionId, 20) +
          severityColor(padRight(getSeverityBadge(item.severity), 12)) +
          padRight(item.driftScore.toFixed(1), 14) +
          padRight(flaggedAt, 22) +
          chalk.gray(truncate(item.reason, 22))
      );
    }

    console.log(chalk.gray('-'.repeat(90)));
    console.log(
      chalk.gray(`Total: ${pendingReviews.length} session(s) pending review\n`)
    );

    // Show summary by severity
    const criticalCount = pendingReviews.filter(
      r => r.severity === 'critical'
    ).length;
    const highCount = pendingReviews.filter(r => r.severity === 'high').length;
    const mediumCount = pendingReviews.filter(
      r => r.severity === 'medium'
    ).length;

    if (criticalCount > 0) {
      console.log(chalk.red(`  CRITICAL: ${criticalCount}`));
    }
    if (highCount > 0) {
      console.log(chalk.yellow(`  HIGH: ${highCount}`));
    }
    if (mediumCount > 0) {
      console.log(chalk.blue(`  MEDIUM: ${mediumCount}`));
    }
    console.log('');
  } catch (error) {
    spinner.fail('Failed to load review queue');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

/**
 * List recent interventions
 */
async function listInterventions(options: InterventionsOptions): Promise<void> {
  const spinner = ora('Loading interventions...').start();

  try {
    const state = await loadGuardianState();
    let interventions = state.interventions;

    // Filter by days
    const days = parseInt(options.days ?? '7', 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    interventions = interventions.filter(
      i => new Date(i.timestamp) >= cutoffDate
    );

    // Filter by session
    if (options.session) {
      interventions = interventions.filter(
        i => i.sessionId === options.session
      );
    }

    // Sort by timestamp descending (most recent first)
    interventions.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    spinner.stop();

    console.log(chalk.cyan('\nGuardian Interventions'));
    console.log(
      chalk.gray(
        `Last ${days} days${options.session ? ` - Session: ${options.session}` : ''}`
      )
    );
    console.log(chalk.gray('='.repeat(100)));

    if (interventions.length === 0) {
      console.log(
        chalk.green('\nNo interventions recorded in the specified time period.')
      );
      console.log('');
      return;
    }

    // Table header
    console.log(
      chalk.cyan(
        padRight('ID', 12) +
          padRight('Session', 16) +
          padRight('Severity', 12) +
          padRight('Dimension', 20) +
          padRight('Status', 12) +
          padRight('Time', 18)
      )
    );
    console.log(chalk.gray('-'.repeat(100)));

    // Table rows
    for (const intervention of interventions) {
      const severityColor = getSeverityColor(intervention.severity);
      const statusColor =
        intervention.status === 'applied'
          ? chalk.green
          : intervention.status === 'dismissed'
            ? chalk.gray
            : chalk.yellow;
      const timestamp = new Date(intervention.timestamp).toLocaleString();

      console.log(
        padRight(intervention.id, 12) +
          padRight(truncate(intervention.sessionId, 14), 16) +
          severityColor(padRight(getSeverityBadge(intervention.severity), 12)) +
          padRight(truncate(intervention.dimension, 18), 20) +
          statusColor(padRight(`[${intervention.status.toUpperCase()}]`, 12)) +
          chalk.gray(padRight(timestamp, 18))
      );
    }

    console.log(chalk.gray('-'.repeat(100)));
    console.log(chalk.gray(`Total: ${interventions.length} intervention(s)\n`));

    // Show summary
    const applied = interventions.filter(i => i.status === 'applied').length;
    const pending = interventions.filter(i => i.status === 'pending').length;
    const dismissed = interventions.filter(
      i => i.status === 'dismissed'
    ).length;

    console.log(chalk.gray('Summary:'));
    console.log(
      `  Applied: ${chalk.green(applied)}  Pending: ${chalk.yellow(pending)}  Dismissed: ${chalk.gray(dismissed)}`
    );
    console.log('');
  } catch (error) {
    spinner.fail('Failed to load interventions');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

/**
 * Display terminal-based dashboard
 */
async function displayDashboard(): Promise<void> {
  const spinner = ora('Loading Guardian Dashboard...').start();

  try {
    const guardianState = await loadGuardianState();
    const sessionData = await loadSessionDriftData();

    // Calculate aggregated stats
    const aggregator = new DriftScoreAggregator();
    aggregator.addSessions(sessionData);
    const report = aggregator.aggregateSessionScores(sessionData);

    // Get recommendations
    const recommender = new InterventionRecommender();
    const recommendations = recommender.recommendInterventions({
      policyViolationRate: 0.02,
      intentOutcomeGap: 0.1,
      evaluatorDisagreementRate: 0.15,
    });

    spinner.stop();

    // Clear screen and display dashboard
    console.clear();

    console.log(chalk.cyan.bold('\n' + '='.repeat(80)));
    console.log(
      chalk.cyan.bold('                    GUARDIAN ALIGNMENT DASHBOARD')
    );
    console.log(chalk.cyan.bold('='.repeat(80)));
    console.log(
      chalk.gray(
        `                    Last Updated: ${new Date().toLocaleString()}`
      )
    );
    console.log('');

    // Status Overview Panel
    console.log(chalk.cyan.bold(' STATUS OVERVIEW'));
    console.log(chalk.gray(' ' + '-'.repeat(78)));

    const statusColor = getStatusColor(report.overallStatus);
    console.log(
      `   Overall Status: ${statusColor(report.overallStatus.padEnd(12))}  Avg Drift Score: ${chalk.white(report.averageScore.toFixed(1).padEnd(8))}  Trend: ${chalk.white(report.trend)}`
    );
    console.log('');

    // Sessions Panel
    console.log(chalk.cyan.bold(' SESSIONS'));
    console.log(chalk.gray(' ' + '-'.repeat(78)));
    console.log(
      `   Total: ${chalk.white(report.totalSessions.toString().padEnd(6))}  Critical: ${report.criticalSessions.length > 0 ? chalk.red(report.criticalSessions.length.toString().padEnd(4)) : chalk.green('0'.padEnd(4))}  Concerning: ${report.concerningSessions.length > 0 ? chalk.yellow(report.concerningSessions.length.toString().padEnd(4)) : chalk.green('0'.padEnd(4))}  Healthy: ${chalk.green((report.totalSessions - report.criticalSessions.length - report.concerningSessions.length).toString())}`
    );
    console.log('');

    // Interventions Panel
    console.log(chalk.cyan.bold(' INTERVENTIONS'));
    console.log(chalk.gray(' ' + '-'.repeat(78)));

    const pendingInterventions = guardianState.interventions.filter(
      i => i.status === 'pending'
    );
    const recentApplied = guardianState.interventions.filter(
      i =>
        i.status === 'applied' &&
        new Date(i.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    console.log(
      `   Pending: ${pendingInterventions.length > 0 ? chalk.yellow(pendingInterventions.length.toString().padEnd(6)) : chalk.green('0'.padEnd(6))}  Applied (24h): ${chalk.white(recentApplied.length.toString().padEnd(6))}  Recommended: ${recommendations.length > 0 ? chalk.yellow(recommendations.length.toString()) : chalk.green('0')}`
    );
    console.log('');

    // Review Queue Panel
    console.log(chalk.cyan.bold(' REVIEW QUEUE'));
    console.log(chalk.gray(' ' + '-'.repeat(78)));

    const pendingReviews = guardianState.reviewQueue.filter(r => !r.reviewed);

    if (pendingReviews.length === 0) {
      console.log(chalk.green('   No sessions require Guardian review.'));
    } else {
      const criticalReviews = pendingReviews.filter(
        r => r.severity === 'critical'
      ).length;
      const highReviews = pendingReviews.filter(
        r => r.severity === 'high'
      ).length;

      console.log(
        `   Pending: ${chalk.yellow(pendingReviews.length.toString().padEnd(6))}  Critical: ${criticalReviews > 0 ? chalk.red(criticalReviews.toString().padEnd(6)) : chalk.green('0'.padEnd(6))}  High: ${highReviews > 0 ? chalk.yellow(highReviews.toString()) : chalk.green('0')}`
      );
    }
    console.log('');

    // Recommendations Panel
    if (recommendations.length > 0) {
      console.log(chalk.cyan.bold(' ACTIVE RECOMMENDATIONS'));
      console.log(chalk.gray(' ' + '-'.repeat(78)));

      for (const rec of recommendations.slice(0, 3)) {
        const severityColor = getSeverityColor(rec.severity);
        console.log(
          `   ${severityColor(getSeverityBadge(rec.severity))} ${rec.dimension}: ${truncate(rec.action, 50)}`
        );
      }

      if (recommendations.length > 3) {
        console.log(
          chalk.gray(`   ... and ${recommendations.length - 3} more`)
        );
      }
      console.log('');
    }

    // Quick Actions
    console.log(chalk.cyan.bold(' QUICK ACTIONS'));
    console.log(chalk.gray(' ' + '-'.repeat(78)));
    console.log(
      chalk.gray(
        '   wundr guardian report     - Generate full alignment report'
      )
    );
    console.log(
      chalk.gray(
        '   wundr guardian review     - View sessions requiring attention'
      )
    );
    console.log(
      chalk.gray('   wundr guardian interventions - List recent interventions')
    );
    console.log('');

    console.log(chalk.cyan.bold('='.repeat(80)));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to load dashboard');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

// ============================================================================
// Command Factory
// ============================================================================

/**
 * Creates the guardian command with all subcommands
 */
export function createGuardianCommand(): Command {
  const guardian = new Command('guardian')
    .description(
      'Guardian Dashboard - AI alignment monitoring and intervention management'
    )
    .addHelpText(
      'after',
      chalk.gray(`
Examples:
  ${chalk.green('wundr guardian')}                    Display Guardian dashboard
  ${chalk.green('wundr guardian report')}             Generate daily alignment report
  ${chalk.green('wundr guardian report --date 2025-01-15')} Generate report for specific date
  ${chalk.green('wundr guardian report -o report.md')} Save report to file
  ${chalk.green('wundr guardian review')}             Show sessions requiring Guardian review
  ${chalk.green('wundr guardian interventions')}      List recent interventions
  ${chalk.green('wundr guardian interventions --days 14')} Show interventions from last 14 days
      `)
    );

  // Default action - show dashboard
  guardian.action(async () => {
    await displayDashboard();
  });

  // Report subcommand
  guardian
    .command('report')
    .description('Generate daily alignment report')
    .option('-d, --date <date>', 'Report date (YYYY-MM-DD format)')
    .option('-o, --output <file>', 'Output file path')
    .option('-f, --format <format>', 'Output format (md|json|html)', 'md')
    .action(async (options: ReportOptions) => {
      await generateReport(options);
    });

  // Review subcommand
  guardian
    .command('review')
    .description('Show sessions requiring Guardian review')
    .action(async () => {
      await showReviewQueue();
    });

  // Interventions subcommand
  guardian
    .command('interventions')
    .description('List recent interventions')
    .option('-d, --days <n>', 'Number of days to look back', '7')
    .option('-s, --session <id>', 'Filter by session ID')
    .action(async (options: InterventionsOptions) => {
      await listInterventions(options);
    });

  // Dashboard subcommand (explicit)
  guardian
    .command('dashboard')
    .description('Display Guardian dashboard in terminal')
    .action(async () => {
      await displayDashboard();
    });

  return guardian;
}

// ============================================================================
// Exports
// ============================================================================

export { createGuardianCommand as guardianCommand };
export default createGuardianCommand;
