/**
 * Request Analyzer for RAG Context Enhancer
 *
 * Analyzes incoming requests to determine if RAG context would be beneficial,
 * extracts entities, generates queries, and determines context goals.
 *
 * @module hooks/rag-context-enhancer/request-analyzer
 */

import type {
  AnalysisResult,
  ContextGoal,
  GeneratedQuery,
  PatternMatch,
  RequestEntities,
  RagContextHookConfig,
  TriggerPattern,
} from './types';
import { defaultConfig } from './config';

/**
 * RequestAnalyzer class for analyzing incoming requests and determining
 * if RAG context enhancement would be beneficial.
 */
export class RequestAnalyzer {
  private readonly config: RagContextHookConfig;

  /**
   * Creates a new RequestAnalyzer instance
   *
   * @param config - Optional configuration override
   */
  constructor(config?: Partial<RagContextHookConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Analyze a request to determine if RAG context should be enhanced
   *
   * @param request - The user request text to analyze
   * @returns Analysis result with recommendations
   */
  public analyze(request: string): AnalysisResult {
    const normalizedRequest = this.normalizeRequest(request);

    // Find all pattern matches
    const questionMatches = this.findPatternMatches(
      normalizedRequest,
      this.config.questionPatterns
    );
    const actionMatches = this.findPatternMatches(
      normalizedRequest,
      this.config.actionPatterns
    );
    const complexityMatches = this.findPatternMatches(
      normalizedRequest,
      this.config.complexityPatterns
    );

    const allMatches = [...questionMatches, ...actionMatches, ...complexityMatches];

    // Extract entities from the request
    const entities = this.extractEntities(normalizedRequest);

    // Calculate confidence score
    const confidence = this.calculateConfidence(
      questionMatches,
      actionMatches,
      complexityMatches
    );

    // Determine context goal
    const contextGoal = this.determineContextGoal(allMatches, entities);

    // Generate RAG queries
    const queries = this.generateQueries(allMatches, entities, normalizedRequest);

    // Determine if enhancement is recommended
    const shouldEnhance = confidence >= this.config.priority.minConfidenceThreshold;

    // Generate suggested file patterns based on entities
    const suggestedPatterns = this.generateSuggestedPatterns(entities);

    // Generate reasoning explanation
    const reasoning = this.generateReasoning(
      shouldEnhance,
      confidence,
      allMatches,
      contextGoal
    );

    return {
      shouldEnhance,
      confidence,
      contextGoal,
      queries,
      matches: allMatches,
      entities,
      suggestedPatterns,
      reasoning,
    };
  }

  /**
   * Normalize request text for consistent matching
   */
  private normalizeRequest(request: string): string {
    return request
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'");
  }

  /**
   * Find all pattern matches in the request
   */
  private findPatternMatches(
    request: string,
    patterns: readonly TriggerPattern[]
  ): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of patterns) {
      const match = request.match(pattern.pattern);
      if (match) {
        matches.push({
          type: pattern.type,
          pattern: pattern.id,
          regex: pattern.pattern,
          match: match[0],
          confidence: pattern.weight,
        });
      }
    }

    return matches;
  }

  /**
   * Extract entities from the request text
   */
  private extractEntities(request: string): RequestEntities {
    const functions: string[] = [];
    const classes: string[] = [];
    const files: string[] = [];
    const modules: string[] = [];
    const keywords: string[] = [];
    const variables: string[] = [];

    // Extract function names (camelCase or snake_case followed by parentheses)
    const functionPattern = /\b([a-z][a-zA-Z0-9_]*)\s*\(/g;
    let match;
    while ((match = functionPattern.exec(request)) !== null) {
      if (!this.isCommonWord(match[1])) {
        functions.push(match[1]);
      }
    }

    // Extract class names (PascalCase)
    const classPattern = /\b([A-Z][a-zA-Z0-9]+)(?:\s+class|\s+interface|\s+type|\b)/g;
    while ((match = classPattern.exec(request)) !== null) {
      if (!this.isCommonWord(match[1])) {
        classes.push(match[1]);
      }
    }

    // Extract file paths
    const filePattern = /(?:\/[\w.-]+)+(?:\.\w+)?|\b[\w.-]+\.(?:ts|tsx|js|jsx|md|json)\b/g;
    while ((match = filePattern.exec(request)) !== null) {
      files.push(match[0]);
    }

    // Extract module/package names
    const modulePattern = /@[\w-]+\/[\w-]+|(?:from|import)\s+['"]([^'"]+)['"]/g;
    while ((match = modulePattern.exec(request)) !== null) {
      modules.push(match[1] || match[0]);
    }

    // Extract quoted strings as potential keywords
    const quotedPattern = /['"`]([^'"`]+)['"`]/g;
    while ((match = quotedPattern.exec(request)) !== null) {
      const keyword = match[1].trim();
      if (keyword.length > 2 && keyword.length < 50) {
        keywords.push(keyword);
      }
    }

    // Extract variable-like identifiers (camelCase or snake_case)
    const variablePattern = /\b([a-z][a-zA-Z0-9_]{2,})\b/g;
    while ((match = variablePattern.exec(request)) !== null) {
      if (
        !this.isCommonWord(match[1]) &&
        !functions.includes(match[1]) &&
        !keywords.includes(match[1])
      ) {
        variables.push(match[1]);
      }
    }

    return {
      functions: [...new Set(functions)],
      classes: [...new Set(classes)],
      files: [...new Set(files)],
      modules: [...new Set(modules)],
      keywords: [...new Set(keywords)],
      variables: [...new Set(variables)].slice(0, 10), // Limit variables
    };
  }

  /**
   * Check if a word is a common English word
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall',
      'this', 'that', 'these', 'those', 'what', 'which', 'who',
      'how', 'when', 'where', 'why', 'all', 'each', 'every',
      'any', 'some', 'many', 'much', 'more', 'most', 'other',
      'new', 'old', 'first', 'last', 'long', 'great', 'little',
      'own', 'same', 'right', 'big', 'high', 'different', 'small',
      'large', 'next', 'early', 'young', 'important', 'few', 'public',
      'bad', 'possible', 'late', 'general', 'full', 'special', 'free',
      'clear', 'sure', 'true', 'false', 'null', 'undefined',
      'get', 'set', 'add', 'remove', 'update', 'delete', 'create',
      'find', 'show', 'list', 'check', 'test', 'run', 'start', 'stop',
      'use', 'using', 'used', 'make', 'making', 'made',
    ]);
    return commonWords.has(word.toLowerCase());
  }

  /**
   * Calculate confidence score based on pattern matches
   */
  private calculateConfidence(
    questionMatches: PatternMatch[],
    actionMatches: PatternMatch[],
    complexityMatches: PatternMatch[]
  ): number {
    const weights = this.config.priority.patternWeights;
    let confidence = 0;

    // Calculate weighted score for each type
    if (questionMatches.length > 0) {
      const avgWeight =
        questionMatches.reduce((sum, m) => sum + m.confidence, 0) /
        questionMatches.length;
      confidence += avgWeight * weights.question;
    }

    if (actionMatches.length > 0) {
      const avgWeight =
        actionMatches.reduce((sum, m) => sum + m.confidence, 0) /
        actionMatches.length;
      confidence += avgWeight * weights.action;
    }

    if (complexityMatches.length > 0) {
      const avgWeight =
        complexityMatches.reduce((sum, m) => sum + m.confidence, 0) /
        complexityMatches.length;
      confidence += avgWeight * weights.complexity;
    }

    // Apply multi-match boost
    const totalMatches =
      questionMatches.length + actionMatches.length + complexityMatches.length;
    if (totalMatches > 1) {
      confidence += this.config.priority.multiMatchBoost * Math.min(totalMatches - 1, 3);
    }

    // Normalize to 0-1 range
    return Math.min(confidence, 1);
  }

  /**
   * Determine the context goal based on matches and entities
   */
  private determineContextGoal(
    matches: PatternMatch[],
    entities: RequestEntities
  ): ContextGoal {
    // Count goal suggestions from matches
    const goalCounts = new Map<ContextGoal, number>();

    // Get suggested goals from matching patterns
    for (const match of matches) {
      const pattern = this.findPatternById(match.pattern);
      if (pattern) {
        const current = goalCounts.get(pattern.suggestedGoal) || 0;
        goalCounts.set(pattern.suggestedGoal, current + match.confidence);
      }
    }

    // Find the goal with highest score
    let bestGoal: ContextGoal = 'understanding';
    let bestScore = 0;

    for (const [goal, score] of goalCounts) {
      if (score > bestScore) {
        bestScore = score;
        bestGoal = goal;
      }
    }

    // Apply heuristics based on entities
    if (entities.files.length > 0 && goalCounts.size === 0) {
      return 'understanding';
    }

    return bestGoal;
  }

  /**
   * Find a pattern by its ID
   */
  private findPatternById(id: string): TriggerPattern | undefined {
    const allPatterns = [
      ...this.config.questionPatterns,
      ...this.config.actionPatterns,
      ...this.config.complexityPatterns,
    ];
    return allPatterns.find(p => p.id === id);
  }

  /**
   * Generate RAG queries from matches and entities
   */
  private generateQueries(
    matches: PatternMatch[],
    entities: RequestEntities,
    request: string
  ): GeneratedQuery[] {
    const queries: GeneratedQuery[] = [];
    const seenQueries = new Set<string>();

    // Generate queries from pattern templates
    for (const match of matches) {
      const pattern = this.findPatternById(match.pattern);
      if (pattern?.queryTemplates) {
        for (const template of pattern.queryTemplates) {
          const query = this.expandQueryTemplate(template, match.match, entities);
          if (query && !seenQueries.has(query.toLowerCase())) {
            seenQueries.add(query.toLowerCase());
            queries.push({
              query,
              weight: match.confidence,
              category: pattern.type,
              sourcePattern: pattern.id,
            });
          }
        }
      }
    }

    // Generate queries from entities
    for (const func of entities.functions.slice(0, 3)) {
      const query = `function ${func} implementation`;
      if (!seenQueries.has(query.toLowerCase())) {
        seenQueries.add(query.toLowerCase());
        queries.push({
          query,
          weight: 0.7,
          category: 'entity',
        });
      }
    }

    for (const cls of entities.classes.slice(0, 2)) {
      const query = `class ${cls} definition`;
      if (!seenQueries.has(query.toLowerCase())) {
        seenQueries.add(query.toLowerCase());
        queries.push({
          query,
          weight: 0.7,
          category: 'entity',
        });
      }
    }

    for (const keyword of entities.keywords.slice(0, 2)) {
      if (!seenQueries.has(keyword.toLowerCase())) {
        seenQueries.add(keyword.toLowerCase());
        queries.push({
          query: keyword,
          weight: 0.6,
          category: 'keyword',
        });
      }
    }

    // If no queries generated, use cleaned request as fallback
    if (queries.length === 0) {
      const cleanedRequest = this.cleanRequestForQuery(request);
      if (cleanedRequest) {
        queries.push({
          query: cleanedRequest,
          weight: 0.5,
          category: 'fallback',
        });
      }
    }

    // Sort by weight and limit
    return queries
      .sort((a, b) => b.weight - a.weight)
      .slice(0, this.config.priority.maxQueries);
  }

  /**
   * Expand a query template with captured values
   */
  private expandQueryTemplate(
    template: string,
    matchedText: string,
    entities: RequestEntities
  ): string | null {
    let query = template;

    // Replace $1 with first captured group or cleaned match
    if (template.includes('$1')) {
      // Extract the meaningful part from the match
      const cleaned = this.extractMeaningfulPart(matchedText);
      if (!cleaned) {
        return null;
      }
      query = query.replace('$1', cleaned);
    }

    // Replace entity placeholders
    if (template.includes('$function') && entities.functions.length > 0) {
      query = query.replace('$function', entities.functions[0]);
    }
    if (template.includes('$class') && entities.classes.length > 0) {
      query = query.replace('$class', entities.classes[0]);
    }

    // Clean up the query
    query = query.trim().replace(/\s+/g, ' ');

    // Validate query length
    if (query.length < 3 || query.length > 200) {
      return null;
    }

    return query;
  }

  /**
   * Extract the meaningful part from a regex match
   */
  private extractMeaningfulPart(text: string): string | null {
    // Remove common question prefixes
    let cleaned = text
      .replace(/^(?:where\s+is|how\s+does|what\s+is|find\s+all)\s+/i, '')
      .replace(/\s+(?:implemented|defined|work|located)\s*$/i, '')
      .replace(/\s+(?:the|a|an)\s+/gi, ' ')
      .trim();

    if (cleaned.length < 2) {
      return null;
    }

    return cleaned;
  }

  /**
   * Clean request text to use as a fallback query
   */
  private cleanRequestForQuery(request: string): string | null {
    // Remove question words and common filler
    let cleaned = request
      .replace(/^(?:please|can\s+you|could\s+you|would\s+you)\s+/i, '')
      .replace(/\?+$/g, '')
      .trim();

    // Truncate if too long
    if (cleaned.length > 100) {
      cleaned = cleaned.substring(0, 100).replace(/\s+\S*$/, '');
    }

    if (cleaned.length < 5) {
      return null;
    }

    return cleaned;
  }

  /**
   * Generate suggested file patterns based on entities
   */
  private generateSuggestedPatterns(entities: RequestEntities): string[] {
    const patterns: string[] = [];

    // Add patterns for specific files mentioned
    for (const file of entities.files) {
      if (file.includes('/')) {
        patterns.push(`**/${file}`);
      } else {
        patterns.push(`**/*${file}*`);
      }
    }

    // Add patterns based on class names (likely file names)
    for (const cls of entities.classes) {
      const kebabCase = cls.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      patterns.push(`**/*${kebabCase}*`);
      patterns.push(`**/*${cls}*`);
    }

    return [...new Set(patterns)].slice(0, 5);
  }

  /**
   * Generate reasoning explanation for the analysis
   */
  private generateReasoning(
    shouldEnhance: boolean,
    confidence: number,
    matches: PatternMatch[],
    goal: ContextGoal
  ): string {
    if (!shouldEnhance) {
      return `RAG enhancement not recommended (confidence: ${(confidence * 100).toFixed(1)}%). ` +
        `Request does not strongly indicate need for codebase context.`;
    }

    const matchTypes = new Set(matches.map(m => m.type));
    const typesList = Array.from(matchTypes).join(', ');

    return `RAG enhancement recommended (confidence: ${(confidence * 100).toFixed(1)}%). ` +
      `Detected ${matches.length} pattern match(es) of type(s): ${typesList}. ` +
      `Context goal: ${goal}.`;
  }

  /**
   * Check if a request matches any trigger pattern
   *
   * @param request - The request text to check
   * @returns True if any pattern matches
   */
  public matchesAnyPattern(request: string): boolean {
    const normalizedRequest = this.normalizeRequest(request);

    const allPatterns = [
      ...this.config.questionPatterns,
      ...this.config.actionPatterns,
      ...this.config.complexityPatterns,
    ];

    return allPatterns.some(pattern => pattern.pattern.test(normalizedRequest));
  }

  /**
   * Get the current configuration
   */
  public getConfig(): RagContextHookConfig {
    return this.config;
  }
}

export default RequestAnalyzer;
