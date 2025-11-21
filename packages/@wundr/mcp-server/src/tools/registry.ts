/**
 * MCP Tool Registry System
 * Provides centralized registration and management of MCP tools
 *
 * @module @wundr/mcp-server/tools/registry
 */

import { ToolSchemas, zodToJsonSchema } from './schemas';

import type { ToolName } from './schemas';
import type { z } from 'zod';


// ============================================================================
// Types
// ============================================================================

/**
 * MCP Tool definition interface
 */
export interface McpTool<TInput = unknown, TOutput = unknown> {
  /** Unique tool name */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for input validation */
  inputSchema: Record<string, unknown>;
  /** Tool category for organization (optional for backward compatibility) */
  category?: string;
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
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable verbose output */
  verbose?: boolean;
}

// ============================================================================
// Tool Registry Class
// ============================================================================

/**
 * Central registry for MCP tools
 * Provides registration, lookup, and execution of tools
 */
export class ToolRegistry {
  private tools: Map<string, McpTool> = new Map();
  private categories: Map<string, Set<string>> = new Map();
  private version: string = '1.0.0';

  constructor() {
    // Initialize default categories
    this.categories.set('setup', new Set());
    this.categories.set('project', new Set());
    this.categories.set('governance', new Set());
    this.categories.set('analysis', new Set());
    this.categories.set('testing', new Set());
    this.categories.set('rag', new Set());
  }

  /**
   * Register a new MCP tool
   *
   * @param tool - Tool definition to register
   * @param options - Registration options
   * @throws Error if tool already exists and override is false
   *
   * @example
   * ```typescript
   * registry.register({
   *   name: 'my-tool',
   *   description: 'My custom tool',
   *   inputSchema: { type: 'object', properties: {} },
   *   category: 'custom',
   *   handler: async (input) => ({ success: true, data: input }),
   * });
   * ```
   */
  register<TInput, TOutput>(
    tool: McpTool<TInput, TOutput>,
    options: ToolRegistrationOptions = {},
  ): void {
    const { override = false, debug = false, version = this.version } = options;

    if (this.tools.has(tool.name) && !override) {
      throw new Error(`Tool '${tool.name}' is already registered. Use override option to replace.`);
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

    // Update category index (use 'general' for tools without category)
    const category = tool.category || 'general';
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category)!.add(tool.name);

    if (debug) {
      console.log(`[ToolRegistry] Registered tool: ${tool.name} (category: ${tool.category})`);
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
    const toolCategory = tool.category || 'general';
    const category = this.categories.get(toolCategory);
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
  getByCategory(category: string): McpTool[] {
    const toolNames = this.categories.get(category);
    if (!toolNames) {
      return [];
    }

    return Array.from(toolNames)
      .map(name => this.tools.get(name))
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
   * const result = await registry.execute('computer-setup', {
   *   profile: 'fullstack',
   *   dryRun: true,
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
        result = await tool.handler(input) as McpToolResult<TOutput>;
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
    return this.getAll().map(tool => ({
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
      tools: this.getAll().map(t => ({
        name: t.name,
        category: t.category || 'general',
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
 * Create a new tool registry with default Wundr tools
 *
 * @returns Configured ToolRegistry instance
 */
export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  return registry;
}

/**
 * Create an MCP tool definition from a schema entry
 *
 * @param name - Tool name (must be a key in ToolSchemas)
 * @param handler - Tool handler function
 * @returns McpTool definition
 */
export function createToolFromSchema<TInput, TOutput>(
  name: ToolName,
  handler: (input: TInput) => Promise<McpToolResult<TOutput>>,
): McpTool<TInput, TOutput> {
  const schemaEntry = ToolSchemas[name];

  return {
    name,
    description: schemaEntry.description,
    inputSchema: zodToJsonSchema(schemaEntry.schema),
    category: schemaEntry.category,
    handler,
    zodSchema: schemaEntry.schema as unknown as z.ZodType<TInput>,
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global tool registry instance
 * Use this for most cases unless you need isolated registries
 */
export const globalRegistry = createToolRegistry();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a successful tool result
 *
 * @param data - Result data
 * @param warnings - Optional warnings
 * @returns McpToolResult with success: true
 */
export function successResult<T>(data: T, warnings?: string[]): McpToolResult<T> {
  return {
    success: true,
    data,
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
