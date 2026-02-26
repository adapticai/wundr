/**
 * Block Parser - Block-aware delta coalescing for LLM streaming
 *
 * Tracks content block boundaries (text, thinking, tool_use) and coalesces
 * rapid micro-deltas into larger chunks before emission. This reduces the
 * number of WebSocket messages sent to clients while preserving block-type
 * metadata needed for differentiated rendering.
 */

import type { FinishReason, TokenUsage } from '../types/llm';

/**
 * Discriminated union of all stream events emitted by provider adapters
 * and consumed by the WebSocket relay.
 */
export type StreamEvent =
  | StreamStartEvent
  | TextDeltaEvent
  | ThinkingDeltaEvent
  | ToolUseStartEvent
  | ToolUseDeltaEvent
  | ToolUseEndEvent
  | ContentBlockStopEvent
  | UsageEvent
  | StreamErrorEvent
  | StreamEndEvent;

export interface StreamStartEvent {
  type: 'stream_start';
  messageId: string;
}

export interface TextDeltaEvent {
  type: 'text_delta';
  text: string;
  blockIndex: number;
}

export interface ThinkingDeltaEvent {
  type: 'thinking_delta';
  text: string;
  blockIndex: number;
}

export interface ToolUseStartEvent {
  type: 'tool_use_start';
  toolName: string;
  toolId: string;
  blockIndex: number;
}

export interface ToolUseDeltaEvent {
  type: 'tool_use_delta';
  partialJson: string;
  toolId: string;
  blockIndex: number;
}

export interface ToolUseEndEvent {
  type: 'tool_use_end';
  toolId: string;
  toolName: string;
  arguments: string;
  blockIndex: number;
}

export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  blockIndex: number;
  blockType: string;
}

export interface UsageEvent {
  type: 'usage';
  inputTokens: number;
  outputTokens: number;
}

export interface StreamErrorEvent {
  type: 'error';
  error: Error;
  recoverable: boolean;
  retryAfter?: number;
}

export interface StreamEndEvent {
  type: 'stream_end';
  finishReason: FinishReason;
  usage: TokenUsage;
}

/**
 * Content block types recognized by the parser.
 */
export type ContentBlockType = 'text' | 'thinking' | 'tool_use';

/**
 * Configuration for the block parser's coalescing behavior.
 */
export interface BlockParserConfig {
  /**
   * Minimum number of characters to accumulate before flushing a text or
   * thinking delta. Rapid micro-deltas (often single tokens) are buffered
   * until this threshold is reached or the idle timeout fires.
   * @default 20
   */
  minCharsBeforeFlush: number;

  /**
   * Maximum milliseconds of idle time (no new delta) before the buffer is
   * flushed regardless of size. Prevents indefinite buffering during slow
   * generation.
   * @default 50
   */
  idleFlushMs: number;

  /**
   * When true, tool_use JSON deltas are also coalesced. When false, every
   * tool_use delta is emitted immediately (useful for live JSON preview).
   * @default false
   */
  coalesceToolDeltas: boolean;
}

const DEFAULT_CONFIG: BlockParserConfig = {
  minCharsBeforeFlush: 20,
  idleFlushMs: 50,
  coalesceToolDeltas: false,
};

/**
 * Internal state for tracking the current content block.
 */
interface BlockState {
  index: number;
  type: ContentBlockType;
  /** Accumulated text for text/thinking blocks. */
  textBuffer: string;
  /** Accumulated JSON for tool_use blocks. */
  jsonBuffer: string;
  /** Tool metadata (only for tool_use blocks). */
  toolId?: string;
  toolName?: string;
}

/**
 * BlockParser
 *
 * A stateful processor that sits between a provider adapter's raw stream
 * events and the WebSocket relay. It:
 *
 * 1. Tracks which content block is currently active (by index and type).
 * 2. Coalesces rapid text/thinking deltas into larger chunks.
 * 3. Emits block boundary events (content_block_stop) when blocks end.
 * 4. Passes through non-delta events (stream_start, usage, error, stream_end)
 *    unmodified.
 */
export class BlockParser {
  private config: BlockParserConfig;
  private currentBlock: BlockState | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingFlush: StreamEvent[] = [];

  constructor(config?: Partial<BlockParserConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process a raw stream event from a provider adapter.
   *
   * Returns zero or more coalesced StreamEvents to emit downstream.
   * The caller should iterate the returned array and emit each event.
   *
   * Any events produced by the idle-flush timer since the last process()
   * call are drained first, ensuring nothing is lost.
   */
  process(event: StreamEvent): StreamEvent[] {
    // Drain any events that were produced by the idle flush timer
    // between the previous process() call and this one.
    const pending = this.drainPending();

    let result: StreamEvent[];

    switch (event.type) {
      case 'text_delta':
        result = this.handleTextDelta(event);
        break;

      case 'thinking_delta':
        result = this.handleThinkingDelta(event);
        break;

      case 'tool_use_start':
        result = this.handleToolUseStart(event);
        break;

      case 'tool_use_delta':
        result = this.handleToolUseDelta(event);
        break;

      case 'tool_use_end':
        result = this.handleToolUseEnd(event);
        break;

      case 'content_block_stop':
        result = this.handleContentBlockStop(event);
        break;

      case 'stream_start':
      case 'usage':
        // Pass through unmodified
        result = [event];
        break;

      case 'error':
        // Flush any buffered content, then pass through error
        result = [...this.flushBuffer(), event];
        break;

      case 'stream_end':
        // Flush any remaining buffer, then pass through end
        result = [...this.flushBuffer(), event];
        break;

      default:
        result = [event];
        break;
    }

    if (pending.length > 0) {
      return [...pending, ...result];
    }
    return result;
  }

  /**
   * Check whether the parser has buffered content that has not yet been
   * emitted. Useful for the StreamHandler pipeline to know if it should
   * poll for idle-flushed events.
   */
  hasPendingEvents(): boolean {
    return this.pendingFlush.length > 0;
  }

  /**
   * Drain and return any events accumulated by the idle flush timer.
   * Called at the start of process() and can also be called externally
   * by the pipeline during quiet periods.
   */
  drainPending(): StreamEvent[] {
    if (this.pendingFlush.length === 0) {
      return [];
    }
    const drained = this.pendingFlush;
    this.pendingFlush = [];
    return drained;
  }

  /**
   * Force-flush any buffered content. Call this when the stream ends or
   * on a timer boundary.
   */
  flushBuffer(): StreamEvent[] {
    this.cancelFlushTimer();
    const events: StreamEvent[] = [];

    if (this.currentBlock && this.currentBlock.textBuffer.length > 0) {
      const block = this.currentBlock;
      if (block.type === 'text') {
        events.push({
          type: 'text_delta',
          text: block.textBuffer,
          blockIndex: block.index,
        });
      } else if (block.type === 'thinking') {
        events.push({
          type: 'thinking_delta',
          text: block.textBuffer,
          blockIndex: block.index,
        });
      }
      block.textBuffer = '';
    }

    if (
      this.config.coalesceToolDeltas &&
      this.currentBlock &&
      this.currentBlock.type === 'tool_use' &&
      this.currentBlock.jsonBuffer.length > 0
    ) {
      events.push({
        type: 'tool_use_delta',
        partialJson: this.currentBlock.jsonBuffer,
        toolId: this.currentBlock.toolId!,
        blockIndex: this.currentBlock.index,
      });
      this.currentBlock.jsonBuffer = '';
    }

    // Also drain any pending flush events
    if (this.pendingFlush.length > 0) {
      events.push(...this.pendingFlush);
      this.pendingFlush = [];
    }

    return events;
  }

  /**
   * Reset all internal state. Call when starting a new stream.
   */
  reset(): void {
    this.cancelFlushTimer();
    this.currentBlock = null;
    this.pendingFlush = [];
  }

  // -- Private helpers --

  private handleTextDelta(event: TextDeltaEvent): StreamEvent[] {
    const events: StreamEvent[] = [];

    // If we are switching blocks, flush the old one first
    if (
      this.currentBlock &&
      (this.currentBlock.index !== event.blockIndex ||
        this.currentBlock.type !== 'text')
    ) {
      events.push(...this.flushBuffer());
    }

    // Initialize or update block state
    if (!this.currentBlock || this.currentBlock.index !== event.blockIndex) {
      this.currentBlock = {
        index: event.blockIndex,
        type: 'text',
        textBuffer: '',
        jsonBuffer: '',
      };
    }

    this.currentBlock.textBuffer += event.text;

    // Check if we should flush
    if (
      this.currentBlock.textBuffer.length >= this.config.minCharsBeforeFlush
    ) {
      const flushed = this.currentBlock.textBuffer;
      this.currentBlock.textBuffer = '';
      this.cancelFlushTimer();
      events.push({
        type: 'text_delta',
        text: flushed,
        blockIndex: event.blockIndex,
      });
    } else {
      // Schedule idle flush
      this.scheduleIdleFlush();
    }

    return events;
  }

  private handleThinkingDelta(event: ThinkingDeltaEvent): StreamEvent[] {
    const events: StreamEvent[] = [];

    if (
      this.currentBlock &&
      (this.currentBlock.index !== event.blockIndex ||
        this.currentBlock.type !== 'thinking')
    ) {
      events.push(...this.flushBuffer());
    }

    if (!this.currentBlock || this.currentBlock.index !== event.blockIndex) {
      this.currentBlock = {
        index: event.blockIndex,
        type: 'thinking',
        textBuffer: '',
        jsonBuffer: '',
      };
    }

    this.currentBlock.textBuffer += event.text;

    if (
      this.currentBlock.textBuffer.length >= this.config.minCharsBeforeFlush
    ) {
      const flushed = this.currentBlock.textBuffer;
      this.currentBlock.textBuffer = '';
      this.cancelFlushTimer();
      events.push({
        type: 'thinking_delta',
        text: flushed,
        blockIndex: event.blockIndex,
      });
    } else {
      this.scheduleIdleFlush();
    }

    return events;
  }

  private handleToolUseStart(event: ToolUseStartEvent): StreamEvent[] {
    const events = this.flushBuffer();

    this.currentBlock = {
      index: event.blockIndex,
      type: 'tool_use',
      textBuffer: '',
      jsonBuffer: '',
      toolId: event.toolId,
      toolName: event.toolName,
    };

    events.push(event);
    return events;
  }

  private handleToolUseDelta(event: ToolUseDeltaEvent): StreamEvent[] {
    if (!this.config.coalesceToolDeltas) {
      // Pass through immediately
      return [event];
    }

    // Coalesce tool JSON deltas
    if (
      this.currentBlock &&
      this.currentBlock.type === 'tool_use' &&
      this.currentBlock.toolId === event.toolId
    ) {
      this.currentBlock.jsonBuffer += event.partialJson;

      if (
        this.currentBlock.jsonBuffer.length >= this.config.minCharsBeforeFlush
      ) {
        const flushed = this.currentBlock.jsonBuffer;
        this.currentBlock.jsonBuffer = '';
        this.cancelFlushTimer();
        return [
          {
            type: 'tool_use_delta',
            partialJson: flushed,
            toolId: event.toolId,
            blockIndex: event.blockIndex,
          },
        ];
      } else {
        this.scheduleIdleFlush();
        return [];
      }
    }

    // Fallback: pass through if block state is inconsistent
    return [event];
  }

  private handleToolUseEnd(event: ToolUseEndEvent): StreamEvent[] {
    const events = this.flushBuffer();
    this.currentBlock = null;
    events.push(event);
    return events;
  }

  private handleContentBlockStop(event: ContentBlockStopEvent): StreamEvent[] {
    const events = this.flushBuffer();
    this.currentBlock = null;
    events.push(event);
    return events;
  }

  private scheduleIdleFlush(): void {
    if (this.flushTimer !== null) {
      return; // Already scheduled
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const events = this.flushBuffer();
      // Store for retrieval on next process() call
      this.pendingFlush.push(...events);
    }, this.config.idleFlushMs);
  }

  private cancelFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
