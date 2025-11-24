/**
 * LLM Node - LLM-based decision and generation node
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
  LLMRequest,
  LLMResponse,
  Tool,
} from '../types';

/**
 * Configuration for LLM node
 */
export interface LLMNodeConfig {
  /** Model to use (provider-specific) */
  readonly model?: string;
  /** System prompt for the LLM */
  readonly systemPrompt?: string;
  /** Temperature for generation */
  readonly temperature?: number;
  /** Maximum tokens to generate */
  readonly maxTokens?: number;
  /** Stop sequences */
  readonly stop?: string[];
  /** Available tools for the LLM */
  readonly tools?: Tool[];
  /** Whether to stream the response */
  readonly stream?: boolean;
  /** Custom prompt template */
  readonly promptTemplate?: (state: AgentState) => string;
  /** Post-processing function for response */
  readonly postProcess?: (
    response: LLMResponse,
    state: AgentState
  ) => Partial<AgentState>;
  /** Routing function to determine next node based on response */
  readonly router?: (
    response: LLMResponse,
    state: AgentState
  ) => string | undefined;
}

/**
 * Schema for LLM node configuration validation
 */
export const LLMNodeConfigSchema = z.object({
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
  stop: z.array(z.string()).optional(),
  stream: z.boolean().optional(),
});

/**
 * Create an LLM node for the workflow graph
 *
 * @example
 * ```typescript
 * const llmNode = createLLMNode({
 *   id: 'agent',
 *   name: 'Agent Node',
 *   config: {
 *     model: 'claude-3-sonnet-20240229',
 *     systemPrompt: 'You are a helpful assistant.',
 *     temperature: 0.7
 *   }
 * });
 *
 * graph.addNode('agent', llmNode);
 * ```
 *
 * @param options - Node creation options
 * @returns NodeDefinition for use in StateGraph
 */
export function createLLMNode<TState extends AgentState = AgentState>(options: {
  id: string;
  name: string;
  config: LLMNodeConfig;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  const { id, name, config, nodeConfig = {} } = options;

  return {
    id,
    name,
    type: 'llm',
    config: nodeConfig,
    execute: async (
      state: TState,
      context: NodeContext,
    ): Promise<NodeResult<TState>> => {
      const llmProvider = context.services.llmProvider;

      if (!llmProvider) {
        throw new Error('LLM provider not configured in node services');
      }

      // Build messages for the request
      const messages = buildMessages(state, config);

      // Build the request
      const request: LLMRequest = {
        messages,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        stop: config.stop,
        tools: config.tools,
      };

      context.services.logger.debug('Sending LLM request', {
        model: config.model,
        messageCount: messages.length,
        hasTools: Boolean(config.tools?.length),
      });

      // Execute the request
      const response = await llmProvider.generate(request);

      context.services.logger.debug('Received LLM response', {
        model: response.model,
        finishReason: response.finishReason,
        tokensUsed: response.usage.totalTokens,
      });

      // Build updated state
      const newMessages: Message[] = [...state.messages, response.message];

      let newData = { ...state.data };

      // Apply post-processing if configured
      if (config.postProcess) {
        const processed = config.postProcess(response, state);
        newData = { ...newData, ...processed.data };
      }

      // Update token count in metadata
      const tokensUsed =
        (state.metadata.tokensUsed ?? 0) + response.usage.totalTokens;

      const newState: TState = {
        ...state,
        messages: newMessages,
        data: newData,
        metadata: {
          ...state.metadata,
          tokensUsed,
        },
      } as TState;

      // Determine next node
      let next: string | undefined;

      // Check if there are tool calls - if so, route to tool node
      if (
        response.finishReason === 'tool_calls' &&
        response.message.toolCalls?.length
      ) {
        // Store tool calls in state for tool node to process
        newState.data['pendingToolCalls'] = response.message.toolCalls;
        next = 'tools'; // Default name for tool node
      } else if (config.router) {
        next = config.router(response, state);
      }

      return {
        state: newState,
        next,
        metadata: {
          duration: 0, // Will be set by executor
          tokensUsed: response.usage.totalTokens,
          toolCalls: response.message.toolCalls,
        },
      };
    },
  };
}

/**
 * Build messages array for LLM request
 */
function buildMessages(state: AgentState, config: LLMNodeConfig): Message[] {
  const messages: Message[] = [];

  // Add system prompt if configured
  if (config.systemPrompt) {
    messages.push({
      id: uuidv4(),
      role: 'system',
      content: config.systemPrompt,
      timestamp: new Date(),
    });
  }

  // Add existing messages from state
  messages.push(...state.messages);

  // If there's a custom prompt template, add it as a user message
  if (config.promptTemplate) {
    const prompt = config.promptTemplate(state);
    messages.push({
      id: uuidv4(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    });
  }

  return messages;
}

/**
 * Create a router function for LLM decision-making
 *
 * @example
 * ```typescript
 * const router = createLLMRouter({
 *   routes: {
 *     'continue': 'process-node',
 *     'finish': 'end-node',
 *     'error': 'error-handler'
 *   },
 *   defaultRoute: 'continue',
 *   extractDecision: (response) => {
 *     const content = response.message.content;
 *     if (content.includes('DONE')) return 'finish';
 *     if (content.includes('ERROR')) return 'error';
 *     return 'continue';
 *   }
 * });
 * ```
 *
 * @param options - Router configuration
 * @returns Router function for use in LLM node config
 */
export function createLLMRouter<
  TState extends AgentState = AgentState,
>(options: {
  routes: Record<string, string>;
  defaultRoute?: string;
  extractDecision: (response: LLMResponse, state: TState) => string;
}): (response: LLMResponse, state: TState) => string | undefined {
  return (response: LLMResponse, state: TState): string | undefined => {
    const decision = options.extractDecision(response, state);
    return options.routes[decision] ?? options.defaultRoute;
  };
}

/**
 * Create a structured output LLM node that validates responses
 *
 * @example
 * ```typescript
 * const responseSchema = z.object({
 *   action: z.enum(['search', 'answer', 'clarify']),
 *   content: z.string(),
 *   confidence: z.number()
 * });
 *
 * const structuredNode = createStructuredLLMNode({
 *   id: 'structured-agent',
 *   name: 'Structured Agent',
 *   config: {
 *     model: 'claude-3-sonnet-20240229',
 *     systemPrompt: 'Respond in JSON format with action, content, and confidence fields.'
 *   },
 *   outputSchema: responseSchema,
 *   stateMapper: (parsed) => ({ agentDecision: parsed })
 * });
 * ```
 *
 * @param options - Structured node options
 * @returns NodeDefinition for use in StateGraph
 */
export function createStructuredLLMNode<
  TState extends AgentState = AgentState,
  TOutput = unknown,
>(options: {
  id: string;
  name: string;
  config: LLMNodeConfig;
  outputSchema: z.ZodSchema<TOutput>;
  stateMapper: (parsed: TOutput) => Partial<TState['data']>;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  const {
    id,
    name,
    config,
    outputSchema,
    stateMapper,
    nodeConfig = {},
  } = options;

  const baseNode = createLLMNode<TState>({
    id,
    name,
    config: {
      ...config,
      postProcess: (response, state) => {
        // Try to parse JSON from response
        const content = response.message.content;
        let parsed: TOutput;

        try {
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const raw = JSON.parse(jsonMatch[0]);
            parsed = outputSchema.parse(raw);
          } else {
            throw new Error('No JSON object found in response');
          }
        } catch (error) {
          throw new Error(
            `Failed to parse structured output: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // Map parsed output to state
        const mappedData = stateMapper(parsed);
        return { data: { ...state.data, ...mappedData } };
      },
    },
    nodeConfig,
  });

  return {
    ...baseNode,
    outputSchema,
  };
}

/**
 * Create a conversational LLM node that maintains chat history
 *
 * @example
 * ```typescript
 * const chatNode = createConversationalLLMNode({
 *   id: 'chat',
 *   name: 'Chat Node',
 *   config: {
 *     model: 'claude-3-sonnet-20240229',
 *     systemPrompt: 'You are a helpful assistant.'
 *   },
 *   maxHistoryLength: 10
 * });
 * ```
 *
 * @param options - Conversational node options
 * @returns NodeDefinition for use in StateGraph
 */
export function createConversationalLLMNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  config: LLMNodeConfig;
  maxHistoryLength?: number;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  const { id, name, config, maxHistoryLength = 50, nodeConfig = {} } = options;

  return {
    id,
    name,
    type: 'llm',
    config: nodeConfig,
    execute: async (
      state: TState,
      context: NodeContext,
    ): Promise<NodeResult<TState>> => {
      const llmProvider = context.services.llmProvider;

      if (!llmProvider) {
        throw new Error('LLM provider not configured in node services');
      }

      // Trim history if needed
      let historyMessages = state.messages;
      if (historyMessages.length > maxHistoryLength) {
        // Keep system message if present, then most recent messages
        const systemMessages = historyMessages.filter(m => m.role === 'system');
        const nonSystemMessages = historyMessages.filter(
          m => m.role !== 'system',
        );
        const trimmedNonSystem = nonSystemMessages.slice(-maxHistoryLength);
        historyMessages = [...systemMessages, ...trimmedNonSystem];
      }

      // Build messages
      const messages: Message[] = [];

      if (config.systemPrompt) {
        messages.push({
          id: uuidv4(),
          role: 'system',
          content: config.systemPrompt,
          timestamp: new Date(),
        });
      }

      messages.push(...historyMessages.filter(m => m.role !== 'system'));

      const request: LLMRequest = {
        messages,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        stop: config.stop,
        tools: config.tools,
      };

      const response = await llmProvider.generate(request);

      const newMessages = [...state.messages, response.message];
      const tokensUsed =
        (state.metadata.tokensUsed ?? 0) + response.usage.totalTokens;

      const newState: TState = {
        ...state,
        messages: newMessages,
        metadata: {
          ...state.metadata,
          tokensUsed,
        },
      } as TState;

      return {
        state: newState,
        metadata: {
          duration: 0,
          tokensUsed: response.usage.totalTokens,
        },
      };
    },
  };
}
