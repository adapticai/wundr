/**
 * @wundr.io/jit-tools - Context Injector
 *
 * Runtime tool injection into agent context.
 * Formats tools for agent consumption and manages context budget.
 */

import { EventEmitter } from 'eventemitter3';

import { DEFAULT_JIT_CONFIG } from './types';

import type { JITToolRetriever } from './tool-retriever';
import type {
  ToolSpec,
  ToolRetrievalResult,
  RetrievedTool,
  InjectionResult,
  ExcludedTool,
  AgentContext,
  JITToolConfig,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for context injection
 */
export interface InjectionOptions {
  /** Format style for tool descriptions */
  formatStyle: 'compact' | 'detailed' | 'xml' | 'json' | 'markdown';
  /** Include examples in context */
  includeExamples: boolean;
  /** Include parameter details */
  includeParameters: boolean;
  /** Maximum examples per tool */
  maxExamplesPerTool: number;
  /** Custom header for tool section */
  customHeader?: string;
  /** Custom footer for tool section */
  customFooter?: string;
  /** Group tools by category */
  groupByCategory: boolean;
  /** Sort order within groups */
  sortOrder: 'relevance' | 'alphabetical' | 'priority';
}

/**
 * Default injection options
 */
export const DEFAULT_INJECTION_OPTIONS: InjectionOptions = {
  formatStyle: 'markdown',
  includeExamples: true,
  includeParameters: true,
  maxExamplesPerTool: 2,
  groupByCategory: false,
  sortOrder: 'relevance',
};

/**
 * Formatted tool for injection
 */
export interface FormattedTool {
  tool: ToolSpec;
  formattedContent: string;
  tokenCount: number;
}

// =============================================================================
// ContextInjector Class
// =============================================================================

/**
 * Injects relevant tools into agent context at runtime.
 *
 * @example
 * ```typescript
 * const injector = new ContextInjector(retriever, config);
 *
 * // Inject tools for a query
 * const result = await injector.inject(
 *   'Help me review this pull request',
 *   agentContext,
 *   { formatStyle: 'markdown' }
 * );
 *
 * // Use the context string in agent prompt
 * const prompt = `${result.contextString}\n\nUser request: ...`;
 * ```
 */
export class ContextInjector extends EventEmitter {
  private retriever: JITToolRetriever;
  private config: JITToolConfig;
  private defaultOptions: InjectionOptions;

  /**
   * Creates a new ContextInjector instance
   *
   * @param retriever - Tool retriever for finding relevant tools
   * @param config - JIT configuration options
   * @param options - Default injection options
   */
  constructor(
    retriever: JITToolRetriever,
    config: Partial<JITToolConfig> = {},
    options: Partial<InjectionOptions> = {}
  ) {
    super();
    this.retriever = retriever;
    this.config = { ...DEFAULT_JIT_CONFIG, ...config };
    this.defaultOptions = { ...DEFAULT_INJECTION_OPTIONS, ...options };
  }

  // ===========================================================================
  // Main Injection Methods
  // ===========================================================================

  /**
   * Inject relevant tools into context for a query
   *
   * @param query - Natural language query
   * @param context - Agent context
   * @param options - Injection options
   * @returns Injection result with formatted context
   */
  async inject(
    query: string,
    context?: AgentContext,
    options: Partial<InjectionOptions> = {}
  ): Promise<InjectionResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    // Emit injection started event
    this.emit('injection:started', { query, context });

    try {
      // Retrieve relevant tools
      const retrievalResult = await this.retriever.retrieve(query, context);

      // Build injection result
      const result = this.buildInjectionResult(retrievalResult, mergedOptions);

      // Emit completion event
      this.emit('injection:completed', { result });

      return result;
    } catch (error) {
      this.emit('injection:error', { query, error });
      throw error;
    }
  }

  /**
   * Inject specific tools into context
   *
   * @param tools - Tools to inject
   * @param options - Injection options
   * @returns Injection result
   */
  injectTools(
    tools: ToolSpec[],
    options: Partial<InjectionOptions> = {}
  ): InjectionResult {
    const mergedOptions = { ...this.defaultOptions, ...options };

    // Convert to RetrievedTool format
    const retrievedTools: RetrievedTool[] = tools.map(tool => ({
      tool,
      relevanceScore: 1.0,
      semanticScore: 1.0,
      keywordScore: 1.0,
      permissionScore: 1.0,
      finalScore: 1.0,
      matchReasons: ['Directly specified'],
    }));

    // Build mock retrieval result
    const retrievalResult: ToolRetrievalResult = {
      tools: retrievedTools,
      totalMatches: tools.length,
      query: 'Direct injection',
      retrievalTimeMs: 0,
      totalTokenCost: tools.reduce((sum, t) => sum + t.tokenCost, 0),
      metadata: {
        toolsScanned: tools.length,
        filteredByPermissions: 0,
        filteredByScore: 0,
        usedSemanticSearch: false,
        cacheHit: false,
      },
    };

    return this.buildInjectionResult(retrievalResult, mergedOptions);
  }

  /**
   * Re-inject with updated context
   *
   * @param previousResult - Previous injection result
   * @param newContext - Updated agent context
   * @param options - Injection options
   * @returns New injection result
   */
  async reinject(
    previousResult: InjectionResult,
    newContext: AgentContext,
    options: Partial<InjectionOptions> = {}
  ): Promise<InjectionResult> {
    // Use the previous tools but reformat for new context
    const mergedOptions = { ...this.defaultOptions, ...options };

    const retrievedTools: RetrievedTool[] = previousResult.injectedTools.map(
      tool => ({
        tool,
        relevanceScore: 1.0,
        semanticScore: 1.0,
        keywordScore: 1.0,
        permissionScore: 1.0,
        finalScore: 1.0,
        matchReasons: ['Re-injected'],
      })
    );

    const retrievalResult: ToolRetrievalResult = {
      tools: retrievedTools,
      totalMatches: previousResult.injectedTools.length,
      query: 'Re-injection',
      retrievalTimeMs: 0,
      totalTokenCost: previousResult.tokensUsed,
      metadata: {
        toolsScanned: previousResult.injectedTools.length,
        filteredByPermissions: 0,
        filteredByScore: 0,
        usedSemanticSearch: false,
        cacheHit: false,
      },
    };

    return this.buildInjectionResult(retrievalResult, mergedOptions);
  }

  // ===========================================================================
  // Formatting Methods
  // ===========================================================================

  /**
   * Build injection result from retrieval result
   */
  private buildInjectionResult(
    retrievalResult: ToolRetrievalResult,
    options: InjectionOptions
  ): InjectionResult {
    const excludedTools: ExcludedTool[] = [];
    const includedTools: ToolSpec[] = [];

    // Apply budget constraints and track exclusions
    let remainingBudget = this.config.maxTokenBudget;
    let toolCount = 0;

    for (const { tool } of retrievalResult.tools) {
      if (toolCount >= this.config.maxTools) {
        excludedTools.push({
          tool,
          reason: 'max_tools_exceeded',
        });
        continue;
      }

      const formattedTool = this.formatTool(tool, options);

      if (remainingBudget - formattedTool.tokenCount < 0) {
        excludedTools.push({
          tool,
          reason: 'token_budget_exceeded',
        });
        continue;
      }

      includedTools.push(tool);
      remainingBudget -= formattedTool.tokenCount;
      toolCount++;
    }

    // Generate context string
    const contextString = this.generateContextString(includedTools, options);
    const tokensUsed = this.config.maxTokenBudget - remainingBudget;

    return {
      success: true,
      injectedTools: includedTools,
      tokensUsed,
      tokensRemaining: remainingBudget,
      excludedTools,
      contextString,
      timestamp: new Date(),
    };
  }

  /**
   * Format a single tool for context
   */
  private formatTool(tool: ToolSpec, options: InjectionOptions): FormattedTool {
    let content: string;

    switch (options.formatStyle) {
      case 'compact':
        content = this.formatCompact(tool, options);
        break;
      case 'detailed':
        content = this.formatDetailed(tool, options);
        break;
      case 'xml':
        content = this.formatXml(tool, options);
        break;
      case 'json':
        content = this.formatJson(tool, options);
        break;
      case 'markdown':
      default:
        content = this.formatMarkdown(tool, options);
        break;
    }

    // Estimate token count (rough approximation: 4 chars = 1 token)
    const tokenCount = Math.ceil(content.length / 4);

    return {
      tool,
      formattedContent: content,
      tokenCount,
    };
  }

  /**
   * Format tool in compact style
   */
  private formatCompact(tool: ToolSpec, options: InjectionOptions): string {
    let content = `${tool.name}: ${tool.description}`;

    if (options.includeParameters && tool.parameters.length > 0) {
      const params = tool.parameters
        .map(p => `${p.name}${p.required ? '*' : ''}`)
        .join(', ');
      content += ` (${params})`;
    }

    return content;
  }

  /**
   * Format tool in detailed style
   */
  private formatDetailed(tool: ToolSpec, options: InjectionOptions): string {
    const lines: string[] = [
      `Tool: ${tool.name}`,
      `ID: ${tool.id}`,
      `Category: ${tool.category}`,
      `Description: ${tool.description}`,
      `Capabilities: ${tool.capabilities.join(', ')}`,
    ];

    if (options.includeParameters && tool.parameters.length > 0) {
      lines.push('Parameters:');
      for (const param of tool.parameters) {
        lines.push(
          `  - ${param.name} (${param.type}${param.required ? ', required' : ''}): ${param.description}`
        );
      }
    }

    if (options.includeExamples && tool.examples.length > 0) {
      lines.push('Examples:');
      const examples = tool.examples.slice(0, options.maxExamplesPerTool);
      for (const example of examples) {
        lines.push(`  - ${example.description}`);
        lines.push(`    Input: ${JSON.stringify(example.input)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format tool in XML style
   */
  private formatXml(tool: ToolSpec, options: InjectionOptions): string {
    const lines: string[] = [
      `<tool id="${tool.id}" category="${tool.category}">`,
      `  <name>${tool.name}</name>`,
      `  <description>${this.escapeXml(tool.description)}</description>`,
      `  <capabilities>${tool.capabilities.join(', ')}</capabilities>`,
    ];

    if (options.includeParameters && tool.parameters.length > 0) {
      lines.push('  <parameters>');
      for (const param of tool.parameters) {
        lines.push(
          `    <param name="${param.name}" type="${param.type}" required="${param.required}">`
        );
        lines.push(`      ${this.escapeXml(param.description)}`);
        lines.push('    </param>');
      }
      lines.push('  </parameters>');
    }

    if (options.includeExamples && tool.examples.length > 0) {
      lines.push('  <examples>');
      const examples = tool.examples.slice(0, options.maxExamplesPerTool);
      for (const example of examples) {
        lines.push('    <example>');
        lines.push(
          `      <description>${this.escapeXml(example.description)}</description>`
        );
        lines.push(
          `      <input>${this.escapeXml(JSON.stringify(example.input))}</input>`
        );
        lines.push('    </example>');
      }
      lines.push('  </examples>');
    }

    lines.push('</tool>');

    return lines.join('\n');
  }

  /**
   * Format tool in JSON style
   */
  private formatJson(tool: ToolSpec, options: InjectionOptions): string {
    const obj: Record<string, unknown> = {
      id: tool.id,
      name: tool.name,
      category: tool.category,
      description: tool.description,
      capabilities: tool.capabilities,
    };

    if (options.includeParameters && tool.parameters.length > 0) {
      obj['parameters'] = tool.parameters.map(p => ({
        name: p.name,
        type: p.type,
        required: p.required,
        description: p.description,
      }));
    }

    if (options.includeExamples && tool.examples.length > 0) {
      obj['examples'] = tool.examples.slice(0, options.maxExamplesPerTool);
    }

    return JSON.stringify(obj, null, 2);
  }

  /**
   * Format tool in Markdown style
   */
  private formatMarkdown(tool: ToolSpec, options: InjectionOptions): string {
    const lines: string[] = [
      `### ${tool.name}`,
      '',
      tool.description,
      '',
      `**Category:** ${tool.category}`,
      `**Capabilities:** ${tool.capabilities.join(', ')}`,
    ];

    if (options.includeParameters && tool.parameters.length > 0) {
      lines.push('', '**Parameters:**');
      for (const param of tool.parameters) {
        const required = param.required ? ' *(required)*' : '';
        lines.push(
          `- \`${param.name}\` (${param.type})${required}: ${param.description}`
        );
      }
    }

    if (options.includeExamples && tool.examples.length > 0) {
      lines.push('', '**Examples:**');
      const examples = tool.examples.slice(0, options.maxExamplesPerTool);
      for (const example of examples) {
        lines.push(`- ${example.description}`);
        lines.push('  ```json');
        lines.push(`  ${JSON.stringify(example.input)}`);
        lines.push('  ```');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate the full context string from tools
   */
  private generateContextString(
    tools: ToolSpec[],
    options: InjectionOptions
  ): string {
    if (tools.length === 0) {
      return (
        options.customHeader ||
        '## Available Tools\n\nNo tools available for this context.'
      );
    }

    const sections: string[] = [];

    // Add header
    const header =
      options.customHeader ||
      this.generateHeader(tools.length, options.formatStyle);
    sections.push(header);

    // Format tools
    const toolsToFormat = [...tools];

    // Sort if needed
    if (options.sortOrder === 'alphabetical') {
      toolsToFormat.sort((a, b) => a.name.localeCompare(b.name));
    } else if (options.sortOrder === 'priority') {
      toolsToFormat.sort((a, b) => b.priority - a.priority);
    }

    // Group by category if requested
    if (options.groupByCategory) {
      const grouped = this.groupToolsByCategory(toolsToFormat);

      for (const [category, categoryTools] of Object.entries(grouped)) {
        sections.push(this.formatCategoryHeader(category, options.formatStyle));

        for (const tool of categoryTools) {
          const formatted = this.formatTool(tool, options);
          sections.push(formatted.formattedContent);
        }
      }
    } else {
      for (const tool of toolsToFormat) {
        const formatted = this.formatTool(tool, options);
        sections.push(formatted.formattedContent);
      }
    }

    // Add footer
    if (options.customFooter) {
      sections.push(options.customFooter);
    }

    return sections.join('\n\n');
  }

  /**
   * Generate header based on format style
   */
  private generateHeader(
    toolCount: number,
    style: InjectionOptions['formatStyle']
  ): string {
    switch (style) {
      case 'xml':
        return `<available_tools count="${toolCount}">`;
      case 'json':
        return '{ "available_tools": [';
      case 'compact':
        return `Available Tools (${toolCount}):`;
      case 'markdown':
      case 'detailed':
      default:
        return `## Available Tools\n\nThe following ${toolCount} tool(s) are available for this task:`;
    }
  }

  /**
   * Format category header
   */
  private formatCategoryHeader(
    category: string,
    style: InjectionOptions['formatStyle']
  ): string {
    const formattedCategory =
      category.charAt(0).toUpperCase() + category.slice(1);

    switch (style) {
      case 'xml':
        return `<category name="${category}">`;
      case 'json':
        return `"${category}": [`;
      case 'markdown':
        return `### ${formattedCategory} Tools`;
      default:
        return `=== ${formattedCategory} ===`;
    }
  }

  /**
   * Group tools by category
   */
  private groupToolsByCategory(tools: ToolSpec[]): Record<string, ToolSpec[]> {
    const grouped: Record<string, ToolSpec[]> = {};

    for (const tool of tools) {
      if (!grouped[tool.category]) {
        grouped[tool.category] = [];
      }
      grouped[tool.category].push(tool);
    }

    return grouped;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Estimate token count for a string
   *
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  estimateTokens(text: string): number {
    // Rough approximation: 4 characters = 1 token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get the maximum context size based on agent preferences
   *
   * @param context - Agent context
   * @returns Maximum token budget
   */
  getMaxContextSize(context?: AgentContext): number {
    if (!context?.preferences) {
      return this.config.maxTokenBudget;
    }

    switch (context.preferences.maxContextSize) {
      case 'minimal':
        return Math.floor(this.config.maxTokenBudget * 0.5);
      case 'extended':
        return Math.floor(this.config.maxTokenBudget * 1.5);
      case 'standard':
      default:
        return this.config.maxTokenBudget;
    }
  }

  /**
   * Update default injection options
   *
   * @param options - Partial options to update
   */
  updateDefaultOptions(options: Partial<InjectionOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Get current default options
   *
   * @returns Current default options
   */
  getDefaultOptions(): InjectionOptions {
    return { ...this.defaultOptions };
  }
}

/**
 * Create a context injector with default configuration
 *
 * @param retriever - Tool retriever
 * @param config - JIT configuration
 * @param options - Injection options
 * @returns ContextInjector instance
 */
export function createContextInjector(
  retriever: JITToolRetriever,
  config?: Partial<JITToolConfig>,
  options?: Partial<InjectionOptions>
): ContextInjector {
  return new ContextInjector(retriever, config, options);
}
