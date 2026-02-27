'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  CheckSquare,
  Plus,
  Search,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTasks } from '@/hooks/use-tasks';
import { cn } from '@/lib/utils';

import type { TaskPriorityType, TaskStatusType } from '@/lib/validations/task';

// =============================================================================
// Form Schema
// =============================================================================

const createTaskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title is too long'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']),
  dueDate: z.string().optional(),
  estimatedHours: z.coerce.number().int().positive().optional(),
  tags: z.string().optional(), // Comma-separated tags
  orchestratorId: z.string().min(1, 'Orchestrator is required'),
  assignedToId: z.string().optional(),
});

type CreateTaskFormValues = z.infer<typeof createTaskFormSchema>;

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
  orchestrator?: {
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
  TODO: {
    label: 'To Do',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
  },
  BLOCKED: {
    label: 'Blocked',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  DONE: {
    label: 'Done',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
  },
} as const;

const PRIORITY_CONFIG = {
  CRITICAL: { label: 'Critical', color: 'text-red-600', icon: '!!' },
  HIGH: { label: 'High', color: 'text-orange-600', icon: '!' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-600', icon: '~' },
  LOW: { label: 'Low', color: 'text-green-600', icon: '↓' },
} as const;

const SORT_OPTIONS = [
  {
    value: 'dueDate-asc',
    label: 'Due Date (Earliest First)',
    sortBy: 'dueDate' as const,
    sortOrder: 'asc' as const,
  },
  {
    value: 'dueDate-desc',
    label: 'Due Date (Latest First)',
    sortBy: 'dueDate' as const,
    sortOrder: 'desc' as const,
  },
  {
    value: 'priority-desc',
    label: 'Priority (High to Low)',
    sortBy: 'priority' as const,
    sortOrder: 'desc' as const,
  },
  {
    value: 'priority-asc',
    label: 'Priority (Low to High)',
    sortBy: 'priority' as const,
    sortOrder: 'asc' as const,
  },
  {
    value: 'updatedAt-desc',
    label: 'Recently Updated',
    sortBy: 'updatedAt' as const,
    sortOrder: 'desc' as const,
  },
  {
    value: 'title-asc',
    label: 'Alphabetical (A-Z)',
    sortBy: 'title' as const,
    sortOrder: 'asc' as const,
  },
  {
    value: 'title-desc',
    label: 'Alphabetical (Z-A)',
    sortBy: 'title' as const,
    sortOrder: 'desc' as const,
  },
] as const;

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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [sortValue, setSortValue] = useState('updatedAt-desc');

  // Get sort parameters from selected value
  const currentSortOption =
    SORT_OPTIONS.find(opt => opt.value === sortValue) || SORT_OPTIONS[4];

  // Hooks
  const { tasks, isLoading, error, refetch, pagination } = useTasks(
    workspaceSlug,
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      search: searchQuery || undefined,
      includeCompleted: false,
      page: currentPage,
      limit: pageSize,
      sortBy: currentSortOption.sortBy,
      sortOrder: currentSortOption.sortOrder,
    }
  );

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
      if (task.status === 'TODO') {
        stats.todo++;
      } else if (task.status === 'IN_PROGRESS') {
        stats.inProgress++;
      } else if (task.status === 'BLOCKED') {
        stats.blocked++;
      } else if (task.status === 'DONE') {
        stats.done++;
      } else if (task.status === 'CANCELLED') {
        stats.cancelled++;
      }
    });

    return stats;
  }, [tasks]);

  // Handlers
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page when search changes
  }, []);

  const handleClearFilters = useCallback(() => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setSearchQuery('');
    setSortValue('updatedAt-desc');
    setCurrentPage(1); // Reset to first page when clearing filters
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePageSizeChange = useCallback((size: string) => {
    setPageSize(Number(size));
    setCurrentPage(1); // Reset to first page when page size changes
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
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className='h-4 w-4' />
          Create Task
        </Button>
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
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              type='text'
              placeholder='Search tasks by title or description...'
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              className='pl-10'
            />
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={value =>
              setStatusFilter(value as TaskStatusType | 'all')
            }
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='All Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                <SelectItem key={status} value={status}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select
            value={priorityFilter}
            onValueChange={value =>
              setPriorityFilter(value as TaskPriorityType | 'all')
            }
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='All Priority' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Priority</SelectItem>
              {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                <SelectItem key={priority} value={priority}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort Dropdown */}
          <Select value={sortValue} onValueChange={setSortValue}>
            <SelectTrigger className='w-[200px]'>
              <div className='flex items-center gap-2'>
                <ArrowUpDown className='h-4 w-4' />
                <SelectValue placeholder='Sort by...' />
              </div>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
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
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4'>
          <div className='flex items-center gap-2 text-destructive'>
            <AlertCircle className='h-5 w-5' />
            <p className='text-sm font-medium'>Failed to load tasks</p>
          </div>
          <p className='mt-1 text-sm text-destructive/80'>{error.message}</p>
          <button
            type='button'
            onClick={refetch}
            className='mt-2 text-sm font-medium text-destructive hover:text-destructive/80'
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
                  onClick: () => setIsCreateDialogOpen(true),
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

      {/* Pagination */}
      {!isLoading && !error && pagination && pagination.totalPages > 1 && (
        <div className='space-y-4'>
          {/* Pagination Info and Page Size Selector */}
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='text-sm text-muted-foreground'>
              Showing {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(
                pagination.page * pagination.limit,
                pagination.totalCount
              )}{' '}
              of {pagination.totalCount} tasks
            </div>
            <div className='flex items-center gap-2'>
              <span className='text-sm text-muted-foreground'>
                Items per page:
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className='w-[80px]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='10'>10</SelectItem>
                  <SelectItem value='12'>12</SelectItem>
                  <SelectItem value='25'>25</SelectItem>
                  <SelectItem value='50'>50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pagination Controls */}
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() =>
                    pagination.hasPreviousPage &&
                    handlePageChange(currentPage - 1)
                  }
                  className={cn(
                    !pagination.hasPreviousPage &&
                      'pointer-events-none opacity-50',
                    'cursor-pointer'
                  )}
                />
              </PaginationItem>

              {/* Page Numbers */}
              {Array.from(
                { length: pagination.totalPages },
                (_, i) => i + 1
              ).map(page => {
                // Show first page, last page, current page, and pages around current
                const showPage =
                  page === 1 ||
                  page === pagination.totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1);

                // Show ellipsis
                const showEllipsisBefore =
                  page === currentPage - 2 && currentPage > 3;
                const showEllipsisAfter =
                  page === currentPage + 2 &&
                  currentPage < pagination.totalPages - 2;

                if (showEllipsisBefore || showEllipsisAfter) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                if (!showPage) {
                  return null;
                }

                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => handlePageChange(page)}
                      isActive={currentPage === page}
                      className='cursor-pointer'
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    pagination.hasNextPage && handlePageChange(currentPage + 1)
                  }
                  className={cn(
                    !pagination.hasNextPage && 'pointer-events-none opacity-50',
                    'cursor-pointer'
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        workspaceSlug={workspaceSlug}
        onSuccess={refetch}
      />
    </div>
  );
}

// =============================================================================
// Create Task Dialog Component
// =============================================================================

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  onSuccess: () => void;
}

function CreateTaskDialog({
  open,
  onOpenChange,
  workspaceSlug,
  onSuccess,
}: CreateTaskDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orchestrators, setOrchestrators] = useState<
    Array<{ id: string; role: string; userId: string }>
  >([]);
  const [orchestratorsLoading, setOrchestratorsLoading] = useState(false);

  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      status: 'TODO',
      dueDate: '',
      estimatedHours: undefined,
      tags: '',
      orchestratorId: '',
      assignedToId: '',
    },
  });

  // Fetch orchestrators when dialog opens
  useEffect(() => {
    if (open && !orchestrators.length) {
      setOrchestratorsLoading(true);
      fetch(`/api/orchestrators?workspaceSlug=${workspaceSlug}`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setOrchestrators(data.data);
            // Auto-select first orchestrator if available
            if (data.data.length > 0 && !form.getValues('orchestratorId')) {
              form.setValue('orchestratorId', data.data[0].id);
            }
          }
        })
        .catch(err => console.error('Failed to fetch orchestrators:', err))
        .finally(() => setOrchestratorsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (values: CreateTaskFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Parse tags from comma-separated string
      const tagsArray = values.tags
        ? values.tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean)
        : [];

      // Prepare payload
      const payload = {
        title: values.title,
        description: values.description || '',
        priority: values.priority,
        status: values.status,
        orchestratorId: values.orchestratorId,
        workspaceId: workspaceSlug,
        dueDate: values.dueDate || undefined,
        estimatedHours: values.estimatedHours,
        tags: tagsArray,
        assignedToId: values.assignedToId || undefined,
      };

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create task');
      }

      // Success - close dialog and refresh tasks
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to create task:', error);
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to create task'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Create a new task for your workspace. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            {/* Submit Error */}
            {submitError && (
              <div className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'>
                {submitError}
              </div>
            )}
            {/* Title */}
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Enter task title...'
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Enter task description...'
                      className='min-h-[100px]'
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              {/* Priority */}
              <FormField
                control={form.control}
                name='priority'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select priority' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PRIORITY_CONFIG).map(
                          ([value, config]) => (
                            <SelectItem key={value} value={value}>
                              {config.label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select status' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(
                          ([value, config]) => (
                            <SelectItem key={value} value={value}>
                              {config.label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Orchestrator */}
            <FormField
              control={form.control}
              name='orchestratorId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Orchestrator</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting || orchestratorsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            orchestratorsLoading
                              ? 'Loading orchestrators...'
                              : 'Select orchestrator'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {orchestrators.map(orch => (
                        <SelectItem key={orch.id} value={orch.id}>
                          {orch.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The orchestrator responsible for this task
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              {/* Due Date */}
              <FormField
                control={form.control}
                name='dueDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type='date' {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estimated Hours */}
              <FormField
                control={form.control}
                name='estimatedHours'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Hours</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min='1'
                        placeholder='8'
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tags */}
            <FormField
              control={form.control}
              name='tags'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='feature, backend, urgent (comma-separated)'
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter tags separated by commas
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Task Card Component
// =============================================================================

interface TaskCardProps {
  task: Task;
}

function TaskCard({ task }: TaskCardProps) {
  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
  const priorityConfig =
    PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];

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
        {task.orchestrator && (
          <div className='flex items-center gap-1'>
            <User className='h-3.5 w-3.5' />
            <span>
              {task.orchestrator.user.name || task.orchestrator.user.email}
            </span>
          </div>
        )}

        {task.assignedTo && (
          <div className='flex items-center gap-1'>
            <UserPlus className='h-3.5 w-3.5' />
            <span>{task.assignedTo.name || task.assignedTo.email}</span>
          </div>
        )}

        {task.dueDate && (
          <div className='flex items-center gap-1'>
            <Calendar className='h-3.5 w-3.5' />
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
