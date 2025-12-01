# Health Dashboard Hooks - Quick Reference

## Import

```typescript
import {
  useHealthDashboard,
  useOrchestratorHealth,
  useMetricsChart,
  useHealthAlerts,
} from '@/hooks';
```

## 1. System Overview

```typescript
const { overview, isLoading, error, refetch } = useHealthDashboard();

// Auto-refreshes every 30s
// Returns: total orchestrators, health counts, alerts, uptime
```

## 2. Orchestrator List

```typescript
const { orchestrators, total, pagination } = useOrchestratorHealth({
  status: 'degraded', // Filter: 'healthy' | 'degraded' | 'unhealthy'
  page: 1, // Pagination
  limit: 20, // Items per page
  sortBy: 'responseTime', // Sort: 'name' | 'status' | 'responseTime' | 'uptime'
  sortOrder: 'desc', // 'asc' | 'desc'
});

// Auto-refreshes every 30s
// Returns: paginated orchestrator health data
```

## 3. Metrics Chart

```typescript
const { chartData, timeRange, setTimeRange } = useMetricsChart('24h');

// Time ranges: '1h' | '24h' | '7d' | '30d'
// Auto-refreshes every 60s
// Returns: recharts-compatible data
```

## 4. Alerts

```typescript
const { alerts, acknowledgeAlert, filterBySeverity } = useHealthAlerts();

const criticalAlerts = filterBySeverity('critical');
await acknowledgeAlert('alert-id');

// Auto-refreshes every 30s
// Severities: 'info' | 'warning' | 'critical'
```

## API Endpoints Needed

- GET `/api/admin/health`
- GET `/api/admin/health/orchestrators?status={}&page={}&limit={}`
- GET `/api/admin/health/metrics?timeRange={}`
- GET `/api/admin/health/alerts`
- POST `/api/admin/health/alerts/{id}/acknowledge`

## Features

- Auto-refresh (30s for health, 60s for metrics)
- Toast error notifications
- Optimistic UI updates
- Full TypeScript support
- SWR caching & deduplication
