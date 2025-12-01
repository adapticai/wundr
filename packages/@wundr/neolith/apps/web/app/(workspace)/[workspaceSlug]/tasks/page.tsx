'use client';

import { CheckSquare } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { useTasks } from '@/hooks/use-tasks';
import { cn } from '@/lib/utils';

import type { TaskPriorityType, TaskStatusType } from '@/lib/validations/task';

// =============================================================================
// Types
// =============================================================================

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatusType;
  priority: TaskPriorityType;
  dueDate: Date | null;
  tags: string[];
  orchestratorId: string;
  workspaceId: string;
  createdById: string;
  assignedToId: string | null;
  createdAt: Date;
  updatedAt: Date;
  vp?: {
    id: string;
    role: string;
    user: {
      name: string | null;
      email: string;
    };
  };
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

// =============================================================================
// Configuration
// =============================================================================

const STATUS_CONFIG = {
  pending: {
    label: 'To Do',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
  },
  blocked: {
    label: 'Blocked',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  completed: {
    label: 'Done',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
  },
} as const;

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'text-red-600', icon: '!' },
  high: { label: 'High', color: 'text-orange-600', icon: '!' },
  medium: { label: 'Medium', color: 'text-yellow-600', icon: '!' },
  low: { label: 'Low', color: 'text-green-600', icon: '!' },
} as const;

// =============================================================================
// Main Page Component
// =============================================================================

export default function TasksPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;

  // State
  const [statusFilter, setStatusFilter] = useState<TaskStatusType | 'all'>(
    'all'
  );
  const [priorityFilter, setPriorityFilter] = useState<
    TaskPriorityType | 'all'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Hooks
  const { tasks, isLoading, error, refetch } = useTasks(workspaceSlug, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    search: searchQuery || undefined,
    includeCompleted: false,
  });

  // Stats
  const taskStats = useMemo(() => {
    const stats = {
      all: tasks.length,
      todo: 0,
      inProgress: 0,
      blocked: 0,
      done: 0,
      cancelled: 0,
    };

    tasks.forEach(task => {
      if (task.status === 'pending') {
        stats.todo++;
      } else if (task.status === 'in_progress') {
        stats.inProgress++;
      } else if (task.status === 'blocked') {
        stats.blocked++;
      } else if (task.status === 'completed') {
        stats.done++;
      } else if (task.status === 'cancelled') {
        stats.cancelled++;
      }
    });

    return stats;
  }, [tasks]);

  // Handlers
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleClearFilters = useCallback(() => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setSearchQuery('');
  }, []);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') {
      count++;
    }
    if (priorityFilter !== 'all') {
      count++;
    }
    if (searchQuery) {
      count++;
    }
    return count;
  }, [statusFilter, priorityFilter, searchQuery]);

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>Tasks</h1>
          <p className='text-sm text-muted-foreground'>
            Manage tasks across your workspace
          </p>
        </div>
        <button
          type='button'
          className='inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
        >
          <PlusIcon className='h-4 w-4' />
          Create Task
        </button>
      </div>

      {/* Stats Overview */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-5'>
        <StatCard
          label='All Tasks'
          value={taskStats.all}
          color='text-foreground'
          bgColor='bg-muted'
        />
        <StatCard
          label='To Do'
          value={taskStats.todo}
          color='text-blue-600'
          bgColor='bg-blue-50 dark:bg-blue-900/20'
        />
        <StatCard
          label='In Progress'
          value={taskStats.inProgress}
          color='text-yellow-600'
          bgColor='bg-yellow-50 dark:bg-yellow-900/20'
        />
        <StatCard
          label='Blocked'
          value={taskStats.blocked}
          color='text-red-600'
          bgColor='bg-red-50 dark:bg-red-900/20'
        />
        <StatCard
          label='Done'
          value={taskStats.done}
          color='text-green-600'
          bgColor='bg-green-50 dark:bg-green-900/20'
        />
      </div>

      {/* Filters */}
      <div className='rounded-lg border bg-card p-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
          {/* Search */}
          <div className='relative flex-1'>
            <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <input
              type='text'
              placeholder='Search tasks by title or description...'
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              className='w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e =>
              setStatusFilter(e.target.value as TaskStatusType | 'all')
            }
            className='rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          >
            <option value='all'>All Status</option>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <option key={status} value={status}>
                {config.label}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={e =>
              setPriorityFilter(e.target.value as TaskPriorityType | 'all')
            }
            className='rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          >
            <option value='all'>All Priority</option>
            {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
              <option key={priority} value={priority}>
                {config.label}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <button
              type='button'
              onClick={handleClearFilters}
              className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
            >
              <XIcon className='h-4 w-4' />
              Clear ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className='mt-3 text-sm text-muted-foreground'>
          {activeFiltersCount > 0 ? (
            <>Showing {tasks.length} filtered tasks</>
          ) : (
            <>{tasks.length} tasks total</>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'>
          <div className='flex items-center gap-2 text-red-800 dark:text-red-200'>
            <AlertIcon className='h-5 w-5' />
            <p className='text-sm font-medium'>Failed to load tasks</p>
          </div>
          <p className='mt-1 text-sm text-red-600 dark:text-red-300'>
            {error.message}
          </p>
          <button
            type='button'
            onClick={refetch}
            className='mt-2 text-sm font-medium text-red-800 hover:text-red-900 dark:text-red-200'
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && tasks.length === 0 && (
        <EmptyState
          icon={CheckSquare}
          title={activeFiltersCount > 0 ? 'No Tasks Found' : 'No Tasks Yet'}
          description={
            activeFiltersCount > 0
              ? "Try adjusting your filters to find what you're looking for. No tasks match your current criteria."
              : 'Get started by creating your first task. Tasks help organize and track work across your workspace.'
          }
          action={
            activeFiltersCount > 0
              ? {
                  label: 'Clear Filters',
                  onClick: handleClearFilters,
                  variant: 'outline' as const,
                }
              : {
                  label: 'Create Your First Task',
                  onClick: () => {
                    // TODO: Open create task modal
                  },
                }
          }
        />
      )}

      {/* Task Grid */}
      {!isLoading && !error && tasks.length > 0 && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Task Card Component
// =============================================================================

interface TaskCardProps {
  task: Task;
}

function TaskCard({ task }: TaskCardProps) {
  const statusConfig = STATUS_CONFIG[task.status];
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  return (
    <div className='rounded-lg border bg-card p-4 transition-shadow hover:shadow-md'>
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <div className='flex items-start gap-2'>
            <span
              className='text-lg'
              title={`Priority: ${priorityConfig.label}`}
            >
              {priorityConfig.icon}
            </span>
            <div className='flex-1'>
              <h3 className='font-semibold text-foreground'>{task.title}</h3>
              {task.description && (
                <p className='mt-1 text-sm text-muted-foreground line-clamp-2'>
                  {task.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className='mt-3'>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            statusConfig.bgColor,
            statusConfig.color
          )}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Task Details */}
      <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
        {task.vp && (
          <div className='flex items-center gap-1'>
            <UserIcon className='h-3.5 w-3.5' />
            <span>{task.vp.user.name || task.vp.user.email}</span>
          </div>
        )}

        {task.assignedTo && (
          <div className='flex items-center gap-1'>
            <AssignIcon className='h-3.5 w-3.5' />
            <span>{task.assignedTo.name || task.assignedTo.email}</span>
          </div>
        )}

        {task.dueDate && (
          <div className='flex items-center gap-1'>
            <CalendarIcon className='h-3.5 w-3.5' />
            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className='mt-3 flex flex-wrap gap-1'>
          {task.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className='rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className='rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'>
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TaskCardSkeleton() {
  return (
    <div className='animate-pulse rounded-lg border bg-card p-4'>
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <div className='h-5 w-3/4 rounded bg-muted' />
          <div className='mt-2 h-4 w-full rounded bg-muted' />
          <div className='mt-1 h-4 w-5/6 rounded bg-muted' />
        </div>
      </div>
      <div className='mt-3'>
        <div className='h-5 w-20 rounded-full bg-muted' />
      </div>
      <div className='mt-3 flex gap-3'>
        <div className='h-4 w-24 rounded bg-muted' />
        <div className='h-4 w-20 rounded bg-muted' />
      </div>
    </div>
  );
}

// =============================================================================
// Stat Card Component
// =============================================================================

function StatCard({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={cn('rounded-lg border p-4', bgColor)}>
      <p className='text-sm font-medium text-muted-foreground'>{label}</p>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path d='M5 12h14M12 5v14' />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <circle cx='11' cy='11' r='8' />
      <path d='m21 21-4.3-4.3' />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path d='M18 6 6 18M6 6l12 12' />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <circle cx='12' cy='12' r='10' />
      <line x1='12' x2='12' y1='8' y2='12' />
      <line x1='12' x2='12.01' y1='16' y2='16' />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' />
      <circle cx='12' cy='7' r='4' />
    </svg>
  );
}

function AssignIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <line x1='19' x2='19' y1='8' y2='14' />
      <line x1='22' x2='16' y1='11' y2='11' />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <rect width='18' height='18' x='3' y='4' rx='2' ry='2' />
      <line x1='16' x2='16' y1='2' y2='6' />
      <line x1='8' x2='8' y1='2' y2='6' />
      <line x1='3' x2='21' y1='10' y2='10' />
    </svg>
  );
}
