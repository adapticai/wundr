/**
 * Tool Executor - Converts LLM tool calls to MCP tool invocations
 *
 * Handles the execution of tool calls returned by LLM responses,
 * converting them to MCP tool format and managing results.
 */

import { Logger } from '../utils/logger';

import type { ToolCall, Message } from '@wundr.io/ai-integration';

/**
 * MCP Tool Registry interface (minimal interface for tool execution)
 */
export interface McpToolRegistry {
  executeTool(
    toolId: string,
    operation: string,
    params: any,
  ): Promise<{ success: boolean; message: string; data?: any; error?: any }>;
  getTool?(toolId: string): any;
  listTools?(): string[];
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  result: any;
  error?: string;
  executionTime: number;
}

/**
 * Tool Executor class
 */
export class ToolExecutor {
  private logger: Logger;
  private mcpRegistry: McpToolRegistry;

  constructor(mcpRegistry: McpToolRegistry) {
    this.logger = new Logger('ToolExecutor');
    this.mcpRegistry = mcpRegistry;
  }

  /**
   * Execute a single tool call
   */
  async executeToolCall(toolCall: ToolCall): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    this.logger.info(
      `Executing tool: ${toolCall.name} (id: ${toolCall.id})`,
    );

    try {
      // Parse tool arguments
      const args = this.parseToolArguments(toolCall.arguments);

      // Extract operation and params from arguments
      // MCP tools typically use 'operation' field, but fallback to tool name
      const operation = args.operation || toolCall.name;
      const params = args.params || args;

      // Execute via MCP registry
      const mcpResult = await this.mcpRegistry.executeTool(
        toolCall.name,
        operation,
        params,
      );

      const executionTime = Date.now() - startTime;

      if (mcpResult.success) {
        this.logger.info(
          `Tool ${toolCall.name} completed successfully in ${executionTime}ms`,
        );

        return {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: true,
          result: mcpResult.data || mcpResult.message,
          executionTime,
        };
      } else {
        this.logger.warn(
          `Tool ${toolCall.name} failed: ${mcpResult.message}`,
        );

        return {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: false,
          result: null,
          error: mcpResult.message || 'Tool execution failed',
          executionTime,
        };
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Tool ${toolCall.name} execution error: ${errorMessage}`,
        error,
      );

      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        success: false,
        result: null,
        error: errorMessage,
        executionTime,
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeToolCalls(
    toolCalls: ToolCall[],
  ): Promise<ToolExecutionResult[]> {
    this.logger.info(`Executing ${toolCalls.length} tool calls in parallel`);

    const results = await Promise.all(
      toolCalls.map((toolCall) => this.executeToolCall(toolCall)),
    );

    const successCount = results.filter((r) => r.success).length;
    this.logger.info(
      `Tool execution completed: ${successCount}/${toolCalls.length} successful`,
    );

    return results;
  }

  /**
   * Convert tool execution results to LLM messages
   */
  convertResultsToMessages(results: ToolExecutionResult[]): Message[] {
    return results.map((result) => {
      const content = result.success
        ? this.formatSuccessResult(result)
        : this.formatErrorResult(result);

      return {
        role: 'tool' as const,
        content,
        toolCallId: result.toolCallId,
      };
    });
  }

  /**
   * Format successful tool result for LLM
   */
  private formatSuccessResult(result: ToolExecutionResult): string {
    if (typeof result.result === 'string') {
      return result.result;
    }

    try {
      return JSON.stringify(result.result, null, 2);
    } catch {
      return String(result.result);
    }
  }

  /**
   * Format error result for LLM
   */
  private formatErrorResult(result: ToolExecutionResult): string {
    return JSON.stringify(
      {
        error: result.error || 'Tool execution failed',
        toolName: result.toolName,
        executionTime: result.executionTime,
      },
      null,
      2,
    );
  }

  /**
   * Parse tool arguments from JSON string
   */
  private parseToolArguments(argumentsStr: string): any {
    try {
      return JSON.parse(argumentsStr);
    } catch (error) {
      this.logger.warn(`Failed to parse tool arguments: ${argumentsStr}`);
      // Return as object with raw string if parsing fails
      return { raw: argumentsStr };
    }
  }

  /**
   * Validate tool availability before execution
   */
  async validateToolAvailability(toolName: string): Promise<boolean> {
    if (!this.mcpRegistry.getTool) {
      // If registry doesn't support getTool, assume available
      return true;
    }

    try {
      const tool = this.mcpRegistry.getTool(toolName);
      return tool !== null && tool !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get available tools list
   */
  getAvailableTools(): string[] {
    if (!this.mcpRegistry.listTools) {
      return [];
    }

    try {
      return this.mcpRegistry.listTools();
    } catch (error) {
      this.logger.warn('Failed to list available tools', error);
      return [];
    }
  }
}
