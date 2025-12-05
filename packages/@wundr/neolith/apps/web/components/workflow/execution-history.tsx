'use client';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MoreHorizontal,
  Download,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  EXECUTION_STATUS_CONFIG,
  ACTION_TYPE_CONFIG,
  type WorkflowExecution,
  type ExecutionStatus,
  type ActionResult,
} from '@/types/workflow';

import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';

// =============================================================================
// Types
// =============================================================================

export interface ExecutionHistoryProps {
  executions: WorkflowExecution[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onExport?: (executions: WorkflowExecution[]) => void;
  className?: string;
}

interface ExecutionDetailsProps {
  execution: WorkflowExecution;
  onClose: () => void;
}

// =============================================================================
// Main Component
// =============================================================================

export function ExecutionHistory({
  executions,
  isLoading = false,
  onRefresh,
  onExport,
  className,
}: ExecutionHistoryProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'startedAt', desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedExecution, setSelectedExecution] =
    useState<WorkflowExecution | null>(null);

  // Status filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Filter executions based on status and date
  const filteredExecutions = useMemo(() => {
    return executions.filter(execution => {
      // Status filter
      if (statusFilter !== 'all' && execution.status !== statusFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const executionDate = new Date(execution.startedAt);
        const now = new Date();
        const startOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        switch (dateFilter) {
          case 'today':
            if (executionDate < startOfDay) {
              return false;
            }
            break;
          case 'week': {
            const weekAgo = new Date(startOfDay);
            weekAgo.setDate(weekAgo.getDate() - 7);
            if (executionDate < weekAgo) {
              return false;
            }
            break;
          }
          case 'month': {
            const monthAgo = new Date(startOfDay);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            if (executionDate < monthAgo) {
              return false;
            }
            break;
          }
        }
      }

      return true;
    });
  }, [executions, statusFilter, dateFilter]);

  // Column definitions
  const columns = useMemo<ColumnDef<WorkflowExecution>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Execution ID',
        cell: ({ row }) => (
          <div className='font-mono text-xs'>{row.original.id.slice(0, 8)}</div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.status;
          const config = EXECUTION_STATUS_CONFIG[status];
          const StatusIcon =
            status === 'completed'
              ? CheckCircle2
              : status === 'failed'
                ? XCircle
                : status === 'running'
                  ? RefreshCw
                  : Clock;

          return (
            <div className='flex items-center gap-2'>
              <StatusIcon
                className={cn(
                  'h-4 w-4',
                  status === 'running' && 'animate-spin',
                  config.color
                )}
              />
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  config.bgColor,
                  config.color
                )}
              >
                {config.label}
              </span>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: 'startedAt',
        header: 'Started At',
        cell: ({ row }) => {
          const date = new Date(row.original.startedAt);
          return (
            <div className='flex flex-col'>
              <span className='text-sm font-medium'>
                {format(date, 'MMM d, yyyy')}
              </span>
              <span className='text-xs text-muted-foreground'>
                {format(date, 'h:mm:ss a')}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'duration',
        header: 'Duration',
        cell: ({ row }) => {
          const duration = row.original.duration;
          if (!duration) {
            return <span className='text-muted-foreground'>-</span>;
          }
          return <span className='text-sm'>{formatDuration(duration)}</span>;
        },
      },
      {
        accessorKey: 'actionResults',
        header: 'Actions',
        cell: ({ row }) => {
          const results = row.original.actionResults;
          const completed = results.filter(
            r => r.status === 'completed'
          ).length;
          const failed = results.filter(r => r.status === 'failed').length;

          return (
            <div className='flex items-center gap-2'>
              <span className='text-sm font-medium'>
                {completed}/{results.length}
              </span>
              {failed > 0 && (
                <span className='rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                  {failed} failed
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'triggeredBy',
        header: 'Triggered By',
        cell: ({ row }) => (
          <span className='text-sm text-muted-foreground'>
            {row.original.triggeredBy}
          </span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const execution = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' className='h-8 w-8 p-0'>
                  <span className='sr-only'>Open menu</span>
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setSelectedExecution(execution)}
                >
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(execution.id);
                  }}
                >
                  Copy Execution ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onExport?.([execution])}
                  disabled={!onExport}
                >
                  <Download className='mr-2 h-4 w-4' />
                  Export Logs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [onExport]
  );

  const table = useReactTable({
    data: filteredExecutions,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleExportSelected = useCallback(() => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedExecutions = selectedRows.map(row => row.original);
    onExport?.(selectedExecutions);
  }, [table, onExport]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-1 items-center gap-2'>
          <div className='relative flex-1'>
            <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search executions...'
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(String(e.target.value))}
              className='pl-8'
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-[140px]'>
              <Filter className='mr-2 h-4 w-4' />
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              {Object.entries(EXECUTION_STATUS_CONFIG).map(
                ([status, config]) => (
                  <SelectItem key={status} value={status}>
                    {config.label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className='w-[140px]'>
              <Clock className='mr-2 h-4 w-4' />
              <SelectValue placeholder='Date' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Time</SelectItem>
              <SelectItem value='today'>Today</SelectItem>
              <SelectItem value='week'>Last 7 Days</SelectItem>
              <SelectItem value='month'>Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className='flex items-center gap-2'>
          {onRefresh && (
            <Button
              variant='outline'
              size='sm'
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                className={cn('h-4 w-4', isLoading && 'animate-spin')}
              />
              <span className='hidden sm:inline'>Refresh</span>
            </Button>
          )}
          {onExport && table.getFilteredSelectedRowModel().rows.length > 0 && (
            <Button variant='outline' size='sm' onClick={handleExportSelected}>
              <Download className='h-4 w-4' />
              <span className='hidden sm:inline'>
                Export ({table.getFilteredSelectedRowModel().rows.length})
              </span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='sm'>
                Columns <ChevronDown className='ml-2 h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              {table
                .getAllColumns()
                .filter(column => column.getCanHide())
                .map(column => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className='capitalize'
                      checked={column.getIsVisible()}
                      onCheckedChange={value =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  <div className='flex items-center justify-center'>
                    <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                    Loading executions...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='cursor-pointer'
                  onClick={() => setSelectedExecution(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  <div className='flex flex-col items-center justify-center py-8'>
                    <AlertCircle className='h-8 w-8 text-muted-foreground' />
                    <p className='mt-2 text-sm text-muted-foreground'>
                      No executions found.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between px-2'>
        <div className='flex-1 text-sm text-muted-foreground'>
          {table.getFilteredSelectedRowModel().rows.length > 0 && (
            <>
              {table.getFilteredSelectedRowModel().rows.length} of{' '}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </>
          )}
        </div>
        <div className='flex items-center space-x-6 lg:space-x-8'>
          <div className='flex items-center space-x-2'>
            <p className='text-sm font-medium'>Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={value => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className='h-8 w-[70px]'>
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side='top'>
                {[10, 20, 30, 40, 50].map(pageSize => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex w-[100px] items-center justify-center text-sm font-medium'>
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </div>
          <div className='flex items-center space-x-2'>
            <Button
              variant='outline'
              className='h-8 w-8 p-0'
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className='sr-only'>Go to first page</span>
              {'<<'}
            </Button>
            <Button
              variant='outline'
              className='h-8 w-8 p-0'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className='sr-only'>Go to previous page</span>
              {'<'}
            </Button>
            <Button
              variant='outline'
              className='h-8 w-8 p-0'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className='sr-only'>Go to next page</span>
              {'>'}
            </Button>
            <Button
              variant='outline'
              className='h-8 w-8 p-0'
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className='sr-only'>Go to last page</span>
              {'>>'}
            </Button>
          </div>
        </div>
      </div>

      {/* Execution Details Sheet */}
      {selectedExecution && (
        <ExecutionDetails
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Execution Details Component
// =============================================================================

function ExecutionDetails({ execution, onClose }: ExecutionDetailsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'data'>(
    'overview'
  );

  const config = EXECUTION_STATUS_CONFIG[execution.status];
  const StatusIcon =
    execution.status === 'completed'
      ? CheckCircle2
      : execution.status === 'failed'
        ? XCircle
        : execution.status === 'running'
          ? RefreshCw
          : Clock;

  const handleExportLogs = () => {
    const logs = {
      executionId: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      duration: execution.duration,
      actionResults: execution.actionResults,
      triggerData: execution.triggerData,
      error: execution.error,
    };

    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${execution.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className='w-full sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            <StatusIcon
              className={cn(
                'h-5 w-5',
                execution.status === 'running' && 'animate-spin',
                config.color
              )}
            />
            Execution Details
          </SheetTitle>
          <SheetDescription>Execution ID: {execution.id}</SheetDescription>
        </SheetHeader>

        <div className='mt-6 space-y-6'>
          {/* Tabs */}
          <div className='flex gap-1 rounded-lg border bg-muted p-1'>
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'overview'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'logs'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Step Logs
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'data'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Input/Output
            </button>
          </div>

          {/* Tab Content */}
          <div className='max-h-[calc(100vh-300px)] space-y-4 overflow-y-auto'>
            {activeTab === 'overview' && (
              <ExecutionOverview execution={execution} />
            )}
            {activeTab === 'logs' && <ExecutionLogs execution={execution} />}
            {activeTab === 'data' && <ExecutionData execution={execution} />}
          </div>

          {/* Footer Actions */}
          <div className='flex justify-end gap-2 border-t pt-4'>
            <Button variant='outline' onClick={handleExportLogs}>
              <Download className='mr-2 h-4 w-4' />
              Export Logs
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =============================================================================
// Overview Tab
// =============================================================================

function ExecutionOverview({ execution }: { execution: WorkflowExecution }) {
  const config = EXECUTION_STATUS_CONFIG[execution.status];
  const startedAt = new Date(execution.startedAt);
  const completedAt = execution.completedAt
    ? new Date(execution.completedAt)
    : null;

  const successCount = execution.actionResults.filter(
    r => r.status === 'completed'
  ).length;
  const failedCount = execution.actionResults.filter(
    r => r.status === 'failed'
  ).length;
  const skippedCount = execution.actionResults.filter(
    r => r.status === 'skipped'
  ).length;

  return (
    <div className='space-y-6'>
      {/* Status Card */}
      <div className='rounded-lg border bg-card p-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-sm text-muted-foreground'>Status</p>
            <div className='mt-1 flex items-center gap-2'>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  config.bgColor,
                  config.color
                )}
              >
                {config.label}
              </span>
            </div>
          </div>
          {execution.duration && (
            <div className='text-right'>
              <p className='text-sm text-muted-foreground'>Duration</p>
              <p className='mt-1 text-lg font-semibold'>
                {formatDuration(execution.duration)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className='space-y-3'>
        <h3 className='text-sm font-medium'>Timeline</h3>
        <div className='space-y-2 rounded-lg border bg-muted/30 p-4'>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>Started</span>
            <span className='font-medium'>
              {format(startedAt, 'MMM d, yyyy h:mm:ss a')}
            </span>
          </div>
          {completedAt && (
            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>Completed</span>
              <span className='font-medium'>
                {format(completedAt, 'MMM d, yyyy h:mm:ss a')}
              </span>
            </div>
          )}
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>Triggered By</span>
            <span className='font-medium'>{execution.triggeredBy}</span>
          </div>
        </div>
      </div>

      {/* Action Statistics */}
      <div className='space-y-3'>
        <h3 className='text-sm font-medium'>Action Results</h3>
        <div className='grid grid-cols-3 gap-3'>
          <div className='rounded-lg border bg-green-50 p-3 dark:bg-green-900/20'>
            <p className='text-xs text-muted-foreground'>Completed</p>
            <p className='mt-1 text-2xl font-bold text-green-700 dark:text-green-400'>
              {successCount}
            </p>
          </div>
          <div className='rounded-lg border bg-red-50 p-3 dark:bg-red-900/20'>
            <p className='text-xs text-muted-foreground'>Failed</p>
            <p className='mt-1 text-2xl font-bold text-red-700 dark:text-red-400'>
              {failedCount}
            </p>
          </div>
          <div className='rounded-lg border bg-gray-50 p-3 dark:bg-gray-800/50'>
            <p className='text-xs text-muted-foreground'>Skipped</p>
            <p className='mt-1 text-2xl font-bold text-gray-700 dark:text-gray-400'>
              {skippedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {execution.error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'>
          <div className='flex items-start gap-2'>
            <AlertCircle className='h-5 w-5 text-red-600 dark:text-red-400' />
            <div>
              <p className='text-sm font-medium text-red-800 dark:text-red-200'>
                Execution Error
              </p>
              <p className='mt-1 text-sm text-red-600 dark:text-red-300'>
                {execution.error}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Logs Tab
// =============================================================================

function ExecutionLogs({ execution }: { execution: WorkflowExecution }) {
  return (
    <div className='space-y-3'>
      {execution.actionResults.map((result, index) => (
        <ActionResultCard key={result.actionId} result={result} index={index} />
      ))}
    </div>
  );
}

function ActionResultCard({
  result,
  index,
}: {
  result: ActionResult;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const actionConfig = ACTION_TYPE_CONFIG[result.actionType];

  const statusConfig = {
    completed: {
      icon: CheckCircle2,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    failed: {
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
    },
    running: {
      icon: RefreshCw,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    pending: {
      icon: Clock,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-800/50',
      borderColor: 'border-gray-200 dark:border-gray-700',
    },
    skipped: {
      icon: AlertCircle,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-800/50',
      borderColor: 'border-gray-200 dark:border-gray-700',
    },
  }[result.status];

  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        statusConfig.bgColor,
        statusConfig.borderColor
      )}
    >
      <div className='flex items-start justify-between'>
        <div className='flex items-start gap-3'>
          <div className='flex h-7 w-7 items-center justify-center rounded-full bg-background text-xs font-medium'>
            {index + 1}
          </div>
          <div>
            <div className='flex items-center gap-2'>
              <StatusIcon className={cn('h-4 w-4', statusConfig.color)} />
              <span className='font-medium'>{actionConfig.label}</span>
            </div>
            <p className='mt-1 text-xs text-muted-foreground'>
              {actionConfig.description}
            </p>
            {result.duration && (
              <p className='mt-1 text-xs text-muted-foreground'>
                Duration: {formatDuration(result.duration)}
              </p>
            )}
          </div>
        </div>
      </div>

      {result.error && (
        <div className='mt-3 rounded-md bg-red-100 p-2 dark:bg-red-900/30'>
          <p className='text-xs font-medium text-red-800 dark:text-red-200'>
            Error: {result.error}
          </p>
        </div>
      )}

      {result.output && (
        <div className='mt-3'>
          <button
            onClick={() => setExpanded(!expanded)}
            className='text-xs font-medium text-primary hover:underline'
          >
            {expanded ? 'Hide' : 'Show'} Output
          </button>
          {expanded && (
            <pre className='mt-2 overflow-auto rounded-md bg-background p-3 text-xs'>
              {JSON.stringify(result.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Data Tab
// =============================================================================

function ExecutionData({ execution }: { execution: WorkflowExecution }) {
  return (
    <div className='space-y-6'>
      {/* Trigger Data */}
      {execution.triggerData && (
        <div className='space-y-3'>
          <h3 className='text-sm font-medium'>Trigger Data</h3>
          <div className='rounded-lg border bg-muted/30'>
            <pre className='overflow-auto p-4 text-xs'>
              {JSON.stringify(execution.triggerData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Action Outputs */}
      <div className='space-y-3'>
        <h3 className='text-sm font-medium'>Action Outputs</h3>
        <div className='space-y-3'>
          {execution.actionResults
            .filter(r => r.output)
            .map((result, index) => {
              const actionConfig = ACTION_TYPE_CONFIG[result.actionType];
              return (
                <div key={result.actionId} className='rounded-lg border p-3'>
                  <div className='mb-2 flex items-center gap-2'>
                    <span className='flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary'>
                      {index + 1}
                    </span>
                    <span className='text-sm font-medium'>
                      {actionConfig.label}
                    </span>
                  </div>
                  <pre className='overflow-auto rounded-md bg-muted/50 p-3 text-xs'>
                    {JSON.stringify(result.output, null, 2)}
                  </pre>
                </div>
              );
            })}
          {execution.actionResults.filter(r => r.output).length === 0 && (
            <p className='text-sm text-muted-foreground'>
              No action outputs available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3600000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(ms / 3600000);
  const mins = Math.round((ms % 3600000) / 60000);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
