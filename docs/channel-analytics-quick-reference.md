# Channel Analytics API - Quick Reference

## Endpoint

```
GET /api/workspaces/:workspaceSlug/channels/:channelId/analytics
```

## Query Parameters

```
?startDate=2024-01-01T00:00:00Z     // ISO 8601 format (default: 30 days ago)
&endDate=2024-01-31T23:59:59Z       // ISO 8601 format (default: now)
&granularity=day                     // hour|day|week|month (default: day)
&timezone=UTC                        // Timezone string (default: UTC)
&export=csv                          // json|csv (default: json)
```

## Response Structure

```typescript
{
  data: {
    channel: {
      (id, name, type);
    }
    period: {
      (startDate, endDate, granularity);
    }
    messageVolume: [{ period, count }];
    activeUsers: [{ period, uniqueUsers }];
    peakHours: [{ hour, count }];
    messageTypes: [{ type, count }];
    topContributors: [{ user, messageCount }];
    engagement: {
      totalMessages;
      messagesWithReplies;
      totalReplies;
      totalReactions;
      avgRepliesPerMessage;
      avgReactionsPerMessage;
      replyRate;
    }
    memberGrowth: [{ period, newMembers, totalMembers }];
    summary: {
      totalMessages;
      totalReplies;
      totalReactions;
      uniqueActiveUsers;
      avgMessagesPerDay;
      peakActivityHour;
    }
  }
}
```

## Quick Examples

### Last 7 Days

```typescript
fetch(
  `/api/workspaces/my-workspace/channels/general/analytics?startDate=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`
);
```

### This Month (Hourly)

```typescript
const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
fetch(
  `/api/workspaces/my-workspace/channels/general/analytics?startDate=${startOfMonth.toISOString()}&granularity=hour`
);
```

### Export CSV

```typescript
window.location.href = `/api/workspaces/my-workspace/channels/general/analytics?export=csv`;
```

## Error Codes

- `401` UNAUTHORIZED - Not authenticated
- `403` FORBIDDEN - No channel access
- `404` CHANNEL_NOT_FOUND - Channel doesn't exist
- `400` VALIDATION_ERROR - Invalid parameters
- `500` INTERNAL_ERROR - Server error

## Analytics Metrics Explained

### Message Volume

Total messages sent per time period (excludes deleted messages)

### Active Users

Unique users who sent messages in each time period

### Peak Hours

Hours of day (0-23) with highest message activity

### Message Types

Distribution: TEXT, FILE, SYSTEM, COMMAND

### Top Contributors

Users ranked by message count (top 10)

### Engagement

- **Reply Rate**: % of messages that receive replies
- **Avg Replies**: Average replies per message
- **Avg Reactions**: Average reactions per message

### Member Growth

New members joining over time + cumulative total

## Files Created

1. **Route**: `apps/web/app/api/workspaces/[workspaceSlug]/channels/[channelId]/analytics/route.ts`
2. **Tests**:
   `apps/web/app/api/workspaces/[workspaceSlug]/channels/[channelId]/analytics/__tests__/analytics.test.ts`
3. **Docs**: `apps/web/app/api/workspaces/[workspaceSlug]/channels/[channelId]/analytics/README.md`

## Testing

```bash
cd packages/@wundr/neolith/apps/web
pnpm test analytics.test.ts
```

## Performance

- Small channels: <200ms
- Medium channels: 200-500ms
- Large channels: 500-1500ms

Uses parallel query execution for optimal performance.
