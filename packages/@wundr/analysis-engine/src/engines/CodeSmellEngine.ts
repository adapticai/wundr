/**
 * Code Smell Detection Engine - Identifies anti-patterns and code quality issues
 * Advanced heuristic-based analysis with configurable rules
 */

import {
  EntityInfo,
  CodeSmell,
  CodeSmellType,
  SeverityLevel,
  ComplexityMetrics,
  BaseAnalyzer,
  AnalysisConfig
} from '../types';
import { createId } from '../utils';

interface CodeSmellRule {
  id: string;
  name: string;
  type: CodeSmellType;
  description: string;
  enabled: boolean;
  severity: SeverityLevel;
  thresholds?: Record<string, number>;
  patterns?: RegExp[];
  check: (entity: EntityInfo, allEntities: EntityInfo[]) => CodeSmellResult | null;
}

interface CodeSmellResult {
  severity: SeverityLevel;
  message: string;
  suggestion: string;
  confidence: number; // 0-1
  evidence: string[];
  relatedEntities?: string[];
}

interface CodeSmellConfig {
  enabledRules: CodeSmellType[];
  customThresholds: Record<CodeSmellType, Record<string, number>>;
  strictMode: boolean;
  includeMinorSmells: boolean;
}

/**
 * Advanced code smell detection engine with configurable rules
 */
export class CodeSmellEngine implements BaseAnalyzer<CodeSmell[]> {
  public readonly name = 'CodeSmellEngine';
  public readonly version = '2.0.0';

  private config: CodeSmellConfig;
  private rules: Map<CodeSmellType, CodeSmellRule> = new Map();

  constructor(config: Partial<CodeSmellConfig> = {}) {
    this.config = {
      enabledRules: [
        'long-method',
        'large-class',
        'duplicate-code',
        'dead-code',
        'complex-conditional',
        'feature-envy',
        'inappropriate-intimacy',
        'god-object',
        'wrapper-pattern',
        'deep-nesting',
        'long-parameter-list'
      ],
      customThresholds: {},
      strictMode: false,
      includeMinorSmells: true,
      ...config
    };

    this.initializeRules();
  }

  /**
   * Analyze entities for code smells
   */
  async analyze(entities: EntityInfo[], analysisConfig: AnalysisConfig): Promise<CodeSmell[]> {
    const codeSmells: CodeSmell[] = [];
    const entityMap = new Map(entities.map(e => [e.id, e]));

    // Apply each enabled rule to all applicable entities
    for (const entity of entities) {
      for (const ruleType of this.config.enabledRules) {
        const rule = this.rules.get(ruleType);
        if (rule && rule.enabled) {
          const result = rule.check(entity, entities);
          if (result && (this.config.includeMinorSmells || result.confidence >= 0.7)) {
            codeSmells.push({
              id: createId(),
              type: ruleType,
              severity: result.severity,
              file: entity.file,
              line: entity.line,
              message: result.message,
              suggestion: result.suggestion,
              entity
            });
          }
        }
      }
    }

    // Sort by severity and confidence
    return codeSmells.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Initialize all code smell detection rules
   */
  private initializeRules(): void {
    // Long Method
    this.rules.set('long-method', {
      id: 'long-method',
      name: 'Long Method',
      type: 'long-method',
      description: 'Methods/functions that are too long and complex',
      enabled: true,
      severity: 'medium',
      thresholds: { maxLines: 50, ...this.config.customThresholds['long-method'] },
      check: (entity, allEntities) => this.checkLongMethod(entity)
    });

    // Large Class
    this.rules.set('large-class', {
      id: 'large-class',
      name: 'Large Class',
      type: 'large-class',
      description: 'Classes with too many methods or properties',
      enabled: true,
      severity: 'high',
      thresholds: { maxMethods: 20, maxProperties: 15, maxLines: 500, ...this.config.customThresholds['large-class'] },
      check: (entity, allEntities) => this.checkLargeClass(entity)
    });

    // Duplicate Code
    this.rules.set('duplicate-code', {
      id: 'duplicate-code',
      name: 'Duplicate Code',
      type: 'duplicate-code',
      description: 'Code that appears to be duplicated across entities',
      enabled: true,
      severity: 'medium',
      thresholds: { similarity: 0.8, ...this.config.customThresholds['duplicate-code'] },
      check: (entity, allEntities) => this.checkDuplicateCode(entity, allEntities)
    });

    // Dead Code
    this.rules.set('dead-code', {
      id: 'dead-code',
      name: 'Dead Code',
      type: 'dead-code',
      description: 'Unused or unreachable code',
      enabled: true,
      severity: 'medium',
      check: (entity, allEntities) => this.checkDeadCode(entity)
    });

    // Complex Conditional
    this.rules.set('complex-conditional', {
      id: 'complex-conditional',
      name: 'Complex Conditional',
      type: 'complex-conditional',
      description: 'Overly complex conditional statements',
      enabled: true,
      severity: 'medium',
      thresholds: { maxConditions: 5, maxNesting: 3, ...this.config.customThresholds['complex-conditional'] },
      check: (entity, allEntities) => this.checkComplexConditional(entity)
    });

    // Feature Envy
    this.rules.set('feature-envy', {
      id: 'feature-envy',
      name: 'Feature Envy',
      type: 'feature-envy',
      description: 'Methods that use other classes more than their own',
      enabled: true,
      severity: 'medium',
      thresholds: { externalUsageRatio: 0.6, ...this.config.customThresholds['feature-envy'] },
      check: (entity, allEntities) => this.checkFeatureEnvy(entity, allEntities)
    });

    // Inappropriate Intimacy
    this.rules.set('inappropriate-intimacy', {
      id: 'inappropriate-intimacy',
      name: 'Inappropriate Intimacy',
      type: 'inappropriate-intimacy',
      description: 'Classes that are too tightly coupled',
      enabled: true,
      severity: 'medium',
      thresholds: { maxIntimacy: 3, ...this.config.customThresholds['inappropriate-intimacy'] },
      check: (entity, allEntities) => this.checkInappropriateIntimacy(entity, allEntities)
    });

    // God Object
    this.rules.set('god-object', {
      id: 'god-object',
      name: 'God Object',
      type: 'god-object',
      description: 'Classes that know too much or do too much',
      enabled: true,
      severity: 'high',
      thresholds: { maxComplexity: 100, maxDependencies: 15, maxMethods: 25, ...this.config.customThresholds['god-object'] },
      check: (entity, allEntities) => this.checkGodObject(entity)
    });

    // Wrapper Pattern
    this.rules.set('wrapper-pattern', {
      id: 'wrapper-pattern',
      name: 'Wrapper Pattern',
      type: 'wrapper-pattern',
      description: 'Unnecessary wrapper classes or functions',
      enabled: true,
      severity: 'low',
      thresholds: { maxWrapperMethods: 3, ...this.config.customThresholds['wrapper-pattern'] },
      check: (entity, allEntities) => this.checkWrapperPattern(entity)
    });

    // Deep Nesting
    this.rules.set('deep-nesting', {
      id: 'deep-nesting',
      name: 'Deep Nesting',
      type: 'deep-nesting',
      description: 'Code with excessive nesting levels',
      enabled: true,
      severity: 'medium',
      thresholds: { maxDepth: 4, ...this.config.customThresholds['deep-nesting'] },
      check: (entity, allEntities) => this.checkDeepNesting(entity)
    });

    // Long Parameter List
    this.rules.set('long-parameter-list', {
      id: 'long-parameter-list',
      name: 'Long Parameter List',
      type: 'long-parameter-list',
      description: 'Functions with too many parameters',
      enabled: true,
      severity: 'medium',
      thresholds: { maxParameters: 5, ...this.config.customThresholds['long-parameter-list'] },
      check: (entity, allEntities) => this.checkLongParameterList(entity)
    });
  }

  /**
   * Check for long methods
   */
  private checkLongMethod(entity: EntityInfo): CodeSmellResult | null {
    if (entity.type !== 'function' && entity.type !== 'method') {
      return null;
    }

    const rule = this.rules.get('long-method')!;
    const maxLines = rule.thresholds?.maxLines || 50;
    const lines = entity.complexity?.lines || 0;

    if (lines > maxLines) {
      const severity: SeverityLevel = lines > maxLines * 2 ? 'high' : 'medium';
      const confidence = Math.min(1, (lines - maxLines) / maxLines);

      return {
        severity,
        confidence,
        message: `Method is too long with ${lines} lines (limit: ${maxLines})`,
        suggestion: 'Break down this method into smaller, more focused methods',
        evidence: [
          `Current length: ${lines} lines`,
          `Recommended maximum: ${maxLines} lines`,
          `Cyclomatic complexity: ${entity.complexity?.cyclomatic || 'unknown'}`
        ]
      };
    }

    return null;
  }

  /**
   * Check for large classes
   */
  private checkLargeClass(entity: EntityInfo): CodeSmellResult | null {
    if (entity.type !== 'class') {
      return null;
    }

    const rule = this.rules.get('large-class')!;
    const maxMethods = rule.thresholds?.maxMethods || 20;
    const maxProperties = rule.thresholds?.maxProperties || 15;
    const maxLines = rule.thresholds?.maxLines || 500;

    const methodCount = entity.members?.methods?.length || 0;
    const propertyCount = entity.members?.properties?.length || 0;
    const lines = entity.complexity?.lines || 0;

    const violations: string[] = [];
    let severity: SeverityLevel = 'low';

    if (methodCount > maxMethods) {
      violations.push(`Too many methods: ${methodCount} (limit: ${maxMethods})`);
      severity = 'medium';
    }

    if (propertyCount > maxProperties) {
      violations.push(`Too many properties: ${propertyCount} (limit: ${maxProperties})`);
      severity = 'medium';
    }

    if (lines > maxLines) {
      violations.push(`Too many lines: ${lines} (limit: ${maxLines})`);
      severity = lines > maxLines * 1.5 ? 'high' : 'medium';
    }

    if (violations.length > 0) {
      const confidence = violations.length / 3; // Up to 3 violations

      return {
        severity,
        confidence,
        message: `Class is too large: ${violations.join(', ')}`,
        suggestion: 'Consider splitting this class into smaller, more focused classes using Single Responsibility Principle',
        evidence: violations
      };
    }

    return null;
  }

  /**
   * Check for duplicate code (simplified version)
   */
  private checkDuplicateCode(entity: EntityInfo, allEntities: EntityInfo[]): CodeSmellResult | null {
    if (!entity.signature) {
      return null;
    }

    const rule = this.rules.get('duplicate-code')!;
    const minSimilarity = rule.thresholds?.similarity || 0.8;

    // Find similar entities
    const similarEntities = allEntities.filter(other => {
      if (other.id === entity.id || !other.signature) return false;
      return this.calculateSimilarity(entity.signature!, other.signature!) >= minSimilarity;
    });

    if (similarEntities.length > 0) {
      const confidence = Math.min(1, similarEntities.length / 3);
      const severity: SeverityLevel = similarEntities.length > 2 ? 'high' : 'medium';

      return {
        severity,
        confidence,
        message: `Code appears to be duplicated in ${similarEntities.length} other location(s)`,
        suggestion: 'Extract common functionality into a shared utility or base class',
        evidence: [
          `Similar entities: ${similarEntities.length}`,
          `Files: ${[...new Set(similarEntities.map(e => e.file))].join(', ')}`
        ],
        relatedEntities: similarEntities.map(e => e.id)
      };
    }

    return null;
  }

  /**
   * Check for dead code
   */
  private checkDeadCode(entity: EntityInfo): CodeSmellResult | null {
    const deadCodeIndicators = [
      'TODO', 'FIXME', 'HACK', 'XXX',
      'unused', 'deprecated', 'obsolete',
      'temp', 'temporary', 'test'
    ];

    const nameIndicators = deadCodeIndicators.filter(indicator => 
      entity.name.toLowerCase().includes(indicator.toLowerCase())
    );

    const signatureIndicators = entity.signature ? 
      deadCodeIndicators.filter(indicator => 
        entity.signature!.toLowerCase().includes(indicator.toLowerCase())
      ) : [];

    const commentIndicators = entity.jsDoc ? 
      deadCodeIndicators.filter(indicator => 
        entity.jsDoc!.toLowerCase().includes(indicator.toLowerCase())
      ) : [];

    const totalIndicators = [...nameIndicators, ...signatureIndicators, ...commentIndicators];

    if (totalIndicators.length > 0) {
      const confidence = Math.min(1, totalIndicators.length / 3);
      const severity: SeverityLevel = totalIndicators.length > 2 ? 'medium' : 'low';

      return {
        severity,
        confidence,
        message: `Code appears to be dead/unused (indicators: ${totalIndicators.join(', ')})`,
        suggestion: 'Remove dead code or implement the intended functionality',
        evidence: [
          `Name indicators: ${nameIndicators.join(', ') || 'none'}`,
          `Code indicators: ${signatureIndicators.join(', ') || 'none'}`,
          `Comment indicators: ${commentIndicators.join(', ') || 'none'}`
        ]
      };
    }

    return null;
  }

  /**
   * Check for complex conditionals
   */
  private checkComplexConditional(entity: EntityInfo): CodeSmellResult | null {
    if (!entity.signature) {
      return null;
    }

    const rule = this.rules.get('complex-conditional')!;
    const maxConditions = rule.thresholds?.maxConditions || 5;
    const maxNesting = rule.thresholds?.maxNesting || 3;

    // Count logical operators
    const logicalOperators = (entity.signature.match(/&&|\|\||\?\s*:/g) || []).length;
    
    // Estimate nesting depth
    const nestingDepth = entity.complexity?.depth || 0;
    
    // Count if/else chains
    const ifElseChains = (entity.signature.match(/\b(if|else if)\b/g) || []).length;

    const violations: string[] = [];
    let severity: SeverityLevel = 'low';

    if (logicalOperators > maxConditions) {
      violations.push(`Too many logical operators: ${logicalOperators}`);
      severity = 'medium';
    }

    if (nestingDepth > maxNesting) {
      violations.push(`Excessive nesting: ${nestingDepth} levels`);
      severity = nestingDepth > maxNesting * 1.5 ? 'high' : 'medium';
    }

    if (ifElseChains > maxConditions) {
      violations.push(`Long if-else chain: ${ifElseChains} conditions`);
      severity = 'medium';
    }

    if (violations.length > 0) {
      const confidence = violations.length / 3;

      return {
        severity,
        confidence,
        message: `Complex conditional logic: ${violations.join(', ')}`,
        suggestion: 'Simplify conditional logic using early returns, strategy pattern, or guard clauses',
        evidence: violations
      };
    }

    return null;
  }

  /**
   * Check for feature envy
   */
  private checkFeatureEnvy(entity: EntityInfo, allEntities: EntityInfo[]): CodeSmellResult | null {
    if (entity.type !== 'method' && entity.type !== 'function') {
      return null;
    }

    if (!entity.signature) {
      return null;
    }

    const rule = this.rules.get('feature-envy')!;
    const maxExternalUsageRatio = rule.thresholds?.externalUsageRatio || 0.6;

    // Count references to external entities vs own class/module
    const externalReferences = this.countExternalReferences(entity, allEntities);
    const totalReferences = this.countTotalReferences(entity.signature);

    if (totalReferences > 0) {
      const externalRatio = externalReferences / totalReferences;
      
      if (externalRatio > maxExternalUsageRatio) {
        const confidence = Math.min(1, (externalRatio - maxExternalUsageRatio) / (1 - maxExternalUsageRatio));
        
        return {
          severity: 'medium',
          confidence,
          message: `Method shows feature envy (${Math.round(externalRatio * 100)}% external usage)`,
          suggestion: 'Consider moving this method to the class it envies, or extract the envied functionality',
          evidence: [
            `External references: ${externalReferences}`,
            `Total references: ${totalReferences}`,
            `External usage ratio: ${Math.round(externalRatio * 100)}%`
          ]
        };
      }
    }

    return null;
  }

  /**
   * Check for inappropriate intimacy
   */
  private checkInappropriateIntimacy(entity: EntityInfo, allEntities: EntityInfo[]): CodeSmellResult | null {
    if (entity.type !== 'class') {
      return null;
    }

    const rule = this.rules.get('inappropriate-intimacy')!;
    const maxIntimacy = rule.thresholds?.maxIntimacy || 3;

    // Find classes that this class is too intimate with
    const intimateClasses = this.findIntimateClasses(entity, allEntities);
    
    if (intimateClasses.length > maxIntimacy) {
      const confidence = Math.min(1, (intimateClasses.length - maxIntimacy) / maxIntimacy);
      
      return {
        severity: 'medium',
        confidence,
        message: `Class is inappropriately intimate with ${intimateClasses.length} other classes`,
        suggestion: 'Reduce coupling by using interfaces, dependency injection, or extracting shared functionality',
        evidence: [
          `Intimate relationships: ${intimateClasses.length}`,
          `Affected classes: ${intimateClasses.join(', ')}`
        ]
      };
    }

    return null;
  }

  /**
   * Check for god objects
   */
  private checkGodObject(entity: EntityInfo): CodeSmellResult | null {
    if (entity.type !== 'class') {
      return null;
    }

    const rule = this.rules.get('god-object')!;
    const maxComplexity = rule.thresholds?.maxComplexity || 100;
    const maxDependencies = rule.thresholds?.maxDependencies || 15;
    const maxMethods = rule.thresholds?.maxMethods || 25;

    const complexity = entity.complexity?.cyclomatic || 0;
    const dependencies = entity.dependencies.length;
    const methods = entity.members?.methods?.length || 0;

    const violations: string[] = [];
    let severity: SeverityLevel = 'low';

    if (complexity > maxComplexity) {
      violations.push(`Excessive complexity: ${complexity}`);
      severity = 'high';
    }

    if (dependencies > maxDependencies) {
      violations.push(`Too many dependencies: ${dependencies}`);
      severity = severity === 'high' ? 'high' : 'medium';
    }

    if (methods > maxMethods) {
      violations.push(`Too many methods: ${methods}`);
      severity = severity === 'high' ? 'high' : 'medium';
    }

    if (violations.length >= 2) {
      const confidence = violations.length / 3;
      
      return {
        severity: violations.length === 3 ? 'critical' : severity,
        confidence,
        message: `God object detected: ${violations.join(', ')}`,
        suggestion: 'Break down this class into smaller, more focused classes with single responsibilities',
        evidence: violations
      };
    }

    return null;
  }

  /**
   * Check for wrapper pattern anti-pattern
   */
  private checkWrapperPattern(entity: EntityInfo): CodeSmellResult | null {
    if (entity.type !== 'class' && entity.type !== 'function') {
      return null;
    }

    if (!entity.signature) {
      return null;
    }

    // Look for wrapper patterns
    const isWrapper = this.detectWrapperPattern(entity);
    
    if (isWrapper.isWrapper) {
      return {
        severity: 'low',
        confidence: isWrapper.confidence,
        message: `Potential unnecessary wrapper: ${isWrapper.reason}`,
        suggestion: 'Consider if this wrapper adds value or if functionality can be used directly',
        evidence: isWrapper.evidence
      };
    }

    return null;
  }

  /**
   * Check for deep nesting
   */
  private checkDeepNesting(entity: EntityInfo): CodeSmellResult | null {
    const rule = this.rules.get('deep-nesting')!;
    const maxDepth = rule.thresholds?.maxDepth || 4;
    const depth = entity.complexity?.depth || 0;

    if (depth > maxDepth) {
      const severity: SeverityLevel = depth > maxDepth * 1.5 ? 'high' : 'medium';
      const confidence = Math.min(1, (depth - maxDepth) / maxDepth);

      return {
        severity,
        confidence,
        message: `Excessive nesting depth: ${depth} levels (limit: ${maxDepth})`,
        suggestion: 'Reduce nesting using early returns, guard clauses, or extracting nested logic into separate methods',
        evidence: [
          `Current depth: ${depth} levels`,
          `Recommended maximum: ${maxDepth} levels`
        ]
      };
    }

    return null;
  }

  /**
   * Check for long parameter lists
   */
  private checkLongParameterList(entity: EntityInfo): CodeSmellResult | null {
    if (entity.type !== 'function' && entity.type !== 'method') {
      return null;
    }

    const rule = this.rules.get('long-parameter-list')!;
    const maxParameters = rule.thresholds?.maxParameters || 5;
    const parameters = entity.complexity?.parameters || 0;

    if (parameters > maxParameters) {
      const severity: SeverityLevel = parameters > maxParameters * 1.5 ? 'high' : 'medium';
      const confidence = Math.min(1, (parameters - maxParameters) / maxParameters);

      return {
        severity,
        confidence,
        message: `Too many parameters: ${parameters} (limit: ${maxParameters})`,
        suggestion: 'Group related parameters into objects, use builder pattern, or reduce parameter count',
        evidence: [
          `Current parameters: ${parameters}`,
          `Recommended maximum: ${maxParameters}`
        ]
      };
    }

    return null;
  }

  // Helper methods

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const tokens1 = new Set(str1.toLowerCase().split(/\W+/).filter(t => t.length > 2));
    const tokens2 = new Set(str2.toLowerCase().split(/\W+/).filter(t => t.length > 2));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Count external references in entity
   */
  private countExternalReferences(entity: EntityInfo, allEntities: EntityInfo[]): number {
    if (!entity.signature) return 0;
    
    // Get entities from the same file/class
    const sameContextEntities = allEntities.filter(e => 
      e.file === entity.file || 
      (entity.metadata?.parentEntity && e.id === entity.metadata.parentEntity)
    );
    
    const sameContextNames = new Set(sameContextEntities.map(e => e.name));
    
    // Count references to entities not in same context
    const words = entity.signature.split(/\W+/);
    let externalReferences = 0;
    
    for (const word of words) {
      if (word.length > 2 && !sameContextNames.has(word)) {
        // Check if it's a reference to another entity
        const isEntityReference = allEntities.some(e => e.name === word);
        if (isEntityReference) {
          externalReferences++;
        }
      }
    }
    
    return externalReferences;
  }

  /**
   * Count total references in signature
   */
  private countTotalReferences(signature: string): number {
    // Simple heuristic: count identifiers that look like entity references
    const identifiers = signature.match(/\b[A-Z][a-zA-Z0-9_]*\b/g) || [];
    return identifiers.length;
  }

  /**
   * Find classes that are inappropriately intimate
   */
  private findIntimateClasses(entity: EntityInfo, allEntities: EntityInfo[]): string[] {
    if (!entity.signature) return [];
    
    const intimateClasses: string[] = [];
    const classReferences = new Map<string, number>();
    
    // Find references to other classes
    for (const otherEntity of allEntities) {
      if (otherEntity.type === 'class' && otherEntity.id !== entity.id) {
        const referenceCount = (entity.signature.match(new RegExp(`\\b${otherEntity.name}\\b`, 'g')) || []).length;
        if (referenceCount > 3) { // Threshold for intimacy
          classReferences.set(otherEntity.name, referenceCount);
        }
      }
    }
    
    return Array.from(classReferences.keys());
  }

  /**
   * Detect wrapper pattern
   */
  private detectWrapperPattern(entity: EntityInfo): { isWrapper: boolean; confidence: number; reason: string; evidence: string[] } {
    if (!entity.signature) {
      return { isWrapper: false, confidence: 0, reason: '', evidence: [] };
    }

    const evidence: string[] = [];
    let wrapperScore = 0;
    
    // Check for simple delegation patterns
    if (entity.signature.includes('return ') && entity.signature.split('return ').length === 2) {
      wrapperScore += 0.3;
      evidence.push('Single return statement delegation');
    }
    
    // Check for method forwarding
    const forwardingPatterns = ['this.', 'super.', '.call(', '.apply('];
    for (const pattern of forwardingPatterns) {
      if (entity.signature.includes(pattern)) {
        wrapperScore += 0.2;
        evidence.push(`Method forwarding: ${pattern}`);
      }
    }
    
    // Check for minimal added logic
    const lines = entity.signature.split('\n').filter(line => line.trim() && !line.trim().startsWith('//')).length;
    if (lines <= 3) {
      wrapperScore += 0.3;
      evidence.push(`Minimal logic: ${lines} lines`);
    }
    
    // Check for wrapper-like naming
    const wrapperNames = ['wrapper', 'proxy', 'delegate', 'adapter'];
    if (wrapperNames.some(name => entity.name.toLowerCase().includes(name))) {
      wrapperScore += 0.4;
      evidence.push('Wrapper-like naming');
    }
    
    return {
      isWrapper: wrapperScore >= 0.6,
      confidence: Math.min(1, wrapperScore),
      reason: wrapperScore >= 0.6 ? 'Multiple wrapper pattern indicators detected' : '',
      evidence
    };
  }

  /**
   * Get rule configuration
   */
  getRules(): Map<CodeSmellType, CodeSmellRule> {
    return this.rules;
  }

  /**
   * Update rule configuration
   */
  updateRule(type: CodeSmellType, updates: Partial<CodeSmellRule>): void {
    const rule = this.rules.get(type);
    if (rule) {
      Object.assign(rule, updates);
    }
  }
}