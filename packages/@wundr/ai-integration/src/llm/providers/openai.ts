/**
 * OpenAI LLM Client Implementation
 *
 * Implements the LLMClient interface for OpenAI's GPT models.
 * Supports chat, streaming, function calling, and token counting.
 */

import OpenAI from 'openai';

import {
  LLMClient,
  LLMClientConfig,
  ChatParams,
  ChatResponse,
  ChatChunk,
  Message,
  ToolDefinition,
  ToolCall,
  FinishReason,
  LLMError,
  LLMAuthenticationError,
  LLMRateLimitError,
  LLMQuotaExceededError,
  LLMInvalidRequestError,
  LLMNetworkError,
} from '../client';

import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat';

/**
 * OpenAI model token limits
 */
const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4-1106-preview': 128000,
  'gpt-4-0125-preview': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
};

/**
 * Average characters per token (rough estimation when tiktoken is unavailable)
 */
const CHARS_PER_TOKEN = 4;

/**
 * OpenAI Client implementing LLMClient interface
 */
export class OpenAIClient implements LLMClient {
  readonly provider = 'openai';
  private client: OpenAI;
  private config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      organization: config.organization,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
      defaultHeaders: config.headers,
    });
  }

  /**
   * Generate a chat completion
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    try {
      const openaiParams = this.convertChatParams(
        params,
        false
      ) as ChatCompletionCreateParamsNonStreaming;
      const response = await this.client.chat.completions.create(openaiParams);
      return this.convertChatResponse(response as ChatCompletion);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate a streaming chat completion
   */
  async *chatStream(params: ChatParams): AsyncIterableIterator<ChatChunk> {
    try {
      const openaiParams = this.convertChatParams(
        params,
        true
      ) as ChatCompletionCreateParamsStreaming;
      const stream = await this.client.chat.completions.create(openaiParams);

      let chunkIndex = 0;
      const toolCallBuffers: Map<number, Partial<ToolCall>> = new Map();

      for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
        const converted = this.convertStreamChunk(
          chunk,
          chunkIndex++,
          toolCallBuffers
        );
        if (converted) {
          yield converted;
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Count tokens in a message or text
   */
  async countTokens(input: string | Message[], model: string): Promise<number> {
    try {
      // Try to use tiktoken if available
      try {
        const { encoding_for_model } = await import('tiktoken');
        const encoding = encoding_for_model(model as any);

        let text: string;
        if (typeof input === 'string') {
          text = input;
        } else {
          // Convert messages to text representation
          text = input
            .map(msg => {
              let msgText = `${msg.role}: ${msg.content}`;
              if (msg.toolCalls) {
                msgText += ` [tool_calls: ${JSON.stringify(msg.toolCalls)}]`;
              }
              return msgText;
            })
            .join('\n');
        }

        const tokens = encoding.encode(text);
        encoding.free();
        return tokens.length;
      } catch (tiktokenError) {
        // Fall back to estimation if tiktoken is not available
        console.warn(
          'tiktoken not available, using estimation for token counting'
        );
        return this.estimateTokens(input);
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * List available OpenAI models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data
        .filter(model => model.id.startsWith('gpt-'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Validate API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      if (error instanceof LLMAuthenticationError) {
        return false;
      }
      throw this.handleError(error);
    }
  }

  /**
   * Convert our ChatParams to OpenAI format
   */
  private convertChatParams(
    params: ChatParams,
    stream: boolean
  ):
    | ChatCompletionCreateParamsNonStreaming
    | ChatCompletionCreateParamsStreaming {
    const messages = this.convertMessages(params.messages);
    const tools = params.tools ? this.convertTools(params.tools) : undefined;

    const baseParams = {
      model: params.model,
      messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      top_p: params.topP,
      stop: params.stop,
      frequency_penalty: params.frequencyPenalty,
      presence_penalty: params.presencePenalty,
      ...(params.providerParams || {}),
    };

    if (tools && tools.length > 0) {
      return {
        ...baseParams,
        tools,
        stream,
      } as any;
    }

    return {
      ...baseParams,
      stream,
    } as any;
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
          tool_calls: msg.toolCalls.map(tc => ({
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
   * Convert OpenAI ChatCompletion to our ChatResponse format
   */
  private convertChatResponse(response: ChatCompletion): ChatResponse {
    const choice = response.choices[0];
    const message = choice.message;

    const toolCalls: ToolCall[] = message.tool_calls
      ? message.tool_calls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        }))
      : [];

    return {
      id: response.id,
      content: message.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      finishReason: this.convertFinishReason(choice.finish_reason),
      raw: response,
    };
  }

  /**
   * Convert OpenAI stream chunk to our ChatChunk format
   */
  private convertStreamChunk(
    chunk: ChatCompletionChunk,
    index: number,
    toolCallBuffers: Map<number, Partial<ToolCall>>
  ): ChatChunk | null {
    const choice = chunk.choices[0];
    if (!choice) return null;

    const delta = choice.delta;
    const content = delta.content || '';

    // Handle tool call deltas
    const toolCallDeltas: Partial<ToolCall>[] = [];
    if (delta.tool_calls) {
      for (const toolCallDelta of delta.tool_calls) {
        const idx = toolCallDelta.index;

        // Get or create buffer for this tool call
        let buffer = toolCallBuffers.get(idx);
        if (!buffer) {
          buffer = {
            id: toolCallDelta.id,
            name: '',
            arguments: '',
          };
          toolCallBuffers.set(idx, buffer);
        }

        // Update buffer with delta
        if (toolCallDelta.id) buffer.id = toolCallDelta.id;
        if (toolCallDelta.function?.name)
          buffer.name = toolCallDelta.function.name;
        if (toolCallDelta.function?.arguments) {
          buffer.arguments =
            (buffer.arguments || '') + toolCallDelta.function.arguments;
        }

        toolCallDeltas.push({ ...buffer });
      }
    }

    return {
      id: chunk.id,
      delta: content,
      toolCallDeltas: toolCallDeltas.length > 0 ? toolCallDeltas : undefined,
      finishReason: choice.finish_reason
        ? this.convertFinishReason(choice.finish_reason)
        : undefined,
      usage: chunk.usage
        ? {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0,
          }
        : undefined,
    };
  }

  /**
   * Convert OpenAI finish reason to our format
   */
  private convertFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'error';
    }
  }

  /**
   * Estimate token count when tiktoken is unavailable
   */
  private estimateTokens(input: string | Message[]): number {
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
   * Handle and convert OpenAI errors to our error types
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      const openaiError = error as any;

      // Authentication errors
      if (
        openaiError.status === 401 ||
        openaiError.code === 'invalid_api_key'
      ) {
        return new LLMAuthenticationError(
          openaiError.message || 'Invalid API key',
          this.provider
        );
      }

      // Rate limit errors
      if (openaiError.status === 429) {
        const retryAfter = openaiError.headers?.['retry-after'];
        if (openaiError.code === 'insufficient_quota') {
          return new LLMQuotaExceededError(
            openaiError.message || 'Quota exceeded',
            this.provider
          );
        }
        return new LLMRateLimitError(
          openaiError.message || 'Rate limit exceeded',
          this.provider,
          retryAfter ? parseInt(retryAfter, 10) : undefined
        );
      }

      // Invalid request errors
      if (openaiError.status === 400 || openaiError.status === 404) {
        return new LLMInvalidRequestError(
          openaiError.message || 'Invalid request',
          this.provider
        );
      }

      // Network errors
      if (
        openaiError.code === 'ECONNREFUSED' ||
        openaiError.code === 'ETIMEDOUT'
      ) {
        return new LLMNetworkError(
          openaiError.message || 'Network error',
          this.provider
        );
      }

      // Generic LLM error
      return new LLMError(
        openaiError.message || 'Unknown error',
        openaiError.code || 'UNKNOWN_ERROR',
        openaiError.status,
        this.provider
      );
    }

    return new LLMError(
      'Unknown error occurred',
      'UNKNOWN_ERROR',
      undefined,
      this.provider
    );
  }
}
