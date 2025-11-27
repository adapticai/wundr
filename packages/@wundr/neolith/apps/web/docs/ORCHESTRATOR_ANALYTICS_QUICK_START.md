# Orchestrator Analytics Quick Start Guide

## Quick Implementation Guide

### 1. Display Analytics in Orchestrator Dashboard

```tsx
// In your Orchestrator dashboard page
import { VPAnalyticsCard } from '@/components/orchestrator/orchestrator-analytics-card';

export default function VPDashboardPage({ params }: { params: { id: string } }) {
  return (
    <div className="container py-6">
      <h1>VP Dashboard</h1>

      {/* Add analytics card */}
      <Orchestrator AnalyticsCard
        vpId={params.id}
        timeRange="7d"
        className="mt-4"
      />
    </div>
  );
}
```

### 2. Fetch Analytics Data Programmatically

```typescript
// Client-side fetch
async function loadAnalytics(vpId: string) {
  const response = await fetch(`/api/orchestrators/${vpId}/analytics?timeRange=30d`);
  if (!response.ok) throw new Error('Failed to fetch analytics');

  const { data, metrics } = await response.json();
  return { data, metrics };
}
```

### 3. Server-Side Analytics

```typescript
// In a server component or API route
import { getVPMetrics, calculateSuccessRate } from '@/lib/services/orchestrator-analytics-service';

// Get metrics for last 7 days
const metrics = await getVPMetrics('vp_123', '7d');
console.log(`Success rate: ${metrics.successRate}%`);

// Calculate all-time success rate
const allTimeRate = await calculateSuccessRate('vp_123');
console.log(`All-time success: ${allTimeRate}%`);
```

### 4. Track Task Completions

```typescript
// When a task status changes to DONE
import { trackTaskCompletion } from '@/lib/services/orchestrator-analytics-service';

// After updating task status
await trackTaskCompletion(
  vpId,
  taskId,
  45, // duration in minutes (optional, auto-calculated if omitted)
  true // success (true for DONE, false for CANCELLED)
);
```

### 5. Get Trend Data

```typescript
import { getVPTrends } from '@/lib/services/orchestrator-analytics-service';

// Get completion trends over 30 days
const trends = await getVPTrends('vp_123', 'completions', '30d');

trends.forEach(period => {
  console.log(`${period.periodStart}: ${period.tasksCompleted} tasks`);
});
```

## API Endpoint Reference

### GET /api/orchestrators/[id]/analytics

**Request:**
```bash
GET /api/orchestrators/vp_123/analytics?timeRange=30d&includeDaily=true&includeWeekly=true
```

**Query Parameters:**
- `timeRange`: '24h' | '7d' | '30d' | '90d' | 'all' (default: '7d')
- `includeDaily`: boolean (default: true)
- `includeWeekly`: boolean (default: true)
- `includeMonthly`: boolean (default: false)

**Response:**
```json
{
  "data": {
    "vpId": "vp_123",
    "daily": [
      {
        "periodStart": "2025-11-20T00:00:00Z",
        "periodEnd": "2025-11-21T00:00:00Z",
        "tasksCompleted": 5,
        "avgDurationMinutes": 32,
        "successRate": 100
      }
    ],
    "weekly": [...],
    "monthly": [...],
    "summary": {
      "totalTasksCompleted": 42,
      "totalTasksFailed": 3,
      "overallSuccessRate": 93.33,
      "avgResponseTimeMinutes": 28,
      "trendDirection": "up"
    }
  },
  "metrics": {
    "vpId": "vp_123",
    "tasksCompleted": 15,
    "tasksInProgress": 3,
    "tasksFailed": 1,
    "tasksCancelled": 2,
    "avgDurationMinutes": 28,
    "successRate": 88.24,
    "totalTasksAssigned": 21,
    "timeRange": "30d",
    "calculatedAt": "2025-11-26T17:09:00Z"
  }
}
```

## Component Props

### VPAnalyticsCard

```typescript
interface VPAnalyticsCardProps {
  vpId: string;              // Required: Orchestrator identifier
  className?: string;        // Optional: Additional CSS classes
  timeRange?: MetricTimeRange; // Optional: Time range (default: '7d')
}
```

**Example with all props:**
```tsx
<Orchestrator AnalyticsCard
  vpId="vp_abc123"
  timeRange="30d"
  className="shadow-lg rounded-xl"
/>
```

## Service Functions

### trackTaskCompletion
```typescript
trackTaskCompletion(
  vpId: string,
  taskId: string,
  durationMinutes?: number,  // Optional, auto-calculated
  success?: boolean          // Optional, derived from status
): Promise<TaskCompletionEvent>
```

### getVPMetrics
```typescript
getVPMetrics(
  vpId: string,
  timeRange?: MetricTimeRange  // Default: '7d'
): Promise<Orchestrator Metrics>
```

### calculateSuccessRate
```typescript
calculateSuccessRate(
  vpId: string,
  timeRange?: MetricTimeRange  // Default: all time
): Promise<number>  // Returns 0-100
```

### getVPTrends
```typescript
getVPTrends(
  vpId: string,
  metric: 'completions' | 'successRate' | 'avgDuration',
  timeRange?: MetricTimeRange  // Default: '30d'
): Promise<MetricsPeriod[]>
```

### getVPAnalytics
```typescript
getVPAnalytics(
  vpId: string
): Promise<Orchestrator Analytics>  // Complete analytics with all periods
```

## Common Use Cases

### 1. Orchestrator Performance Dashboard
```tsx
function VPPerformanceDashboard({ vpId }: { vpId: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 24 hour metrics */}
      <Orchestrator AnalyticsCard vpId={vpId} timeRange="24h" />

      {/* 7 day metrics */}
      <Orchestrator AnalyticsCard vpId={vpId} timeRange="7d" />

      {/* 30 day metrics */}
      <Orchestrator AnalyticsCard vpId={vpId} timeRange="30d" />
    </div>
  );
}
```

### 2. Success Rate Badge
```tsx
import { calculateSuccessRate } from '@/lib/services/orchestrator-analytics-service';

async function SuccessRateBadge({ vpId }: { vpId: string }) {
  const rate = await calculateSuccessRate(vpId, '7d');
  const color = rate >= 90 ? 'green' : rate >= 70 ? 'yellow' : 'red';

  return (
    <span className={`badge badge-${color}`}>
      {rate.toFixed(1)}% success
    </span>
  );
}
```

### 3. Trend Chart Data
```tsx
import { getVPTrends } from '@/lib/services/orchestrator-analytics-service';

async function getTrendChartData(vpId: string) {
  const trends = await getVPTrends(vpId, 'completions', '30d');

  return trends.map(t => ({
    date: t.periodStart.toLocaleDateString(),
    completions: t.tasksCompleted,
    successRate: t.successRate
  }));
}
```

### 4. Orchestrator Comparison
```typescript
async function compareVPs(vpIds: string[]) {
  const metrics = await Promise.all(
    vpIds.map(id => getVPMetrics(id, '7d'))
  );

  return metrics.map((m, i) => ({
    vpId: vpIds[i],
    successRate: m.successRate,
    tasksCompleted: m.tasksCompleted,
    avgDuration: m.avgDurationMinutes
  }));
}
```

## Integration Checklist

- [ ] Import VPAnalyticsCard component
- [ ] Add to Orchestrator dashboard/detail page
- [ ] Test with existing Orchestrator data
- [ ] Verify metrics calculations
- [ ] Check authentication works
- [ ] Test error handling
- [ ] Verify responsive design
- [ ] Test dark mode appearance
- [ ] Add loading states
- [ ] Test with no data scenario

## Styling Customization

### Custom Card Styling
```tsx
<Orchestrator AnalyticsCard
  vpId={vpId}
  className="
    border-2
    border-primary
    shadow-2xl
    hover:shadow-3xl
    transition-shadow
  "
/>
```

### Custom Time Range Selector
```tsx
const [timeRange, setTimeRange] = useState<MetricTimeRange>('7d');

<select onChange={e => setTimeRange(e.target.value as MetricTimeRange)}>
  <option value="24h">Last 24 Hours</option>
  <option value="7d">Last 7 Days</option>
  <option value="30d">Last 30 Days</option>
  <option value="90d">Last 90 Days</option>
  <option value="all">All Time</option>
</select>

<Orchestrator AnalyticsCard vpId={vpId} timeRange={timeRange} />
```

## Performance Tips

1. **Use React Suspense** for loading states
2. **Implement caching** with SWR or React Query
3. **Paginate trends** for large datasets
4. **Index database** on vpId and updatedAt
5. **Cache API responses** with Next.js ISR
6. **Debounce updates** in real-time scenarios

## Troubleshooting

### Issue: "Analytics data not loading"
- Check authentication is working
- Verify Orchestrator exists in database
- Check browser console for errors
- Verify API endpoint is accessible

### Issue: "Metrics showing 0"
- Ensure Orchestrator has completed tasks
- Check task status values are correct
- Verify time range includes task dates
- Check database connectivity

### Issue: "Success rate incorrect"
- Verify task status transitions
- Check DONE vs CANCELLED counts
- Ensure timestamps are accurate
- Review calculation logic

## Next Steps

1. Add unit tests for service functions
2. Create integration tests for API
3. Add E2E tests for component
4. Implement real-time updates
5. Add data export functionality
6. Create visualization charts
7. Set up performance alerts

---

**Last Updated:** 2025-11-26
**Version:** 1.0.0
