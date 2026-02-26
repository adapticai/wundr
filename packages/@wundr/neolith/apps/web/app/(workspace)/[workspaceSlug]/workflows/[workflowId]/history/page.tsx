'use client';

import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ExecutionHistory } from '@/components/workflow/execution-history';
import { usePageHeader } from '@/contexts/page-header-context';
import { useWorkflow, useWorkflowExecutions } from '@/hooks/use-workflows';

import type { WorkflowExecution } from '@/types/workflow';

// =============================================================================
// Main Page Component
// =============================================================================

export default function WorkflowHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = (params?.workspaceSlug ?? '') as string;
  const workflowId = (params?.workflowId ?? '') as string;
  const { setPageHeader } = usePageHeader();

  // Hooks
  const {
    workflow,
    isLoading: workflowLoading,
    error: workflowError,
  } = useWorkflow(workspaceId, workflowId);

  const {
    executions,
    isLoading: executionsLoading,
    error: executionsError,
    refetch: refetchExecutions,
  } = useWorkflowExecutions(workspaceId, workflowId);

  // Set page header
  useEffect(() => {
    if (workflow) {
      setPageHeader(
        `${workflow.name} - Execution History`,
        'View detailed logs and execution history for this workflow'
      );
    }
  }, [workflow, setPageHeader]);

  // Export handler
  const handleExport = useCallback(
    (executions: WorkflowExecution[]) => {
      const exportData = {
        workflowId,
        workflowName: workflow?.name,
        exportedAt: new Date().toISOString(),
        executionCount: executions.length,
        executions: executions.map(execution => ({
          id: execution.id,
          status: execution.status,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          duration: execution.duration,
          triggeredBy: execution.triggeredBy,
          actionResults: execution.actionResults,
          triggerData: execution.triggerData,
          error: execution.error,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-${workflowId}-history-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [workflow, workflowId]
  );

  // Loading State
  if (workflowLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-4'>
          <div className='h-10 w-10 animate-pulse rounded-md bg-muted' />
          <div className='flex-1'>
            <div className='h-8 w-64 animate-pulse rounded bg-muted' />
            <div className='mt-2 h-4 w-96 animate-pulse rounded bg-muted' />
          </div>
        </div>
        <div className='h-96 animate-pulse rounded-lg border bg-muted' />
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
          <p className='font-medium text-red-800 dark:text-red-200'>
            {workflowError?.message || 'Workflow not found'}
          </p>
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

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Link
            href={`/${workspaceId}/workflows/${workflowId}`}
            className='rounded-md p-2 hover:bg-accent'
            aria-label='Back to workflow details'
          >
            <ArrowLeft className='h-5 w-5' />
          </Link>
          <div>
            <h1 className='text-2xl font-bold'>{workflow.name}</h1>
            <p className='text-sm text-muted-foreground'>Execution History</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            onClick={() => handleExport(executions)}
            disabled={executions.length === 0}
          >
            <Download className='mr-2 h-4 w-4' />
            Export All
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {executionsError && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'>
          <p className='text-sm text-red-800 dark:text-red-200'>
            Failed to load execution history: {executionsError.message}
          </p>
        </div>
      )}

      {/* Stats Summary (shown above table when data is available) */}
      {!executionsLoading && executions.length > 0 && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <StatsCard
            label='Total Executions'
            value={executions.length}
            trend={null}
          />
          <StatsCard
            label='Successful'
            value={executions.filter(e => e.status === 'completed').length}
            trend='positive'
          />
          <StatsCard
            label='Failed'
            value={executions.filter(e => e.status === 'failed').length}
            trend='negative'
          />
          <StatsCard
            label='Avg Duration'
            value={calculateAverageDuration(executions)}
            trend={null}
            isTime
          />
        </div>
      )}

      {/* Execution History Table */}
      <ExecutionHistory
        executions={executions}
        isLoading={executionsLoading}
        onRefresh={refetchExecutions}
        onExport={handleExport}
      />
    </div>
  );
}

// =============================================================================
// Stats Card Component
// =============================================================================

interface StatsCardProps {
  label: string;
  value: number | string;
  trend: 'positive' | 'negative' | null;
  isTime?: boolean;
}

function StatsCard({ label, value, trend, isTime = false }: StatsCardProps) {
  const displayValue =
    isTime && typeof value === 'number' ? formatDuration(value) : value;

  return (
    <div className='rounded-lg border bg-card p-6'>
      <p className='text-sm text-muted-foreground'>{label}</p>
      <div className='mt-2 flex items-baseline gap-2'>
        <p className='text-3xl font-bold'>{displayValue}</p>
        {trend === 'positive' && (
          <span className='text-sm font-medium text-green-600 dark:text-green-400'>
            Good
          </span>
        )}
        {trend === 'negative' && value !== 0 && (
          <span className='text-sm font-medium text-red-600 dark:text-red-400'>
            Attention
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

function calculateAverageDuration(executions: WorkflowExecution[]): number {
  const completedExecutions = executions.filter(
    e => e.status === 'completed' && e.duration
  );

  if (completedExecutions.length === 0) {
    return 0;
  }

  const totalDuration = completedExecutions.reduce(
    (sum, e) => sum + (e.duration || 0),
    0
  );

  return Math.round(totalDuration / completedExecutions.length);
}

function formatDuration(ms: number): string {
  if (ms === 0) {
    return '0ms';
  }
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
