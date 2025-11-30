# Health Dashboard Hooks Implementation - Phase 5.3

## Overview
Comprehensive React hooks for system health monitoring and observability in the Neolith platform.

## Location
`/Users/maya/wundr/packages/@wundr/neolith/apps/web/hooks/use-health-dashboard.ts`

## Implemented Hooks

### 1. useHealthDashboard()
**Purpose**: Fetches system-wide health overview with real-time updates

**Returns**:
- `overview`: SystemHealthOverview | null
- `isLoading`: boolean
- `error`: Error | null
- `refetch`: () => void
- `isValidating`: boolean

**Features**:
- Auto-refreshes every 30 seconds
- Toast notifications on errors
- Tracks total/healthy/degraded/unhealthy orchestrators
- Monitors active alerts and system uptime
- API endpoint: `/api/admin/health`

**Example**:
```typescript
const { overview, isLoading, error, refetch } = useHealthDashboard();
```

---

### 2. useOrchestratorHealth(filters?)
**Purpose**: Fetches orchestrator health statuses with pagination and filtering

**Parameters**:
- `filters`: OrchestratorHealthFilters
  - `status?: HealthStatus` - Filter by health status
  - `page?: number` - Current page (pagination)
  - `limit?: number` - Items per page
  - `sortBy?: 'name' | 'status' | 'responseTime' | 'uptime'`
  - `sortOrder?: 'asc' | 'desc'`

**Returns**:
- `orchestrators`: OrchestratorHealth[]
- `total`: number
- `isLoading`: boolean
- `error`: Error | null
- `pagination`: PaginationMetadata | null
- `refetch`: () => void
- `isValidating`: boolean

**Features**:
- Auto-refreshes every 30 seconds
- Supports status filtering (healthy, degraded, unhealthy)
- Server-side pagination
- Sorting by multiple fields
- Toast notifications on errors
- API endpoint: `/api/admin/health/orchestrators`

**Example**:
```typescript
const { orchestrators, total, pagination } = useOrchestratorHealth({
  status: 'degraded',
  page: 1,
  limit: 20,
  sortBy: 'responseTime',
  sortOrder: 'desc'
});
```

---

### 3. useMetricsChart(initialTimeRange?)
**Purpose**: Fetches and transforms metrics data for charting with recharts

**Parameters**:
- `initialTimeRange`: TimeRange (default: '24h')
  - Options: '1h', '24h', '7d', '30d'

**Returns**:
- `chartData`: ChartDataPoint[]
- `isLoading`: boolean
- `error`: Error | null
- `timeRange`: TimeRange
- `setTimeRange`: (range: TimeRange) => void
- `refetch`: () => void

**Features**:
- Auto-refreshes every 60 seconds
- Transforms data for recharts compatibility
- Dynamic timestamp formatting based on time range
- Tracks response time, CPU, memory, requests, errors, success rate
- Toast notifications on errors
- API endpoint: `/api/admin/health/metrics?timeRange={timeRange}`

**Chart Data Format**:
```typescript
{
  time: string,         // Formatted timestamp
  responseTime: number, // ms
  cpu: number,          // percentage
  memory: number,       // percentage
  requests: number,     // count
  errors: number,       // count
  success: number       // percentage
}
```

**Example**:
```typescript
const { chartData, timeRange, setTimeRange } = useMetricsChart('24h');

// Use with recharts
<LineChart data={chartData}>
  <Line dataKey="responseTime" stroke="#8884d8" />
  <Line dataKey="cpu" stroke="#82ca9d" />
  <Line dataKey="memory" stroke="#ffc658" />
</LineChart>
```

---

### 4. useHealthAlerts()
**Purpose**: Fetches and manages health alerts with acknowledgment capabilities

**Returns**:
- `alerts`: HealthAlert[]
- `acknowledgeAlert`: (alertId: string) => Promise<void>
- `isLoading`: boolean
- `error`: Error | null
- `isMutating`: boolean
- `filterBySeverity`: (severity?: AlertSeverity) => HealthAlert[]
- `refetch`: () => void

**Features**:
- Auto-refreshes every 30 seconds
- Optimistic UI updates on acknowledgment
- Filter by severity (info, warning, critical)
- Toast notifications for success/error
- API endpoints:
  - GET `/api/admin/health/alerts`
  - POST `/api/admin/health/alerts/{alertId}/acknowledge`

**Example**:
```typescript
const { alerts, acknowledgeAlert, filterBySeverity } = useHealthAlerts();

const criticalAlerts = filterBySeverity('critical');

await acknowledgeAlert('alert-123');
```

---

## Type Definitions

### HealthStatus
```typescript
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
```

### AlertSeverity
```typescript
type AlertSeverity = 'info' | 'warning' | 'critical';
```

### TimeRange
```typescript
type TimeRange = '1h' | '24h' | '7d' | '30d';
```

### SystemHealthOverview
```typescript
interface SystemHealthOverview {
  status: HealthStatus;
  totalOrchestrators: number;
  healthyOrchestrators: number;
  degradedOrchestrators: number;
  unhealthyOrchestrators: number;
  activeAlerts: number;
  criticalAlerts: number;
  avgResponseTime: number;
  uptime: number;
  lastUpdated: Date;
}
```

### OrchestratorHealth
```typescript
interface OrchestratorHealth {
  id: string;
  name: string;
  status: HealthStatus;
  responseTime: number;
  cpuUsage: number;
  memoryUsage: number;
  activeTasks: number;
  successRate: number;
  errorCount: number;
  lastHeartbeat: Date;
  uptime: number;
}
```

### HealthAlert
```typescript
interface HealthAlert {
  id: string;
  orchestratorId?: string;
  orchestratorName?: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  type: string;
  acknowledged: boolean;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}
```

---

## SWR Configuration

### Health Data (30s refresh)
- `refreshInterval`: 30000ms
- `revalidateOnFocus`: true
- `revalidateOnReconnect`: true
- `dedupingInterval`: 5000ms

### Metrics Data (60s refresh)
- `refreshInterval`: 60000ms
- `revalidateOnFocus`: true
- `revalidateOnReconnect`: true
- `dedupingInterval`: 10000ms

---

## Error Handling

All hooks implement graceful error handling with:
1. Toast notifications via `useToast` hook
2. Error objects returned in hook state
3. Automatic retry on reconnection
4. Optimistic UI updates where applicable

---

## Exports

All hooks and types are exported from:
```typescript
import {
  // Hooks
  useHealthDashboard,
  useOrchestratorHealth,
  useMetricsChart,
  useHealthAlerts,
  
  // Types
  HealthStatus,
  AlertSeverity,
  TimeRange,
  SystemHealthOverview,
  OrchestratorHealth,
  HealthAlert,
  // ... and more
} from '@/hooks';
```

---

## API Endpoints Required

The following API endpoints need to be implemented:

1. **GET** `/api/admin/health`
   - Returns: SystemHealthOverview

2. **GET** `/api/admin/health/orchestrators`
   - Query params: status, page, limit, sortBy, sortOrder
   - Returns: PaginatedApiResponse<OrchestratorHealth>

3. **GET** `/api/admin/health/metrics`
   - Query params: timeRange
   - Returns: MetricDataPoint[]

4. **GET** `/api/admin/health/alerts`
   - Returns: HealthAlert[]

5. **POST** `/api/admin/health/alerts/{alertId}/acknowledge`
   - Returns: Updated alert

---

## Best Practices

1. **Automatic Refresh**: All hooks auto-refresh to keep data current
2. **Error Feedback**: Toast notifications for all error states
3. **Optimistic Updates**: Immediate UI feedback for mutations
4. **Type Safety**: Full TypeScript support with comprehensive types
5. **SWR Benefits**: Caching, deduplication, revalidation
6. **Recharts Compatible**: Metrics data pre-formatted for charts

---

## Next Steps

1. Implement API endpoints
2. Create UI components using these hooks
3. Add E2E tests for health monitoring flows
4. Set up alerting thresholds
5. Implement historical data storage

