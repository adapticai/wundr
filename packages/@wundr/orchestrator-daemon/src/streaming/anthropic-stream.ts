/**
 * Anthropic Streaming Adapter
 *
 * Consumes the Anthropic SDK's MessageStream and normalizes its SSE events
 * into the common StreamEvent discriminated union used by the orchestrator's
 * streaming pipeline.
 *
 * Handles:
 * - message_start / message_delta / message_stop
 * - content_block_start / content_block_delta / content_block_stop
 * - text blocks, thinking blocks (extended thinking), and tool_use blocks
 * - Token usage extraction
 * - Abort/cancellation via AbortController
 */

import type { StreamEvent, ContentBlockType } from './block-parser';
import type { ChatParams, TokenUsage, FinishReason } from '../types/llm';
import type Anthropic from '@anthropic-ai/sdk';
import type { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import type {
  MessageStreamEvent,
  TextBlock,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages';

/**
 * Metadata tracked per content block during streaming.
 */
interface ActiveBlock {
  index: number;
  type: ContentBlockType;
  /** Tool metadata, populated for tool_use blocks. */
  toolId?: string;
  toolName?: string;
  /** Accumulated tool arguments JSON string. */
  argumentsBuffer?: string;
}

/**
 * Options for creating an Anthropic streaming session.
 */
export interface AnthropicStreamOptions {
  /** Anthropic SDK client instance. */
  client: Anthropic;
  /** Chat parameters (model, messages, tools, etc.). */
  params: ChatParams;
  /** AbortController for cancellation support. */
  abortController?: AbortController;
  /** Enable extended thinking (sends thinking blocks). */
  enableThinking?: boolean;
  /** Budget tokens for extended thinking. Only applies when enableThinking is true. */
  thinkingBudgetTokens?: number;
}

/**
 * Convert Wundr ChatParams messages to Anthropic MessageParam format.
 *
 * This mirrors the conversion in AnthropicClient.convertMessages but is
 * duplicated here to avoid coupling the streaming adapter to the provider
 * class internals.
 */
function convertMessages(messages: ChatParams['messages']): {
  systemMessage?: string;
  messages: Anthropic.MessageParam[];
} {
  type Msg = ChatParams['messages'][number];
  const systemMessages = messages.filter((m: Msg) => m.role === 'system');
  const systemMessage =
    systemMessages.map((m: Msg) => m.content).join('\n') || undefined;

  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      continue;
    }

    if (message.role === 'tool') {
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
    } else if (
      message.role === 'assistant' &&
      message.toolCalls &&
      message.toolCalls.length > 0
    ) {
      const content: Array<TextBlock | ToolUseBlock> = [];

      if (message.content) {
        content.push({ type: 'text', text: message.content });
      }

      for (const toolCall of message.toolCalls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.name,
          input: JSON.parse(toolCall.arguments),
        });
      }

      anthropicMessages.push({ role: 'assistant', content });
    } else {
      anthropicMessages.push({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content,
      });
    }
  }

  return { systemMessage, messages: anthropicMessages };
}

/**
 * Convert Wundr ToolDefinition to Anthropic Tool format.
 */
function convertTools(
  tools?: ChatParams['tools']
): Anthropic.Tool[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  return tools.map((tool: NonNullable<ChatParams['tools']>[number]) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

/**
 * Map Anthropic stop_reason to our FinishReason.
 */
function convertStopReason(stopReason: string | null): FinishReason {
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
 * Create an async iterable of StreamEvents from an Anthropic streaming call.
 *
 * This is the main entry point for the Anthropic streaming adapter. It
 * initiates the SDK stream call, iterates over raw SSE events, and yields
 * normalized StreamEvent objects.
 */
export async function* createAnthropicStream(
  options: AnthropicStreamOptions
): AsyncGenerator<StreamEvent> {
  const {
    client,
    params,
    abortController,
    enableThinking,
    thinkingBudgetTokens,
  } = options;
  const { systemMessage, messages } = convertMessages(params.messages);
  const tools = convertTools(params.tools);

  // Build streaming request params
  const requestParams: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens || 4096,
    messages,
    ...(systemMessage && { system: systemMessage }),
    ...(tools && tools.length > 0 && { tools }),
    ...(params.temperature !== undefined && {
      temperature: params.temperature,
    }),
    ...(params.topP !== undefined && { top_p: params.topP }),
    ...(params.stop && { stop_sequences: params.stop }),
  };

  // Extended thinking support
  if (enableThinking) {
    (requestParams as Record<string, unknown>).thinking = {
      type: 'enabled',
      budget_tokens: thinkingBudgetTokens || 10000,
    };
  }

  let stream: MessageStream;

  try {
    // The Anthropic SDK's .stream() method accepts an abort signal for cancellation
    stream = client.messages.stream(requestParams as any, {
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

  const activeBlocks = new Map<number, ActiveBlock>();
  let messageId = '';
  let finalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  try {
    for await (const event of stream as AsyncIterable<MessageStreamEvent>) {
      // Check for abort between events
      if (abortController?.signal.aborted) {
        yield {
          type: 'error',
          error: new Error('Stream aborted by client'),
          recoverable: false,
        };
        break;
      }

      const events = convertStreamEvent(event, activeBlocks, messageId);

      for (const streamEvent of events) {
        // Capture message ID from stream_start
        if (streamEvent.type === 'stream_start') {
          messageId = streamEvent.messageId;
        }

        // Capture usage
        if (streamEvent.type === 'usage') {
          finalUsage = {
            promptTokens: streamEvent.inputTokens,
            completionTokens: streamEvent.outputTokens,
            totalTokens: streamEvent.inputTokens + streamEvent.outputTokens,
          };
        }

        yield streamEvent;
      }
    }

    // Attempt to get the final message for accurate usage data.
    // The finalMessage() call may fail if the stream was aborted.
    try {
      const finalMessage = await stream.finalMessage();
      const usage = finalMessage.usage;

      finalUsage = {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
      };

      yield {
        type: 'stream_end',
        finishReason: convertStopReason(finalMessage.stop_reason),
        usage: finalUsage,
      };
    } catch {
      // If finalMessage() fails (e.g. aborted stream), emit end with
      // whatever usage data we accumulated.
      yield {
        type: 'stream_end',
        finishReason: 'stop',
        usage: finalUsage,
      };
    }
  } catch (error) {
    // Determine if the error is recoverable
    const isAbort =
      error instanceof Error &&
      (error.name === 'AbortError' || abortController?.signal.aborted);

    // Detect rate limit from Anthropic error types and HTTP status codes
    const isRateLimit =
      error instanceof Error &&
      (error.message.includes('rate_limit') ||
        error.message.includes('429') ||
        (error as any).status === 429 ||
        (error as any).error?.type === 'rate_limit_error');

    // Detect overloaded errors (Anthropic 529) -- retryable
    const isOverloaded =
      error instanceof Error &&
      ((error as any).status === 529 || error.message.includes('overloaded'));

    // Compute retry-after from error headers or use defaults
    let retryAfterMs = 5000;
    if (isRateLimit || isOverloaded) {
      const headerRetry = (error as any).headers?.['retry-after'];
      if (headerRetry) {
        const parsed = Number(headerRetry);
        retryAfterMs = Number.isNaN(parsed) ? 5000 : parsed * 1000;
      }
      if (isOverloaded) {
        retryAfterMs = Math.max(retryAfterMs, 10000);
      }
    }

    const recoverable = (isRateLimit || isOverloaded) && !isAbort;

    yield {
      type: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
      recoverable,
      ...(recoverable && { retryAfter: retryAfterMs }),
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

/**
 * Convert a single Anthropic MessageStreamEvent into zero or more StreamEvents.
 */
function convertStreamEvent(
  event: MessageStreamEvent,
  activeBlocks: Map<number, ActiveBlock>,
  _currentMessageId: string
): StreamEvent[] {
  const events: StreamEvent[] = [];

  switch (event.type) {
    case 'message_start': {
      const msg = event.message;
      events.push({
        type: 'stream_start',
        messageId: msg.id,
      });

      // Anthropic provides input token count at message_start
      if (msg.usage) {
        events.push({
          type: 'usage',
          inputTokens: msg.usage.input_tokens,
          outputTokens: msg.usage.output_tokens,
        });
      }
      break;
    }

    case 'content_block_start': {
      const block = event.content_block;
      const index = event.index;

      if (block.type === 'tool_use') {
        const toolBlock = block as ToolUseBlock;
        activeBlocks.set(index, {
          index,
          type: 'tool_use',
          toolId: toolBlock.id,
          toolName: toolBlock.name,
          argumentsBuffer: '',
        });

        events.push({
          type: 'tool_use_start',
          toolName: toolBlock.name,
          toolId: toolBlock.id,
          blockIndex: index,
        });
      } else if ((block.type as unknown) === 'thinking') {
        activeBlocks.set(index, {
          index,
          type: 'thinking',
        });
        // No explicit start event; thinking_delta events signal the block
      } else {
        // text block
        activeBlocks.set(index, {
          index,
          type: 'text',
        });
      }
      break;
    }

    case 'content_block_delta': {
      const delta = event.delta;
      const index = event.index;
      const block = activeBlocks.get(index);

      if (delta.type === 'text_delta') {
        events.push({
          type: 'text_delta',
          text: delta.text,
          blockIndex: index,
        });
      } else if ((delta.type as unknown) === 'thinking_delta') {
        events.push({
          type: 'thinking_delta',
          text: (delta as any).thinking,
          blockIndex: index,
        });
      } else if (delta.type === 'input_json_delta') {
        if (block && block.type === 'tool_use') {
          const partialJson = (delta as any).partial_json;
          block.argumentsBuffer = (block.argumentsBuffer || '') + partialJson;

          events.push({
            type: 'tool_use_delta',
            partialJson,
            toolId: block.toolId!,
            blockIndex: index,
          });
        }
      }
      break;
    }

    case 'content_block_stop': {
      const index = event.index;
      const block = activeBlocks.get(index);

      if (block) {
        // If this was a tool_use block, emit tool_use_end with complete arguments
        if (block.type === 'tool_use') {
          events.push({
            type: 'tool_use_end',
            toolId: block.toolId!,
            toolName: block.toolName!,
            arguments: block.argumentsBuffer || '{}',
            blockIndex: index,
          });
        }

        events.push({
          type: 'content_block_stop',
          blockIndex: index,
          blockType: block.type,
        });

        activeBlocks.delete(index);
      }
      break;
    }

    case 'message_delta': {
      // message_delta carries output token usage
      const delta = event as any;
      if (delta.usage) {
        events.push({
          type: 'usage',
          inputTokens: 0, // Not provided in message_delta
          outputTokens: delta.usage.output_tokens,
        });
      }
      break;
    }

    case 'message_stop': {
      // Handled by finalMessage() in the outer generator
      break;
    }

    default:
      // Unknown event types are silently ignored
      break;
  }

  return events;
}
