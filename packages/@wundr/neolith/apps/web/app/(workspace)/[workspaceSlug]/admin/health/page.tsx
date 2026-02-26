'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageHeader } from '@/contexts/page-header-context';
import {
  useHealthDashboard,
  useOrchestratorHealthList,
  useMetricsChart,
  useHealthAlerts,
} from '@/hooks/use-health-dashboard';

import { AlertsPanel } from './components/AlertsPanel';
import { MetricsCharts } from './components/MetricsCharts';
import { OrchestratorList } from './components/OrchestratorList';
import { SystemOverview } from './components/SystemOverview';

/**
 * Health Dashboard Page
 *
 * Comprehensive observability and monitoring dashboard for the Neolith platform.
 * Displays real-time health metrics, orchestrator status, performance charts,
 * and active alerts.
 */
export default function HealthDashboardPage() {
  const { overview, error, isLoading, refetch } = useHealthDashboard();
  const { orchestrators } = useOrchestratorHealthList();
  const { chartData } = useMetricsChart();
  const { alerts } = useHealthAlerts();
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      'Health Dashboard',
      'Monitor orchestrator health and system performance'
    );
  }, [setPageHeader]);

  // Loading state
  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className='p-6'>
                <Skeleton className='h-20 w-full' />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className='h-96 w-full' />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className='space-y-6'>
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            Failed to load health dashboard data. Please try again.
          </AlertDescription>
        </Alert>
        <Button onClick={refetch} variant='outline'>
          <RefreshCw className='mr-2 h-4 w-4' />
          Retry
        </Button>
      </div>
    );
  }

  // No data state
  if (!overview) {
    return (
      <div className='space-y-6'>
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            No health data available. The monitoring system may not be
            configured yet.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Transform orchestrator data to match expected format
  const orchestratorData = orchestrators.map(orch => ({
    id: orch.id,
    name: orch.name,
    status: orch.status as 'online' | 'offline' | 'error' | 'degraded',
    sessions: orch.activeTasks,
    tokenBudget: {
      used: Math.floor(orch.cpuUsage * 100),
      limit: 10000,
      percent: orch.cpuUsage,
    },
    lastActivity: orch.lastHeartbeat.toISOString(),
    responseTime: orch.responseTime,
    errorCount: orch.errorCount,
  }));

  // Transform metrics data
  const metricsData = {
    sessions: chartData.map(d => ({
      timestamp: d.time,
      value: d.requests,
    })),
    tokens: chartData.map(d => ({
      timestamp: d.time,
      value: d.requests * 100,
    })),
    latency: {
      p50: chartData.map(d => ({
        timestamp: d.time,
        value: d.responseTime * 0.5,
      })),
      p95: chartData.map(d => ({
        timestamp: d.time,
        value: d.responseTime * 0.95,
      })),
      p99: chartData.map(d => ({ timestamp: d.time, value: d.responseTime })),
    },
    errors: chartData.map(d => ({
      timestamp: d.time,
      value: d.errors,
    })),
  };

  // Transform alerts data - cast to HealthAlert[] for type compatibility
  const alertData = alerts.map(alert => ({
    id: alert.id,
    severity: alert.severity,
    type: alert.type as
      | 'budget_exhaustion'
      | 'high_error_rate'
      | 'session_failure'
      | 'latency_spike'
      | 'node_unhealthy',
    message: alert.message,
    timestamp: alert.createdAt.toISOString(),
    acknowledged: alert.acknowledged,
    orchestratorId: alert.orchestratorId,
  }));

  // Transform overview data
  const overviewData = {
    activeOrchestrators: overview.healthyOrchestrators,
    totalSessions: overview.totalOrchestrators,
    tokenUsage: {
      hourly: overview.tokenUsageHourly ?? 0,
      daily: overview.tokenUsageDaily ?? 0,
      monthly: overview.tokenUsageMonthly ?? 0,
      limit: overview.tokenUsageLimit ?? 0,
      percentUsed: overview.tokenUsagePercent ?? 0,
    },
    errorRate: 100 - overview.uptime,
    uptime: overview.uptimeMs ?? 0,
  };

  return (
    <div className='space-y-6'>
      {/* Refresh control */}
      <div className='flex items-center justify-end space-x-2'>
        <span className='text-sm text-muted-foreground'>
          Last updated: {overview.lastUpdated.toLocaleTimeString()}
        </span>
        <Button
          variant='outline'
          size='sm'
          onClick={refetch}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* System Overview */}
      <SystemOverview data={overviewData} />

      {/* Orchestrators List */}
      <OrchestratorList orchestrators={orchestratorData} />

      {/* Metrics Charts */}
      <MetricsCharts data={metricsData} />

      {/* Alerts Panel */}
      <AlertsPanel alerts={alertData} />

      {/* Auto-refresh indicator */}
      <div className='flex items-center justify-center'>
        <p className='text-xs text-muted-foreground'>
          Auto-refreshing every 30 seconds
        </p>
      </div>
    </div>
  );
}
