/**
 * Streaming Response
 *
 * Provides a structured API for handlers to send progressive results
 * back to clients. A streaming response is a sequence of events
 * correlated to a single RPC request:
 *
 *   1. A "stream.start" event signals the client that data will arrive
 *      incrementally.
 *   2. Zero or more "stream.progress" events carry partial results.
 *   3. A final response frame (type: "res") delivers the complete
 *      result or error, closing the stream.
 *
 * The caller obtains a StreamingResponse from the handler context,
 * sends progress events, and then closes with either `complete()` or
 * `error()`.  If the stream is abandoned (e.g. the handler throws),
 * a cleanup guard sends an error automatically.
 */

import { randomUUID } from 'node:crypto';

import { ErrorCodes, errorShape } from './protocol-v2';

import type { EventFrame, ResponseFrame } from './protocol-v2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamSink {
  /** Send a JSON event frame. */
  sendEvent: (frame: EventFrame) => void;
  /** Send a JSON response frame. */
  sendResponse: (frame: ResponseFrame) => void;
  /** Whether the transport is still open. */
  isOpen: () => boolean;
}

export interface StreamProgress {
  /** Arbitrary incremental data sent to the client. */
  data: unknown;
  /** Progress indicator (0.0 to 1.0). */
  progress?: number;
  /** Human-readable status message. */
  message?: string;
}

export type StreamState = 'idle' | 'started' | 'completed' | 'errored';

// ---------------------------------------------------------------------------
// StreamingResponse
// ---------------------------------------------------------------------------

export class StreamingResponse {
  /** Unique identifier for this stream (used in event frames). */
  readonly streamId: string;

  /** The request ID this stream is correlated to. */
  readonly requestId: string;

  /** The RPC method that initiated this stream. */
  readonly method: string;

  private sink: StreamSink;
  private seq = 0;
  private _state: StreamState = 'idle';
  private _itemsSent = 0;

  constructor(
    requestId: string,
    method: string,
    sink: StreamSink,
    streamId?: string
  ) {
    this.requestId = requestId;
    this.method = method;
    this.sink = sink;
    this.streamId = streamId ?? `stream_${randomUUID()}`;
  }

  /** Current stream state. */
  get state(): StreamState {
    return this._state;
  }

  /** Number of progress items sent. */
  get itemsSent(): number {
    return this._itemsSent;
  }

  /** Whether the stream has been finalized (completed or errored). */
  get isFinalized(): boolean {
    return this._state === 'completed' || this._state === 'errored';
  }

  /**
   * Begin the stream. Sends a "stream.start" event to the client.
   *
   * @param metadata - Optional metadata included in the start event.
   */
  start(metadata?: Record<string, unknown>): void {
    if (this._state !== 'idle') {
      throw new Error(`cannot start stream in state '${this._state}'`);
    }
    if (!this.sink.isOpen()) {
      this._state = 'errored';
      return;
    }

    this._state = 'started';

    this.sink.sendEvent({
      type: 'event',
      event: 'stream.start',
      payload: {
        streamId: this.streamId,
        requestId: this.requestId,
        method: this.method,
        ...metadata,
      },
      seq: this.seq++,
    });
  }

  /**
   * Send a progress event with incremental data.
   *
   * @throws {Error} If the stream has not been started or is already finalized.
   */
  sendProgress(progress: StreamProgress): void {
    if (this._state !== 'started') {
      throw new Error(`cannot send progress in state '${this._state}'`);
    }
    if (!this.sink.isOpen()) {
      this._state = 'errored';
      return;
    }

    this.sink.sendEvent({
      type: 'event',
      event: 'stream.progress',
      payload: {
        streamId: this.streamId,
        requestId: this.requestId,
        index: this._itemsSent,
        data: progress.data,
        progress: progress.progress,
        message: progress.message,
      },
      seq: this.seq++,
    });

    this._itemsSent++;
  }

  /**
   * Complete the stream successfully. Sends the final response frame.
   *
   * @param payload - The final result payload.
   */
  complete(payload?: unknown): void {
    if (this.isFinalized) {
      return; // Idempotent
    }

    const wasStarted = this._state === 'started';
    this._state = 'completed';

    if (!this.sink.isOpen()) {
      return;
    }

    // If we never started, just send a normal response
    if (!wasStarted) {
      this.sink.sendResponse({
        type: 'res',
        id: this.requestId,
        ok: true,
        payload,
      });
      return;
    }

    // Send stream.end event
    this.sink.sendEvent({
      type: 'event',
      event: 'stream.end',
      payload: {
        streamId: this.streamId,
        requestId: this.requestId,
        itemsSent: this._itemsSent,
      },
      seq: this.seq++,
    });

    // Send final response
    this.sink.sendResponse({
      type: 'res',
      id: this.requestId,
      ok: true,
      payload: {
        streamId: this.streamId,
        itemsSent: this._itemsSent,
        result: payload,
      },
    });
  }

  /**
   * Terminate the stream with an error.
   */
  error(code: string, message: string, details?: unknown): void {
    if (this.isFinalized) {
      return; // Idempotent
    }

    const wasStarted = this._state === 'started';
    this._state = 'errored';

    if (!this.sink.isOpen()) {
      return;
    }

    const err = errorShape(code as any, message, { details });

    // If we started a stream, send a stream.error event first
    if (wasStarted) {
      this.sink.sendEvent({
        type: 'event',
        event: 'stream.error',
        payload: {
          streamId: this.streamId,
          requestId: this.requestId,
          error: err,
        },
        seq: this.seq++,
      });
    }

    // Always send the error response
    this.sink.sendResponse({
      type: 'res',
      id: this.requestId,
      ok: false,
      error: err,
    });
  }

  /**
   * Create a cleanup guard that auto-errors the stream if it has not been
   * finalized when the guard is disposed. Use in a try/finally pattern.
   */
  guard(): StreamGuard {
    return new StreamGuard(this);
  }
}

// ---------------------------------------------------------------------------
// StreamGuard
// ---------------------------------------------------------------------------

/**
 * Safety net that ensures a stream is always finalized, even if the
 * handler throws. Use with try/finally or the Symbol.dispose protocol.
 */
export class StreamGuard {
  private stream: StreamingResponse;
  private _released = false;

  constructor(stream: StreamingResponse) {
    this.stream = stream;
  }

  /** Explicitly release the guard without auto-erroring. */
  release(): void {
    this._released = true;
  }

  /**
   * Finalize the stream with an error if it was not already finalized
   * and the guard has not been released.
   */
  dispose(): void {
    if (this._released || this.stream.isFinalized) {
      return;
    }
    this.stream.error(
      ErrorCodes.INTERNAL,
      'stream abandoned: handler did not finalize the stream'
    );
  }

  /** Alias for dispose() -- allows use with Symbol.dispose in TS 5.2+. */
  [Symbol.dispose](): void {
    this.dispose();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a StreamingResponse from a handler context.
 *
 * This is the recommended way to create a streaming response inside a
 * method handler.
 */
export function createStreamingResponse(
  requestId: string,
  method: string,
  sendEvent: (frame: EventFrame) => void,
  sendResponse: (frame: ResponseFrame) => void,
  isOpen: () => boolean
): StreamingResponse {
  const sink: StreamSink = { sendEvent, sendResponse, isOpen };
  return new StreamingResponse(requestId, method, sink);
}
