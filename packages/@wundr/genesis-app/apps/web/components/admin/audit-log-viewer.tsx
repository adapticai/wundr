'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  actorName: string;
  actorType: string;
  resourceType: string;
  resourceName?: string;
  success: boolean;
  ipAddress?: string;
}

export interface AuditLogViewerProps {
  workspaceId: string;
  className?: string;
}

const SEVERITY_COLORS = {
  info: 'bg-blue-500/10 text-blue-500',
  warning: 'bg-yellow-500/10 text-yellow-500',
  critical: 'bg-red-500/10 text-red-500',
};

const CATEGORY_LABELS: Record<string, string> = {
  authentication: 'Auth',
  authorization: 'Permissions',
  data_access: 'Data Access',
  data_modification: 'Data Change',
  system_configuration: 'Config',
  security: 'Security',
  compliance: 'Compliance',
};

export function AuditLogViewer({ workspaceId, className }: AuditLogViewerProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<{
    severity?: string;
    category?: string;
    search?: string;
  }>({});

  const pageSize = 50;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });

      if (filters.severity) params.set('severity', filters.severity);
      if (filters.category) params.set('category', filters.category);
      if (filters.search) params.set('search', filters.search);

      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/audit-logs?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        setTotal(data.total || 0);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, page, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    const response = await fetch(
      `/api/workspaces/${workspaceId}/admin/audit-logs/export`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'csv', filters }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      // Handle export URL
      window.open(data.downloadUrl, '_blank');
    }
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search logs..."
          value={filters.search || ''}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className={clsx(
            'flex-1 min-w-[200px] px-3 py-2 rounded-lg',
            'bg-muted border border-border',
            'text-foreground placeholder:text-muted-foreground'
          )}
        />

        <select
          value={filters.severity || ''}
          onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value || undefined }))}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
        >
          <option value="">All Severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>

        <select
          value={filters.category || ''}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <button
          onClick={handleExport}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
        >
          Export
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Time</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actor</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Resource</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Severity</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No audit logs found
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground font-mono">
                    {entry.action}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <div>{entry.actorName}</div>
                    <div className="text-xs text-muted-foreground">{entry.actorType}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <div>{entry.resourceName || entry.resourceType}</div>
                    <div className="text-xs text-muted-foreground">{entry.resourceType}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 bg-muted rounded text-xs">
                      {CATEGORY_LABELS[entry.category] || entry.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-1 rounded text-xs', SEVERITY_COLORS[entry.severity])}>
                      {entry.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {entry.success ? (
                      <span className="text-green-500">Success</span>
                    ) : (
                      <span className="text-red-500">Failed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 bg-muted rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
              className="px-3 py-1.5 bg-muted rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogViewer;
