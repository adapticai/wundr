'use client';

import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  Clock,
  GitBranch,
  Loader2,
  Network,
  Send,
  User,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineDot,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '@/components/ui/timeline';
import { cn } from '@/lib/utils';

import type { RoutingDecisionData } from './routing-decision-card';
import { ExecutionOutput } from './execution-output';
import type { ExecutionOutputData } from './execution-output';
import { RoutingDecisionCard } from './routing-decision-card';

// =============================================================================
// Types
// =============================================================================

export interface TaskFlowDetailData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  orchestrator?: {
    id: string;
    role: string;
    discipline: string;
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
  routingDecision?: RoutingDecisionData | null;
  execution?: ExecutionOutputData | null;
  sessionManager?: {
    id: string;
    name: string;
  } | null;
  agent?: {
    id: string;
    name: string;
    type: string;
  } | null;
}

interface TaskFlowDetailProps {
  task: TaskFlowDetailData;
  onBack?: () => void;
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

const PRIORITY_CONFIG = {
  CRITICAL: {
    label: 'Critical',
    class:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
  HIGH: {
    label: 'High',
    class:
      'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  },
  MEDIUM: {
    label: 'Medium',
    class:
      'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  },
  LOW: {
    label: 'Low',
    class:
      'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  },
} as const;

const STATUS_CONFIG = {
  TODO: { label: 'To Do', class: 'bg-blue-100 text-blue-700 border-blue-200' },
  IN_PROGRESS: {
    label: 'In Progress',
    class: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  BLOCKED: {
    label: 'Blocked',
    class: 'bg-red-100 text-red-700 border-red-200',
  },
  DONE: {
    label: 'Done',
    class: 'bg-green-100 text-green-700 border-green-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    class: 'bg-gray-100 text-gray-600 border-gray-200',
  },
} as const;

type DotVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'primary';

interface TimelineStep {
  key: string;
  label: string;
  description: string;
  timestamp: string | null;
  icon: React.ElementType;
  dotVariant: DotVariant;
  completed: boolean;
}

function buildTimeline(task: TaskFlowDetailData): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      key: 'submitted',
      label: 'Task Submitted',
      description: task.createdBy
        ? `Submitted by ${task.createdBy.name || task.createdBy.email}`
        : 'Task created in the system',
      timestamp: task.createdAt,
      icon: Send,
      dotVariant: 'primary',
      completed: true,
    },
    {
      key: 'routed',
      label: 'Routing Decision',
      description: task.routingDecision
        ? `Routed via ${task.routingDecision.matchedBy.replace(/_/g, ' ')} to ${task.routingDecision.agentName || task.routingDecision.agentId}`
        : 'Awaiting routing decision',
      timestamp: task.routingDecision?.createdAt ?? null,
      icon: GitBranch,
      dotVariant: task.routingDecision ? 'success' : 'default',
      completed: !!task.routingDecision,
    },
    {
      key: 'assigned',
      label: 'Session Assigned',
      description: task.sessionManager
        ? `Assigned to session manager: ${task.sessionManager.name}`
        : 'Awaiting session assignment',
      timestamp: null,
      icon: Network,
      dotVariant: task.sessionManager ? 'success' : 'default',
      completed: !!task.sessionManager,
    },
    {
      key: 'agent',
      label: 'Agent Selected',
      description: task.agent
        ? `Agent "${task.agent.name}" (${task.agent.type}) selected for execution`
        : task.routingDecision?.agentName
          ? `Agent "${task.routingDecision.agentName}" selected`
          : 'Awaiting agent selection',
      timestamp: null,
      icon: Bot,
      dotVariant: task.agent || task.routingDecision ? 'success' : 'default',
      completed: !!(task.agent || task.routingDecision),
    },
    {
      key: 'executing',
      label: 'Execution',
      description: task.execution
        ? task.execution.status === 'in-progress'
          ? 'Task is currently being executed'
          : task.execution.status === 'success'
            ? 'Task executed successfully'
            : task.execution.status === 'failed'
              ? 'Execution failed'
              : 'Execution pending'
        : 'Awaiting execution',
      timestamp: task.execution?.startedAt ?? null,
      icon:
        task.execution?.status === 'failed'
          ? XCircle
          : task.execution?.status === 'in-progress'
            ? Loader2
            : task.execution?.status === 'success'
              ? CheckCircle2
              : Clock,
      dotVariant:
        task.execution?.status === 'success'
          ? 'success'
          : task.execution?.status === 'failed'
            ? 'error'
            : task.execution?.status === 'in-progress'
              ? 'info'
              : 'default',
      completed: !!(task.execution && task.execution.status !== 'pending'),
    },
    {
      key: 'completed',
      label: 'Completed',
      description: task.completedAt
        ? `Task completed at ${new Date(task.completedAt).toLocaleString()}`
        : task.status === 'CANCELLED'
          ? 'Task was cancelled'
          : 'Awaiting completion',
      timestamp: task.completedAt,
      icon: task.status === 'CANCELLED' ? XCircle : CheckCircle2,
      dotVariant:
        task.status === 'DONE'
          ? 'success'
          : task.status === 'CANCELLED'
            ? 'error'
            : 'default',
      completed: task.status === 'DONE' || task.status === 'CANCELLED',
    },
  ];

  return steps;
}

// =============================================================================
// Component
// =============================================================================

export function TaskFlowDetail({
  task,
  onBack,
  className,
}: TaskFlowDetailProps) {
  const priorityConfig =
    PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
  const timelineSteps = buildTimeline(task);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Back button + header */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-start gap-3'>
          {onBack && (
            <Button
              variant='ghost'
              size='icon'
              onClick={onBack}
              className='mt-0.5 h-8 w-8 shrink-0'
            >
              <ChevronLeft className='h-4 w-4' />
              <span className='sr-only'>Back</span>
            </Button>
          )}
          <div className='min-w-0'>
            <h2 className='text-xl font-semibold text-foreground leading-tight'>
              {task.title}
            </h2>
            {task.description && (
              <p className='mt-1 text-sm text-muted-foreground line-clamp-2'>
                {task.description}
              </p>
            )}
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-2'>
          {priorityConfig && (
            <Badge
              variant='outline'
              className={cn('text-xs', priorityConfig.class)}
            >
              {priorityConfig.label}
            </Badge>
          )}
          {statusConfig && (
            <Badge
              variant='outline'
              className={cn('text-xs', statusConfig.class)}
            >
              {statusConfig.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className='flex flex-wrap gap-4 text-sm text-muted-foreground'>
        {task.orchestrator && (
          <div className='flex items-center gap-1.5'>
            <User className='h-3.5 w-3.5' />
            <span>
              Orchestrator:{' '}
              <span className='font-medium text-foreground'>
                {task.orchestrator.user.name || task.orchestrator.user.email}
              </span>
            </span>
          </div>
        )}
        {task.createdBy && (
          <div className='flex items-center gap-1.5'>
            <User className='h-3.5 w-3.5' />
            <span>
              Created by:{' '}
              <span className='font-medium text-foreground'>
                {task.createdBy.name || task.createdBy.email}
              </span>
            </span>
          </div>
        )}
        <div className='flex items-center gap-1.5'>
          <Clock className='h-3.5 w-3.5' />
          <span>
            {new Date(task.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        {task.tags.length > 0 && (
          <div className='flex flex-wrap gap-1'>
            {task.tags.map(tag => (
              <span
                key={tag}
                className='rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Timeline + detail grid */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Journey Timeline */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Task Journey</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline>
              {timelineSteps.map((step, idx) => {
                const StepIcon = step.icon;
                const isLast = idx === timelineSteps.length - 1;

                return (
                  <TimelineItem key={step.key}>
                    <div className='relative flex flex-col items-center'>
                      <TimelineDot
                        variant={step.dotVariant}
                        icon={<StepIcon className='h-3.5 w-3.5' />}
                      />
                      {!isLast && (
                        <TimelineConnector
                          variant={step.completed ? 'solid' : 'dashed'}
                        />
                      )}
                    </div>
                    <TimelineContent className='pb-6'>
                      <div className='flex items-start justify-between gap-2'>
                        <TimelineTitle
                          className={cn(
                            'text-sm',
                            !step.completed && 'text-muted-foreground'
                          )}
                        >
                          {step.label}
                        </TimelineTitle>
                        {step.timestamp && (
                          <TimelineTime className='shrink-0 text-right'>
                            {new Date(step.timestamp).toLocaleTimeString(
                              undefined,
                              { hour: '2-digit', minute: '2-digit' }
                            )}
                          </TimelineTime>
                        )}
                      </div>
                      <TimelineDescription className='text-xs leading-relaxed'>
                        {step.description}
                      </TimelineDescription>
                      {step.timestamp && (
                        <TimelineTime className='mt-0.5 text-xs'>
                          {new Date(step.timestamp).toLocaleDateString(
                            undefined,
                            { month: 'short', day: 'numeric', year: 'numeric' }
                          )}
                        </TimelineTime>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                );
              })}
            </Timeline>
          </CardContent>
        </Card>

        {/* Right column: routing decision + execution output */}
        <div className='space-y-4'>
          {task.routingDecision ? (
            <RoutingDecisionCard decision={task.routingDecision} />
          ) : (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Routing Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground italic'>
                  No routing decision recorded for this task.
                </p>
              </CardContent>
            </Card>
          )}

          {task.execution ? (
            <ExecutionOutput execution={task.execution} />
          ) : (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Execution Output</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground italic'>
                  No execution data available yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
