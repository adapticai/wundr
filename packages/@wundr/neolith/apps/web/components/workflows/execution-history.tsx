'use client';

import { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';
import { EXECUTION_STATUS_CONFIG, ACTION_TYPE_CONFIG } from '@/types/workflow';

import type {
  WorkflowExecution,
  ActionResult,
  ExecutionStatus,
} from '@/types/workflow';

export interface ExecutionHistoryProps {
  executions: WorkflowExecution[];
  isLoading?: boolean;
  onViewDetails?: (execution: WorkflowExecution) => void;
  className?: string;
}

type DateFilter = 'all' | 'today' | 'week' | 'month';

export function ExecutionHistory({
  executions,
  isLoading = false,
  onViewDetails,
  className,
}: ExecutionHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>(
    'all',
  );
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter executions
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
          now.getDate(),
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

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Filters Skeleton */}
        <div className='flex items-center gap-4'>
          <div className='h-10 w-32 animate-pulse rounded-md bg-muted' />
          <div className='h-10 w-32 animate-pulse rounded-md bg-muted' />
        </div>

        {/* Timeline Skeleton */}
        <div className='space-y-4'>
          {[...Array(5)].map((_, i) => (
            <div key={i} className='flex gap-4'>
              <div className='h-4 w-4 animate-pulse rounded-full bg-muted' />
              <div className='flex-1 animate-pulse rounded-lg bg-muted p-4'>
                <div className='h-4 w-32 rounded bg-muted-foreground/20' />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className='flex flex-wrap items-center gap-4'>
        <select
          value={statusFilter}
          onChange={e =>
            setStatusFilter(e.target.value as ExecutionStatus | 'all')
          }
          className='h-10 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          aria-label='Filter by status'
        >
          <option value='all'>All Status</option>
          {Object.entries(EXECUTION_STATUS_CONFIG).map(([status, config]) => (
            <option key={status} value={status}>
              {config.label}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value as DateFilter)}
          className='h-10 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          aria-label='Filter by date'
        >
          <option value='all'>All Time</option>
          <option value='today'>Today</option>
          <option value='week'>Last 7 Days</option>
          <option value='month'>Last 30 Days</option>
        </select>

        <span className='text-sm text-muted-foreground'>
          {filteredExecutions.length} execution
          {filteredExecutions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline */}
      {filteredExecutions.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-12'>
          <HistoryEmptyIcon className='h-12 w-12 text-muted-foreground' />
          <h3 className='mt-4 text-lg font-semibold text-foreground'>
            No executions found
          </h3>
          <p className='mt-2 text-sm text-muted-foreground'>
            {statusFilter !== 'all' || dateFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Workflow executions will appear here once the workflow runs.'}
          </p>
        </div>
      ) : (
        <div className='relative'>
          {/* Timeline line */}
          <div className='absolute left-4 top-0 bottom-0 w-0.5 bg-border' />

          <div className='space-y-4'>
            {filteredExecutions.map(execution => (
              <ExecutionItem
                key={execution.id}
                execution={execution}
                isExpanded={expandedId === execution.id}
                onToggle={() => toggleExpanded(execution.id)}
                onViewDetails={
                  onViewDetails ? () => onViewDetails(execution) : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ExecutionItemProps {
  execution: WorkflowExecution;
  isExpanded: boolean;
  onToggle: () => void;
  onViewDetails?: () => void;
}

function ExecutionItem({
  execution,
  isExpanded,
  onToggle,
  onViewDetails,
}: ExecutionItemProps) {
  const formattedDate = formatDateTime(new Date(execution.startedAt));
  const formattedDuration = execution.duration
    ? formatDuration(execution.duration)
    : execution.status === 'running'
      ? 'Running...'
      : '-';

  return (
    <div className='relative pl-10'>
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-2 top-4 h-5 w-5 rounded-full border-2 border-background',
          execution.status === 'completed' && 'bg-green-500',
          execution.status === 'failed' && 'bg-red-500',
          execution.status === 'running' && 'bg-stone-500',
          execution.status === 'pending' && 'bg-stone-500',
          execution.status === 'cancelled' && 'bg-gray-500',
        )}
      >
        {execution.status === 'running' && (
          <span className='absolute inset-0 animate-ping rounded-full bg-stone-400 opacity-75' />
        )}
      </div>

      {/* Execution Card */}
      <div className='rounded-lg border bg-card'>
        <button
          type='button'
          onClick={onToggle}
          className='flex w-full items-center justify-between p-4 text-left'
        >
          <div className='flex items-center gap-4'>
            <div>
              <div className='flex items-center gap-2'>
                <span className='font-medium text-foreground'>
                  {formattedDate}
                </span>
                <ExecutionStatusBadge status={execution.status} />
              </div>
              <div className='mt-1 flex items-center gap-3 text-sm text-muted-foreground'>
                <span className='flex items-center gap-1'>
                  <ClockIcon className='h-3.5 w-3.5' />
                  {formattedDuration}
                </span>
                <span className='flex items-center gap-1'>
                  <ActionIcon className='h-3.5 w-3.5' />
                  {execution.actionResults.length} actions
                </span>
                {execution.error && (
                  <span className='flex items-center gap-1 text-red-500'>
                    <ErrorIcon className='h-3.5 w-3.5' />
                    Error
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronIcon
            className={cn(
              'h-5 w-5 text-muted-foreground transition-transform',
              isExpanded && 'rotate-180',
            )}
          />
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className='border-t px-4 py-4'>
            {/* Error Message */}
            {execution.error && (
              <div className='mb-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400'>
                <p className='font-medium'>Error:</p>
                <p className='mt-1'>{execution.error}</p>
              </div>
            )}

            {/* Action Results */}
            <div className='space-y-2'>
              <p className='text-sm font-medium text-foreground'>
                Action Results
              </p>
              {execution.actionResults.map((result, index) => (
                <ActionResultItem
                  key={result.actionId}
                  result={result}
                  index={index}
                />
              ))}
            </div>

            {/* Trigger Data */}
            {execution.triggerData && (
              <div className='mt-4'>
                <p className='text-sm font-medium text-foreground'>
                  Trigger Data
                </p>
                <pre className='mt-2 overflow-auto rounded-md bg-muted/50 p-3 text-xs'>
                  {JSON.stringify(execution.triggerData, null, 2)}
                </pre>
              </div>
            )}

            {/* View Details Button */}
            {onViewDetails && (
              <button
                type='button'
                onClick={onViewDetails}
                className='mt-4 text-sm text-primary hover:underline'
              >
                View Full Details
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ActionResultItemProps {
  result: ActionResult;
  index: number;
}

function ActionResultItem({ result, index }: ActionResultItemProps) {
  const [showOutput, setShowOutput] = useState(false);

  return (
    <div className='rounded-md border bg-muted/30 p-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary'>
            {index + 1}
          </span>
          <span className='text-sm font-medium text-foreground'>
            {ACTION_TYPE_CONFIG[result.actionType]?.label || result.actionType}
          </span>
          <ActionStatusBadge status={result.status} />
        </div>
        {result.duration && (
          <span className='text-xs text-muted-foreground'>
            {formatDuration(result.duration)}
          </span>
        )}
      </div>

      {result.error && (
        <p className='mt-2 text-xs text-red-500'>{result.error}</p>
      )}

      {result.output && (
        <div className='mt-2'>
          <button
            type='button'
            onClick={() => setShowOutput(!showOutput)}
            className='text-xs text-primary hover:underline'
          >
            {showOutput ? 'Hide Output' : 'Show Output'}
          </button>
          {showOutput && (
            <pre className='mt-2 overflow-auto rounded bg-background p-2 text-xs'>
              {JSON.stringify(result.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
  className?: string;
}

function ExecutionStatusBadge({
  status,
  className,
}: ExecutionStatusBadgeProps) {
  const config = EXECUTION_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
        className,
      )}
      role='status'
    >
      {status === 'running' && (
        <span className='relative flex h-2 w-2'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-stone-400 opacity-75' />
          <span className='relative inline-flex h-2 w-2 rounded-full bg-stone-500' />
        </span>
      )}
      {config.label}
    </span>
  );
}

interface ActionStatusBadgeProps {
  status: ActionResult['status'];
}

function ActionStatusBadge({ status }: ActionStatusBadgeProps) {
  const statusClasses: Record<ActionResult['status'], string> = {
    pending:
      'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400',
    running:
      'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400',
    completed:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    skipped: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
        statusClasses[status],
      )}
    >
      {status}
    </span>
  );
}

// Utility functions
function formatDateTime(date: Date): string {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return `Today at ${date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

// Icons
function HistoryEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='10' />
      <polyline points='12 6 12 12 16 14' />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='10' />
      <polyline points='12 6 12 12 16 14' />
    </svg>
  );
}

function ActionIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M13 2 3 14h9l-1 8 10-12h-9l1-8z' />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='10' />
      <line x1='12' y1='8' x2='12' y2='12' />
      <line x1='12' y1='16' x2='12.01' y2='16' />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='m6 9 6 6 6-6' />
    </svg>
  );
}
