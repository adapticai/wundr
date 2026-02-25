# Wave 2 - Task 15: Real LLM Streaming

## Status: Implementation Complete

## Problem Statement

The orchestrator daemon's `SessionExecutor` currently uses non-streaming `llmClient.chat()` calls.
The entire LLM response is generated server-side before anything is sent to the client. While the
WebSocket server has `streamToClient`, `notifyStreamStart`, and `notifyStreamEnd` scaffolding, no
real streaming pipeline connects the LLM SDK streaming iterators to the WebSocket relay.

Clients experience high latency to first token and zero incremental progress visibility during
long-running LLM generations.

## Design Goals

1. **Provider-agnostic stream handler** -- a single entry point (`StreamHandler`) that accepts an
   `LLMClient` reference and a `ChatParams`, starts a streaming generation, and emits typed events
   consumable by the WebSocket relay.
2. **Provider-specific adapters** -- `AnthropicStreamAdapter` and `OpenAIStreamAdapter` that
   normalize each SDK's streaming protocol into a common `StreamEvent` discriminated union.
3. **Block-aware parsing** -- detect when the model switches between `text`, `thinking`, and
   `tool_use` content blocks so the client can render each block type differently.
4. **WebSocket relay** -- throttled delivery of stream chunks to session-subscribed clients with
   backpressure detection (slow client detection).
5. **Cancellation** -- cooperative abort via `AbortController` propagated to the SDK stream.
6. **Token accounting** -- accumulate token counts during the stream and emit a final usage event.
7. **Error recovery** -- surface mid-stream errors as typed events rather than crashing the session.

## Architecture

```
SessionExecutor
      |
      v
 StreamHandler          <-- entry point; owns AbortController
      |
      +---> AnthropicStreamAdapter   (or)   OpenAIStreamAdapter
      |          |                              |
      |     Anthropic SDK .stream()       OpenAI SDK .create({stream:true})
      |          |                              |
      |     raw SSE events                  raw SSE chunks
      |          |                              |
      +---> BlockParser                    BlockParser
      |          |
      |     StreamEvent[] (text_delta | thinking_delta | tool_use_start |
      |                    tool_use_delta | tool_use_end | usage | error | done)
      |
      +---> WebSocketRelay
                 |
            broadcastToSession (throttled, backpressure-aware)
```

## StreamEvent Type System

```typescript
type StreamEvent =
  | { type: 'stream_start'; messageId: string }
  | { type: 'text_delta'; text: string; blockIndex: number }
  | { type: 'thinking_delta'; text: string; blockIndex: number }
  | { type: 'tool_use_start'; toolName: string; toolId: string; blockIndex: number }
  | { type: 'tool_use_delta'; partialJson: string; toolId: string; blockIndex: number }
  | {
      type: 'tool_use_end';
      toolId: string;
      toolName: string;
      arguments: string;
      blockIndex: number;
    }
  | { type: 'content_block_stop'; blockIndex: number; blockType: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'error'; error: Error; recoverable: boolean }
  | { type: 'stream_end'; finishReason: FinishReason; usage: TokenUsage };
```

## Module Breakdown

### `stream-handler.ts`

- `StreamHandler` class -- the orchestrator-facing API.
- `startStream(client, params, options)` returns an `ActiveStream` handle.
- `ActiveStream` exposes: `events: AsyncIterableIterator<StreamEvent>`, `abort()`, `usage`.
- Internally creates the correct provider adapter and pipes through `BlockParser`.
- Owns an `AbortController` threaded into the SDK call.

### `anthropic-stream.ts`

- `AnthropicStreamAdapter` -- consumes `MessageStream` from `@anthropic-ai/sdk`.
- Maps SSE events (`message_start`, `content_block_start`, `content_block_delta`,
  `content_block_stop`, `message_delta`, `message_stop`) into `StreamEvent`.
- Handles Anthropic's `thinking` content block type for extended thinking.
- Extracts `usage` from `message_delta` and `finalMessage()`.

### `openai-stream.ts`

- `OpenAIStreamAdapter` -- consumes the async iterable from `openai`.
- Maps `ChatCompletionChunk` choices/delta into `StreamEvent`.
- Buffers tool call deltas by index, emitting `tool_use_start` on first delta and `tool_use_end`
  when `finish_reason === 'tool_calls'`.

### `block-parser.ts`

- Stateful parser that tracks current block index and type.
- Coalesces rapid micro-deltas into larger chunks (configurable min-chars threshold, default 20
  chars or 50ms idle flush).
- Detects block boundaries and emits `content_block_stop` when a block ends.

### `websocket-relay.ts`

- `WebSocketStreamRelay` -- bridges `StreamEvent` to the existing `OrchestratorWebSocketServer`
  APIs.
- Throttle: max one WS send per 16ms (60 fps) per session; coalesces text deltas in between.
- Backpressure: checks `ws.bufferedAmount` before sending; if above high-water mark (64KB), pauses
  consumption from the async iterator until drain.
- Maps `StreamEvent` to `WSResponse` messages (`stream_start`, `stream_chunk`, `stream_end`,
  `tool_call_start`, `tool_call_result`).

## Cancellation Flow

1. Client sends `{ type: 'stop_session', payload: { sessionId } }`.
2. `OrchestratorWebSocketServer` emits `'stop_session'` event.
3. Session manager calls `activeStream.abort()`.
4. `StreamHandler` calls `abortController.abort()`.
5. Provider adapter catches the abort, emits `{ type: 'error', error, recoverable: false }`, then
   `{ type: 'stream_end' }`.
6. `WebSocketRelay` sends `stream_end` to clients.

## Error Recovery

- Network errors during streaming: adapter emits `error` event with `recoverable: true`.
  `StreamHandler` can optionally retry the stream from the beginning (configurable).
- Rate limit errors: emit `error` with `retryAfter` metadata; `StreamHandler` waits then retries.
- Invalid request errors: non-recoverable; emit error and close stream.
- Broken WebSocket: relay detects closed socket and stops iterating events for that client (other
  session subscribers continue receiving).

## Token Counting

- Anthropic: `message_start.message.usage.input_tokens` gives prompt tokens upfront;
  `message_delta.usage.output_tokens` gives output tokens at the end.
- OpenAI: `stream_options: { include_usage: true }` on the request; the final chunk contains
  `usage`.
- Both adapters emit a `usage` event when token data becomes available.
- `StreamHandler` accumulates into a `TokenUsage` object accessible via `activeStream.usage`.

## Thinking Block Handling

- Anthropic extended thinking returns `content_block_start` with `type: 'thinking'`.
- The adapter emits `thinking_delta` events (distinct from `text_delta`) so the client can render
  thinking content in a collapsible section.
- When the thinking block ends, a `content_block_stop` with `blockType: 'thinking'` is emitted.

## Integration with SessionExecutor

The existing `executeSession` loop calls `llmClient.chat()` synchronously. With streaming:

1. When `options.streaming === true`, the executor calls `streamHandler.startStream()` instead.
2. The executor iterates `activeStream.events`, forwarding to `WebSocketStreamRelay`.
3. Tool use blocks are accumulated. When a `tool_use_end` event fires, the executor runs the tool
   via `ToolExecutor` and feeds the result back as the next iteration's tool message.
4. The agentic loop continues until no more tool calls or max iterations reached.

## File Manifest

| File                            | Purpose                                       |
| ------------------------------- | --------------------------------------------- |
| `streaming/stream-handler.ts`   | Entry point, `StreamHandler` + `ActiveStream` |
| `streaming/anthropic-stream.ts` | Anthropic SDK streaming adapter               |
| `streaming/openai-stream.ts`    | OpenAI SDK streaming adapter                  |
| `streaming/block-parser.ts`     | Block-aware delta coalescer                   |
| `streaming/websocket-relay.ts`  | WS delivery with throttle + backpressure      |
| `streaming/index.ts`            | Barrel export                                 |

## Testing Strategy

- Unit tests with mock async iterables simulating SDK streams.
- Integration tests with real SDK calls (gated behind API key env vars).
- Backpressure tests with artificial slow WebSocket consumers.
- Cancellation tests verifying abort propagation.
