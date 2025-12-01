'use client';

import '@livekit/components-styles';

import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * LiveKit configuration context
 */
interface LiveKitConfig {
  serverUrl: string;
  token: string | null;
  roomName: string | null;
}

/**
 * LiveKit context value
 */
interface LiveKitContextValue {
  config: LiveKitConfig;
  setConfig: (config: Partial<LiveKitConfig>) => void;
  connect: (roomName: string, token: string) => void;
  disconnect: () => void;
  isConnected: boolean;
}

/**
 * LiveKit context
 */
const LiveKitContext = createContext<LiveKitContextValue | undefined>(
  undefined
);

/**
 * Props for LiveKitProvider component
 */
export interface LiveKitProviderProps {
  /** Child components */
  children: React.ReactNode;
  /** Optional LiveKit server URL (defaults to env var) */
  serverUrl?: string;
}

/**
 * LiveKitProvider component
 *
 * Provides LiveKit configuration and connection state to child components.
 * Wraps the application to enable video/audio call functionality.
 *
 * @example
 * ```tsx
 * <LiveKitProvider>
 *   <App />
 * </LiveKitProvider>
 * ```
 */
export function LiveKitProvider({ children, serverUrl }: LiveKitProviderProps) {
  const defaultServerUrl =
    serverUrl ?? process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'wss://localhost:7880';

  const [config, setConfigState] = useState<LiveKitConfig>({
    serverUrl: defaultServerUrl,
    token: null,
    roomName: null,
  });

  const setConfig = useCallback((newConfig: Partial<LiveKitConfig>) => {
    setConfigState(prev => ({ ...prev, ...newConfig }));
  }, []);

  const connect = useCallback((roomName: string, token: string) => {
    setConfigState(prev => ({
      ...prev,
      roomName,
      token,
    }));
  }, []);

  const disconnect = useCallback(() => {
    setConfigState(prev => ({
      ...prev,
      token: null,
      roomName: null,
    }));
  }, []);

  const isConnected = config.token !== null && config.roomName !== null;

  const value: LiveKitContextValue = {
    config,
    setConfig,
    connect,
    disconnect,
    isConnected,
  };

  return (
    <LiveKitContext.Provider value={value}>{children}</LiveKitContext.Provider>
  );
}

/**
 * Hook to access LiveKit context
 *
 * @returns LiveKit context value
 * @throws Error if used outside LiveKitProvider
 *
 * @example
 * ```tsx
 * const { connect, disconnect, isConnected } = useLiveKit();
 *
 * // Connect to a room
 * await connect('my-room', token);
 *
 * // Disconnect from room
 * disconnect();
 * ```
 */
export function useLiveKit() {
  const context = useContext(LiveKitContext);
  if (context === undefined) {
    throw new Error('useLiveKit must be used within a LiveKitProvider');
  }
  return context;
}
