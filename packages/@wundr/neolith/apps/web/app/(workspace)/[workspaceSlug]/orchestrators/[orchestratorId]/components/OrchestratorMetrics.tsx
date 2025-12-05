/**
 * OrchestratorMetrics Component
 *
 * Displays real-time performance metrics for an orchestrator
 * @module components/orchestrator/OrchestratorMetrics
 */

'use client';

import React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  useOrchestratorAnalytics,
  useSessionManagerMetrics,
} from '@/hooks/use-orchestrator-analytics';

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className='border rounded-lg p-4'>
      <p className='text-xs text-muted-foreground mb-1'>{label}</p>
      <p className='text-2xl font-bold'>{value}</p>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className='border rounded-lg p-4 animate-pulse'>
      <div className='h-3 bg-muted rounded w-1/2 mb-2' />
      <div className='h-8 bg-muted rounded w-3/4' />
    </div>
  );
}

interface OrchestratorPerformanceMetricsProps {
  orchestratorId: string;
}

/**
 * Displays real-time performance metrics from analytics data
 */
export function OrchestratorPerformanceMetrics({
  orchestratorId,
}: OrchestratorPerformanceMetricsProps) {
  const { metrics, isLoading } = useOrchestratorAnalytics(orchestratorId, '7d');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
        <CardDescription>
          Real-time performance data from the last 7 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            {[1, 2, 3, 4].map(i => (
              <MetricSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <MetricCard
              label='Tasks Completed'
              value={metrics?.tasksCompleted.toString() || '0'}
            />
            <MetricCard
              label='Success Rate'
              value={`${metrics?.successRate || 0}%`}
            />
            <MetricCard
              label='Avg Response Time'
              value={
                metrics?.avgDurationMinutes
                  ? `${metrics.avgDurationMinutes}min`
                  : 'N/A'
              }
            />
            <MetricCard
              label='Active Tasks'
              value={metrics?.tasksInProgress.toString() || '0'}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SessionManagerOverviewMetricsProps {
  orchestratorId: string;
}

/**
 * Displays session manager metrics for an orchestrator
 */
export function SessionManagerOverviewMetrics({
  orchestratorId,
}: SessionManagerOverviewMetricsProps) {
  const { metrics, isLoading } = useSessionManagerMetrics(orchestratorId);

  return (
    <>
      {isLoading ? (
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          {[1, 2, 3, 4].map(i => (
            <MetricSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <MetricCard
            label='Total Session Managers'
            value={metrics?.totalSessionManagers.toString() || '0'}
          />
          <MetricCard
            label='Active Sessions'
            value={metrics?.activeSessions.toString() || '0'}
          />
          <MetricCard
            label='Total Subagents'
            value={metrics?.totalSubagents.toString() || '0'}
          />
          <MetricCard
            label='Token Budget/hr'
            value={
              metrics?.totalTokenBudgetPerHour
                ? metrics.totalTokenBudgetPerHour.toLocaleString()
                : '0'
            }
          />
        </div>
      )}
    </>
  );
}
