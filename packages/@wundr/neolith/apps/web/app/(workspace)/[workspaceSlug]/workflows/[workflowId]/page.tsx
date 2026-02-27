'use client';

import {
  ArrowLeft,
  Play,
  Pause,
  Trash2,
  Edit,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';
import { useWorkflow, useWorkflowExecutions } from '@/hooks/use-workflows';
import { cn } from '@/lib/utils';
import {
  WORKFLOW_STATUS_CONFIG,
  TRIGGER_TYPE_CONFIG,
  ACTION_TYPE_CONFIG,
  EXECUTION_STATUS_CONFIG,
} from '@/types/workflow';

import type { WorkflowExecution, ActionConfig } from '@/types/workflow';

// =============================================================================
// Main Page Component
// =============================================================================

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = (params?.workspaceSlug ?? '') as string;
  const workflowId = (params?.workflowId ?? '') as string;
  const { setPageHeader } = usePageHeader();

  // State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Hooks
  const {
    workflow,
    isLoading: workflowLoading,
    error: workflowError,
    activateWorkflow,
    deactivateWorkflow,
    executeWorkflow,
    deleteWorkflow,
    refetch,
  } = useWorkflow(workspaceId, workflowId);

  const {
    executions,
    isLoading: executionsLoading,
    error: executionsError,
    hasMore,
    loadMore,
    cancelExecution,
    refetch: refetchExecutions,
  } = useWorkflowExecutions(workspaceId, workflowId);

  // Set page header
  useEffect(() => {
    if (workflow) {
      setPageHeader(workflow.name, workflow.description);
    }
  }, [workflow, setPageHeader]);

  // Handlers
  const handleToggleStatus = useCallback(async () => {
    if (!workflow) {
      return;
    }

    if (workflow.status === 'active') {
      const success = await deactivateWorkflow();
      if (success) {
        refetch();
      }
    } else {
      const success = await activateWorkflow();
      if (success) {
        refetch();
      }
    }
  }, [workflow, activateWorkflow, deactivateWorkflow, refetch]);

  const handleExecute = useCallback(async () => {
    setIsExecuting(true);
    try {
      const execution = await executeWorkflow(false);
      if (execution) {
        refetchExecutions();
      }
    } finally {
      setIsExecuting(false);
    }
  }, [executeWorkflow, refetchExecutions]);

  const handleDelete = useCallback(async () => {
    const success = await deleteWorkflow();
    if (success) {
      router.push(`/${workspaceId}/workflows`);
    }
  }, [deleteWorkflow, router, workspaceId]);

  const handleEdit = useCallback(() => {
    router.push(`/${workspaceId}/workflows/${workflowId}/edit`);
  }, [router, workspaceId, workflowId]);

  // Loading State
  if (workflowLoading) {
    return (
      <div className='space-y-6'>
        <WorkflowHeaderSkeleton />
        <div className='grid gap-6 lg:grid-cols-3'>
          <div className='lg:col-span-2'>
            <WorkflowContentSkeleton />
          </div>
          <div>
            <WorkflowSidebarSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (workflowError || !workflow) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-4'>
          <Link
            href={`/${workspaceId}/workflows`}
            className='rounded-md p-2 hover:bg-accent'
            aria-label='Back to workflows list'
          >
            <ArrowLeft className='h-5 w-5' />
          </Link>
          <h1 className='text-2xl font-bold'>Workflow Not Found</h1>
        </div>
        <div
          className='rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20'
          role='alert'
        >
          <div className='flex items-center gap-2 text-red-800 dark:text-red-200'>
            <AlertCircle className='h-5 w-5' aria-hidden='true' />
            <p className='font-medium'>
              {workflowError?.message || 'Workflow not found'}
            </p>
          </div>
          <p className='mt-2 text-sm text-red-600 dark:text-red-300'>
            The workflow you&apos;re looking for doesn&apos;t exist or you
            don&apos;t have permission to view it.
          </p>
          <Link
            href={`/${workspaceId}/workflows`}
            className='mt-4 inline-block text-sm font-medium text-red-800 hover:text-red-900 dark:text-red-200'
          >
            Back to Workflows
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = WORKFLOW_STATUS_CONFIG[workflow.status];
  const triggerConfig = TRIGGER_TYPE_CONFIG[workflow.trigger.type];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Link
            href={`/${workspaceId}/workflows`}
            className='rounded-md p-2 hover:bg-accent'
          >
            <ArrowLeft className='h-5 w-5' />
          </Link>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Actions */}
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={handleExecute}
            disabled={
              isExecuting ||
              workflow.status === 'archived' ||
              workflow.status === 'inactive'
            }
            className='inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
            aria-label={
              isExecuting ? 'Executing workflow' : 'Execute workflow now'
            }
          >
            {isExecuting ? (
              <RefreshCw className='h-4 w-4 animate-spin' aria-hidden='true' />
            ) : (
              <Play className='h-4 w-4' aria-hidden='true' />
            )}
            {isExecuting ? 'Executing...' : 'Execute'}
          </button>
          <button
            type='button'
            onClick={handleToggleStatus}
            className='inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent'
            aria-label={
              workflow.status === 'active'
                ? 'Deactivate workflow'
                : 'Activate workflow'
            }
          >
            {workflow.status === 'active' ? (
              <>
                <Pause className='h-4 w-4' aria-hidden='true' />
                Deactivate
              </>
            ) : (
              <>
                <CheckCircle className='h-4 w-4' aria-hidden='true' />
                Activate
              </>
            )}
          </button>
          <button
            type='button'
            onClick={handleEdit}
            className='inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent'
            aria-label='Edit workflow'
          >
            <Edit className='h-4 w-4' aria-hidden='true' />
            Edit
          </button>
          <button
            type='button'
            onClick={() => setShowDeleteModal(true)}
            className='inline-flex items-center gap-2 rounded-md border border-red-200 bg-background px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20'
            aria-label='Delete workflow'
          >
            <Trash2 className='h-4 w-4' aria-hidden='true' />
            Delete
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className='grid gap-6 lg:grid-cols-3'>
        {/* Workflow Details */}
        <div className='space-y-6 lg:col-span-2'>
          {/* Trigger Section */}
          <div className='rounded-lg border bg-card p-6'>
            <h2 className='mb-4 text-lg font-semibold'>Trigger</h2>
            <div className='flex items-start gap-3 rounded-lg bg-muted/50 p-4'>
              <div className='rounded-md bg-primary/10 p-2'>
                <TriggerIcon className='h-5 w-5 text-primary' />
              </div>
              <div>
                <h3 className='font-medium'>{triggerConfig.label}</h3>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {triggerConfig.description}
                </p>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className='rounded-lg border bg-card p-6'>
            <h2 className='mb-4 text-lg font-semibold'>
              Actions ({workflow.actions.length})
            </h2>
            {workflow.actions.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                No actions configured.
              </p>
            ) : (
              <div className='space-y-3'>
                {workflow.actions.map((action, index) => (
                  <ActionStep
                    key={action.id}
                    action={action}
                    index={index}
                    isLast={index === workflow.actions.length - 1}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Execution History Section */}
          <div className='rounded-lg border bg-card p-6'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-lg font-semibold'>Execution History</h2>
              <button
                type='button'
                onClick={() => refetchExecutions()}
                className='text-sm text-primary hover:text-primary/80'
              >
                Refresh
              </button>
            </div>

            {executionsError && (
              <div className='mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'>
                <p className='text-sm text-red-800 dark:text-red-200'>
                  Failed to load execution history
                </p>
              </div>
            )}

            {executionsLoading && executions.length === 0 ? (
              <div className='space-y-3'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className='h-24 animate-pulse rounded-lg bg-muted'
                  />
                ))}
              </div>
            ) : executions.length === 0 ? (
              <div className='py-8 text-center'>
                <Clock className='mx-auto h-12 w-12 text-muted-foreground' />
                <h3 className='mt-4 text-lg font-semibold'>
                  No Executions Yet
                </h3>
                <p className='mt-2 text-sm text-muted-foreground'>
                  This workflow hasn&apos;t been executed yet. Click the Execute
                  button above to run it.
                </p>
              </div>
            ) : (
              <>
                <div className='space-y-3'>
                  {executions.map(execution => (
                    <ExecutionItem
                      key={execution.id}
                      execution={execution}
                      onCancel={cancelExecution}
                    />
                  ))}
                </div>
                {hasMore && (
                  <button
                    type='button'
                    onClick={loadMore}
                    className='mt-4 w-full rounded-md border border-border py-2 text-sm hover:bg-accent'
                  >
                    Load More
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Statistics */}
          <div className='rounded-lg border bg-card p-6'>
            <h2 className='mb-4 text-lg font-semibold'>Statistics</h2>
            <div className='space-y-4'>
              <div>
                <p className='text-sm text-muted-foreground'>Total Runs</p>
                <p className='text-2xl font-bold'>{workflow.runCount}</p>
              </div>
              <div>
                <p className='text-sm text-muted-foreground'>Error Count</p>
                <p className='text-2xl font-bold text-red-600'>
                  {workflow.errorCount}
                </p>
              </div>
              <div>
                <p className='text-sm text-muted-foreground'>Success Rate</p>
                <p className='text-2xl font-bold'>
                  {workflow.runCount > 0
                    ? `${Math.round(((workflow.runCount - workflow.errorCount) / workflow.runCount) * 100)}%`
                    : 'N/A'}
                </p>
              </div>
              {workflow.lastRunAt && (
                <div>
                  <p className='text-sm text-muted-foreground'>Last Run</p>
                  <p className='text-sm font-medium'>
                    {new Date(workflow.lastRunAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className='rounded-lg border bg-card p-6'>
            <h2 className='mb-4 text-lg font-semibold'>Details</h2>
            <div className='space-y-3 text-sm'>
              <div>
                <p className='text-muted-foreground'>Created</p>
                <p className='font-medium'>
                  {new Date(workflow.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground'>Last Updated</p>
                <p className='font-medium'>
                  {new Date(workflow.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground'>Workflow ID</p>
                <p className='font-mono text-xs'>{workflow.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmationModal
          workflowName={workflow.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Action Step Component
// =============================================================================

interface ActionStepProps {
  action: ActionConfig;
  index: number;
  isLast: boolean;
}

function ActionStep({ action, index, isLast }: ActionStepProps) {
  const actionConfig = ACTION_TYPE_CONFIG[action.type];

  return (
    <div className='relative'>
      <div className='flex items-start gap-3'>
        <div className='flex flex-col items-center'>
          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground'>
            {index + 1}
          </div>
          {!isLast && (
            <div
              className='h-full w-0.5 flex-1 bg-border'
              style={{ minHeight: '40px' }}
            />
          )}
        </div>
        <div className='flex-1 rounded-lg bg-muted/50 p-4'>
          <div className='flex items-center gap-2'>
            <ActionIcon className='h-4 w-4 text-muted-foreground' />
            <h3 className='font-medium'>{actionConfig.label}</h3>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            {actionConfig.description}
          </p>
          {action.errorHandling && (
            <div className='mt-2 text-xs text-muted-foreground'>
              Error handling: {action.errorHandling.onError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Execution Item Component
// =============================================================================

interface ExecutionItemProps {
  execution: WorkflowExecution;
  onCancel: (executionId: string) => Promise<boolean>;
}

function ExecutionItem({ execution, onCancel }: ExecutionItemProps) {
  const statusConfig = EXECUTION_STATUS_CONFIG[execution.status];
  const [isCanceling, setIsCanceling] = useState(false);

  const handleCancel = async () => {
    setIsCanceling(true);
    try {
      await onCancel(execution.id);
    } finally {
      setIsCanceling(false);
    }
  };

  const StatusIcon = {
    pending: Clock,
    running: RefreshCw,
    completed: CheckCircle,
    failed: XCircle,
    cancelled: XCircle,
  }[execution.status];

  return (
    <div className='rounded-lg border border-border p-4'>
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-2'>
          <StatusIcon
            className={cn(
              'h-4 w-4',
              execution.status === 'running' && 'animate-spin',
              statusConfig.color
            )}
          />
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {statusConfig.label}
          </span>
        </div>
        <span className='text-xs text-muted-foreground'>
          {new Date(execution.startedAt).toLocaleString()}
        </span>
      </div>

      <div className='mt-3 space-y-1 text-sm'>
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground'>Actions:</span>
          <span className='font-medium'>
            {
              execution.actionResults.filter(a => a.status === 'completed')
                .length
            }
            /{execution.actionResults.length} completed
          </span>
        </div>
        {execution.duration && (
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Duration:</span>
            <span className='font-medium'>{execution.duration}ms</span>
          </div>
        )}
      </div>

      {execution.error && (
        <div className='mt-3 rounded-md bg-red-50 p-2 dark:bg-red-900/20'>
          <p className='text-xs text-red-600 dark:text-red-400'>
            {execution.error}
          </p>
        </div>
      )}

      {execution.status === 'running' && (
        <button
          type='button'
          onClick={handleCancel}
          disabled={isCanceling}
          className='mt-3 text-xs text-red-600 hover:text-red-700 disabled:opacity-50'
        >
          {isCanceling ? 'Canceling...' : 'Cancel Execution'}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Delete Confirmation Modal
// =============================================================================

interface DeleteConfirmationModalProps {
  workflowName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmationModal({
  workflowName,
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='w-full max-w-md rounded-lg bg-background p-6'>
        <div className='flex items-center gap-3'>
          <div className='rounded-full bg-red-100 p-3 dark:bg-red-900/30'>
            <AlertCircle className='h-6 w-6 text-red-600' />
          </div>
          <div>
            <h2 className='text-lg font-semibold'>Delete Workflow</h2>
            <p className='text-sm text-muted-foreground'>
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className='mt-4 rounded-lg border border-border bg-muted/50 p-4'>
          <p className='text-sm'>
            Are you sure you want to delete <strong>{workflowName}</strong>?
          </p>
          <p className='mt-2 text-sm text-muted-foreground'>
            All execution history and configuration will be permanently removed.
          </p>
        </div>

        <div className='mt-6 flex justify-end gap-3'>
          <button
            type='button'
            onClick={onCancel}
            disabled={isDeleting}
            className='rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={isDeleting}
            className='rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
          >
            {isDeleting ? 'Deleting...' : 'Delete Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Skeleton Components
// =============================================================================

function WorkflowHeaderSkeleton() {
  return (
    <div className='flex items-start justify-between'>
      <div className='flex-1'>
        <div className='flex items-center gap-4'>
          <div className='h-9 w-9 animate-pulse rounded-md bg-muted' />
          <div>
            <div className='h-8 w-64 animate-pulse rounded bg-muted' />
            <div className='mt-2 h-4 w-96 animate-pulse rounded bg-muted' />
          </div>
        </div>
      </div>
      <div className='flex gap-2'>
        <div className='h-9 w-24 animate-pulse rounded-md bg-muted' />
        <div className='h-9 w-28 animate-pulse rounded-md bg-muted' />
        <div className='h-9 w-20 animate-pulse rounded-md bg-muted' />
        <div className='h-9 w-24 animate-pulse rounded-md bg-muted' />
      </div>
    </div>
  );
}

function WorkflowContentSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='animate-pulse rounded-lg border bg-card p-6'>
        <div className='mb-4 h-6 w-32 rounded bg-muted' />
        <div className='h-24 rounded-lg bg-muted' />
      </div>
      <div className='animate-pulse rounded-lg border bg-card p-6'>
        <div className='mb-4 h-6 w-40 rounded bg-muted' />
        <div className='space-y-3'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='h-20 rounded-lg bg-muted' />
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowSidebarSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='animate-pulse rounded-lg border bg-card p-6'>
        <div className='mb-4 h-6 w-32 rounded bg-muted' />
        <div className='space-y-4'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className='h-4 w-24 rounded bg-muted' />
              <div className='mt-1 h-8 w-full rounded bg-muted' />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function TriggerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2' />
    </svg>
  );
}

function ActionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <polyline points='9 11 12 14 22 4' />
      <path d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' />
    </svg>
  );
}
