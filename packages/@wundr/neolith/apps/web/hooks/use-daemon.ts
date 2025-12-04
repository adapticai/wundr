/**
 * useDaemon - React hook for Orchestrator Daemon integration
 *
 * Provides React components with access to the daemon client,
 * connection state, and session management capabilities.
 *
 * @module hooks/use-daemon
 */

'use client';

import { useCallback, useEffect, useState, useRef } from 'react';

import { getDaemonClient } from '@/lib/daemon-client';

import type {
  DaemonClient,
  DaemonStatus,
  Session,
  SpawnSessionPayload,
  ExecuteTaskPayload,
  StreamChunk,
  ToolCallInfo,
} from '@/lib/daemon-client';

// =============================================================================
// Types
// =============================================================================

export interface UseDaemonState {
  /** Whether daemon client is connected */
  connected: boolean;
  /** Whether connection is in progress */
  connecting: boolean;
  /** Connection/operation error */
  error: Error | null;
  /** Current daemon status */
  daemonStatus: DaemonStatus | null;
  /** Active sessions */
  sessions: Session[];
  /** Number of reconnection attempts */
  reconnectAttempts: number;
}

export interface UseDaemonActions {
  /** Connect to daemon */
  connect: () => Promise<void>;
  /** Disconnect from daemon */
  disconnect: () => void;
  /** Spawn a new session */
  spawnSession: (payload: SpawnSessionPayload) => Promise<Session>;
  /** Execute a task in a session */
  executeTask: (payload: ExecuteTaskPayload) => void;
  /** Get session status */
  getSessionStatus: (sessionId: string) => void;
  /** Get daemon status */
  getDaemonStatus: () => void;
  /** Stop a session */
  stopSession: (sessionId: string) => void;
  /** Get a specific session by ID */
  getSession: (sessionId: string) => Session | undefined;
}

export interface UseDaemonStreamHandlers {
  /** Called when streaming starts */
  onStreamStart?: (
    sessionId: string,
    metadata?: Record<string, unknown>
  ) => void;
  /** Called for each stream chunk */
  onStreamChunk?: (chunk: StreamChunk) => void;
  /** Called when streaming ends */
  onStreamEnd?: (sessionId: string, metadata?: Record<string, unknown>) => void;
  /** Called when a tool call starts */
  onToolCallStart?: (info: ToolCallInfo) => void;
  /** Called when a tool call completes */
  onToolCallResult?: (info: ToolCallInfo) => void;
  /** Called when a task starts executing */
  onTaskExecuting?: (sessionId: string, taskId: string) => void;
  /** Called when a task completes */
  onTaskCompleted?: (
    sessionId: string,
    taskId: string,
    result?: unknown
  ) => void;
  /** Called when a task fails */
  onTaskFailed?: (sessionId: string, taskId: string, error: string) => void;
  /** Called when a session is spawned */
  onSessionSpawned?: (session: Session) => void;
  /** Called when a session is updated */
  onSessionUpdated?: (session: Session) => void;
}

export interface UseDaemonOptions {
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
  /** Custom WebSocket URL (overrides env var) */
  url?: string;
  /** Stream event handlers */
  handlers?: UseDaemonStreamHandlers;
}

export interface UseDaemonReturn extends UseDaemonState, UseDaemonActions {}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for integrating with Orchestrator Daemon
 *
 * Manages WebSocket connection state, session management, and real-time
 * updates from the daemon. Automatically handles reconnection and provides
 * a clean API for spawning sessions and executing tasks.
 *
 * @param options - Hook configuration options
 * @returns State and actions for daemon interaction
 *
 * @example
 * Basic usage:
 * ```tsx
 * function OrchestratorPanel() {
 *   const {
 *     connected,
 *     sessions,
 *     connect,
 *     spawnSession,
 *     executeTask,
 *   } = useDaemon({ autoConnect: true });
 *
 *   const handleSpawnSession = async () => {
 *     const session = await spawnSession({
 *       orchestratorId: 'vp_123',
 *       task: {
 *         type: 'code',
 *         description: 'Implement feature X',
 *         priority: 'high',
 *         status: 'pending',
 *       },
 *       sessionType: 'claude-code',
 *     });
 *     console.log('Session created:', session.id);
 *   };
 *
 *   if (!connected) {
 *     return <button onClick={connect}>Connect to Daemon</button>;
 *   }
 *
 *   return (
 *     <div>
 *       <h2>Active Sessions: {sessions.length}</h2>
 *       <button onClick={handleSpawnSession}>Spawn New Session</button>
 *       {sessions.map(session => (
 *         <SessionCard key={session.id} session={session} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * With streaming handlers:
 * ```tsx
 * function StreamingSession() {
 *   const [output, setOutput] = useState('');
 *
 *   const { executeTask } = useDaemon({
 *     autoConnect: true,
 *     handlers: {
 *       onStreamChunk: (chunk) => {
 *         setOutput(prev => prev + chunk.chunk);
 *       },
 *       onToolCallStart: (info) => {
 *         console.log(`Tool ${info.toolName} starting...`);
 *       },
 *       onTaskCompleted: (sessionId, taskId, result) => {
 *         console.log('Task completed:', result);
 *       },
 *     },
 *   });
 *
 *   return <pre>{output}</pre>;
 * }
 * ```
 */
export function useDaemon(options: UseDaemonOptions = {}): UseDaemonReturn {
  const { autoConnect = false, url, handlers = {} } = options;

  const [state, setState] = useState<UseDaemonState>({
    connected: false,
    connecting: false,
    error: null,
    daemonStatus: null,
    sessions: [],
    reconnectAttempts: 0,
  });

  // Use ref to store daemon client to avoid recreating on every render
  const clientRef = useRef<DaemonClient | null>(null);

  // Initialize client
  useEffect(() => {
    clientRef.current = getDaemonClient(url);
  }, [url]);

  // Setup event listeners
  useEffect(() => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    const onConnected = () => {
      setState(prev => ({
        ...prev,
        connected: true,
        connecting: false,
        error: null,
      }));
    };

    const onDisconnected = () => {
      setState(prev => ({ ...prev, connected: false }));
    };

    const onError = (error: Error) => {
      setState(prev => ({ ...prev, error, connecting: false }));
    };

    const onReconnecting = (attempt: number) => {
      setState(prev => ({ ...prev, reconnectAttempts: attempt }));
    };

    const onSessionSpawned = (session: Session) => {
      setState(prev => ({
        ...prev,
        sessions: [...prev.sessions, session],
      }));
      handlers.onSessionSpawned?.(session);
    };

    const onSessionUpdated = (session: Session) => {
      setState(prev => ({
        ...prev,
        sessions: prev.sessions.map(s => (s.id === session.id ? session : s)),
      }));
      handlers.onSessionUpdated?.(session);
    };

    const onDaemonStatus = (status: DaemonStatus) => {
      setState(prev => ({ ...prev, daemonStatus: status }));
    };

    const onStreamStart = (data: {
      sessionId: string;
      metadata?: Record<string, unknown>;
    }) => {
      handlers.onStreamStart?.(data.sessionId, data.metadata);
    };

    const onStreamChunk = (chunk: StreamChunk) => {
      handlers.onStreamChunk?.(chunk);
    };

    const onStreamEnd = (data: {
      sessionId: string;
      metadata?: Record<string, unknown>;
    }) => {
      handlers.onStreamEnd?.(data.sessionId, data.metadata);
    };

    const onToolCallStart = (info: ToolCallInfo) => {
      handlers.onToolCallStart?.(info);
    };

    const onToolCallResult = (info: ToolCallInfo) => {
      handlers.onToolCallResult?.(info);
    };

    const onTaskExecuting = (data: { sessionId: string; taskId: string }) => {
      handlers.onTaskExecuting?.(data.sessionId, data.taskId);
    };

    const onTaskCompleted = (data: {
      sessionId: string;
      taskId: string;
      result?: unknown;
    }) => {
      handlers.onTaskCompleted?.(data.sessionId, data.taskId, data.result);
    };

    const onTaskFailed = (data: {
      sessionId: string;
      taskId: string;
      error: string;
    }) => {
      handlers.onTaskFailed?.(data.sessionId, data.taskId, data.error);
    };

    // Register event listeners
    client.on('connected', onConnected);
    client.on('disconnected', onDisconnected);
    client.on('error', onError);
    client.on('reconnecting', onReconnecting);
    client.on('session_spawned', onSessionSpawned);
    client.on('session_updated', onSessionUpdated);
    client.on('daemon_status', onDaemonStatus);
    client.on('stream_start', onStreamStart);
    client.on('stream_chunk', onStreamChunk);
    client.on('stream_end', onStreamEnd);
    client.on('tool_call_start', onToolCallStart);
    client.on('tool_call_result', onToolCallResult);
    client.on('task_executing', onTaskExecuting);
    client.on('task_completed', onTaskCompleted);
    client.on('task_failed', onTaskFailed);

    // Cleanup
    return () => {
      client.off('connected', onConnected);
      client.off('disconnected', onDisconnected);
      client.off('error', onError);
      client.off('reconnecting', onReconnecting);
      client.off('session_spawned', onSessionSpawned);
      client.off('session_updated', onSessionUpdated);
      client.off('daemon_status', onDaemonStatus);
      client.off('stream_start', onStreamStart);
      client.off('stream_chunk', onStreamChunk);
      client.off('stream_end', onStreamEnd);
      client.off('tool_call_start', onToolCallStart);
      client.off('tool_call_result', onToolCallResult);
      client.off('task_executing', onTaskExecuting);
      client.off('task_completed', onTaskCompleted);
      client.off('task_failed', onTaskFailed);
    };
  }, [handlers]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (
      autoConnect &&
      clientRef.current &&
      !state.connected &&
      !state.connecting
    ) {
      setState(prev => ({ ...prev, connecting: true }));
      clientRef.current.connect().catch(error => {
        setState(prev => ({ ...prev, error, connecting: false }));
      });
    }
  }, [autoConnect, state.connected, state.connecting]);

  // Actions
  const connect = useCallback(async () => {
    if (!clientRef.current) {
      throw new Error('Daemon client not initialized');
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      await clientRef.current.connect();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Connection failed'),
        connecting: false,
      }));
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (!clientRef.current) {
      return;
    }
    clientRef.current.disconnect();
    setState(prev => ({ ...prev, sessions: [] }));
  }, []);

  const spawnSession = useCallback(
    async (payload: SpawnSessionPayload): Promise<Session> => {
      if (!clientRef.current) {
        throw new Error('Daemon client not initialized');
      }

      if (!state.connected) {
        throw new Error('Not connected to daemon');
      }

      return clientRef.current.spawnSession(payload);
    },
    [state.connected]
  );

  const executeTask = useCallback(
    (payload: ExecuteTaskPayload) => {
      if (!clientRef.current) {
        throw new Error('Daemon client not initialized');
      }

      if (!state.connected) {
        throw new Error('Not connected to daemon');
      }

      clientRef.current.executeTask(payload);
    },
    [state.connected]
  );

  const getSessionStatus = useCallback(
    (sessionId: string) => {
      if (!clientRef.current) {
        throw new Error('Daemon client not initialized');
      }

      if (!state.connected) {
        throw new Error('Not connected to daemon');
      }

      clientRef.current.getSessionStatus(sessionId);
    },
    [state.connected]
  );

  const getDaemonStatus = useCallback(() => {
    if (!clientRef.current) {
      throw new Error('Daemon client not initialized');
    }

    if (!state.connected) {
      throw new Error('Not connected to daemon');
    }

    clientRef.current.getDaemonStatus();
  }, [state.connected]);

  const stopSession = useCallback(
    (sessionId: string) => {
      if (!clientRef.current) {
        throw new Error('Daemon client not initialized');
      }

      if (!state.connected) {
        throw new Error('Not connected to daemon');
      }

      clientRef.current.stopSession(sessionId);

      // Remove from local state
      setState(prev => ({
        ...prev,
        sessions: prev.sessions.filter(s => s.id !== sessionId),
      }));
    },
    [state.connected]
  );

  const getSession = useCallback(
    (sessionId: string): Session | undefined => {
      return state.sessions.find(s => s.id === sessionId);
    },
    [state.sessions]
  );

  return {
    // State
    ...state,

    // Actions
    connect,
    disconnect,
    spawnSession,
    executeTask,
    getSessionStatus,
    getDaemonStatus,
    stopSession,
    getSession,
  };
}

/**
 * Hook for monitoring a specific session
 *
 * Provides real-time updates for a single session with streaming support.
 *
 * @param sessionId - The session ID to monitor
 * @param handlers - Event handlers for session updates
 * @returns Session data and streaming output
 *
 * @example
 * ```tsx
 * function SessionMonitor({ sessionId }: { sessionId: string }) {
 *   const { session, streamOutput } = useSessionMonitor(sessionId, {
 *     onStreamChunk: (chunk) => {
 *       console.log('Received chunk:', chunk.chunk);
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <h2>Session: {session?.id}</h2>
 *       <p>Status: {session?.status}</p>
 *       <pre>{streamOutput}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSessionMonitor(
  sessionId: string,
  handlers?: UseDaemonStreamHandlers
) {
  const [streamOutput, setStreamOutput] = useState('');
  const [session, setSession] = useState<Session | undefined>();

  const { getSession, connected } = useDaemon({
    autoConnect: true,
    handlers: {
      onStreamChunk: chunk => {
        if (chunk.sessionId === sessionId) {
          setStreamOutput(prev => prev + chunk.chunk);
          handlers?.onStreamChunk?.(chunk);
        }
      },
      onStreamStart: (sid, metadata) => {
        if (sid === sessionId) {
          setStreamOutput('');
          handlers?.onStreamStart?.(sid, metadata);
        }
      },
      onSessionUpdated: updatedSession => {
        if (updatedSession.id === sessionId) {
          setSession(updatedSession);
          handlers?.onSessionUpdated?.(updatedSession);
        }
      },
      ...handlers,
    },
  });

  useEffect(() => {
    if (connected) {
      const currentSession = getSession(sessionId);
      setSession(currentSession);
    }
  }, [sessionId, connected, getSession]);

  return {
    session,
    streamOutput,
    connected,
  };
}
