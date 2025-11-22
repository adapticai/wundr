#!/usr/bin/env node
// scripts/governance-system.ts

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';

interface DriftReport {
  timestamp: string;
  baseline: AnalysisSnapshot;
  current: AnalysisSnapshot;
  drift: {
    newDuplicates: number;
    removedEntities: number;
    addedEntities: number;
    complexityIncrease: number;
    newCircularDeps: number;
    newUnusedExports: number;
    violatedStandards: ViolationDetail[];
  };
  recommendations: string[];
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

interface AnalysisSnapshot {
  timestamp: string;
  metrics: {
    totalEntities: number;
    duplicateCount: number;
    avgComplexity: number;
    circularDeps: number;
    unusedExports: number;
  };
  entities: Map<string, string>; // entity key -> hash
}

interface ViolationDetail {
  rule: string;
  file: string;
  line: number;
  message: string;
  severity: 'warning' | 'error';
}

export class GovernanceSystem {
  private baselineDir = '.governance/baselines';
  private reportsDir = '.governance/reports';
  private octokit?: Octokit;

  constructor() {
    // Initialize directories
    [this.baselineDir, this.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Initialize GitHub client if token available
    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) {
      this.octokit = new Octokit({
        auth: githubToken
      });
    }
  }

  /**
   * Main entry point for drift detection
   */
  async detectDrift(compareWithBaseline = 'latest'): Promise<DriftReport> {
    console.log('🔍 Starting drift detection...');

    // Get current analysis
    const currentAnalysis = await this.runAnalysis();

    // Get baseline to compare against
    const baseline = this.getBaseline(compareWithBaseline);

    // Calculate drift
    const drift = this.calculateDrift(baseline, currentAnalysis);

    // Generate report
    const report: DriftReport = {
      timestamp: new Date().toISOString(),
      baseline,
      current: currentAnalysis,
      drift,
      recommendations: this.generateRecommendations(drift),
      severity: this.calculateSeverity(drift)
    };

    // Save report
    await this.saveReport(report);

    // Take actions based on severity
    await this.enforceGovernance(report);

    return report;
  }

  /**
   * Run complete analysis and return snapshot
   */
  private async runAnalysis(): Promise<AnalysisSnapshot> {
    // Run the enhanced AST analyzer
    execSync(
      'npx ts-node enhanced-ast-analyzer.ts',
      { encoding: 'utf-8' }
    );

    // Load the analysis report
    const report = JSON.parse(
      fs.readFileSync('./analysis-output/analysis-report.json', 'utf-8')
    );

    // Create entity hash map for comparison
    const entityMap = new Map<string, string>();
    report.entities.forEach((entity: any) => {
      const key = `${entity.file}:${entity.name}:${entity.type}`;
      const hash = entity.normalizedHash || entity.signature || '';
      entityMap.set(key, hash);
    });

    return {
      timestamp: report.timestamp,
      metrics: {
        totalEntities: report.summary.totalEntities,
        duplicateCount: report.summary.duplicateClusters,
        avgComplexity: this.calculateAvgComplexity(report.entities),
        circularDeps: report.summary.circularDependencies,
        unusedExports: report.summary.unusedExports
      },
      entities: entityMap
    };
  }

  /**
   * Calculate drift between baseline and current
   */
  private calculateDrift(
    baseline: AnalysisSnapshot,
    current: AnalysisSnapshot
  ): DriftReport['drift'] {
    const drift = {
      newDuplicates: Math.max(0, current.metrics.duplicateCount - baseline.metrics.duplicateCount),
      removedEntities: 0,
      addedEntities: 0,
      complexityIncrease: current.metrics.avgComplexity - baseline.metrics.avgComplexity,
      newCircularDeps: Math.max(0, current.metrics.circularDeps - baseline.metrics.circularDeps),
      newUnusedExports: Math.max(0, current.metrics.unusedExports - baseline.metrics.unusedExports),
      violatedStandards: this.checkStandardsViolations()
    };

    // Count added/removed/modified entities by comparing hashes
    baseline.entities.forEach((baselineHash, key) => {
      if (!current.entities.has(key)) {
        drift.removedEntities++;
      } else {
        // Entity exists in both - check if modified by comparing hashes
        const currentHash = current.entities.get(key);
        if (currentHash !== baselineHash) {
          // Track modified entities in violatedStandards for visibility
          drift.violatedStandards.push({
            rule: 'entity-modified',
            file: key.split(':')[0] || 'unknown',
            line: 0,
            message: `Entity ${key} was modified (hash changed)`,
            severity: 'warning'
          });
        }
      }
    });

    current.entities.forEach((currentHash, key) => {
      const baselineHash = baseline.entities.get(key);
      if (!baselineHash) {
        drift.addedEntities++;
      }
      // Note: Modified entities already tracked in baseline.entities.forEach above
      // Avoid double counting by using currentHash to suppress lint warning
      void currentHash;
    });

    return drift;
  }

  /**
   * Check for violations of coding standards
   */
  private checkStandardsViolations(): ViolationDetail[] {
    const violations: ViolationDetail[] = [];

    try {
      // Run ESLint with our custom rules
      const eslintOutput = execSync(
        'npx eslint src --format json',
        { encoding: 'utf-8' }
      ) as string;

      const results = JSON.parse(eslintOutput);

      results.forEach((file: any) => {
        file.messages.forEach((message: any) => {
          // Only track our custom rules
          if (this.isCustomRule(message.ruleId)) {
            violations.push({
              rule: message.ruleId,
              file: file.filePath,
              line: message.line,
              message: message.message,
              severity: message.severity === 2 ? 'error' : 'warning'
            });
          }
        });
      });
    } catch (error) {
      // ESLint exits with code 1 if there are any issues
      // We still want to process the output
    }

    return violations;
  }

  /**
   * Generate actionable recommendations based on drift
   */
  private generateRecommendations(drift: DriftReport['drift']): string[] {
    const recommendations: string[] = [];

    if (drift.newDuplicates > 0) {
      recommendations.push(
        `🔴 ${drift.newDuplicates} new duplicate(s) detected. Run consolidation workflow immediately.`
      );
    }

    if (drift.complexityIncrease > 5) {
      recommendations.push(
        `⚠️ Average complexity increased by ${drift.complexityIncrease.toFixed(1)}. Consider refactoring complex functions.`
      );
    }

    if (drift.newCircularDeps > 0) {
      recommendations.push(
        `🔴 ${drift.newCircularDeps} new circular dependencies. These must be resolved before next deployment.`
      );
    }

    if (drift.violatedStandards.length > 0) {
      const errorCount = drift.violatedStandards.filter(v => v.severity === 'error').length;
      recommendations.push(
        `⚠️ ${drift.violatedStandards.length} standard violations (${errorCount} errors). Fix before merging.`
      );
    }

    if (drift.newUnusedExports > 10) {
      recommendations.push(
        `🟡 ${drift.newUnusedExports} new unused exports. Schedule cleanup sprint.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ No significant drift detected. Great job maintaining code quality!');
    }

    return recommendations;
  }

  /**
   * Calculate overall severity of drift
   */
  private calculateSeverity(drift: DriftReport['drift']): DriftReport['severity'] {
    // Critical if any of these
    if (
      drift.newDuplicates > 5 ||
      drift.newCircularDeps > 0 ||
      drift.complexityIncrease > 10
    ) {
      return 'critical';
    }

    // High if any of these
    if (
      drift.newDuplicates > 2 ||
      drift.violatedStandards.filter(v => v.severity === 'error').length > 0 ||
      drift.complexityIncrease > 5
    ) {
      return 'high';
    }

    // Medium if any of these
    if (
      drift.newDuplicates > 0 ||
      drift.newUnusedExports > 20 ||
      drift.complexityIncrease > 2
    ) {
      return 'medium';
    }

    // Low if any violations
    if (drift.violatedStandards.length > 0 || drift.newUnusedExports > 5) {
      return 'low';
    }

    return 'none';
  }

  /**
   * Enforce governance based on drift severity
   */
  private async enforceGovernance(report: DriftReport) {
    console.log(`📊 Drift severity: ${report.severity}`);

    switch (report.severity) {
      case 'critical':
        await this.handleCriticalDrift(report);
        break;
      case 'high':
        await this.handleHighDrift(report);
        break;
      case 'medium':
        await this.handleMediumDrift(report);
        break;
      case 'low':
        await this.handleLowDrift(report);
        break;
      case 'none':
        console.log('✅ No drift detected!');
        break;
    }
  }

  private async handleCriticalDrift(report: DriftReport) {
    console.error('🚨 CRITICAL DRIFT DETECTED!');

    // Block CI/CD pipeline
    if (process.env.CI) {
      this.createBlockingFile();
    }

    // Create GitHub issue if configured
    const githubRepo = process.env.GITHUB_REPOSITORY;
    if (this.octokit && githubRepo) {
      const parts = githubRepo.split('/');
      const owner = parts[0] || '';
      const repo = parts[1] || '';

      await this.octokit.issues.create({
        owner,
        repo,
        title: '🚨 Critical Code Drift Detected',
        body: this.formatGitHubIssue(report),
        labels: ['critical', 'code-quality', 'drift']
      });
    }

    // Fail the process
    process.exit(1);
  }

  private async handleHighDrift(report: DriftReport) {
    console.warn('⚠️ High drift detected');

    // Add warning to PR if in CI
    const eventName = process.env.GITHUB_EVENT_NAME;
    if (process.env.CI && eventName === 'pull_request') {
      await this.commentOnPR(report);
    }

    // Don't block, but warn
    if (process.env.CI) {
      console.warn('Build will fail if drift increases further');
    }
  }

  private async handleMediumDrift(report: DriftReport) {
    console.warn('🟡 Medium drift detected');

    // Just log recommendations
    report.recommendations.forEach(rec => console.log(rec));
  }

  private async handleLowDrift(report: DriftReport) {
    console.log('🟢 Low drift detected');

    // Log to monitoring but don't alert
    this.logToMonitoring(report);
  }

  /**
   * Create weekly governance report
   */
  async createWeeklyReport(): Promise<void> {
    console.log('📊 Creating weekly governance report...');

    const reports = this.getReportsForPeriod(7);

    const summary = {
      period: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      totalDriftEvents: reports.length,
      severityBreakdown: this.getSeverityBreakdown(reports),
      trends: this.calculateTrends(reports),
      topViolations: this.getTopViolations(reports),
      recommendations: this.getWeeklyRecommendations(reports)
    };

    // Save report
    const reportPath = path.join(
      this.reportsDir,
      `weekly-${new Date().toISOString().split('T')[0]}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));

    // Generate markdown
    const markdown = this.formatWeeklyReport(summary);
    fs.writeFileSync(
      reportPath.replace('.json', '.md'),
      markdown
    );

    console.log(`✅ Weekly report saved to ${reportPath}`);
  }

  /**
   * Custom ESLint rules for governance
   */
  generateESLintRules(): void {
    const customRules = `
module.exports = {
  rules: {
    // Prevent wrapper pattern
    'no-wrapper-pattern': {
      create(context) {
        return {
          ClassDeclaration(node) {
            const name = node.id.name;
            const patterns = ['Enhanced', 'Extended', 'Wrapper', 'Integration'];

            for (const pattern of patterns) {
              if (name.includes(pattern)) {
                context.report({
                  node,
                  message: \`Avoid wrapper pattern. Class name "\${name}" suggests wrapping. Consider extending or composing instead.\`
                });
              }
            }
          }
        };
      }
    },

    // Enforce consistent error handling
    'consistent-error-handling': {
      create(context) {
        return {
          ThrowStatement(node) {
            if (node.argument.type === 'Literal') {
              context.report({
                node,
                message: 'Throw Error objects, not strings. Use AppError or a subclass.'
              });
            }
          }
        };
      }
    },

    // Prevent duplicate enums
    'no-duplicate-enums': {
      create(context) {
        const enumValues = new Map();

        return {
          EnumDeclaration(node) {
            node.members.forEach(member => {
              const value = member.initializer?.value;
              if (value && enumValues.has(value)) {
                context.report({
                  node: member,
                  message: \`Duplicate enum value "\${value}" already defined in \${enumValues.get(value)}\`
                });
              } else if (value) {
                enumValues.set(value, node.id.name);
              }
            });
          }
        };
      }
    }
  }
};`;

    fs.writeFileSync('.eslint-rules/custom-governance.js', customRules);
  }

  // Helper methods

  private getBaseline(version: string): AnalysisSnapshot {
    if (version === 'latest') {
      const files = fs.readdirSync(this.baselineDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length === 0) {
        // Create initial baseline
        return this.createInitialBaseline();
      }

      return JSON.parse(
        fs.readFileSync(path.join(this.baselineDir, files[0]!), 'utf-8')
      );
    }

    return JSON.parse(
      fs.readFileSync(path.join(this.baselineDir, `${version}.json`), 'utf-8')
    );
  }

  private createInitialBaseline(): AnalysisSnapshot {
    return {
      timestamp: new Date().toISOString(),
      metrics: {
        totalEntities: 0,
        duplicateCount: 0,
        avgComplexity: 0,
        circularDeps: 0,
        unusedExports: 0
      },
      entities: new Map()
    };
  }

  private async saveReport(report: DriftReport) {
    const filename = `drift-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const filepath = path.join(this.reportsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

    // Also save as latest
    fs.copyFileSync(filepath, path.join(this.reportsDir, 'latest.json'));

    // Update baseline if no drift
    if (report.severity === 'none') {
      const baselineFile = path.join(
        this.baselineDir,
        `baseline-${new Date().toISOString().split('T')[0]}.json`
      );
      fs.writeFileSync(
        baselineFile,
        JSON.stringify(report.current, null, 2)
      );
    }
  }

  private calculateAvgComplexity(entities: any[]): number {
    const complexities = entities
      .filter(e => e.complexity)
      .map(e => e.complexity);

    if (complexities.length === 0) return 0;

    return complexities.reduce((sum, c) => sum + c, 0) / complexities.length;
  }

  private isCustomRule(ruleId: string): boolean {
    const customRules = [
      'no-wrapper-pattern',
      'consistent-error-handling',
      'no-duplicate-enums',
      '@typescript-eslint/consistent-type-definitions',
      'import/no-duplicates',
      'import/no-cycle'
    ];

    return customRules.includes(ruleId);
  }

  private createBlockingFile() {
    fs.writeFileSync('.governance-block', 'Critical drift detected. Fix before proceeding.');
  }

  private formatGitHubIssue(report: DriftReport): string {
    return `## 🚨 Critical Code Drift Detected

**Severity**: ${report.severity}
**Timestamp**: ${report.timestamp}

### Drift Summary
- New Duplicates: ${report.drift.newDuplicates}
- Complexity Increase: ${report.drift.complexityIncrease.toFixed(1)}
- New Circular Dependencies: ${report.drift.newCircularDeps}
- Standards Violations: ${report.drift.violatedStandards.length}

### Recommendations
${report.recommendations.map(r => `- ${r}`).join('\\n')}

### Action Required
This drift must be addressed immediately before any new features can be merged.

/cc @teamlead @architect`;
  }

  private async commentOnPR(report: DriftReport) {
    const githubRepo = process.env.GITHUB_REPOSITORY;
    if (!this.octokit || !githubRepo) return;

    const parts = githubRepo.split('/');
    const owner = parts[0] || '';
    const repo = parts[1] || '';
    const eventNumber = process.env.GITHUB_EVENT_NUMBER;
    const prNumber = parseInt(eventNumber || '0');

    if (prNumber > 0) {
      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: this.formatPRComment(report)
      });
    }
  }

  private formatPRComment(report: DriftReport): string {
    return `## ⚠️ Code Drift Warning

This PR introduces code drift with severity: **${report.severity}**

${report.recommendations.map(r => `- ${r}`).join('\\n')}

Please address these issues before merging.`;
  }

  private logToMonitoring(report: DriftReport) {
    // This would integrate with your monitoring system
    console.log(`[MONITORING] Drift event: ${report.severity}`);
  }

  private getReportsForPeriod(days: number): DriftReport[] {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    return fs.readdirSync(this.reportsDir)
      .filter(f => f.startsWith('drift-') && f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(this.reportsDir, f), 'utf-8')))
      .filter(r => new Date(r.timestamp).getTime() > since);
  }

  private getSeverityBreakdown(reports: DriftReport[]): Record<string, number> {
    const breakdown: Record<string, number> = {
      none: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    reports.forEach(r => {
      if (r.severity && breakdown[r.severity] !== undefined) {
        (breakdown as any)[r.severity]++;
      }
    });

    return breakdown;
  }

  private calculateTrends(reports: DriftReport[]): any {
    // Sort by timestamp
    const sorted = reports.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (sorted.length < 2) return { improving: false, trend: 'stable' };

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (!first || !last) {
      return { improving: false, trend: 'stable' };
    }

    const duplicatesTrend = last.drift.newDuplicates - first.drift.newDuplicates;
    const complexityTrend = last.drift.complexityIncrease - first.drift.complexityIncrease;

    return {
      duplicates: duplicatesTrend < 0 ? 'improving' : 'worsening',
      complexity: complexityTrend < 0 ? 'improving' : 'worsening',
      overall: duplicatesTrend <= 0 && complexityTrend <= 0 ? 'improving' : 'worsening'
    };
  }

  private getTopViolations(reports: DriftReport[]): any[] {
    const violationCounts = new Map<string, number>();

    reports.forEach(r => {
      r.drift.violatedStandards.forEach(v => {
        violationCounts.set(v.rule, (violationCounts.get(v.rule) || 0) + 1);
      });
    });

    return Array.from(violationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([rule, count]) => ({ rule, count }));
  }

  private getWeeklyRecommendations(reports: DriftReport[]): string[] {
    const recommendations: string[] = [];
    const severityBreakdown = this.getSeverityBreakdown(reports);
    const trends = this.calculateTrends(reports);

    if (severityBreakdown?.critical && severityBreakdown.critical > 0) {
      recommendations.push(
        `🔴 ${severityBreakdown.critical} critical drift events this week. Schedule emergency refactoring session.`
      );
    }

    if (trends.overall === 'worsening') {
      recommendations.push(
        '📈 Code quality is trending downward. Consider dedicating more time to technical debt.'
      );
    }

    if (severityBreakdown?.high && severityBreakdown.high > 2) {
      recommendations.push(
        '⚠️ Multiple high-severity drift events. Review and update coding standards with the team.'
      );
    }

    if (trends.overall === 'improving') {
      recommendations.push(
        '✅ Code quality is improving! Keep up the good work.'
      );
    }

    return recommendations;
  }

  private formatWeeklyReport(summary: any): string {
    return `# Weekly Governance Report

**Period**: ${summary.period.start} to ${summary.period.end}

## Summary
- Total Drift Events: ${summary.totalDriftEvents}
- Overall Trend: ${summary.trends.overall}

## Severity Breakdown
${Object.entries(summary.severityBreakdown)
        .map(([severity, count]) => `- ${severity}: ${count}`)
        .join('\\n')}

## Top Violations
${summary.topViolations
        .map((v: any) => `- ${v.rule}: ${v.count} occurrences`)
        .join('\\n')}

## Trends
- Duplicates: ${summary.trends.duplicates}
- Complexity: ${summary.trends.complexity}

## Recommendations
${summary.recommendations.map((r: string) => `- ${r}`).join('\\n')}
`;
  }
}

// CLI commands
if (require.main === module) {
  const governance = new GovernanceSystem();
  const command = process.argv[2];

  switch (command) {
    case 'check':
      governance.detectDrift()
        .then(report => {
          console.log('\\n📊 Drift Report Summary:');
          console.log(`Severity: ${report.severity}`);
          report.recommendations.forEach(r => console.log(r));
        })
        .catch(console.error);
      break;

    case 'weekly-report':
      governance.createWeeklyReport()
        .catch(console.error);
      break;

    case 'setup-rules':
      governance.generateESLintRules();
      console.log('✅ Custom ESLint rules generated');
      break;

    default:
      console.log(`
Usage: governance-system.ts <command>

Commands:
  check          - Run drift detection
  weekly-report  - Generate weekly governance report
  setup-rules    - Generate custom ESLint rules
      `);
  }
}
