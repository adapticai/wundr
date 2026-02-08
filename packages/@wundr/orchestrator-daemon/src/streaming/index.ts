/**
 * Streaming Module
 *
 * Real LLM streaming pipeline for the orchestrator daemon. Replaces the
 * previous non-streaming approach with provider-aware streaming adapters,
 * block-aware delta parsing, and throttled WebSocket delivery.
 *
 * Architecture:
 *
 *   SessionExecutor
 *        |
 *   StreamHandler.startStream()  -->  ActiveStream
 *        |
 *        +-- AnthropicStreamAdapter  or  OpenAIStreamAdapter
 *        |         |
 *        +-- BlockParser (delta coalescing)
 *        |
 *   WebSocketStreamRelay (throttled WS delivery)
 *
 * Usage:
 *
 * ```typescript
 * import { StreamHandler, WebSocketStreamRelay } from './streaming';
 *
 * const streamHandler = new StreamHandler();
 * const relay = new WebSocketStreamRelay(wsServer);
 *
 * // In SessionExecutor, when options.streaming is true:
 * const activeStream = streamHandler.startStream(llmClient, chatParams, {
 *   enableThinking: true,
 * }, session.id);
 *
 * // Relay events to WebSocket clients
 * await relay.relay(session.id, activeStream.events);
 *
 * // Check final usage
 * console.log('Tokens used:', activeStream.usage.totalTokens);
 * ```
 */

// Core types
export type {
  StreamEvent,
  StreamStartEvent,
  TextDeltaEvent,
  ThinkingDeltaEvent,
  ToolUseStartEvent,
  ToolUseDeltaEvent,
  ToolUseEndEvent,
  ContentBlockStopEvent,
  UsageEvent,
  StreamErrorEvent,
  StreamEndEvent,
  ContentBlockType,
  BlockParserConfig,
} from './block-parser';

// Stream handler (entry point)
export { StreamHandler } from './stream-handler';
export type {
  StartStreamOptions,
  ActiveStream,
} from './stream-handler';

// Provider adapters
export { createAnthropicStream } from './anthropic-stream';
export type { AnthropicStreamOptions } from './anthropic-stream';

export { createOpenAIStream } from './openai-stream';
export type { OpenAIStreamOptions } from './openai-stream';

// Block parser
export { BlockParser } from './block-parser';

// WebSocket relay
export { WebSocketStreamRelay } from './websocket-relay';
export type { WebSocketRelayConfig } from './websocket-relay';
