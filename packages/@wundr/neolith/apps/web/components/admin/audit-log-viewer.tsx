'use client';

import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

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

/**
 * Props for the AuditLogViewer component.
 */
export interface AuditLogViewerProps {
  /** The workspace ID to fetch audit logs for */
  workspaceId: string;
  /** Additional CSS classes to apply */
  className?: string;
}

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

  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });

      if (filters.severity) {
        params.set('severity', filters.severity);
      }
      if (filters.category) {
        params.set('category', filters.category);
      }
      if (filters.search) {
        params.set('search', filters.search);
      }

      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/audit-logs?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
      }

      const data = await response.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, page, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/audit-logs/export`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: 'csv', filters }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      const data = await response.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export audit logs');
      console.error('Failed to export audit logs:', err);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Input
          type="text"
          placeholder="Search logs..."
          value={filters.search || ''}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="flex-1 min-w-[200px]"
        />

        <Select
          value={filters.severity || 'all'}
          onValueChange={(value) => setFilters((f) => ({ ...f, severity: value === 'all' ? undefined : value }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => setFilters((f) => ({ ...f, category: value === 'all' ? undefined : value }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleExport}>
          Export
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-start gap-3">
            <p className="text-sm text-destructive flex-1">{error}</p>
            <button
              onClick={() => fetchLogs()}
              className="text-sm text-destructive hover:underline"
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-destructive">
                  Error loading audit logs
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No audit logs found
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono">
                    {entry.action}
                  </TableCell>
                  <TableCell>
                    <div>{entry.actorName}</div>
                    <div className="text-xs text-muted-foreground">{entry.actorType}</div>
                  </TableCell>
                  <TableCell>
                    <div>{entry.resourceName || entry.resourceType}</div>
                    <div className="text-xs text-muted-foreground">{entry.resourceType}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {CATEGORY_LABELS[entry.category] || entry.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      entry.severity === 'info' ? 'secondary' :
                      entry.severity === 'warning' ? 'default' :
                      'destructive'
                    }>
                      {entry.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.success ? (
                      <span className="text-green-500">Success</span>
                    ) : (
                      <span className="text-destructive">Failed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogViewer;
