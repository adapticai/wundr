'use client';

/**
 * useSessionUpdates - React hook for real-time daemon session lifecycle events.
 *
 * Subscribes to session-related WebSocket messages from the shared daemon
 * connection and maintains an up-to-date map of session state. Optionally
 * filters to a specific session when sessionId is provided.
 *
 * @module hooks/use-session-updates
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useOptionalDaemonContext } from '@/contexts/daemon-context';

import type { DaemonRawMessage } from './use-daemon-connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionStatus =
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'terminated';

export interface SessionInfo {
  /** Unique session identifier. */
  id: string;
  /** Session type (e.g. 'claude-code', 'ruflo'). */
  sessionType?: string;
  /** Current lifecycle status. */
  status: SessionStatus;
  /** Arbitrary session metadata. */
  metadata?: Record<string, unknown>;
  /** ISO timestamp when the session was created. */
  createdAt?: string;
  /** ISO timestamp of the last status update. */
  updatedAt?: string;
  /** Stop / termination reason if applicable. */
  stopReason?: string;
}

export interface SessionOutputChunk {
  /** Session this output belongs to. */
  sessionId: string;
  /** Text content of the chunk. */
  content: string;
  /** Chunk type (text, thinking, code, tool_use, error). */
  chunkType?: string;
  /** Prompt ID the chunk belongs to. */
  promptId?: string;
  /** Sequence index within the stream. */
  index?: number;
  /** Timestamp when the chunk was received. */
  receivedAt: Date;
}

export interface UseSessionUpdatesOptions {
  /**
   * When true, request the current session list from the daemon on mount
   * and after reconnection.
   * Defaults to true.
   */
  fetchOnMount?: boolean;
}

export interface UseSessionUpdatesReturn {
  /**
   * All tracked sessions.
   * When sessionId is provided, this will contain at most one entry.
   */
  sessions: SessionInfo[];
  /**
   * Accumulated output for the watched session (only populated when
   * sessionId is provided).
   */
  sessionOutput: SessionOutputChunk[];
  /**
   * Status of the watched session (only meaningful when sessionId provided).
   */
  sessionStatus: SessionStatus | null;
  /**
   * Subscribe this client to a session's update stream.
   * Sends a subscribe request to the daemon.
   */
  subscribeToSession: (sessionId: string) => void;
  /**
   * Unsubscribe from a session's update stream.
   */
  unsubscribeFromSession: (sessionId: string) => void;
  /**
   * Clear accumulated output for the watched session.
   */
  clearOutput: () => void;
  /** Whether the daemon connection is currently established. */
  isConnected: boolean;
}

// ---------------------------------------------------------------------------
// Message type guards
// ---------------------------------------------------------------------------

function isSessionMessage(
  msg: DaemonRawMessage
): msg is DaemonRawMessage & { sessionId: string } {
  return typeof msg.sessionId === 'string';
}

function extractSessionId(msg: DaemonRawMessage): string | null {
  if (typeof msg.sessionId === 'string') {
    return msg.sessionId;
  }
  const payload = msg.payload as Record<string, unknown> | undefined;
  if (payload && typeof payload.sessionId === 'string') {
    return payload.sessionId;
  }
  const data = msg.data as Record<string, unknown> | undefined;
  if (data && typeof data.sessionId === 'string') {
    return data.sessionId;
  }
  return null;
}

function extractSessionStatus(msg: DaemonRawMessage): SessionStatus | null {
  const candidates = [
    msg.status,
    (msg.payload as Record<string, unknown> | undefined)?.status,
    (msg.data as Record<string, unknown> | undefined)?.status,
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      return c as SessionStatus;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for subscribing to daemon session lifecycle events.
 *
 * @param sessionId - Optional session ID to scope the subscription.
 *   When omitted, all sessions are tracked.
 * @param options - Configuration options.
 *
 * @example
 * ```tsx
 * // Track all sessions
 * function SessionList() {
 *   const { sessions } = useSessionUpdates();
 *   return <ul>{sessions.map(s => <li key={s.id}>{s.status}</li>)}</ul>;
 * }
 *
 * // Track a single session and its output
 * function SessionOutput({ sessionId }: { sessionId: string }) {
 *   const { sessionOutput, sessionStatus } = useSessionUpdates(sessionId);
 *   return (
 *     <div>
 *       <p>Status: {sessionStatus}</p>
 *       <pre>{sessionOutput.map(c => c.content).join('')}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSessionUpdates(
  sessionId?: string,
  options: UseSessionUpdatesOptions = {}
): UseSessionUpdatesReturn {
  const { fetchOnMount = true } = options;

  const daemonCtx = useOptionalDaemonContext();

  // Session registry: id -> SessionInfo
  const [sessionMap, setSessionMap] = useState<Map<string, SessionInfo>>(
    new Map()
  );

  // Output accumulator (only used when sessionId is provided)
  const [sessionOutput, setSessionOutput] = useState<SessionOutputChunk[]>([]);

  // ---------------------------------------------------------------------------
  // Session map helpers
  // ---------------------------------------------------------------------------

  const upsertSession = useCallback(
    (id: string, partial: Partial<SessionInfo>) => {
      setSessionMap(prev => {
        const next = new Map(prev);
        const existing = next.get(id) ?? { id, status: 'initializing' };
        next.set(id, { ...existing, ...partial, id });
        return next;
      });
    },
    []
  );

  const removeSession = useCallback((id: string) => {
    setSessionMap(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Message handlers
  // ---------------------------------------------------------------------------

  const handleSessionCreated = useCallback(
    (msg: DaemonRawMessage) => {
      const id = extractSessionId(msg);
      if (!id) {
        return;
      }
      if (sessionId && id !== sessionId) {
        return;
      }
      const payload = (msg.payload ?? msg) as Record<string, unknown>;
      upsertSession(id, {
        status: 'initializing',
        sessionType: payload.sessionType as string | undefined,
        metadata: payload.metadata as Record<string, unknown> | undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
    [sessionId, upsertSession]
  );

  const handleSessionStatus = useCallback(
    (msg: DaemonRawMessage) => {
      const id = extractSessionId(msg);
      if (!id) {
        return;
      }
      if (sessionId && id !== sessionId) {
        return;
      }
      const status = extractSessionStatus(msg) ?? 'running';
      const payload = (msg.payload ?? msg) as Record<string, unknown>;
      upsertSession(id, {
        status,
        metadata: payload.metadata as Record<string, unknown> | undefined,
        updatedAt: new Date().toISOString(),
      });
    },
    [sessionId, upsertSession]
  );

  const handleSessionStopped = useCallback(
    (msg: DaemonRawMessage) => {
      const id = extractSessionId(msg);
      if (!id) {
        return;
      }
      if (sessionId && id !== sessionId) {
        return;
      }
      const payload = (msg.payload ?? msg) as Record<string, unknown>;
      upsertSession(id, {
        status: 'terminated',
        stopReason: payload.reason as string | undefined,
        updatedAt: new Date().toISOString(),
      });
    },
    [sessionId, upsertSession]
  );

  // v1 protocol: session_spawned
  const handleSessionSpawned = useCallback(
    (msg: DaemonRawMessage) => {
      const id = extractSessionId(msg);
      if (!id) {
        return;
      }
      if (sessionId && id !== sessionId) {
        return;
      }
      const payload = (msg.payload ?? msg) as Record<string, unknown>;
      upsertSession(id, {
        status: 'running',
        sessionType: payload.sessionType as string | undefined,
        metadata: payload.metadata as Record<string, unknown> | undefined,
        createdAt:
          (payload.createdAt as string | undefined) ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
    [sessionId, upsertSession]
  );

  // Handle list_sessions response
  const handleListSessions = useCallback(
    (msg: DaemonRawMessage) => {
      const sessions = (msg.sessions ?? msg.data) as
        | Array<Record<string, unknown>>
        | undefined;
      if (!Array.isArray(sessions)) {
        return;
      }
      setSessionMap(prev => {
        const next = new Map(prev);
        sessions.forEach(s => {
          if (typeof s.id !== 'string') {
            return;
          }
          if (sessionId && s.id !== sessionId) {
            return;
          }
          const existing = next.get(s.id) ?? { id: s.id, status: 'running' };
          next.set(s.id, {
            ...existing,
            id: s.id,
            status: (s.status as SessionStatus) ?? existing.status,
            sessionType:
              (s.sessionType as string | undefined) ?? existing.sessionType,
            metadata:
              (s.metadata as Record<string, unknown> | undefined) ??
              existing.metadata,
            updatedAt: new Date().toISOString(),
          });
        });
        return next;
      });
    },
    [sessionId]
  );

  // Stream output accumulator (scoped to watched sessionId)
  const handleStreamChunk = useCallback(
    (msg: DaemonRawMessage) => {
      if (!sessionId) {
        return;
      }
      const id = extractSessionId(msg);
      if (id !== sessionId) {
        return;
      }

      const payload = (msg.payload ?? msg) as Record<string, unknown>;
      const content =
        (payload.content as string | undefined) ??
        (payload.chunk as string | undefined) ??
        '';

      setSessionOutput(prev => [
        ...prev,
        {
          sessionId: id,
          content,
          chunkType: payload.chunkType as string | undefined,
          promptId: payload.promptId as string | undefined,
          index: payload.index as number | undefined,
          receivedAt: new Date(),
        },
      ]);
    },
    [sessionId]
  );

  const handleStreamStart = useCallback(
    (msg: DaemonRawMessage) => {
      if (!sessionId) {
        return;
      }
      const id = extractSessionId(msg);
      if (id !== sessionId) {
        return;
      }
      // Clear output at stream start
      setSessionOutput([]);
    },
    [sessionId]
  );

  // ---------------------------------------------------------------------------
  // Subscribe to daemon events
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!daemonCtx) {
      return;
    }

    const unsubFns = [
      // v2 protocol events
      daemonCtx.subscribe('session.created', handleSessionCreated),
      daemonCtx.subscribe('session.status', handleSessionStatus),
      daemonCtx.subscribe('session.stopped', handleSessionStopped),
      daemonCtx.subscribe('stream.chunk', handleStreamChunk),
      daemonCtx.subscribe('stream.start', handleStreamStart),
      // v1 protocol events
      daemonCtx.subscribe('session_spawned', handleSessionSpawned),
      daemonCtx.subscribe('session_updated', handleSessionStatus),
      daemonCtx.subscribe('sessions_list', handleListSessions),
      daemonCtx.subscribe('stream_chunk', handleStreamChunk),
      daemonCtx.subscribe('stream_start', handleStreamStart),
    ];

    return () => {
      unsubFns.forEach(fn => fn());
    };
  }, [
    daemonCtx,
    handleSessionCreated,
    handleSessionStatus,
    handleSessionStopped,
    handleSessionSpawned,
    handleListSessions,
    handleStreamChunk,
    handleStreamStart,
  ]);

  // ---------------------------------------------------------------------------
  // Fetch initial session list on connect
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!daemonCtx?.isConnected || !fetchOnMount) {
      return;
    }
    try {
      daemonCtx.sendMessage({ type: 'list_sessions' });
    } catch {
      // Connection may be transiently unavailable
    }
  }, [daemonCtx?.isConnected, daemonCtx, fetchOnMount]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const sessions = Array.from(sessionMap.values());
  const watchedSession = sessionId ? sessionMap.get(sessionId) : undefined;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const subscribeToSession = useCallback(
    (id: string) => {
      if (!daemonCtx?.isConnected) {
        return;
      }
      try {
        daemonCtx.sendMessage({
          type: 'session_status',
          payload: { sessionId: id },
        });
      } catch {
        // ignore
      }
    },
    [daemonCtx]
  );

  const unsubscribeFromSession = useCallback(
    (id: string) => {
      if (!daemonCtx?.isConnected) {
        return;
      }
      try {
        daemonCtx.sendMessage({
          type: 'stop_session',
          payload: { sessionId: id },
        });
      } catch {
        // ignore
      }
      removeSession(id);
    },
    [daemonCtx, removeSession]
  );

  const clearOutput = useCallback(() => {
    setSessionOutput([]);
  }, []);

  return {
    sessions,
    sessionOutput,
    sessionStatus: watchedSession?.status ?? null,
    subscribeToSession,
    unsubscribeFromSession,
    clearOutput,
    isConnected: daemonCtx?.isConnected ?? false,
  };
}
