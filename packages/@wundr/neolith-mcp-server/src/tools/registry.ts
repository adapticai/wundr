/**
 * Neolith MCP Tool Registry System
 * Provides centralized registration and management of Neolith-specific MCP tools
 *
 * @module @wundr/neolith-mcp-server/tools/registry
 */

import { NeolithToolSchemas, zodToJsonSchema } from './schemas';

import type { NeolithToolName } from './schemas';
import type { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

/**
 * Neolith MCP Tool definition interface
 */
export interface McpTool<TInput = unknown, TOutput = unknown> {
  /** Unique tool name */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for input validation */
  inputSchema: Record<string, unknown>;
  /** Tool category for organization */
  category: 'workspace' | 'channels' | 'messaging' | 'files' | 'users' | 'search' | 'orchestrators' | 'session-managers' | 'subagents';
  /** Tool handler function (optional for static tool definitions) */
  handler?: (input: TInput) => Promise<McpToolResult<TOutput>>;
  /** Optional Zod schema for runtime validation */
  zodSchema?: z.ZodType<TInput>;
}

/**
 * Result returned by MCP tool handlers
 */
export interface McpToolResult<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Human-readable message describing the result */
  message?: string;
  /** Error message if failed */
  error?: string;
  /** Detailed error information */
  errorDetails?: {
    code: string;
    message: string;
    stack?: string;
    context?: Record<string, unknown>;
  };
  /** Warnings that don't prevent success */
  warnings?: string[];
  /** Metadata about the operation */
  metadata?: {
    duration?: number;
    timestamp?: string;
    toolVersion?: string;
  };
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  /** Override existing tool with same name */
  override?: boolean;
  /** Enable debug logging for this tool */
  debug?: boolean;
  /** Tool version */
  version?: string;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** Workspace slug for context */
  workspaceSlug?: string;
  /** User ID for context */
  userId?: string;
  /** API base URL */
  apiBaseUrl?: string;
  /** Authentication token */
  authToken?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable verbose output */
  verbose?: boolean;
}

// ============================================================================
// Tool Registry Class
// ============================================================================

/**
 * Central registry for Neolith MCP tools
 * Provides registration, lookup, and execution of tools
 */
export class NeolithToolRegistry {
  private tools: Map<string, McpTool> = new Map();
  private categories: Map<string, Set<string>> = new Map();
  private version: string = '1.0.0';

  constructor() {
    // Initialize Neolith-specific categories
    this.categories.set('workspace', new Set());
    this.categories.set('channels', new Set());
    this.categories.set('messaging', new Set());
    this.categories.set('files', new Set());
    this.categories.set('users', new Set());
    this.categories.set('search', new Set());
    this.categories.set('orchestrators', new Set());
    this.categories.set('session-managers', new Set());
    this.categories.set('subagents', new Set());
  }

  /**
   * Register a new Neolith MCP tool
   *
   * @param tool - Tool definition to register
   * @param options - Registration options
   * @throws Error if tool already exists and override is false
   *
   * @example
   * ```typescript
   * registry.register({
   *   name: 'workspace-list',
   *   description: 'List all workspaces',
   *   inputSchema: { type: 'object', properties: {} },
   *   category: 'workspace',
   *   handler: async (input) => ({ success: true, data: [] }),
   * });
   * ```
   */
  register<TInput, TOutput>(
    tool: McpTool<TInput, TOutput>,
    options: ToolRegistrationOptions = {},
  ): void {
    const { override = false, debug = false, version = this.version } = options;

    if (this.tools.has(tool.name) && !override) {
      throw new Error(
        `Tool '${tool.name}' is already registered. Use override option to replace.`,
      );
    }

    // Add version metadata to tool
    const toolWithMeta = {
      ...tool,
      metadata: {
        version,
        registeredAt: new Date().toISOString(),
        debug,
      },
    };

    this.tools.set(tool.name, toolWithMeta as McpTool);

    // Update category index
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set());
    }
    this.categories.get(tool.category)!.add(tool.name);

    if (debug) {
      console.log(
        `[NeolithToolRegistry] Registered tool: ${tool.name} (category: ${tool.category})`,
      );
    }
  }

  /**
   * Unregister a tool by name
   *
   * @param name - Tool name to unregister
   * @returns true if tool was removed, false if not found
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }

    this.tools.delete(name);

    // Remove from category index
    const category = this.categories.get(tool.category);
    if (category) {
      category.delete(name);
    }

    return true;
  }

  /**
   * Get a registered tool by name
   *
   * @param name - Tool name
   * @returns Tool definition or undefined
   */
  get(name: string): McpTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered
   *
   * @param name - Tool name
   * @returns true if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   *
   * @returns Array of all tool definitions
   */
  getAll(): McpTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   *
   * @param category - Category name
   * @returns Array of tools in category
   */
  getByCategory(
    category: 'workspace' | 'channels' | 'messaging' | 'files' | 'users' | 'search' | 'orchestrators' | 'session-managers' | 'subagents',
  ): McpTool[] {
    const toolNames = this.categories.get(category);
    if (!toolNames) {
      return [];
    }

    return Array.from(toolNames)
      .map((name) => this.tools.get(name))
      .filter((tool): tool is McpTool => tool !== undefined);
  }

  /**
   * Get all category names
   *
   * @returns Array of category names
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Execute a tool by name
   *
   * @param name - Tool name
   * @param input - Tool input
   * @param context - Execution context
   * @returns Tool result
   *
   * @example
   * ```typescript
   * const result = await registry.execute('workspace-list', {
   *   userId: 'user-123',
   *   includeArchived: false,
   * });
   * ```
   */
  async execute<TInput = unknown, TOutput = unknown>(
    name: string,
    input: TInput,
    context: ToolExecutionContext = {},
  ): Promise<McpToolResult<TOutput>> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
        errorDetails: {
          code: 'TOOL_NOT_FOUND',
          message: `No tool registered with name '${name}'`,
        },
      };
    }

    if (!tool.handler) {
      return {
        success: false,
        error: `Tool '${name}' has no handler`,
        errorDetails: {
          code: 'NO_HANDLER',
          message: `Tool '${name}' is a static definition without a handler`,
        },
      };
    }

    const startTime = Date.now();

    try {
      // Validate input if Zod schema is available
      if (tool.zodSchema) {
        const parseResult = tool.zodSchema.safeParse(input);
        if (!parseResult.success) {
          return {
            success: false,
            error: 'Input validation failed',
            errorDetails: {
              code: 'VALIDATION_ERROR',
              message: parseResult.error.message,
              context: { issues: parseResult.error.issues },
            },
          };
        }
        input = parseResult.data as TInput;
      }

      // Execute tool handler with timeout if specified
      let result: McpToolResult<TOutput>;

      if (context.timeout) {
        const timeoutPromise = new Promise<McpToolResult<TOutput>>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Tool execution timed out after ${context.timeout}ms`));
          }, context.timeout);
        });

        result = await Promise.race([
          tool.handler(input) as Promise<McpToolResult<TOutput>>,
          timeoutPromise,
        ]);
      } else {
        result = (await tool.handler(input)) as McpToolResult<TOutput>;
      }

      // Add metadata
      result.metadata = {
        ...result.metadata,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        toolVersion: this.version,
      };

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      return {
        success: false,
        error: errorMessage,
        errorDetails: {
          code: 'EXECUTION_ERROR',
          message: errorMessage,
          stack: errorStack,
          context: { toolName: name, input },
        },
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          toolVersion: this.version,
        },
      };
    }
  }

  /**
   * Get MCP-compatible tool definitions for all registered tools
   * Used for MCP server tool listing
   *
   * @returns Array of MCP tool definitions
   */
  getMcpToolDefinitions(): Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }> {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  /**
   * Export registry state for debugging/logging
   *
   * @returns Registry state object
   */
  exportState(): {
    version: string;
    toolCount: number;
    tools: Array<{ name: string; category: string; description: string }>;
    categories: Record<string, string[]>;
  } {
    const categories: Record<string, string[]> = {};
    for (const [category, tools] of this.categories.entries()) {
      categories[category] = Array.from(tools);
    }

    return {
      version: this.version,
      toolCount: this.tools.size,
      tools: this.getAll().map((t) => ({
        name: t.name,
        category: t.category,
        description: t.description,
      })),
      categories,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Neolith tool registry with default configuration
 *
 * @returns Configured NeolithToolRegistry instance
 */
export function createNeolithToolRegistry(): NeolithToolRegistry {
  const registry = new NeolithToolRegistry();
  return registry;
}

/**
 * Create a Neolith MCP tool definition from a schema entry
 *
 * @param name - Tool name (must be a key in NeolithToolSchemas)
 * @param handler - Tool handler function
 * @returns McpTool definition
 */
export function createToolFromSchema<TInput, TOutput>(
  name: NeolithToolName,
  handler: (input: TInput) => Promise<McpToolResult<TOutput>>,
): McpTool<TInput, TOutput> {
  const schemaEntry = NeolithToolSchemas[name];

  return {
    name,
    description: schemaEntry.description,
    inputSchema: zodToJsonSchema(schemaEntry.schema),
    category: schemaEntry.category as any,
    handler,
    zodSchema: schemaEntry.schema as unknown as z.ZodType<TInput>,
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global Neolith tool registry instance
 * Use this for most cases unless you need isolated registries
 */
export const globalNeolithRegistry = createNeolithToolRegistry();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a successful tool result
 *
 * @param data - Result data
 * @param message - Optional success message
 * @param warnings - Optional warnings
 * @returns McpToolResult with success: true
 *
 * @example
 * ```typescript
 * return successResult({ workspaces: [...] }, 'Found 5 workspaces');
 * ```
 */
export function successResult<T>(
  data: T,
  message?: string,
  warnings?: string[],
): McpToolResult<T> {
  return {
    success: true,
    data,
    message,
    warnings,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create an error tool result
 *
 * @param error - Error message
 * @param code - Error code
 * @param context - Additional error context
 * @returns McpToolResult with success: false
 *
 * @example
 * ```typescript
 * return errorResult('Workspace not found', 'NOT_FOUND', { workspaceSlug });
 * ```
 */
export function errorResult(
  error: string,
  code: string = 'ERROR',
  context?: Record<string, unknown>,
): McpToolResult<never> {
  return {
    success: false,
    error,
    errorDetails: {
      code,
      message: error,
      context,
    },
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Wrap an async function with error handling for tool handlers
 *
 * @param fn - Async function to wrap
 * @returns Wrapped function that returns McpToolResult
 *
 * @example
 * ```typescript
 * const handler = wrapHandler(async (input) => {
 *   const workspaces = await fetchWorkspaces(input);
 *   return workspaces;
 * });
 * ```
 */
export function wrapHandler<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
): (input: TInput) => Promise<McpToolResult<TOutput>> {
  return async (input: TInput): Promise<McpToolResult<TOutput>> => {
    try {
      const result = await fn(input);
      return successResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResult(message, 'HANDLER_ERROR', { input });
    }
  };
}

/**
 * Create a paginated result helper
 *
 * @param items - Array of items
 * @param total - Total count
 * @param page - Current page
 * @param limit - Items per page
 * @returns Paginated result data
 */
export function paginatedResult<T>(
  items: T[],
  total: number,
  page: number = 1,
  limit: number = 50,
): {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
} {
  return {
    items,
    pagination: {
      total,
      page,
      limit,
      hasMore: page * limit < total,
    },
  };
}

/**
 * Validate required context fields
 *
 * @param context - Execution context
 * @param required - Array of required field names
 * @returns Error result if validation fails, null if success
 */
export function validateContext(
  context: ToolExecutionContext,
  required: Array<keyof ToolExecutionContext>,
): McpToolResult<never> | null {
  const missing: string[] = [];

  for (const field of required) {
    if (!context[field]) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return errorResult(
      `Missing required context fields: ${missing.join(', ')}`,
      'INVALID_CONTEXT',
      { missing },
    );
  }

  return null;
}
