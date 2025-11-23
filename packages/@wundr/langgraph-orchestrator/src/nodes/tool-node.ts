/**
 * Tool Node - Tool execution node for agent workflows
 * @module @wundr.io/langgraph-orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import type {
  AgentState,
  NodeDefinition,
  NodeContext,
  NodeResult,
  Message,
  Tool,
  ToolCall,
  ToolResult,
  ToolRegistry,
} from '../types';

/**
 * Configuration for tool node
 */
export interface ToolNodeConfig {
  /** Available tools (if not using registry) */
  readonly tools?: Tool[];
  /** Whether to execute tools in parallel */
  readonly parallel?: boolean;
  /** Maximum concurrent tool executions */
  readonly maxConcurrency?: number;
  /** Timeout per tool execution in milliseconds */
  readonly toolTimeout?: number;
  /** Whether to continue on tool error */
  readonly continueOnError?: boolean;
  /** Custom error handler */
  readonly onError?: (error: Error, toolCall: ToolCall) => ToolResult;
  /** Post-processing for tool results */
  readonly postProcess?: (
    results: ToolResult[],
    state: AgentState
  ) => Partial<AgentState['data']>;
}

/**
 * Schema for tool node configuration validation
 */
export const ToolNodeConfigSchema = z.object({
  parallel: z.boolean().optional(),
  maxConcurrency: z.number().min(1).optional(),
  toolTimeout: z.number().min(0).optional(),
  continueOnError: z.boolean().optional(),
});

/**
 * Create a tool execution node
 *
 * @example
 * ```typescript
 * const toolNode = createToolNode({
 *   id: 'tools',
 *   name: 'Tool Executor',
 *   config: {
 *     parallel: true,
 *     maxConcurrency: 3,
 *     continueOnError: true
 *   }
 * });
 *
 * graph.addNode('tools', toolNode);
 * ```
 *
 * @param options - Node creation options
 * @returns NodeDefinition for use in StateGraph
 */
export function createToolNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  config?: ToolNodeConfig;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  const { id, name, config = {}, nodeConfig = {} } = options;

  return {
    id,
    name,
    type: 'tool',
    config: nodeConfig,
    execute: async (
      state: TState,
      context: NodeContext
    ): Promise<NodeResult<TState>> => {
      // Get pending tool calls from state
      const pendingToolCalls = state.data['pendingToolCalls'] as
        | ToolCall[]
        | undefined;

      if (!pendingToolCalls || pendingToolCalls.length === 0) {
        context.services.logger.warn(
          'Tool node executed with no pending tool calls'
        );
        return { state };
      }

      context.services.logger.debug('Executing tool calls', {
        count: pendingToolCalls.length,
        tools: pendingToolCalls.map(tc => tc.name),
      });

      // Get tools from config or registry
      const tools =
        config.tools ?? getToolsFromRegistry(context.services.toolRegistry);
      const toolMap = new Map(tools.map(t => [t.name, t]));

      // Execute tool calls
      const results: ToolResult[] = await executeToolCalls(
        pendingToolCalls,
        toolMap,
        config,
        context
      );

      // Build tool result messages
      const toolMessages: Message[] = results.map(result => ({
        id: uuidv4(),
        role: 'tool' as const,
        content: result.content,
        toolResult: result,
        timestamp: new Date(),
      }));

      // Build updated state
      let newData = { ...state.data };
      delete newData['pendingToolCalls']; // Clear pending calls

      // Store results in state
      newData['lastToolResults'] = results;

      // Apply post-processing if configured
      if (config.postProcess) {
        const processed = config.postProcess(results, state);
        newData = { ...newData, ...processed };
      }

      const newState: TState = {
        ...state,
        messages: [...state.messages, ...toolMessages],
        data: newData,
      } as TState;

      // Check if all tools succeeded
      const _allSucceeded = results.every(r => r.success);
      const hasErrors = results.some(r => !r.success);

      context.services.logger.debug('Tool execution complete', {
        total: results.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });

      return {
        state: newState,
        // If there were errors and we're not continuing, route to error handler
        next: hasErrors && !config.continueOnError ? 'error' : undefined,
        metadata: {
          duration: 0,
          toolCalls: pendingToolCalls,
        },
      };
    },
  };
}

/**
 * Execute tool calls with concurrency control
 */
async function executeToolCalls(
  toolCalls: ToolCall[],
  toolMap: Map<string, Tool>,
  config: ToolNodeConfig,
  context: NodeContext
): Promise<ToolResult[]> {
  if (config.parallel) {
    return executeParallel(toolCalls, toolMap, config, context);
  }
  return executeSequential(toolCalls, toolMap, config, context);
}

/**
 * Execute tool calls sequentially
 */
async function executeSequential(
  toolCalls: ToolCall[],
  toolMap: Map<string, Tool>,
  config: ToolNodeConfig,
  context: NodeContext
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    const result = await executeSingleTool(toolCall, toolMap, config, context);
    results.push(result);

    // Stop if there's an error and we're not continuing on error
    if (!result.success && !config.continueOnError) {
      break;
    }
  }

  return results;
}

/**
 * Execute tool calls in parallel with concurrency limit
 */
async function executeParallel(
  toolCalls: ToolCall[],
  toolMap: Map<string, Tool>,
  config: ToolNodeConfig,
  context: NodeContext
): Promise<ToolResult[]> {
  const maxConcurrency = config.maxConcurrency ?? 5;
  const results: ToolResult[] = [];
  const executing: Promise<ToolResult>[] = [];

  for (const toolCall of toolCalls) {
    const promise = executeSingleTool(toolCall, toolMap, config, context);
    executing.push(promise);

    if (executing.length >= maxConcurrency) {
      const result = await Promise.race(executing);
      results.push(result);
      const index = executing.indexOf(promise);
      if (index > -1) {
        executing.splice(index, 1);
      }
    }
  }

  // Wait for remaining executions
  const remaining = await Promise.all(executing);
  results.push(...remaining);

  return results;
}

/**
 * Execute a single tool call
 */
async function executeSingleTool(
  toolCall: ToolCall,
  toolMap: Map<string, Tool>,
  config: ToolNodeConfig,
  context: NodeContext
): Promise<ToolResult> {
  const tool = toolMap.get(toolCall.name);

  if (!tool) {
    const error = new Error(`Tool "${toolCall.name}" not found`);
    if (config.onError) {
      return config.onError(error, toolCall);
    }
    return {
      toolCallId: toolCall.id,
      content: `Error: Tool "${toolCall.name}" not found`,
      success: false,
      error: error.message,
    };
  }

  try {
    // Validate input if schema provided
    if (tool.inputSchema) {
      tool.inputSchema.parse(toolCall.arguments);
    }

    // Execute with timeout if configured
    const result = config.toolTimeout
      ? await executeWithTimeout(tool, toolCall.arguments, config.toolTimeout)
      : await tool.execute(toolCall.arguments);

    // Validate output if schema provided
    if (tool.outputSchema) {
      tool.outputSchema.parse(result);
    }

    context.services.logger.debug('Tool executed successfully', {
      tool: toolCall.name,
      callId: toolCall.id,
    });

    return {
      toolCallId: toolCall.id,
      content: typeof result === 'string' ? result : JSON.stringify(result),
      success: true,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    context.services.logger.error('Tool execution failed', {
      tool: toolCall.name,
      callId: toolCall.id,
      error: err.message,
    });

    if (config.onError) {
      return config.onError(err, toolCall);
    }

    return {
      toolCallId: toolCall.id,
      content: `Error executing tool "${toolCall.name}": ${err.message}`,
      success: false,
      error: err.message,
    };
  }
}

/**
 * Execute tool with timeout
 */
async function executeWithTimeout(
  tool: Tool,
  args: Record<string, unknown>,
  timeout: number
): Promise<unknown> {
  return Promise.race([
    tool.execute(args),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Tool execution timed out after ${timeout}ms`)),
        timeout
      )
    ),
  ]);
}

/**
 * Get tools from registry
 */
function getToolsFromRegistry(registry?: ToolRegistry): Tool[] {
  if (!registry) {
    return [];
  }
  return registry.list();
}

/**
 * Create a simple in-memory tool registry
 *
 * @example
 * ```typescript
 * const registry = createToolRegistry();
 * registry.register({
 *   name: 'search',
 *   description: 'Search the web',
 *   inputSchema: z.object({ query: z.string() }),
 *   execute: async ({ query }) => searchWeb(query)
 * });
 *
 * graph.setServices({ toolRegistry: registry });
 * ```
 *
 * @returns ToolRegistry implementation
 */
export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, Tool>();

  return {
    get(name: string): Tool | undefined {
      return tools.get(name);
    },

    list(): Tool[] {
      return Array.from(tools.values());
    },

    register(tool: Tool): void {
      if (tools.has(tool.name)) {
        throw new Error(`Tool "${tool.name}" is already registered`);
      }
      tools.set(tool.name, tool);
    },

    unregister(name: string): void {
      tools.delete(name);
    },
  };
}

/**
 * Create a tool definition with type-safe input/output
 *
 * @example
 * ```typescript
 * const searchTool = createTool({
 *   name: 'search',
 *   description: 'Search the web for information',
 *   inputSchema: z.object({
 *     query: z.string(),
 *     maxResults: z.number().optional()
 *   }),
 *   outputSchema: z.array(z.object({
 *     title: z.string(),
 *     url: z.string(),
 *     snippet: z.string()
 *   })),
 *   execute: async ({ query, maxResults = 10 }) => {
 *     return await searchWeb(query, maxResults);
 *   }
 * });
 * ```
 *
 * @param options - Tool definition options
 * @returns Tool definition
 */
export function createTool<TInput, TOutput = unknown>(options: {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema?: z.ZodSchema<TOutput>;
  execute: (input: TInput) => Promise<TOutput>;
}): Tool {
  return {
    name: options.name,
    description: options.description,
    inputSchema: options.inputSchema,
    outputSchema: options.outputSchema,
    execute: async (input: unknown): Promise<unknown> => {
      const parsed = options.inputSchema.parse(input);
      return options.execute(parsed);
    },
  };
}

/**
 * Create a batch tool node that groups tool calls
 *
 * @example
 * ```typescript
 * const batchToolNode = createBatchToolNode({
 *   id: 'batch-tools',
 *   name: 'Batch Tool Executor',
 *   config: {
 *     batchSize: 5,
 *     batchTimeout: 1000
 *   }
 * });
 * ```
 *
 * @param options - Node creation options
 * @returns NodeDefinition for use in StateGraph
 */
export function createBatchToolNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  config?: ToolNodeConfig & {
    batchSize?: number;
    batchTimeout?: number;
  };
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  const { id, name, config = {}, nodeConfig = {} } = options;
  const batchSize = config.batchSize ?? 10;

  return {
    id,
    name,
    type: 'tool',
    config: nodeConfig,
    execute: async (
      state: TState,
      context: NodeContext
    ): Promise<NodeResult<TState>> => {
      const pendingToolCalls = state.data['pendingToolCalls'] as
        | ToolCall[]
        | undefined;

      if (!pendingToolCalls || pendingToolCalls.length === 0) {
        return { state };
      }

      const tools =
        config.tools ?? getToolsFromRegistry(context.services.toolRegistry);
      const toolMap = new Map(tools.map(t => [t.name, t]));

      // Process in batches
      const batches: ToolCall[][] = [];
      for (let i = 0; i < pendingToolCalls.length; i += batchSize) {
        batches.push(pendingToolCalls.slice(i, i + batchSize));
      }

      const allResults: ToolResult[] = [];

      for (const batch of batches) {
        const results = await executeParallel(batch, toolMap, config, context);
        allResults.push(...results);
      }

      // Build tool result messages
      const toolMessages: Message[] = allResults.map(result => ({
        id: uuidv4(),
        role: 'tool' as const,
        content: result.content,
        toolResult: result,
        timestamp: new Date(),
      }));

      const newData = { ...state.data };
      delete newData['pendingToolCalls'];
      newData['lastToolResults'] = allResults;

      const newState: TState = {
        ...state,
        messages: [...state.messages, ...toolMessages],
        data: newData,
      } as TState;

      return { state: newState };
    },
  };
}
