/**
 * Streaming Adapter - Unified streaming event protocol for LLM responses
 *
 * Normalizes provider-specific streaming formats (Anthropic, OpenAI, Google)
 * into a unified event stream that can be delivered via WebSocket or SSE.
 * The adapter uses an async iterator (pull model) for natural backpressure.
 */

import type {
  ChatChunk,
  ToolCall,
  TokenUsage,
  FinishReason,
} from '../types/llm';

// ---------------------------------------------------------------------------
// Extended chunk type with thinking support
// ---------------------------------------------------------------------------

/**
 * Extended ChatChunk that includes thinking content deltas.
 * Providers that support reasoning (Anthropic, OpenAI o-series) may emit
 * thinking content in a separate field.
 */
export interface ExtendedChatChunk extends ChatChunk {
  /** Thinking/reasoning content delta */
  thinkingDelta?: string;
}

// ---------------------------------------------------------------------------
// Stream event types
// ---------------------------------------------------------------------------

export type StreamEventType =
  | 'stream_start'
  | 'content_delta'
  | 'thinking_delta'
  | 'tool_call_start'
  | 'tool_call_delta'
  | 'tool_call_end'
  | 'usage_update'
  | 'stream_end'
  | 'error';

export interface StreamStartEvent {
  type: 'stream_start';
  model: string;
  provider: string;
  sessionId?: string;
}

export interface ContentDeltaEvent {
  type: 'content_delta';
  delta: string;
}

export interface ThinkingDeltaEvent {
  type: 'thinking_delta';
  delta: string;
}

export interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolCall: Partial<ToolCall>;
  index: number;
}

export interface ToolCallDeltaEvent {
  type: 'tool_call_delta';
  index: number;
  argumentsDelta: string;
}

export interface ToolCallEndEvent {
  type: 'tool_call_end';
  toolCall: ToolCall;
  index: number;
}

export interface UsageUpdateEvent {
  type: 'usage_update';
  usage: TokenUsage;
}

export interface StreamEndEvent {
  type: 'stream_end';
  finishReason: FinishReason;
  usage: TokenUsage;
}

export interface StreamErrorEvent {
  type: 'error';
  error: string;
  code?: string;
  recoverable: boolean;
}

export type StreamEvent =
  | StreamStartEvent
  | ContentDeltaEvent
  | ThinkingDeltaEvent
  | ToolCallStartEvent
  | ToolCallDeltaEvent
  | ToolCallEndEvent
  | UsageUpdateEvent
  | StreamEndEvent
  | StreamErrorEvent;

// ---------------------------------------------------------------------------
// Accumulated stream result
// ---------------------------------------------------------------------------

export interface StreamResult {
  content: string;
  thinkingContent: string;
  toolCalls: ToolCall[];
  finishReason: FinishReason;
  usage: TokenUsage;
}

// ---------------------------------------------------------------------------
// StreamingAdapter class
// ---------------------------------------------------------------------------

/**
 * Adapts provider-specific chat chunk streams into unified StreamEvents.
 */
export class StreamingAdapter {
  private toolCallBuffers: Map<number, Partial<ToolCall>> = new Map();

  /**
   * Transform an async iterator of provider ChatChunks into unified StreamEvents.
   */
  async *adaptChunks(
    chunks: AsyncIterableIterator<ChatChunk>,
    metadata: { model: string; provider: string; sessionId?: string },
  ): AsyncIterableIterator<StreamEvent> {
    // Emit stream start
    yield {
      type: 'stream_start',
      model: metadata.model,
      provider: metadata.provider,
      sessionId: metadata.sessionId,
    };

    let lastUsage: TokenUsage | undefined;
    let lastFinishReason: FinishReason | undefined;

    try {
      for await (const chunk of chunks) {
        // Content delta
        if (chunk.delta && chunk.delta.length > 0) {
          yield {
            type: 'content_delta',
            delta: chunk.delta,
          };
        }

        // Tool call deltas
        if (chunk.toolCallDeltas) {
          for (let i = 0; i < chunk.toolCallDeltas.length; i++) {
            const delta = chunk.toolCallDeltas[i];
            if (!delta) {
              continue;
            }

            const existing = this.toolCallBuffers.get(i);

            if (!existing) {
              // New tool call starting
              this.toolCallBuffers.set(i, {
                id: delta.id,
                name: delta.name,
                arguments: delta.arguments ?? '',
              });
              yield {
                type: 'tool_call_start',
                toolCall: { id: delta.id, name: delta.name },
                index: i,
              };
            } else {
              // Accumulate arguments
              if (delta.arguments) {
                existing.arguments = (existing.arguments ?? '') + delta.arguments;
                yield {
                  type: 'tool_call_delta',
                  index: i,
                  argumentsDelta: delta.arguments,
                };
              }
              if (delta.id) {
                existing.id = delta.id;
              }
              if (delta.name) {
                existing.name = delta.name;
              }
            }
          }
        }

        // Track usage and finish reason
        if (chunk.usage) {
          lastUsage = chunk.usage;
          yield { type: 'usage_update', usage: chunk.usage };
        }
        if (chunk.finishReason) {
          lastFinishReason = chunk.finishReason;
        }
      }

      // Emit tool call end events for all buffered tool calls
      for (const [index, buffer] of this.toolCallBuffers) {
        if (buffer.id && buffer.name) {
          yield {
            type: 'tool_call_end',
            toolCall: {
              id: buffer.id,
              name: buffer.name,
              arguments: buffer.arguments ?? '{}',
            },
            index,
          };
        }
      }

      // Emit stream end
      const finalUsage: TokenUsage = lastUsage ?? {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      yield {
        type: 'stream_end',
        finishReason: lastFinishReason ?? 'stop',
        usage: finalUsage,
      };
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
        code: error instanceof Error && 'code' in error
          ? String((error as { code?: string }).code)
          : undefined,
        recoverable: false,
      };
    } finally {
      this.toolCallBuffers.clear();
    }
  }

  /**
   * Collect a stream into a complete result (useful for non-streaming callers).
   */
  async collectStream(
    events: AsyncIterableIterator<StreamEvent>,
  ): Promise<StreamResult> {
    let content = '';
    let thinkingContent = '';
    const toolCalls: ToolCall[] = [];
    let finishReason: FinishReason = 'stop';
    let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for await (const event of events) {
      switch (event.type) {
        case 'content_delta':
          content += event.delta;
          break;
        case 'thinking_delta':
          thinkingContent += event.delta;
          break;
        case 'tool_call_end':
          toolCalls.push(event.toolCall);
          break;
        case 'stream_end':
          finishReason = event.finishReason;
          usage = event.usage;
          break;
        case 'error':
          throw new Error(event.error);
      }
    }

    return { content, thinkingContent, toolCalls, finishReason, usage };
  }
}

// ---------------------------------------------------------------------------
// SSE formatting
// ---------------------------------------------------------------------------

/**
 * Format a StreamEvent as a Server-Sent Event string.
 */
export function formatSSE(event: StreamEvent): string {
  const data = JSON.stringify(event);
  return `event: ${event.type}\ndata: ${data}\n\n`;
}

// ---------------------------------------------------------------------------
// WebSocket message formatting
// ---------------------------------------------------------------------------

/**
 * Format a StreamEvent as a WebSocket message payload.
 */
export function formatWSMessage(event: StreamEvent): string {
  return JSON.stringify({
    type: `stream:${event.type}`,
    payload: event,
  });
}
