/**
 * Governance CLI Commands - IPRE Compliance
 *
 * Implements governance commands from Appendix B:
 * - wundr governance check - Run IPRE compliance check
 * - wundr governance report - Generate alignment debt report
 * - wundr governance status - Show current governance status
 * - wundr governance validate <file> - Validate IPRE config file
 */

import path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs-extra';
import YAML from 'yaml';

import {
  createEvaluator,
  createEvaluatorSuite,
  runEvaluatorSuite,
  PolicyEngine,
  type EvaluationContext,
  type EvaluationResult,
  type ComplianceResult,
  type IPREConfig,
} from '@wundr.io/governance';

import { errorHandler } from '../utils/error-handler';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface CheckOptions {
  session?: string;
  verbose?: boolean;
}

interface ReportOptions {
  session?: string;
  output?: string;
  format?: 'md' | 'json';
}

interface GovernanceStatus {
  alignmentScore: number;
  policyViolations: number;
  recentInterventions: Intervention[];
  lastCheck: Date | null;
  driftIndicators: DriftIndicator[];
}

interface Intervention {
  id: string;
  type: string;
  timestamp: Date;
  description: string;
  resolved: boolean;
}

interface DriftIndicator {
  pattern: string;
  baseline: number;
  current: number;
  change: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface AlignmentDebtReport {
  generatedAt: string;
  sessionId: string | null;
  summary: {
    totalDebt: number;
    criticalIssues: number;
    highPriorityItems: number;
    alignmentScore: number;
    complianceScore: number;
    driftScore: number;
  };
  policyViolations: PolicyViolationDetail[];
  alignmentGaps: AlignmentGapDetail[];
  driftAlerts: DriftAlertDetail[];
  recommendations: string[];
}

interface PolicyViolationDetail {
  policyId: string;
  policyName: string;
  severity: string;
  description: string;
  location?: string;
  suggestedFix?: string;
}

interface AlignmentGapDetail {
  dimension: string;
  expected: number;
  actual: number;
  gap: number;
  priority: string;
}

interface DriftAlertDetail {
  pattern: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  direction: string;
  severity: string;
}

// ============================================================================
// Governance Command Factory
// ============================================================================

/**
 * Creates the governance command with all subcommands
 */
export function createGovernanceCommand(): Command {
  const governance = new Command('governance')
    .alias('gov')
    .description('IPRE governance and compliance tools');

  // Check subcommand
  governance
    .command('check')
    .description('Run IPRE compliance check')
    .option('-s, --session <id>', 'Session ID to check')
    .option('-v, --verbose', 'Enable verbose output')
    .action(async (options: CheckOptions) => {
      await runComplianceCheck(options);
    });

  // Report subcommand
  governance
    .command('report')
    .description('Generate alignment debt report')
    .option('-s, --session <id>', 'Session ID for the report')
    .option('-o, --output <file>', 'Output file path')
    .option('-f, --format <format>', 'Output format (md|json)', 'md')
    .action(async (options: ReportOptions) => {
      await generateAlignmentReport(options);
    });

  // Status subcommand
  governance
    .command('status')
    .description('Show current governance status')
    .action(async () => {
      await showGovernanceStatus();
    });

  // Validate subcommand
  governance
    .command('validate <file>')
    .description('Validate IPRE config file')
    .action(async (file: string) => {
      await validateIPREConfig(file);
    });

  return governance;
}

// Re-export the full-featured alignment command from the dedicated module
// This provides: report, score, history, and dimensions subcommands
export { createAlignmentCommand } from './alignment';

// ============================================================================
// Command Implementations
// ============================================================================

/**
 * Run IPRE compliance check
 */
async function runComplianceCheck(options: CheckOptions): Promise<void> {
  try {
    logger.info('Running IPRE compliance check...');

    const sessionId = options.session || `session-${Date.now()}`;
    const verbose = options.verbose || false;

    // Create evaluation context
    const context: EvaluationContext = {
      evaluationId: `eval-${Date.now()}`,
      timestamp: new Date(),
      source: 'manual',
      repository: process.cwd(),
      metadata: {
        sessionId,
      },
    };

    // Create evaluator suite
    const suite = createEvaluatorSuite();

    // Run policy compliance check
    console.log(chalk.blue('\n--- Policy Compliance ---'));
    const complianceResult =
      await suite.policyCompliance.checkPolicyCompliance(context);
    displayComplianceResult(complianceResult, verbose);

    // Run reward alignment check
    console.log(chalk.blue('\n--- Reward Alignment ---'));
    const alignmentEvaluator = createEvaluator('reward_alignment');
    const alignmentResult = await alignmentEvaluator.evaluate(context);
    displayAlignmentResult(alignmentResult, verbose);

    // Run drift detection
    console.log(chalk.blue('\n--- Drift Detection ---'));
    const driftEvaluator = createEvaluator('drift_detection');
    const driftResult = await driftEvaluator.evaluate(context);
    displayDriftResult(driftResult, verbose);

    // Run full suite and show summary
    console.log(chalk.blue('\n--- Overall Summary ---'));
    const evaluators = [
      suite.policyCompliance,
      suite.rewardAlignment,
      suite.driftDetection,
    ];
    const suiteResult = await runEvaluatorSuite(evaluators, context);

    displaySummary(suiteResult);

    // Save state for future checks
    await saveGovernanceState(sessionId, {
      complianceResult,
      alignmentResult,
      driftResult,
      suiteResult,
    });

    if (suiteResult.passed) {
      logger.success('IPRE compliance check passed');
    } else {
      logger.warn('IPRE compliance check found issues');
      process.exitCode = 1;
    }
  } catch (error) {
    throw errorHandler.createError(
      'WUNDR_GOV_CHECK_FAILED',
      'Failed to run IPRE compliance check',
      { options },
      true,
    );
  }
}

/**
 * Generate alignment debt report
 */
async function generateAlignmentReport(options: ReportOptions): Promise<void> {
  try {
    logger.info('Generating alignment debt report...');

    const sessionId = options.session || null;
    const format = options.format || 'md';
    const outputPath =
      options.output || `alignment-report-${Date.now()}.${format}`;

    // Create evaluation context
    const context: EvaluationContext = {
      evaluationId: `eval-${Date.now()}`,
      timestamp: new Date(),
      source: 'manual',
      repository: process.cwd(),
    };

    // Run all evaluations
    const suite = createEvaluatorSuite();
    const complianceResult =
      await suite.policyCompliance.checkPolicyCompliance(context);

    // Get alignment gaps
    const alignmentEvaluator = createEvaluator('reward_alignment');
    const alignmentEvalResult = await alignmentEvaluator.evaluate(context);

    // Get drift indicators
    const driftEvaluator = createEvaluator('drift_detection');
    const driftEvalResult = await driftEvaluator.evaluate(context);

    // Build report
    const report: AlignmentDebtReport = {
      generatedAt: new Date().toISOString(),
      sessionId,
      summary: {
        totalDebt: calculateAlignmentDebt(
          complianceResult,
          alignmentEvalResult,
          driftEvalResult,
        ),
        criticalIssues: countCriticalIssues(complianceResult),
        highPriorityItems: countHighPriorityItems(alignmentEvalResult),
        alignmentScore: alignmentEvalResult.score,
        complianceScore: complianceResult.score,
        driftScore: 1 - driftEvalResult.score, // Invert since lower drift is better
      },
      policyViolations: complianceResult.violations.map(v => ({
        policyId: v.policyId,
        policyName: v.policyName,
        severity: v.severity,
        description: v.description,
        location: v.location,
        suggestedFix: v.suggestedFix,
      })),
      alignmentGaps: extractAlignmentGaps(alignmentEvalResult),
      driftAlerts: extractDriftAlerts(driftEvalResult),
      recommendations: generateRecommendations(
        complianceResult,
        alignmentEvalResult,
        driftEvalResult,
      ),
    };

    // Output report
    if (format === 'json') {
      await fs.writeJson(outputPath, report, { spaces: 2 });
    } else {
      const markdown = formatReportAsMarkdown(report);
      await fs.writeFile(outputPath, markdown, 'utf-8');
    }

    logger.success(`Alignment debt report generated: ${outputPath}`);

    // Display summary
    console.log(chalk.blue('\n--- Report Summary ---'));
    console.log(
      `Total Alignment Debt: ${chalk.yellow(report.summary.totalDebt.toFixed(2))}`,
    );
    console.log(`Critical Issues: ${chalk.red(report.summary.criticalIssues)}`);
    console.log(
      `High Priority Items: ${chalk.yellow(report.summary.highPriorityItems)}`,
    );
    console.log(
      `Alignment Score: ${colorScore(report.summary.alignmentScore)}`,
    );
    console.log(
      `Compliance Score: ${colorScore(report.summary.complianceScore)}`,
    );
    console.log(`Drift Score: ${colorScore(1 - report.summary.driftScore)}`);
  } catch (error) {
    throw errorHandler.createError(
      'WUNDR_GOV_REPORT_FAILED',
      'Failed to generate alignment debt report',
      { options },
      true,
    );
  }
}

/**
 * Show current governance status
 */
async function showGovernanceStatus(): Promise<void> {
  try {
    logger.info('Fetching governance status...');

    // Load saved state if available
    const state = await loadGovernanceState();

    // Create policy engine and get stats
    const policyEngine = new PolicyEngine();
    const violationStats = policyEngine.getViolationStats();

    const status: GovernanceStatus = {
      alignmentScore: state?.suiteResult?.overallScore ?? 0,
      policyViolations: violationStats.total,
      recentInterventions: await loadRecentInterventions(),
      lastCheck: state?.timestamp ? new Date(state.timestamp) : null,
      driftIndicators: extractDriftIndicatorsFromState(state),
    };

    // Display status
    console.log(chalk.cyan('\n===================================='));
    console.log(chalk.cyan('       GOVERNANCE STATUS'));
    console.log(chalk.cyan('====================================\n'));

    // Alignment Score
    console.log(chalk.bold('Alignment Score:'));
    displayProgressBar(status.alignmentScore);
    console.log(
      `  ${colorScore(status.alignmentScore)} (${(status.alignmentScore * 100).toFixed(1)}%)\n`,
    );

    // Policy Violations
    console.log(chalk.bold('Policy Violations:'));
    if (status.policyViolations === 0) {
      console.log(chalk.green('  No active violations'));
    } else {
      console.log(chalk.red(`  ${status.policyViolations} active violations`));
      console.log(`    - Security: ${violationStats.byCategory.security}`);
      console.log(`    - Compliance: ${violationStats.byCategory.compliance}`);
      console.log(
        `    - Operational: ${violationStats.byCategory.operational}`,
      );
    }
    console.log();

    // Recent Interventions
    console.log(chalk.bold('Recent Interventions:'));
    if (status.recentInterventions.length === 0) {
      console.log(chalk.green('  No recent interventions'));
    } else {
      for (const intervention of status.recentInterventions.slice(0, 5)) {
        const statusIcon = intervention.resolved
          ? chalk.green('[RESOLVED]')
          : chalk.yellow('[OPEN]');
        console.log(
          `  ${statusIcon} ${intervention.type}: ${intervention.description}`,
        );
      }
    }
    console.log();

    // Drift Indicators
    console.log(chalk.bold('Drift Indicators:'));
    if (status.driftIndicators.length === 0) {
      console.log(chalk.green('  No significant drift detected'));
    } else {
      for (const indicator of status.driftIndicators) {
        const severityColor = getSeverityColor(indicator.severity);
        const direction = indicator.change > 0 ? '+' : '';
        console.log(
          `  ${severityColor(`[${indicator.severity.toUpperCase()}]`)} ` +
            `${indicator.pattern}: ${direction}${(indicator.change * 100).toFixed(1)}%`,
        );
      }
    }
    console.log();

    // Last Check
    if (status.lastCheck) {
      console.log(
        chalk.gray(`Last check: ${status.lastCheck.toLocaleString()}`),
      );
    } else {
      console.log(
        chalk.gray(
          'No previous checks found. Run "wundr governance check" to start.',
        ),
      );
    }
  } catch (error) {
    throw errorHandler.createError(
      'WUNDR_GOV_STATUS_FAILED',
      'Failed to fetch governance status',
      {},
      true,
    );
  }
}

/**
 * Validate IPRE config file
 */
async function validateIPREConfig(file: string): Promise<void> {
  try {
    const filePath = path.isAbsolute(file)
      ? file
      : path.join(process.cwd(), file);

    logger.info(`Validating IPRE config: ${filePath}`);

    // Check file exists
    if (!(await fs.pathExists(filePath))) {
      logger.error(`File not found: ${filePath}`);
      process.exitCode = 1;
      return;
    }

    // Read and parse file
    const content = await fs.readFile(filePath, 'utf-8');
    let config: unknown;

    const ext = path.extname(file).toLowerCase();
    if (ext === '.yaml' || ext === '.yml') {
      config = YAML.parse(content);
    } else if (ext === '.json') {
      config = JSON.parse(content);
    } else {
      logger.error('Unsupported file format. Use .yaml, .yml, or .json');
      process.exitCode = 1;
      return;
    }

    // Validate schema
    const validationErrors = validateIPRESchema(config as IPREConfig);

    if (validationErrors.length === 0) {
      console.log(chalk.green('\nIPRE configuration is valid'));
      displayConfigSummary(config as IPREConfig);
    } else {
      console.log(chalk.red('\nIPRE configuration validation failed:\n'));
      for (const error of validationErrors) {
        console.log(chalk.red(`  - ${error}`));
      }
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw errorHandler.createError(
      'WUNDR_GOV_VALIDATE_FAILED',
      `Failed to validate IPRE config: ${message}`,
      { file },
      true,
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function displayComplianceResult(
  result: ComplianceResult,
  verbose: boolean,
): void {
  const statusIcon = result.compliant
    ? chalk.green('[PASS]')
    : chalk.red('[FAIL]');
  console.log(`${statusIcon} Compliance Score: ${colorScore(result.score)}`);
  console.log(`  Passed Policies: ${result.passedPolicies.length}`);
  console.log(`  Skipped Policies: ${result.skippedPolicies.length}`);
  console.log(`  Violations: ${result.violations.length}`);

  if (verbose && result.violations.length > 0) {
    console.log(chalk.yellow('\n  Violations:'));
    for (const violation of result.violations) {
      console.log(
        `    - [${violation.severity.toUpperCase()}] ${violation.policyName}`,
      );
      console.log(`      ${violation.description}`);
      if (violation.suggestedFix) {
        console.log(chalk.gray(`      Fix: ${violation.suggestedFix}`));
      }
    }
  }
}

function displayAlignmentResult(
  result: EvaluationResult,
  verbose: boolean,
): void {
  const statusIcon = result.passed
    ? chalk.green('[PASS]')
    : chalk.red('[FAIL]');
  console.log(`${statusIcon} Alignment Score: ${colorScore(result.score)}`);
  console.log(`  Issues: ${result.issues.length}`);
  console.log(`  Recommendations: ${result.recommendations.length}`);

  if (verbose && result.issues.length > 0) {
    console.log(chalk.yellow('\n  Issues:'));
    for (const issue of result.issues) {
      console.log(`    - ${issue}`);
    }
  }

  if (verbose && result.recommendations.length > 0) {
    console.log(chalk.blue('\n  Recommendations:'));
    for (const rec of result.recommendations) {
      console.log(`    - ${rec}`);
    }
  }
}

function displayDriftResult(result: EvaluationResult, verbose: boolean): void {
  // Note: For drift, higher score means less drift (inverted in evaluation)
  const driftScore = 1 - result.score;
  const statusIcon = result.passed
    ? chalk.green('[PASS]')
    : chalk.red('[FAIL]');
  console.log(
    `${statusIcon} Drift Score: ${colorScore(result.score)} (${(driftScore * 100).toFixed(1)}% drift)`,
  );
  console.log(`  Drift Alerts: ${result.issues.length}`);

  if (verbose && result.issues.length > 0) {
    console.log(chalk.yellow('\n  Drift Alerts:'));
    for (const issue of result.issues) {
      console.log(`    - ${issue}`);
    }
  }
}

function displaySummary(result: {
  passed: boolean;
  overallScore: number;
  results: readonly EvaluationResult[];
  criticalIssues: readonly string[];
}): void {
  const statusIcon = result.passed
    ? chalk.green('[PASSED]')
    : chalk.red('[FAILED]');
  console.log(
    `\n${statusIcon} Overall Score: ${colorScore(result.overallScore)}`,
  );

  if (result.criticalIssues.length > 0) {
    console.log(
      chalk.red(`\nCritical Issues (${result.criticalIssues.length}):`),
    );
    for (const issue of result.criticalIssues.slice(0, 5)) {
      console.log(chalk.red(`  - ${issue}`));
    }
    if (result.criticalIssues.length > 5) {
      console.log(
        chalk.gray(`  ... and ${result.criticalIssues.length - 5} more`),
      );
    }
  }
}

function colorScore(score: number): string {
  const percentage = (score * 100).toFixed(1);
  if (score >= 0.9) {
    return chalk.green(`${percentage}%`);
  }
  if (score >= 0.7) {
    return chalk.yellow(`${percentage}%`);
  }
  return chalk.red(`${percentage}%`);
}

function getSeverityColor(severity: string): (text: string) => string {
  switch (severity) {
    case 'critical':
      return chalk.red;
    case 'high':
      return chalk.yellow;
    case 'medium':
      return chalk.blue;
    default:
      return chalk.gray;
  }
}

function displayProgressBar(score: number): void {
  const width = 30;
  const filled = Math.round(score * width);
  const empty = width - filled;
  const bar =
    chalk.green('[' + '='.repeat(filled)) + chalk.gray('-'.repeat(empty) + ']');
  console.log(`  ${bar}`);
}

function calculateAlignmentDebt(
  compliance: ComplianceResult,
  alignment: EvaluationResult,
  drift: EvaluationResult,
): number {
  // Calculate debt as weighted sum of issues
  const complianceDebt = (1 - compliance.score) * 0.4;
  const alignmentDebt = (1 - alignment.score) * 0.35;
  const driftDebt = (1 - drift.score) * 0.25;
  return complianceDebt + alignmentDebt + driftDebt;
}

function countCriticalIssues(compliance: ComplianceResult): number {
  return compliance.violations.filter(v => v.severity === 'critical').length;
}

function countHighPriorityItems(alignment: EvaluationResult): number {
  // Count issues that contain high-priority indicators
  return alignment.issues.filter(
    issue =>
      issue.toLowerCase().includes('critical') ||
      issue.toLowerCase().includes('high'),
  ).length;
}

function extractAlignmentGaps(result: EvaluationResult): AlignmentGapDetail[] {
  // Parse alignment gaps from issues
  const gaps: AlignmentGapDetail[] = [];
  for (const issue of result.issues) {
    const match = issue.match(/gap in (\w+): expected ([\d.]+), got ([\d.]+)/i);
    if (match) {
      const expected = parseFloat(match[2] ?? '0');
      const actual = parseFloat(match[3] ?? '0');
      gaps.push({
        dimension: match[1] ?? 'unknown',
        expected,
        actual,
        gap: expected - actual,
        priority:
          expected - actual > 0.2
            ? 'high'
            : expected - actual > 0.1
              ? 'medium'
              : 'low',
      });
    }
  }
  return gaps;
}

function extractDriftAlerts(result: EvaluationResult): DriftAlertDetail[] {
  // Parse drift alerts from issues
  const alerts: DriftAlertDetail[] = [];
  for (const issue of result.issues) {
    const match = issue.match(/Drift.*in (\w+): ([\d.]+)% (\w+)/i);
    if (match) {
      const changePercent = parseFloat(match[2] ?? '0');
      alerts.push({
        pattern: match[1] ?? 'unknown',
        baselineValue: 0.9, // Default baseline
        currentValue: 0.9 * (1 + changePercent / 100),
        changePercent,
        direction: match[3] ?? 'stable',
        severity:
          changePercent >= 30
            ? 'critical'
            : changePercent >= 20
              ? 'high'
              : 'medium',
      });
    }
  }
  return alerts;
}

function generateRecommendations(
  compliance: ComplianceResult,
  alignment: EvaluationResult,
  drift: EvaluationResult,
): string[] {
  const recommendations: string[] = [];

  // Add compliance recommendations
  if (compliance.violations.length > 0) {
    recommendations.push(
      'Address policy violations immediately, especially critical ones',
    );
    const criticalCount = compliance.violations.filter(
      v => v.severity === 'critical',
    ).length;
    if (criticalCount > 0) {
      recommendations.push(
        `Fix ${criticalCount} critical policy violation(s) before deployment`,
      );
    }
  }

  // Add alignment recommendations from evaluator
  recommendations.push(...alignment.recommendations);

  // Add drift recommendations
  if (drift.issues.length > 0) {
    recommendations.push('Investigate drift causes and consider recalibration');
  }

  // General recommendations
  if (compliance.score < 0.8) {
    recommendations.push('Review and update security policies');
  }

  if (alignment.score < 0.85) {
    recommendations.push('Schedule alignment review session');
  }

  return [...new Set(recommendations)]; // Remove duplicates
}

function formatReportAsMarkdown(report: AlignmentDebtReport): string {
  let md = '# Alignment Debt Report\n\n';
  md += `Generated: ${report.generatedAt}\n`;
  if (report.sessionId) {
    md += `Session: ${report.sessionId}\n`;
  }
  md += '\n---\n\n';

  // Summary
  md += '## Summary\n\n';
  md += '| Metric | Value |\n';
  md += '|--------|-------|\n';
  md += `| Total Alignment Debt | ${report.summary.totalDebt.toFixed(2)} |\n`;
  md += `| Critical Issues | ${report.summary.criticalIssues} |\n`;
  md += `| High Priority Items | ${report.summary.highPriorityItems} |\n`;
  md += `| Alignment Score | ${(report.summary.alignmentScore * 100).toFixed(1)}% |\n`;
  md += `| Compliance Score | ${(report.summary.complianceScore * 100).toFixed(1)}% |\n`;
  md += `| Drift Score | ${(report.summary.driftScore * 100).toFixed(1)}% |\n`;
  md += '\n';

  // Policy Violations
  if (report.policyViolations.length > 0) {
    md += '## Policy Violations\n\n';
    for (const v of report.policyViolations) {
      md += `### ${v.policyName} (${v.severity.toUpperCase()})\n\n`;
      md += `- **Policy ID:** ${v.policyId}\n`;
      md += `- **Description:** ${v.description}\n`;
      if (v.location) {
        md += `- **Location:** ${v.location}\n`;
      }
      if (v.suggestedFix) {
        md += `- **Suggested Fix:** ${v.suggestedFix}\n`;
      }
      md += '\n';
    }
  }

  // Alignment Gaps
  if (report.alignmentGaps.length > 0) {
    md += '## Alignment Gaps\n\n';
    md += '| Dimension | Expected | Actual | Gap | Priority |\n';
    md += '|-----------|----------|--------|-----|----------|\n';
    for (const g of report.alignmentGaps) {
      md += `| ${g.dimension} | ${(g.expected * 100).toFixed(1)}% | ${(g.actual * 100).toFixed(1)}% | ${(g.gap * 100).toFixed(1)}% | ${g.priority} |\n`;
    }
    md += '\n';
  }

  // Drift Alerts
  if (report.driftAlerts.length > 0) {
    md += '## Drift Alerts\n\n';
    md += '| Pattern | Change | Direction | Severity |\n';
    md += '|---------|--------|-----------|----------|\n';
    for (const d of report.driftAlerts) {
      md += `| ${d.pattern} | ${d.changePercent.toFixed(1)}% | ${d.direction} | ${d.severity} |\n`;
    }
    md += '\n';
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    md += '## Recommendations\n\n';
    for (const rec of report.recommendations) {
      md += `- ${rec}\n`;
    }
    md += '\n';
  }

  return md;
}

function validateIPRESchema(config: IPREConfig): string[] {
  const errors: string[] = [];

  // Required fields
  if (!config.version) {
    errors.push('Missing required field: version');
  }

  if (!config.intent) {
    errors.push('Missing required field: intent');
  } else {
    if (!config.intent.mission) {
      errors.push('Missing required field: intent.mission');
    }
    if (!config.intent.values || !Array.isArray(config.intent.values)) {
      errors.push('Missing or invalid field: intent.values (must be array)');
    }
  }

  if (!config.policies) {
    errors.push('Missing required field: policies');
  } else {
    if (!Array.isArray(config.policies.security)) {
      errors.push('policies.security must be an array');
    }
    if (!Array.isArray(config.policies.compliance)) {
      errors.push('policies.compliance must be an array');
    }
    if (!Array.isArray(config.policies.operational)) {
      errors.push('policies.operational must be an array');
    }
  }

  if (!config.rewards) {
    errors.push('Missing required field: rewards');
  } else {
    if (!config.rewards.weights) {
      errors.push('Missing required field: rewards.weights');
    }
    if (typeof config.rewards.threshold !== 'number') {
      errors.push('rewards.threshold must be a number');
    }
  }

  if (!config.evaluators) {
    errors.push('Missing required field: evaluators');
  } else if (!Array.isArray(config.evaluators)) {
    errors.push('evaluators must be an array');
  }

  return errors;
}

function displayConfigSummary(config: IPREConfig): void {
  console.log(chalk.blue('\n--- Configuration Summary ---'));
  console.log(`Version: ${config.version}`);
  console.log(`Mission: ${config.intent?.mission || 'Not defined'}`);
  console.log(`Values: ${config.intent?.values?.length || 0} defined`);
  console.log(`Security Policies: ${config.policies?.security?.length || 0}`);
  console.log(
    `Compliance Policies: ${config.policies?.compliance?.length || 0}`,
  );
  console.log(
    `Operational Policies: ${config.policies?.operational?.length || 0}`,
  );
  console.log(`Evaluators: ${config.evaluators?.length || 0}`);
  if (config.rewards?.threshold) {
    console.log(`Reward Threshold: ${config.rewards.threshold}`);
  }
}

// ============================================================================
// State Management
// ============================================================================

const GOVERNANCE_STATE_PATH = '.wundr/governance-state.json';

interface GovernanceState {
  timestamp: string;
  sessionId: string;
  suiteResult?: {
    passed: boolean;
    overallScore: number;
    criticalIssues: string[];
  };
  complianceResult?: unknown;
  alignmentResult?: unknown;
  driftResult?: unknown;
}

async function saveGovernanceState(
  sessionId: string,
  data: {
    complianceResult: ComplianceResult;
    alignmentResult: EvaluationResult;
    driftResult: EvaluationResult;
    suiteResult: {
      passed: boolean;
      overallScore: number;
      results: readonly EvaluationResult[];
      criticalIssues: readonly string[];
    };
  },
): Promise<void> {
  const statePath = path.join(process.cwd(), GOVERNANCE_STATE_PATH);
  await fs.ensureDir(path.dirname(statePath));

  const state: GovernanceState = {
    timestamp: new Date().toISOString(),
    sessionId,
    suiteResult: {
      passed: data.suiteResult.passed,
      overallScore: data.suiteResult.overallScore,
      criticalIssues: [...data.suiteResult.criticalIssues],
    },
    complianceResult: data.complianceResult,
    alignmentResult: data.alignmentResult,
    driftResult: data.driftResult,
  };

  await fs.writeJson(statePath, state, { spaces: 2 });
}

async function loadGovernanceState(): Promise<GovernanceState | null> {
  const statePath = path.join(process.cwd(), GOVERNANCE_STATE_PATH);

  if (await fs.pathExists(statePath)) {
    return await fs.readJson(statePath);
  }

  return null;
}

async function loadRecentInterventions(): Promise<Intervention[]> {
  // Load from state file or return empty array
  // In a real implementation, this would load from a persistent store
  return [];
}

function extractDriftIndicatorsFromState(
  state: GovernanceState | null,
): DriftIndicator[] {
  if (!state?.driftResult) {
    return [];
  }

  const driftResult = state.driftResult as EvaluationResult;
  const indicators: DriftIndicator[] = [];

  for (const issue of driftResult.issues || []) {
    const match = issue.match(/Drift.*in (\w+): ([\d.]+)%/i);
    if (match) {
      indicators.push({
        pattern: match[1] ?? 'unknown',
        baseline: 0.9,
        current: 0.9 * (1 + parseFloat(match[2] ?? '0') / 100),
        change: parseFloat(match[2] ?? '0') / 100,
        severity: 'medium',
      });
    }
  }

  return indicators;
}

// ============================================================================
// Exports
// ============================================================================

export { createGovernanceCommand as governanceCommand };
