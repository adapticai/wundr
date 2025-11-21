/**
 * Simplified Analysis Engine - Working implementation for demonstration
 */

import * as path from 'path';

import * as fs from 'fs-extra';
import { glob } from 'glob';
import * as ts from 'typescript';

import { createId, generateNormalizedHash } from './utils';

import type {
  AnalysisConfig,
  AnalysisReport,
  EntityInfo,
  DuplicateCluster,
  ComplexityMetrics,
  AnalysisSummary,
  PerformanceMetrics,
} from './types';

/**
 * Simplified working analyzer
 */
export class SimpleAnalyzer {
  private config: AnalysisConfig;

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = {
      targetDir: process.cwd(),
      excludeDirs: ['node_modules', 'dist', 'build', 'coverage', '.git'],
      includePatterns: ['**/*.{ts,tsx,js,jsx}'],
      excludePatterns: ['**/*.{test,spec}.{ts,tsx,js,jsx}'],
      includeTests: false,
      enableAIAnalysis: false,
      outputFormats: ['json'],
      performance: {
        maxConcurrency: 10,
        chunkSize: 100,
        enableCaching: true,
      },
      thresholds: {
        complexity: { cyclomatic: 10, cognitive: 15 },
        duplicates: { minSimilarity: 0.8 },
        fileSize: { maxLines: 500 },
      },
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalysisConfig {
    return this.config;
  }

  async analyze(): Promise<AnalysisReport> {
    const startTime = Date.now();

    // Get files to analyze
    const files = await this.getFiles();
    console.log(`Found ${files.length} files to analyze`);

    // Extract entities
    const entities: EntityInfo[] = [];
    for (const file of files) {
      const fileEntities = await this.analyzeFile(file);
      entities.push(...fileEntities);
    }

    // Detect duplicates
    const duplicates = this.detectDuplicates(entities);

    // Calculate summary
    const summary: AnalysisSummary = {
      totalFiles: files.length,
      totalEntities: entities.length,
      duplicateClusters: duplicates.length,
      circularDependencies: 0,
      unusedExports: 0,
      codeSmells: 0,
      averageComplexity: this.calculateAverageComplexity(entities),
      maintainabilityIndex: 85,
      technicalDebt: {
        score: Math.max(0, 100 - duplicates.length * 10),
        estimatedHours: duplicates.length * 2,
      },
    };

    const duration = Date.now() - startTime;
    const performance: PerformanceMetrics = {
      analysisTime: duration,
      filesPerSecond: Math.round(files.length / (duration / 1000)),
      entitiesPerSecond: Math.round(entities.length / (duration / 1000)),
      memoryUsage: {
        peak: process.memoryUsage().heapUsed,
        average: process.memoryUsage().heapUsed,
      },
      cacheHits: 0,
      cacheSize: 0,
    };

    const report: AnalysisReport = {
      id: createId(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      targetDir: this.config.targetDir,
      config: this.config,
      summary,
      entities,
      duplicates,
      circularDependencies: [],
      unusedExports: [],
      codeSmells: [],
      recommendations: this.generateRecommendations(duplicates),
      performance,
    };

    return report;
  }

  private async getFiles(): Promise<string[]> {
    const pattern = path.join(this.config.targetDir, '**/*.{ts,tsx,js,jsx}');
    const files = await glob(pattern, {
      ignore: [
        ...this.config.excludeDirs.map(dir => `${dir}/**`),
        ...(this.config.includeTests ? [] : this.config.excludePatterns),
      ],
    });

    return files.filter(file => {
      // Additional filtering
      const stat = fs.statSync(file);
      return stat.size < 1024 * 1024; // Skip files > 1MB
    });
  }

  private async analyzeFile(filePath: string): Promise<EntityInfo[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.extractEntitiesFromContent(content, filePath);
    } catch (error) {
      console.warn(`Warning: Could not analyze file ${filePath}:`, error);
      return [];
    }
  }

  private extractEntitiesFromContent(
    content: string,
    filePath: string,
  ): EntityInfo[] {
    const entities: EntityInfo[] = [];

    try {
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.ES2020,
        true,
      );

      const visitNode = (node: ts.Node) => {
        // Extract classes
        if (ts.isClassDeclaration(node) && node.name) {
          const entity = this.createEntityFromNode(
            node,
            'class',
            filePath,
            sourceFile,
          );
          if (entity) {
entities.push(entity);
}
        }

        // Extract interfaces
        if (ts.isInterfaceDeclaration(node)) {
          const entity = this.createEntityFromNode(
            node,
            'interface',
            filePath,
            sourceFile,
          );
          if (entity) {
entities.push(entity);
}
        }

        // Extract functions
        if (ts.isFunctionDeclaration(node) && node.name) {
          const entity = this.createEntityFromNode(
            node,
            'function',
            filePath,
            sourceFile,
          );
          if (entity) {
entities.push(entity);
}
        }

        // Extract type aliases
        if (ts.isTypeAliasDeclaration(node)) {
          const entity = this.createEntityFromNode(
            node,
            'type',
            filePath,
            sourceFile,
          );
          if (entity) {
entities.push(entity);
}
        }

        ts.forEachChild(node, visitNode);
      };

      ts.forEachChild(sourceFile, visitNode);
    } catch (_error) {
      // Fallback to simple text-based extraction
      entities.push(...this.extractEntitiesFromText(content, filePath));
    }

    return entities;
  }

  private createEntityFromNode(
    node: ts.Node,
    type: string,
    filePath: string,
    sourceFile: ts.SourceFile,
  ): EntityInfo | null {
    const name = this.getNodeName(node);
    if (!name) {
return null;
}
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(),
    );

    const complexity = this.calculateComplexity(node, sourceFile);
    const signature = node.getText();

    return {
      id: createId(),
      name,
      type: type as any,
      file: filePath,
      startLine: line + 1,
      line: line + 1,
      column: character + 1,
      exportType: this.hasExportModifier(node) ? 'named' : 'none',
      signature,
      normalizedHash: generateNormalizedHash(signature),
      jsDoc: '',
      complexity,
      dependencies: [],
    };
  }

  private getNodeName(node: ts.Node): string | undefined {
    if (ts.isClassDeclaration(node) && node.name) {
      return node.name.text;
    }
    if (ts.isInterfaceDeclaration(node) && node.name) {
      return node.name.text;
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      return node.name.text;
    }
    if (ts.isTypeAliasDeclaration(node) && node.name) {
      return node.name.text;
    }
    return undefined;
  }

  private hasExportModifier(node: ts.Node): boolean {
    const modifiers = (node as any).modifiers;
    if (!modifiers) {
return false;
}

    return modifiers.some(
      (modifier: any) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
  }

  private calculateComplexity(
    node: ts.Node,
    sourceFile: ts.SourceFile,
  ): ComplexityMetrics {
    let cyclomatic = 1;
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const lines = end.line - start.line + 1;

    const visitComplexity = (child: ts.Node) => {
      switch (child.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.SwitchStatement:
          cyclomatic++;
          break;
      }
      ts.forEachChild(child, visitComplexity);
    };

    ts.forEachChild(node, visitComplexity);

    return {
      cyclomatic,
      cognitive: cyclomatic,
      maintainability: Math.max(0, 100 - cyclomatic * 5),
      depth: 1,
      parameters: 0,
      lines,
    };
  }

  private extractEntitiesFromText(
    content: string,
    filePath: string,
  ): EntityInfo[] {
    const entities: EntityInfo[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Simple pattern matching
      const classMatch = trimmed.match(
        /export\s+(class|interface|type)\s+(\w+)/,
      );
      if (classMatch) {
        entities.push({
          id: createId(),
          name: classMatch[2] || 'unknown',
          type: classMatch[1] as any,
          file: filePath,
          startLine: index + 1,
          line: index + 1,
          column: 1,
          exportType: 'named',
          signature: line,
          normalizedHash: generateNormalizedHash(classMatch[2]),
          jsDoc: '',
          complexity: {
            cyclomatic: 1,
            cognitive: 1,
            maintainability: 90,
            depth: 1,
            parameters: 0,
            lines: 1,
          },
          dependencies: [],
        });
      }
    });

    return entities;
  }

  private detectDuplicates(entities: EntityInfo[]): DuplicateCluster[] {
    const hashGroups = new Map<string, EntityInfo[]>();

    // Group by normalized hash
    entities.forEach(entity => {
      if (entity.normalizedHash) {
        if (!hashGroups.has(entity.normalizedHash)) {
          hashGroups.set(entity.normalizedHash, []);
        }
        hashGroups.get(entity.normalizedHash)!.push(entity);
      }
    });

    const duplicates: DuplicateCluster[] = [];

    // Find duplicates
    for (const [hash, duplicateEntities] of hashGroups.entries()) {
      if (duplicateEntities.length > 1 && duplicateEntities[0]) {
        duplicates.push({
          id: createId(),
          hash,
          type: duplicateEntities[0].type,
          severity: duplicateEntities.length > 3 ? 'high' : 'medium',
          entities: duplicateEntities,
          structuralMatch: true,
          semanticMatch: false,
          similarity: 1.0,
        });
      }
    }

    return duplicates;
  }

  private calculateAverageComplexity(entities: EntityInfo[]): number {
    if (entities.length === 0) {
return 0;
}

    const totalComplexity = entities.reduce(
      (sum, entity) => sum + (entity.complexity?.cyclomatic || 1),
      0,
    );

    return totalComplexity / entities.length;
  }

  private generateRecommendations(duplicates: DuplicateCluster[]): any[] {
    return duplicates.map(cluster => ({
      id: createId(),
      type: 'MERGE_DUPLICATES',
      priority: cluster.severity === 'high' ? 'high' : 'medium',
      title: `Merge ${cluster.entities.length} duplicate ${cluster.type}s`,
      description: `Found ${cluster.entities.length} duplicate ${cluster.type}s that could be consolidated`,
      impact: 'Reduces code duplication and maintenance burden',
      effort: 'medium',
      estimatedTimeHours: cluster.entities.length * 1.5,
    }));
  }
}

// Export convenience function
export async function analyzeProject(
  targetDir?: string,
): Promise<AnalysisReport> {
  const analyzer = new SimpleAnalyzer({
    targetDir: targetDir || process.cwd(),
  });
  return analyzer.analyze();
}
