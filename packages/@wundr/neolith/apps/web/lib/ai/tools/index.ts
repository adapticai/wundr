/**
 * AI Tool Registry and Execution Framework
 *
 * Central registry for all AI tools with execution, validation, and permission checking.
 * Supports parallel execution, caching, and approval flows for sensitive operations.
 */

import type { z } from 'zod';

/**
 * Tool execution context with user permissions and workspace info
 */
export interface ToolContext {
  userId: string;
  workspaceId: string;
  permissions: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime?: number;
    cached?: boolean;
    requiresApproval?: boolean;
    approvalId?: string;
  };
}

/**
 * Tool parameter definition (OpenAI function calling format)
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[] | number[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  default?: unknown;
}

/**
 * Tool definition following OpenAI function calling schema
 */
export interface ToolDefinition<
  TInput = Record<string, unknown>,
  TOutput = unknown,
> {
  name: string;
  description: string;
  category: 'workflow' | 'search' | 'data' | 'system' | 'integration';
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
  /**
   * Permissions required to execute this tool
   */
  requiredPermissions?: string[];
  /**
   * Whether this tool requires user approval before execution
   */
  requiresApproval?: boolean;
  /**
   * Whether results should be cached
   */
  cacheable?: boolean;
  /**
   * Cache TTL in seconds
   */
  cacheTTL?: number;
  /**
   * Validate input parameters
   */
  validate?: (input: unknown) => Promise<TInput>;
  /**
   * Execute the tool
   */
  execute: (
    input: TInput,
    context: ToolContext
  ) => Promise<ToolResult<TOutput>>;
}

/**
 * Tool registry storing all available tools
 */
class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private cache = new Map<string, { data: ToolResult; expiresAt: number }>();
  private pendingApprovals = new Map<
    string,
    { tool: string; input: unknown; context: ToolContext }
  >();

  /**
   * Register a new tool
   */
  register<TInput = Record<string, unknown>, TOutput = unknown>(
    tool: ToolDefinition<TInput, TOutput>
  ): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(
      tool => tool.category === category
    );
  }

  /**
   * Get tools available to user based on permissions
   */
  getAvailableTools(permissions: string[]): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => {
      if (!tool.requiredPermissions || tool.requiredPermissions.length === 0) {
        return true;
      }
      return tool.requiredPermissions.every(perm => permissions.includes(perm));
    });
  }

  /**
   * Check if user has permission to execute tool
   */
  hasPermission(toolName: string, permissions: string[]): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) return false;
    if (!tool.requiredPermissions || tool.requiredPermissions.length === 0) {
      return true;
    }
    return tool.requiredPermissions.every(perm => permissions.includes(perm));
  }

  /**
   * Generate cache key for tool execution
   */
  private getCacheKey(toolName: string, input: unknown): string {
    return `${toolName}:${JSON.stringify(input)}`;
  }

  /**
   * Get cached result if available and not expired
   */
  private getCached(key: string): ToolResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return {
      ...cached.data,
      metadata: { ...cached.data.metadata, cached: true },
    };
  }

  /**
   * Cache tool result
   */
  private setCached(key: string, result: ToolResult, ttl: number): void {
    this.cache.set(key, {
      data: result,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  /**
   * Create approval request for sensitive tool
   */
  createApprovalRequest(
    toolName: string,
    input: unknown,
    context: ToolContext
  ): string {
    const approvalId = `approval_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.pendingApprovals.set(approvalId, { tool: toolName, input, context });
    return approvalId;
  }

  /**
   * Get pending approval
   */
  getPendingApproval(approvalId: string) {
    return this.pendingApprovals.get(approvalId);
  }

  /**
   * Approve and execute tool
   */
  async approveAndExecute(approvalId: string): Promise<ToolResult> {
    const approval = this.pendingApprovals.get(approvalId);
    if (!approval) {
      return {
        success: false,
        error: 'Approval request not found or expired',
      };
    }

    this.pendingApprovals.delete(approvalId);
    return this.execute(approval.tool, approval.input, approval.context, true);
  }

  /**
   * Reject approval
   */
  rejectApproval(approvalId: string): void {
    this.pendingApprovals.delete(approvalId);
  }

  /**
   * Execute a tool with validation and permission checking
   */
  async execute(
    toolName: string,
    input: unknown,
    context: ToolContext,
    skipApproval = false
  ): Promise<ToolResult> {
    const startTime = Date.now();

    // Get tool
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
      };
    }

    // Check permissions
    if (!this.hasPermission(toolName, context.permissions)) {
      return {
        success: false,
        error: `Insufficient permissions to execute "${toolName}". Required: ${tool.requiredPermissions?.join(', ')}`,
      };
    }

    // Check for cached result
    if (tool.cacheable) {
      const cacheKey = this.getCacheKey(toolName, input);
      const cached = this.getCached(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Check if approval is required
    if (tool.requiresApproval && !skipApproval) {
      const approvalId = this.createApprovalRequest(toolName, input, context);
      return {
        success: false,
        error: 'This tool requires approval before execution',
        metadata: {
          requiresApproval: true,
          approvalId,
        },
      };
    }

    try {
      // Validate input
      let validatedInput = input;
      if (tool.validate) {
        validatedInput = await tool.validate(input);
      }

      // Execute tool
      const result = await tool.execute(validatedInput as never, context);
      const executionTime = Date.now() - startTime;

      // Add metadata
      result.metadata = {
        ...result.metadata,
        executionTime,
        cached: false,
      };

      // Cache result if configured
      if (tool.cacheable && tool.cacheTTL && result.success) {
        const cacheKey = this.getCacheKey(toolName, input);
        this.setCached(cacheKey, result, tool.cacheTTL);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeParallel(
    executions: Array<{ tool: string; input: unknown }>,
    context: ToolContext
  ): Promise<ToolResult[]> {
    return Promise.all(
      executions.map(({ tool, input }) => this.execute(tool, input, context))
    );
  }

  /**
   * Get tool definitions in OpenAI function calling format
   */
  getOpenAIFunctions(permissions?: string[]): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: ToolDefinition['parameters'];
    };
  }> {
    const tools = permissions
      ? this.getAvailableTools(permissions)
      : this.getAll();

    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Global tool registry instance
 */
export const toolRegistry = new ToolRegistry();

/**
 * Decorator for registering tools
 */
export function registerTool<
  TInput = Record<string, unknown>,
  TOutput = unknown,
>(tool: ToolDefinition<TInput, TOutput>) {
  toolRegistry.register(tool);
  return tool;
}
