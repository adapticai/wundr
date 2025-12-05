'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Connected account interface
 */
export interface ConnectedAccount {
  provider: string;
  email?: string;
  username?: string;
  connected: boolean;
}

/**
 * Return type for the useConnectedAccounts hook
 */
export interface UseConnectedAccountsReturn {
  /** List of connected social accounts */
  accounts: ConnectedAccount[];
  /** Whether accounts are currently being fetched */
  isLoading: boolean;
  /** Error that occurred during fetch, or null if none */
  error: Error | null;
  /** Refresh connected accounts from the server */
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching and managing connected social accounts.
 *
 * @returns Connected account data and management methods
 *
 * @example
 * ```typescript
 * const { accounts, isLoading, error, refresh } = useConnectedAccounts();
 *
 * // Refresh accounts after disconnecting
 * await refresh();
 * ```
 */
export function useConnectedAccounts(): UseConnectedAccountsReturn {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/user/connected-accounts');

      if (!response.ok) {
        throw new Error('Failed to fetch connected accounts');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Set empty array on error to prevent UI breakage
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const refresh = useCallback(async () => {
    await fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    isLoading,
    error,
    refresh,
  };
}
