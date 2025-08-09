#!/usr/bin/env node
// scripts/governance/drift-detection.ts

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

interface BaselineSnapshot {
  timestamp: string;
  version: string;
  metrics: {
    totalEntities: number;
    duplicateCount: number;
    avgComplexity: number;
    circularDeps: number;
    unusedExports: number;
    codeSmells: number;
  };
  entityHashes: Map<string, string>;
  fileHashes: Map<string, string>;
}

interface DriftMetrics {
  newDuplicates: number;
  removedEntities: number;
  addedEntities: number;
  modifiedEntities: number;
  complexityIncrease: number;
  newCircularDeps: number;
  newUnusedExports: number;
  newCodeSmells: number;
  changedFiles: number;
}

interface DriftDetectionReport {
  timestamp: string;
  baselineVersion: string;
  currentSnapshot: BaselineSnapshot;
  baselineSnapshot: BaselineSnapshot;
  drift: DriftMetrics;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  detailedChanges: {
    newEntities: Array<{ name: string; file: string; type: string }>;
    removedEntities: Array<{ name: string; file: string; type: string }>;
    modifiedEntities: Array<{ name: string; file: string; type: string; changes: string[] }>;
    newDuplicateClusters: Array<{ hash: string; entities: string[]; severity: string }>;
  };
}

export class DriftDetection {
  private baselineDir = '.governance/baselines';
  private reportsDir = '.governance/drift-reports';
  private configFile = '.governance/drift-config.json';
  // private config: any;

  constructor() {
    // Ensure directories exist
    [this.baselineDir, this.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Load configuration
    this.loadConfig();
  }

  /**
   * Create a baseline snapshot
   */
  async createBaseline(version?: string): Promise<BaselineSnapshot> {
    console.log('=� Creating baseline snapshot...');

    // Run analysis to get current state
    const analysisResult = await this.runAnalysis();

    const snapshot: BaselineSnapshot = {
      timestamp: new Date().toISOString(),
      version: version || this.generateVersionFromGit(),
      metrics: {
        totalEntities: analysisResult.summary.totalEntities,
        duplicateCount: analysisResult.summary.duplicateClusters,
        avgComplexity: this.calculateAverageComplexity(analysisResult.entities),
        circularDeps: analysisResult.summary.circularDependencies,
        unusedExports: analysisResult.summary.unusedExports,
        codeSmells: analysisResult.summary.codeSmells
      },
      entityHashes: this.createEntityHashMap(analysisResult.entities),
      fileHashes: this.createFileHashMap()
    };

    // Save baseline
    const baselineFile = path.join(
      this.baselineDir,
      `baseline-${snapshot.version}.json`
    );

    // Convert Maps to objects for JSON serialization
    const serializedSnapshot = {
      ...snapshot,
      entityHashes: Object.fromEntries(snapshot.entityHashes),
      fileHashes: Object.fromEntries(snapshot.fileHashes)
    };

    fs.writeFileSync(baselineFile, JSON.stringify(serializedSnapshot, null, 2));
    
    // Also save as latest
    fs.writeFileSync(
      path.join(this.baselineDir, 'latest.json'),
      JSON.stringify(serializedSnapshot, null, 2)
    );

    console.log(` Baseline created: ${baselineFile}`);
    return snapshot;
  }

  /**
   * Detect drift against baseline
   */
  async detectDrift(baselineVersion = 'latest'): Promise<DriftDetectionReport> {
    console.log('= Detecting code drift...');

    // Load baseline
    const baseline = this.loadBaseline(baselineVersion);

    // Get current snapshot
    const current = await this.createCurrentSnapshot();

    // Calculate drift
    const drift = this.calculateDrift(baseline, current);

    // Generate detailed changes
    const detailedChanges = this.analyzeDetailedChanges(baseline, current);

    // Calculate severity
    const severity = this.calculateSeverity(drift);

    // Generate recommendations
    const recommendations = this.generateRecommendations(drift, severity);

    const report: DriftDetectionReport = {
      timestamp: new Date().toISOString(),
      baselineVersion: baseline.version,
      currentSnapshot: current,
      baselineSnapshot: baseline,
      drift,
      severity,
      recommendations,
      detailedChanges
    };

    // Save report
    await this.saveReport(report);

    return report;
  }

  /**
   * Run enhanced AST analysis
   */
  private async runAnalysis(): Promise<any> {
    try {
      // Run the enhanced AST analyzer
      execSync('npx ts-node scripts/analysis/enhanced-ast-analyzer.ts', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      // Load the generated report
      const reportPath = path.join('analysis-output', 'latest', 'analysis-report.json');
      if (!fs.existsSync(reportPath)) {
        throw new Error('Analysis report not found. Run enhanced-ast-analyzer.ts first.');
      }

      return JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    } catch (error: any) {
      console.error('Failed to run analysis:', error.message);
      throw error;
    }
  }

  /**
   * Create current snapshot without saving
   */
  private async createCurrentSnapshot(): Promise<BaselineSnapshot> {
    const analysisResult = await this.runAnalysis();

    return {
      timestamp: new Date().toISOString(),
      version: 'current',
      metrics: {
        totalEntities: analysisResult.summary.totalEntities,
        duplicateCount: analysisResult.summary.duplicateClusters,
        avgComplexity: this.calculateAverageComplexity(analysisResult.entities),
        circularDeps: analysisResult.summary.circularDependencies,
        unusedExports: analysisResult.summary.unusedExports,
        codeSmells: analysisResult.summary.codeSmells
      },
      entityHashes: this.createEntityHashMap(analysisResult.entities),
      fileHashes: this.createFileHashMap()
    };
  }

  /**
   * Load baseline snapshot
   */
  private loadBaseline(version: string): BaselineSnapshot {
    let baselineFile: string;

    if (version === 'latest') {
      baselineFile = path.join(this.baselineDir, 'latest.json');
    } else {
      baselineFile = path.join(this.baselineDir, `baseline-${version}.json`);
    }

    if (!fs.existsSync(baselineFile)) {
      throw new Error(`Baseline not found: ${baselineFile}. Create one with 'create-baseline' command.`);
    }

    const data = JSON.parse(fs.readFileSync(baselineFile, 'utf-8'));

    // Convert objects back to Maps
    return {
      ...data,
      entityHashes: new Map(Object.entries(data.entityHashes)),
      fileHashes: new Map(Object.entries(data.fileHashes))
    };
  }

  /**
   * Calculate drift metrics
   */
  private calculateDrift(baseline: BaselineSnapshot, current: BaselineSnapshot): DriftMetrics {
    // Entity changes
    let addedEntities = 0;
    let removedEntities = 0;
    let modifiedEntities = 0;

    // Count added entities
    for (const [key, hash] of current.entityHashes) {
      if (!baseline.entityHashes.has(key)) {
        addedEntities++;
      } else if (baseline.entityHashes.get(key) !== hash) {
        modifiedEntities++;
      }
    }

    // Count removed entities
    for (const [key] of baseline.entityHashes) {
      if (!current.entityHashes.has(key)) {
        removedEntities++;
      }
    }

    // File changes
    let changedFiles = 0;
    for (const [file, hash] of current.fileHashes) {
      if (!baseline.fileHashes.has(file) || baseline.fileHashes.get(file) !== hash) {
        changedFiles++;
      }
    }

    return {
      newDuplicates: Math.max(0, current.metrics.duplicateCount - baseline.metrics.duplicateCount),
      removedEntities,
      addedEntities,
      modifiedEntities,
      complexityIncrease: current.metrics.avgComplexity - baseline.metrics.avgComplexity,
      newCircularDeps: Math.max(0, current.metrics.circularDeps - baseline.metrics.circularDeps),
      newUnusedExports: Math.max(0, current.metrics.unusedExports - baseline.metrics.unusedExports),
      newCodeSmells: Math.max(0, current.metrics.codeSmells - baseline.metrics.codeSmells),
      changedFiles
    };
  }

  /**
   * Analyze detailed changes
   */
  private analyzeDetailedChanges(baseline: BaselineSnapshot, current: BaselineSnapshot): any {
    const newEntities: Array<{ name: string; file: string; type: string }> = [];
    const removedEntities: Array<{ name: string; file: string; type: string }> = [];
    const modifiedEntities: Array<{ name: string; file: string; type: string; changes: string[] }> = [];

    // Parse entity keys to get details
    for (const [key] of current.entityHashes) {
      if (!baseline.entityHashes.has(key)) {
        const [file, name, type] = key.split(':');
        newEntities.push({ name: name || '', file: file || '', type: type || '' });
      }
    }

    for (const [key] of baseline.entityHashes) {
      if (!current.entityHashes.has(key)) {
        const [file, name, type] = key.split(':');
        removedEntities.push({ name: name || '', file: file || '', type: type || '' });
      }
    }

    for (const [key, hash] of current.entityHashes) {
      const baselineHash = baseline.entityHashes.get(key);
      if (baselineHash && baselineHash !== hash) {
        const [file, name, type] = key.split(':');
        modifiedEntities.push({
          name: name || '',
          file: file || '',
          type: type || '',
          changes: ['content changed'] // Could be more detailed with proper diff
        });
      }
    }

    return {
      newEntities,
      removedEntities,
      modifiedEntities,
      newDuplicateClusters: [] // Would need to analyze current duplicates against baseline
    };
  }

  /**
   * Calculate severity level
   */
  private calculateSeverity(drift: DriftMetrics): DriftDetectionReport['severity'] {
    // Critical conditions
    if (
      drift.newDuplicates >= 5 ||
      drift.newCircularDeps > 0 ||
      drift.complexityIncrease > 10
    ) {
      return 'critical';
    }

    // High severity conditions
    if (
      drift.newDuplicates >= 3 ||
      drift.complexityIncrease > 5 ||
      drift.newCodeSmells >= 10
    ) {
      return 'high';
    }

    // Medium severity conditions
    if (
      drift.newDuplicates > 0 ||
      drift.complexityIncrease > 2 ||
      drift.newUnusedExports >= 10
    ) {
      return 'medium';
    }

    // Low severity conditions
    if (
      drift.newCodeSmells > 0 ||
      drift.newUnusedExports > 0 ||
      drift.modifiedEntities >= 10
    ) {
      return 'low';
    }

    return 'none';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(drift: DriftMetrics, severity: string): string[] {
    const recommendations: string[] = [];

    if (drift.newDuplicates > 0) {
      recommendations.push(
        `=4 Found ${drift.newDuplicates} new duplicate(s). Run consolidation workflow to merge duplicates.`
      );
    }

    if (drift.newCircularDeps > 0) {
      recommendations.push(
        `=4 Detected ${drift.newCircularDeps} new circular dependencies. These must be resolved immediately.`
      );
    }

    if (drift.complexityIncrease > 5) {
      recommendations.push(
        `� Average complexity increased by ${drift.complexityIncrease.toFixed(1)}. Consider refactoring complex functions.`
      );
    }

    if (drift.newUnusedExports >= 10) {
      recommendations.push(
        `=� Found ${drift.newUnusedExports} new unused exports. Schedule cleanup to remove dead code.`
      );
    }

    if (drift.newCodeSmells >= 5) {
      recommendations.push(
        `� Detected ${drift.newCodeSmells} new code smells. Review and refactor affected code.`
      );
    }

    if (drift.addedEntities > drift.removedEntities * 2) {
      recommendations.push(
        `=� Code base is growing rapidly (${drift.addedEntities} new entities). Consider architectural review.`
      );
    }

    // Severity-based recommendations
    switch (severity) {
      case 'critical':
        recommendations.push('=� CRITICAL: Block deployments until issues are resolved.');
        break;
      case 'high':
        recommendations.push('� HIGH: Schedule immediate tech debt sprint.');
        break;
      case 'medium':
        recommendations.push('=� MEDIUM: Include fixes in next sprint planning.');
        break;
      case 'low':
        recommendations.push(' LOW: Monitor trends and address in routine maintenance.');
        break;
      case 'none':
        recommendations.push(' No significant drift detected. Good job maintaining code quality!');
        break;
    }

    return recommendations;
  }

  /**
   * Save drift report
   */
  private async saveReport(report: DriftDetectionReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportFile = path.join(this.reportsDir, `drift-${timestamp}.json`);

    // Convert Maps to objects for JSON serialization
    const serializedReport = {
      ...report,
      currentSnapshot: {
        ...report.currentSnapshot,
        entityHashes: Object.fromEntries(report.currentSnapshot.entityHashes),
        fileHashes: Object.fromEntries(report.currentSnapshot.fileHashes)
      },
      baselineSnapshot: {
        ...report.baselineSnapshot,
        entityHashes: Object.fromEntries(report.baselineSnapshot.entityHashes),
        fileHashes: Object.fromEntries(report.baselineSnapshot.fileHashes)
      }
    };

    fs.writeFileSync(reportFile, JSON.stringify(serializedReport, null, 2));

    // Also save as latest
    fs.writeFileSync(
      path.join(this.reportsDir, 'latest.json'),
      JSON.stringify(serializedReport, null, 2)
    );

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    fs.writeFileSync(
      reportFile.replace('.json', '.md'),
      markdownReport
    );

    console.log(`=� Drift report saved: ${reportFile}`);
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(report: DriftDetectionReport): string {
    return `# Code Drift Detection Report

**Generated**: ${report.timestamp}
**Baseline**: ${report.baselineSnapshot.version} (${report.baselineSnapshot.timestamp})
**Severity**: ${report.severity.toUpperCase()}

## Summary

| Metric | Baseline | Current | Change |
|--------|----------|---------|--------|
| Total Entities | ${report.baselineSnapshot.metrics.totalEntities} | ${report.currentSnapshot.metrics.totalEntities} | ${report.drift.addedEntities - report.drift.removedEntities > 0 ? '+' : ''}${report.drift.addedEntities - report.drift.removedEntities} |
| Duplicates | ${report.baselineSnapshot.metrics.duplicateCount} | ${report.currentSnapshot.metrics.duplicateCount} | ${report.drift.newDuplicates > 0 ? '+' : ''}${report.drift.newDuplicates} |
| Avg Complexity | ${report.baselineSnapshot.metrics.avgComplexity.toFixed(1)} | ${report.currentSnapshot.metrics.avgComplexity.toFixed(1)} | ${report.drift.complexityIncrease > 0 ? '+' : ''}${report.drift.complexityIncrease.toFixed(1)} |
| Circular Deps | ${report.baselineSnapshot.metrics.circularDeps} | ${report.currentSnapshot.metrics.circularDeps} | ${report.drift.newCircularDeps > 0 ? '+' : ''}${report.drift.newCircularDeps} |
| Unused Exports | ${report.baselineSnapshot.metrics.unusedExports} | ${report.currentSnapshot.metrics.unusedExports} | ${report.drift.newUnusedExports > 0 ? '+' : ''}${report.drift.newUnusedExports} |

## Detailed Changes

### New Entities (${report.detailedChanges.newEntities.length})
${report.detailedChanges.newEntities.map(e => `- **${e.name}** (${e.type}) in ${e.file}`).join('\n')}

### Removed Entities (${report.detailedChanges.removedEntities.length})
${report.detailedChanges.removedEntities.map(e => `- **${e.name}** (${e.type}) from ${e.file}`).join('\n')}

### Modified Entities (${report.detailedChanges.modifiedEntities.length})
${report.detailedChanges.modifiedEntities.map(e => `- **${e.name}** (${e.type}) in ${e.file}: ${e.changes.join(', ')}`).join('\n')}

## Recommendations

${report.recommendations.map(r => `- ${r}`).join('\n')}

## Next Steps

Based on the severity level (**${report.severity}**):

${this.getNextStepsForSeverity(report.severity)}
`;
  }

  /**
   * Get next steps based on severity
   */
  private getNextStepsForSeverity(severity: string): string {
    const steps: Record<string, string> = {
      critical: `1. =� **BLOCK DEPLOYMENTS** - Do not deploy until issues are resolved
2. Schedule emergency team meeting to address critical issues
3. Run consolidation workflow for duplicates
4. Fix circular dependencies immediately
5. Re-run drift detection after fixes`,

      high: `1. � Schedule high-priority tech debt sprint
2. Run consolidation workflow for new duplicates
3. Review complexity increases and refactor
4. Address code smells in affected areas
5. Re-baseline after fixes`,

      medium: `1. =� Include drift fixes in next sprint planning
2. Schedule regular consolidation runs
3. Monitor complexity trends
4. Plan cleanup for unused exports`,

      low: `1.  Continue monitoring trends
2. Include minor fixes in routine maintenance
3. Consider setting up automated drift detection`,

      none: `1.  Great job maintaining code quality!
2. Consider creating a new baseline if this represents a stable state
3. Keep monitoring for future drift`
    };

    return steps[severity as keyof typeof steps] || steps.none || 'No specific steps available';
  }

  /**
   * Utility methods
   */

  private calculateAverageComplexity(entities: any[]): number {
    const complexities = entities
      .filter(e => typeof e.complexity === 'number')
      .map(e => e.complexity);

    if (complexities.length === 0) return 0;

    return complexities.reduce((sum, c) => sum + c, 0) / complexities.length;
  }

  private createEntityHashMap(entities: any[]): Map<string, string> {
    const map = new Map<string, string>();

    entities.forEach(entity => {
      const key = `${entity.file}:${entity.name}:${entity.type}`;
      const hash = entity.normalizedHash || entity.semanticHash || this.hashString(entity.signature || '');
      map.set(key, hash);
    });

    return map;
  }

  private createFileHashMap(): Map<string, string> {
    const map = new Map<string, string>();

    // Get all TypeScript files
    const files = this.getAllTsFiles('src');

    files.forEach(file => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        const hash = this.hashString(content);
        map.set(file, hash);
      }
    });

    return map;
  }

  private getAllTsFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      if (!fs.existsSync(dir)) return files;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...this.getAllTsFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}:`, error);
    }

    return files;
  }

  private hashString(str: string): string {
    return createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  private generateVersionFromGit(): string {
    try {
      const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).toString().trim();
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).toString().trim();
      return `${branch}-${hash}`;
    } catch (error) {
      return `manual-${Date.now().toString(36)}`;
    }
  }

  private loadConfig(): void {
    const defaultConfig = {
      severityThresholds: {
        critical: { duplicates: 5, circularDeps: 1, complexityIncrease: 10 },
        high: { duplicates: 3, complexityIncrease: 5, codeSmells: 10 },
        medium: { duplicates: 1, complexityIncrease: 2, unusedExports: 10 },
        low: { codeSmells: 1, unusedExports: 1, modifiedEntities: 10 }
      },
      autoBaseline: false,
      alertChannels: [],
      ignorePaths: ['node_modules', 'dist', 'build', '.git']
    };

    let config: any;
    if (fs.existsSync(this.configFile)) {
      const userConfig = JSON.parse(fs.readFileSync(this.configFile, 'utf-8'));
      config = { ...defaultConfig, ...userConfig };
    } else {
      config = defaultConfig;
      fs.writeFileSync(this.configFile, JSON.stringify(defaultConfig, null, 2));
    }
  }

  /**
   * List available baselines
   */
  listBaselines(): void {
    const files = fs.readdirSync(this.baselineDir)
      .filter(f => f.startsWith('baseline-') && f.endsWith('.json'))
      .sort();

    console.log('\n=� Available Baselines:');
    
    if (files.length === 0) {
      console.log('No baselines found. Create one with: drift-detection create-baseline');
      return;
    }

    files.forEach(file => {
      const baseline = JSON.parse(fs.readFileSync(path.join(this.baselineDir, file), 'utf-8'));
      console.log(`  ${baseline.version} - ${baseline.timestamp} (${baseline.metrics.totalEntities} entities)`);
    });
  }

  /**
   * Generate trend analysis
   */
  async generateTrendAnalysis(): Promise<void> {
    const reports = fs.readdirSync(this.reportsDir)
      .filter(f => f.startsWith('drift-') && f.endsWith('.json'))
      .sort()
      .slice(-10) // Last 10 reports
      .map(f => JSON.parse(fs.readFileSync(path.join(this.reportsDir, f), 'utf-8')));

    if (reports.length < 2) {
      console.log('Need at least 2 drift reports to generate trends.');
      return;
    }

    const trendData = reports.map(r => ({
      timestamp: r.timestamp,
      duplicates: r.currentSnapshot.metrics.duplicateCount,
      complexity: r.currentSnapshot.metrics.avgComplexity,
      entities: r.currentSnapshot.metrics.totalEntities,
      severity: r.severity
    }));

    const trendReport = `# Drift Trend Analysis

Generated: ${new Date().toISOString()}

## Metrics Over Time

${trendData.map(d => `- **${d.timestamp.split('T')[0]}**: ${d.entities} entities, ${d.duplicates} duplicates, ${d.complexity.toFixed(1)} avg complexity (${d.severity})`).join('\n')}

## Trends

- **Entity Growth**: ${this.calculateTrend(trendData.map(d => d.entities))}
- **Duplicate Trend**: ${this.calculateTrend(trendData.map(d => d.duplicates))}
- **Complexity Trend**: ${this.calculateTrend(trendData.map(d => d.complexity))}
`;

    fs.writeFileSync(path.join(this.reportsDir, 'trends.md'), trendReport);
    console.log('=� Trend analysis saved to drift-reports/trends.md');
  }

  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'No data';

    const first = values[0];
    const last = values[values.length - 1];
    if (!first || !last) return 'No data available';
    const change = ((last - first) / first * 100);

    if (Math.abs(change) < 5) return 'Stable';
    return change > 0 ? `Increasing (+${change.toFixed(1)}%)` : `Decreasing (${change.toFixed(1)}%)`;
  }
}

// CLI interface
if (require.main === module) {
  const driftDetection = new DriftDetection();
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'create-baseline':
      driftDetection.createBaseline(arg)
        .then(() => console.log(' Baseline created successfully'))
        .catch(error => {
          console.error('L Failed to create baseline:', error.message);
          process.exit(1);
        });
      break;

    case 'detect':
      driftDetection.detectDrift(arg)
        .then(report => {
          console.log(`\n=� Drift Detection Results:`);
          console.log(`Severity: ${report.severity.toUpperCase()}`);
          console.log('\nRecommendations:');
          report.recommendations.forEach(r => console.log(`  ${r}`));
        })
        .catch(error => {
          console.error('L Drift detection failed:', error.message);
          process.exit(1);
        });
      break;

    case 'list-baselines':
      driftDetection.listBaselines();
      break;

    case 'trends':
      driftDetection.generateTrendAnalysis()
        .catch(error => {
          console.error('L Failed to generate trends:', error.message);
          process.exit(1);
        });
      break;

    default:
      console.log(`
Usage: drift-detection.ts <command> [args]

Commands:
  create-baseline [version]  - Create a new baseline snapshot
  detect [baseline-version]  - Detect drift against baseline (default: latest)
  list-baselines            - List available baselines
  trends                    - Generate trend analysis from recent reports

Examples:
  npm run drift:baseline                    # Create baseline from current state
  npm run drift:detect                      # Detect drift against latest baseline
  npm run drift:detect v1.0.0              # Compare against specific baseline
  npm run drift:trends                      # Generate trend analysis
      `);
  }
}