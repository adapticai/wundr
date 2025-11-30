/**
 * Anthropic Claude Provider Implementation
 *
 * Implements the LLMClient interface for Anthropic's Claude models.
 * Supports Claude 3.5 Sonnet, Claude 3 Opus, and Claude 3 Haiku with tool use and streaming.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  Tool as AnthropicTool,
  TextBlock,
  ToolUseBlock,
  ContentBlock,
  MessageStreamEvent,
  MessageParam,
} from '@anthropic-ai/sdk/resources/messages';

import type {
  LLMClient,
  LLMClientConfig,
  ChatParams,
  ChatResponse,
  ChatChunk,
  Message,
  ToolDefinition,
  ToolCall,
  TokenUsage,
  FinishReason,
} from '../client';

import {
  LLMError,
  LLMAuthenticationError,
  LLMRateLimitError,
  LLMQuotaExceededError,
  LLMInvalidRequestError,
  LLMNetworkError,
} from '../client';

/**
 * Supported Anthropic Claude models
 */
export const ANTHROPIC_MODELS = {
  CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20241022',
  CLAUDE_3_5_SONNET_LEGACY: 'claude-3-5-sonnet-20240620',
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
} as const;

/**
 * Anthropic-specific configuration
 */
export interface AnthropicClientConfig extends LLMClientConfig {
  /** Anthropic API version (defaults to latest) */
  apiVersion?: string;
  /** Default model to use if not specified in requests */
  defaultModel?: string;
}

/**
 * Anthropic Claude LLM Client
 *
 * Provides integration with Anthropic's Claude models through the Messages API.
 */
export class AnthropicClient implements LLMClient {
  readonly provider = 'anthropic';
  private client: Anthropic;
  private config: AnthropicClientConfig;

  constructor(config: AnthropicClientConfig) {
    this.config = config;

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
      defaultHeaders: config.headers,
    });
  }

  /**
   * Generate a chat completion
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    try {
      const { systemMessage, messages } = this.convertMessages(params.messages);
      const tools = params.tools ? this.convertTools(params.tools) : undefined;

      const requestParams: MessageCreateParamsNonStreaming = {
        model: params.model || this.config.defaultModel || ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
        max_tokens: params.maxTokens || 4096,
        messages,
        ...(systemMessage && { system: systemMessage }),
        ...(tools && tools.length > 0 && { tools }),
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.topP !== undefined && { top_p: params.topP }),
        ...(params.stop && { stop_sequences: params.stop }),
      };

      const response = await this.client.messages.create(requestParams);

      return this.convertResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate a streaming chat completion
   */
  async *chatStream(params: ChatParams): AsyncIterableIterator<ChatChunk> {
    try {
      const { systemMessage, messages } = this.convertMessages(params.messages);
      const tools = params.tools ? this.convertTools(params.tools) : undefined;

      const requestParams: MessageCreateParamsStreaming = {
        model: params.model || this.config.defaultModel || ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
        max_tokens: params.maxTokens || 4096,
        messages,
        stream: true,
        ...(systemMessage && { system: systemMessage }),
        ...(tools && tools.length > 0 && { tools }),
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.topP !== undefined && { top_p: params.topP }),
        ...(params.stop && { stop_sequences: params.stop }),
      };

      const stream = await this.client.messages.stream(requestParams);

      let messageId = '';
      let currentToolCalls: Map<number, Partial<ToolCall>> = new Map();

      for await (const event of stream) {
        const chunk = this.convertStreamEvent(event, currentToolCalls);

        if (chunk) {
          if (chunk.id) {
            messageId = chunk.id;
          }
          yield chunk;
        }
      }

      // Get final message for usage stats
      const finalMessage = await stream.finalMessage();

      yield {
        id: messageId,
        delta: '',
        finishReason: this.convertStopReason(finalMessage.stop_reason),
        usage: this.convertUsage(finalMessage.usage),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Count tokens in a message or text
   *
   * Note: Anthropic doesn't provide a direct token counting API.
   * This uses a rough estimation based on character count.
   * For accurate counts, make an actual API call with max_tokens=1.
   */
  async countTokens(input: string | Message[], model: string): Promise<number> {
    // Anthropic's rough estimate: ~4 characters per token for English text
    const CHARS_PER_TOKEN = 4;

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

    return Math.ceil(charCount / CHARS_PER_TOKEN);
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    return Object.values(ANTHROPIC_MODELS);
  }

  /**
   * Validate API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      // Make a minimal API call to validate credentials
      await this.client.messages.create({
        model: ANTHROPIC_MODELS.CLAUDE_3_HAIKU,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        return false;
      }
      throw this.handleError(error);
    }
  }

  /**
   * Convert messages from LLMClient format to Anthropic format
   */
  private convertMessages(messages: Message[]): {
    systemMessage?: string;
    messages: MessageParam[];
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemMessage = systemMessages.map((m) => m.content).join('\n') || undefined;

    const anthropicMessages: MessageParam[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        continue; // System messages handled separately
      }

      if (message.role === 'tool') {
        // Tool result message
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: message.toolCallId!,
              content: message.content,
            },
          ],
        });
      } else if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
        // Assistant message with tool calls
        const content: Array<TextBlock | ToolUseBlock> = [];

        if (message.content) {
          content.push({
            type: 'text',
            text: message.content,
          });
        }

        for (const toolCall of message.toolCalls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.name,
            input: JSON.parse(toolCall.arguments),
          });
        }

        anthropicMessages.push({
          role: 'assistant',
          content,
        });
      } else {
        // Regular user/assistant message
        anthropicMessages.push({
          role: message.role === 'user' ? 'user' : 'assistant',
          content: message.content,
        });
      }
    }

    return { systemMessage, messages: anthropicMessages };
  }

  /**
   * Convert tools from LLMClient format to Anthropic format
   */
  private convertTools(tools: ToolDefinition[]): AnthropicTool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  /**
   * Convert Anthropic response to LLMClient format
   */
  private convertResponse(response: Anthropic.Message): ChatResponse {
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content += (block as TextBlock).text;
      } else if (block.type === 'tool_use') {
        const toolBlock = block as ToolUseBlock;
        toolCalls.push({
          id: toolBlock.id,
          name: toolBlock.name,
          arguments: JSON.stringify(toolBlock.input),
        });
      }
    }

    return {
      id: response.id,
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: this.convertUsage(response.usage),
      finishReason: this.convertStopReason(response.stop_reason),
      raw: response,
    };
  }

  /**
   * Convert streaming event to chat chunk
   */
  private convertStreamEvent(
    event: MessageStreamEvent,
    currentToolCalls: Map<number, Partial<ToolCall>>
  ): ChatChunk | null {
    switch (event.type) {
      case 'message_start':
        return {
          id: event.message.id,
          delta: '',
        };

      case 'content_block_start':
        if (event.content_block.type === 'tool_use') {
          const toolBlock = event.content_block as ToolUseBlock;
          currentToolCalls.set(event.index, {
            id: toolBlock.id,
            name: toolBlock.name,
          });
        }
        return null;

      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          return {
            id: '',
            delta: event.delta.text,
          };
        } else if (event.delta.type === 'input_json_delta') {
          const toolCall = currentToolCalls.get(event.index);
          if (toolCall) {
            toolCall.arguments = (toolCall.arguments || '') + event.delta.partial_json;
            return {
              id: '',
              delta: '',
              toolCallDeltas: [toolCall],
            };
          }
        }
        return null;

      case 'content_block_stop':
        return null;

      case 'message_delta':
        return null;

      case 'message_stop':
        return null;

      default:
        return null;
    }
  }

  /**
   * Convert Anthropic stop reason to LLMClient finish reason
   */
  private convertStopReason(stopReason: string | null): FinishReason {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }

  /**
   * Convert usage statistics
   */
  private convertUsage(usage: { input_tokens: number; output_tokens: number }): TokenUsage {
    return {
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
    };
  }

  /**
   * Handle and convert Anthropic errors to LLMClient errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof Anthropic.APIError) {
      const statusCode = error.status;
      const message = error.message;

      if (error instanceof Anthropic.AuthenticationError) {
        return new LLMAuthenticationError(message, this.provider);
      }

      if (error instanceof Anthropic.RateLimitError) {
        const retryAfter = error.headers?.['retry-after']
          ? parseInt(error.headers['retry-after'], 10)
          : undefined;
        return new LLMRateLimitError(message, this.provider, retryAfter);
      }

      if (statusCode === 429) {
        if (message.toLowerCase().includes('quota')) {
          return new LLMQuotaExceededError(message, this.provider);
        }
        return new LLMRateLimitError(message, this.provider);
      }

      if (statusCode === 400 || error instanceof Anthropic.BadRequestError) {
        return new LLMInvalidRequestError(message, this.provider);
      }

      if (error instanceof Anthropic.APIConnectionError) {
        return new LLMNetworkError(message, this.provider);
      }

      return new LLMError(message, 'API_ERROR', statusCode, this.provider);
    }

    if (error instanceof Error) {
      return new LLMError(error.message, 'UNKNOWN_ERROR', undefined, this.provider);
    }

    return new LLMError('Unknown error occurred', 'UNKNOWN_ERROR', undefined, this.provider);
  }
}
