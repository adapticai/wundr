'use client';

import { AlertCircle, GitBranch, RefreshCw, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { PipelineTask } from '@/components/task-flow/task-pipeline';
import { TaskPipeline } from '@/components/task-flow/task-pipeline';
import type { TaskFlowDetailData } from '@/components/task-flow/task-flow-detail';
import { TaskFlowDetail } from '@/components/task-flow/task-flow-detail';
import { FlowStats } from '@/components/task-flow/flow-stats';
import type { FlowStatsData } from '@/components/task-flow/flow-stats';

// =============================================================================
// Types
// =============================================================================

type DateRangeOption = 'today' | '7d' | '30d' | 'all';

// =============================================================================
// Constants
// =============================================================================

const DATE_RANGE_OPTIONS: Array<{ value: DateRangeOption; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const DISCIPLINE_OPTIONS = [
  { value: 'all', label: 'All disciplines' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'product', label: 'Product' },
  { value: 'design', label: 'Design' },
  { value: 'data', label: 'Data' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'ops', label: 'Operations' },
];

// =============================================================================
// Helpers
// =============================================================================

function getDateRangeStart(range: DateRangeOption): Date | null {
  const now = new Date();
  switch (range) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    }
    case 'all':
    default:
      return null;
  }
}

function buildTasksUrl(
  workspaceSlug: string,
  params: {
    status?: string;
    search?: string;
    dateFrom?: Date | null;
    limit?: number;
  }
): string {
  const qs = new URLSearchParams();
  qs.set('workspaceId', workspaceSlug);
  qs.set('includeCompleted', 'true');
  qs.set('limit', String(params.limit ?? 100));
  if (params.status && params.status !== 'all') {
    qs.set('status', params.status);
  }
  if (params.search) {
    qs.set('search', params.search);
  }
  if (params.dateFrom) {
    qs.set('dateFrom', params.dateFrom.toISOString());
  }
  return `/api/tasks?${qs.toString()}`;
}

function buildStatsFromTasks(
  tasks: TaskFlowDetailData[],
  dateFrom: Date | null
): FlowStatsData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalToday = tasks.filter(t => {
    const created = new Date(t.createdAt);
    return created >= today;
  }).length;

  const byStatus: Record<string, number> = {};
  const byDisciplineMap: Record<string, number> = {};

  tasks.forEach(t => {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    const disc = t.orchestrator?.discipline ?? 'unknown';
    byDisciplineMap[disc] = (byDisciplineMap[disc] ?? 0) + 1;
  });

  const done = tasks.filter(
    t =>
      (t.status === 'DONE' || t.status === 'CANCELLED') &&
      t.completedAt &&
      t.createdAt
  );
  const avgMs =
    done.length > 0
      ? done.reduce((sum, t) => {
          const start = new Date(t.createdAt).getTime();
          const end = new Date(t.completedAt!).getTime();
          return sum + (end - start);
        }, 0) / done.length
      : null;

  const completed = tasks.filter(t => t.status === 'DONE').length;
  const total = tasks.length;

  return {
    totalToday,
    totalAll: total,
    avgCompletionMs: avgMs,
    successRate: total > 0 ? completed / total : 0,
    tasksByDiscipline: Object.entries(byDisciplineMap).map(
      ([discipline, count]) => ({ discipline, count })
    ),
    tasksByStatus: byStatus,
  };
}

// Convert TaskFlowDetailData to PipelineTask
function toPipelineTask(t: TaskFlowDetailData): PipelineTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    tags: t.tags,
    createdAt: t.createdAt,
    dueDate: null,
    orchestrator: t.orchestrator
      ? {
          id: t.orchestrator.id,
          role: t.orchestrator.role,
          user: t.orchestrator.user,
        }
      : undefined,
    assignedTo: t.assignedTo,
    hasRoutingDecision: !!t.routingDecision,
    hasExecution: !!t.execution,
    executionStatus: t.execution?.status ?? null,
  };
}

// =============================================================================
// Page Component
// =============================================================================

export default function TaskFlowPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [tasks, setTasks] = useState<TaskFlowDetailData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Selected task for detail view
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!workspaceSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const dateFrom = getDateRangeStart(dateRange);
      const url = buildTasksUrl(workspaceSlug, {
        status: statusFilter,
        search: searchQuery || undefined,
        dateFrom,
        limit: 200,
      });
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch task flow data');
      const json = await res.json();
      setTasks(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, statusFilter, searchQuery, dateRange]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filter by discipline (client-side since API may not support it directly)
  const filteredTasks = useMemo(() => {
    if (disciplineFilter === 'all') return tasks;
    return tasks.filter(
      t =>
        t.orchestrator?.discipline?.toLowerCase() ===
        disciplineFilter.toLowerCase()
    );
  }, [tasks, disciplineFilter]);

  // Stats derived from filtered tasks
  const stats = useMemo(
    () =>
      isLoading
        ? null
        : buildStatsFromTasks(filteredTasks, getDateRangeStart(dateRange)),
    [filteredTasks, isLoading, dateRange]
  );

  const pipelineTasks = useMemo(
    () => filteredTasks.map(toPipelineTask),
    [filteredTasks]
  );

  const selectedTask = useMemo(
    () => filteredTasks.find(t => t.id === selectedTaskId) ?? null,
    [filteredTasks, selectedTaskId]
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (disciplineFilter !== 'all') count++;
    if (dateRange !== '30d') count++;
    if (searchQuery) count++;
    return count;
  }, [statusFilter, disciplineFilter, dateRange, searchQuery]);

  const handleClearFilters = useCallback(() => {
    setStatusFilter('all');
    setDisciplineFilter('all');
    setDateRange('30d');
    setSearchQuery('');
    setSelectedTaskId(null);
  }, []);

  // =============================================================================
  // Render: detail view
  // =============================================================================

  if (selectedTask) {
    return (
      <div className='p-4 md:p-6'>
        <TaskFlowDetail
          task={selectedTask}
          onBack={() => setSelectedTaskId(null)}
        />
      </div>
    );
  }

  // =============================================================================
  // Render: pipeline view
  // =============================================================================

  return (
    <div className='p-4 md:p-6 space-y-6'>
      {/* Page header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <div className='flex items-center gap-2'>
            <GitBranch className='h-5 w-5 text-muted-foreground' />
            <h1 className='text-2xl font-bold text-foreground'>Task Flow</h1>
          </div>
          <p className='text-sm text-muted-foreground'>
            Visualize how tasks move through the system from submission to
            completion
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={fetchTasks}
          disabled={isLoading}
          className='gap-2 self-start sm:self-auto'
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <FlowStats stats={stats} isLoading={isLoading} />

      {/* Filters */}
      <div className='rounded-lg border bg-card p-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap'>
          {/* Search */}
          <div className='relative flex-1 min-w-[200px]'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              type='text'
              placeholder='Search tasks...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-[160px]'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Discipline filter */}
          <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
            <SelectTrigger className='w-[170px]'>
              <SelectValue placeholder='Discipline' />
            </SelectTrigger>
            <SelectContent>
              {DISCIPLINE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range */}
          <Select
            value={dateRange}
            onValueChange={v => setDateRange(v as DateRangeOption)}
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='Date range' />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {activeFiltersCount > 0 && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={handleClearFilters}
              className='gap-1 text-muted-foreground'
            >
              <X className='h-4 w-4' />
              Clear ({activeFiltersCount})
            </Button>
          )}
        </div>

        {/* Result count */}
        {!isLoading && (
          <p className='mt-3 text-sm text-muted-foreground'>
            {filteredTasks.length} task
            {filteredTasks.length !== 1 ? 's' : ''}
            {activeFiltersCount > 0 ? ' matching filters' : ' total'} — click
            any card to view full routing and execution details
          </p>
        )}
      </div>

      {/* Error */}
      {error && !isLoading && (
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4'>
          <div className='flex items-center gap-2 text-destructive'>
            <AlertCircle className='h-5 w-5' />
            <p className='text-sm font-medium'>Failed to load task flow data</p>
          </div>
          <p className='mt-1 text-sm text-destructive/80'>{error.message}</p>
          <button
            type='button'
            onClick={fetchTasks}
            className='mt-2 text-sm font-medium text-destructive hover:text-destructive/80'
          >
            Try again
          </button>
        </div>
      )}

      {/* Pipeline */}
      {!error && (
        <TaskPipeline
          tasks={pipelineTasks}
          isLoading={isLoading}
          onTaskClick={setSelectedTaskId}
          className='min-h-[420px]'
        />
      )}
    </div>
  );
}
