/**
 * OpenAI Streaming Adapter
 *
 * Consumes the OpenAI SDK's streaming response (async iterable of
 * ChatCompletionChunk) and normalizes each chunk into the common StreamEvent
 * discriminated union used by the orchestrator's streaming pipeline.
 *
 * Handles:
 * - Text content deltas
 * - Tool call deltas (buffered by index, emitting tool_use_start on first
 *   delta and tool_use_end when finish_reason === 'tool_calls')
 * - Token usage from stream_options.include_usage
 * - Abort/cancellation via AbortController
 */

import type OpenAI from 'openai';
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat';

import type {
  ChatParams,
  TokenUsage,
  FinishReason,
  Message,
  ToolDefinition,
} from '@wundr.io/ai-integration';

import type { StreamEvent } from './block-parser';

/**
 * Tracked state per tool call index during streaming.
 */
interface ToolCallBuffer {
  id: string;
  name: string;
  argumentsBuffer: string;
  started: boolean;
  blockIndex: number;
}

/**
 * Options for creating an OpenAI streaming session.
 */
export interface OpenAIStreamOptions {
  /** OpenAI SDK client instance. */
  client: OpenAI;
  /** Chat parameters (model, messages, tools, etc.). */
  params: ChatParams;
  /** AbortController for cancellation support. */
  abortController?: AbortController;
}

/**
 * Convert Wundr Message format to OpenAI ChatCompletionMessageParam format.
 */
function convertMessages(
  messages: Message[],
): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((msg) => {
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
        tool_calls: msg.toolCalls.map((tc) => ({
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
 * Convert Wundr ToolDefinition to OpenAI ChatCompletionTool format.
 */
function convertTools(
  tools?: ToolDefinition[],
): OpenAI.ChatCompletionTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

/**
 * Map OpenAI finish_reason to our FinishReason.
 */
function convertFinishReason(reason: string | null): FinishReason {
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
      return 'stop';
  }
}

/**
 * Create an async iterable of StreamEvents from an OpenAI streaming call.
 *
 * This is the main entry point for the OpenAI streaming adapter. It
 * initiates the SDK stream call, iterates over raw ChatCompletionChunk
 * objects, and yields normalized StreamEvent objects.
 */
export async function* createOpenAIStream(
  options: OpenAIStreamOptions,
): AsyncGenerator<StreamEvent> {
  const { client, params, abortController } = options;

  const messages = convertMessages(params.messages);
  const tools = convertTools(params.tools);

  const requestParams: ChatCompletionCreateParamsStreaming = {
    model: params.model,
    messages,
    stream: true,
    // Request usage data in the final chunk
    stream_options: { include_usage: true },
    ...(tools && tools.length > 0 && { tools }),
    ...(params.temperature !== undefined && {
      temperature: params.temperature,
    }),
    ...(params.maxTokens !== undefined && { max_tokens: params.maxTokens }),
    ...(params.topP !== undefined && { top_p: params.topP }),
    ...(params.stop && { stop: params.stop }),
    ...(params.frequencyPenalty !== undefined && {
      frequency_penalty: params.frequencyPenalty,
    }),
    ...(params.presencePenalty !== undefined && {
      presence_penalty: params.presencePenalty,
    }),
  };

  let stream: AsyncIterable<ChatCompletionChunk>;

  try {
    stream = await client.chat.completions.create(requestParams, {
      signal: abortController?.signal,
    });
  } catch (error) {
    yield {
      type: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
      recoverable: false,
    };
    return;
  }

  const toolCallBuffers = new Map<number, ToolCallBuffer>();
  let messageId = '';
  let hasEmittedStart = false;
  let finalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  let lastFinishReason: FinishReason = 'stop';
  // Block index counter: OpenAI does not have explicit block indices.
  // We assign block 0 for text, and subsequent indices for each tool call.
  let nextBlockIndex = 0;
  const textBlockIndex = 0;

  try {
    for await (const chunk of stream) {
      // Check for abort between chunks
      if (abortController?.signal.aborted) {
        yield {
          type: 'error',
          error: new Error('Stream aborted by client'),
          recoverable: false,
        };
        break;
      }

      // Emit stream_start on first chunk
      if (!hasEmittedStart && chunk.id) {
        messageId = chunk.id;
        hasEmittedStart = true;
        yield {
          type: 'stream_start',
          messageId,
        };
        // OpenAI does not provide input tokens at stream start
        nextBlockIndex = 1; // Reserve 0 for text
      }

      const choice = chunk.choices?.[0];

      if (choice) {
        const delta = choice.delta;

        // Text content
        if (delta?.content) {
          yield {
            type: 'text_delta',
            text: delta.content,
            blockIndex: textBlockIndex,
          };
        }

        // Tool call deltas
        if (delta?.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            const idx = toolCallDelta.index;

            let buffer = toolCallBuffers.get(idx);
            if (!buffer) {
              buffer = {
                id: toolCallDelta.id || '',
                name: '',
                argumentsBuffer: '',
                started: false,
                blockIndex: nextBlockIndex++,
              };
              toolCallBuffers.set(idx, buffer);
            }

            // Update buffer with delta data
            if (toolCallDelta.id) {
              buffer.id = toolCallDelta.id;
            }
            if (toolCallDelta.function?.name) {
              buffer.name = toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              buffer.argumentsBuffer += toolCallDelta.function.arguments;
            }

            // Emit tool_use_start on first delta with a name
            if (!buffer.started && buffer.name) {
              buffer.started = true;
              yield {
                type: 'tool_use_start',
                toolName: buffer.name,
                toolId: buffer.id,
                blockIndex: buffer.blockIndex,
              };
            }

            // Emit incremental JSON delta
            if (toolCallDelta.function?.arguments) {
              yield {
                type: 'tool_use_delta',
                partialJson: toolCallDelta.function.arguments,
                toolId: buffer.id,
                blockIndex: buffer.blockIndex,
              };
            }
          }
        }

        // Track finish reason
        if (choice.finish_reason) {
          lastFinishReason = convertFinishReason(choice.finish_reason);

          // When finish_reason is tool_calls, emit tool_use_end for all buffered tools
          if (
            choice.finish_reason === 'tool_calls' ||
            choice.finish_reason === 'function_call'
          ) {
            for (const [, buffer] of toolCallBuffers) {
              yield {
                type: 'tool_use_end',
                toolId: buffer.id,
                toolName: buffer.name,
                arguments: buffer.argumentsBuffer || '{}',
                blockIndex: buffer.blockIndex,
              };

              yield {
                type: 'content_block_stop',
                blockIndex: buffer.blockIndex,
                blockType: 'tool_use',
              };
            }
            toolCallBuffers.clear();
          }

          // Emit content_block_stop for text block if we had text content
          if (choice.finish_reason === 'stop') {
            yield {
              type: 'content_block_stop',
              blockIndex: textBlockIndex,
              blockType: 'text',
            };
          }
        }
      }

      // Token usage (present in final chunk when stream_options.include_usage is true)
      if (chunk.usage) {
        finalUsage = {
          promptTokens: chunk.usage.prompt_tokens || 0,
          completionTokens: chunk.usage.completion_tokens || 0,
          totalTokens: chunk.usage.total_tokens || 0,
        };

        yield {
          type: 'usage',
          inputTokens: finalUsage.promptTokens,
          outputTokens: finalUsage.completionTokens,
        };
      }
    }

    // Emit stream end
    yield {
      type: 'stream_end',
      finishReason: lastFinishReason,
      usage: finalUsage,
    };
  } catch (error) {
    const isAbort =
      error instanceof Error &&
      (error.name === 'AbortError' || abortController?.signal.aborted);

    const isRateLimit =
      error instanceof Error &&
      ((error as any).status === 429 ||
        error.message.includes('rate_limit'));

    yield {
      type: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
      recoverable: isRateLimit,
      ...(isRateLimit && { retryAfter: 5000 }),
    };

    if (!isAbort) {
      yield {
        type: 'stream_end',
        finishReason: 'error',
        usage: finalUsage,
      };
    }
  }
}
