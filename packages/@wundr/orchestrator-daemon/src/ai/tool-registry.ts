/**
 * Tool Registry for AI Reasoning Engine
 *
 * Manages a named set of tool handlers that the ReasoningEngine can invoke
 * during its ReAct loop. Provides registration, unregistration, execution,
 * and conversion to the LLM-compatible ToolDefinition format.
 */

import type { ToolDefinition } from '../types/llm';

// =============================================================================
// Types
// =============================================================================

/**
 * A callable tool handler function.
 * Receives parsed arguments and returns any serialisable result.
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * Human-readable metadata about a registered tool.
 */
export interface ToolDescription {
  /** Unique tool name (must match the name used to register the handler). */
  name: string;
  /** Short description shown to the LLM in its system prompt. */
  description: string;
  /** JSON Schema describing the expected arguments object. */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Interface that any tool registry must satisfy.
 * Used by ReasoningEngine so that the concrete implementation can be swapped.
 */
export interface ToolRegistry {
  /** All registered tool handlers keyed by name. */
  readonly tools: Map<string, ToolHandler>;

  /** Register a new handler, optionally with a description used for LLM prompting. */
  register(name: string, handler: ToolHandler, description?: ToolDescription): void;

  /** Remove a registered tool by name. */
  unregister(name: string): void;

  /** Execute a registered tool by name, forwarding the provided arguments. */
  execute(name: string, args: Record<string, unknown>): Promise<unknown>;

  /** List all registered tools with their descriptions. */
  listTools(): ToolDescription[];

  /** Convert all registered tools to the LLM-compatible ToolDefinition format. */
  toToolDefinitions(): ToolDefinition[];
}

// =============================================================================
// DefaultToolRegistry
// =============================================================================

/**
 * Default implementation of the ToolRegistry interface.
 *
 * @example
 * ```typescript
 * const registry = new DefaultToolRegistry();
 *
 * registry.register(
 *   'get_price',
 *   async ({ ticker }) => fetchPrice(ticker as string),
 *   {
 *     name: 'get_price',
 *     description: 'Fetch the latest market price for a given ticker symbol.',
 *     inputSchema: {
 *       type: 'object',
 *       properties: { ticker: { type: 'string' } },
 *       required: ['ticker'],
 *     },
 *   },
 * );
 *
 * const result = await registry.execute('get_price', { ticker: 'AAPL' });
 * ```
 */
export class DefaultToolRegistry implements ToolRegistry {
  readonly tools: Map<string, ToolHandler> = new Map();
  private readonly descriptions: Map<string, ToolDescription> = new Map();

  // ===========================================================================
  // Registration
  // ===========================================================================

  /**
   * Registers a tool handler under the given name.
   * If a handler already exists under that name it is silently replaced.
   *
   * @param name - Unique identifier for the tool.
   * @param handler - Async function that receives parsed arguments and returns a result.
   * @param description - Optional metadata used when building LLM tool definitions.
   */
  register(name: string, handler: ToolHandler, description?: ToolDescription): void {
    this.tools.set(name, handler);
    if (description) {
      this.descriptions.set(name, description);
    }
  }

  /**
   * Removes a registered tool by name.
   * No-ops silently if the tool does not exist.
   *
   * @param name - Name of the tool to remove.
   */
  unregister(name: string): void {
    this.tools.delete(name);
    this.descriptions.delete(name);
  }

  // ===========================================================================
  // Execution
  // ===========================================================================

  /**
   * Executes a registered tool with the provided arguments.
   *
   * @param name - Name of the tool to call.
   * @param args - Parsed argument object forwarded to the handler.
   * @returns The handler's return value.
   * @throws Error if no handler is registered under `name`.
   */
  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = this.tools.get(name);
    if (!handler) {
      throw new Error(
        `[DefaultToolRegistry] No handler registered for tool: "${name}". ` +
        `Available tools: ${Array.from(this.tools.keys()).join(', ') || '(none)'}`,
      );
    }

    try {
      return await handler(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[DefaultToolRegistry] Tool "${name}" execution failed: ${message}`);
    }
  }

  // ===========================================================================
  // Introspection
  // ===========================================================================

  /**
   * Returns all registered tool descriptions.
   * Tools without an explicit description are omitted.
   */
  listTools(): ToolDescription[] {
    return Array.from(this.descriptions.values());
  }

  /**
   * Converts all described tools to the ToolDefinition format expected by
   * LLMClient.chat(). Tools without a description are skipped because the
   * LLM requires at least a description and an input schema.
   */
  toToolDefinitions(): ToolDefinition[] {
    return Array.from(this.descriptions.values()).map(desc => ({
      name: desc.name,
      description: desc.description,
      inputSchema: desc.inputSchema,
    }));
  }

  /**
   * Returns true if a handler is registered under the given name.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Returns the number of registered handlers.
   */
  get size(): number {
    return this.tools.size;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates an empty DefaultToolRegistry.
 */
export function createToolRegistry(): DefaultToolRegistry {
  return new DefaultToolRegistry();
}
