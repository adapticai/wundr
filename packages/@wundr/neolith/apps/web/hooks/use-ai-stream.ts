'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * SSE (Server-Sent Events) connection status
 */
export type StreamStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'error'
  | 'closed';

/**
 * Stream event types
 */
export type StreamEventType =
  | 'message'
  | 'error'
  | 'done'
  | 'token'
  | 'metadata';

/**
 * Stream event data
 */
export interface StreamEvent {
  type: StreamEventType;
  data: string;
  timestamp: number;
}

/**
 * Parsed stream chunk
 */
export interface StreamChunk {
  content: string;
  tokens?: number;
  metadata?: Record<string, unknown>;
  done?: boolean;
}

/**
 * Stream error
 */
export class StreamError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'CONNECTION_FAILED'
      | 'STREAM_ERROR'
      | 'PARSE_ERROR'
      | 'TIMEOUT',
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'StreamError';
  }
}

/**
 * Options for useAIStream hook
 */
export interface UseAIStreamOptions {
  /** API endpoint for streaming */
  endpoint: string;
  /** Request method */
  method?: 'POST' | 'GET';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: Record<string, unknown>;
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in ms */
  reconnectDelay?: number;
  /** Stream timeout in ms */
  timeout?: number;
  /** Callback when stream starts */
  onStart?: () => void;
  /** Callback when chunk received */
  onChunk?: (chunk: StreamChunk) => void;
  /** Callback when stream completes */
  onComplete?: (fullContent: string) => void;
  /** Callback when error occurs */
  onError?: (error: StreamError) => void;
  /** Callback when connection status changes */
  onStatusChange?: (status: StreamStatus) => void;
}

/**
 * Return type for useAIStream hook
 */
export interface UseAIStreamReturn {
  /** Current stream status */
  status: StreamStatus;
  /** Accumulated stream content */
  content: string;
  /** Current error if any */
  error: StreamError | null;
  /** Whether stream is active */
  isStreaming: boolean;
  /** Start streaming */
  start: () => Promise<void>;
  /** Stop streaming */
  stop: () => void;
  /** Reset stream state */
  reset: () => void;
  /** Total tokens received */
  totalTokens: number;
  /** Stream events history */
  events: StreamEvent[];
}

const DEFAULT_RECONNECT_ATTEMPTS = 3;
const DEFAULT_RECONNECT_DELAY = 1000;
const DEFAULT_TIMEOUT = 30000;

/**
 * Hook for handling SSE (Server-Sent Events) streaming from AI APIs
 *
 * Features:
 * - SSE connection management
 * - Automatic reconnection with exponential backoff
 * - AbortController for cancellation
 * - Timeout handling
 * - Event history tracking
 * - Token counting
 * - Error handling with retries
 *
 * @example
 * ```tsx
 * const { content, isStreaming, start, stop } = useAIStream({
 *   endpoint: '/api/ai/stream',
 *   body: { prompt: 'Hello' },
 *   onChunk: (chunk) => console.log('Received:', chunk.content),
 *   onComplete: (full) => console.log('Done:', full),
 * });
 *
 * // Start streaming
 * await start();
 * ```
 */
export function useAIStream(options: UseAIStreamOptions): UseAIStreamReturn {
  const {
    endpoint,
    method = 'POST',
    headers: customHeaders,
    body,
    autoReconnect = true,
    maxReconnectAttempts = DEFAULT_RECONNECT_ATTEMPTS,
    reconnectDelay = DEFAULT_RECONNECT_DELAY,
    timeout = DEFAULT_TIMEOUT,
    onStart,
    onChunk,
    onComplete,
    onError,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<StreamStatus>('idle');
  const [content, setContent] = useState('');
  const [error, setError] = useState<StreamError | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const [events, setEvents] = useState<StreamEvent[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Update status and notify
   */
  const updateStatus = useCallback(
    (newStatus: StreamStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  /**
   * Add event to history
   */
  const addEvent = useCallback((type: StreamEventType, data: string) => {
    setEvents(prev => [
      ...prev,
      {
        type,
        data,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  /**
   * Parse SSE data chunk
   */
  const parseChunk = useCallback((data: string): StreamChunk | null => {
    try {
      // Handle different streaming formats

      // Format 1: JSON objects
      if (data.startsWith('{')) {
        const parsed = JSON.parse(data);
        return {
          content: parsed.content || parsed.text || '',
          tokens: parsed.tokens,
          metadata: parsed.metadata,
          done: parsed.done || false,
        };
      }

      // Format 2: data: prefix (SSE format)
      if (data.startsWith('data: ')) {
        const jsonStr = data.slice(6);
        if (jsonStr === '[DONE]') {
          return { content: '', done: true };
        }
        const parsed = JSON.parse(jsonStr);
        return {
          content: parsed.choices?.[0]?.delta?.content || parsed.content || '',
          tokens: parsed.usage?.total_tokens,
          metadata: parsed,
          done: parsed.choices?.[0]?.finish_reason === 'stop',
        };
      }

      // Format 3: Plain text
      return {
        content: data,
        done: false,
      };
    } catch (err) {
      console.error('[useAIStream] Parse error:', err);
      return null;
    }
  }, []);

  /**
   * Handle stream error
   */
  const handleError = useCallback(
    (err: unknown, code: StreamError['code'] = 'STREAM_ERROR') => {
      const streamError =
        err instanceof StreamError
          ? err
          : new StreamError(
              err instanceof Error ? err.message : 'Stream error occurred',
              code,
              err instanceof Error ? err : undefined
            );

      setError(streamError);
      updateStatus('error');
      addEvent('error', streamError.message);
      onError?.(streamError);
    },
    [updateStatus, addEvent, onError]
  );

  /**
   * Start streaming
   */
  const start = useCallback(async () => {
    // Reset state
    setContent('');
    setError(null);
    setTotalTokens(0);
    setEvents([]);
    reconnectAttemptsRef.current = 0;

    // Create abort controller
    abortControllerRef.current = new AbortController();

    const attemptConnection = async (): Promise<void> => {
      try {
        updateStatus('connecting');

        const headers = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...customHeaders,
        };

        const requestOptions: RequestInit = {
          method,
          headers,
          signal: abortControllerRef.current?.signal,
        };

        if (method === 'POST' && body) {
          requestOptions.body = JSON.stringify(body);
        }

        // Set timeout
        timeoutRef.current = setTimeout(() => {
          handleError(new Error('Stream timeout'), 'TIMEOUT');
          stop();
        }, timeout);

        const response = await fetch(endpoint, requestOptions);

        if (!response.ok) {
          throw new StreamError(
            `HTTP ${response.status}: ${response.statusText}`,
            'CONNECTION_FAILED'
          );
        }

        updateStatus('connected');
        onStart?.();
        addEvent('message', 'Stream connected');

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new StreamError('No response body', 'CONNECTION_FAILED');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        updateStatus('streaming');

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            updateStatus('closed');
            addEvent('done', 'Stream completed');
            onComplete?.(fullContent);
            break;
          }

          // Decode chunk
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            const parsed = parseChunk(line);
            if (!parsed) continue;

            if (parsed.done) {
              updateStatus('closed');
              addEvent('done', 'Stream completed');
              onComplete?.(fullContent);
              reader.cancel();
              break;
            }

            if (parsed.content) {
              fullContent += parsed.content;
              setContent(fullContent);
              addEvent('token', parsed.content);
              onChunk?.(parsed);
            }

            if (parsed.tokens) {
              setTotalTokens(parsed.tokens);
            }
          }
        }

        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      } catch (err) {
        // Check if aborted
        if (err instanceof Error && err.name === 'AbortError') {
          updateStatus('closed');
          return;
        }

        // Handle connection errors with retry
        if (
          autoReconnect &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current++;
          const delay =
            reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);

          addEvent(
            'error',
            `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          await attemptConnection();
        } else {
          handleError(err, 'CONNECTION_FAILED');
        }
      }
    };

    await attemptConnection();
  }, [
    endpoint,
    method,
    customHeaders,
    body,
    autoReconnect,
    maxReconnectAttempts,
    reconnectDelay,
    timeout,
    onStart,
    onChunk,
    onComplete,
    updateStatus,
    addEvent,
    handleError,
    parseChunk,
  ]);

  /**
   * Stop streaming
   */
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (status === 'streaming' || status === 'connecting') {
      updateStatus('closed');
      addEvent('message', 'Stream stopped by user');
    }
  }, [status, updateStatus, addEvent]);

  /**
   * Reset stream state
   */
  const reset = useCallback(() => {
    stop();
    setContent('');
    setError(null);
    setTotalTokens(0);
    setEvents([]);
    updateStatus('idle');
  }, [stop, updateStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const isStreaming = status === 'streaming' || status === 'connecting';

  return {
    status,
    content,
    error,
    isStreaming,
    start,
    stop,
    reset,
    totalTokens,
    events,
  };
}
