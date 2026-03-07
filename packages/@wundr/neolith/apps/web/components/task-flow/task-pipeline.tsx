'use client';

import { Calendar, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type PipelineStage =
  | 'SUBMITTED'
  | 'ROUTED'
  | 'ASSIGNED'
  | 'EXECUTING'
  | 'COMPLETED';

export interface PipelineTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  tags: string[];
  createdAt: string;
  dueDate: string | null;
  orchestrator?: {
    id: string;
    role: string;
    user: { name: string | null; email: string };
  };
  assignedTo?: { id: string; name: string | null; email: string } | null;
  hasRoutingDecision: boolean;
  hasExecution: boolean;
  executionStatus?: string | null;
}

interface TaskPipelineProps {
  tasks: PipelineTask[];
  isLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

interface StageConfig {
  key: PipelineStage;
  label: string;
  description: string;
  headerClass: string;
  badgeClass: string;
}

const STAGES: StageConfig[] = [
  {
    key: 'SUBMITTED',
    label: 'Submitted',
    description: 'Awaiting routing',
    headerClass: 'bg-slate-50 dark:bg-slate-900/40',
    badgeClass:
      'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
  {
    key: 'ROUTED',
    label: 'Routed',
    description: 'Decision made',
    headerClass: 'bg-blue-50 dark:bg-blue-900/30',
    badgeClass: 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200',
  },
  {
    key: 'ASSIGNED',
    label: 'Assigned',
    description: 'Agent assigned',
    headerClass: 'bg-purple-50 dark:bg-purple-900/30',
    badgeClass:
      'bg-purple-200 text-purple-700 dark:bg-purple-800 dark:text-purple-200',
  },
  {
    key: 'EXECUTING',
    label: 'Executing',
    description: 'Currently running',
    headerClass: 'bg-yellow-50 dark:bg-yellow-900/30',
    badgeClass:
      'bg-yellow-200 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200',
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
    description: 'Done or cancelled',
    headerClass: 'bg-green-50 dark:bg-green-900/30',
    badgeClass:
      'bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-200',
  },
];

const PRIORITY_CONFIG = {
  CRITICAL: {
    label: 'Critical',
    dotClass: 'bg-red-500',
    cardBorder: 'border-l-red-500',
  },
  HIGH: {
    label: 'High',
    dotClass: 'bg-orange-500',
    cardBorder: 'border-l-orange-500',
  },
  MEDIUM: {
    label: 'Medium',
    dotClass: 'bg-yellow-500',
    cardBorder: 'border-l-yellow-400',
  },
  LOW: {
    label: 'Low',
    dotClass: 'bg-green-500',
    cardBorder: 'border-l-green-500',
  },
} as const;

// =============================================================================
// Helpers: Map task status → pipeline stage
// =============================================================================

function getTaskStage(task: PipelineTask): PipelineStage {
  if (task.status === 'DONE' || task.status === 'CANCELLED') {
    return 'COMPLETED';
  }
  if (task.status === 'IN_PROGRESS' || task.hasExecution) {
    return 'EXECUTING';
  }
  if (task.assignedTo || task.status === 'BLOCKED') {
    return 'ASSIGNED';
  }
  if (task.hasRoutingDecision) {
    return 'ROUTED';
  }
  return 'SUBMITTED';
}

// =============================================================================
// Task Card
// =============================================================================

interface TaskCardProps {
  task: PipelineTask;
  onClick?: () => void;
}

function TaskCard({ task, onClick }: TaskCardProps) {
  const priorityConfig =
    PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ??
    PRIORITY_CONFIG.MEDIUM;

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border border-l-4 bg-card text-left shadow-sm',
        'hover:shadow-md hover:border-border/80 transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        priorityConfig.cardBorder
      )}
    >
      <div className='p-3'>
        {/* Title + priority dot */}
        <div className='flex items-start gap-2'>
          <span
            className={cn(
              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
              priorityConfig.dotClass
            )}
            title={`Priority: ${priorityConfig.label}`}
          />
          <h4 className='text-sm font-medium text-foreground leading-snug line-clamp-2'>
            {task.title}
          </h4>
        </div>

        {/* Description */}
        {task.description && (
          <p className='mt-1.5 pl-4 text-xs text-muted-foreground line-clamp-2'>
            {task.description}
          </p>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className='mt-2 pl-4 flex flex-wrap gap-1'>
            {task.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className='rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground'
              >
                {tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className='rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground'>
                +{task.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Meta */}
        <div className='mt-2 pl-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground'>
          {task.orchestrator && (
            <div className='flex items-center gap-1 min-w-0'>
              <User className='h-3 w-3 shrink-0' />
              <span className='truncate max-w-[80px]'>
                {task.orchestrator.user.name || task.orchestrator.user.email}
              </span>
            </div>
          )}
          {task.dueDate && (
            <div className='flex items-center gap-1'>
              <Calendar className='h-3 w-3 shrink-0' />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function TaskCardSkeleton() {
  return (
    <div className='rounded-lg border border-l-4 border-l-muted bg-card p-3 shadow-sm'>
      <div className='flex items-start gap-2'>
        <Skeleton className='mt-1.5 h-2 w-2 rounded-full' />
        <Skeleton className='h-4 flex-1 rounded' />
      </div>
      <Skeleton className='mt-2 ml-4 h-3 w-3/4 rounded' />
      <div className='mt-2 ml-4 flex gap-2'>
        <Skeleton className='h-3 w-16 rounded' />
        <Skeleton className='h-3 w-12 rounded' />
      </div>
    </div>
  );
}

// =============================================================================
// Pipeline Column
// =============================================================================

interface PipelineColumnProps {
  stage: StageConfig;
  tasks: PipelineTask[];
  isLoading: boolean;
  onTaskClick?: (taskId: string) => void;
}

function PipelineColumn({
  stage,
  tasks,
  isLoading,
  onTaskClick,
}: PipelineColumnProps) {
  return (
    <div className='flex min-w-[220px] flex-1 flex-col rounded-xl border bg-muted/30 overflow-hidden'>
      {/* Column header */}
      <div className={cn('px-3 py-2.5', stage.headerClass)}>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-sm font-semibold text-foreground'>
              {stage.label}
            </p>
            <p className='text-xs text-muted-foreground'>{stage.description}</p>
          </div>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              stage.badgeClass
            )}
          >
            {isLoading ? '–' : tasks.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className='flex-1'>
        <div className='space-y-2 p-2'>
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <TaskCardSkeleton key={i} />
            ))
          ) : tasks.length === 0 ? (
            <p className='py-6 text-center text-xs text-muted-foreground'>
              No tasks
            </p>
          ) : (
            tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TaskPipeline({
  tasks,
  isLoading = false,
  onTaskClick,
  className,
}: TaskPipelineProps) {
  // Group tasks by pipeline stage
  const tasksByStage = STAGES.reduce<Record<PipelineStage, PipelineTask[]>>(
    (acc, stage) => {
      acc[stage.key] = [];
      return acc;
    },
    {} as Record<PipelineStage, PipelineTask[]>
  );

  tasks.forEach(task => {
    const stage = getTaskStage(task);
    tasksByStage[stage].push(task);
  });

  return (
    <div className={cn('flex gap-3 overflow-x-auto pb-2', className)}>
      {STAGES.map(stage => (
        <PipelineColumn
          key={stage.key}
          stage={stage}
          tasks={tasksByStage[stage.key]}
          isLoading={isLoading}
          onTaskClick={onTaskClick}
        />
      ))}
    </div>
  );
}
