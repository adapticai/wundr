'use client';

/**
 * useHuddles - React hook for real-time huddle management
 *
 * Provides state management and API methods for huddles:
 * - List active huddles
 * - Create new huddles
 * - Join/leave huddles
 * - Toggle mute
 * - Real-time updates via SSE
 *
 * @module hooks/use-huddles
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import type { Huddle, HuddleParticipant } from '@/types/call';

/**
 * Huddle event from SSE
 */
interface HuddleEvent {
  type: string;
  huddle?: Huddle;
  huddleId?: string;
  huddles?: Huddle[];
  participant?: HuddleParticipant;
  timestamp: string;
}

/**
 * Hook return type
 */
interface UseHuddlesReturn {
  /** All active huddles in the workspace */
  huddles: Huddle[];
  /** The huddle the current user is in (if any) */
  activeHuddle: Huddle | null;
  /** Whether we're connected to the SSE stream */
  isConnected: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Create a new huddle */
  createHuddle: (name: string, channelId?: string) => Promise<Huddle | null>;
  /** Join an existing huddle */
  joinHuddle: (huddleId: string) => Promise<boolean>;
  /** Leave the current huddle */
  leaveHuddle: () => Promise<boolean>;
  /** End the current huddle */
  endHuddle: () => Promise<boolean>;
  /** Toggle mute status */
  toggleMute: () => Promise<boolean>;
  /** Update speaking status */
  updateSpeaking: (isSpeaking: boolean) => Promise<boolean>;
}

/**
 * useHuddles hook for real-time huddle management
 */
export function useHuddles(
  workspaceSlug: string,
  userId?: string
): UseHuddlesReturn {
  const [huddles, setHuddles] = useState<Huddle[]>([]);
  const [activeHuddle, setActiveHuddle] = useState<Huddle | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update active huddle when huddles change
  useEffect(() => {
    if (!userId) {
      setActiveHuddle(null);
      return;
    }

    const userHuddle = huddles.find(h =>
      h.participants.some(p => p.user.id === userId)
    );
    setActiveHuddle(userHuddle || null);
  }, [huddles, userId]);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (!workspaceSlug) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/workspaces/${workspaceSlug}/huddles/subscribe`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      setIsLoading(false);
    };

    eventSource.onmessage = event => {
      try {
        const data: HuddleEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'init':
            // Initial state with all huddles
            if (data.huddles) {
              setHuddles(data.huddles);
            }
            break;

          case 'huddle:created':
            if (data.huddle) {
              setHuddles(prev => [...prev, data.huddle!]);
            }
            break;

          case 'huddle:ended':
            if (data.huddleId) {
              setHuddles(prev => prev.filter(h => h.id !== data.huddleId));
            }
            break;

          case 'huddle:participant:joined':
          case 'huddle:participant:left':
          case 'huddle:participant:muted':
          case 'huddle:participant:unmuted':
          case 'huddle:participant:speaking':
            // Update huddle with new participant state
            if (data.huddle) {
              setHuddles(prev =>
                prev.map(h => (h.id === data.huddle!.id ? data.huddle! : h))
              );
            }
            break;

          case 'ping':
            // Keep-alive ping, no action needed
            break;
        }
      } catch (err) {
        console.error('[useHuddles] Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();

      // Attempt to reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };
  }, [workspaceSlug]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // API methods
  const createHuddle = useCallback(
    async (name: string, channelId?: string): Promise<Huddle | null> => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/huddles`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', name, channelId }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          setError(data.message || 'Failed to create huddle');
          return null;
        }

        const { data } = await response.json();
        return data as Huddle;
      } catch (err) {
        setError('Failed to create huddle');
        return null;
      }
    },
    [workspaceSlug]
  );

  const joinHuddle = useCallback(
    async (huddleId: string): Promise<boolean> => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/huddles`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'join', huddleId }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          setError(data.message || 'Failed to join huddle');
          return false;
        }

        return true;
      } catch (err) {
        setError('Failed to join huddle');
        return false;
      }
    },
    [workspaceSlug]
  );

  const leaveHuddle = useCallback(async (): Promise<boolean> => {
    if (!activeHuddle) return false;

    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/huddles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave', huddleId: activeHuddle.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to leave huddle');
        return false;
      }

      return true;
    } catch (err) {
      setError('Failed to leave huddle');
      return false;
    }
  }, [workspaceSlug, activeHuddle]);

  const endHuddle = useCallback(async (): Promise<boolean> => {
    if (!activeHuddle) return false;

    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/huddles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', huddleId: activeHuddle.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to end huddle');
        return false;
      }

      return true;
    } catch (err) {
      setError('Failed to end huddle');
      return false;
    }
  }, [workspaceSlug, activeHuddle]);

  const toggleMute = useCallback(async (): Promise<boolean> => {
    if (!activeHuddle) return false;

    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/huddles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mute', huddleId: activeHuddle.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to toggle mute');
        return false;
      }

      return true;
    } catch (err) {
      setError('Failed to toggle mute');
      return false;
    }
  }, [workspaceSlug, activeHuddle]);

  const updateSpeaking = useCallback(
    async (isSpeaking: boolean): Promise<boolean> => {
      if (!activeHuddle) return false;

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/huddles`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'speaking',
              huddleId: activeHuddle.id,
              isSpeaking,
            }),
          }
        );

        if (!response.ok) {
          return false;
        }

        return true;
      } catch {
        return false;
      }
    },
    [workspaceSlug, activeHuddle]
  );

  return {
    huddles,
    activeHuddle,
    isConnected,
    isLoading,
    error,
    createHuddle,
    joinHuddle,
    leaveHuddle,
    endHuddle,
    toggleMute,
    updateSpeaking,
  };
}

export default useHuddles;
