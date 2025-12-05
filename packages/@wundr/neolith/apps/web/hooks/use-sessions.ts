'use client';

import { useState, useEffect, useCallback } from 'react';

import type { Session } from '@/components/settings/security/SessionsList';

/**
 * Return type for the useSessions hook
 */
export interface UseSessionsReturn {
  /** List of active sessions */
  sessions: Session[];
  /** Whether sessions are currently being fetched */
  isLoading: boolean;
  /** Error that occurred during fetch, or null if none */
  error: Error | null;
  /** Refresh sessions from the server */
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching and managing user sessions.
 *
 * @returns Session data and management methods
 *
 * @example
 * ```typescript
 * const { sessions, isLoading, error, refresh } = useSessions();
 *
 * // Refresh sessions after revoking
 * await refresh();
 * ```
 */
export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/user/sessions');

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Set empty array on error to prevent UI breakage
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const refresh = useCallback(async () => {
    await fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    isLoading,
    error,
    refresh,
  };
}
