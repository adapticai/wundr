import { EventEmitter } from 'events';

import { logger } from '../utils/logger';

import type { ClaudeClient, ClaudeMessage } from '../ai/claude-client';

/**
 * Intent classification result
 */
export interface IntentResult {
  intent: string;
  confidence: number;
  command?: string;
  parameters?: Record<string, any>;
  clarification?: string;
  alternatives?: Array<{
    command: string;
    confidence: number;
    description: string;
  }>;
  reasoning?: string;
  context?: {
    entities: Entity[];
    keywords: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
  };
}

/**
 * Named entity recognition result
 */
export interface Entity {
  text: string;
  type:
    | 'file_path'
    | 'package_name'
    | 'command'
    | 'option'
    | 'value'
    | 'technology';
  confidence: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Command pattern for intent matching
 */
export interface CommandPattern {
  intent: string;
  patterns: string[];
  parameters: ParameterPattern[];
  examples: string[];
  category: string;
  destructive?: boolean;
}

/**
 * Parameter extraction pattern
 */
export interface ParameterPattern {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'path' | 'enum';
  required: boolean;
  aliases?: string[];
  validation?: RegExp;
  enumValues?: string[];
  defaultValue?: any;
}

/**
 * Context for intent analysis
 */
export interface IntentContext {
  projectType?: string;
  recentCommands?: string[];
  workingDirectory?: string;
  gitStatus?: string;
  conversationHistory?: ClaudeMessage[];
  userPreferences?: Record<string, any>;
}

/**
 * Intent parser configuration
 */
export interface IntentParserConfig {
  confidenceThreshold: number;
  maxAlternatives: number;
  enableNER: boolean;
  enableContextAwareness: boolean;
  cacheDuration: number; // milliseconds
}

/**
 * Advanced NLP Intent Parser for converting natural language to CLI commands
 */
export class IntentParser extends EventEmitter {
  private claudeClient: ClaudeClient;
  private config: IntentParserConfig;
  private commandPatterns: Map<string, CommandPattern>;
  private intentCache: Map<string, { result: IntentResult; timestamp: number }>;
  private entityPatterns: Map<string, RegExp>;

  constructor(
    claudeClient: ClaudeClient,
    config: Partial<IntentParserConfig> = {},
  ) {
    super();

    this.claudeClient = claudeClient;
    this.config = {
      confidenceThreshold: 0.7,
      maxAlternatives: 3,
      enableNER: true,
      enableContextAwareness: true,
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      ...config,
    };

    this.commandPatterns = new Map();
    this.intentCache = new Map();
    this.entityPatterns = new Map();

    this.initializePatterns();
    this.initializeEntityRecognition();
  }

  /**
   * Parse natural language input and extract intent
   */
  async parseIntent(
    input: string,
    availableCommands: string[],
    context: IntentContext = {},
  ): Promise<IntentResult> {
    const normalizedInput = this.normalizeInput(input);
    const cacheKey = this.getCacheKey(
      normalizedInput,
      availableCommands,
      context,
    );

    // Check cache first
    const cached = this.intentCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.cacheDuration) {
      logger.debug('Returning cached intent result');
      return cached.result;
    }

    try {
      // Step 1: Quick pattern matching for common commands
      const patternResult = await this.patternMatching(
        normalizedInput,
        availableCommands,
      );
      if (patternResult.confidence >= 0.9) {
        this.cacheResult(cacheKey, patternResult);
        return patternResult;
      }

      // Step 2: Named Entity Recognition
      const entities = this.config.enableNER
        ? await this.extractEntities(normalizedInput)
        : [];

      // Step 3: AI-powered intent analysis
      const aiResult = await this.aiIntentAnalysis(
        normalizedInput,
        availableCommands,
        context,
        entities,
      );

      // Step 4: Combine results and validate
      const finalResult = this.combineResults(
        patternResult,
        aiResult,
        entities,
      );

      // Step 5: Post-processing and validation
      const validatedResult = await this.validateAndEnrich(
        finalResult,
        availableCommands,
        context,
      );

      this.cacheResult(cacheKey, validatedResult);
      this.emit('intent_parsed', {
        input: normalizedInput,
        result: validatedResult,
      });

      return validatedResult;
    } catch (error) {
      logger.error('Intent parsing failed:', error);
      return this.fallbackIntentParsing(
        normalizedInput,
        availableCommands,
        context,
      );
    }
  }

  /**
   * Extract command parameters from natural language
   */
  async extractParameters(
    input: string,
    command: string,
    commandPattern?: CommandPattern,
  ): Promise<Record<string, any>> {
    const parameters: Record<string, any> = {};

    if (!commandPattern) {
      commandPattern = this.commandPatterns.get(command);
    }

    if (!commandPattern) {
      logger.debug(`No pattern found for command: ${command}`);
      return parameters;
    }

    // Extract using AI
    const systemPrompt = `You are a parameter extraction system. Extract parameters from user input for the command "${command}".

Command parameters:
${commandPattern.parameters.map(p => `- ${p.name} (${p.type}${p.required ? ', required' : ', optional'}): ${p.aliases?.join(', ') || ''}`).join('\n')}

Extract parameters from the user input and respond with JSON only:
{
  "parameters": {
    "paramName": "value"
  },
  "confidence": 0.9
}`;

    try {
      const response = await this.claudeClient.sendMessage(
        input,
        systemPrompt,
        {
          temperature: 0.1,
          maxTokens: 1024,
        },
      );

      const result = JSON.parse(response.trim());

      // Validate extracted parameters
      for (const param of commandPattern.parameters) {
        if (param.required && !result.parameters[param.name]) {
          logger.warn(`Missing required parameter: ${param.name}`);
        }

        if (result.parameters[param.name] && param.validation) {
          if (!param.validation.test(result.parameters[param.name])) {
            logger.warn(
              `Parameter validation failed for ${param.name}: ${result.parameters[param.name]}`,
            );
            delete result.parameters[param.name];
          }
        }

        // Apply default values
        if (
          !result.parameters[param.name] &&
          param.defaultValue !== undefined
        ) {
          result.parameters[param.name] = param.defaultValue;
        }
      }

      return result.parameters;
    } catch (error) {
      logger.error('Parameter extraction failed:', error);
      return this.fallbackParameterExtraction(input, commandPattern);
    }
  }

  /**
   * Suggest commands based on partial input
   */
  async suggestCommands(
    partialInput: string,
    availableCommands: string[],
    context: IntentContext = {},
    limit: number = 5,
  ): Promise<
    Array<{
      command: string;
      description: string;
      confidence: number;
      completion: string;
    }>
  > {
    const suggestions: Array<{
      command: string;
      description: string;
      confidence: number;
      completion: string;
    }> = [];

    // Pattern-based suggestions
    const patternSuggestions = this.getPatternSuggestions(
      partialInput,
      availableCommands,
    );
    suggestions.push(...patternSuggestions);

    // AI-powered suggestions if we need more
    if (suggestions.length < limit) {
      try {
        const aiSuggestions = await this.getAISuggestions(
          partialInput,
          availableCommands,
          context,
          limit - suggestions.length,
        );
        suggestions.push(...aiSuggestions);
      } catch (error) {
        logger.error('AI suggestions failed:', error);
      }
    }

    // Sort by confidence and limit results
    suggestions.sort((a, b) => b.confidence - a.confidence);
    return suggestions.slice(0, limit);
  }

  /**
   * Register a custom command pattern
   */
  registerCommandPattern(pattern: CommandPattern): void {
    this.commandPatterns.set(pattern.intent, pattern);
    logger.debug(`Registered command pattern: ${pattern.intent}`);
  }

  /**
   * Batch register multiple command patterns
   */
  registerCommandPatterns(patterns: CommandPattern[]): void {
    patterns.forEach(pattern => this.registerCommandPattern(pattern));
  }

  /**
   * Get registered command patterns
   */
  getCommandPatterns(): CommandPattern[] {
    return Array.from(this.commandPatterns.values());
  }

  /**
   * Clear intent cache
   */
  clearCache(): void {
    this.intentCache.clear();
    this.emit('cache_cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: Date | null;
  } {
    const now = Date.now();
    const validEntries = Array.from(this.intentCache.values()).filter(
      entry => now - entry.timestamp < this.config.cacheDuration,
    );

    const oldestEntry =
      validEntries.length > 0
        ? new Date(Math.min(...validEntries.map(e => e.timestamp)))
        : null;

    return {
      size: validEntries.length,
      hitRate:
        this.intentCache.size > 0
          ? validEntries.length / this.intentCache.size
          : 0,
      oldestEntry,
    };
  }

  // Private methods

  private initializePatterns(): void {
    const defaultPatterns: CommandPattern[] = [
      {
        intent: 'analyze',
        patterns: [
          'analyze {path?}',
          'check {path?}',
          'scan {path?}',
          'examine {path?}',
          'review {path?}',
        ],
        parameters: [
          { name: 'path', type: 'path', required: false, defaultValue: '.' },
          {
            name: 'focus',
            type: 'enum',
            required: false,
            enumValues: ['dependencies', 'quality', 'security', 'performance'],
          },
          {
            name: 'format',
            type: 'enum',
            required: false,
            enumValues: ['json', 'table', 'csv'],
          },
        ],
        examples: [
          'analyze the project',
          'check dependencies in src folder',
          'scan for security issues',
        ],
        category: 'analysis',
      },
      {
        intent: 'create',
        patterns: [
          'create {type} {name}',
          'new {type} {name}',
          'generate {type} {name}',
          'make {type} {name}',
        ],
        parameters: [
          {
            name: 'type',
            type: 'enum',
            required: true,
            enumValues: ['component', 'service', 'test', 'config'],
          },
          { name: 'name', type: 'string', required: true },
          { name: 'template', type: 'string', required: false },
        ],
        examples: [
          'create component UserProfile',
          'new service AuthService',
          'generate test for UserService',
        ],
        category: 'generation',
      },
      {
        intent: 'init',
        patterns: [
          'init {project?}',
          'initialize {project?}',
          'setup {project?}',
          'configure {project?}',
        ],
        parameters: [
          { name: 'project', type: 'string', required: false },
          { name: 'template', type: 'string', required: false },
          { name: 'force', type: 'boolean', required: false },
        ],
        examples: [
          'init new project',
          'initialize with React template',
          'setup the workspace',
        ],
        category: 'setup',
      },
      {
        intent: 'help',
        patterns: [
          'help {command?}',
          'how {action?}',
          'what {question?}',
          'explain {topic?}',
        ],
        parameters: [
          { name: 'command', type: 'string', required: false },
          { name: 'topic', type: 'string', required: false },
        ],
        examples: [
          'help with analyze command',
          'how to create components',
          'what does this do',
        ],
        category: 'help',
      },
      {
        intent: 'dashboard',
        patterns: [
          'dashboard',
          'ui',
          'interface',
          'show {view?}',
          'open {view?}',
        ],
        parameters: [
          {
            name: 'view',
            type: 'enum',
            required: false,
            enumValues: ['overview', 'metrics', 'reports'],
          },
          { name: 'port', type: 'number', required: false, defaultValue: 3000 },
        ],
        examples: ['open dashboard', 'show metrics view', 'start ui'],
        category: 'interface',
      },
    ];

    defaultPatterns.forEach(pattern => this.registerCommandPattern(pattern));
  }

  private initializeEntityRecognition(): void {
    this.entityPatterns.set('file_path', /(?:\.\/|\/|~\/)[^\s]+/g);
    this.entityPatterns.set(
      'package_name',
      /(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*/g,
    );
    this.entityPatterns.set(
      'command',
      /(?:wundr\s+)?(?:analyze|create|init|help|dashboard|batch|watch)\b/g,
    );
    this.entityPatterns.set('option', /--?[a-zA-Z][a-zA-Z0-9-]*/g);
    this.entityPatterns.set(
      'technology',
      /\b(?:react|angular|vue|nodejs|typescript|javascript|python|java|docker|kubernetes)\b/gi,
    );
  }

  private normalizeInput(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^\w\s\-\.\/]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private getCacheKey(
    input: string,
    commands: string[],
    context: IntentContext,
  ): string {
    const contextKey = JSON.stringify({
      projectType: context.projectType,
      workingDirectory: context.workingDirectory,
      recentCommands: context.recentCommands?.slice(0, 3), // Only recent commands for cache key
    });

    return `${input}:${commands.sort().join(',')}:${contextKey}`;
  }

  private async patternMatching(
    input: string,
    availableCommands: string[],
  ): Promise<IntentResult> {
    let bestMatch: IntentResult = {
      intent: 'unknown',
      confidence: 0,
      context: { entities: [], keywords: [], sentiment: 'neutral' },
    };

    for (const [intent, pattern] of this.commandPatterns) {
      if (!availableCommands.includes(intent)) {
continue;
}

      const confidence = this.calculatePatternScore(input, pattern);

      if (confidence > bestMatch.confidence) {
        bestMatch = {
          intent,
          confidence,
          command: `wundr ${intent}`,
          parameters: {},
          reasoning: `Pattern match for "${intent}" command`,
          context: { entities: [], keywords: [], sentiment: 'neutral' },
        };
      }
    }

    return bestMatch;
  }

  private calculatePatternScore(
    input: string,
    pattern: CommandPattern,
  ): number {
    let score = 0;
    let totalWeight = 0;

    // Check pattern matches
    for (const patternStr of pattern.patterns) {
      const patternWords = patternStr.toLowerCase().split(/\s+/);
      const inputWords = input.split(/\s+/);

      let matchCount = 0;
      for (const word of patternWords) {
        if (word.startsWith('{') && word.endsWith('}')) {
continue;
} // Skip parameters
        if (inputWords.includes(word)) {
          matchCount++;
        }
      }

      const patternScore =
        matchCount / patternWords.filter(w => !w.startsWith('{')).length;
      score = Math.max(score, patternScore);
    }

    totalWeight += 0.6;

    // Check examples
    let exampleScore = 0;
    for (const example of pattern.examples) {
      const similarity = this.calculateStringSimilarity(
        input,
        example.toLowerCase(),
      );
      exampleScore = Math.max(exampleScore, similarity);
    }

    score += exampleScore * 0.4;
    totalWeight += 0.4;

    return score / totalWeight;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);

    let matches = 0;
    for (const word1 of words1) {
      if (words2.includes(word1)) {
        matches++;
      }
    }

    return matches / Math.max(words1.length, words2.length);
  }

  private async extractEntities(input: string): Promise<Entity[]> {
    const entities: Entity[] = [];

    for (const [type, pattern] of this.entityPatterns) {
      const matches = Array.from(input.matchAll(pattern));

      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            text: match[0],
            type: type as any,
            confidence: 0.8, // Static confidence for regex patterns
            startIndex: match.index,
            endIndex: match.index + match[0].length,
          });
        }
      }
    }

    return entities;
  }

  private async aiIntentAnalysis(
    input: string,
    availableCommands: string[],
    context: IntentContext,
    entities: Entity[],
  ): Promise<IntentResult> {
    const contextInfo = this.buildContextInfo(context);
    const entityInfo =
      entities.length > 0
        ? `\nDetected entities: ${entities.map(e => `${e.text} (${e.type})`).join(', ')}`
        : '';

    const systemPrompt = `You are an expert CLI intent analyzer. Analyze user input and map it to appropriate commands.

Available commands: ${availableCommands.join(', ')}
${contextInfo}${entityInfo}

User input: "${input}"

Analyze and respond with JSON only:
{
  "intent": "command_name",
  "confidence": 0.95,
  "command": "wundr analyze --path ./src",
  "parameters": {"path": "./src"},
  "alternatives": [
    {"command": "wundr scan", "confidence": 0.7, "description": "Alternative interpretation"}
  ],
  "reasoning": "User wants to analyze source code based on path mention",
  "clarification": null
}`;

    try {
      const response = await this.claudeClient.sendMessage(
        input,
        systemPrompt,
        {
          temperature: 0.1,
          maxTokens: 1536,
        },
      );

      const cleanResponse = response.trim();
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No valid JSON in AI response');
      }

      const result = JSON.parse(jsonMatch[0]);

      // Add context information
      result.context = {
        entities,
        keywords: this.extractKeywords(input),
        sentiment: this.analyzeSentiment(input),
      };

      return result;
    } catch (error) {
      logger.error('AI intent analysis failed:', error);
      throw error;
    }
  }

  private buildContextInfo(context: IntentContext): string {
    const parts: string[] = [];

    if (context.projectType) {
      parts.push(`Project type: ${context.projectType}`);
    }

    if (context.recentCommands?.length) {
      parts.push(
        `Recent commands: ${context.recentCommands.slice(0, 3).join(', ')}`,
      );
    }

    if (context.workingDirectory) {
      parts.push(`Working directory: ${context.workingDirectory}`);
    }

    return parts.length > 0 ? `\nContext: ${parts.join(', ')}` : '';
  }

  private combineResults(
    patternResult: IntentResult,
    aiResult: IntentResult,
    entities: Entity[],
  ): IntentResult {
    // Use AI result as base, but boost confidence if pattern matching agrees
    let finalResult = { ...aiResult };

    if (patternResult.intent === aiResult.intent) {
      finalResult.confidence = Math.min(0.98, aiResult.confidence + 0.1);
      finalResult.reasoning += ' (confirmed by pattern matching)';
    } else if (patternResult.confidence > 0.8) {
      // High-confidence pattern match might override AI
      if (patternResult.confidence > aiResult.confidence) {
        finalResult = patternResult;
        finalResult.reasoning += ' (overridden by high-confidence pattern match)';
      }
    }

    // Ensure entities are included
    if (finalResult.context) {
      finalResult.context.entities = entities;
    }

    return finalResult;
  }

  private async validateAndEnrich(
    result: IntentResult,
    availableCommands: string[],
    context: IntentContext,
  ): Promise<IntentResult> {
    // Validate that the intent command is available
    if (!availableCommands.includes(result.intent)) {
      logger.warn(`Intent "${result.intent}" not in available commands`);
      result.confidence *= 0.5;
      result.clarification = `The command "${result.intent}" is not available. Did you mean one of: ${availableCommands.join(', ')}?`;
    }

    // Add safety warnings for destructive commands
    const commandPattern = this.commandPatterns.get(result.intent);
    if (commandPattern?.destructive) {
      result.clarification = 'This is a destructive operation. Are you sure you want to proceed?';
    }

    // Enrich with context-aware suggestions
    if (result.confidence < this.config.confidenceThreshold) {
      result.alternatives = await this.getContextualAlternatives(
        result,
        availableCommands,
        context,
      );
    }

    return result;
  }

  private async getContextualAlternatives(
    result: IntentResult,
    availableCommands: string[],
    context: IntentContext,
  ): Promise<IntentResult['alternatives']> {
    const alternatives: NonNullable<IntentResult['alternatives']> = [];

    // Add pattern-based alternatives
    for (const command of availableCommands) {
      if (command !== result.intent) {
        const pattern = this.commandPatterns.get(command);
        if (pattern) {
          const confidence = this.calculatePatternScore(
            result.command || '',
            pattern,
          );
          if (confidence > 0.3) {
            alternatives.push({
              command: `wundr ${command}`,
              confidence,
              description: `Alternative: ${pattern.examples[0] || command}`,
            });
          }
        }
      }
    }

    // Sort and limit alternatives
    alternatives.sort((a, b) => b.confidence - a.confidence);
    return alternatives.slice(0, this.config.maxAlternatives);
  }

  private fallbackIntentParsing(
    input: string,
    availableCommands: string[],
    context: IntentContext,
  ): IntentResult {
    // Simple keyword matching as last resort
    const keywords = input.split(/\s+/);
    const bestMatch = 'help';
    const bestScore = 0;

    for (const command of availableCommands) {
      if (keywords.includes(command)) {
        return {
          intent: command,
          confidence: 0.6,
          command: `wundr ${command}`,
          parameters: {},
          reasoning: 'Fallback keyword matching',
          context: { entities: [], keywords, sentiment: 'neutral' },
        };
      }
    }

    return {
      intent: bestMatch,
      confidence: 0.3,
      command: `wundr ${bestMatch}`,
      parameters: {},
      clarification: `I couldn't understand "${input}". Type "help" to see available commands.`,
      reasoning: 'Fallback to help command',
      context: { entities: [], keywords, sentiment: 'neutral' },
    };
  }

  private fallbackParameterExtraction(
    input: string,
    pattern: CommandPattern,
  ): Record<string, any> {
    const parameters: Record<string, any> = {};
    const words = input.split(/\s+/);

    // Simple heuristic parameter extraction
    for (const param of pattern.parameters) {
      if (param.type === 'path') {
        const pathMatch = input.match(/(?:\.\/|\/|~\/)[^\s]+/);
        if (pathMatch) {
          parameters[param.name] = pathMatch[0];
        }
      } else if (param.type === 'boolean') {
        if (
          words.some(word =>
            ['yes', 'true', 'on', 'enable'].includes(word.toLowerCase()),
          )
        ) {
          parameters[param.name] = true;
        } else if (
          words.some(word =>
            ['no', 'false', 'off', 'disable'].includes(word.toLowerCase()),
          )
        ) {
          parameters[param.name] = false;
        }
      }

      // Apply default values
      if (!parameters[param.name] && param.defaultValue !== undefined) {
        parameters[param.name] = param.defaultValue;
      }
    }

    return parameters;
  }

  private getPatternSuggestions(
    partialInput: string,
    availableCommands: string[],
  ): Array<{
    command: string;
    description: string;
    confidence: number;
    completion: string;
  }> {
    const suggestions: Array<{
      command: string;
      description: string;
      confidence: number;
      completion: string;
    }> = [];

    for (const command of availableCommands) {
      const pattern = this.commandPatterns.get(command);
      if (!pattern) {
continue;
}

      // Check if partial input matches command or examples
      const confidence = Math.max(
        this.calculateStringSimilarity(partialInput, command),
        ...pattern.examples.map(ex =>
          this.calculateStringSimilarity(partialInput, ex),
        ),
      );

      if (confidence > 0.3) {
        suggestions.push({
          command: `wundr ${command}`,
          description: pattern.examples[0] || `Run ${command} command`,
          confidence,
          completion: pattern.examples[0] || `wundr ${command}`,
        });
      }
    }

    return suggestions;
  }

  private async getAISuggestions(
    partialInput: string,
    availableCommands: string[],
    context: IntentContext,
    limit: number,
  ): Promise<
    Array<{
      command: string;
      description: string;
      confidence: number;
      completion: string;
    }>
  > {
    const systemPrompt = `You are a CLI auto-completion assistant. Based on partial user input, suggest the most likely command completions.

Available commands: ${availableCommands.join(', ')}
Partial input: "${partialInput}"

Provide ${limit} suggestions in JSON format:
{
  "suggestions": [
    {
      "command": "wundr analyze",
      "description": "Analyze the project for issues",
      "confidence": 0.9,
      "completion": "wundr analyze --path ."
    }
  ]
}`;

    try {
      const response = await this.claudeClient.sendMessage('', systemPrompt, {
        temperature: 0.3,
        maxTokens: 1024,
      });

      const result = JSON.parse(response.trim());
      return result.suggestions || [];
    } catch (error) {
      logger.error('AI suggestions failed:', error);
      return [];
    }
  }

  private extractKeywords(input: string): string[] {
    // Simple keyword extraction
    const stopWords = [
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
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
    ];

    return input
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 10); // Limit to 10 keywords
  }

  private analyzeSentiment(input: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = [
      'good',
      'great',
      'excellent',
      'awesome',
      'perfect',
      'love',
      'like',
      'thanks',
      'help',
      'please',
    ];
    const negativeWords = [
      'bad',
      'terrible',
      'awful',
      'hate',
      'problem',
      'error',
      'issue',
      'broken',
      'fail',
      'wrong',
    ];

    const words = input.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word =>
      positiveWords.includes(word),
    ).length;
    const negativeCount = words.filter(word =>
      negativeWords.includes(word),
    ).length;

    if (positiveCount > negativeCount) {
return 'positive';
}
    if (negativeCount > positiveCount) {
return 'negative';
}
    return 'neutral';
  }

  private cacheResult(key: string, result: IntentResult): void {
    this.intentCache.set(key, {
      result,
      timestamp: Date.now(),
    });

    // Clean old entries periodically
    if (this.intentCache.size % 100 === 0) {
      this.cleanCache();
    }
  }

  private cleanCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.intentCache) {
      if (now - entry.timestamp > this.config.cacheDuration) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.intentCache.delete(key));

    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned ${expiredKeys.length} expired cache entries`);
    }
  }
}

export default IntentParser;
