/**
 * Drift Detection Service - Refactored to follow BaseService pattern
 */
import { BaseService, ServiceResult } from '../core/BaseService';
import { FileSystemError, AnalysisError } from '../core/errors';
import * as fs from 'fs-extra';
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

export class DriftDetectionService extends BaseService {
  private readonly baselineDir: string;
  private readonly reportsDir: string;

  constructor(projectRoot = process.cwd()) {
    super('DriftDetectionService', {
      outputDir: path.join(projectRoot, 'governance-output'),
    });
    
    this.baselineDir = path.join(this.config.outputDir!, 'baselines');
    this.reportsDir = path.join(this.config.outputDir!, 'drift-reports');
  }

  /**
   * Create a new baseline snapshot
   */
  async createBaseline(version?: string): Promise<ServiceResult<BaselineSnapshot>> {
    return this.executeOperation('createBaseline', async () => {
      this.log('info', 'Creating baseline snapshot...');

      const analysisResult = await this.runAnalysis();
      const snapshot = await this.createSnapshot(version || 'latest', analysisResult);

      // Save baseline
      const baselineFile = version === 'latest' 
        ? 'latest.json'
        : `baseline-${version}.json`;
      
      const baselinePath = path.join(this.baselineDir, baselineFile);
      
      // Convert Maps to objects for JSON serialization
      const serializable = {
        ...snapshot,
        entityHashes: Object.fromEntries(snapshot.entityHashes),
        fileHashes: Object.fromEntries(snapshot.fileHashes)
      };

      await fs.writeJson(baselinePath, serializable, { spaces: 2 });

      // Also save as latest if creating a versioned baseline
      if (version && version !== 'latest') {
        const latestPath = path.join(this.baselineDir, 'latest.json');
        await fs.writeJson(latestPath, serializable, { spaces: 2 });
      }

      this.log('info', `Baseline saved to ${baselinePath}`);
      return snapshot;
    });
  }

  /**
   * Detect drift against baseline
   */
  async detectDrift(baselineVersion = 'latest'): Promise<ServiceResult<DriftDetectionReport>> {
    return this.executeOperation('detectDrift', async () => {
      this.log('info', 'Detecting code drift...');

      // Load baseline
      const baseline = await this.loadBaseline(baselineVersion);

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
    });
  }

  /**
   * Check if drift exceeds thresholds
   */
  async checkDriftThresholds(thresholds?: {
    critical?: number;
    high?: number;
    medium?: number;
  }): Promise<ServiceResult<{
    passed: boolean;
    severity: string;
    report: DriftDetectionReport;
  }>> {
    return this.executeOperation('checkDriftThresholds', async () => {
      const result = await this.detectDrift();
      
      if (!result.success || !result.data) {
        throw new AnalysisError('Failed to detect drift');
      }

      const report = result.data;
      const defaultThresholds = {
        critical: 100,
        high: 50,
        medium: 20
      };

      const effectiveThresholds = { ...defaultThresholds, ...thresholds };
      
      const driftScore = this.calculateDriftScore(report.drift);
      let passed = true;
      let severity = 'none';

      if (driftScore >= effectiveThresholds.critical) {
        passed = false;
        severity = 'critical';
      } else if (driftScore >= effectiveThresholds.high) {
        passed = false;
        severity = 'high';
      } else if (driftScore >= effectiveThresholds.medium) {
        severity = 'medium';
      }

      if (!passed) {
        this.log('error', `Drift threshold exceeded: ${severity} (score: ${driftScore})`);
      }

      return { passed, severity, report };
    });
  }

  private async runAnalysis(): Promise<any> {
    try {
      // Run the enhanced AST analyzer
      execSync('npx ts-node scripts/analysis/enhanced-ast-analyzer.ts', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      // Load the generated report
      const reportPath = path.join('analysis-output', 'latest', 'analysis-report.json');
      if (!await fs.pathExists(reportPath)) {
        throw new FileSystemError('read', reportPath);
      }

      return await fs.readJson(reportPath);
    } catch (error: any) {
      throw new AnalysisError('Failed to run analysis', error.message);
    }
  }

  private async createSnapshot(version: string, analysisResult: any): Promise<BaselineSnapshot> {
    return {
      timestamp: new Date().toISOString(),
      version,
      metrics: {
        totalEntities: analysisResult.summary.totalEntities,
        duplicateCount: analysisResult.summary.duplicateClusters,
        avgComplexity: this.calculateAverageComplexity(analysisResult.entities),
        circularDeps: analysisResult.summary.circularDependencies,
        unusedExports: analysisResult.summary.unusedExports,
        codeSmells: analysisResult.summary.codeSmells
      },
      entityHashes: this.createEntityHashMap(analysisResult.entities),
      fileHashes: await this.createFileHashMap()
    };
  }

  private async createCurrentSnapshot(): Promise<BaselineSnapshot> {
    const analysisResult = await this.runAnalysis();
    return this.createSnapshot('current', analysisResult);
  }

  private async loadBaseline(version: string): Promise<BaselineSnapshot> {
    const baselineFile = version === 'latest'
      ? 'latest.json'
      : `baseline-${version}.json`;
    
    const baselinePath = path.join(this.baselineDir, baselineFile);

    if (!await fs.pathExists(baselinePath)) {
      throw new FileSystemError('read', baselinePath);
    }

    const data = await fs.readJson(baselinePath);

    // Convert objects back to Maps
    return {
      ...data,
      entityHashes: new Map(Object.entries(data.entityHashes)),
      fileHashes: new Map(Object.entries(data.fileHashes))
    };
  }

  private calculateDrift(baseline: BaselineSnapshot, current: BaselineSnapshot): DriftMetrics {
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
    for (const key of baseline.entityHashes.keys()) {
      if (!current.entityHashes.has(key)) {
        removedEntities++;
      }
    }

    // Count changed files
    let changedFiles = 0;
    for (const [file, hash] of current.fileHashes) {
      if (baseline.fileHashes.get(file) !== hash) {
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

  private calculateSeverity(drift: DriftMetrics): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const score = this.calculateDriftScore(drift);

    if (score === 0) return 'none';
    if (score < 10) return 'low';
    if (score < 50) return 'medium';
    if (score < 100) return 'high';
    return 'critical';
  }

  private calculateDriftScore(drift: DriftMetrics): number {
    return (
      drift.newDuplicates * 5 +
      drift.newCircularDeps * 10 +
      drift.newCodeSmells * 3 +
      drift.complexityIncrease * 2 +
      drift.newUnusedExports * 1
    );
  }

  private generateRecommendations(drift: DriftMetrics, severity: string): string[] {
    const recommendations: string[] = [];

    if (drift.newDuplicates > 0) {
      recommendations.push(`Run consolidation to eliminate ${drift.newDuplicates} new duplicate clusters`);
    }

    if (drift.newCircularDeps > 0) {
      recommendations.push(`Refactor to remove ${drift.newCircularDeps} new circular dependencies`);
    }

    if (drift.complexityIncrease > 5) {
      recommendations.push('Consider breaking down complex functions');
    }

    if (drift.newCodeSmells > 10) {
      recommendations.push('Address code smells through targeted refactoring');
    }

    if (severity === 'critical') {
      recommendations.push('CRITICAL: Immediate action required to prevent further degradation');
    }

    return recommendations;
  }

  private analyzeDetailedChanges(_baseline: BaselineSnapshot, _current: BaselineSnapshot): any {
    // Simplified implementation - would need access to entity details
    return {
      newEntities: [],
      removedEntities: [],
      modifiedEntities: [],
      newDuplicateClusters: []
    };
  }

  private createEntityHashMap(entities: any[]): Map<string, string> {
    const map = new Map<string, string>();
    
    for (const entity of entities) {
      const key = `${entity.type}:${entity.name}:${entity.file}`;
      const hash = createHash('md5')
        .update(JSON.stringify(entity))
        .digest('hex');
      map.set(key, hash);
    }

    return map;
  }

  private async createFileHashMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const files = await this.getTypeScriptFiles();

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const hash = createHash('md5').update(content).digest('hex');
        map.set(file, hash);
      } catch (error) {
        this.log('warn', `Failed to hash file ${file}`);
      }
    }

    return map;
  }

  private async getTypeScriptFiles(): Promise<string[]> {
    // Simplified - would use glob in real implementation
    return [];
  }

  private calculateAverageComplexity(entities: any[]): number {
    if (entities.length === 0) return 0;
    
    const totalComplexity = entities.reduce(
      (sum, entity) => sum + (entity.complexity || 0), 
      0
    );
    
    return totalComplexity / entities.length;
  }

  private async saveReport(report: DriftDetectionReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `drift-report-${timestamp}.json`;
    
    await this.saveOutput(filename, JSON.stringify(report, null, 2));
    
    // Also save as latest
    await this.saveOutput('latest-drift-report.json', JSON.stringify(report, null, 2));
  }

  protected async onInitialize(): Promise<void> {
    await fs.ensureDir(this.baselineDir);
    await fs.ensureDir(this.reportsDir);
  }

  protected async onShutdown(): Promise<void> {
    // Cleanup if needed
  }

  protected checkHealth(): boolean {
    return fs.existsSync(this.baselineDir) && fs.existsSync(this.reportsDir);
  }
}