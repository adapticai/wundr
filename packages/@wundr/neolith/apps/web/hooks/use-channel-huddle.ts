/**
 * Channel Huddle Hook
 *
 * React hook for managing huddle state in a channel.
 * Provides functions to start, join, leave, and monitor huddle status.
 *
 * @module hooks/use-channel-huddle
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import type { HuddleResponse, JoinResponse } from '@/lib/validations/call';

interface UseChannelHuddleOptions {
  /** Channel ID */
  channelId: string;
  /** Polling interval for huddle status (ms) */
  pollInterval?: number;
  /** Whether to automatically poll for status */
  autoPoll?: boolean;
}

interface UseChannelHuddleReturn {
  /** Current huddle status */
  huddle: HuddleResponse | null;
  /** Whether the user is currently in the huddle */
  isInHuddle: boolean;
  /** Whether a request is in progress */
  isLoading: boolean;
  /** Any error that occurred */
  error: Error | null;
  /** Join data (token, room info) when user joins */
  joinData: JoinResponse | null;
  /** Start a new huddle */
  startHuddle: (audioOnly?: boolean) => Promise<void>;
  /** Join an existing huddle */
  joinHuddle: (audioOnly?: boolean) => Promise<void>;
  /** Leave the current huddle */
  leaveHuddle: () => Promise<void>;
  /** Manually refresh huddle status */
  refreshStatus: () => Promise<void>;
}

/**
 * Hook for managing channel huddles
 */
export function useChannelHuddle({
  channelId,
  pollInterval = 30000, // 30 seconds
  autoPoll = true,
}: UseChannelHuddleOptions): UseChannelHuddleReturn {
  const [huddle, setHuddle] = useState<HuddleResponse | null>(null);
  const [isInHuddle, setIsInHuddle] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [joinData, setJoinData] = useState<JoinResponse | null>(null);

  /**
   * Fetch current huddle status
   */
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/channels/${channelId}/huddle/status`);

      if (!response.ok) {
        throw new Error('Failed to fetch huddle status');
      }

      const result = await response.json();
      setHuddle(result.data);
    } catch (err) {
      console.error('Error fetching huddle status:', err);
      // Don't set error state for polling failures
    }
  }, [channelId]);

  /**
   * Start a new huddle
   */
  const startHuddle = useCallback(
    async (audioOnly = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/channels/${channelId}/huddle/start`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to start huddle');
        }

        const result = await response.json();
        setHuddle(result.data);

        // Automatically join the huddle after starting it
        await joinHuddle(audioOnly);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to start huddle');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [channelId],
  );

  /**
   * Join an existing huddle
   */
  const joinHuddle = useCallback(
    async (audioOnly = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/channels/${channelId}/huddle/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audioOnly }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to join huddle');
        }

        const result = await response.json();
        setJoinData(result.data);
        setIsInHuddle(true);
        await refreshStatus();
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to join huddle');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [channelId, refreshStatus],
  );

  /**
   * Leave the current huddle
   */
  const leaveHuddle = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/channels/${channelId}/huddle/leave`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to leave huddle');
      }

      setIsInHuddle(false);
      setJoinData(null);
      await refreshStatus();
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to leave huddle');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [channelId, refreshStatus]);

  // Auto-poll huddle status
  useEffect(() => {
    if (!autoPoll) {
      return;
    }

    // Initial fetch
    refreshStatus();

    // Set up polling
    const intervalId = setInterval(refreshStatus, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [autoPoll, pollInterval, refreshStatus]);

  return {
    huddle,
    isInHuddle,
    isLoading,
    error,
    joinData,
    startHuddle,
    joinHuddle,
    leaveHuddle,
    refreshStatus,
  };
}
