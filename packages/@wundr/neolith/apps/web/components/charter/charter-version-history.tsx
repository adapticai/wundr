'use client';

import * as React from 'react';
import {
  ArrowUpDown,
  Check,
  Clock,
  Eye,
  GitCompare,
  RotateCcw,
  User,
  Calendar as CalendarIcon,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Charter Version interface
 */
export interface CharterVersion {
  id: string;
  version: number;
  createdAt: Date;
  createdBy: string;
  changeLog: string | null;
  isActive: boolean;
  charterData: Record<string, unknown>;
}

/**
 * Props for CharterVersionHistory component
 */
export interface CharterVersionHistoryProps {
  /** ID of the orchestrator */
  orchestratorId: string;
  /** ID of the charter */
  charterId: string;
  /** Callback when a version is selected */
  onVersionSelect?: (version: CharterVersion) => void;
  /** Callback when comparing two versions */
  onCompare?: (v1: number, v2: number) => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * Sort configuration
 */
type SortField = 'version' | 'createdAt' | 'createdBy';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

/**
 * CharterVersionHistory Component
 *
 * Displays a comprehensive table of all charter versions with features:
 * - Sortable columns (version, date, creator)
 * - Pagination with configurable page size
 * - Date range filtering
 * - Active version indicator
 * - Actions: View, Compare, Activate, Rollback
 * - Checkbox selection for comparing versions
 */
export function CharterVersionHistory({
  orchestratorId,
  charterId,
  onVersionSelect,
  onCompare,
  className,
}: CharterVersionHistoryProps) {
  // State management
  const [versions, setVersions] = React.useState<CharterVersion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize] = React.useState(10);

  // Sorting state
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    field: 'version',
    order: 'desc',
  });

  // Date filtering state
  const [dateRange, setDateRange] = React.useState<{
    from: string;
    to: string;
  }>({
    from: '',
    to: '',
  });

  // Selection state for comparison
  const [selectedVersions, setSelectedVersions] = React.useState<number[]>([]);

  // Dialog states
  const [activateDialog, setActivateDialog] =
    React.useState<CharterVersion | null>(null);
  const [rollbackDialog, setRollbackDialog] =
    React.useState<CharterVersion | null>(null);

  /**
   * Fetch charter versions from API
   */
  const fetchVersions = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        charterId,
        sortOrder: sortConfig.order,
      });

      if (dateRange.from) {
        params.append('createdAfter', new Date(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        params.append('createdBefore', new Date(dateRange.to).toISOString());
      }

      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/charters/${charterId}/versions?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch charter versions');
      }

      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [orchestratorId, charterId, sortConfig.order, dateRange]);

  // Fetch versions on mount and when dependencies change
  React.useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  /**
   * Handle sort column click
   */
  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  /**
   * Sort versions locally by selected field
   */
  const sortedVersions = React.useMemo(() => {
    const sorted = [...versions];

    sorted.sort((a, b) => {
      let aVal: string | number | Date;
      let bVal: string | number | Date;

      switch (sortConfig.field) {
        case 'version':
          aVal = a.version;
          bVal = b.version;
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'createdBy':
          aVal = a.createdBy.toLowerCase();
          bVal = b.createdBy.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortConfig.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.order === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [versions, sortConfig]);

  /**
   * Paginate versions
   */
  const paginatedVersions = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedVersions.slice(startIndex, endIndex);
  }, [sortedVersions, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedVersions.length / pageSize);

  /**
   * Handle version selection for comparison
   */
  const handleVersionToggle = (versionNumber: number) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionNumber)) {
        return prev.filter(v => v !== versionNumber);
      }
      // Only allow 2 selections
      if (prev.length >= 2) {
        return [prev[1], versionNumber];
      }
      return [...prev, versionNumber];
    });
  };

  /**
   * Handle compare action
   */
  const handleCompare = () => {
    if (selectedVersions.length === 2 && onCompare) {
      const [v1, v2] = selectedVersions.sort((a, b) => a - b);
      onCompare(v1, v2);
    }
  };

  /**
   * Handle activate version
   */
  const handleActivate = async (version: CharterVersion) => {
    try {
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/charters/${charterId}/versions/${version.version}/activate`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to activate version');
      }

      await fetchVersions();
      setActivateDialog(null);
    } catch (err) {
      console.error('Error activating version:', err);
    }
  };

  /**
   * Handle rollback to version
   */
  const handleRollback = async (version: CharterVersion) => {
    try {
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/charters/${charterId}/rollback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetVersion: version.version,
            changeLog: `Rolled back to version ${version.version}`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to rollback version');
      }

      await fetchVersions();
      setRollbackDialog(null);
    } catch (err) {
      console.error('Error rolling back version:', err);
    }
  };

  /**
   * Render sort indicator
   */
  const renderSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className='ml-2 h-4 w-4 opacity-50' />;
    }
    return (
      <ArrowUpDown
        className={cn(
          'ml-2 h-4 w-4',
          sortConfig.order === 'asc' ? 'rotate-180' : ''
        )}
      />
    );
  };

  /**
   * Clear date filters
   */
  const clearDateFilters = () => {
    setDateRange({ from: '', to: '' });
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className='text-muted-foreground'>Loading versions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className='text-destructive'>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end'>
        <div className='flex-1 space-y-2'>
          <label className='text-sm font-medium'>Date Range</label>
          <div className='flex gap-2'>
            <div className='flex-1'>
              <Input
                type='date'
                value={dateRange.from}
                onChange={e =>
                  setDateRange(prev => ({ ...prev, from: e.target.value }))
                }
                placeholder='From'
              />
            </div>
            <div className='flex-1'>
              <Input
                type='date'
                value={dateRange.to}
                onChange={e =>
                  setDateRange(prev => ({ ...prev, to: e.target.value }))
                }
                placeholder='To'
              />
            </div>
            {(dateRange.from || dateRange.to) && (
              <Button
                variant='outline'
                size='icon'
                onClick={clearDateFilters}
                title='Clear filters'
              >
                <X className='h-4 w-4' />
              </Button>
            )}
          </div>
        </div>

        {selectedVersions.length === 2 && (
          <Button onClick={handleCompare} variant='outline'>
            <GitCompare className='mr-2 h-4 w-4' />
            Compare Selected
          </Button>
        )}
      </div>

      {/* Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-12'>
                <span className='sr-only'>Select</span>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('version')}
                  className='flex items-center font-medium hover:text-foreground'
                >
                  Version
                  {renderSortIcon('version')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('createdAt')}
                  className='flex items-center font-medium hover:text-foreground'
                >
                  Created
                  {renderSortIcon('createdAt')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('createdBy')}
                  className='flex items-center font-medium hover:text-foreground'
                >
                  Created By
                  {renderSortIcon('createdBy')}
                </button>
              </TableHead>
              <TableHead>Change Log</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedVersions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-center text-muted-foreground'
                >
                  No versions found
                </TableCell>
              </TableRow>
            ) : (
              paginatedVersions.map(version => (
                <TableRow key={version.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedVersions.includes(version.version)}
                      onCheckedChange={() =>
                        handleVersionToggle(version.version)
                      }
                      aria-label={`Select version ${version.version}`}
                    />
                  </TableCell>
                  <TableCell className='font-medium'>
                    v{version.version}
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2 text-sm'>
                      <Clock className='h-4 w-4 text-muted-foreground' />
                      {new Date(version.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2 text-sm'>
                      <User className='h-4 w-4 text-muted-foreground' />
                      {version.createdBy}
                    </div>
                  </TableCell>
                  <TableCell className='max-w-md truncate'>
                    {version.changeLog || (
                      <span className='text-muted-foreground'>
                        No change log
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {version.isActive && (
                      <Badge variant='default'>
                        <Check className='mr-1 h-3 w-3' />
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className='flex justify-end gap-2'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => onVersionSelect?.(version)}
                        title='View version'
                      >
                        <Eye className='h-4 w-4' />
                        <span className='sr-only'>View</span>
                      </Button>
                      {!version.isActive && (
                        <>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setActivateDialog(version)}
                            title='Activate version'
                          >
                            <Check className='h-4 w-4' />
                            <span className='sr-only'>Activate</span>
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setRollbackDialog(version)}
                            title='Rollback to version'
                          >
                            <RotateCcw className='h-4 w-4' />
                            <span className='sr-only'>Rollback</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href='#'
                onClick={e => {
                  e.preventDefault();
                  setCurrentPage(prev => Math.max(1, prev - 1));
                }}
                aria-disabled={currentPage === 1}
                className={cn(
                  currentPage === 1 && 'pointer-events-none opacity-50'
                )}
              />
            </PaginationItem>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              // Show first page, last page, current page, and pages around current
              const showPage =
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1);

              if (!showPage) {
                // Show ellipsis for gaps
                if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return null;
              }

              return (
                <PaginationItem key={page}>
                  <PaginationLink
                    href='#'
                    onClick={e => {
                      e.preventDefault();
                      setCurrentPage(page);
                    }}
                    isActive={currentPage === page}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            <PaginationItem>
              <PaginationNext
                href='#'
                onClick={e => {
                  e.preventDefault();
                  setCurrentPage(prev => Math.min(totalPages, prev + 1));
                }}
                aria-disabled={currentPage === totalPages}
                className={cn(
                  currentPage === totalPages && 'pointer-events-none opacity-50'
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Activate Confirmation Dialog */}
      <Dialog
        open={!!activateDialog}
        onOpenChange={() => setActivateDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to activate version{' '}
              {activateDialog?.version}? This will make it the current active
              version.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setActivateDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => activateDialog && handleActivate(activateDialog)}
            >
              Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={!!rollbackDialog}
        onOpenChange={() => setRollbackDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback to Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to rollback to version{' '}
              {rollbackDialog?.version}? This will create a new version based on
              this historical version.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRollbackDialog(null)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => rollbackDialog && handleRollback(rollbackDialog)}
            >
              Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
