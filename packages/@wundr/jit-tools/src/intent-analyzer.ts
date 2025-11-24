/**
 * @wundr.io/jit-tools - Intent Analyzer
 *
 * Parses agent intent from queries to determine which tools are relevant.
 * Extracts capabilities, categories, entities, and keywords for tool matching.
 */

import type {
  ParsedIntent,
  IntentEntity,
  ToolCategory,
  AgentContext,
  TaskContext,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for intent analysis
 */
export interface IntentAnalyzerConfig {
  /** Minimum confidence threshold for entities */
  minEntityConfidence: number;
  /** Maximum number of keywords to extract */
  maxKeywords: number;
  /** Enable fuzzy matching */
  enableFuzzyMatching: boolean;
  /** Custom action patterns */
  customActionPatterns: ActionPattern[];
  /** Custom entity patterns */
  customEntityPatterns: EntityPattern[];
}

/**
 * Pattern for matching actions in queries
 */
export interface ActionPattern {
  /** Pattern name */
  name: string;
  /** Regex pattern */
  pattern: RegExp;
  /** Associated capabilities */
  capabilities: string[];
  /** Associated categories */
  categories: ToolCategory[];
}

/**
 * Pattern for extracting entities
 */
export interface EntityPattern {
  /** Entity type */
  type: string;
  /** Regex pattern */
  pattern: RegExp;
  /** Extraction group index */
  groupIndex: number;
}

/**
 * Default configuration
 */
export const DEFAULT_INTENT_ANALYZER_CONFIG: IntentAnalyzerConfig = {
  minEntityConfidence: 0.5,
  maxKeywords: 20,
  enableFuzzyMatching: true,
  customActionPatterns: [],
  customEntityPatterns: [],
};

// =============================================================================
// Built-in Patterns
// =============================================================================

/**
 * Built-in action patterns for common AI agent tasks
 */
const BUILTIN_ACTION_PATTERNS: ActionPattern[] = [
  // Code Analysis
  {
    name: 'analyze',
    pattern: /\b(analyze|analysis|examine|inspect|review|check)\b/i,
    capabilities: ['code-analysis', 'code-review', 'static-analysis'],
    categories: ['analysis', 'governance'],
  },
  // Code Generation
  {
    name: 'generate',
    pattern: /\b(generate|create|write|implement|build|scaffold)\b/i,
    capabilities: ['code-generation', 'scaffolding', 'templating'],
    categories: ['documentation', 'custom'],
  },
  // Testing
  {
    name: 'test',
    pattern: /\b(test|testing|unit\s*test|integration\s*test|e2e|coverage)\b/i,
    capabilities: ['testing', 'test-generation', 'coverage-analysis'],
    categories: ['testing'],
  },
  // Deployment
  {
    name: 'deploy',
    pattern: /\b(deploy|deployment|release|publish|ship)\b/i,
    capabilities: ['deployment', 'release-management', 'ci-cd'],
    categories: ['deployment'],
  },
  // Monitoring
  {
    name: 'monitor',
    pattern: /\b(monitor|monitoring|track|observe|watch|metrics)\b/i,
    capabilities: ['monitoring', 'metrics-collection', 'alerting'],
    categories: ['monitoring'],
  },
  // GitHub/Git Operations
  {
    name: 'git',
    pattern: /\b(git|github|pull\s*request|pr|merge|commit|branch)\b/i,
    capabilities: ['git-operations', 'pr-management', 'code-review'],
    categories: ['github'],
  },
  // Memory Operations
  {
    name: 'memory',
    pattern: /\b(memory|remember|recall|store|persist|cache)\b/i,
    capabilities: ['memory-management', 'context-storage', 'caching'],
    categories: ['memory'],
  },
  // Security
  {
    name: 'security',
    pattern: /\b(security|secure|vulnerability|audit|scan|penetration)\b/i,
    capabilities: ['security-scanning', 'vulnerability-detection', 'audit'],
    categories: ['security'],
  },
  // Documentation
  {
    name: 'document',
    pattern: /\b(document|documentation|docs|readme|api\s*doc)\b/i,
    capabilities: ['documentation-generation', 'api-documentation'],
    categories: ['documentation'],
  },
  // Coordination
  {
    name: 'coordinate',
    pattern: /\b(coordinate|orchestrate|schedule|queue|distribute)\b/i,
    capabilities: ['task-orchestration', 'scheduling', 'coordination'],
    categories: ['coordination'],
  },
  // Neural/AI Operations
  {
    name: 'neural',
    pattern: /\b(neural|ai|ml|machine\s*learning|pattern|predict)\b/i,
    capabilities: ['pattern-recognition', 'prediction', 'ml-operations'],
    categories: ['neural'],
  },
  // System Operations
  {
    name: 'system',
    pattern: /\b(system|performance|benchmark|optimize|profile)\b/i,
    capabilities: ['performance-optimization', 'benchmarking', 'profiling'],
    categories: ['system'],
  },
  // Governance
  {
    name: 'governance',
    pattern: /\b(governance|compliance|policy|standard|enforce)\b/i,
    capabilities: ['policy-enforcement', 'compliance-checking', 'standards'],
    categories: ['governance'],
  },
];

/**
 * Built-in entity patterns
 */
const BUILTIN_ENTITY_PATTERNS: EntityPattern[] = [
  // File paths
  {
    type: 'file_path',
    pattern: /(?:\/[\w.-]+)+(?:\.\w+)?/g,
    groupIndex: 0,
  },
  // Function/method names
  {
    type: 'function_name',
    pattern: /\b(function|method|fn)\s+(\w+)/gi,
    groupIndex: 2,
  },
  // Class names
  {
    type: 'class_name',
    pattern: /\b(class|interface|type)\s+(\w+)/gi,
    groupIndex: 2,
  },
  // Variable names (in code context)
  {
    type: 'variable',
    pattern: /\$\{?(\w+)\}?|\b(let|const|var)\s+(\w+)/gi,
    groupIndex: 1,
  },
  // URLs
  {
    type: 'url',
    pattern: /https?:\/\/[^\s]+/gi,
    groupIndex: 0,
  },
  // Package names
  {
    type: 'package',
    pattern: /@[\w-]+\/[\w-]+|[\w-]+@[\d.]+/g,
    groupIndex: 0,
  },
  // Error codes
  {
    type: 'error_code',
    pattern: /\b(ERR|ERROR|E)\d+\b|error\s*code[:\s]*(\w+)/gi,
    groupIndex: 0,
  },
  // Branch names
  {
    type: 'branch',
    pattern: /\b(branch|checkout|merge)\s+([^\s]+)/gi,
    groupIndex: 2,
  },
];

// =============================================================================
// IntentAnalyzer Class
// =============================================================================

/**
 * Analyzes agent queries to extract intent information for tool matching.
 *
 * @example
 * ```typescript
 * const analyzer = new IntentAnalyzer();
 *
 * const intent = analyzer.analyze('Analyze the code in src/index.ts for security issues');
 * // Returns:
 * // {
 * //   action: 'analyze',
 * //   entities: [{ type: 'file_path', value: 'src/index.ts', ... }],
 * //   requiredCapabilities: ['code-analysis', 'security-scanning'],
 * //   relevantCategories: ['analysis', 'security'],
 * //   keywords: ['analyze', 'code', 'security', 'issues'],
 * //   confidence: 0.85,
 * //   ...
 * // }
 * ```
 */
export class IntentAnalyzer {
  private config: IntentAnalyzerConfig;
  private actionPatterns: ActionPattern[];
  private entityPatterns: EntityPattern[];

  /**
   * Creates a new IntentAnalyzer instance
   *
   * @param config - Configuration options
   */
  constructor(config: Partial<IntentAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_INTENT_ANALYZER_CONFIG, ...config };
    this.actionPatterns = [
      ...BUILTIN_ACTION_PATTERNS,
      ...this.config.customActionPatterns,
    ];
    this.entityPatterns = [
      ...BUILTIN_ENTITY_PATTERNS,
      ...this.config.customEntityPatterns,
    ];
  }

  /**
   * Analyze a query string to extract intent
   *
   * @param query - The query to analyze
   * @param context - Optional agent context for enhanced analysis
   * @returns Parsed intent information
   */
  analyze(query: string, context?: AgentContext): ParsedIntent {
    const normalizedQuery = this.normalizeQuery(query);

    // Extract action
    const action = this.extractAction(normalizedQuery);

    // Extract entities
    const entities = this.extractEntities(query);

    // Extract capabilities
    const requiredCapabilities = this.extractCapabilities(
      normalizedQuery,
      action,
      context,
    );

    // Extract categories
    const relevantCategories = this.extractCategories(
      normalizedQuery,
      action,
      context,
    );

    // Extract keywords
    const keywords = this.extractKeywords(normalizedQuery);

    // Calculate confidence
    const confidence = this.calculateConfidence(
      action,
      entities,
      requiredCapabilities,
    );

    return {
      action,
      entities,
      requiredCapabilities,
      relevantCategories,
      keywords,
      confidence,
      originalQuery: query,
      normalizedQuery,
    };
  }

  /**
   * Analyze intent with task context for more accurate matching
   *
   * @param query - The query to analyze
   * @param taskContext - Task context information
   * @returns Enhanced parsed intent
   */
  analyzeWithTaskContext(
    query: string,
    taskContext: TaskContext,
  ): ParsedIntent {
    const baseIntent = this.analyze(query);

    // Merge task capabilities
    const mergedCapabilities = new Set([
      ...baseIntent.requiredCapabilities,
      ...taskContext.requiredCapabilities,
    ]);

    // Boost confidence if task context aligns
    let confidence = baseIntent.confidence;
    if (
      taskContext.requiredCapabilities.some(cap =>
        baseIntent.requiredCapabilities.includes(cap),
      )
    ) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }

    return {
      ...baseIntent,
      requiredCapabilities: Array.from(mergedCapabilities),
      confidence,
    };
  }

  /**
   * Add a custom action pattern
   *
   * @param pattern - Action pattern to add
   */
  addActionPattern(pattern: ActionPattern): void {
    this.actionPatterns.push(pattern);
  }

  /**
   * Add a custom entity pattern
   *
   * @param pattern - Entity pattern to add
   */
  addEntityPattern(pattern: EntityPattern): void {
    this.entityPatterns.push(pattern);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Normalize query for analysis
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract the primary action from the query
   */
  private extractAction(query: string): string {
    for (const pattern of this.actionPatterns) {
      if (pattern.pattern.test(query)) {
        return pattern.name;
      }
    }

    // Default action based on common verbs
    const verbs = [
      'get',
      'find',
      'search',
      'list',
      'show',
      'help',
      'fix',
      'update',
      'delete',
    ];
    for (const verb of verbs) {
      if (query.includes(verb)) {
        return verb;
      }
    }

    return 'unknown';
  }

  /**
   * Extract entities from the query
   */
  private extractEntities(query: string): IntentEntity[] {
    const entities: IntentEntity[] = [];

    for (const pattern of this.entityPatterns) {
      // Reset regex state
      pattern.pattern.lastIndex = 0;

      let match;
      while ((match = pattern.pattern.exec(query)) !== null) {
        const value = match[pattern.groupIndex] || match[0];

        if (value && value.length > 1) {
          const confidence = this.calculateEntityConfidence(
            value,
            pattern.type,
          );

          if (confidence >= this.config.minEntityConfidence) {
            entities.push({
              type: pattern.type,
              value: value.trim(),
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              confidence,
            });
          }
        }
      }
    }

    // Remove duplicates
    return this.deduplicateEntities(entities);
  }

  /**
   * Extract required capabilities based on the query and action
   */
  private extractCapabilities(
    query: string,
    action: string,
    context?: AgentContext,
  ): string[] {
    const capabilities = new Set<string>();

    // Add capabilities from matching action patterns
    for (const pattern of this.actionPatterns) {
      if (pattern.pattern.test(query)) {
        for (const cap of pattern.capabilities) {
          capabilities.add(cap);
        }
      }
    }

    // Add capabilities from agent context
    if (context?.taskContext?.requiredCapabilities) {
      for (const cap of context.taskContext.requiredCapabilities) {
        capabilities.add(cap);
      }
    }

    // Add action as capability if it's meaningful
    if (action !== 'unknown') {
      capabilities.add(action);
    }

    return Array.from(capabilities);
  }

  /**
   * Extract relevant categories based on the query and action
   */
  private extractCategories(
    query: string,
    action: string,
    context?: AgentContext,
  ): ToolCategory[] {
    const categories = new Set<ToolCategory>();

    // Add categories from matching action patterns
    for (const pattern of this.actionPatterns) {
      if (pattern.pattern.test(query)) {
        for (const cat of pattern.categories) {
          categories.add(cat);
        }
      }
    }

    // Add preferred categories from context
    if (context?.preferences?.preferredCategories) {
      for (const cat of context.preferences.preferredCategories) {
        categories.add(cat);
      }
    }

    return Array.from(categories);
  }

  /**
   * Extract keywords from the query
   */
  private extractKeywords(query: string): string[] {
    // Stop words to filter out
    const stopWords = new Set([
      'a',
      'an',
      'the',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'need',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'and',
      'but',
      'or',
      'nor',
      'so',
      'yet',
      'both',
      'either',
      'neither',
      'not',
      'only',
      'own',
      'same',
      'than',
      'too',
      'very',
      'just',
      'this',
      'that',
      'these',
      'those',
      'it',
      'its',
      'me',
      'my',
      'we',
      'our',
      'you',
      'your',
      'he',
      'she',
      'they',
      'them',
      'i',
      'please',
      'help',
      'want',
      'like',
    ]);

    const words = query
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Score keywords by position and frequency
    const keywordScores = new Map<string, number>();

    words.forEach((word, index) => {
      const positionScore = 1 - (index / words.length) * 0.3; // Earlier words score higher
      const currentScore = keywordScores.get(word) || 0;
      keywordScores.set(word, currentScore + positionScore);
    });

    // Sort by score and take top keywords
    return Array.from(keywordScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxKeywords)
      .map(([word]) => word);
  }

  /**
   * Calculate confidence score for an entity
   */
  private calculateEntityConfidence(value: string, type: string): number {
    let confidence = 0.6; // Base confidence

    // Boost for longer values (more specific)
    if (value.length > 10) {
      confidence += 0.1;
    }

    // Boost for specific patterns
    if (type === 'file_path' && value.includes('/')) {
      confidence += 0.15;
    }

    if (type === 'url' && value.startsWith('http')) {
      confidence += 0.2;
    }

    if (type === 'package' && value.includes('@')) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate overall confidence for the parsed intent
   */
  private calculateConfidence(
    action: string,
    entities: IntentEntity[],
    capabilities: string[],
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost for known action
    if (action !== 'unknown') {
      confidence += 0.2;
    }

    // Boost for extracted entities
    if (entities.length > 0) {
      confidence += Math.min(entities.length * 0.05, 0.15);
    }

    // Boost for identified capabilities
    if (capabilities.length > 0) {
      confidence += Math.min(capabilities.length * 0.03, 0.15);
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Remove duplicate entities, keeping the highest confidence one
   */
  private deduplicateEntities(entities: IntentEntity[]): IntentEntity[] {
    const seen = new Map<string, IntentEntity>();

    for (const entity of entities) {
      const key = `${entity.type}:${entity.value}`;
      const existing = seen.get(key);

      if (!existing || entity.confidence > existing.confidence) {
        seen.set(key, entity);
      }
    }

    return Array.from(seen.values());
  }
}

/**
 * Create an intent analyzer with default configuration
 *
 * @param config - Optional configuration overrides
 * @returns IntentAnalyzer instance
 */
export function createIntentAnalyzer(
  config?: Partial<IntentAnalyzerConfig>,
): IntentAnalyzer {
  return new IntentAnalyzer(config);
}
