# Analytics Hooks Documentation

This document provides comprehensive documentation for the analytics hooks in the Neolith web
application.

## Overview

The analytics hooks provide a complete solution for fetching, managing, and displaying analytics
data with proper TypeScript types, error handling, loading states, and SWR/React Query patterns.

## Table of Contents

- [useAnalyticsData](#useanalyticsdata)
- [useAnalyticsComparison](#useanalyticscomparison)
- [useInsightReport](#useinsightreport)
- [useSummaryReport](#usesummaryreport)
- [useDetailedReport](#usedetailedreport)
- [useReportGeneration](#usereportgeneration)
- [useRealTimeMetrics](#userealtimemetrics)
- [useUsageMetrics](#useusagemetrics)
- [useHealthMetrics](#usehealthmetrics)
- [usePerformanceMetrics](#useperformancemetrics)
- [useCustomMetric](#usecustommetric)

---

## Analytics Data Hooks

### useAnalyticsData

Fetches comprehensive workspace analytics data with SWR caching and revalidation.

#### Usage

```tsx
import { useAnalyticsData } from '@/hooks';

function AnalyticsDashboard({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading, error, updateParams, params } = useAnalyticsData(workspaceId, {
    initialParams: {
      granularity: 'daily',
      includeTimeSeries: true,
      includeBreakdown: true,
    },
    refreshInterval: 60000, // Refresh every minute
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return null;

  return (
    <div>
      <h1>{data.workspace.name} Analytics</h1>
      <div className='summary'>
        <StatCard label='Total Messages' value={data.summary.totalMessages} />
        <StatCard label='Active Orchestrators' value={data.summary.activeOrchestrators} />
        <StatCard label='Task Completion Rate' value={`${data.taskMetrics.completionRate}%`} />
      </div>
      <TimeSeriesChart data={data.timeSeries.messageVolume} />
      <button onClick={() => updateParams({ granularity: 'weekly' })}>Switch to Weekly</button>
    </div>
  );
}
```

#### Parameters

- `workspaceId: string` - The workspace ID to fetch analytics for
- `options?: UseAnalyticsDataOptions` - Configuration options
  - `initialParams?: AnalyticsQueryParams` - Initial query parameters
  - `refreshInterval?: number` - Auto-refresh interval in milliseconds
  - `enabled?: boolean` - Whether to fetch on mount
  - ...SWR configuration options

#### Returns

- `data: AnalyticsData | null` - Analytics data
- `isLoading: boolean` - Loading state
- `isValidating: boolean` - Validation/refresh state
- `error: Error | null` - Error if any
- `refetch: () => Promise<void>` - Manually refetch data
- `updateParams: (params: Partial<AnalyticsQueryParams>) => void` - Update query parameters
- `params: AnalyticsQueryParams` - Current query parameters

#### Data Structure

```typescript
interface AnalyticsData {
  workspace: {
    id: string;
    name: string;
  };
  dateRange: {
    start: string;
    end: string;
    granularity: AnalyticsGranularity;
  };
  summary: AnalyticsSummary;
  timeSeries: {
    messageVolume: TimeSeriesPoint[];
    taskCompletion: TimeSeriesPoint[];
    workflowExecution: TimeSeriesPoint[];
    orchestratorActivity: TimeSeriesPoint[];
  };
  orchestratorActivity: OrchestratorActivityMetrics[];
  channelEngagement: ChannelEngagementMetrics[];
  taskMetrics: TaskMetricsBreakdown;
  workflowMetrics: WorkflowMetricsBreakdown;
}
```

---

### useAnalyticsComparison

Compares analytics data across time periods.

#### Usage

```tsx
import { useAnalyticsComparison } from '@/hooks';

function AnalyticsComparison({ workspaceId }: { workspaceId: string }) {
  const { comparison, isLoading, error } = useAnalyticsComparison(workspaceId, {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    granularity: 'daily',
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!comparison) return null;

  return (
    <div>
      <ComparisonCard
        label='Messages'
        current={comparison.current.summary.totalMessages}
        previous={comparison.previous.summary.totalMessages}
        change={comparison.percentChanges.messages}
      />
    </div>
  );
}
```

---

## Report Hooks

### useInsightReport

Fetches AI-powered insight reports with automated insights, trends, and recommendations.

#### Usage

```tsx
import { useInsightReport } from '@/hooks';

function InsightsDashboard({ workspaceId }: { workspaceId: string }) {
  const { report, isLoading, error } = useInsightReport(workspaceId, 'month');

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!report) return null;

  return (
    <div>
      <h2>Insights for {report.workspace.name}</h2>
      <div className='insights'>
        {report.insights.map(insight => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
      <div className='trends'>
        {report.trends.map(trend => (
          <TrendChart key={trend.metric} trend={trend} />
        ))}
      </div>
      <PerformanceScore metrics={report.performance} />
    </div>
  );
}
```

#### Parameters

- `workspaceId: string` - The workspace ID
- `period: ReportPeriod` - Report period ('day' | 'week' | 'month' | 'quarter' | 'year' | 'custom')
- `options?: SWRConfiguration` - SWR configuration options

#### Returns

- `report: InsightReport | null` - Insight report data
- `isLoading: boolean` - Loading state
- `isValidating: boolean` - Validation state
- `error: Error | null` - Error if any
- `refetch: () => Promise<void>` - Refetch report

---

### useSummaryReport

Fetches high-level summary reports for a specific period.

#### Usage

```tsx
import { useSummaryReport } from '@/hooks';

function SummaryDashboard({ workspaceId }: { workspaceId: string }) {
  const { report, isLoading, error, refetch } = useSummaryReport(workspaceId, 'week');

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!report) return null;

  return (
    <div>
      <h2>Weekly Summary</h2>
      <div className='overview'>
        <Stat label='Messages' value={report.overview.totalMessages} />
        <Stat label='Tasks' value={report.overview.totalTasks} />
        <Stat label='Workflows' value={report.overview.totalWorkflows} />
      </div>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

---

### useDetailedReport

Fetches comprehensive reports with detailed breakdowns.

#### Usage

```tsx
import { useDetailedReport } from '@/hooks';

function DetailedReportView({ workspaceId }: { workspaceId: string }) {
  const { report, isLoading, error } = useDetailedReport(
    workspaceId,
    'custom',
    '2024-01-01',
    '2024-01-31'
  );

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!report) return null;

  return (
    <div>
      <ReportHeader report={report} />
      <ChannelBreakdown channels={report.channelBreakdown} />
      <OrchestratorBreakdown orchestrators={report.orchestratorBreakdown} />
      <TaskMetrics breakdown={report.taskBreakdown} />
      <WorkflowMetrics breakdown={report.workflowBreakdown} />
    </div>
  );
}
```

---

### useReportGeneration

Generates and exports custom reports with various formats.

#### Usage

```tsx
import { useReportGeneration } from '@/hooks';

function ReportGenerator({ workspaceId }: { workspaceId: string }) {
  const { generate, exportReport, getStatus, isGenerating, error } =
    useReportGeneration(workspaceId);

  const handleGenerate = async () => {
    const reportId = await generate({
      type: 'detailed',
      period: 'month',
      format: 'pdf',
      includeCharts: true,
    });

    // Poll for completion
    const status = await getStatus(reportId);
    if (status.status === 'completed' && status.downloadUrl) {
      window.open(status.downloadUrl);
    }
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Generate Report'}
      </button>
      {error && <ErrorMessage error={error} />}
    </div>
  );
}
```

---

## Real-Time Metrics Hooks

### useRealTimeMetrics

Fetches real-time workspace metrics with WebSocket support or polling.

#### Usage

```tsx
import { useRealTimeMetrics } from '@/hooks';

function LiveMetricsDashboard({ workspaceId }: { workspaceId: string }) {
  const { metrics, isConnected, error } = useRealTimeMetrics(workspaceId, {
    useWebSocket: true,
    autoConnect: true,
  });

  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <ConnectionStatus isConnected={isConnected} />
      <MetricCard label='Online Users' value={metrics?.onlineUsers ?? 0} />
      <MetricCard label='Active Channels' value={metrics?.activeChannels ?? 0} />
      <MetricCard label='Messages/Hour' value={metrics?.messagesLastHour ?? 0} />
      <MetricCard label='Response Time' value={`${metrics?.responseTime ?? 0}ms`} />
    </div>
  );
}
```

#### Parameters

- `workspaceId: string` - The workspace ID
- `options?: UseRealTimeMetricsOptions` - Configuration options
  - `useWebSocket?: boolean` - Use WebSocket for real-time updates
  - `pollingInterval?: number` - Polling interval in milliseconds (if not using WebSocket)
  - `autoConnect?: boolean` - Auto-connect on mount

#### Returns

- `metrics: RealTimeMetrics | null` - Real-time metrics data
- `isLoading: boolean` - Loading state
- `isConnected: boolean` - Connection state
- `error: Error | null` - Error if any
- `refresh: () => Promise<void>` - Manually refresh metrics

---

### useUsageMetrics

Fetches comprehensive usage metrics with auto-refresh.

#### Usage

```tsx
import { useUsageMetrics } from '@/hooks';

function UsageOverview({ workspaceId }: { workspaceId: string }) {
  const { metrics, isLoading, error } = useUsageMetrics(workspaceId, 'month');

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!metrics) return null;

  return (
    <div className='grid'>
      <MetricCard
        title='Messages'
        value={metrics.messages.total}
        change={metrics.messages.changePercent}
      />
      <MetricCard
        title='Active Users'
        value={metrics.users.activeUsers}
        subtitle={`${metrics.users.onlineNow} online now`}
      />
      <MetricCard
        title='Task Completion'
        value={`${metrics.tasks.completionRate}%`}
        subtitle={`${metrics.tasks.completed} completed`}
      />
    </div>
  );
}
```

---

### useHealthMetrics

Monitors system health metrics including database, Redis, API performance.

#### Usage

```tsx
import { useHealthMetrics } from '@/hooks';

function SystemHealth({ workspaceId }: { workspaceId: string }) {
  const { health, isLoading, error } = useHealthMetrics(workspaceId);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!health) return null;

  return (
    <div>
      <StatusBadge status={health.status} />
      <HealthCard
        title='Database'
        status={health.database.status}
        responseTime={health.database.responseTime}
      />
      <HealthCard
        title='Redis'
        status={health.redis.status}
        responseTime={health.redis.responseTime}
      />
      <ResourceUsage cpu={health.cpu} memory={health.memory} />
    </div>
  );
}
```

---

### usePerformanceMetrics

Fetches detailed performance metrics including response times and throughput.

#### Usage

```tsx
import { usePerformanceMetrics } from '@/hooks';

function PerformanceDashboard({ workspaceId }: { workspaceId: string }) {
  const { metrics, isLoading, error } = usePerformanceMetrics(workspaceId);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!metrics) return null;

  return (
    <div>
      <ResponseTimeChart data={metrics.responseTime} />
      <ThroughputChart data={metrics.throughput} />
      <ErrorRateChart data={metrics.errors} />
      <ResourceUsageChart data={metrics.resources} />
    </div>
  );
}
```

---

### useCustomMetric

Tracks custom-defined metrics with configurable queries and aggregations.

#### Usage

```tsx
import { useCustomMetric } from '@/hooks';

function CustomMetricDisplay({ workspaceId }: { workspaceId: string }) {
  const { value, isLoading, error } = useCustomMetric(workspaceId, {
    id: 'avg-task-completion',
    name: 'Average Task Completion Time',
    query: 'tasks.completionTime',
    aggregation: 'avg',
    refreshInterval: 60000,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <MetricCard title='Avg Task Completion' value={`${value ?? 0}ms`} />;
}
```

---

## Common Patterns

### Error Handling

All hooks provide consistent error handling:

```tsx
const { data, error, isLoading } = useAnalyticsData(workspaceId);

if (error) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}
```

### Loading States

Display loading indicators while fetching:

```tsx
const { data, isLoading } = useAnalyticsData(workspaceId);

if (isLoading) {
  return <LoadingSpinner />;
}
```

### Auto-Refresh

Enable automatic refresh with intervals:

```tsx
const { data } = useAnalyticsData(workspaceId, {
  refreshInterval: 60000, // Refresh every minute
});
```

### Manual Refresh

Trigger manual refresh:

```tsx
const { data, refetch } = useAnalyticsData(workspaceId);

return <button onClick={() => refetch()}>Refresh Analytics</button>;
```

### Query Parameter Updates

Update query parameters dynamically:

```tsx
const { data, updateParams, params } = useAnalyticsData(workspaceId);

return (
  <select value={params.granularity} onChange={e => updateParams({ granularity: e.target.value })}>
    <option value='hourly'>Hourly</option>
    <option value='daily'>Daily</option>
    <option value='weekly'>Weekly</option>
    <option value='monthly'>Monthly</option>
  </select>
);
```

---

## Best Practices

1. **Use TypeScript**: All hooks are fully typed for excellent IDE support
2. **Handle Loading States**: Always show loading indicators
3. **Handle Errors Gracefully**: Display user-friendly error messages
4. **Optimize Refresh Intervals**: Balance freshness with performance
5. **Use SWR Features**: Leverage caching, deduplication, and revalidation
6. **Memoize Callbacks**: Prevent unnecessary re-renders
7. **Clean Up**: Hooks handle cleanup automatically
8. **Enable/Disable Fetching**: Use `enabled` option to control when data fetches

---

## Performance Considerations

- **SWR Caching**: Data is cached and shared across components
- **Deduplication**: Multiple components using the same hook share requests
- **Revalidation**: Smart revalidation on focus and reconnect
- **WebSocket Support**: Real-time metrics use WebSocket when available
- **Polling Intervals**: Configurable for different update frequencies
- **Conditional Fetching**: Use `enabled` option to prevent unnecessary requests

---

## Migration Guide

### From Old Analytics Hook

```tsx
// Old
const { data, isLoading, error } = useAnalytics(workspaceId, { period: 'month' });

// New - More features and better types
const { data, isLoading, error, updateParams } = useAnalyticsData(workspaceId, {
  initialParams: { granularity: 'daily' },
  refreshInterval: 60000,
});
```

### From Old Metrics Hook

```tsx
// Old
const { metrics, isLoading } = useMetrics(workspaceId, 'month');

// New - Real-time support
const { metrics, isLoading, isConnected } = useRealTimeMetrics(workspaceId, {
  useWebSocket: true,
});
```

---

## Support

For issues or questions:

- Check the TypeScript types for detailed documentation
- Review example usage patterns above
- Contact the frontend team for assistance
