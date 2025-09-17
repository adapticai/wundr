/**
 * Performance Impact Analyzer - Comprehensive monitoring for lint fixes and type changes
 *
 * This analyzer monitors that lint fixes don't negatively impact performance,
 * ensures logging changes don't create performance bottlenecks, and validates
 * that type changes maintain efficiency.
 */

import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { createTimer, measureTime, getMemoryUsage, PerformanceAggregator } from '../packages/@wundr/core/src/utils/performance.js';
import { getLogger } from '../packages/@wundr/core/src/logger/index.js';

const logger = getLogger().child({ module: 'performance-impact-analyzer' });

export interface PerformanceImpactReport {
  timestamp: Date;
  baseline: PerformanceBaseline;
  postChanges: PerformanceMetrics;
  impact: PerformanceImpact;
  recommendations: string[];
  criticalIssues: CriticalIssue[];
}

export interface PerformanceBaseline {
  buildTime: number;
  lintTime: number;
  typecheckTime: number;
  memoryUsage: number;
  consoleUsageCount: number;
  failedBuilds: string[];
  failedLints: string[];
}

export interface PerformanceMetrics {
  buildTime: number;
  lintTime: number;
  typecheckTime: number;
  memoryUsage: number;
  consoleUsageCount: number;
  errorCount: number;
  warningCount: number;
}

export interface PerformanceImpact {
  buildTimeChange: number; // percentage
  lintTimeChange: number; // percentage
  typecheckTimeChange: number; // percentage
  memoryUsageChange: number; // percentage
  consoleUsageReduction: number; // absolute count
  overallImpact: 'positive' | 'negative' | 'neutral';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CriticalIssue {
  type: 'build-failure' | 'performance-regression' | 'memory-leak' | 'lint-errors';
  severity: 'high' | 'critical';
  description: string;
  affectedComponents: string[];
  recommendedActions: string[];
}

export class PerformanceImpactAnalyzer {
  private aggregator: PerformanceAggregator;
  private baseline: PerformanceBaseline | null = null;

  constructor() {
    this.aggregator = new PerformanceAggregator('performance-impact-analyzer');
  }

  /**
   * Establish performance baseline before changes
   */
  async establishBaseline(): Promise<PerformanceBaseline> {
    logger.info('Establishing performance baseline...');

    const timer = createTimer('baseline-establishment');

    try {
      // Count console usage across codebase
      const consoleUsageCount = await this.countConsoleUsage();

      // Measure build performance
      const buildMetrics = await this.measureBuildPerformance();

      // Measure lint performance
      const lintMetrics = await this.measureLintPerformance();

      // Measure TypeScript compilation
      const typecheckMetrics = await this.measureTypecheckPerformance();

      // Get memory usage
      const memoryUsage = getMemoryUsage().used;

      this.baseline = {
        buildTime: buildMetrics.duration,
        lintTime: lintMetrics.duration,
        typecheckTime: typecheckMetrics.duration,
        memoryUsage,
        consoleUsageCount,
        failedBuilds: buildMetrics.failures,
        failedLints: lintMetrics.failures
      };

      logger.info('Performance baseline established', {
        baseline: this.baseline,
        duration: timer.stop()
      });

      return this.baseline;

    } catch (error) {
      logger.error('Failed to establish baseline', { error });
      throw error;
    }
  }

  /**
   * Analyze performance after changes
   */
  async analyzePostChangePerformance(): Promise<PerformanceImpactReport> {
    if (!this.baseline) {
      throw new Error('Baseline not established. Call establishBaseline() first.');
    }

    logger.info('Analyzing post-change performance...');

    const timer = createTimer('post-change-analysis');

    try {
      // Measure current performance
      const postChanges = await this.measureCurrentPerformance();

      // Calculate impact
      const impact = this.calculateImpact(this.baseline, postChanges);

      // Identify critical issues
      const criticalIssues = await this.identifyCriticalIssues(postChanges);

      // Generate recommendations
      const recommendations = this.generateRecommendations(impact, criticalIssues);

      const report: PerformanceImpactReport = {
        timestamp: new Date(),
        baseline: this.baseline,
        postChanges,
        impact,
        recommendations,
        criticalIssues
      };

      logger.info('Performance analysis completed', {
        impact: impact.overallImpact,
        severity: impact.severity,
        duration: timer.stop()
      });

      return report;

    } catch (error) {
      logger.error('Failed to analyze post-change performance', { error });
      throw error;
    }
  }

  /**
   * Count console.log usage across codebase
   */
  private async countConsoleUsage(): Promise<number> {
    const { result: count } = await measureTime(async () => {
      const command = 'rg';
      const args = ['console\\.(log|warn|error|info|debug)', '--count', '--type', 'ts', '--type', 'tsx'];

      return new Promise<number>((resolve, reject) => {
        const process = spawn(command, args, { cwd: '/Users/layla/wundr' });
        let output = '';

        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            const lines = output.trim().split('\n').filter(line => line);
            const totalCount = lines.reduce((sum, line) => {
              const match = line.split(':');
              return sum + (match.length > 1 ? parseInt(match[1]) || 0 : 0);
            }, 0);
            resolve(totalCount);
          } else {
            resolve(0); // No matches or error
          }
        });

        process.on('error', (error) => {
          logger.warn('Failed to count console usage', { error });
          resolve(0);
        });
      });
    }, {
      label: 'console-usage-count',
      enableLogging: true
    });

    return count;
  }

  /**
   * Measure build performance
   */
  private async measureBuildPerformance(): Promise<{ duration: number; failures: string[] }> {
    const { result, duration } = await measureTime(async () => {
      return new Promise<{ success: boolean; failures: string[] }>((resolve) => {
        const process = spawn('npm', ['run', 'build'], {
          cwd: '/Users/layla/wundr',
          stdio: 'pipe'
        });

        let output = '';
        let errorOutput = '';

        process.stdout?.on('data', (data) => {
          output += data.toString();
        });

        process.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          const failures = this.parseFailuresFromOutput(output + errorOutput);
          resolve({
            success: code === 0,
            failures
          });
        });
      });
    }, {
      label: 'build-performance',
      enableLogging: true
    });

    return {
      duration,
      failures: result.failures
    };
  }

  /**
   * Measure lint performance
   */
  private async measureLintPerformance(): Promise<{ duration: number; failures: string[] }> {
    const { result, duration } = await measureTime(async () => {
      return new Promise<{ success: boolean; failures: string[] }>((resolve) => {
        const process = spawn('npm', ['run', 'lint'], {
          cwd: '/Users/layla/wundr',
          stdio: 'pipe'
        });

        let output = '';
        let errorOutput = '';

        process.stdout?.on('data', (data) => {
          output += data.toString();
        });

        process.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          const failures = this.parseLintFailuresFromOutput(output + errorOutput);
          resolve({
            success: code === 0,
            failures
          });
        });
      });
    }, {
      label: 'lint-performance',
      enableLogging: true
    });

    return {
      duration,
      failures: result.failures
    };
  }

  /**
   * Measure TypeScript compilation performance
   */
  private async measureTypecheckPerformance(): Promise<{ duration: number; failures: string[] }> {
    const { result, duration } = await measureTime(async () => {
      return new Promise<{ success: boolean; failures: string[] }>((resolve) => {
        const process = spawn('npm', ['run', 'typecheck'], {
          cwd: '/Users/layla/wundr',
          stdio: 'pipe'
        });

        let output = '';
        let errorOutput = '';

        process.stdout?.on('data', (data) => {
          output += data.toString();
        });

        process.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          const failures = this.parseTypecheckFailuresFromOutput(output + errorOutput);
          resolve({
            success: code === 0,
            failures
          });
        });
      });
    }, {
      label: 'typecheck-performance',
      enableLogging: true
    });

    return {
      duration,
      failures: result.failures
    };
  }

  /**
   * Measure current performance metrics
   */
  private async measureCurrentPerformance(): Promise<PerformanceMetrics> {
    const consoleUsageCount = await this.countConsoleUsage();
    const buildMetrics = await this.measureBuildPerformance();
    const lintMetrics = await this.measureLintPerformance();
    const typecheckMetrics = await this.measureTypecheckPerformance();
    const memoryUsage = getMemoryUsage().used;

    // Count errors and warnings from lint output
    const { errorCount, warningCount } = this.countErrorsAndWarnings(lintMetrics.failures);

    return {
      buildTime: buildMetrics.duration,
      lintTime: lintMetrics.duration,
      typecheckTime: typecheckMetrics.duration,
      memoryUsage,
      consoleUsageCount,
      errorCount,
      warningCount
    };
  }

  /**
   * Calculate performance impact
   */
  private calculateImpact(baseline: PerformanceBaseline, current: PerformanceMetrics): PerformanceImpact {
    const buildTimeChange = ((current.buildTime - baseline.buildTime) / baseline.buildTime) * 100;
    const lintTimeChange = ((current.lintTime - baseline.lintTime) / baseline.lintTime) * 100;
    const typecheckTimeChange = ((current.typecheckTime - baseline.typecheckTime) / baseline.typecheckTime) * 100;
    const memoryUsageChange = ((current.memoryUsage - baseline.memoryUsage) / baseline.memoryUsage) * 100;
    const consoleUsageReduction = baseline.consoleUsageCount - current.consoleUsageCount;

    // Determine overall impact
    let overallImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Performance regression thresholds
    if (buildTimeChange > 20 || lintTimeChange > 20 || typecheckTimeChange > 20) {
      overallImpact = 'negative';
      severity = 'critical';
    } else if (buildTimeChange > 10 || lintTimeChange > 10 || memoryUsageChange > 15) {
      overallImpact = 'negative';
      severity = 'high';
    } else if (buildTimeChange > 5 || lintTimeChange > 5) {
      overallImpact = 'negative';
      severity = 'medium';
    } else if (consoleUsageReduction > 0 && buildTimeChange < 2 && lintTimeChange < 2) {
      overallImpact = 'positive';
      severity = 'low';
    }

    return {
      buildTimeChange,
      lintTimeChange,
      typecheckTimeChange,
      memoryUsageChange,
      consoleUsageReduction,
      overallImpact,
      severity
    };
  }

  /**
   * Identify critical issues
   */
  private async identifyCriticalIssues(metrics: PerformanceMetrics): Promise<CriticalIssue[]> {
    const issues: CriticalIssue[] = [];

    // Build failures
    if (metrics.errorCount > 0) {
      issues.push({
        type: 'build-failure',
        severity: 'critical',
        description: `${metrics.errorCount} build errors detected`,
        affectedComponents: ['core', 'security', 'web-client'],
        recommendedActions: [
          'Fix TypeScript compilation errors',
          'Review type compatibility issues',
          'Update type definitions'
        ]
      });
    }

    // Performance regression
    if (this.baseline && metrics.buildTime > this.baseline.buildTime * 1.2) {
      issues.push({
        type: 'performance-regression',
        severity: 'high',
        description: 'Build time increased by more than 20%',
        affectedComponents: ['build-system'],
        recommendedActions: [
          'Optimize TypeScript compilation',
          'Review lint rule complexity',
          'Consider incremental builds'
        ]
      });
    }

    // Memory usage spike
    if (this.baseline && metrics.memoryUsage > this.baseline.memoryUsage * 1.3) {
      issues.push({
        type: 'memory-leak',
        severity: 'high',
        description: 'Memory usage increased by more than 30%',
        affectedComponents: ['performance-analyzer', 'build-tools'],
        recommendedActions: [
          'Profile memory usage',
          'Check for memory leaks',
          'Optimize data structures'
        ]
      });
    }

    // High lint error count
    if (metrics.errorCount > 50) {
      issues.push({
        type: 'lint-errors',
        severity: 'high',
        description: `High number of lint errors: ${metrics.errorCount}`,
        affectedComponents: ['web-client', 'codebase-quality'],
        recommendedActions: [
          'Fix unused variable errors',
          'Replace console.log with proper logging',
          'Add proper TypeScript types'
        ]
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(impact: PerformanceImpact, issues: CriticalIssue[]): string[] {
    const recommendations: string[] = [];

    // Performance-based recommendations
    if (impact.overallImpact === 'negative') {
      if (impact.buildTimeChange > 10) {
        recommendations.push('Consider optimizing build configuration');
        recommendations.push('Review TypeScript compiler options');
      }

      if (impact.lintTimeChange > 10) {
        recommendations.push('Optimize ESLint rules configuration');
        recommendations.push('Consider disabling expensive lint rules in development');
      }

      if (impact.memoryUsageChange > 15) {
        recommendations.push('Monitor memory usage during builds');
        recommendations.push('Consider garbage collection tuning');
      }
    }

    // Issue-based recommendations
    for (const issue of issues) {
      recommendations.push(...issue.recommendedActions);
    }

    // Console usage recommendations
    if (impact.consoleUsageReduction > 0) {
      recommendations.push('Continue replacing console.log with structured logging');
      recommendations.push('Monitor logging performance overhead');
    } else {
      recommendations.push('Replace remaining console.log statements with proper logging');
      recommendations.push('Implement log level filtering for production');
    }

    // General recommendations
    recommendations.push('Set up continuous performance monitoring');
    recommendations.push('Establish performance regression testing');
    recommendations.push('Monitor build and deployment pipeline efficiency');

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Parse build failures from output
   */
  private parseFailuresFromOutput(output: string): string[] {
    const failures: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('ERROR:') || line.includes('Failed:') || line.includes('error TS')) {
        failures.push(line.trim());
      }
    }

    return failures;
  }

  /**
   * Parse lint failures from output
   */
  private parseLintFailuresFromOutput(output: string): string[] {
    const failures: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('Error:') || line.includes('Warning:')) {
        failures.push(line.trim());
      }
    }

    return failures;
  }

  /**
   * Parse TypeScript compilation failures
   */
  private parseTypecheckFailuresFromOutput(output: string): string[] {
    const failures: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('error TS')) {
        failures.push(line.trim());
      }
    }

    return failures;
  }

  /**
   * Count errors and warnings from lint output
   */
  private countErrorsAndWarnings(failures: string[]): { errorCount: number; warningCount: number } {
    let errorCount = 0;
    let warningCount = 0;

    for (const failure of failures) {
      if (failure.includes('Error:')) {
        errorCount++;
      } else if (failure.includes('Warning:')) {
        warningCount++;
      }
    }

    return { errorCount, warningCount };
  }

  /**
   * Save performance report to file
   */
  async saveReport(report: PerformanceImpactReport, filePath: string): Promise<void> {
    const reportJson = JSON.stringify(report, null, 2);
    await fs.writeFile(filePath, reportJson, 'utf8');
    logger.info('Performance report saved', { filePath });
  }

  /**
   * Generate summary for quick review
   */
  generateSummary(report: PerformanceImpactReport): string {
    const { impact, criticalIssues } = report;

    let summary = `Performance Impact Analysis Summary\n`;
    summary += `=====================================\n\n`;
    summary += `Overall Impact: ${impact.overallImpact.toUpperCase()}\n`;
    summary += `Severity: ${impact.severity.toUpperCase()}\n\n`;

    summary += `Performance Changes:\n`;
    summary += `- Build Time: ${impact.buildTimeChange > 0 ? '+' : ''}${impact.buildTimeChange.toFixed(2)}%\n`;
    summary += `- Lint Time: ${impact.lintTimeChange > 0 ? '+' : ''}${impact.lintTimeChange.toFixed(2)}%\n`;
    summary += `- TypeCheck Time: ${impact.typecheckTimeChange > 0 ? '+' : ''}${impact.typecheckTimeChange.toFixed(2)}%\n`;
    summary += `- Memory Usage: ${impact.memoryUsageChange > 0 ? '+' : ''}${impact.memoryUsageChange.toFixed(2)}%\n`;
    summary += `- Console Usage Reduction: ${impact.consoleUsageReduction}\n\n`;

    if (criticalIssues.length > 0) {
      summary += `Critical Issues (${criticalIssues.length}):\n`;
      for (const issue of criticalIssues) {
        summary += `- ${issue.type}: ${issue.description}\n`;
      }
      summary += `\n`;
    }

    summary += `Top Recommendations:\n`;
    for (const [index, rec] of report.recommendations.slice(0, 5).entries()) {
      summary += `${index + 1}. ${rec}\n`;
    }

    return summary;
  }
}

// Export for CLI usage
export default PerformanceImpactAnalyzer;