'use client';

import { useHealthDashboard } from '@/hooks/use-health-dashboard';
import { SystemOverview } from './components/SystemOverview';
import { OrchestratorList } from './components/OrchestratorList';
import { MetricsCharts } from './components/MetricsCharts';
import { AlertsPanel } from './components/AlertsPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Health Dashboard Page
 *
 * Comprehensive observability and monitoring dashboard for the Neolith platform.
 * Displays real-time health metrics, orchestrator status, performance charts,
 * and active alerts.
 */
export default function HealthDashboardPage() {
  const { data, error, isLoading, mutate } = useHealthDashboard();

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Health Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Monitor orchestrator health and system performance
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load health dashboard data. Please try again.
          </AlertDescription>
        </Alert>
        <Button onClick={() => mutate()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Health Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Monitor orchestrator health and system performance
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No health data available. The monitoring system may not be configured.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Health Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Monitor orchestrator health and system performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <SystemOverview data={data.overview} />

      {/* Orchestrators List */}
      <OrchestratorList orchestrators={data.orchestrators} />

      {/* Metrics Charts */}
      <MetricsCharts data={data.metrics} />

      {/* Alerts Panel */}
      <AlertsPanel alerts={data.alerts} />

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center">
        <p className="text-xs text-muted-foreground">
          Auto-refreshing every {(data.config.refreshInterval / 1000).toFixed(0)} seconds
        </p>
      </div>
    </div>
  );
}
