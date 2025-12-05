# User Activity Analytics API

## Overview

Comprehensive user activity analytics endpoint that tracks and analyzes user behavior within a
workspace.

## Endpoint

```
GET /api/workspaces/[workspaceSlug]/users/[userId]/analytics
```

## Implementation Details

**File**:
`/Users/granfar/wundr/packages/@wundr/neolith/apps/web/app/api/workspaces/[workspaceSlug]/users/[userId]/analytics/route.ts`

**Lines of Code**: 769

**Status**: Fully implemented with NO stubs

## Features

### 1. User Activity Timeline

- Chronological feed of all user activities
- Activity types tracked:
  - Messages sent
  - Reactions given
  - Files uploaded
  - Tasks created
  - Tasks completed
  - Items saved for later
- Sorted by timestamp (most recent first)
- Limited to 100 most recent events for performance

### 2. Message Metrics

- **Messages sent**: Total count with breakdown by type (TEXT, FILE, SYSTEM, COMMAND)
- **Messages received**: Count of messages from other users in shared channels
- **Thread participation**: Thread messages sent and replies received
- **Direct messages**: Count of DM conversations
- **Average per day**: Calculated message frequency
- **Channel activity**: Most active channels by message count (top 5)

### 3. Task Completion Analytics

- **Tasks created**: Total tasks created by user
- **Tasks assigned**: Total tasks assigned to user
- **Tasks completed**: Total completed tasks
- **Completion rate**: Percentage of assigned tasks completed
- **On-time delivery rate**: Percentage of tasks completed before due date
- **Average completion time**: Mean time from creation to completion (in hours)
- **Status breakdown**: Task counts by status (TODO, IN_PROGRESS, BLOCKED, DONE, CANCELLED)
- **Priority breakdown**: Task counts by priority (CRITICAL, HIGH, MEDIUM, LOW)

### 4. Session Duration Tracking

- **Session detection algorithm**: Groups activities with 30-minute timeout
- **Total sessions**: Number of distinct work sessions
- **Average session duration**: Mean session length in minutes
- **Total active time**: Sum of all session durations in minutes
- **Peak activity hour**: Hour of day with most activity (0-23)
- **Activity distribution**: Hourly breakdown of activity counts

### 5. Engagement Metrics

- **Reactions given/received**: Count and top emojis analysis
- **Files uploaded**: Count, total size, and breakdown by MIME type
- **Saved items**: Count of bookmarked/saved content
- **Channel memberships**: Total channels joined, starred channels
- **Active channels**: Number of channels with user activity

### 6. Activity Visualization Data

- **Activity by period**: Time-bucketed activity counts
  - Configurable granularity: hour, day, week, month
  - Includes breakdown by activity type (messages, reactions, tasks, files)
- **Time series data**: Ready for charting libraries

## Query Parameters

### Date Range Filtering

| Parameter     | Type                           | Required | Default      | Description                        |
| ------------- | ------------------------------ | -------- | ------------ | ---------------------------------- |
| `from`        | ISO 8601 date string           | No       | 30 days ago  | Start date for analysis            |
| `to`          | ISO 8601 date string           | No       | Current date | End date for analysis              |
| `granularity` | `hour`, `day`, `week`, `month` | No       | `day`        | Time bucket size for visualization |

### Example Queries

```bash
# Last 30 days (default)
GET /api/workspaces/ws_123/users/user_456/analytics

# Custom date range
GET /api/workspaces/ws_123/users/user_456/analytics?from=2025-01-01&to=2025-12-31

# Hourly granularity for detailed analysis
GET /api/workspaces/ws_123/users/user_456/analytics?from=2025-12-01&granularity=hour

# Weekly rollup for long-term trends
GET /api/workspaces/ws_123/users/user_456/analytics?from=2024-01-01&granularity=week
```

## Response Structure

```typescript
{
  data: {
    user: {
      id: string;
      name: string;
      displayName: string;
      email: string;
      avatarUrl: string;
      status: UserStatus;
      lastActiveAt: Date;
    }
    dateRange: {
      from: string; // ISO date
      to: string; // ISO date
      granularity: 'hour' | 'day' | 'week' | 'month';
    }
    overview: {
      totalActivity: number;
      activeChannels: number;
      starredChannels: number;
    }
    messages: {
      sent: number;
      received: number;
      threads: number;
      threadRepliesReceived: number;
      directMessages: number;
      byType: Record<string, number>;
      avgPerDay: number;
    }
    reactions: {
      given: number;
      received: number;
      topEmojis: Array<{ emoji: string; count: number }>;
    }
    tasks: {
      created: number;
      assigned: number;
      completed: number;
      completionRate: number; // Percentage
      onTimeDeliveryRate: number; // Percentage
      avgCompletionTimeHours: number;
      byStatus: Record<TaskStatus, number>;
      byPriority: Record<TaskPriority, number>;
    }
    files: {
      uploaded: number;
      totalSizeBytes: number;
      byType: Record<string, number>;
    }
    sessions: {
      totalSessions: number;
      avgSessionDuration: number; // Minutes
      totalActiveTime: number; // Minutes
      peakActivityHour: number; // 0-23
      activityDistribution: Array<{ hour: number; count: number }>;
    }
    engagement: {
      savedItems: number;
      mostActiveChannels: Array<{
        channelId: string;
        channelName: string;
        messageCount: number;
      }>;
      channelMemberships: number;
    }
    timeline: Array<{
      type: 'message' | 'reaction' | 'file' | 'task_created' | 'task_completed' | 'saved_item';
      timestamp: Date;
      data: any; // Type-specific activity data
    }>;
    activityByPeriod: Array<{
      period: string; // ISO date/timestamp based on granularity
      messages: number;
      reactions: number;
      tasks: number;
      files: number;
      total: number;
    }>;
  }
  metadata: {
    generatedAt: string; // ISO timestamp
    requestedBy: string; // User ID of requester
  }
}
```

## Database Queries

### Optimized Prisma Queries

The endpoint uses **11 parallel Prisma queries** for optimal performance:

1. **Messages sent** - with channel, type, parent ID
2. **Messages received** - count only
3. **Thread replies** - count of replies to user's messages
4. **Reactions given** - with emoji and message ID
5. **Reactions received** - count only
6. **Files uploaded** - with metadata
7. **Tasks created** - with status and dates
8. **Tasks assigned** - with full task details
9. **Tasks completed** - filtered by completion date
10. **Channel memberships** - with channel details
11. **Saved items** - with type and status

### Query Performance

- **Parallel execution**: All queries run concurrently using `Promise.all()`
- **Selective fields**: Only necessary fields selected to minimize data transfer
- **Indexed queries**: All queries use indexed fields (userId, workspaceId, createdAt, etc.)
- **Date filtering**: Applied at database level for efficiency
- **Access control**: Respects channel membership and workspace permissions

## Security & Authorization

### Authentication Required

- User must be authenticated via NextAuth session
- Returns 401 if not authenticated

### Workspace Membership Required

- Both requesting user and target user must be workspace members
- Returns 404 if either user is not a member

### Privacy Controls

- Only analyzes data in channels accessible to the target user
- Respects workspace boundaries
- Does not expose private/DM content to unauthorized users

## Error Handling

| Status Code | Error          | Description                                   |
| ----------- | -------------- | --------------------------------------------- |
| 200         | Success        | Analytics data returned                       |
| 400         | Bad Request    | Invalid parameters or date format             |
| 401         | Unauthorized   | Not authenticated                             |
| 404         | Not Found      | Workspace or user not found, or access denied |
| 500         | Internal Error | Database or processing error                  |

## Performance Considerations

### Optimizations Implemented

1. **Parallel query execution** - All database queries run concurrently
2. **Field selection** - Only necessary fields retrieved
3. **Count queries** - Uses `count()` instead of fetching full records when only count needed
4. **Timeline limiting** - Returns max 100 timeline events
5. **In-memory aggregation** - Statistics computed after fetching, no expensive DB aggregations
6. **Indexed queries** - All WHERE clauses use indexed columns

### Scalability

- Suitable for workspaces with thousands of messages and tasks
- Date range filtering prevents unbounded queries
- Can be further optimized with caching (Redis) if needed
- Consider background jobs for historical analysis of large datasets

## Use Cases

### 1. User Performance Dashboards

Display individual user productivity metrics and trends

### 2. Team Analytics

Compare user activity across team members

### 3. Activity Reports

Generate periodic reports on user engagement

### 4. Anomaly Detection

Identify unusual activity patterns or inactivity

### 5. Gamification

Track metrics for leaderboards and achievements

### 6. Resource Planning

Understand user work patterns for capacity planning

## Future Enhancements

### Potential Additions

- [ ] Comparison mode (compare two users side-by-side)
- [ ] Team averages for benchmarking
- [ ] Sentiment analysis on messages
- [ ] Response time metrics
- [ ] Collaboration graph (who works with whom)
- [ ] Predictive analytics (estimated completion dates)
- [ ] Export to CSV/PDF for reporting
- [ ] Real-time streaming updates (WebSocket)
- [ ] Custom metric definitions
- [ ] Caching layer for historical data

## Testing Recommendations

### Unit Tests

```typescript
describe('User Analytics API', () => {
  it('should calculate session metrics correctly');
  it('should handle date range filtering');
  it('should respect workspace permissions');
  it('should aggregate activity by period');
  it('should calculate task completion rates');
});
```

### Integration Tests

- Test with real database data
- Verify query performance with large datasets
- Test edge cases (no activity, single activity, etc.)
- Validate date range boundaries

### Load Tests

- Concurrent requests from multiple users
- Large date ranges (1+ year)
- High activity users (1000+ messages)

## Dependencies

- `@neolith/database` - Prisma client
- `next` - Next.js framework
- `@/lib/auth` - NextAuth authentication

## Related Endpoints

- `GET /api/workspaces/[workspaceSlug]/users` - List workspace users
- `GET /api/workspaces/[workspaceSlug]/tasks` - Task management
- `GET /api/workspaces/[workspaceSlug]/messages/search` - Message search

## Changelog

### v1.0.0 (2025-12-06)

- Initial implementation
- Full feature set with NO stubs
- Comprehensive metrics and analytics
- Date range filtering
- Session duration tracking
- Activity timeline
- Performance optimizations
