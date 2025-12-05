'use client';

import {
  CheckCircle2,
  XCircle,
  Clock,
  PlayCircle,
  RefreshCw,
  AlertTriangle,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineTime,
  TimelineTitle,
  TimelineDescription,
} from '@/components/ui/timeline';
import { useWorkflowExecution } from '@/hooks/use-workflow-execution';
import { cn } from '@/lib/utils';
import {
  ACTION_TYPE_CONFIG,
  EXECUTION_STATUS_CONFIG,
} from '@/types/workflow';

import type {
  WorkflowExecution,
  ExecutionStatus,
  ActionResult,
  ActionResultStatus,
} from '@/types/workflow';

export interface ExecutionMonitorProps {
  /** Workspace ID */
  workspaceId: string;
  /** Workflow ID */
  workflowId: string;
  /** Execution ID to monitor */
  executionId: string;
  /** Enable real-time polling for running executions */
  enablePolling?: boolean;
  /** Enable Server-Sent Events (SSE) for real-time updates */
  enableSSE?: boolean;
  /** Callback when execution completes */
  onComplete?: (execution: WorkflowExecution) => void;
  /** Callback when execution is cancelled */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Workflow Execution Monitor
 *
 * Real-time monitoring component for workflow executions with:
 * - Live execution progress tracking
 * - Step-by-step status updates
 * - Timeline visualization of execution flow
 * - Error highlighting and details
 * - Retry failed steps functionality
 * - Cancel running executions
 * - Automatic polling or SSE for real-time updates
 *
 * @example
 * ```tsx
 * <ExecutionMonitor
 *   workspaceId={workspaceId}
 *   workflowId={workflowId}
 *   executionId={executionId}
 *   enablePolling={true}
 *   onComplete={(execution) => {
 *     console.log('Execution completed:', execution);
 *   }}
 * />
 * ```
 */
export function ExecutionMonitor({
  workspaceId,
  workflowId,
  executionId,
  enablePolling = true,
  enableSSE = false,
  onComplete,
  onCancel,
  className,
}: ExecutionMonitorProps) {
  const {
    execution,
    isLoading,
    error,
    progress,
    isRunning,
    canCancel,
    canRetry,
    cancelExecution,
    retryStep,
    retryExecution,
    refreshExecution,
  } = useWorkflowExecution(workspaceId, workflowId, executionId, {
    enablePolling,
    enableSSE,
    autoRefreshOnComplete: true,
  });

  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [retryingSteps, setRetryingSteps] = useState<Set<string>>(new Set());
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Call onComplete callback when execution completes
  if (
    execution &&
    !isRunning &&
    execution.status === 'completed' &&
    onComplete
  ) {
    onComplete(execution);
  }

  const toggleStepExpanded = (actionId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  const handleCancelExecution = async () => {
    setIsCancelling(true);
    const success = await cancelExecution();
    setIsCancelling(false);
    if (success && onCancel) {
      onCancel();
    }
  };

  const handleRetryStep = async (actionId: string) => {
    setRetryingSteps(prev => new Set(prev).add(actionId));
    await retryStep(actionId);
    setRetryingSteps(prev => {
      const next = new Set(prev);
      next.delete(actionId);
      return next;
    });
  };

  const handleRetryExecution = async () => {
    setIsRetrying(true);
    await retryExecution();
    setIsRetrying(false);
  };

  if (isLoading && !execution) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          <span className='ml-3 text-sm text-muted-foreground'>
            Loading execution...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('space-y-4', className)}>
        <Alert variant='destructive'>
          <AlertTriangle className='h-4 w-4' />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <Button onClick={refreshExecution} variant='outline' size='sm'>
          <RefreshCw className='mr-2 h-4 w-4' />
          Retry
        </Button>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className={cn('space-y-4', className)}>
        <Alert>
          <AlertTriangle className='h-4 w-4' />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Execution not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Execution Header */}
      <div className='rounded-lg border bg-card p-6'>
        <div className='flex items-start justify-between'>
          <div className='space-y-1'>
            <div className='flex items-center gap-3'>
              <h3 className='text-lg font-semibold'>Execution Status</h3>
              <ExecutionStatusBadge status={execution.status} />
              {isRunning && (
                <Badge variant='secondary' className='gap-1'>
                  <Loader2 className='h-3 w-3 animate-spin' />
                  Live
                </Badge>
              )}
            </div>
            <p className='text-sm text-muted-foreground'>
              Started {formatDateTime(new Date(execution.startedAt))}
              {execution.completedAt &&
                ` • Completed ${formatDateTime(new Date(execution.completedAt))}`}
            </p>
            {execution.duration && (
              <p className='text-sm text-muted-foreground'>
                Duration: {formatDuration(execution.duration)}
              </p>
            )}
          </div>

          <div className='flex gap-2'>
            {canCancel && (
              <Button
                onClick={handleCancelExecution}
                variant='outline'
                size='sm'
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <X className='mr-2 h-4 w-4' />
                    Cancel
                  </>
                )}
              </Button>
            )}
            {canRetry && (
              <Button
                onClick={handleRetryExecution}
                variant='outline'
                size='sm'
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className='mr-2 h-4 w-4' />
                    Retry
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={refreshExecution}
              variant='ghost'
              size='sm'
              disabled={isLoading}
            >
              <RefreshCw
                className={cn('h-4 w-4', isLoading && 'animate-spin')}
              />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        {progress && (
          <div className='mt-6 space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <span className='font-medium'>
                {progress.completedSteps} of {progress.totalSteps} steps completed
              </span>
              <span className='text-muted-foreground'>
                {progress.percentage}%
              </span>
            </div>
            <Progress value={progress.percentage} className='h-2' />
            {progress.estimatedTimeRemaining && isRunning && (
              <p className='text-xs text-muted-foreground'>
                Estimated time remaining:{' '}
                {formatDuration(progress.estimatedTimeRemaining)}
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {execution.error && (
          <Alert variant='destructive' className='mt-4'>
            <XCircle className='h-4 w-4' />
            <AlertTitle>Execution Error</AlertTitle>
            <AlertDescription>{execution.error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Execution Timeline */}
      <div className='rounded-lg border bg-card p-6'>
        <h4 className='mb-6 text-base font-semibold'>Execution Timeline</h4>

        <Timeline>
          {execution.actionResults.map((result, index) => {
            const isExpanded = expandedSteps.has(result.actionId);
            const isRetryingStep = retryingSteps.has(result.actionId);
            const isLastStep = index === execution.actionResults.length - 1;

            return (
              <TimelineItem key={result.actionId}>
                <TimelineDot
                  variant={getTimelineVariant(result.status)}
                  icon={getStatusIcon(result.status)}
                />
                {!isLastStep && <TimelineConnector />}

                <TimelineContent>
                  <div className='rounded-lg border bg-card p-4'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <TimelineTitle>
                            {ACTION_TYPE_CONFIG[result.actionType]?.label ||
                              result.actionType}
                          </TimelineTitle>
                          <ActionStatusBadge status={result.status} />
                        </div>

                        <TimelineTime>
                          {result.startedAt
                            ? formatDateTime(new Date(result.startedAt))
                            : 'Not started'}
                          {result.duration && ` • ${formatDuration(result.duration)}`}
                        </TimelineTime>

                        {result.error && (
                          <Alert variant='destructive' className='mt-3'>
                            <XCircle className='h-4 w-4' />
                            <AlertDescription className='text-xs'>
                              {result.error}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>

                      <div className='flex gap-2'>
                        {result.status === 'failed' && (
                          <Button
                            onClick={() => handleRetryStep(result.actionId)}
                            variant='outline'
                            size='sm'
                            disabled={isRetryingStep}
                          >
                            {isRetryingStep ? (
                              <Loader2 className='h-3 w-3 animate-spin' />
                            ) : (
                              <RefreshCw className='h-3 w-3' />
                            )}
                          </Button>
                        )}
                        {result.output && (
                          <Button
                            onClick={() => toggleStepExpanded(result.actionId)}
                            variant='ghost'
                            size='sm'
                          >
                            {isExpanded ? (
                              <ChevronUp className='h-4 w-4' />
                            ) : (
                              <ChevronDown className='h-4 w-4' />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Output */}
                    {isExpanded && result.output && (
                      <div className='mt-4 border-t pt-4'>
                        <p className='mb-2 text-xs font-medium text-muted-foreground'>
                          Output
                        </p>
                        <pre className='max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs'>
                          {JSON.stringify(result.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </TimelineContent>
              </TimelineItem>
            );
          })}
        </Timeline>
      </div>

      {/* Trigger Data */}
      {execution.triggerData && (
        <div className='rounded-lg border bg-card p-6'>
          <h4 className='mb-4 text-base font-semibold'>Trigger Data</h4>
          <pre className='max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs'>
            {JSON.stringify(execution.triggerData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Helper Components and Functions

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
}

function ExecutionStatusBadge({ status }: ExecutionStatusBadgeProps) {
  const config = EXECUTION_STATUS_CONFIG[status];

  return (
    <Badge
      variant='outline'
      className={cn('gap-1.5', config.bgColor, config.color)}
    >
      {status === 'running' && <Loader2 className='h-3 w-3 animate-spin' />}
      {status === 'completed' && <CheckCircle2 className='h-3 w-3' />}
      {status === 'failed' && <XCircle className='h-3 w-3' />}
      {status === 'pending' && <Clock className='h-3 w-3' />}
      {config.label}
    </Badge>
  );
}

interface ActionStatusBadgeProps {
  status: ActionResultStatus;
}

function ActionStatusBadge({ status }: ActionStatusBadgeProps) {
  const statusConfig: Record<
    ActionResultStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    pending: { label: 'Pending', variant: 'secondary' },
    running: { label: 'Running', variant: 'default' },
    completed: { label: 'Completed', variant: 'outline' },
    failed: { label: 'Failed', variant: 'destructive' },
    skipped: { label: 'Skipped', variant: 'secondary' },
  };

  const config = statusConfig[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getTimelineVariant(
  status: ActionResultStatus,
): 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'running':
      return 'primary';
    case 'skipped':
      return 'warning';
    default:
      return 'default';
  }
}

function getStatusIcon(status: ActionResultStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className='h-4 w-4' />;
    case 'failed':
      return <XCircle className='h-4 w-4' />;
    case 'running':
      return <Loader2 className='h-4 w-4 animate-spin' />;
    case 'pending':
      return <Clock className='h-4 w-4' />;
    case 'skipped':
      return <PlayCircle className='h-4 w-4' />;
    default:
      return null;
  }
}

function formatDateTime(date: Date): string {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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
