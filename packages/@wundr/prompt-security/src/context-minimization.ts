import type {
  ContextSection,
  ContextSettings,
  SeparatedContext,
  TrustLevel,
} from './types';

/**
 * Default context settings
 */
const DEFAULT_CONTEXT_SETTINGS: ContextSettings = {
  enableSeparation: true,
  maxContextTokens: 8000,
  contextSeparator: '---CONTEXT_BOUNDARY---',
  trustedTags: ['system', 'verified', 'admin', 'internal'],
  untrustedTags: ['user', 'external', 'unverified', 'input'],
};

/**
 * Approximate tokens per character ratio for estimation
 */
const TOKENS_PER_CHAR = 0.25;

/**
 * ContextMinimizer separates trusted and untrusted content to prevent
 * prompt injection attacks from affecting system behavior.
 *
 * This pattern implements the principle of context minimization, where
 * untrusted content is isolated from system instructions and verified data.
 *
 * @example
 * ```typescript
 * const minimizer = new ContextMinimizer();
 *
 * // Add trusted system content
 * minimizer.addTrusted('You are a helpful assistant.', 'system-prompt', ['system']);
 *
 * // Add untrusted user input
 * minimizer.addUntrusted(userInput, 'user-query', ['user', 'external']);
 *
 * // Get separated context
 * const context = minimizer.getSeparatedContext();
 *
 * // Build safe prompt with clear boundaries
 * const safePrompt = minimizer.buildSafePrompt();
 * ```
 */
export class ContextMinimizer {
  private readonly settings: ContextSettings;
  private trustedSections: ContextSection[] = [];
  private untrustedSections: ContextSection[] = [];
  private sectionCounter = 0;

  /**
   * Creates a new ContextMinimizer instance
   *
   * @param settings - Context settings
   */
  constructor(settings: Partial<ContextSettings> = {}) {
    this.settings = { ...DEFAULT_CONTEXT_SETTINGS, ...settings };
  }

  /**
   * Adds trusted content to the context
   *
   * @param content - The content to add
   * @param source - Source identifier
   * @param tags - Tags for categorization
   * @param sanitized - Whether the content has been sanitized
   * @returns The section ID
   */
  addTrusted(
    content: string,
    source: string,
    tags: string[] = [],
    sanitized = false,
  ): string {
    const section = this.createSection(
      content,
      'trusted',
      source,
      tags,
      sanitized,
    );
    this.trustedSections.push(section);
    return section.id;
  }

  /**
   * Adds semi-trusted content to the context
   *
   * @param content - The content to add
   * @param source - Source identifier
   * @param tags - Tags for categorization
   * @param sanitized - Whether the content has been sanitized
   * @returns The section ID
   */
  addSemiTrusted(
    content: string,
    source: string,
    tags: string[] = [],
    sanitized = false,
  ): string {
    const section = this.createSection(
      content,
      'semi-trusted',
      source,
      tags,
      sanitized,
    );
    this.untrustedSections.push(section);
    return section.id;
  }

  /**
   * Adds untrusted content to the context
   *
   * @param content - The content to add
   * @param source - Source identifier
   * @param tags - Tags for categorization
   * @param sanitized - Whether the content has been sanitized
   * @returns The section ID
   */
  addUntrusted(
    content: string,
    source: string,
    tags: string[] = [],
    sanitized = false,
  ): string {
    const section = this.createSection(
      content,
      'untrusted',
      source,
      tags,
      sanitized,
    );
    this.untrustedSections.push(section);
    return section.id;
  }

  /**
   * Adds system-level content to the context
   *
   * @param content - The content to add
   * @param source - Source identifier
   * @param tags - Tags for categorization
   * @returns The section ID
   */
  addSystem(content: string, source: string, tags: string[] = []): string {
    const section = this.createSection(
      content,
      'system',
      source,
      [...tags, 'system'],
      true,
    );
    this.trustedSections.unshift(section); // System content goes first
    return section.id;
  }

  /**
   * Gets the separated context
   *
   * @returns The separated context with metadata
   */
  getSeparatedContext(): SeparatedContext {
    const warnings: string[] = [];
    const totalTokens = this.estimateTokens();

    if (totalTokens > this.settings.maxContextTokens) {
      warnings.push(
        `Context size (${totalTokens} tokens) exceeds maximum (${this.settings.maxContextTokens} tokens)`,
      );
    }

    const hasUnsanitizedUntrusted = this.untrustedSections.some(
      s => !s.sanitized,
    );
    if (hasUnsanitizedUntrusted) {
      warnings.push('Some untrusted sections have not been sanitized');
    }

    return {
      trusted: [...this.trustedSections],
      untrusted: [...this.untrustedSections],
      metadata: {
        totalSections:
          this.trustedSections.length + this.untrustedSections.length,
        trustedSections: this.trustedSections.length,
        untrustedSections: this.untrustedSections.length,
        approximateTokens: totalTokens,
        separatedAt: new Date(),
        warnings,
      },
    };
  }

  /**
   * Builds a safe prompt with clear context boundaries
   *
   * @param options - Options for building the prompt
   * @returns The constructed prompt with boundaries
   */
  buildSafePrompt(options: BuildPromptOptions = {}): string {
    const {
      trustedPrefix = '[SYSTEM INSTRUCTIONS - VERIFIED]',
      trustedSuffix = '[END SYSTEM INSTRUCTIONS]',
      untrustedPrefix = '[USER INPUT - UNVERIFIED]',
      untrustedSuffix = '[END USER INPUT]',
      includeWarnings = false,
    } = options;

    const parts: string[] = [];

    // Add trusted content
    if (this.trustedSections.length > 0) {
      parts.push(trustedPrefix);
      parts.push(this.settings.contextSeparator);

      for (const section of this.trustedSections) {
        parts.push(section.content);
        parts.push(this.settings.contextSeparator);
      }

      parts.push(trustedSuffix);
    }

    // Add separator between trusted and untrusted
    parts.push('');
    parts.push(this.settings.contextSeparator);
    parts.push('');

    // Add untrusted content
    if (this.untrustedSections.length > 0) {
      parts.push(untrustedPrefix);
      parts.push(this.settings.contextSeparator);

      for (const section of this.untrustedSections) {
        const sanitizedMarker = section.sanitized ? '[sanitized]' : '[raw]';
        parts.push(`${sanitizedMarker}`);
        parts.push(section.content);
        parts.push(this.settings.contextSeparator);
      }

      parts.push(untrustedSuffix);
    }

    // Add warnings if requested
    if (includeWarnings) {
      const context = this.getSeparatedContext();
      if (context.metadata.warnings.length > 0) {
        parts.push('');
        parts.push('[WARNINGS]');
        for (const warning of context.metadata.warnings) {
          parts.push(`- ${warning}`);
        }
      }
    }

    return parts.join('\n');
  }

  /**
   * Builds a minimal context for specific use cases
   *
   * @param maxTokens - Maximum tokens to include
   * @param prioritizeTrusted - Whether to prioritize trusted content
   * @returns Minimized context
   */
  buildMinimalContext(
    maxTokens: number,
    prioritizeTrusted = true,
  ): SeparatedContext {
    const minimized: SeparatedContext = {
      trusted: [],
      untrusted: [],
      metadata: {
        totalSections: 0,
        trustedSections: 0,
        untrustedSections: 0,
        approximateTokens: 0,
        separatedAt: new Date(),
        warnings: [],
      },
    };

    let remainingTokens = maxTokens;

    // Collect sections in priority order
    const orderedSections = prioritizeTrusted
      ? [...this.trustedSections, ...this.untrustedSections]
      : [...this.untrustedSections, ...this.trustedSections];

    for (const section of orderedSections) {
      const sectionTokens = this.estimateSectionTokens(section);

      if (sectionTokens <= remainingTokens) {
        if (
          section.trustLevel === 'trusted' ||
          section.trustLevel === 'system'
        ) {
          minimized.trusted.push(section);
        } else {
          minimized.untrusted.push(section);
        }
        remainingTokens -= sectionTokens;
      } else {
        // Try to include a truncated version
        const truncated = this.truncateSection(section, remainingTokens);
        if (truncated) {
          if (
            section.trustLevel === 'trusted' ||
            section.trustLevel === 'system'
          ) {
            minimized.trusted.push(truncated);
          } else {
            minimized.untrusted.push(truncated);
          }
          minimized.metadata.warnings.push(
            `Section "${section.id}" was truncated to fit token limit`,
          );
        }
        break;
      }
    }

    // Update metadata
    minimized.metadata.totalSections =
      minimized.trusted.length + minimized.untrusted.length;
    minimized.metadata.trustedSections = minimized.trusted.length;
    minimized.metadata.untrustedSections = minimized.untrusted.length;
    minimized.metadata.approximateTokens = maxTokens - remainingTokens;

    return minimized;
  }

  /**
   * Removes a section by ID
   *
   * @param sectionId - The ID of the section to remove
   * @returns True if the section was removed
   */
  removeSection(sectionId: string): boolean {
    let index = this.trustedSections.findIndex(s => s.id === sectionId);
    if (index !== -1) {
      this.trustedSections.splice(index, 1);
      return true;
    }

    index = this.untrustedSections.findIndex(s => s.id === sectionId);
    if (index !== -1) {
      this.untrustedSections.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Updates a section's content
   *
   * @param sectionId - The ID of the section to update
   * @param content - New content
   * @param sanitized - Whether the new content is sanitized
   * @returns True if the section was updated
   */
  updateSection(
    sectionId: string,
    content: string,
    sanitized?: boolean,
  ): boolean {
    const section =
      this.trustedSections.find(s => s.id === sectionId) ??
      this.untrustedSections.find(s => s.id === sectionId);

    if (section) {
      section.content = content;
      if (sanitized !== undefined) {
        section.sanitized = sanitized;
      }
      return true;
    }

    return false;
  }

  /**
   * Marks a section as sanitized
   *
   * @param sectionId - The ID of the section
   * @returns True if the section was found and marked
   */
  markSanitized(sectionId: string): boolean {
    const section =
      this.trustedSections.find(s => s.id === sectionId) ??
      this.untrustedSections.find(s => s.id === sectionId);

    if (section) {
      section.sanitized = true;
      return true;
    }

    return false;
  }

  /**
   * Clears all context
   */
  clear(): void {
    this.trustedSections = [];
    this.untrustedSections = [];
    this.sectionCounter = 0;
  }

  /**
   * Gets statistics about the current context
   *
   * @returns Context statistics
   */
  getStats(): ContextStats {
    const trustedChars = this.trustedSections.reduce(
      (sum, s) => sum + s.content.length,
      0,
    );
    const untrustedChars = this.untrustedSections.reduce(
      (sum, s) => sum + s.content.length,
      0,
    );

    return {
      trustedSections: this.trustedSections.length,
      untrustedSections: this.untrustedSections.length,
      trustedCharacters: trustedChars,
      untrustedCharacters: untrustedChars,
      estimatedTokens: this.estimateTokens(),
      maxTokens: this.settings.maxContextTokens,
      utilizationPercent:
        (this.estimateTokens() / this.settings.maxContextTokens) * 100,
    };
  }

  /**
   * Validates that the context is safe to use
   *
   * @returns Validation result
   */
  validate(): ContextValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for unsanitized untrusted content
    const unsanitizedCount = this.untrustedSections.filter(
      s => !s.sanitized,
    ).length;
    if (unsanitizedCount > 0) {
      errors.push(
        `${unsanitizedCount} untrusted section(s) have not been sanitized`,
      );
    }

    // Check token limits
    const tokens = this.estimateTokens();
    if (tokens > this.settings.maxContextTokens) {
      errors.push(
        `Context exceeds token limit: ${tokens} > ${this.settings.maxContextTokens}`,
      );
    } else if (tokens > this.settings.maxContextTokens * 0.9) {
      warnings.push(
        `Context is near token limit: ${tokens} / ${this.settings.maxContextTokens}`,
      );
    }

    // Check for empty trusted content
    if (this.trustedSections.length === 0) {
      warnings.push('No trusted content in context');
    }

    // Check for potential injection markers in untrusted content
    for (const section of this.untrustedSections) {
      if (this.containsInjectionMarkers(section.content)) {
        warnings.push(`Section "${section.id}" may contain injection markers`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private createSection(
    content: string,
    trustLevel: TrustLevel,
    source: string,
    tags: string[],
    sanitized: boolean,
  ): ContextSection {
    this.sectionCounter++;
    return {
      id: `section-${this.sectionCounter}`,
      content,
      trustLevel,
      source,
      tags,
      sanitized,
    };
  }

  private estimateTokens(): number {
    const totalChars =
      this.trustedSections.reduce((sum, s) => sum + s.content.length, 0) +
      this.untrustedSections.reduce((sum, s) => sum + s.content.length, 0);

    return Math.ceil(totalChars * TOKENS_PER_CHAR);
  }

  private estimateSectionTokens(section: ContextSection): number {
    return Math.ceil(section.content.length * TOKENS_PER_CHAR);
  }

  private truncateSection(
    section: ContextSection,
    maxTokens: number,
  ): ContextSection | null {
    const maxChars = Math.floor(maxTokens / TOKENS_PER_CHAR);

    if (maxChars < 50) {
      // Don't create tiny sections
      return null;
    }

    return {
      ...section,
      id: `${section.id}-truncated`,
      content: section.content.substring(0, maxChars) + '... [truncated]',
    };
  }

  private containsInjectionMarkers(content: string): boolean {
    const markers = [
      'ignore previous instructions',
      'disregard above',
      'new instructions:',
      'system:',
      'admin:',
      '[SYSTEM]',
      '[ADMIN]',
      '```system',
      'OVERRIDE:',
    ];

    const lowerContent = content.toLowerCase();
    return markers.some(marker => lowerContent.includes(marker.toLowerCase()));
  }
}

/**
 * Options for building safe prompts
 */
export interface BuildPromptOptions {
  /**
   * Prefix for trusted content section
   */
  trustedPrefix?: string;

  /**
   * Suffix for trusted content section
   */
  trustedSuffix?: string;

  /**
   * Prefix for untrusted content section
   */
  untrustedPrefix?: string;

  /**
   * Suffix for untrusted content section
   */
  untrustedSuffix?: string;

  /**
   * Whether to include warnings in the output
   */
  includeWarnings?: boolean;
}

/**
 * Statistics about context usage
 */
export interface ContextStats {
  /**
   * Number of trusted sections
   */
  trustedSections: number;

  /**
   * Number of untrusted sections
   */
  untrustedSections: number;

  /**
   * Total characters in trusted sections
   */
  trustedCharacters: number;

  /**
   * Total characters in untrusted sections
   */
  untrustedCharacters: number;

  /**
   * Estimated token count
   */
  estimatedTokens: number;

  /**
   * Maximum allowed tokens
   */
  maxTokens: number;

  /**
   * Utilization percentage
   */
  utilizationPercent: number;
}

/**
 * Result of context validation
 */
export interface ContextValidationResult {
  /**
   * Whether the context is valid
   */
  valid: boolean;

  /**
   * Validation errors
   */
  errors: string[];

  /**
   * Validation warnings
   */
  warnings: string[];
}

/**
 * Creates a separated context from raw inputs
 *
 * @param systemPrompt - The system prompt (trusted)
 * @param userInput - The user input (untrusted)
 * @param additionalContext - Additional context sections
 * @returns Separated context
 */
export function createSeparatedContext(
  systemPrompt: string,
  userInput: string,
  additionalContext: Array<{
    content: string;
    trusted: boolean;
    source: string;
  }> = [],
): SeparatedContext {
  const minimizer = new ContextMinimizer();

  minimizer.addSystem(systemPrompt, 'system-prompt');
  minimizer.addUntrusted(userInput, 'user-input', ['user', 'external']);

  for (const ctx of additionalContext) {
    if (ctx.trusted) {
      minimizer.addTrusted(ctx.content, ctx.source, ['additional']);
    } else {
      minimizer.addUntrusted(ctx.content, ctx.source, [
        'additional',
        'external',
      ]);
    }
  }

  return minimizer.getSeparatedContext();
}
