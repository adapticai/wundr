# Channel Analytics API

Comprehensive analytics API for channel activity tracking and insights.

## Endpoint

```
GET /api/workspaces/:workspaceSlug/channels/:channelId/analytics
```

## Features

- **Message Volume**: Track message counts over time with configurable granularity
- **Active Users**: Monitor unique active users per time period
- **Peak Activity Hours**: Identify when your channel is most active (0-23 hours)
- **Message Type Distribution**: Breakdown of TEXT, FILE, SYSTEM, and COMMAND messages
- **Top Contributors**: Rank users by message count
- **Engagement Metrics**: Replies, reactions, and engagement rates
- **Member Growth**: Track channel membership growth over time
- **Export Support**: Download data in JSON or CSV format

## Authentication

Requires valid session authentication. User must be:
- Member of the organization
- Member of the channel (for private channels)

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startDate` | ISO 8601 | 30 days ago | Start of analysis period |
| `endDate` | ISO 8601 | now | End of analysis period |
| `granularity` | string | `day` | Time bucket size: `hour`, `day`, `week`, `month` |
| `timezone` | string | `UTC` | Timezone for date calculations |
| `export` | string | - | Export format: `json` or `csv` |

## Response Format

### JSON Response (default)

```json
{
  "data": {
    "channel": {
      "id": "channel-uuid",
      "name": "general",
      "type": "PUBLIC"
    },
    "period": {
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.999Z",
      "granularity": "day"
    },
    "messageVolume": [
      {
        "period": "2024-01-01T00:00:00.000Z",
        "count": 145
      },
      {
        "period": "2024-01-02T00:00:00.000Z",
        "count": 178
      }
    ],
    "activeUsers": [
      {
        "period": "2024-01-01T00:00:00.000Z",
        "uniqueUsers": 23
      },
      {
        "period": "2024-01-02T00:00:00.000Z",
        "uniqueUsers": 31
      }
    ],
    "peakHours": [
      {
        "hour": 14,
        "count": 450
      },
      {
        "hour": 15,
        "count": 423
      },
      {
        "hour": 10,
        "count": 398
      }
    ],
    "messageTypes": [
      {
        "type": "TEXT",
        "count": 3421
      },
      {
        "type": "FILE",
        "count": 234
      },
      {
        "type": "SYSTEM",
        "count": 45
      }
    ],
    "topContributors": [
      {
        "user": {
          "id": "user-uuid",
          "name": "John Doe",
          "displayName": "John",
          "email": "john@example.com",
          "avatarUrl": "https://..."
        },
        "messageCount": 342
      }
    ],
    "engagement": {
      "totalMessages": 3700,
      "messagesWithReplies": 892,
      "totalReplies": 1543,
      "totalReactions": 4521,
      "avgRepliesPerMessage": 0.417,
      "avgReactionsPerMessage": 1.222,
      "replyRate": 0.241
    },
    "memberGrowth": [
      {
        "period": "2024-01-01T00:00:00.000Z",
        "newMembers": 5,
        "totalMembers": 45
      },
      {
        "period": "2024-01-02T00:00:00.000Z",
        "newMembers": 3,
        "totalMembers": 48
      }
    ],
    "summary": {
      "totalMessages": 3700,
      "totalReplies": 1543,
      "totalReactions": 4521,
      "uniqueActiveUsers": 67,
      "avgMessagesPerDay": 119.4,
      "peakActivityHour": 14
    }
  }
}
```

### CSV Response (export=csv)

When requesting CSV export, returns a formatted CSV file with sections:
- Message Volume Over Time
- Active Users Over Time
- Peak Activity Hours
- Message Type Distribution
- Top Contributors

**Headers:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="channel-{slug}-analytics-{timestamp}.csv"
```

## Example Requests

### Basic Request (Last 30 Days)

```bash
curl -X GET \
  'https://api.example.com/api/workspaces/my-workspace/channels/general/analytics' \
  -H 'Cookie: session=...'
```

### Custom Date Range

```bash
curl -X GET \
  'https://api.example.com/api/workspaces/my-workspace/channels/general/analytics?startDate=2024-01-01&endDate=2024-01-31' \
  -H 'Cookie: session=...'
```

### Hourly Granularity

```bash
curl -X GET \
  'https://api.example.com/api/workspaces/my-workspace/channels/general/analytics?granularity=hour&startDate=2024-01-15' \
  -H 'Cookie: session=...'
```

### Export as CSV

```bash
curl -X GET \
  'https://api.example.com/api/workspaces/my-workspace/channels/general/analytics?export=csv' \
  -H 'Cookie: session=...' \
  -o channel-analytics.csv
```

## Error Responses

### 401 Unauthorized

```json
{
  "error": "UNAUTHORIZED",
  "message": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "error": "FORBIDDEN",
  "message": "Access denied to private channel"
}
```

### 404 Not Found

```json
{
  "error": "CHANNEL_NOT_FOUND",
  "message": "Channel not found or access denied"
}
```

### 400 Bad Request

```json
{
  "error": "VALIDATION_ERROR",
  "message": "startDate must be before endDate"
}
```

### 500 Internal Server Error

```json
{
  "error": "INTERNAL_ERROR",
  "message": "An internal error occurred"
}
```

## Implementation Details

### Database Queries

The API uses optimized Prisma queries with the following features:

1. **Date Truncation**: PostgreSQL `DATE_TRUNC` for efficient time-based grouping
2. **Aggregations**: `COUNT`, `COUNT DISTINCT`, `SUM` for metrics
3. **Parallel Execution**: All analytics queries run in parallel using `Promise.all()`
4. **Indexes**: Leverages existing indexes on `created_at`, `channel_id`, `author_id`

### Performance Considerations

- **Caching**: Consider implementing Redis caching for frequently accessed date ranges
- **Query Limits**: Top contributors limited to 10 by default
- **Date Range**: Validates date range to prevent excessive queries
- **Deleted Messages**: Filters out `is_deleted = true` messages from analytics

### Security

- **Authentication**: Session-based authentication required
- **Authorization**: Validates workspace and channel membership
- **Private Channels**: Enforces channel membership for private channels
- **Parameter Validation**: Zod schemas validate all inputs

## Use Cases

### Dashboard Visualization

Perfect for building channel analytics dashboards:
```typescript
const analytics = await fetch(
  `/api/workspaces/${workspaceId}/channels/${channelId}/analytics?granularity=day`
);
const data = await analytics.json();

// Render charts with data.messageVolume, data.activeUsers, etc.
```

### Engagement Reports

Generate weekly engagement reports:
```typescript
const startDate = new Date();
startDate.setDate(startDate.getDate() - 7);

const analytics = await fetch(
  `/api/workspaces/${workspaceId}/channels/${channelId}/analytics?` +
  `startDate=${startDate.toISOString()}&granularity=day`
);
```

### Export for Analysis

Download CSV for external analysis:
```typescript
window.location.href =
  `/api/workspaces/${workspaceId}/channels/${channelId}/analytics?export=csv`;
```

## Future Enhancements

Potential improvements for future versions:

- **Sentiment Analysis**: Message sentiment trends
- **Response Time**: Average time to first reply
- **User Retention**: Cohort analysis for member retention
- **Comparative Analytics**: Compare multiple channels
- **Real-time Metrics**: WebSocket-based live analytics
- **Custom Metrics**: User-defined analytics queries
- **Scheduled Reports**: Automated report generation

## Related Endpoints

- `GET /api/workspaces/:workspaceSlug/channels/:channelId` - Channel details
- `GET /api/workspaces/:workspaceSlug/channels/:channelId/messages` - Channel messages
- `GET /api/workspaces/:workspaceSlug/channels/:channelId/members` - Channel members
- `GET /api/workspaces/:workspaceSlug/analytics` - Workspace-level analytics

## Testing

Comprehensive test suite available at:
```
apps/web/app/api/workspaces/[workspaceSlug]/channels/[channelId]/analytics/__tests__/analytics.test.ts
```

Run tests:
```bash
pnpm test analytics.test.ts
```

## Support

For issues or questions:
- GitHub Issues: [github.com/yourorg/neolith/issues](https://github.com)
- Documentation: [docs.neolith.com](https://docs.neolith.com)
