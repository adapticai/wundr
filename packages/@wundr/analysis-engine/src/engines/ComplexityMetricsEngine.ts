/**
 * Complexity Metrics Engine - Advanced code complexity analysis
 * Calculates cyclomatic, cognitive, maintainability, and other metrics
 */

import * as ts from 'typescript';

import { createId } from '../utils';

import type {
  EntityInfo,
  ComplexityMetrics,
  BaseAnalyzer,
  AnalysisConfig,
} from '../types';

interface ComplexityThresholds {
  cyclomatic: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  cognitive: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  maintainability: {
    excellent: number;
    good: number;
    moderate: number;
    poor: number;
  };
  nesting: {
    maxDepth: number;
    warningDepth: number;
  };
  size: {
    maxLines: number;
    maxParameters: number;
  };
}

interface ComplexityReport {
  entityComplexities: Map<string, ComplexityMetrics>;
  fileComplexities: Map<string, FileComplexityMetrics>;
  overallMetrics: OverallComplexityMetrics;
  complexityHotspots: ComplexityHotspot[];
  recommendations: ComplexityRecommendation[];
}

interface FileComplexityMetrics {
  filePath: string;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  averageComplexity: number;
  maxComplexity: number;
  entityCount: number;
  maintainabilityIndex: number;
  technicalDebt: number;
}

interface OverallComplexityMetrics {
  averageCyclomaticComplexity: number;
  averageCognitiveComplexity: number;
  averageMaintainabilityIndex: number;
  totalTechnicalDebt: number;
  complexityDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

interface ComplexityHotspot {
  id: string;
  entity: EntityInfo;
  complexity: ComplexityMetrics;
  rank: number;
  issues: string[];
  recommendations: string[];
}

interface ComplexityRecommendation {
  id: string;
  type:
    | 'reduce-complexity'
    | 'extract-method'
    | 'split-class'
    | 'simplify-conditions';
  priority: 'critical' | 'high' | 'medium' | 'low';
  entity: EntityInfo;
  description: string;
  impact: string;
  effort: string;
  steps: string[];
}

/**
 * Advanced complexity metrics engine with multiple calculation methods
 */
export class ComplexityMetricsEngine implements BaseAnalyzer<ComplexityReport> {
  public readonly name = 'ComplexityMetricsEngine';
  public readonly version = '2.0.0';

  private thresholds: ComplexityThresholds;

  constructor(thresholds?: Partial<ComplexityThresholds>) {
    this.thresholds = {
      cyclomatic: {
        low: 5,
        medium: 10,
        high: 20,
        critical: 30,
      },
      cognitive: {
        low: 7,
        medium: 15,
        high: 25,
        critical: 40,
      },
      maintainability: {
        excellent: 85,
        good: 70,
        moderate: 50,
        poor: 25,
      },
      nesting: {
        maxDepth: 4,
        warningDepth: 3,
      },
      size: {
        maxLines: 100,
        maxParameters: 5,
      },
      ...thresholds,
    };
  }

  /**
   * Analyze complexity metrics for all entities
   */
  async analyze(
    entities: EntityInfo[],
    _config: AnalysisConfig
  ): Promise<ComplexityReport> {
    const entityComplexities = new Map<string, ComplexityMetrics>();
    const fileComplexities = new Map<string, FileComplexityMetrics>();

    // Calculate complexity for each entity
    for (const entity of entities) {
      const complexity = await this.calculateEntityComplexity(entity);
      entityComplexities.set(entity.id, complexity);

      // Update file complexity
      this.updateFileComplexity(entity, complexity, fileComplexities);
    }

    // Calculate overall metrics
    const overallMetrics = this.calculateOverallMetrics(entityComplexities);

    // Identify complexity hotspots
    const complexityHotspots = this.identifyComplexityHotspots(
      entities,
      entityComplexities
    );

    // Generate recommendations
    const recommendations = this.generateComplexityRecommendations(
      entities,
      entityComplexities
    );

    return {
      entityComplexities,
      fileComplexities,
      overallMetrics,
      complexityHotspots,
      recommendations,
    };
  }

  /**
   * Calculate comprehensive complexity metrics for an entity
   */
  private async calculateEntityComplexity(
    entity: EntityInfo
  ): Promise<ComplexityMetrics> {
    // If complexity is already calculated, enhance it
    let baseComplexity = entity.complexity || {
      cyclomatic: 1,
      cognitive: 0,
      maintainability: 100,
      depth: 0,
      parameters: 0,
      lines: 0,
    };

    // Enhance with additional calculations if we have signature data
    if (entity.signature) {
      const enhancedComplexity = this.calculateComplexityFromSignature(
        entity.signature,
        entity.type
      );
      baseComplexity = this.mergeComplexityMetrics(
        baseComplexity,
        enhancedComplexity
      );
    }

    // Calculate maintainability index
    baseComplexity.maintainability =
      this.calculateMaintainabilityIndex(baseComplexity);

    return baseComplexity;
  }

  /**
   * Calculate complexity from source code signature
   * Entity type is used to apply type-specific complexity adjustments
   */
  private calculateComplexityFromSignature(
    signature: string,
    entityType: string
  ): Partial<ComplexityMetrics> {
    const lines = signature.split('\n');
    const codeLines = lines.filter(
      line =>
        line.trim() &&
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('*')
    );

    // Parse the code to AST for accurate analysis
    try {
      const sourceFile = ts.createSourceFile(
        'temp.ts',
        signature,
        ts.ScriptTarget.ES2020,
        true
      );

      const baseComplexity = this.analyzeNodeComplexity(sourceFile);

      // Apply entity-type-specific complexity adjustments
      return this.applyEntityTypeAdjustments(
        baseComplexity,
        entityType,
        codeLines.length
      );
    } catch {
      // Fallback to text-based analysis
      return this.calculateTextBasedComplexity(signature);
    }
  }

  /**
   * Apply complexity adjustments based on entity type
   * Different entity types have different baseline complexity expectations
   */
  private applyEntityTypeAdjustments(
    metrics: ComplexityMetrics,
    entityType: string,
    codeLineCount: number
  ): ComplexityMetrics {
    const adjustedMetrics = { ...metrics };

    // Classes inherently have higher complexity expectations
    if (entityType === 'class') {
      // Classes managing state have higher cognitive overhead
      adjustedMetrics.cognitive = Math.max(
        adjustedMetrics.cognitive,
        Math.floor(codeLineCount / 20)
      );
    }

    // Constructors often have initialization complexity
    if (entityType === 'constructor') {
      // Reduce cognitive penalty for initialization code
      adjustedMetrics.cognitive = Math.max(1, adjustedMetrics.cognitive - 1);
    }

    // Getters/setters should have minimal complexity
    if (entityType === 'getter' || entityType === 'setter') {
      // Flag if complexity exceeds expected minimal threshold
      if (adjustedMetrics.cyclomatic > 2) {
        adjustedMetrics.cognitive += 2; // Penalty for complex accessors
      }
    }

    // Factory functions may have higher acceptable complexity
    if (entityType === 'function' && codeLineCount > 50) {
      // Large standalone functions need extra scrutiny
      adjustedMetrics.cognitive += Math.floor(codeLineCount / 50);
    }

    return adjustedMetrics;
  }

  /**
   * Analyze complexity using TypeScript AST
   */
  private analyzeNodeComplexity(node: ts.Node): ComplexityMetrics {
    let cyclomatic = 1;
    let cognitive = 0;
    let maxDepth = 0;
    let parameters = 0;

    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const lines = end.line - start.line + 1;

    // Extract parameters for functions/methods
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node)
    ) {
      parameters =
        (
          node as
            | ts.FunctionDeclaration
            | ts.MethodDeclaration
            | ts.ArrowFunction
        ).parameters?.length || 0;
    }

    const visit = (child: ts.Node, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);

      // Cyclomatic complexity contributors
      switch (child.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.DefaultClause:
        case ts.SyntaxKind.CatchClause:
          cyclomatic++;
          cognitive += this.calculateCognitiveIncrement(child, depth);
          break;

        case ts.SyntaxKind.BinaryExpression: {
          const binExpr = child as ts.BinaryExpression;
          if (this.isLogicalOperator(binExpr.operatorToken.kind)) {
            cyclomatic++;
            cognitive += this.calculateCognitiveIncrement(child, depth);
          }
          break;
        }
      }

      // Recursively visit children with updated depth
      const newDepth = this.isNestingNode(child) ? depth + 1 : depth;
      ts.forEachChild(child, grandChild => visit(grandChild, newDepth));
    };

    ts.forEachChild(node, child => visit(child, 0));

    const maintainability = this.calculateMaintainabilityIndex({
      cyclomatic,
      cognitive,
      lines,
      parameters,
      depth: maxDepth,
      maintainability: 0, // Will be calculated
    });

    return {
      cyclomatic,
      cognitive,
      maintainability,
      depth: maxDepth,
      parameters,
      lines,
    };
  }

  /**
   * Calculate cognitive complexity increment based on nesting
   */
  private calculateCognitiveIncrement(node: ts.Node, depth: number): number {
    // Base increment
    let increment = 1;

    // Nesting penalty
    if (depth > 0) {
      increment += depth;
    }

    // Specific node penalties
    switch (node.kind) {
      case ts.SyntaxKind.SwitchStatement:
        increment += 1; // Switch statements are inherently complex
        break;
      case ts.SyntaxKind.ConditionalExpression:
        increment += 1; // Ternary operators add cognitive load
        break;
    }

    return increment;
  }

  /**
   * Check if operator is logical (contributes to complexity)
   */
  private isLogicalOperator(kind: ts.SyntaxKind): boolean {
    return (
      kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      kind === ts.SyntaxKind.BarBarToken ||
      kind === ts.SyntaxKind.QuestionQuestionToken
    );
  }

  /**
   * Check if node creates nesting
   */
  private isNestingNode(node: ts.Node): boolean {
    return [
      ts.SyntaxKind.IfStatement,
      ts.SyntaxKind.WhileStatement,
      ts.SyntaxKind.ForStatement,
      ts.SyntaxKind.ForInStatement,
      ts.SyntaxKind.ForOfStatement,
      ts.SyntaxKind.WhileStatement,
      ts.SyntaxKind.TryStatement,
      ts.SyntaxKind.SwitchStatement,
      ts.SyntaxKind.Block,
    ].includes(node.kind);
  }

  /**
   * Fallback text-based complexity calculation
   */
  private calculateTextBasedComplexity(
    code: string
  ): Partial<ComplexityMetrics> {
    const lines = code.split('\n').filter(line => line.trim());

    // Count complexity indicators
    const ifCount = (code.match(/\b(if|else if)\b/g) || []).length;
    const loopCount = (code.match(/\b(for|while|do)\b/g) || []).length;
    const switchCount = (code.match(/\bswitch\b/g) || []).length;
    const catchCount = (code.match(/\bcatch\b/g) || []).length;
    const ternaryCount = (code.match(/\?.*:/g) || []).length;
    const logicalCount = (code.match(/&&|\|\|/g) || []).length;

    const cyclomatic =
      1 +
      ifCount +
      loopCount +
      switchCount +
      catchCount +
      ternaryCount +
      logicalCount;

    // Estimate cognitive complexity (simplified)
    const nestingPenalty = (code.match(/\{[^}]*\{/g) || []).length;
    const cognitive = cyclomatic + nestingPenalty;

    // Estimate parameters
    const paramMatch = code.match(/\(([^)]*)\)/);
    const parameters = paramMatch
      ? paramMatch[1].split(',').filter(p => p.trim()).length
      : 0;

    return {
      cyclomatic,
      cognitive,
      parameters,
      lines: lines.length,
    };
  }

  /**
   * Calculate maintainability index
   * Based on Halstead complexity metrics and cyclomatic complexity
   */
  private calculateMaintainabilityIndex(metrics: ComplexityMetrics): number {
    const { cyclomatic, lines, parameters } = metrics;

    // Simplified maintainability index calculation
    // MI = 171 - 5.2 * ln(HalsteadVolume) - 0.23 * CyclomaticComplexity - 16.2 * ln(LinesOfCode)

    // Estimate Halstead volume based on lines and parameters
    const estimatedVolume = Math.max(1, lines * Math.log2(parameters + 1));

    const mi = Math.max(
      0,
      Math.min(
        100,
        171 -
          5.2 * Math.log(estimatedVolume) -
          0.23 * cyclomatic -
          16.2 * Math.log(lines || 1)
      )
    );

    return Math.round(mi * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Merge complexity metrics
   */
  private mergeComplexityMetrics(
    base: ComplexityMetrics,
    enhancement: Partial<ComplexityMetrics>
  ): ComplexityMetrics {
    return {
      cyclomatic: enhancement.cyclomatic || base.cyclomatic,
      cognitive: enhancement.cognitive || base.cognitive,
      maintainability: enhancement.maintainability ?? base.maintainability ?? 0,
      depth: Math.max(base.depth, enhancement.depth || 0),
      parameters: enhancement.parameters ?? base.parameters ?? 0,
      lines: enhancement.lines ?? base.lines ?? 0,
    };
  }

  /**
   * Update file complexity metrics
   */
  private updateFileComplexity(
    entity: EntityInfo,
    complexity: ComplexityMetrics,
    fileComplexities: Map<string, FileComplexityMetrics>
  ): void {
    if (!fileComplexities.has(entity.file)) {
      fileComplexities.set(entity.file, {
        filePath: entity.file,
        totalLines: 0,
        codeLines: 0,
        commentLines: 0,
        averageComplexity: 0,
        maxComplexity: 0,
        entityCount: 0,
        maintainabilityIndex: 100,
        technicalDebt: 0,
      });
    }

    const fileMetrics = fileComplexities.get(entity.file)!;

    fileMetrics.entityCount++;
    fileMetrics.totalLines += complexity.lines;
    fileMetrics.codeLines += complexity.lines; // Simplified
    fileMetrics.maxComplexity = Math.max(
      fileMetrics.maxComplexity,
      complexity.cyclomatic
    );

    // Update average complexity
    fileMetrics.averageComplexity =
      (fileMetrics.averageComplexity * (fileMetrics.entityCount - 1) +
        complexity.cyclomatic) /
      fileMetrics.entityCount;

    // Update maintainability index (average)
    fileMetrics.maintainabilityIndex =
      (fileMetrics.maintainabilityIndex * (fileMetrics.entityCount - 1) +
        complexity.maintainability) /
      fileMetrics.entityCount;

    // Calculate technical debt based on complexity thresholds
    fileMetrics.technicalDebt += this.calculateTechnicalDebt(complexity);
  }

  /**
   * Calculate technical debt for a complexity metric
   */
  private calculateTechnicalDebt(complexity: ComplexityMetrics): number {
    let debt = 0;

    // Cyclomatic complexity debt
    if (complexity.cyclomatic > this.thresholds.cyclomatic.critical) {
      debt += 8; // hours
    } else if (complexity.cyclomatic > this.thresholds.cyclomatic.high) {
      debt += 4;
    } else if (complexity.cyclomatic > this.thresholds.cyclomatic.medium) {
      debt += 1;
    }

    // Cognitive complexity debt
    if (complexity.cognitive > this.thresholds.cognitive.critical) {
      debt += 6;
    } else if (complexity.cognitive > this.thresholds.cognitive.high) {
      debt += 3;
    } else if (complexity.cognitive > this.thresholds.cognitive.medium) {
      debt += 0.5;
    }

    // Maintainability debt
    if (complexity.maintainability < this.thresholds.maintainability.poor) {
      debt += 10;
    } else if (
      complexity.maintainability < this.thresholds.maintainability.moderate
    ) {
      debt += 4;
    } else if (
      complexity.maintainability < this.thresholds.maintainability.good
    ) {
      debt += 1;
    }

    return debt;
  }

  /**
   * Calculate overall complexity metrics
   */
  private calculateOverallMetrics(
    entityComplexities: Map<string, ComplexityMetrics>
  ): OverallComplexityMetrics {
    const complexities = Array.from(entityComplexities.values());

    const avgCyclomatic =
      complexities.reduce((sum, c) => sum + c.cyclomatic, 0) /
      complexities.length;
    const avgCognitive =
      complexities.reduce((sum, c) => sum + c.cognitive, 0) /
      complexities.length;
    const avgMaintainability =
      complexities.reduce((sum, c) => sum + c.maintainability, 0) /
      complexities.length;
    const totalDebt = complexities.reduce(
      (sum, c) => sum + this.calculateTechnicalDebt(c),
      0
    );

    // Calculate distribution
    const distribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    complexities.forEach(complexity => {
      if (complexity.cyclomatic <= this.thresholds.cyclomatic.low) {
        distribution.low++;
      } else if (complexity.cyclomatic <= this.thresholds.cyclomatic.medium) {
        distribution.medium++;
      } else if (complexity.cyclomatic <= this.thresholds.cyclomatic.high) {
        distribution.high++;
      } else {
        distribution.critical++;
      }
    });

    return {
      averageCyclomaticComplexity: Math.round(avgCyclomatic * 100) / 100,
      averageCognitiveComplexity: Math.round(avgCognitive * 100) / 100,
      averageMaintainabilityIndex: Math.round(avgMaintainability * 100) / 100,
      totalTechnicalDebt: Math.round(totalDebt * 100) / 100,
      complexityDistribution: distribution,
    };
  }

  /**
   * Identify complexity hotspots
   */
  private identifyComplexityHotspots(
    entities: EntityInfo[],
    complexities: Map<string, ComplexityMetrics>
  ): ComplexityHotspot[] {
    const hotspots: ComplexityHotspot[] = [];

    entities.forEach(entity => {
      const complexity = complexities.get(entity.id)!;

      // Calculate hotspot score
      const score = this.calculateHotspotScore(complexity);

      if (score > 50) {
        // Threshold for hotspot
        const issues = this.identifyComplexityIssues(complexity);
        const recommendations = this.generateHotspotRecommendations(
          entity,
          complexity
        );

        hotspots.push({
          id: createId(),
          entity,
          complexity,
          rank: score,
          issues,
          recommendations,
        });
      }
    });

    // Sort by rank (highest first)
    return hotspots.sort((a, b) => b.rank - a.rank);
  }

  /**
   * Calculate hotspot score
   */
  private calculateHotspotScore(complexity: ComplexityMetrics): number {
    let score = 0;

    // Cyclomatic complexity score
    if (complexity.cyclomatic > this.thresholds.cyclomatic.critical) {
      score += 40;
    } else if (complexity.cyclomatic > this.thresholds.cyclomatic.high) {
      score += 25;
    } else if (complexity.cyclomatic > this.thresholds.cyclomatic.medium) {
      score += 10;
    }

    // Cognitive complexity score
    if (complexity.cognitive > this.thresholds.cognitive.critical) {
      score += 30;
    } else if (complexity.cognitive > this.thresholds.cognitive.high) {
      score += 20;
    } else if (complexity.cognitive > this.thresholds.cognitive.medium) {
      score += 8;
    }

    // Maintainability penalty
    if (complexity.maintainability < this.thresholds.maintainability.poor) {
      score += 20;
    } else if (
      complexity.maintainability < this.thresholds.maintainability.moderate
    ) {
      score += 10;
    }

    // Size penalties
    if (complexity.lines > this.thresholds.size.maxLines) {
      score += 15;
    }

    if (complexity.parameters > this.thresholds.size.maxParameters) {
      score += 10;
    }

    if (complexity.depth > this.thresholds.nesting.maxDepth) {
      score += 10;
    }

    return score;
  }

  /**
   * Identify specific complexity issues
   */
  private identifyComplexityIssues(complexity: ComplexityMetrics): string[] {
    const issues: string[] = [];

    if (complexity.cyclomatic > this.thresholds.cyclomatic.critical) {
      issues.push(`Very high cyclomatic complexity (${complexity.cyclomatic})`);
    } else if (complexity.cyclomatic > this.thresholds.cyclomatic.high) {
      issues.push(`High cyclomatic complexity (${complexity.cyclomatic})`);
    }

    if (complexity.cognitive > this.thresholds.cognitive.critical) {
      issues.push(`Very high cognitive complexity (${complexity.cognitive})`);
    } else if (complexity.cognitive > this.thresholds.cognitive.high) {
      issues.push(`High cognitive complexity (${complexity.cognitive})`);
    }

    if (complexity.maintainability < this.thresholds.maintainability.poor) {
      issues.push(
        `Poor maintainability index (${complexity.maintainability.toFixed(1)})`
      );
    } else if (
      complexity.maintainability < this.thresholds.maintainability.moderate
    ) {
      issues.push(
        `Low maintainability index (${complexity.maintainability.toFixed(1)})`
      );
    }

    if (
      complexity.depth &&
      complexity.depth > this.thresholds.nesting.maxDepth
    ) {
      issues.push(`Excessive nesting depth (${complexity.depth})`);
    }

    if (
      complexity.parameters &&
      complexity.parameters > this.thresholds.size.maxParameters
    ) {
      issues.push(`Too many parameters (${complexity.parameters})`);
    }

    if (complexity.lines && complexity.lines > this.thresholds.size.maxLines) {
      issues.push(`Function/method too long (${complexity.lines} lines)`);
    }

    return issues;
  }

  /**
   * Generate hotspot-specific recommendations
   * Uses entity info to provide context-aware suggestions
   */
  private generateHotspotRecommendations(
    entity: EntityInfo,
    complexity: ComplexityMetrics
  ): string[] {
    const recommendations: string[] = [];
    const entityName = entity.name || 'this code';
    const entityType = entity.type || 'function';

    if (complexity.cyclomatic > this.thresholds.cyclomatic.high) {
      recommendations.push(
        `Break down complex conditional logic in ${entityName} into smaller functions`
      );
      recommendations.push('Use early returns to reduce nesting');
      recommendations.push(
        'Consider using strategy pattern for complex branching'
      );
    }

    if (complexity.cognitive > this.thresholds.cognitive.high) {
      recommendations.push('Simplify nested control structures');
      recommendations.push(
        'Extract complex conditions into well-named boolean variables'
      );
      recommendations.push('Break long chains of logical operators');
    }

    if (complexity.depth > this.thresholds.nesting.maxDepth) {
      recommendations.push(
        'Reduce nesting by extracting nested blocks into separate methods'
      );
      recommendations.push('Use guard clauses to eliminate deep nesting');
    }

    if (complexity.parameters > this.thresholds.size.maxParameters) {
      recommendations.push('Group related parameters into objects');
      recommendations.push('Use builder pattern for complex parameter sets');
      recommendations.push(
        'Consider if some parameters can be derived or have defaults'
      );
    }

    if (complexity.lines && complexity.lines > this.thresholds.size.maxLines) {
      recommendations.push(
        `Break large ${entityType} into smaller, focused functions`
      );
      recommendations.push('Extract reusable logic into utility functions');
      recommendations.push(
        `Consider if ${entityName} has multiple responsibilities`
      );
    }

    return recommendations;
  }

  /**
   * Generate complexity-based recommendations
   */
  private generateComplexityRecommendations(
    entities: EntityInfo[],
    complexities: Map<string, ComplexityMetrics>
  ): ComplexityRecommendation[] {
    const recommendations: ComplexityRecommendation[] = [];

    entities.forEach(entity => {
      const complexity = complexities.get(entity.id)!;
      const entityRecommendations = this.generateEntityRecommendations(
        entity,
        complexity
      );
      recommendations.push(...entityRecommendations);
    });

    // Sort by priority
    return recommendations.sort((a, b) => {
      const priorities = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorities[a.priority] - priorities[b.priority];
    });
  }

  /**
   * Generate recommendations for a specific entity
   */
  private generateEntityRecommendations(
    entity: EntityInfo,
    complexity: ComplexityMetrics
  ): ComplexityRecommendation[] {
    const recommendations: ComplexityRecommendation[] = [];

    // High cyclomatic complexity
    if (complexity.cyclomatic > this.thresholds.cyclomatic.high) {
      recommendations.push({
        id: createId(),
        type: 'reduce-complexity',
        priority:
          complexity.cyclomatic > this.thresholds.cyclomatic.critical
            ? 'critical'
            : 'high',
        entity,
        description: `Reduce cyclomatic complexity from ${complexity.cyclomatic} to under ${this.thresholds.cyclomatic.medium}`,
        impact: 'Improves code readability, testability, and maintainability',
        effort:
          complexity.cyclomatic > this.thresholds.cyclomatic.critical
            ? 'high'
            : 'medium',
        steps: [
          'Identify complex conditional logic',
          'Extract nested conditions into separate methods',
          'Use early returns to reduce branching',
          'Consider using strategy or state patterns',
          'Add comprehensive unit tests for all paths',
        ],
      });
    }

    // Large method/function
    if (complexity.lines && complexity.lines > this.thresholds.size.maxLines) {
      recommendations.push({
        id: createId(),
        type: 'extract-method',
        priority:
          complexity.lines &&
          complexity.lines > this.thresholds.size.maxLines * 2
            ? 'high'
            : 'medium',
        entity,
        description: `Break down large ${entity.type} (${complexity.lines} lines) into smaller functions`,
        impact: 'Improves code organization and reusability',
        effort: 'medium',
        steps: [
          'Identify logical sections within the function',
          'Extract sections into well-named helper methods',
          'Ensure each extracted method has a single responsibility',
          'Update tests to cover extracted methods',
          'Consider if extracted methods can be reused elsewhere',
        ],
      });
    }

    // Too many parameters
    if (
      complexity.parameters &&
      complexity.parameters > this.thresholds.size.maxParameters
    ) {
      recommendations.push({
        id: createId(),
        type: 'simplify-conditions',
        priority: 'medium',
        entity,
        description: `Reduce parameter count from ${complexity.parameters} to ${this.thresholds.size.maxParameters} or fewer`,
        impact: 'Improves function signature clarity and reduces coupling',
        effort: 'low',
        steps: [
          'Group related parameters into configuration objects',
          'Use builder pattern for complex parameter sets',
          'Consider dependency injection for external dependencies',
          'Evaluate if some parameters can have sensible defaults',
        ],
      });
    }

    // Large class (if applicable)
    if (
      entity.type === 'class' &&
      entity.members?.methods &&
      entity.members.methods.length > 15
    ) {
      recommendations.push({
        id: createId(),
        type: 'split-class',
        priority: 'medium',
        entity,
        description: `Consider splitting large class with ${entity.members.methods.length} methods`,
        impact:
          'Improves single responsibility principle and reduces complexity',
        effort: 'high',
        steps: [
          'Identify cohesive groups of methods and properties',
          'Extract related functionality into separate classes',
          'Use composition over inheritance where appropriate',
          'Update dependencies and injection configurations',
          'Ensure comprehensive test coverage for split classes',
        ],
      });
    }

    return recommendations;
  }
}
