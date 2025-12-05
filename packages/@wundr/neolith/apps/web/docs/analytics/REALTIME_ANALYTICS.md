# Real-time Analytics System

Comprehensive real-time analytics implementation using Server-Sent Events (SSE) for live workspace monitoring.

## Overview

The real-time analytics system provides:

- **Live User Tracking**: Active and online user counts
- **Session Monitoring**: Real-time active session metrics
- **Message Activity**: Live message counts and trends
- **Event Streaming**: Real-time workspace events
- **Connection Management**: Automatic reconnection and health monitoring

## Architecture

### Server-Side (API Route)

**Location**: `/app/api/workspaces/[workspaceSlug]/analytics/realtime/route.ts`

#### Features

1. **Dual Mode Support**
   - SSE Streaming: Real-time push updates
   - Snapshot Polling: On-demand stats retrieval

2. **Connection Management**
   - Unique connection IDs
   - Automatic cleanup of stale connections
   - Max 1-hour connection duration
   - Heartbeat pings every 30 seconds

3. **Stats Updates**
   - Updates every 5 seconds
   - Parallel database queries for performance
   - Redis-backed event counting

4. **Event Broadcasting**
   - POST events notify all connected clients
   - Workspace-scoped notifications
   - Event type validation

### Client-Side (React Hook)

**Location**: `/hooks/useRealtimeAnalytics.ts`

#### Features

1. **SSE Connection**
   - Automatic connection management
   - Exponential backoff reconnection
   - Configurable retry limits

2. **State Management**
   - Real-time stats updates
   - Connection status tracking
   - Error handling

3. **Event Tracking**
   - POST custom events
   - Automatic broadcast to SSE clients

## API Reference

### GET `/api/workspaces/:workspaceId/analytics/realtime`

#### Headers

```http
Accept: text/event-stream  # For SSE streaming
Accept: application/json   # For snapshot polling
```

#### Response Modes

**SSE Streaming Mode**

```
event: connected
data: {"connectionId":"conn_1234567890_abc123","workspaceId":"...","timestamp":"..."}

event: stats
data: {"activeUsers":42,"onlineUsers":15,"messagesToday":380,...}

event: ping
data: {"timestamp":1234567890}

event: event
data: {"eventType":"message.sent","userId":"...","timestamp":"..."}
```

**Snapshot Mode**

```json
{
  "data": {
    "activeUsers": 42,
    "onlineUsers": 15,
    "activeSessions": 8,
    "messagesLastHour": 87,
    "messagesToday": 380,
    "activeChannels": 12,
    "activeOrchestrators": 3,
    "tasksInProgress": 15,
    "eventCounts": {
      "message.sent": 380,
      "file.uploaded": 25,
      "reaction.added": 102
    },
    "timestamp": "2025-12-06T12:00:00.000Z"
  },
  "meta": {
    "workspaceId": "...",
    "userId": "...",
    "mode": "snapshot",
    "connections": 5,
    "timestamp": "..."
  }
}
```

### POST `/api/workspaces/:workspaceId/analytics/realtime`

Track custom events and broadcast to connected clients.

#### Request

```json
{
  "eventType": "user.active",
  "eventData": {
    "channelId": "...",
    "action": "viewed"
  },
  "sessionId": "session_1234567890"
}
```

#### Response

```json
{
  "success": true,
  "message": "Event tracked successfully",
  "eventType": "user.active",
  "notified": 5,
  "timestamp": "2025-12-06T12:00:00.000Z"
}
```

### DELETE `/api/workspaces/:workspaceId/analytics/realtime`

Close all active SSE connections for the workspace (admin only).

#### Response

```json
{
  "success": true,
  "message": "Connections closed",
  "closedCount": 5,
  "timestamp": "2025-12-06T12:00:00.000Z"
}
```

## Usage Examples

### Basic Usage

```tsx
import { useRealtimeAnalytics } from '@/hooks/useRealtimeAnalytics';

function RealtimeAnalyticsDashboard({ workspaceId }: { workspaceId: string }) {
  const { stats, isConnected, error } = useRealtimeAnalytics(workspaceId);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!stats) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold">Live Analytics</h2>
        <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Active Users" value={stats.activeUsers} />
        <MetricCard label="Online Now" value={stats.onlineUsers} />
        <MetricCard label="Active Sessions" value={stats.activeSessions} />
        <MetricCard label="Messages Today" value={stats.messagesToday} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Last Hour" value={stats.messagesLastHour} />
        <MetricCard label="Active Channels" value={stats.activeChannels} />
        <MetricCard label="Orchestrators" value={stats.activeOrchestrators} />
        <MetricCard label="Tasks" value={stats.tasksInProgress} />
      </div>
    </div>
  );
}
```

### With Custom Options

```tsx
function AdvancedAnalytics({ workspaceId }: { workspaceId: string }) {
  const { stats, isConnected, error, reconnect, trackEvent } = useRealtimeAnalytics(
    workspaceId,
    {
      enabled: true,
      autoReconnect: true,
      maxReconnectAttempts: 10,
      reconnectDelay: 2000,
      onConnect: () => console.log('Analytics connected'),
      onDisconnect: () => console.log('Analytics disconnected'),
      onError: (err) => console.error('Analytics error:', err),
      onStatsUpdate: (newStats) => {
        // Handle stats updates
        if (newStats.onlineUsers > 100) {
          console.log('High activity detected!');
        }
      },
    },
  );

  const handleUserAction = async () => {
    await trackEvent('user.action', {
      action: 'button_clicked',
      component: 'analytics_dashboard',
    });
  };

  return (
    <div>
      <button onClick={handleUserAction}>Track Action</button>
      <button onClick={reconnect} disabled={isConnected}>
        Reconnect
      </button>
      {/* ... rest of component */}
    </div>
  );
}
```

### Polling Fallback

For environments where SSE is not supported:

```tsx
import { useRealtimeAnalyticsPolling } from '@/hooks/useRealtimeAnalytics';

function PollingAnalytics({ workspaceId }: { workspaceId: string }) {
  const { stats, error, trackEvent } = useRealtimeAnalyticsPolling(
    workspaceId,
    5000, // Poll every 5 seconds
  );

  // Same usage as SSE version
  // Note: No reconnect/disconnect methods
}
```

### Event Tracking

```tsx
function MessageComposer({ workspaceId }: { workspaceId: string }) {
  const { trackEvent } = useRealtimeAnalytics(workspaceId);

  const handleSendMessage = async (message: string) => {
    // Send message...

    // Track event
    await trackEvent('message.sent', {
      messageId: newMessage.id,
      channelId: channel.id,
      length: message.length,
    });
  };

  return <textarea onSubmit={handleSendMessage} />;
}
```

## Performance Considerations

### Server-Side

1. **Parallel Queries**: All database queries run in parallel
2. **Redis Caching**: Event counts cached in Redis for fast access
3. **Connection Limits**: Automatic cleanup of stale connections
4. **Query Optimization**: Indexed columns for fast lookups

### Client-Side

1. **Automatic Cleanup**: EventSource closed on unmount
2. **Memory Management**: No memory leaks from abandoned connections
3. **Exponential Backoff**: Prevents server overload during reconnects
4. **Debounced Updates**: Stats updates throttled to 5-second intervals

## Configuration

### Environment Variables

No additional environment variables required. Uses existing:
- Database connection (Prisma)
- Redis connection
- NextAuth session management

### Tunable Constants

In `route.ts`:

```typescript
const CONNECTION_CLEANUP_INTERVAL = 5 * 60 * 1000;  // 5 minutes
const HEARTBEAT_INTERVAL = 30 * 1000;               // 30 seconds
const STATS_UPDATE_INTERVAL = 5000;                 // 5 seconds
const MAX_CONNECTION_DURATION = 60 * 60 * 1000;     // 1 hour
```

## Security

1. **Authentication Required**: All endpoints require valid session
2. **Workspace Authorization**: Users must be workspace members
3. **Admin Operations**: DELETE endpoint requires admin access
4. **Connection Isolation**: Users only receive data for authorized workspaces
5. **Input Validation**: Event types and data validated on POST

## Monitoring

### Health Checks

Monitor active connection count:

```typescript
// GET /api/workspaces/:workspaceId/analytics/realtime (snapshot mode)
{
  "meta": {
    "connections": 5  // Total active SSE connections
  }
}
```

### Logging

Server logs include:
- Connection establishment/closure
- Error conditions
- Reconnection attempts
- Event tracking

## Troubleshooting

### Common Issues

**Connection Drops Frequently**

- Check network stability
- Verify reverse proxy SSE support
- Ensure `X-Accel-Buffering: no` header present
- Check server resource limits

**Stats Not Updating**

- Verify workspace ID is correct
- Check authentication status
- Inspect browser console for errors
- Verify database connectivity

**High Memory Usage**

- Check for connection leaks
- Monitor `activeConnections` map size
- Verify cleanup interval running
- Check EventSource cleanup on unmount

### Debug Mode

Enable debug logging:

```typescript
const { stats } = useRealtimeAnalytics(workspaceId, {
  onConnect: () => console.log('[Debug] Connected'),
  onDisconnect: () => console.log('[Debug] Disconnected'),
  onError: (err) => console.error('[Debug] Error:', err),
  onStatsUpdate: (stats) => console.log('[Debug] Stats:', stats),
});
```

## Future Enhancements

Potential improvements:

1. **WebSocket Support**: Add WebSocket as alternative to SSE
2. **Compression**: Compress stats payload for bandwidth efficiency
3. **Custom Metrics**: Allow configurable metrics selection
4. **Rate Limiting**: Implement connection-based rate limits
5. **Metric History**: Track stats over time for trends
6. **Alert Thresholds**: Server-side alerts for anomalies

## Related Documentation

- [Analytics Service](/packages/@neolith/core/src/services/analytics-service.ts)
- [Analytics Types](/packages/@neolith/core/src/types/analytics.ts)
- [Workspace API](/app/api/workspaces/[workspaceSlug]/route.ts)

## Support

For issues or questions:
- Check server logs for errors
- Inspect network tab for SSE connection status
- Verify workspace access permissions
- Review authentication status
