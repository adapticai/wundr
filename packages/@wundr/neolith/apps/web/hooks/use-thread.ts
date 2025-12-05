'use client';

import { useState, useCallback, useEffect } from 'react';

import type { Message } from '@/types/chat';

/**
 * Return type for the useThread hook
 */
export interface UseThreadReturn {
  /** Thread replies */
  replies: Message[];
  /** Parent message */
  parentMessage: Message | null;
  /** Whether replies are loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Whether there are more replies to load */
  hasMore: boolean;
  /** Total reply count */
  totalCount: number;
  /** Fetch thread replies */
  fetchReplies: () => Promise<void>;
  /** Add a reply to the thread */
  addReply: (
    content: string,
    metadata?: Record<string, unknown>
  ) => Promise<Message | null>;
  /** Load more replies (pagination) */
  loadMore: () => Promise<void>;
  /** Refetch thread */
  refetch: () => Promise<void>;
}

/**
 * Hook for managing a message thread (replies to a parent message)
 *
 * @param workspaceId - Workspace ID
 * @param channelId - Channel ID
 * @param messageId - Parent message ID
 * @returns Thread data and actions
 */
export function useThread(
  workspaceId: string,
  channelId: string,
  messageId: string
): UseThreadReturn {
  const [replies, setReplies] = useState<Message[]>([]);
  const [parentMessage, setParentMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchReplies = useCallback(
    async (cursor?: string) => {
      if (!workspaceId || !channelId || !messageId) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const url = new URL(
          `/api/workspaces/${workspaceId}/channels/${channelId}/messages/${messageId}/thread`,
          window.location.origin
        );
        if (cursor) {
          url.searchParams.set('after', cursor);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('Failed to fetch thread replies');
        }

        const result = await response.json();

        // Transform dates
        const transformedReplies = (result.data || []).map(
          (reply: Message) => ({
            ...reply,
            createdAt: new Date(reply.createdAt),
            updatedAt: new Date(reply.updatedAt),
            editedAt: reply.editedAt ? new Date(reply.editedAt) : null,
          })
        );

        if (cursor) {
          // Append to existing replies
          setReplies(prev => [...prev, ...transformedReplies]);
        } else {
          // Replace replies
          setReplies(transformedReplies);
        }

        setParentMessage(result.parentMessage);
        setHasMore(result.pagination?.hasMore || false);
        setTotalCount(
          result.pagination?.totalCount || transformedReplies.length
        );
        setNextCursor(result.pagination?.nextCursor || null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId, channelId, messageId]
  );

  const addReply = useCallback(
    async (
      content: string,
      metadata?: Record<string, unknown>
    ): Promise<Message | null> => {
      if (!workspaceId || !channelId || !messageId) {
        return null;
      }

      setError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/channels/${channelId}/messages/${messageId}/thread`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content,
              metadata: metadata || {},
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to add reply');
        }

        const result = await response.json();
        const newReply: Message = {
          ...result.data,
          createdAt: new Date(result.data.createdAt),
          updatedAt: new Date(result.data.updatedAt),
          editedAt: result.data.editedAt
            ? new Date(result.data.editedAt)
            : null,
        };

        // Optimistically add reply to list
        setReplies(prev => [...prev, newReply]);
        setTotalCount(prev => prev + 1);

        return newReply;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      }
    },
    [workspaceId, channelId, messageId]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoading) {
      return;
    }
    await fetchReplies(nextCursor);
  }, [hasMore, nextCursor, isLoading, fetchReplies]);

  const refetch = useCallback(async () => {
    setReplies([]);
    setNextCursor(null);
    await fetchReplies();
  }, [fetchReplies]);

  // Fetch on mount
  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  return {
    replies,
    parentMessage,
    isLoading,
    error,
    hasMore,
    totalCount,
    fetchReplies,
    addReply,
    loadMore,
    refetch,
  };
}
