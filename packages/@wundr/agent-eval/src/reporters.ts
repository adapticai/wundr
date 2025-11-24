/**
 * @wundr.io/agent-eval - Results Reporters
 *
 * Utilities for formatting and outputting evaluation results in various formats.
 * Supports console, JSON, Markdown, HTML, and custom report generation.
 */

import type { EvalResults, FailureAnalysis } from './types';

// ============================================================================
// Report Format Types
// ============================================================================

/**
 * Supported report output formats
 */
export type ReportFormat = 'console' | 'json' | 'markdown' | 'html' | 'csv';

/**
 * Options for report generation
 */
export interface ReportOptions {
  /** Output format */
  format: ReportFormat;
  /** Include individual test details */
  includeTestDetails?: boolean;
  /** Include criterion-level scores */
  includeCriterionDetails?: boolean;
  /** Include execution traces */
  includeTraces?: boolean;
  /** Include failure analysis */
  includeFailureAnalysis?: boolean;
  /** Custom title for the report */
  title?: string;
  /** Timestamp format */
  timestampFormat?: 'iso' | 'locale' | 'unix';
}

/**
 * Generated report output
 */
export interface ReportOutput {
  /** Report format */
  format: ReportFormat;
  /** Report content */
  content: string;
  /** Report metadata */
  metadata: {
    generatedAt: Date;
    runId: string;
    suiteId: string;
  };
}

// ============================================================================
// ResultsReporter Class
// ============================================================================

/**
 * ResultsReporter - Generate formatted evaluation reports
 *
 * Produces evaluation reports in multiple formats for different use cases:
 * - Console: Colored terminal output for quick review
 * - JSON: Structured data for programmatic processing
 * - Markdown: Documentation-friendly format
 * - HTML: Web-viewable reports
 * - CSV: Spreadsheet-compatible export
 */
export class ResultsReporter {
  private defaultOptions: ReportOptions = {
    format: 'console',
    includeTestDetails: true,
    includeCriterionDetails: false,
    includeTraces: false,
    includeFailureAnalysis: true,
    timestampFormat: 'iso',
  };

  /**
   * Generate a report from evaluation results
   * @param results - Evaluation results to report
   * @param options - Report generation options
   * @param failureAnalysis - Optional failure analysis to include
   * @returns Generated report
   */
  generate(
    results: EvalResults,
    options: Partial<ReportOptions> = {},
    failureAnalysis?: FailureAnalysis,
  ): ReportOutput {
    const opts = { ...this.defaultOptions, ...options };

    let content: string;
    switch (opts.format) {
      case 'json':
        content = this.generateJSON(results, opts, failureAnalysis);
        break;
      case 'markdown':
        content = this.generateMarkdown(results, opts, failureAnalysis);
        break;
      case 'html':
        content = this.generateHTML(results, opts, failureAnalysis);
        break;
      case 'csv':
        content = this.generateCSV(results, opts);
        break;
      case 'console':
      default:
        content = this.generateConsole(results, opts, failureAnalysis);
        break;
    }

    return {
      format: opts.format,
      content,
      metadata: {
        generatedAt: new Date(),
        runId: results.runId,
        suiteId: results.suiteId,
      },
    };
  }

  /**
   * Generate console output (with ANSI colors)
   */
  private generateConsole(
    results: EvalResults,
    options: ReportOptions,
    failureAnalysis?: FailureAnalysis,
  ): string {
    const lines: string[] = [];
    const { summary } = results;

    // Header
    lines.push('\n' + '='.repeat(60));
    lines.push(this.centerText(options.title || 'Evaluation Results', 60));
    lines.push('='.repeat(60));

    // Suite info
    lines.push(`Suite: ${results.suiteName} (v${results.suiteVersion})`);
    lines.push(`Run ID: ${results.runId}`);
    if (results.agentId) {
      lines.push(
        `Agent: ${results.agentId}${results.agentVersion ? ` (v${results.agentVersion})` : ''}`,
      );
    }
    lines.push(
      `Started: ${this.formatTimestamp(results.startedAt, options.timestampFormat)}`,
    );
    lines.push(
      `Duration: ${this.formatDuration(summary.totalExecutionTimeMs)}`,
    );
    lines.push('');

    // Summary
    lines.push('-'.repeat(60));
    lines.push('SUMMARY');
    lines.push('-'.repeat(60));

    const passIcon =
      summary.passRate >= 0.8
        ? '[PASS]'
        : summary.passRate >= 0.5
          ? '[WARN]'
          : '[FAIL]';
    lines.push(
      `${passIcon} Pass Rate: ${(summary.passRate * 100).toFixed(1)}% (${summary.passedTests}/${summary.totalTests})`,
    );
    lines.push(`Average Score: ${summary.averageScore.toFixed(2)}/10`);
    lines.push(
      `Passed: ${summary.passedTests} | Failed: ${summary.failedTests} | Errored: ${summary.erroredTests}`,
    );
    lines.push('');

    // Criterion averages
    if (Object.keys(summary.criterionAverages).length > 0) {
      lines.push('Criterion Averages:');
      for (const [criterion, avg] of Object.entries(
        summary.criterionAverages,
      )) {
        const bar = this.createProgressBar(avg / 10, 20);
        lines.push(`  ${criterion.padEnd(15)} ${bar} ${avg.toFixed(1)}/10`);
      }
      lines.push('');
    }

    // Test details
    if (options.includeTestDetails) {
      lines.push('-'.repeat(60));
      lines.push('TEST RESULTS');
      lines.push('-'.repeat(60));

      for (const test of results.testResults) {
        const icon = test.error ? '[ERR]' : test.passed ? '[OK]' : '[FAIL]';
        lines.push(`${icon} ${test.testCaseName} (iter ${test.iteration})`);
        lines.push(
          `    Score: ${test.score.toFixed(1)}/10 | Time: ${test.executionTimeMs}ms`,
        );

        if (
          options.includeCriterionDetails &&
          test.criterionResults.length > 0
        ) {
          for (const cr of test.criterionResults) {
            const crIcon = cr.passed ? '+' : '-';
            lines.push(
              `    ${crIcon} ${cr.criterionName}: ${cr.score.toFixed(1)}/10`,
            );
          }
        }

        if (test.error) {
          lines.push(`    Error: ${test.error}`);
        }
        lines.push('');
      }
    }

    // Failure analysis
    if (options.includeFailureAnalysis && failureAnalysis) {
      lines.push('-'.repeat(60));
      lines.push('FAILURE ANALYSIS');
      lines.push('-'.repeat(60));

      if (failureAnalysis.patterns.length > 0) {
        lines.push('Patterns:');
        for (const pattern of failureAnalysis.patterns) {
          lines.push(
            `  - ${pattern.name} (${(pattern.frequency * 100).toFixed(0)}%)`,
          );
        }
        lines.push('');
      }

      if (failureAnalysis.recommendations.length > 0) {
        lines.push('Recommendations:');
        for (const rec of failureAnalysis.recommendations) {
          lines.push(`  * ${rec}`);
        }
      }
    }

    lines.push('='.repeat(60));
    return lines.join('\n');
  }

  /**
   * Generate JSON output
   */
  private generateJSON(
    results: EvalResults,
    options: ReportOptions,
    failureAnalysis?: FailureAnalysis,
  ): string {
    const output: Record<string, unknown> = {
      title: options.title || 'Evaluation Results',
      generatedAt: new Date().toISOString(),
      suite: {
        id: results.suiteId,
        name: results.suiteName,
        version: results.suiteVersion,
      },
      run: {
        id: results.runId,
        startedAt: results.startedAt,
        completedAt: results.completedAt,
        agentId: results.agentId,
        agentVersion: results.agentVersion,
      },
      summary: results.summary,
    };

    if (options.includeTestDetails) {
      output['testResults'] = results.testResults.map(test => {
        const testOutput: Record<string, unknown> = {
          testCaseId: test.testCaseId,
          testCaseName: test.testCaseName,
          iteration: test.iteration,
          passed: test.passed,
          score: test.score,
          executionTimeMs: test.executionTimeMs,
          overallAssessment: test.overallAssessment,
        };

        if (test.error) {
          testOutput['error'] = test.error;
        }

        if (options.includeCriterionDetails) {
          testOutput['criterionResults'] = test.criterionResults;
        }

        if (options.includeTraces && test.trace) {
          testOutput['trace'] = test.trace;
        }

        return testOutput;
      });
    }

    if (options.includeFailureAnalysis && failureAnalysis) {
      output['failureAnalysis'] = failureAnalysis;
    }

    return JSON.stringify(output, null, 2);
  }

  /**
   * Generate Markdown output
   */
  private generateMarkdown(
    results: EvalResults,
    options: ReportOptions,
    failureAnalysis?: FailureAnalysis,
  ): string {
    const lines: string[] = [];
    const { summary } = results;

    // Title
    lines.push(`# ${options.title || 'Evaluation Results'}`);
    lines.push('');

    // Metadata
    lines.push('## Overview');
    lines.push('');
    lines.push('| Property | Value |');
    lines.push('|----------|-------|');
    lines.push(`| Suite | ${results.suiteName} (v${results.suiteVersion}) |`);
    lines.push(`| Run ID | \`${results.runId}\` |`);
    if (results.agentId) {
      lines.push(
        `| Agent | ${results.agentId}${results.agentVersion ? ` (v${results.agentVersion})` : ''} |`,
      );
    }
    lines.push(
      `| Started | ${this.formatTimestamp(results.startedAt, options.timestampFormat)} |`,
    );
    lines.push(
      `| Duration | ${this.formatDuration(summary.totalExecutionTimeMs)} |`,
    );
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    const passEmoji =
      summary.passRate >= 0.8 ? '✅' : summary.passRate >= 0.5 ? '⚠️' : '❌';
    lines.push(
      `${passEmoji} **Pass Rate: ${(summary.passRate * 100).toFixed(1)}%** (${summary.passedTests}/${summary.totalTests})`,
    );
    lines.push('');
    lines.push(`- **Average Score:** ${summary.averageScore.toFixed(2)}/10`);
    lines.push(`- **Passed:** ${summary.passedTests}`);
    lines.push(`- **Failed:** ${summary.failedTests}`);
    lines.push(`- **Errored:** ${summary.erroredTests}`);
    lines.push('');

    // Criterion averages
    if (Object.keys(summary.criterionAverages).length > 0) {
      lines.push('### Criterion Averages');
      lines.push('');
      lines.push('| Criterion | Score |');
      lines.push('|-----------|-------|');
      for (const [criterion, avg] of Object.entries(
        summary.criterionAverages,
      )) {
        lines.push(`| ${criterion} | ${avg.toFixed(2)}/10 |`);
      }
      lines.push('');
    }

    // Test details
    if (options.includeTestDetails) {
      lines.push('## Test Results');
      lines.push('');

      for (const test of results.testResults) {
        const icon = test.error ? '🔴' : test.passed ? '🟢' : '🟡';
        lines.push(`### ${icon} ${test.testCaseName}`);
        lines.push('');
        lines.push(`- **Iteration:** ${test.iteration}`);
        lines.push(`- **Score:** ${test.score.toFixed(1)}/10`);
        lines.push(
          `- **Status:** ${test.error ? 'Error' : test.passed ? 'Passed' : 'Failed'}`,
        );
        lines.push(`- **Time:** ${test.executionTimeMs}ms`);
        lines.push('');

        if (test.overallAssessment) {
          lines.push(`> ${test.overallAssessment}`);
          lines.push('');
        }

        if (
          options.includeCriterionDetails &&
          test.criterionResults.length > 0
        ) {
          lines.push('#### Criterion Scores');
          lines.push('');
          lines.push('| Criterion | Score | Status |');
          lines.push('|-----------|-------|--------|');
          for (const cr of test.criterionResults) {
            const status = cr.passed ? '✅' : '❌';
            lines.push(
              `| ${cr.criterionName} | ${cr.score.toFixed(1)}/10 | ${status} |`,
            );
          }
          lines.push('');
        }

        if (test.error) {
          lines.push(`**Error:** \`${test.error}\``);
          lines.push('');
        }
      }
    }

    // Failure analysis
    if (
      options.includeFailureAnalysis &&
      failureAnalysis &&
      failureAnalysis.failedTestCaseIds.length > 0
    ) {
      lines.push('## Failure Analysis');
      lines.push('');

      if (failureAnalysis.patterns.length > 0) {
        lines.push('### Identified Patterns');
        lines.push('');
        for (const pattern of failureAnalysis.patterns) {
          lines.push(`#### ${pattern.name}`);
          lines.push('');
          lines.push(pattern.description);
          lines.push('');
          lines.push(
            `- **Frequency:** ${(pattern.frequency * 100).toFixed(1)}%`,
          );
          lines.push(
            `- **Affected Tests:** ${pattern.matchingTestCases.length}`,
          );
          if (pattern.suggestedRemediation) {
            lines.push(`- **Suggested Fix:** ${pattern.suggestedRemediation}`);
          }
          lines.push('');
        }
      }

      if (failureAnalysis.recommendations.length > 0) {
        lines.push('### Recommendations');
        lines.push('');
        for (const rec of failureAnalysis.recommendations) {
          lines.push(`- ${rec}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate HTML output
   */
  private generateHTML(
    results: EvalResults,
    options: ReportOptions,
    failureAnalysis?: FailureAnalysis,
  ): string {
    const { summary } = results;
    const passColor =
      summary.passRate >= 0.8
        ? '#4caf50'
        : summary.passRate >= 0.5
          ? '#ff9800'
          : '#f44336';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title || 'Evaluation Results'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-top: 0; }
    h2 { color: #555; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .pass-rate { font-size: 48px; font-weight: bold; color: ${passColor}; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat { text-align: center; padding: 15px; background: #f9f9f9; border-radius: 4px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #333; }
    .stat-label { color: #666; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f9f9f9; font-weight: 600; }
    .passed { color: #4caf50; }
    .failed { color: #f44336; }
    .errored { color: #9c27b0; }
    .progress-bar { background: #e0e0e0; border-radius: 4px; overflow: hidden; height: 20px; }
    .progress-fill { background: #4caf50; height: 100%; transition: width 0.3s; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>${options.title || 'Evaluation Results'}</h1>
      <p><strong>Suite:</strong> ${results.suiteName} (v${results.suiteVersion})</p>
      <p><strong>Run ID:</strong> <code>${results.runId}</code></p>
      ${results.agentId ? `<p><strong>Agent:</strong> ${results.agentId}${results.agentVersion ? ` (v${results.agentVersion})` : ''}</p>` : ''}
      <p><strong>Duration:</strong> ${this.formatDuration(summary.totalExecutionTimeMs)}</p>
    </div>

    <div class="card">
      <h2>Summary</h2>
      <div class="pass-rate">${(summary.passRate * 100).toFixed(1)}% Pass Rate</div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${summary.averageScore.toFixed(1)}</div>
          <div class="stat-label">Average Score</div>
        </div>
        <div class="stat">
          <div class="stat-value passed">${summary.passedTests}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat">
          <div class="stat-value failed">${summary.failedTests}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat">
          <div class="stat-value errored">${summary.erroredTests}</div>
          <div class="stat-label">Errored</div>
        </div>
      </div>
    </div>

    ${
      options.includeTestDetails
        ? `
    <div class="card">
      <h2>Test Results</h2>
      <table>
        <thead>
          <tr>
            <th>Test Case</th>
            <th>Iteration</th>
            <th>Score</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${results.testResults
            .map(
              test => `
          <tr>
            <td>${test.testCaseName}</td>
            <td>${test.iteration}</td>
            <td>${test.score.toFixed(1)}/10</td>
            <td class="${test.error ? 'errored' : test.passed ? 'passed' : 'failed'}">${test.error ? 'Error' : test.passed ? 'Passed' : 'Failed'}</td>
            <td>${test.executionTimeMs}ms</td>
          </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    ${
      options.includeFailureAnalysis &&
      failureAnalysis &&
      failureAnalysis.recommendations.length > 0
        ? `
    <div class="card">
      <h2>Recommendations</h2>
      <ul>
        ${failureAnalysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ul>
    </div>
    `
        : ''
    }
  </div>
</body>
</html>`;
  }

  /**
   * Generate CSV output
   */
  private generateCSV(results: EvalResults, options: ReportOptions): string {
    const lines: string[] = [];

    // Header
    const headers = [
      'Test Case ID',
      'Test Case Name',
      'Iteration',
      'Score',
      'Passed',
      'Execution Time (ms)',
      'Error',
    ];

    if (options.includeCriterionDetails) {
      // Get all criterion IDs from first result with criteria
      const firstWithCriteria = results.testResults.find(
        r => r.criterionResults.length > 0,
      );
      if (firstWithCriteria) {
        for (const cr of firstWithCriteria.criterionResults) {
          headers.push(`${cr.criterionName} Score`);
        }
      }
    }

    lines.push(headers.join(','));

    // Data rows
    for (const test of results.testResults) {
      const row = [
        this.escapeCSV(test.testCaseId),
        this.escapeCSV(test.testCaseName),
        test.iteration.toString(),
        test.score.toFixed(2),
        test.passed ? 'true' : 'false',
        test.executionTimeMs.toString(),
        this.escapeCSV(test.error || ''),
      ];

      if (options.includeCriterionDetails) {
        for (const cr of test.criterionResults) {
          row.push(cr.score.toFixed(2));
        }
      }

      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Helper: Center text within a width
   */
  private centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  /**
   * Helper: Create ASCII progress bar
   */
  private createProgressBar(ratio: number, width: number): string {
    const filled = Math.round(ratio * width);
    const empty = width - filled;
    return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
  }

  /**
   * Helper: Format timestamp
   */
  private formatTimestamp(
    date: Date,
    format?: 'iso' | 'locale' | 'unix',
  ): string {
    switch (format) {
      case 'unix':
        return date.getTime().toString();
      case 'locale':
        return date.toLocaleString();
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Helper: Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}m ${secs}s`;
  }

  /**
   * Helper: Escape CSV field
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ResultsReporter instance
 * @returns ResultsReporter instance
 */
export function createReporter(): ResultsReporter {
  return new ResultsReporter();
}

/**
 * Quick report generation helper
 * @param results - Evaluation results
 * @param format - Output format
 * @returns Report content string
 */
export function generateReport(
  results: EvalResults,
  format: ReportFormat = 'console',
): string {
  const reporter = new ResultsReporter();
  return reporter.generate(results, { format }).content;
}

/**
 * Generate a comparison report between two evaluation runs
 * @param baseline - Baseline results
 * @param current - Current results
 * @param format - Output format
 * @returns Comparison report
 */
export function generateComparisonReport(
  baseline: EvalResults,
  current: EvalResults,
  format: ReportFormat = 'markdown',
): string {
  const lines: string[] = [];

  if (format === 'markdown') {
    lines.push('# Evaluation Comparison Report');
    lines.push('');
    lines.push('## Overview');
    lines.push('');
    lines.push('| Metric | Baseline | Current | Change |');
    lines.push('|--------|----------|---------|--------|');

    const passRateChange = current.summary.passRate - baseline.summary.passRate;
    const scoreChange =
      current.summary.averageScore - baseline.summary.averageScore;

    lines.push(
      `| Pass Rate | ${(baseline.summary.passRate * 100).toFixed(1)}% | ${(current.summary.passRate * 100).toFixed(1)}% | ${passRateChange >= 0 ? '+' : ''}${(passRateChange * 100).toFixed(1)}% |`,
    );
    lines.push(
      `| Average Score | ${baseline.summary.averageScore.toFixed(2)} | ${current.summary.averageScore.toFixed(2)} | ${scoreChange >= 0 ? '+' : ''}${scoreChange.toFixed(2)} |`,
    );
    lines.push(
      `| Total Tests | ${baseline.summary.totalTests} | ${current.summary.totalTests} | ${current.summary.totalTests - baseline.summary.totalTests} |`,
    );
    lines.push('');

    // Criterion comparison
    lines.push('## Criterion Changes');
    lines.push('');
    lines.push('| Criterion | Baseline | Current | Change |');
    lines.push('|-----------|----------|---------|--------|');

    for (const [criterion, currentAvg] of Object.entries(
      current.summary.criterionAverages,
    )) {
      const baselineAvg = baseline.summary.criterionAverages[criterion] || 0;
      const change = currentAvg - baselineAvg;
      const changeStr =
        change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
      lines.push(
        `| ${criterion} | ${baselineAvg.toFixed(2)} | ${currentAvg.toFixed(2)} | ${changeStr} |`,
      );
    }
  } else {
    lines.push(
      JSON.stringify(
        {
          baseline: baseline.summary,
          current: current.summary,
          changes: {
            passRate: current.summary.passRate - baseline.summary.passRate,
            averageScore:
              current.summary.averageScore - baseline.summary.averageScore,
          },
        },
        null,
        2,
      ),
    );
  }

  return lines.join('\n');
}
