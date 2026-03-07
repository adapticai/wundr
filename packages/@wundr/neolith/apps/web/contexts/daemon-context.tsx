'use client';

/**
 * DaemonContext - Shared daemon connection context for the Neolith web app.
 *
 * Provides a single WebSocket connection to the orchestrator daemon that is
 * shared across all hooks and components. Components should use
 * useDaemonContext() to access the connection rather than creating their own.
 *
 * Place DaemonProvider near the root of the client component tree (inside
 * SessionProvider so the daemon URL can be sourced from the user session).
 *
 * @module contexts/daemon-context
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useDaemonConnection,
  type DaemonConnectionStatus,
  type DaemonRawMessage,
  type MessageSubscriber,
} from '@/hooks/use-daemon-connection';

import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface DaemonContextValue {
  /** Current WebSocket connection status. */
  status: DaemonConnectionStatus;
  /** True when the WebSocket is open and ready to send. */
  isConnected: boolean;
  /** Last connection error, if any. */
  error: Error | null;
  /** Number of reconnection attempts since the last successful open. */
  reconnectAttempts: number;
  /**
   * Send a raw message to the daemon.
   * Safe to call at any time; throws if the socket is not currently open.
   */
  sendMessage: (message: DaemonRawMessage) => void;
  /**
   * Subscribe to daemon messages of a specific type.
   * Returns an unsubscribe function for use in effect cleanup.
   *
   * @example
   * ```ts
   * useEffect(() => {
   *   return subscribe('health_check_response', (msg) => {
   *     setHealth(msg);
   *   });
   * }, [subscribe]);
   * ```
   */
  subscribe: (type: string, handler: MessageSubscriber) => () => void;
  /**
   * Unsubscribe a specific handler from a message type.
   */
  unsubscribe: (type: string, handler: MessageSubscriber) => void;
  /**
   * Force a reconnection, resetting the backoff counter.
   */
  reconnect: () => void;
  /**
   * The WebSocket URL currently in use (may be null if not yet resolved).
   */
  daemonUrl: string | null;
  /**
   * Update the daemon URL (e.g. when session data becomes available).
   * Setting to null disconnects.
   */
  setDaemonUrl: (url: string | null) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DaemonContext = createContext<DaemonContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider props
// ---------------------------------------------------------------------------

export interface DaemonProviderProps {
  children: ReactNode;
  /**
   * Initial WebSocket URL. If omitted, the provider waits for setDaemonUrl
   * to be called (e.g. after the user session is loaded).
   */
  initialUrl?: string | null;
  /**
   * Maximum reconnect attempts passed through to useDaemonConnection.
   */
  maxReconnectAttempts?: number;
  /**
   * Called when the connection is established.
   */
  onConnect?: () => void;
  /**
   * Called when the connection is lost or intentionally closed.
   */
  onDisconnect?: () => void;
  /**
   * Called when a connection error occurs.
   */
  onError?: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * DaemonProvider wraps children with a shared daemon WebSocket connection.
 *
 * A single WebSocket is maintained for the lifetime of the provider. All
 * hooks that need daemon data (useDaemonStatus, useSessionUpdates, etc.)
 * consume this shared connection via useDaemonContext().
 *
 * @example
 * ```tsx
 * // In your root layout client component:
 * <DaemonProvider initialUrl={process.env.NEXT_PUBLIC_DAEMON_WS_URL}>
 *   {children}
 * </DaemonProvider>
 * ```
 *
 * @example
 * // With dynamic URL from session:
 * ```tsx
 * function DaemonWrapper({ children }: { children: ReactNode }) {
 *   const { data: session } = useSession();
 *   return (
 *     <DaemonProvider initialUrl={session?.daemonUrl ?? null}>
 *       {children}
 *     </DaemonProvider>
 *   );
 * }
 * ```
 */
export function DaemonProvider({
  children,
  initialUrl = null,
  maxReconnectAttempts,
  onConnect,
  onDisconnect,
  onError,
}: DaemonProviderProps) {
  const [daemonUrl, setDaemonUrlState] = useState<string | null>(initialUrl);

  // Keep the URL in sync if the prop changes (e.g. session loads after mount)
  const previousInitialUrlRef = useRef(initialUrl);
  useEffect(() => {
    if (initialUrl !== previousInitialUrlRef.current) {
      previousInitialUrlRef.current = initialUrl;
      setDaemonUrlState(initialUrl);
    }
  }, [initialUrl]);

  const connection = useDaemonConnection({
    url: daemonUrl ?? undefined,
    maxReconnectAttempts,
    onConnect,
    onDisconnect,
    onError,
  });

  const setDaemonUrl = useCallback((url: string | null) => {
    setDaemonUrlState(url);
  }, []);

  const value = useMemo<DaemonContextValue>(
    () => ({
      status: connection.status,
      isConnected: connection.isConnected,
      error: connection.error,
      reconnectAttempts: connection.reconnectAttempts,
      sendMessage: connection.sendMessage,
      subscribe: connection.subscribe,
      unsubscribe: connection.unsubscribe,
      reconnect: connection.reconnect,
      daemonUrl,
      setDaemonUrl,
    }),
    [
      connection.status,
      connection.isConnected,
      connection.error,
      connection.reconnectAttempts,
      connection.sendMessage,
      connection.subscribe,
      connection.unsubscribe,
      connection.reconnect,
      daemonUrl,
      setDaemonUrl,
    ]
  );

  return (
    <DaemonContext.Provider value={value}>{children}</DaemonContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hooks
// ---------------------------------------------------------------------------

/**
 * Access the shared daemon connection context.
 *
 * Must be called within a component tree wrapped by DaemonProvider.
 * Throws if called outside the provider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isConnected, sendMessage } = useDaemonContext();
 *   // ...
 * }
 * ```
 */
export function useDaemonContext(): DaemonContextValue {
  const ctx = useContext(DaemonContext);
  if (!ctx) {
    throw new Error('useDaemonContext must be used within a DaemonProvider');
  }
  return ctx;
}

/**
 * Access the shared daemon connection context without throwing.
 * Returns null if called outside DaemonProvider.
 */
export function useOptionalDaemonContext(): DaemonContextValue | null {
  return useContext(DaemonContext);
}
