/**
 * Security Audit Hook
 *
 * Hook for fetching and managing security audit logs.
 *
 * @module hooks/use-security-audit
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

import type { AuditLogEntry } from '@/app/api/user/security-audit/route';

export interface UseSecurityAuditReturn {
  entries: AuditLogEntry[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  filter: (eventType?: string, severity?: string) => Promise<void>;
}

export function useSecurityAudit(initialLimit = 20): UseSecurityAuditReturn {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<{
    eventType?: string;
    severity?: string;
  }>({});
  const limit = initialLimit;

  const fetchAudit = useCallback(
    async (currentOffset: number, currentFilters: typeof filters) => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: currentOffset.toString(),
        });

        if (currentFilters.eventType) {
          params.append('eventType', currentFilters.eventType);
        }
        if (currentFilters.severity) {
          params.append('severity', currentFilters.severity);
        }

        const response = await fetch(`/api/user/security-audit?${params}`);

        if (!response.ok) {
          throw new Error('Failed to fetch security audit logs');
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
    [limit],
  );

  // Initial fetch
  useEffect(() => {
    fetchAudit(0, filters);
  }, [fetchAudit, filters]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await fetchAudit(0, filters);
  }, [fetchAudit, filters]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    const newOffset = offset + limit;
    setOffset(newOffset);
    await fetchAudit(newOffset, filters);
  }, [offset, limit, hasMore, isLoading, fetchAudit, filters]);

  const filter = useCallback(
    async (eventType?: string, severity?: string) => {
      setOffset(0);
      setFilters({ eventType, severity });
      await fetchAudit(0, { eventType, severity });
    },
    [fetchAudit],
  );

  return {
    entries,
    isLoading,
    error,
    refresh,
    loadMore,
    hasMore,
    filter,
  };
}
