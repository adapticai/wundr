'use client';

import { useState, useCallback, useEffect } from 'react';

import type { Reaction } from '@/types/chat';

/**
 * Return type for the useReactions hook
 */
export interface UseReactionsReturn {
  /** Message reactions grouped by emoji */
  reactions: Reaction[];
  /** Whether reactions are loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Add or toggle a reaction */
  toggleReaction: (emoji: string) => Promise<void>;
  /** Refetch reactions */
  refetch: () => Promise<void>;
}

/**
 * Hook for managing reactions on a message
 *
 * @param workspaceId - Workspace ID
 * @param channelId - Channel ID
 * @param messageId - Message ID
 * @returns Reactions data and actions
 */
export function useReactions(
  workspaceId: string,
  channelId: string,
  messageId: string,
): UseReactionsReturn {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchReactions = useCallback(async () => {
    if (!workspaceId || !channelId || !messageId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = new URL(
        `/api/workspaces/${workspaceId}/channels/${channelId}/messages/${messageId}/reactions`,
        window.location.origin,
      );
      url.searchParams.set('grouped', 'true');
      url.searchParams.set('includeUsers', 'true');

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch reactions');
      }

      const result = await response.json();
      setReactions(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, channelId, messageId]);

  const toggleReaction = useCallback(
    async (emoji: string) => {
      if (!workspaceId || !channelId || !messageId) {
        return;
      }

      setError(null);

      // Find existing reaction
      const existingReaction = reactions.find((r) => r.emoji === emoji && r.hasReacted);

      try {
        if (existingReaction) {
          // Remove reaction
          const response = await fetch(
            `/api/workspaces/${workspaceId}/channels/${channelId}/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`,
            {
              method: 'DELETE',
            },
          );

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to remove reaction');
          }

          // Optimistically update
          setReactions((prev) =>
            prev
              .map((r) => {
                if (r.emoji === emoji) {
                  return {
                    ...r,
                    count: r.count - 1,
                    hasReacted: false,
                  };
                }
                return r;
              })
              .filter((r) => r.count > 0), // Remove if count is 0
          );
        } else {
          // Add reaction
          const response = await fetch(
            `/api/workspaces/${workspaceId}/channels/${channelId}/messages/${messageId}/reactions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ emoji }),
            },
          );

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add reaction');
          }

          // Optimistically update
          setReactions((prev) => {
            const existing = prev.find((r) => r.emoji === emoji);
            if (existing) {
              return prev.map((r) => {
                if (r.emoji === emoji) {
                  return {
                    ...r,
                    count: r.count + 1,
                    hasReacted: true,
                  };
                }
                return r;
              });
            } else {
              return [
                ...prev,
                {
                  emoji,
                  count: 1,
                  userIds: [],
                  hasReacted: true,
                } as Reaction,
              ];
            }
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        // Revert optimistic update on error
        await fetchReactions();
      }
    },
    [workspaceId, channelId, messageId, reactions, fetchReactions],
  );

  // Fetch on mount
  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  return {
    reactions,
    isLoading,
    error,
    toggleReaction,
    refetch: fetchReactions,
  };
}
