/**
 * @wundr.io/jit-tools - Tool Registry
 *
 * Central catalog management for JIT tool loading.
 * Handles tool registration, storage, search indexing, and lifecycle management.
 */

import { EventEmitter } from 'eventemitter3';

import { ToolSpecSchema } from './types';

import type {
  ToolSpec,
  ToolCategory,
  ToolPermission,
  ToolMetadata,
  JITToolEvent,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for registering a tool
 */
export interface RegisterToolOptions {
  /** Override existing tool with same ID */
  overwrite?: boolean;
  /** Skip validation */
  skipValidation?: boolean;
  /** Custom metadata to merge */
  metadata?: Partial<ToolMetadata>;
}

/**
 * Options for searching tools
 */
export interface SearchToolsOptions {
  /** Filter by categories */
  categories?: ToolCategory[];
  /** Filter by capabilities */
  capabilities?: string[];
  /** Filter by permissions */
  permissions?: ToolPermission[];
  /** Maximum results */
  limit?: number;
  /** Include deprecated tools */
  includeDeprecated?: boolean;
}

/**
 * Tool registration result
 */
export interface RegistrationResult {
  success: boolean;
  toolId: string;
  message: string;
  warnings?: string[];
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalTools: number;
  toolsByCategory: Record<ToolCategory, number>;
  deprecatedTools: number;
  totalCapabilities: number;
  averageTokenCost: number;
}

// =============================================================================
// ToolRegistry Class
// =============================================================================

/**
 * Central registry for managing tool specifications.
 * Provides CRUD operations, search capabilities, and event notifications.
 *
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 *
 * // Register a tool
 * await registry.register({
 *   id: 'code-review',
 *   name: 'Code Review Tool',
 *   description: 'Reviews code for quality and issues',
 *   category: 'analysis',
 *   capabilities: ['code-review', 'quality-check'],
 *   // ... other fields
 * });
 *
 * // Search for tools
 * const tools = registry.search({ categories: ['analysis'] });
 * ```
 */
export class ToolRegistry extends EventEmitter {
  /** Internal tool storage */
  private tools: Map<string, ToolSpec> = new Map();

  /** Capability index for fast lookup */
  private capabilityIndex: Map<string, Set<string>> = new Map();

  /** Category index for fast lookup */
  private categoryIndex: Map<ToolCategory, Set<string>> = new Map();

  /** Keyword index for text search */
  private keywordIndex: Map<string, Set<string>> = new Map();

  /**
   * Creates a new ToolRegistry instance
   */
  constructor() {
    super();
    this.initializeIndexes();
  }

  /**
   * Initialize all search indexes
   */
  private initializeIndexes(): void {
    // Initialize category index with all categories
    const categories: ToolCategory[] = [
      'coordination',
      'monitoring',
      'memory',
      'neural',
      'github',
      'system',
      'governance',
      'analysis',
      'testing',
      'documentation',
      'deployment',
      'security',
      'custom',
    ];

    for (const category of categories) {
      this.categoryIndex.set(category, new Set());
    }
  }

  // ===========================================================================
  // Registration Methods
  // ===========================================================================

  /**
   * Register a new tool in the registry
   *
   * @param tool - Tool specification to register
   * @param options - Registration options
   * @returns Registration result
   */
  async register(
    tool: Partial<ToolSpec> &
      Pick<ToolSpec, 'id' | 'name' | 'description' | 'category'>,
    options: RegisterToolOptions = {}
  ): Promise<RegistrationResult> {
    const warnings: string[] = [];

    try {
      // Check for existing tool
      if (this.tools.has(tool.id) && !options.overwrite) {
        return {
          success: false,
          toolId: tool.id,
          message: `Tool with ID "${tool.id}" already exists. Use overwrite option to replace.`,
        };
      }

      // Build complete tool spec with defaults
      const completeSpec = this.buildCompleteSpec(tool, options.metadata);

      // Validate if not skipped
      if (!options.skipValidation) {
        const validation = this.validateTool(completeSpec);
        if (!validation.valid) {
          return {
            success: false,
            toolId: tool.id,
            message: `Validation failed: ${validation.errors.join(', ')}`,
          };
        }
        warnings.push(...validation.warnings);
      }

      // Store tool
      this.tools.set(completeSpec.id, completeSpec);

      // Update indexes
      this.indexTool(completeSpec);

      // Emit event
      const eventType: JITToolEvent =
        this.tools.has(tool.id) && options.overwrite
          ? 'tool:updated'
          : 'tool:registered';

      this.emit(eventType, { tool: completeSpec });

      return {
        success: true,
        toolId: completeSpec.id,
        message: `Tool "${completeSpec.name}" registered successfully`,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        toolId: tool.id,
        message: `Registration failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Register multiple tools at once
   *
   * @param tools - Array of tool specifications
   * @param options - Registration options
   * @returns Array of registration results
   */
  async registerBatch(
    tools: Array<
      Partial<ToolSpec> &
        Pick<ToolSpec, 'id' | 'name' | 'description' | 'category'>
    >,
    options: RegisterToolOptions = {}
  ): Promise<RegistrationResult[]> {
    const results: RegistrationResult[] = [];

    for (const tool of tools) {
      const result = await this.register(tool, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Unregister a tool from the registry
   *
   * @param toolId - ID of the tool to unregister
   * @returns Whether the tool was unregistered
   */
  unregister(toolId: string): boolean {
    const tool = this.tools.get(toolId);

    if (!tool) {
      return false;
    }

    // Remove from indexes
    this.removeFromIndexes(tool);

    // Remove from storage
    this.tools.delete(toolId);

    // Emit event
    this.emit('tool:unregistered', { toolId, tool });

    return true;
  }

  /**
   * Update an existing tool
   *
   * @param toolId - ID of the tool to update
   * @param updates - Partial updates to apply
   * @returns Updated tool or null if not found
   */
  async update(
    toolId: string,
    updates: Partial<Omit<ToolSpec, 'id'>>
  ): Promise<ToolSpec | null> {
    const existingTool = this.tools.get(toolId);

    if (!existingTool) {
      return null;
    }

    // Remove from indexes before update
    this.removeFromIndexes(existingTool);

    // Apply updates
    const updatedTool: ToolSpec = {
      ...existingTool,
      ...updates,
      metadata: {
        ...existingTool.metadata,
        ...updates.metadata,
        updatedAt: new Date(),
      },
    };

    // Store updated tool
    this.tools.set(toolId, updatedTool);

    // Re-index
    this.indexTool(updatedTool);

    // Emit event
    this.emit('tool:updated', {
      tool: updatedTool,
      previousTool: existingTool,
    });

    return updatedTool;
  }

  // ===========================================================================
  // Retrieval Methods
  // ===========================================================================

  /**
   * Get a tool by ID
   *
   * @param toolId - Tool identifier
   * @returns Tool specification or undefined
   */
  get(toolId: string): ToolSpec | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get multiple tools by IDs
   *
   * @param toolIds - Array of tool identifiers
   * @returns Array of found tools
   */
  getMany(toolIds: string[]): ToolSpec[] {
    return toolIds
      .map(id => this.tools.get(id))
      .filter((tool): tool is ToolSpec => tool !== undefined);
  }

  /**
   * Get all registered tools
   *
   * @param includeDeprecated - Include deprecated tools
   * @returns Array of all tools
   */
  getAll(includeDeprecated = false): ToolSpec[] {
    const tools = Array.from(this.tools.values());

    if (includeDeprecated) {
      return tools;
    }

    return tools.filter(tool => !tool.metadata.deprecated);
  }

  /**
   * Check if a tool exists
   *
   * @param toolId - Tool identifier
   * @returns Whether the tool exists
   */
  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  // ===========================================================================
  // Search Methods
  // ===========================================================================

  /**
   * Search for tools based on criteria
   *
   * @param options - Search options
   * @returns Matching tools
   */
  search(options: SearchToolsOptions = {}): ToolSpec[] {
    let results: Set<string> | null = null;

    // Filter by categories
    if (options.categories && options.categories.length > 0) {
      const categoryMatches = new Set<string>();
      for (const category of options.categories) {
        const toolIds = this.categoryIndex.get(category);
        if (toolIds) {
          for (const id of toolIds) {
            categoryMatches.add(id);
          }
        }
      }
      results = categoryMatches;
    }

    // Filter by capabilities
    if (options.capabilities && options.capabilities.length > 0) {
      const capabilityMatches = new Set<string>();
      for (const capability of options.capabilities) {
        const toolIds = this.capabilityIndex.get(capability.toLowerCase());
        if (toolIds) {
          for (const id of toolIds) {
            capabilityMatches.add(id);
          }
        }
      }

      if (results === null) {
        results = capabilityMatches;
      } else {
        // Intersection
        results = new Set([...results].filter(id => capabilityMatches.has(id)));
      }
    }

    // Filter by permissions
    if (options.permissions && options.permissions.length > 0) {
      const permissionMatches = new Set<string>();
      for (const tool of this.tools.values()) {
        const hasAllPermissions = options.permissions.every(perm =>
          tool.permissions.includes(perm)
        );
        if (hasAllPermissions) {
          permissionMatches.add(tool.id);
        }
      }

      if (results === null) {
        results = permissionMatches;
      } else {
        results = new Set([...results].filter(id => permissionMatches.has(id)));
      }
    }

    // Get tools from results
    let tools: ToolSpec[];
    if (results === null) {
      tools = Array.from(this.tools.values());
    } else {
      tools = Array.from(results)
        .map(id => this.tools.get(id))
        .filter((tool): tool is ToolSpec => tool !== undefined);
    }

    // Filter deprecated
    if (!options.includeDeprecated) {
      tools = tools.filter(tool => !tool.metadata.deprecated);
    }

    // Sort by priority (descending)
    tools.sort((a, b) => b.priority - a.priority);

    // Apply limit
    if (options.limit && options.limit > 0) {
      tools = tools.slice(0, options.limit);
    }

    return tools;
  }

  /**
   * Search tools by keyword
   *
   * @param keyword - Keyword to search for
   * @param limit - Maximum results
   * @returns Matching tools
   */
  searchByKeyword(keyword: string, limit = 10): ToolSpec[] {
    const normalizedKeyword = keyword.toLowerCase();
    const matchingIds = this.keywordIndex.get(normalizedKeyword);

    if (!matchingIds) {
      // Fallback to partial matching
      const partialMatches = new Set<string>();
      for (const [indexedKeyword, toolIds] of this.keywordIndex) {
        if (
          indexedKeyword.includes(normalizedKeyword) ||
          normalizedKeyword.includes(indexedKeyword)
        ) {
          for (const id of toolIds) {
            partialMatches.add(id);
          }
        }
      }

      return Array.from(partialMatches)
        .map(id => this.tools.get(id))
        .filter((tool): tool is ToolSpec => tool !== undefined)
        .slice(0, limit);
    }

    return Array.from(matchingIds)
      .map(id => this.tools.get(id))
      .filter((tool): tool is ToolSpec => tool !== undefined)
      .slice(0, limit);
  }

  /**
   * Get tools by category
   *
   * @param category - Tool category
   * @returns Tools in the category
   */
  getByCategory(category: ToolCategory): ToolSpec[] {
    const toolIds = this.categoryIndex.get(category);

    if (!toolIds) {
      return [];
    }

    return Array.from(toolIds)
      .map(id => this.tools.get(id))
      .filter((tool): tool is ToolSpec => tool !== undefined);
  }

  /**
   * Get tools by capability
   *
   * @param capability - Required capability
   * @returns Tools with the capability
   */
  getByCapability(capability: string): ToolSpec[] {
    const toolIds = this.capabilityIndex.get(capability.toLowerCase());

    if (!toolIds) {
      return [];
    }

    return Array.from(toolIds)
      .map(id => this.tools.get(id))
      .filter((tool): tool is ToolSpec => tool !== undefined);
  }

  // ===========================================================================
  // Statistics Methods
  // ===========================================================================

  /**
   * Get registry statistics
   *
   * @returns Registry statistics
   */
  getStats(): RegistryStats {
    const toolsByCategory: Record<string, number> = {};
    let deprecatedCount = 0;
    let totalTokenCost = 0;
    const allCapabilities = new Set<string>();

    for (const tool of this.tools.values()) {
      // Count by category
      toolsByCategory[tool.category] =
        (toolsByCategory[tool.category] || 0) + 1;

      // Count deprecated
      if (tool.metadata.deprecated) {
        deprecatedCount++;
      }

      // Sum token costs
      totalTokenCost += tool.tokenCost;

      // Collect capabilities
      for (const cap of tool.capabilities) {
        allCapabilities.add(cap);
      }
    }

    return {
      totalTools: this.tools.size,
      toolsByCategory: toolsByCategory as Record<ToolCategory, number>,
      deprecatedTools: deprecatedCount,
      totalCapabilities: allCapabilities.size,
      averageTokenCost:
        this.tools.size > 0 ? totalTokenCost / this.tools.size : 0,
    };
  }

  /**
   * Get the total number of registered tools
   *
   * @returns Tool count
   */
  get size(): number {
    return this.tools.size;
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Build a complete tool spec with defaults
   */
  private buildCompleteSpec(
    partial: Partial<ToolSpec> &
      Pick<ToolSpec, 'id' | 'name' | 'description' | 'category'>,
    metadataOverrides?: Partial<ToolMetadata>
  ): ToolSpec {
    const now = new Date();

    const defaultMetadata: ToolMetadata = {
      createdAt: now,
      updatedAt: now,
      deprecated: false,
      custom: {},
      ...metadataOverrides,
    };

    return {
      id: partial.id,
      name: partial.name,
      description: partial.description,
      category: partial.category,
      capabilities: partial.capabilities || [],
      permissions: partial.permissions || ['read'],
      parameters: partial.parameters || [],
      examples: partial.examples || [],
      keywords:
        partial.keywords ||
        this.extractKeywords(partial.name, partial.description),
      version: partial.version || '1.0.0',
      priority: partial.priority ?? 50,
      tokenCost: partial.tokenCost ?? this.estimateTokenCost(partial),
      dependencies: partial.dependencies || [],
      metadata: {
        ...defaultMetadata,
        ...partial.metadata,
      },
    };
  }

  /**
   * Validate a tool specification
   */
  private validateTool(tool: ToolSpec): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      ToolSpecSchema.parse(tool);
    } catch (_zodError) {
      errors.push('Schema validation failed');
    }

    // Additional validation
    if (tool.id.length < 2) {
      errors.push('Tool ID must be at least 2 characters');
    }

    if (tool.description.length < 10) {
      warnings.push('Tool description is very short');
    }

    if (tool.capabilities.length === 0) {
      warnings.push('Tool has no capabilities defined');
    }

    if (tool.keywords.length === 0) {
      warnings.push('Tool has no keywords for search');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Index a tool for fast lookup
   */
  private indexTool(tool: ToolSpec): void {
    // Index by category
    const categorySet = this.categoryIndex.get(tool.category);
    if (categorySet) {
      categorySet.add(tool.id);
    }

    // Index by capabilities
    for (const capability of tool.capabilities) {
      const normalizedCap = capability.toLowerCase();
      if (!this.capabilityIndex.has(normalizedCap)) {
        this.capabilityIndex.set(normalizedCap, new Set());
      }
      this.capabilityIndex.get(normalizedCap)!.add(tool.id);
    }

    // Index by keywords
    for (const keyword of tool.keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      if (!this.keywordIndex.has(normalizedKeyword)) {
        this.keywordIndex.set(normalizedKeyword, new Set());
      }
      this.keywordIndex.get(normalizedKeyword)!.add(tool.id);
    }
  }

  /**
   * Remove a tool from all indexes
   */
  private removeFromIndexes(tool: ToolSpec): void {
    // Remove from category index
    const categorySet = this.categoryIndex.get(tool.category);
    if (categorySet) {
      categorySet.delete(tool.id);
    }

    // Remove from capability index
    for (const capability of tool.capabilities) {
      const capSet = this.capabilityIndex.get(capability.toLowerCase());
      if (capSet) {
        capSet.delete(tool.id);
      }
    }

    // Remove from keyword index
    for (const keyword of tool.keywords) {
      const keywordSet = this.keywordIndex.get(keyword.toLowerCase());
      if (keywordSet) {
        keywordSet.delete(tool.id);
      }
    }
  }

  /**
   * Extract keywords from name and description
   */
  private extractKeywords(name: string, description: string): string[] {
    const text = `${name} ${description}`.toLowerCase();

    // Remove common stop words and split
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
      'dare',
      'ought',
      'used',
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
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
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
    ]);

    const words = text
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)];
  }

  /**
   * Estimate token cost for a tool
   */
  private estimateTokenCost(tool: Partial<ToolSpec>): number {
    let cost = 0;

    // Base cost for tool definition
    cost += 50;

    // Cost for description
    cost += Math.ceil((tool.description?.length || 0) / 4);

    // Cost for parameters
    cost += (tool.parameters?.length || 0) * 30;

    // Cost for examples
    cost += (tool.examples?.length || 0) * 50;

    return Math.min(cost, 500); // Cap at 500 tokens
  }

  /**
   * Clear all tools from the registry
   */
  clear(): void {
    this.tools.clear();
    this.initializeIndexes();
    this.capabilityIndex.clear();
    this.keywordIndex.clear();
  }

  /**
   * Export registry to JSON
   *
   * @returns JSON-serializable registry data
   */
  export(): { tools: ToolSpec[]; exportedAt: string } {
    return {
      tools: Array.from(this.tools.values()),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import tools from JSON
   *
   * @param data - Exported registry data
   * @param options - Import options
   * @returns Import results
   */
  async import(
    data: { tools: ToolSpec[] },
    options: RegisterToolOptions = { overwrite: true }
  ): Promise<RegistrationResult[]> {
    return this.registerBatch(data.tools, options);
  }
}

/**
 * Create a tool specification with sensible defaults
 *
 * @param spec - Partial tool specification
 * @returns Complete tool specification
 */
export function createToolSpec(
  spec: Partial<ToolSpec> &
    Pick<ToolSpec, 'id' | 'name' | 'description' | 'category'>
): ToolSpec {
  const now = new Date();

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    capabilities: spec.capabilities || [],
    permissions: spec.permissions || ['read'],
    parameters: spec.parameters || [],
    examples: spec.examples || [],
    keywords: spec.keywords || [],
    version: spec.version || '1.0.0',
    priority: spec.priority ?? 50,
    tokenCost: spec.tokenCost ?? 100,
    dependencies: spec.dependencies || [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      deprecated: false,
      custom: {},
      ...spec.metadata,
    },
  };
}
