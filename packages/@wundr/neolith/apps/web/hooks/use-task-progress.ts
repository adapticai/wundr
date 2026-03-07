'use client';

/**
 * useTaskProgress - React hook for real-time daemon task execution progress.
 *
 * Subscribes to task-related WebSocket messages from the shared daemon
 * connection and tracks execution status, tool calls, routing decisions,
 * and streaming output for a given task.
 *
 * @module hooks/use-task-progress
 */

import { useCallback, useEffect, useState } from 'react';

import { useOptionalDaemonContext } from '@/contexts/daemon-context';

import type { DaemonRawMessage } from './use-daemon-connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus =
  | 'idle'
  | 'routing'
  | 'executing'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ToolCallRecord {
  /** The tool that was invoked. */
  toolName: string;
  /** Request ID for correlation. */
  requestId?: string;
  /** Input passed to the tool. */
  toolInput?: Record<string, unknown>;
  /** Current status of the tool call. */
  status: 'started' | 'running' | 'completed' | 'failed' | 'denied' | 'timeout';
  /** Execution progress [0..1] if provided by the daemon. */
  progress?: number;
  /** Tool result (set on completion). */
  result?: unknown;
  /** Error message if failed. */
  error?: string;
  /** Time taken in milliseconds (set on completion). */
  durationMs?: number;
  /** Timestamp when this record was last updated. */
  updatedAt: Date;
}

export interface RoutingDecision {
  /** Session that was selected to handle the task. */
  sessionId: string;
  /** Task ID being routed. */
  taskId?: string;
  /** Any routing metadata provided by the daemon. */
  metadata?: Record<string, unknown>;
  /** Timestamp of the routing decision. */
  decidedAt: Date;
}

export interface TaskOutputChunk {
  /** Task / session this output belongs to. */
  taskId?: string;
  sessionId?: string;
  /** Text content. */
  content: string;
  /** Chunk type (text, thinking, code, tool_use, error). */
  chunkType?: string;
  /** Sequence index within the stream. */
  index?: number;
  /** Timestamp when the chunk was received. */
  receivedAt: Date;
}

export interface UseTaskProgressReturn {
  /** Current task execution status. */
  taskStatus: TaskStatus;
  /** Routing decision if the task has been dispatched to a session. */
  routingDecision: RoutingDecision | null;
  /** Accumulated text output from streaming. */
  output: TaskOutputChunk[];
  /**
   * Overall task progress [0..1], derived from the most-recently active
   * tool call, or null if unavailable.
   */
  progress: number | null;
  /** All tool calls observed during this task's lifecycle. */
  toolCalls: ToolCallRecord[];
  /** The most-recently active tool call, if any. */
  activeToolCall: ToolCallRecord | null;
  /** Error message if the task failed. */
  errorMessage: string | null;
  /** Clear accumulated output and reset progress state. */
  reset: () => void;
  /** Whether the daemon connection is currently established. */
  isConnected: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractFromPayload<T>(
  msg: DaemonRawMessage,
  key: string
): T | undefined {
  if (key in msg) {
    return msg[key] as T;
  }
  const payload = msg.payload as Record<string, unknown> | undefined;
  if (payload && key in payload) {
    return payload[key] as T;
  }
  const data = msg.data as Record<string, unknown> | undefined;
  if (data && key in data) {
    return data[key] as T;
  }
  return undefined;
}

function msgMatchesTask(
  msg: DaemonRawMessage,
  taskId?: string,
  sessionId?: string
): boolean {
  if (!taskId && !sessionId) {
    // No filter — accept all task-related messages
    return true;
  }

  const msgTaskId =
    extractFromPayload<string>(msg, 'taskId') ??
    extractFromPayload<string>(msg, 'task_id');

  const msgSessionId =
    extractFromPayload<string>(msg, 'sessionId') ??
    extractFromPayload<string>(msg, 'session_id');

  if (taskId && msgTaskId === taskId) {
    return true;
  }
  if (sessionId && msgSessionId === sessionId) {
    return true;
  }

  // Accept if neither filter matches (message has no IDs we can compare)
  if (!msgTaskId && !msgSessionId) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for tracking task routing and execution progress.
 *
 * @param taskId - Optional task ID to scope the subscription.
 *   When provided, only events for this specific task are tracked.
 *   When omitted, all task events on the connection are tracked.
 * @param sessionId - Optional session ID to scope the subscription.
 *   Used as a fallback filter when no taskId is provided, or combined
 *   with taskId to narrow results further.
 *
 * @example
 * ```tsx
 * // Track a specific task
 * function TaskProgressPanel({ taskId }: { taskId: string }) {
 *   const { taskStatus, progress, output, activeToolCall } = useTaskProgress(taskId);
 *
 *   return (
 *     <div>
 *       <p>Status: {taskStatus}</p>
 *       {progress !== null && <progress value={progress} />}
 *       {activeToolCall && <p>Running tool: {activeToolCall.toolName}</p>}
 *       <pre>{output.map(c => c.content).join('')}</pre>
 *     </div>
 *   );
 * }
 *
 * // Track all tasks on a session
 * function SessionTaskPanel({ sessionId }: { sessionId: string }) {
 *   const { taskStatus, toolCalls } = useTaskProgress(undefined, sessionId);
 *   // ...
 * }
 * ```
 */
export function useTaskProgress(
  taskId?: string,
  sessionId?: string
): UseTaskProgressReturn {
  const daemonCtx = useOptionalDaemonContext();

  const [taskStatus, setTaskStatus] = useState<TaskStatus>('idle');
  const [routingDecision, setRoutingDecision] =
    useState<RoutingDecision | null>(null);
  const [output, setOutput] = useState<TaskOutputChunk[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Message handlers
  // ---------------------------------------------------------------------------

  const handleTaskExecuting = useCallback(
    (msg: DaemonRawMessage) => {
      if (!msgMatchesTask(msg, taskId, sessionId)) {
        return;
      }
      const routedSessionId = extractFromPayload<string>(msg, 'sessionId');
      const routedTaskId = extractFromPayload<string>(msg, 'taskId');

      setTaskStatus('executing');
      setErrorMessage(null);

      if (routedSessionId) {
        setRoutingDecision({
          sessionId: routedSessionId,
          taskId: routedTaskId,
          decidedAt: new Date(),
        });
      }
    },
    [taskId, sessionId]
  );

  const handleTaskCompleted = useCallback(
    (msg: DaemonRawMessage) => {
      if (!msgMatchesTask(msg, taskId, sessionId)) {
        return;
      }
      setTaskStatus('completed');
    },
    [taskId, sessionId]
  );

  const handleTaskFailed = useCallback(
    (msg: DaemonRawMessage) => {
      if (!msgMatchesTask(msg, taskId, sessionId)) {
        return;
      }
      const err =
        extractFromPayload<string>(msg, 'error') ??
        extractFromPayload<string>(msg, 'message') ??
        'Task failed';
      setTaskStatus('failed');
      setErrorMessage(err);
    },
    [taskId, sessionId]
  );

  // Tool call started (v1: tool_call_start, v2: tool.request)
  const handleToolCallStart = useCallback(
    (msg: DaemonRawMessage) => {
      if (!msgMatchesTask(msg, taskId, sessionId)) {
        return;
      }
      const name =
        extractFromPayload<string>(msg, 'toolName') ??
        extractFromPayload<string>(msg, 'tool_name') ??
        'unknown';
      const requestId = extractFromPayload<string>(msg, 'requestId');
      const toolInput = extractFromPayload<Record<string, unknown>>(
        msg,
        'toolInput'
      );

      const record: ToolCallRecord = {
        toolName: name,
        requestId,
        toolInput,
        status: 'started',
        updatedAt: new Date(),
      };

      setToolCalls(prev => {
        // If there's already a record for this requestId, update it
        if (requestId) {
          const idx = prev.findIndex(tc => tc.requestId === requestId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = record;
            return next;
          }
        }
        return [...prev, record];
      });

      if (taskStatus !== 'streaming') {
        setTaskStatus('executing');
      }
    },
    [taskId, sessionId, taskStatus]
  );

  // Tool status update (v2: tool.status)
  const handleToolStatus = useCallback(
    (msg: DaemonRawMessage) => {
      if (!msgMatchesTask(msg, taskId, sessionId)) {
        return;
      }
      const requestId = extractFromPayload<string>(msg, 'requestId');
      const status = extractFromPayload<ToolCallRecord['status']>(
        msg,
        'status'
      );
      const progress = extractFromPayload<number>(msg, 'progress');

      if (!requestId && !status) {
        return;
      }

      setToolCalls(prev =>
        prev.map(tc => {
          if (requestId && tc.requestId !== requestId) {
            return tc;
          }
          return {
            ...tc,
            status: status ?? tc.status,
            progress: progress ?? tc.progress,
            updatedAt: new Date(),
          };
        })
      );
    },
    [taskId, sessionId]
  );

  // Tool call result (v1: tool_call_result, v2: tool.result)
  const handleToolResult = useCallback(
    (msg: DaemonRawMessage) => {
      if (!msgMatchesTask(msg, taskId, sessionId)) {
        return;
      }
      const requestId = extractFromPayload<string>(msg, 'requestId');
      const toolName =
        extractFromPayload<string>(msg, 'toolName') ??
        extractFromPayload<string>(msg, 'tool_name');
      const status =
        (extractFromPayload<string>(msg, 'status') as
          | ToolCallRecord['status']
          | undefined) ?? 'completed';
      const result = extractFromPayload<unknown>(msg, 'result');
      const error = extractFromPayload<string>(msg, 'error');
      const durationMs = extractFromPayload<number>(msg, 'durationMs');

      setToolCalls(prev =>
        prev.map(tc => {
          const matches = requestId
            ? tc.requestId === requestId
            : tc.toolName === toolName;
          if (!matches) {
            return tc;
          }
          return {
            ...tc,
            status,
            result,
            error,
            durationMs,
            progress: status === 'completed' ? 1 : tc.progress,
            updatedAt: new Date(),
          };
        })
      );
    },
    [taskId, sessionId]
  );

  // Stream start: begin output capture
  const handleStreamStart = useCallback(
    (msg: DaemonRawMessage) => {
      if (!msgMatchesTask(msg, taskId, sessionId)) {
        return;
      }
      setTaskStatus('streaming');
      setOutput([]);
    },
    [taskId, sessionId]
  );

  // Stream chunk: accumulate output
  const handleStreamChunk = useCallback(
    (msg: DaemonRawMessage) => {
      if (!msgMatchesTask(msg, taskId, sessionId)) {
        return;
      }

      const content =
        extractFromPayload<string>(msg, 'content') ??
        extractFromPayload<string>(msg, 'chunk') ??
        '';

      setOutput(prev => [
        ...prev,
        {
          taskId: extractFromPayload<string>(msg, 'taskId'),
          sessionId: extractFromPayload<string>(msg, 'sessionId'),
          content,
          chunkType: extractFromPayload<string>(msg, 'chunkType'),
          index: extractFromPayload<number>(msg, 'index'),
          receivedAt: new Date(),
        },
      ]);
    },
    [taskId, sessionId]
  );

  // Stream end: mark task completed if not already failed
  const handleStreamEnd = useCallback(
    (msg: DaemonRawMessage) => {
      if (!msgMatchesTask(msg, taskId, sessionId)) {
        return;
      }
      setTaskStatus(prev => (prev === 'failed' ? 'failed' : 'completed'));
    },
    [taskId, sessionId]
  );

  // Stream error
  const handleStreamError = useCallback(
    (msg: DaemonRawMessage) => {
      if (!msgMatchesTask(msg, taskId, sessionId)) {
        return;
      }
      const error = extractFromPayload<Record<string, unknown>>(msg, 'error');
      const message =
        (error?.message as string | undefined) ??
        extractFromPayload<string>(msg, 'message') ??
        'Stream error';
      setTaskStatus('failed');
      setErrorMessage(message);
    },
    [taskId, sessionId]
  );

  // ---------------------------------------------------------------------------
  // Subscribe to daemon events
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!daemonCtx) {
      return;
    }

    const unsubFns = [
      // v1 protocol
      daemonCtx.subscribe('task_executing', handleTaskExecuting),
      daemonCtx.subscribe('task_completed', handleTaskCompleted),
      daemonCtx.subscribe('task_failed', handleTaskFailed),
      daemonCtx.subscribe('tool_call_start', handleToolCallStart),
      daemonCtx.subscribe('tool_call_result', handleToolResult),
      daemonCtx.subscribe('stream_start', handleStreamStart),
      daemonCtx.subscribe('stream_chunk', handleStreamChunk),
      daemonCtx.subscribe('stream_end', handleStreamEnd),
      // v2 protocol
      daemonCtx.subscribe('tool.request', handleToolCallStart),
      daemonCtx.subscribe('tool.status', handleToolStatus),
      daemonCtx.subscribe('tool.result', handleToolResult),
      daemonCtx.subscribe('stream.start', handleStreamStart),
      daemonCtx.subscribe('stream.chunk', handleStreamChunk),
      daemonCtx.subscribe('stream.end', handleStreamEnd),
      daemonCtx.subscribe('stream.error', handleStreamError),
    ];

    return () => {
      unsubFns.forEach(fn => fn());
    };
  }, [
    daemonCtx,
    handleTaskExecuting,
    handleTaskCompleted,
    handleTaskFailed,
    handleToolCallStart,
    handleToolStatus,
    handleToolResult,
    handleStreamStart,
    handleStreamChunk,
    handleStreamEnd,
    handleStreamError,
  ]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const activeToolCall =
    toolCalls.find(tc => tc.status === 'started' || tc.status === 'running') ??
    null;

  const progress = activeToolCall?.progress ?? null;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const reset = useCallback(() => {
    setTaskStatus('idle');
    setRoutingDecision(null);
    setOutput([]);
    setToolCalls([]);
    setErrorMessage(null);
  }, []);

  return {
    taskStatus,
    routingDecision,
    output,
    progress,
    toolCalls,
    activeToolCall,
    errorMessage,
    reset,
    isConnected: daemonCtx?.isConnected ?? false,
  };
}
