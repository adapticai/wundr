'use client';

import { ArrowLeft, Download, Calendar, Info } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkflowAnalytics } from '@/components/workflow/workflow-analytics';
import { usePageHeader } from '@/contexts/page-header-context';
import { useWorkflow, useWorkflowExecutions } from '@/hooks/use-workflows';

/**
 * Workflow Analytics Page
 *
 * Displays comprehensive analytics and insights for workflow executions.
 * Features:
 * - Real-time metrics and KPIs
 * - Interactive charts and visualizations
 * - Time range filtering
 * - Data export capabilities
 * - Error analysis and action performance tracking
 */
export default function WorkflowAnalyticsPage() {
  const params = useParams();
  const workspaceId = (params?.workspaceSlug ?? '') as string;
  const workflowId = (params?.workflowId ?? '') as string;
  const { setPageHeader } = usePageHeader();

  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'all'>(
    'week'
  );

  // Fetch workflow data
  const {
    workflow,
    isLoading: workflowLoading,
    error: workflowError,
  } = useWorkflow(workspaceId, workflowId);

  // Fetch execution data
  const {
    executions,
    isLoading: executionsLoading,
    error: executionsError,
    refetch: refetchExecutions,
  } = useWorkflowExecutions(workspaceId, workflowId, { limit: 1000 });

  // Set page header
  useEffect(() => {
    if (workflow) {
      setPageHeader(
        workflow.name,
        'Performance metrics and execution insights'
      );
    }
  }, [workflow, setPageHeader]);

  // Export analytics data
  const handleExportAnalytics = useCallback(() => {
    if (!workflow || !executions) {
      return;
    }

    // Calculate metrics for export
    const totalExecutions = executions.length;
    const completedExecutions = executions.filter(
      e => e.status === 'completed'
    ).length;
    const failedExecutions = executions.filter(
      e => e.status === 'failed'
    ).length;
    const successRate =
      totalExecutions > 0
        ? Math.round((completedExecutions / totalExecutions) * 100)
        : 0;

    const avgDuration =
      completedExecutions > 0
        ? Math.round(
            executions
              .filter(e => e.status === 'completed' && e.duration)
              .reduce((sum, e) => sum + (e.duration || 0), 0) /
              completedExecutions
          )
        : 0;

    // Group errors by type
    const errorBreakdown = new Map<string, number>();
    executions.forEach(execution => {
      execution.actionResults.forEach(result => {
        if (result.status === 'failed' && result.error) {
          const errorType = result.actionType;
          errorBreakdown.set(
            errorType,
            (errorBreakdown.get(errorType) || 0) + 1
          );
        }
      });
    });

    const exportData = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      exportedAt: new Date().toISOString(),
      timeRange,
      summary: {
        totalExecutions,
        completedExecutions,
        failedExecutions,
        successRate: `${successRate}%`,
        avgExecutionTime: avgDuration,
      },
      errorBreakdown: Object.fromEntries(errorBreakdown),
      executions: executions.map(execution => ({
        id: execution.id,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        duration: execution.duration,
        actionResults: execution.actionResults.map(result => ({
          actionType: result.actionType,
          status: result.status,
          duration: result.duration,
          error: result.error,
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${workflowId}-analytics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [workflow, executions, workflowId, timeRange]);

  // Loading state
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

  // Error state
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
    <div className='p-4 md:p-6 space-y-6'>
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
            <p className='text-sm text-muted-foreground'>
              Performance Analytics & Insights
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          {/* Time Range Filter */}
          <Select
            value={timeRange}
            onValueChange={value =>
              setTimeRange(value as 'day' | 'week' | 'month' | 'all')
            }
          >
            <SelectTrigger className='w-[140px]'>
              <Calendar className='mr-2 h-4 w-4' />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='day'>Last 24 Hours</SelectItem>
              <SelectItem value='week'>Last 7 Days</SelectItem>
              <SelectItem value='month'>Last 30 Days</SelectItem>
              <SelectItem value='all'>All Time</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant='outline'
            onClick={() => refetchExecutions()}
            disabled={executionsLoading}
          >
            Refresh
          </Button>

          {/* Export Button */}
          <Button
            variant='outline'
            onClick={handleExportAnalytics}
            disabled={executions.length === 0}
          >
            <Download className='mr-2 h-4 w-4' />
            Export
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {executionsError && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'>
          <p className='text-sm text-red-800 dark:text-red-200'>
            Failed to load execution data: {executionsError.message}
          </p>
        </div>
      )}

      {/* Analytics Dashboard */}
      <WorkflowAnalytics
        executions={executions}
        triggerType={workflow.trigger.type}
        isLoading={executionsLoading}
        timeRange={timeRange}
      />

      {/* Additional Info */}
      {executions.length > 0 && (
        <div className='rounded-lg border bg-muted/50 p-4'>
          <div className='flex items-start gap-2'>
            <Info
              className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground'
              aria-hidden='true'
            />
            <p className='text-sm text-muted-foreground'>
              Showing aggregated metrics from{' '}
              <span className='font-medium text-foreground'>
                {executions.length} execution
                {executions.length !== 1 ? 's' : ''}
              </span>
              . Use the time range filter to focus on specific periods, or
              export the data for deeper analysis in external tools.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
