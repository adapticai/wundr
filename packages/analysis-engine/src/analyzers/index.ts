/**
 * @fileoverview Code analyzers for static analysis
 */

import * as path from 'path';

import { glob } from 'glob';

import type { BaseEntity } from '@wundr.io/core-simple';

export interface AnalysisResult extends BaseEntity {
  filePath: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  line?: number;
  column?: number;
  rule?: string;
}

export interface AnalysisReport {
  timestamp: Date;
  projectPath: string;
  totalFiles: number;
  analyzedFiles: number;
  results: AnalysisResult[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    errorIssues: number;
    warningIssues: number;
    infoIssues: number;
    ruleViolations: Record<string, number>;
    filesCovered: number;
    analysisTime: number;
  };
  metrics: {
    codeComplexity: number;
    duplicateLines: number;
    unusedImports: number;
    circularDependencies: number;
    codeSmells: number;
    technicalDebt: {
      hours: number;
      priority: string;
    };
  };
}

export interface AnalyzerConfig {
  enabled: boolean;
  excludePatterns: string[];
  includePatterns: string[];
  rules: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export class CodeAnalyzer {
  constructor(_config?: Record<string, AnalyzerConfig>) {}

  async analyze(projectPath: string): Promise<AnalysisReport> {
    const startTime = Date.now();
    const filePaths = await this.getFileList(projectPath);
    const results: AnalysisResult[] = [];

    // Simple analysis implementation
    for (const filePath of filePaths.slice(0, 5)) { // Limit for demo
      if (filePath.includes('.test.') || filePath.includes('.spec.')) {
        results.push({
          id: `test-file-${Date.now()}`,
          filePath,
          type: 'test-file',
          message: 'Test file detected',
          severity: 'info',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    const endTime = Date.now();
    const analysisTime = endTime - startTime;

    return {
      timestamp: new Date(),
      projectPath,
      totalFiles: filePaths.length,
      analyzedFiles: Math.min(5, filePaths.length),
      results,
      summary: {
        totalIssues: results.length,
        criticalIssues: results.filter(r => r.severity === 'critical').length,
        errorIssues: results.filter(r => r.severity === 'error').length,
        warningIssues: results.filter(r => r.severity === 'warning').length,
        infoIssues: results.filter(r => r.severity === 'info').length,
        ruleViolations: {},
        filesCovered: new Set(results.map(r => r.filePath)).size,
        analysisTime,
      },
      metrics: {
        codeComplexity: 0,
        duplicateLines: 0,
        unusedImports: 0,
        circularDependencies: 0,
        codeSmells: 0,
        technicalDebt: {
          hours: 0,
          priority: 'low',
        },
      },
    };
  }

  private async getFileList(projectPath: string): Promise<string[]> {
    const patterns = [
      path.join(projectPath, '**/*.ts'),
      path.join(projectPath, '**/*.tsx'),
      path.join(projectPath, '**/*.js'),
      path.join(projectPath, '**/*.jsx'),
    ];

    const allFiles: string[] = [];
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
          ],
        });
        allFiles.push(...files);
      } catch (error) {
        console.warn('Error globbing pattern:', pattern, error);
      }
    }

    return [...new Set(allFiles)];
  }
}

export class AnalyzerFactory {
  static createStandardAnalyzer(): CodeAnalyzer {
    return new CodeAnalyzer();
  }
}

export const DEFAULT_ANALYZER_CONFIG: Record<string, AnalyzerConfig> = {
  typescript: {
    enabled: true,
    excludePatterns: ['node_modules/**', 'dist/**'],
    includePatterns: ['**/*.ts', '**/*.tsx'],
    rules: {},
    severity: 'warning',
  },
};