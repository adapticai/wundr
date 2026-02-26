# Analytics API Quick Reference Guide

## Base URL

```
/api/workspaces/[workspaceId]/analytics
```

## Authentication

All endpoints require authentication. Include session cookie in requests.

## Common Error Codes

| Code             | Status | Description                        |
| ---------------- | ------ | ---------------------------------- |
| `AUTH_REQUIRED`  | 401    | Missing or invalid authentication  |
| `INVALID_ID`     | 400    | Invalid workspace UUID format      |
| `FORBIDDEN`      | 403    | Access denied to workspace         |
| `INVALID_PERIOD` | 400    | Invalid period parameter           |
| `INVALID_DATE`   | 400    | Invalid date format (use ISO 8601) |
| `INVALID_RANGE`  | 400    | Start date must be before end date |
| `MISSING_DATES`  | 400    | Custom period requires both dates  |
| `INVALID_METRIC` | 400    | Invalid metric name                |
| `INVALID_BODY`   | 400    | Malformed JSON request body        |
| `INTERNAL_ERROR` | 500    | Server error                       |

## Endpoints Overview

### 1. Main Analytics

```http
GET /api/workspaces/{workspaceId}/analytics
```

**Query Parameters:**

- `startDate` (optional): ISO 8601 date (e.g., "2025-01-01")
- `endDate` (optional): ISO 8601 date (default: now)
- `granularity` (optional): `daily` | `weekly` | `monthly` (default: `daily`)
- `page` (optional): Page number (default: 1, min: 1)
- `limit` (optional): Items per page (default: 100, max: 1000)

**Response:**

```json
{
  "workspace": { "id": "uuid", "name": "string" },
  "dateRange": { "start": "ISO date", "end": "ISO date", "granularity": "daily" },
  "summary": {
    "totalMessages": 1234,
    "totalChannels": 45,
    "totalMembers": 67,
    "totalOrchestrators": 8,
    "totalTasks": 234,
    "totalWorkflows": 12,
    "activeOrchestrators": 5,
    "completedTasks": 189,
    "successfulWorkflows": 10
  },
  "timeSeries": {
    "messageVolume": [{"timestamp": "ISO", "value": 123}],
    "taskCompletion": [{"timestamp": "ISO", "value": 45}],
    "workflowExecution": [{"timestamp": "ISO", "value": 2}]
  },
  "orchestratorActivity": [...],
  "channelEngagement": [...],
  "taskMetrics": {...},
  "workflowMetrics": {...}
}
```

### 2. Metrics

```http
GET /api/workspaces/{workspaceId}/analytics/metrics
```

**Query Parameters:**

- `period` (optional): `day` | `week` | `month` | `quarter` | `year` | `custom` (default: `month`)
- `from` (required for custom): ISO 8601 date
- `to` (required for custom): ISO 8601 date
- `metrics` (optional): Comma-separated list (e.g., "messages,users,channels")
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 100, max: 1000)

**Example:**

```bash
curl "https://api.example.com/api/workspaces/abc-123/analytics/metrics?period=week&metrics=messages,users"
```

**Response:**

```json
{
  "data": {
    "workspaceId": "uuid",
    "period": "week",
    "startDate": "ISO date",
    "endDate": "ISO date",
    "messages": {...},
    "users": {...},
    "channels": {...},
    "files": {...},
    "orchestrator": {...}
  },
  "pagination": { "page": 1, "limit": 100 },
  "meta": {
    "workspaceId": "uuid",
    "period": "week",
    "dateRange": { "from": "ISO", "to": "ISO" },
    "generatedAt": "ISO timestamp"
  }
}
```

### 3. Insights

```http
GET /api/workspaces/{workspaceId}/analytics/insights
```

**Query Parameters:**

- `period` (optional): `day` | `week` | `month` | `quarter` | `year` (default: `month`)

**Response:**

```json
{
  "data": {
    "id": "report_1234567890",
    "workspaceId": "uuid",
    "period": "month",
    "generatedAt": "ISO timestamp",
    "highlights": [
      {
        "type": "positive",
        "title": "Active Communication",
        "description": "1,234 messages sent this period",
        "metric": "messages",
        "value": 1234
      }
    ],
    "recommendations": [
      {
        "priority": "medium",
        "title": "Boost Engagement",
        "description": "Consider creating more focused channels..."
      }
    ]
  },
  "meta": {
    "workspaceId": "uuid",
    "period": "month",
    "generatedAt": "ISO timestamp"
  }
}
```

### 4. Trends

```http
GET /api/workspaces/{workspaceId}/analytics/trends
```

**Query Parameters:**

- `metric` (optional): `messages` | `active_users` | `files` | `channels` | `tasks` | `workflows`
  (default: `messages`)
- `period` (optional): `day` | `week` | `month` | `quarter` | `year` (default: `week`)

**Example:**

```bash
curl "https://api.example.com/api/workspaces/abc-123/analytics/trends?metric=messages&period=week"
```

**Response:**

```json
{
  "data": {
    "metric": "messages",
    "period": "week",
    "trend": {
      "current": 1234,
      "previous": 1100,
      "change": 134,
      "changePercent": 12.2,
      "trend": "up"
    }
  },
  "meta": {
    "workspaceId": "uuid",
    "currentPeriod": { "start": "ISO", "end": "ISO" },
    "previousPeriod": { "start": "ISO", "end": "ISO" },
    "generatedAt": "ISO timestamp"
  }
}
```

### 5. Real-time Stats

#### Snapshot Mode (Polling)

```http
GET /api/workspaces/{workspaceId}/analytics/realtime
Accept: application/json
```

**Response:**

```json
{
  "data": {
    "activeUsers": 45,
    "onlineUsers": 12,
    "activeSessions": 8,
    "messagesLastHour": 234,
    "messagesToday": 1567,
    "activeChannels": 15,
    "activeOrchestrators": 3,
    "tasksInProgress": 45,
    "eventCounts": {
      "message.sent": 234,
      "reaction.added": 89
    },
    "timestamp": "ISO timestamp"
  },
  "meta": {
    "workspaceId": "uuid",
    "userId": "uuid",
    "mode": "snapshot",
    "connections": 8,
    "timestamp": "ISO timestamp"
  }
}
```

#### SSE Streaming Mode

```http
GET /api/workspaces/{workspaceId}/analytics/realtime
Accept: text/event-stream
```

**Events Received:**

```
event: connected
data: {"connectionId":"conn_123","workspaceId":"uuid","timestamp":"ISO"}

event: stats
data: {"activeUsers":45,"onlineUsers":12,...,"timestamp":"ISO"}

event: ping
data: {"timestamp":1234567890}

event: event
data: {"eventType":"message.sent","userId":"uuid","timestamp":"ISO"}
```

**JavaScript Example:**

```javascript
const eventSource = new EventSource('/api/workspaces/abc-123/analytics/realtime');

eventSource.addEventListener('connected', e => {
  console.log('Connected:', JSON.parse(e.data));
});

eventSource.addEventListener('stats', e => {
  const stats = JSON.parse(e.data);
  console.log('Real-time stats:', stats);
});

eventSource.addEventListener('ping', e => {
  console.log('Heartbeat:', JSON.parse(e.data));
});

eventSource.addEventListener('event', e => {
  const event = JSON.parse(e.data);
  console.log('User event:', event);
});

eventSource.onerror = error => {
  console.error('SSE error:', error);
};
```

#### Track Real-time Events

```http
POST /api/workspaces/{workspaceId}/analytics/realtime
Content-Type: application/json
```

**Body:**

```json
{
  "eventType": "user.action",
  "eventData": {
    "action": "button_click",
    "target": "send_message"
  },
  "sessionId": "session_123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Event tracked successfully",
  "eventType": "user.action",
  "notified": 5,
  "timestamp": "ISO timestamp"
}
```

#### Close SSE Connections (Admin)

```http
DELETE /api/workspaces/{workspaceId}/analytics/realtime
```

**Response:**

```json
{
  "success": true,
  "message": "Connections closed",
  "closedCount": 5,
  "timestamp": "ISO timestamp"
}
```

### 6. Track Events

```http
POST /api/workspaces/{workspaceId}/analytics/track
Content-Type: application/json
```

**Body:**

```json
{
  "eventType": "message.sent",
  "eventData": {
    "messageId": "msg_123",
    "channelId": "ch_456",
    "length": 42
  },
  "sessionId": "session_789",
  "platform": "web",
  "version": "1.0.0"
}
```

**Event Type Format:**

- Alphanumeric characters, dots, underscores, dashes
- Examples: `message.sent`, `user-login`, `file_uploaded`

**Response:**

```json
{
  "success": true,
  "message": "Event tracked successfully",
  "eventType": "message.sent",
  "timestamp": "ISO timestamp"
}
```

### 7. Export Data

#### Export Analytics Data

```http
GET /api/workspaces/{workspaceId}/analytics/export
```

**Query Parameters:**

- `format` (optional): `csv` | `json` (default: `json`)
- `from` (optional): ISO 8601 date (default: 30 days ago)
- `to` (optional): ISO 8601 date (default: now)
- `metrics` (optional): Comma-separated list
- `stream` (optional): `true` | `false` (default: `false`)

**Example CSV Export:**

```bash
curl "https://api.example.com/api/workspaces/abc-123/analytics/export?format=csv&from=2025-01-01&to=2025-01-31&metrics=messages,users" \
  -o analytics-export.csv
```

**Example JSON Export:**

```bash
curl "https://api.example.com/api/workspaces/abc-123/analytics/export?format=json&from=2025-01-01" \
  | jq '.'
```

**CSV Response:**

```csv
# Analytics Export
# Date Range: 2025-01-01T00:00:00.000Z to 2025-01-31T23:59:59.999Z
# Generated: 2025-01-31T12:00:00.000Z

Category,Metric,Value
Messages,Total,1234
Messages,Average Per Day,41
Users,Total Members,67
Users,Active Users,45
```

**JSON Response:**

```json
{
  "workspaceId": "uuid",
  "dateRange": {
    "from": "2025-01-01T00:00:00.000Z",
    "to": "2025-01-31T23:59:59.999Z"
  },
  "metrics": {
    "messages": {...},
    "users": {...}
  },
  "exportedAt": "ISO timestamp"
}
```

#### Create Scheduled Export

```http
POST /api/workspaces/{workspaceId}/analytics/export
Content-Type: application/json
```

**Body:**

```json
{
  "frequency": "weekly",
  "format": "csv",
  "metrics": ["messages", "users", "channels"],
  "recipients": ["admin@example.com", "manager@example.com"],
  "enabled": true
}
```

**Response:**

```json
{
  "message": "Scheduled export created successfully",
  "export": {
    "id": "export_1234567890",
    "frequency": "weekly",
    "format": "csv",
    "metrics": ["messages", "users", "channels"],
    "recipients": ["admin@example.com", "manager@example.com"],
    "enabled": true,
    "createdBy": "user_uuid",
    "createdAt": "ISO timestamp",
    "lastRunAt": null,
    "nextRunAt": "ISO timestamp"
  }
}
```

## Common Use Cases

### 1. Get Last Week's Analytics

```bash
curl -X GET "https://api.example.com/api/workspaces/abc-123/analytics/metrics?period=week" \
  -H "Cookie: session=your_session_cookie"
```

### 2. Compare This Month vs Last Month

```bash
curl -X GET "https://api.example.com/api/workspaces/abc-123/analytics/trends?metric=messages&period=month" \
  -H "Cookie: session=your_session_cookie"
```

### 3. Get Real-time Dashboard Data

```bash
curl -X GET "https://api.example.com/api/workspaces/abc-123/analytics/realtime" \
  -H "Accept: application/json" \
  -H "Cookie: session=your_session_cookie"
```

### 4. Track Custom Event

```bash
curl -X POST "https://api.example.com/api/workspaces/abc-123/analytics/track" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_cookie" \
  -d '{
    "eventType": "feature.used",
    "eventData": {
      "feature": "advanced_search",
      "duration": 1234
    }
  }'
```

### 5. Export Last Quarter's Data

```bash
curl -X GET "https://api.example.com/api/workspaces/abc-123/analytics/export?format=csv&period=quarter" \
  -H "Cookie: session=your_session_cookie" \
  -o quarterly-report.csv
```

### 6. Get Actionable Insights

```bash
curl -X GET "https://api.example.com/api/workspaces/abc-123/analytics/insights?period=month" \
  -H "Cookie: session=your_session_cookie" \
  | jq '.data.recommendations'
```

## Rate Limits

Recommended rate limits (to be implemented):

- Standard endpoints: 100 requests/minute
- Real-time polling: 60 requests/minute (use SSE instead!)
- SSE connections: 5 concurrent connections per user
- Export: 10 requests/hour
- Track events: 1000 requests/minute

## Best Practices

### 1. Use SSE for Real-time Updates

Instead of polling the real-time endpoint every few seconds, use SSE streaming:

```javascript
// ❌ Don't do this
setInterval(() => {
  fetch('/api/workspaces/abc-123/analytics/realtime').then(/* ... */);
}, 5000);

// ✅ Do this instead
const eventSource = new EventSource('/api/workspaces/abc-123/analytics/realtime');
eventSource.addEventListener('stats', e => {
  updateDashboard(JSON.parse(e.data));
});
```

### 2. Use Pagination for Large Datasets

```javascript
// ✅ Good - paginated requests
async function getAllAnalytics() {
  let page = 1;
  const limit = 100;
  let allData = [];

  while (true) {
    const response = await fetch(`/api/workspaces/abc-123/analytics?page=${page}&limit=${limit}`);
    const data = await response.json();

    if (data.length === 0) break;
    allData = [...allData, ...data];
    page++;
  }

  return allData;
}
```

### 3. Use Streaming for Large Exports

```javascript
// ✅ Good - streaming export
const response = await fetch('/api/workspaces/abc-123/analytics/export?format=csv&stream=true');

const reader = response.body.getReader();
const chunks = [];

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value);
}

const blob = new Blob(chunks);
saveAs(blob, 'analytics-export.csv');
```

### 4. Cache Insights and Trends

```javascript
// ✅ Good - cache insights for 1 hour
const getCachedInsights = memoize(
  (workspaceId, period) =>
    fetch(`/api/workspaces/${workspaceId}/analytics/insights?period=${period}`),
  { maxAge: 60 * 60 * 1000 } // 1 hour
);
```

### 5. Batch Event Tracking

```javascript
// ✅ Good - batch multiple events
const eventQueue = [];

function trackEvent(eventType, eventData) {
  eventQueue.push({ eventType, eventData });

  if (eventQueue.length >= 10) {
    flushEvents();
  }
}

async function flushEvents() {
  const events = [...eventQueue];
  eventQueue.length = 0;

  await Promise.all(
    events.map(event =>
      fetch('/api/workspaces/abc-123/analytics/track', {
        method: 'POST',
        body: JSON.stringify(event),
      })
    )
  );
}

// Flush on page unload
window.addEventListener('beforeunload', flushEvents);
```

## Error Handling

```javascript
async function getAnalytics(workspaceId, params) {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`/api/workspaces/${workspaceId}/analytics/metrics?${queryString}`);

    if (!response.ok) {
      const error = await response.json();

      switch (error.code) {
        case 'AUTH_REQUIRED':
          // Redirect to login
          window.location.href = '/login';
          break;
        case 'FORBIDDEN':
          // Show access denied message
          showError('You do not have access to this workspace');
          break;
        case 'INVALID_DATE':
          // Show validation error
          showError(error.error);
          break;
        default:
          // Generic error
          showError('Failed to fetch analytics. Please try again.');
      }

      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Analytics fetch error:', error);
    showError('Network error. Please check your connection.');
    return null;
  }
}
```

## TypeScript Types

```typescript
// Response types
interface AnalyticsResponse {
  workspace: {
    id: string;
    name: string;
  };
  dateRange: {
    start: string;
    end: string;
    granularity: 'daily' | 'weekly' | 'monthly';
  };
  summary: AnalyticsSummary;
  timeSeries: TimeSeries;
  orchestratorActivity: OrchestratorActivity[];
  channelEngagement: ChannelEngagement[];
  taskMetrics: TaskMetrics;
  workflowMetrics: WorkflowMetrics;
}

interface RealTimeStats {
  activeUsers: number;
  onlineUsers: number;
  activeSessions: number;
  messagesLastHour: number;
  messagesToday: number;
  activeChannels: number;
  activeOrchestrators: number;
  tasksInProgress: number;
  eventCounts: Record<string, number>;
  timestamp: string;
}

interface TrendData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface InsightReport {
  id: string;
  workspaceId: string;
  period: string;
  generatedAt: string;
  highlights: InsightHighlight[];
  recommendations: InsightRecommendation[];
}

// Error types
interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
}
```

## Support

For issues or questions about the Analytics API:

- Documentation: `/docs/ANALYTICS_API_AUDIT_SUMMARY.md`
- GitHub Issues: [Your repository issues page]
- Email: support@example.com
