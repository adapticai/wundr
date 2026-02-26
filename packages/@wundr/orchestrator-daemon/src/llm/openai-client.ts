/**
 * OpenAI LLM Client for Orchestrator Daemon
 *
 * Implements the LLMClient interface using @adaptic/lumic-utils.
 * Provides real LLM integration for agent orchestration and session management.
 */

import { lumic } from '@adaptic/lumic-utils';

import type {
  LLMClient,
  ChatParams,
  ChatResponse,
  ChatChunk,
  Message,
  ToolDefinition,
  ToolCall,
  FinishReason,
} from '../types/llm';
import type {
  LLMResponse,
  LLMOptions,
} from '@adaptic/lumic-utils/dist/types/openai-types';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat';

/**
 * Configuration for OpenAI client
 */
export interface OpenAIClientConfig {
  /** OpenAI API key */
  apiKey?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Temperature for sampling (0.0 - 2.0) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * OpenAI Client implementing LLMClient interface
 */
export class OpenAIClient implements LLMClient {
  readonly provider = 'openai';
  private config: OpenAIClientConfig;
  private defaultModel: string;

  constructor(config: OpenAIClientConfig = {}) {
    this.config = {
      defaultModel: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 4096,
      debug: false,
      ...config,
    };
    this.defaultModel = this.config.defaultModel!;

    if (this.config.debug) {
      console.log('[OpenAIClient] Initialized with config:', {
        defaultModel: this.defaultModel,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });
    }
  }

  /**
   * Generate a chat completion
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    try {
      const model = params.model || this.defaultModel;
      const messages = this.convertMessages(params.messages);
      const tools = params.tools ? this.convertTools(params.tools) : undefined;

      const options: LLMOptions = {
        model: model as any,
        temperature: params.temperature ?? this.config.temperature,
        max_completion_tokens: params.maxTokens ?? this.config.maxTokens,
        top_p: params.topP,
        frequency_penalty: params.frequencyPenalty,
        presence_penalty: params.presencePenalty,
        tools,
        context: messages.slice(0, -1), // All messages except the last one
        apiKey: this.config.apiKey,
      };

      // Get the last message content
      const lastMessage = messages[messages.length - 1];
      const content =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      if (this.config.debug) {
        console.log('[OpenAIClient] Making LLM call:', {
          model,
          messageCount: messages.length,
          hasTools: !!tools,
        });
      }

      // Make the call using lumic-utils
      const response: LLMResponse<string> = await lumic.llm.call(
        content,
        'text',
        options
      );

      if (this.config.debug) {
        console.log('[OpenAIClient] Received response:', {
          usage: response.usage,
          hasToolCalls: !!response.tool_calls,
        });
      }

      return this.convertResponse(response);
    } catch (error) {
      console.error('[OpenAIClient] Error during chat completion:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate a streaming chat completion
   *
   * Note: lumic-utils doesn't expose streaming API directly, so we use regular chat
   * and yield the complete response as a single chunk.
   */
  async *chatStream(params: ChatParams): AsyncIterableIterator<ChatChunk> {
    try {
      const response = await this.chat(params);

      // Yield a single chunk with the complete response
      yield {
        id: response.id,
        delta: response.content,
        toolCallDeltas: response.toolCalls?.map((tc: ToolCall) => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        })),
        finishReason: response.finishReason,
        usage: response.usage,
      };
    } catch (error) {
      console.error('[OpenAIClient] Error during streaming chat:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Count tokens in a message or text
   *
   * Uses a simple estimation based on character count.
   * For production, consider integrating tiktoken or similar.
   */
  async countTokens(
    input: string | Message[],
    _model: string
  ): Promise<number> {
    let charCount = 0;

    if (typeof input === 'string') {
      charCount = input.length;
    } else {
      for (const msg of input) {
        charCount += msg.content.length;
        if (msg.toolCalls) {
          charCount += JSON.stringify(msg.toolCalls).length;
        }
      }
    }

    // Rough estimation: 4 characters per token
    return Math.ceil(charCount / 4);
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    // Return common GPT models
    // lumic-utils doesn't expose a list models function
    return [
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4o',
      'gpt-4o-mini',
    ];
  }

  /**
   * Validate API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      // Make a minimal API call to validate credentials
      await this.chat({
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 5,
      });
      return true;
    } catch (error) {
      console.error('[OpenAIClient] Credential validation failed:', error);
      return false;
    }
  }

  /**
   * Convert our Message format to OpenAI format
   */
  private convertMessages(messages: Message[]): ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.toolCallId!,
        };
      }

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: 'assistant' as const,
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc: ToolCall) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        };
      }

      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    });
  }

  /**
   * Convert our ToolDefinition format to OpenAI format
   */
  private convertTools(tools: ToolDefinition[]): ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Convert lumic-utils response to our ChatResponse format
   */
  private convertResponse(response: LLMResponse<string>): ChatResponse {
    // Extract tool calls if present
    const toolCalls: ToolCall[] = response.tool_calls
      ? response.tool_calls.map(
          (tc: {
            id: string;
            function?: { name: string; arguments: string };
          }) => {
            // Handle both function and custom tool call types
            const functionData = 'function' in tc ? tc.function : null;
            return {
              id: tc.id,
              name: functionData?.name || '',
              arguments: functionData?.arguments || '',
            };
          }
        )
      : [];

    // Generate a unique ID for this response
    const id = `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Determine finish reason
    let finishReason: FinishReason = 'stop';
    if (toolCalls.length > 0) {
      finishReason = 'tool_calls';
    } else if (
      response.usage.completion_tokens >= (this.config.maxTokens || 4096)
    ) {
      finishReason = 'length';
    }

    return {
      id,
      content: response.response || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens:
          response.usage.prompt_tokens + response.usage.completion_tokens,
      },
      finishReason,
      raw: response,
    };
  }

  /**
   * Handle and convert errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      // Check for specific error patterns
      const message = error.message.toLowerCase();

      if (message.includes('api key') || message.includes('authentication')) {
        return new Error(`OpenAI Authentication Error: ${error.message}`);
      }

      if (message.includes('rate limit')) {
        return new Error(`OpenAI Rate Limit Error: ${error.message}`);
      }

      if (message.includes('quota')) {
        return new Error(`OpenAI Quota Exceeded: ${error.message}`);
      }

      if (message.includes('invalid') || message.includes('bad request')) {
        return new Error(`OpenAI Invalid Request: ${error.message}`);
      }

      if (message.includes('network') || message.includes('timeout')) {
        return new Error(`OpenAI Network Error: ${error.message}`);
      }

      return error;
    }

    return new Error('Unknown error occurred during OpenAI API call');
  }
}

/**
 * Create a default OpenAI client instance
 */
export function createOpenAIClient(config?: OpenAIClientConfig): OpenAIClient {
  return new OpenAIClient(config);
}
