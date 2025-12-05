/**
 * Login History Hook
 *
 * Hook for fetching and managing user login history.
 *
 * @module hooks/use-login-history
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

import type { LoginHistoryEntry } from '@/app/api/user/login-history/route';

export interface UseLoginHistoryReturn {
  entries: LoginHistoryEntry[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useLoginHistory(initialLimit = 20): UseLoginHistoryReturn {
  const [entries, setEntries] = useState<LoginHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = initialLimit;

  const fetchHistory = useCallback(
    async (currentOffset: number) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/user/login-history?limit=${limit}&offset=${currentOffset}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch login history');
        }

        const data = await response.json();
        const newEntries = data.data?.entries || [];

        if (currentOffset === 0) {
          setEntries(newEntries);
        } else {
          setEntries(prev => [...prev, ...newEntries]);
        }

        setHasMore(newEntries.length === limit);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        if (currentOffset === 0) {
          setEntries([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [limit]
  );

  // Initial fetch
  useEffect(() => {
    fetchHistory(0);
  }, [fetchHistory]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await fetchHistory(0);
  }, [fetchHistory]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) {
      return;
    }
    const newOffset = offset + limit;
    setOffset(newOffset);
    await fetchHistory(newOffset);
  }, [offset, limit, hasMore, isLoading, fetchHistory]);

  return {
    entries,
    isLoading,
    error,
    refresh,
    loadMore,
    hasMore,
  };
}
