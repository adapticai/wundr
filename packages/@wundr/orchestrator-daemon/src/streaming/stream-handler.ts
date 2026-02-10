/**
 * Stream Handler - Orchestrator-facing API for real LLM streaming
 *
 * Provides a unified entry point for starting streamed LLM generations,
 * regardless of the underlying provider (Anthropic or OpenAI). The handler:
 *
 * - Detects the provider from the model name or LLMClient.provider
 * - Creates the appropriate streaming adapter
 * - Pipes raw provider events through BlockParser for delta coalescing
 * - Manages an AbortController for cooperative cancellation
 * - Tracks cumulative token usage across the stream lifecycle
 * - Supports retry on recoverable errors (rate limits)
 */

import { EventEmitter } from 'eventemitter3';


import { createAnthropicStream } from './anthropic-stream';
import { BlockParser } from './block-parser';
import { createOpenAIStream } from './openai-stream';
import { Logger } from '../utils/logger';

import type { BlockParserConfig, StreamEvent } from './block-parser';
import type {
  LLMClient,
  ChatParams,
  TokenUsage,
} from '../types/llm';

/**
 * Options for starting a stream.
 */
export interface StartStreamOptions {
  /**
   * Override provider detection. If not provided, the handler infers the
   * provider from `client.provider` or from the model name prefix.
   */
  provider?: 'anthropic' | 'openai';

  /**
   * Configuration for the block parser's delta coalescing.
   */
  blockParserConfig?: Partial<BlockParserConfig>;

  /**
   * Enable extended thinking (Anthropic only). When true, the model may
   * emit thinking blocks before its response.
   */
  enableThinking?: boolean;

  /**
   * Budget tokens for extended thinking (Anthropic only).
   * @default 10000
   */
  thinkingBudgetTokens?: number;

  /**
   * Maximum number of retry attempts for recoverable errors (e.g. rate limits).
   * @default 2
   */
  maxRetries?: number;

  /**
   * Whether to skip the BlockParser and emit raw provider events. Useful
   * for debugging or when the client handles its own coalescing.
   * @default false
   */
  rawMode?: boolean;
}

/**
 * Handle to an active stream. Returned by StreamHandler.startStream().
 */
export interface ActiveStream {
  /**
   * Async iterable of StreamEvents. Consumers iterate this to receive
   * coalesced, block-aware events.
   */
  events: AsyncIterable<StreamEvent>;

  /**
   * Abort the stream. Signals the underlying SDK to stop generation.
   * The events iterator will receive an error event followed by stream_end.
   */
  abort: () => void;

  /**
   * Current cumulative token usage. Updated as usage events arrive.
   * The final value is available after the stream_end event.
   */
  readonly usage: TokenUsage;

  /**
   * The session ID associated with this stream (if any).
   */
  readonly sessionId?: string;

  /**
   * Whether the stream has completed (successfully or with error).
   */
  readonly done: boolean;
}

/**
 * StreamHandler
 *
 * The primary entry point for the orchestrator daemon's streaming system.
 * SessionExecutor calls `startStream()` to begin a streamed LLM generation
 * and receives an `ActiveStream` handle for consuming events, checking
 * usage, and aborting.
 */
export class StreamHandler extends EventEmitter {
  private logger: Logger;
  private activeStreams: Map<string, ActiveStreamInternal> = new Map();

  constructor() {
    super();
    this.logger = new Logger('StreamHandler');
  }

  /**
   * Start a streaming LLM generation.
   *
   * @param client - The LLM client instance (Anthropic or OpenAI).
   * @param params - Chat parameters (model, messages, tools, etc.).
   * @param options - Optional streaming configuration.
   * @param sessionId - Optional session ID for tracking.
   * @returns An ActiveStream handle.
   */
  startStream(
    client: LLMClient,
    params: ChatParams,
    options?: StartStreamOptions,
    sessionId?: string,
  ): ActiveStream {
    const streamId = sessionId || `stream_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const abortController = new AbortController();

    const provider = this.detectProvider(client, params, options);

    this.logger.info(
      `Starting ${provider} stream for ${streamId} (model: ${params.model})`,
    );

    const blockParser = options?.rawMode
      ? null
      : new BlockParser(options?.blockParserConfig);

    const usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    // Create the provider-specific raw event generator
    const rawEvents = this.createProviderStream(
      client,
      params,
      provider,
      abortController,
      options,
    );

    // Create the processed event pipeline
    const processedEvents = this.createEventPipeline(
      rawEvents,
      blockParser,
      usage,
      streamId,
      options?.maxRetries ?? 2,
      () => this.createProviderStream(client, params, provider, abortController, options),
    );

    const internal: ActiveStreamInternal = {
      streamId,
      abortController,
      usage,
      done: false,
      events: processedEvents,
    };

    this.activeStreams.set(streamId, internal);

    const activeStream: ActiveStream = {
      events: processedEvents,
      abort: () => this.abortStream(streamId),
      get usage() {
        return { ...internal.usage };
      },
      sessionId: sessionId,
      get done() {
        return internal.done;
      },
    };

    return activeStream;
  }

  /**
   * Abort a stream by its ID.
   */
  abortStream(streamId: string): void {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      this.logger.info(`Aborting stream ${streamId}`);
      stream.abortController.abort();
      stream.done = true;
      this.activeStreams.delete(streamId);
      this.emit('stream:aborted', { streamId });
    }
  }

  /**
   * Abort all active streams. Call during shutdown.
   */
  abortAll(): void {
    for (const [streamId] of this.activeStreams) {
      this.abortStream(streamId);
    }
  }

  /**
   * Get the number of currently active streams.
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Check if a stream is active.
   */
  isStreamActive(streamId: string): boolean {
    return this.activeStreams.has(streamId);
  }

  // -- Private helpers --

  /**
   * Detect the provider from the client, model name, or explicit override.
   */
  private detectProvider(
    client: LLMClient,
    params: ChatParams,
    options?: StartStreamOptions,
  ): 'anthropic' | 'openai' {
    if (options?.provider) {
      return options.provider;
    }

    // Check client.provider field
    const clientProvider = client.provider?.toLowerCase();
    if (clientProvider === 'anthropic') {
return 'anthropic';
}
    if (clientProvider === 'openai') {
return 'openai';
}

    // Infer from model name
    if (params.model.startsWith('claude-')) {
return 'anthropic';
}
    if (params.model.startsWith('gpt-') || params.model.startsWith('o1-')) {
return 'openai';
}

    // Default to OpenAI as it has broader model name compatibility
    this.logger.warn(
      `Could not detect provider for model "${params.model}", defaulting to openai`,
    );
    return 'openai';
  }

  /**
   * Create the raw event generator for the detected provider.
   */
  private createProviderStream(
    client: LLMClient,
    params: ChatParams,
    provider: 'anthropic' | 'openai',
    abortController: AbortController,
    options?: StartStreamOptions,
  ): AsyncGenerator<StreamEvent> {
    if (provider === 'anthropic') {
      // Access the underlying Anthropic SDK client.
      // The LLMClient interface does not expose it, so we reach into the
      // implementation. This is a pragmatic coupling that avoids adding
      // streaming-specific methods to the generic LLMClient interface.
      const anthropicClient = (client as any).client;

      return createAnthropicStream({
        client: anthropicClient,
        params,
        abortController,
        enableThinking: options?.enableThinking,
        thinkingBudgetTokens: options?.thinkingBudgetTokens,
      });
    }

    // OpenAI
    const openaiClient = (client as any).client;

    return createOpenAIStream({
      client: openaiClient,
      params,
      abortController,
    });
  }

  /**
   * Create the full event pipeline: raw events -> block parser -> usage tracking.
   */
  private async *createEventPipeline(
    rawEvents: AsyncGenerator<StreamEvent>,
    blockParser: BlockParser | null,
    usage: TokenUsage,
    streamId: string,
    maxRetries: number,
    retryFactory: () => AsyncGenerator<StreamEvent>,
  ): AsyncGenerator<StreamEvent> {
    let retryCount = 0;
    let currentEvents = rawEvents;

    while (true) {
      try {
        for await (const rawEvent of currentEvents) {
          // Track usage
          if (rawEvent.type === 'usage') {
            if (rawEvent.inputTokens > 0) {
              usage.promptTokens = rawEvent.inputTokens;
            }
            if (rawEvent.outputTokens > 0) {
              usage.completionTokens = rawEvent.outputTokens;
            }
            usage.totalTokens = usage.promptTokens + usage.completionTokens;
          }

          if (rawEvent.type === 'stream_end') {
            // Update final usage from stream_end
            usage.promptTokens = rawEvent.usage.promptTokens;
            usage.completionTokens = rawEvent.usage.completionTokens;
            usage.totalTokens = rawEvent.usage.totalTokens;

            // Mark stream as done
            const internal = this.activeStreams.get(streamId);
            if (internal) {
              internal.done = true;
              this.activeStreams.delete(streamId);
            }

            this.emit('stream:completed', {
              streamId,
              usage: { ...usage },
            });
          }

          // Handle recoverable errors with retry
          if (
            rawEvent.type === 'error' &&
            rawEvent.recoverable &&
            retryCount < maxRetries
          ) {
            retryCount++;
            const retryAfter = rawEvent.retryAfter || 1000;

            this.logger.warn(
              `Recoverable error on stream ${streamId}, retrying in ${retryAfter}ms ` +
                `(attempt ${retryCount}/${maxRetries})`,
            );

            // Yield the error event so clients know about the retry
            if (blockParser) {
              for (const parsed of blockParser.process(rawEvent)) {
                yield parsed;
              }
            } else {
              yield rawEvent;
            }

            // Wait before retrying
            await new Promise<void>((resolve) =>
              setTimeout(resolve, retryAfter),
            );

            // Reset block parser state for retry
            blockParser?.reset();

            // Create a new stream for retry
            currentEvents = retryFactory();
            break; // Break inner loop to restart with new stream
          }

          // Pipe through block parser
          if (blockParser) {
            const parsedEvents = blockParser.process(rawEvent);
            for (const parsed of parsedEvents) {
              yield parsed;
            }
          } else {
            yield rawEvent;
          }

          // If stream ended, we are done
          if (rawEvent.type === 'stream_end') {
            return;
          }

          // Non-recoverable error also ends the pipeline
          if (rawEvent.type === 'error' && !rawEvent.recoverable) {
            return;
          }
        }

        // If we exhausted the iterator without a stream_end (e.g. retry path),
        // continue to the next iteration of the while loop with the new stream.
        // If there was no retry, we are done.
        if (retryCount === 0 || retryCount > maxRetries) {
          return;
        }
      } catch (error) {
        this.logger.error(`Pipeline error for stream ${streamId}:`, error);

        yield {
          type: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
          recoverable: false,
        };

        yield {
          type: 'stream_end',
          finishReason: 'error',
          usage: { ...usage },
        };

        const internal = this.activeStreams.get(streamId);
        if (internal) {
          internal.done = true;
          this.activeStreams.delete(streamId);
        }

        return;
      }
    }
  }
}

/**
 * Internal tracking for an active stream.
 */
interface ActiveStreamInternal {
  streamId: string;
  abortController: AbortController;
  usage: TokenUsage;
  done: boolean;
  events: AsyncGenerator<StreamEvent>;
}
