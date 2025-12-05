'use client';

/**
 * Hook for fetching and filtering admin audit logs
 * @module hooks/admin/use-admin-audit
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';

import type { AuditLog, AuditLogFilters, PaginatedAuditLogs } from '@/types/admin';

// =============================================================================
// Types
// =============================================================================

/**
 * Return type for useAdminAudit hook
 */
export interface UseAdminAuditReturn {
  /** List of audit logs */
  logs: AuditLog[];
  /** Pagination info */
  pagination: PaginatedAuditLogs['pagination'] | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Update filters */
  setFilters: (filters: AuditLogFilters) => void;
  /** Current filters */
  filters: AuditLogFilters;
  /** Manually refresh logs */
  refresh: () => Promise<void>;
  /** Export logs as CSV */
  exportLogs: (format?: 'csv' | 'json') => Promise<void>;
  /** Whether export is in progress */
  isExporting: boolean;
}

// =============================================================================
// Fetcher
// =============================================================================

/**
 * Fetcher function with error handling
 */
const auditFetcher = async (url: string): Promise<PaginatedAuditLogs> => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || 'Failed to fetch audit logs');
  }

  const result = await res.json();
  const data = result.data || result;

  // Transform date strings to Date objects
  if (data.logs) {
    data.logs = data.logs.map((log: AuditLog) => ({
      ...log,
      createdAt: new Date(log.createdAt),
    }));
  }

  return data as PaginatedAuditLogs;
};

// =============================================================================
// Hook: useAdminAudit
// =============================================================================

/**
 * Hook for fetching and filtering admin audit logs
 *
 * Provides comprehensive audit log access with filtering, pagination,
 * and export capabilities for compliance and monitoring.
 *
 * @param workspaceId - The workspace ID
 * @param initialFilters - Initial filter values
 * @returns Audit logs data and management functions
 *
 * @example
 * ```tsx
 * function AuditLogPage() {
 *   const {
 *     logs,
 *     pagination,
 *     isLoading,
 *     filters,
 *     setFilters,
 *     exportLogs,
 *   } = useAdminAudit('workspace-123', {
 *     action: 'user.login',
 *     startDate: new Date('2024-01-01'),
 *   });
 *
 *   return (
 *     <div>
 *       <AuditFilters filters={filters} onChange={setFilters} />
 *       <Button onClick={() => exportLogs('csv')}>Export CSV</Button>
 *       <AuditTable logs={logs} />
 *       <Pagination {...pagination} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useAdminAudit(
  workspaceId: string,
  initialFilters: AuditLogFilters = {},
): UseAdminAuditReturn {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 50,
    ...initialFilters,
  });
  const [isExporting, setIsExporting] = useState(false);

  // Build query params from filters
  const queryParams = new URLSearchParams();
  if (filters.action) queryParams.set('action', filters.action);
  if (filters.actorId) queryParams.set('actorId', filters.actorId);
  if (filters.targetType) queryParams.set('targetType', filters.targetType);
  if (filters.targetId) queryParams.set('targetId', filters.targetId);
  if (filters.startDate) {
    queryParams.set('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    queryParams.set('endDate', filters.endDate.toISOString());
  }
  queryParams.set('page', String(filters.page ?? 1));
  queryParams.set('limit', String(filters.limit ?? 50));

  const url = `/api/workspaces/${workspaceId}/admin/audit?${queryParams}`;

  const { data, error, isLoading, mutate } = useSWR<PaginatedAuditLogs>(url, auditFetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  // Manual refresh
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Export logs
  const exportLogs = useCallback(
    async (format: 'csv' | 'json' = 'csv') => {
      try {
        setIsExporting(true);

        // Build export URL with current filters
        const exportParams = new URLSearchParams(queryParams);
        exportParams.set('format', format);
        exportParams.delete('page'); // Export all matching logs
        exportParams.delete('limit');

        const res = await fetch(
          `/api/workspaces/${workspaceId}/admin/audit/export?${exportParams}`
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to export logs');
        }

        // Download the file
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to export logs');
      } finally {
        setIsExporting(false);
      }
    },
    [workspaceId, queryParams]
  );

  return {
    logs: data?.logs ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    error: error as Error | null,
    setFilters,
    filters,
    refresh,
    exportLogs,
    isExporting,
  };
}
