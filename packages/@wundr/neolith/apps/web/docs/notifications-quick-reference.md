# Notifications API Quick Reference

## Import the Service

```typescript
import { NotificationService } from '@/lib/services/notification-service';
```

## Common Use Cases

### 1. Notify User About a Message

```typescript
await NotificationService.notifyNewMessage(
  userId,
  messageId,
  channelId,
  authorName,
  messagePreview
);
```

### 2. Notify User They Were Mentioned

```typescript
await NotificationService.notifyMention(
  userId,
  messageId,
  channelId,
  mentionedBy,
  messagePreview
);
```

### 3. Notify User About Thread Reply

```typescript
await NotificationService.notifyThreadReply(
  userId,
  replyMessageId,
  parentMessageId,
  channelId,
  authorName,
  replyPreview
);
```

### 4. Notify User About Task Assignment

```typescript
await NotificationService.notifyTaskAssigned(
  userId,
  taskId,
  taskTitle,
  assignedByName
);
```

### 5. Notify User About Task Completion

```typescript
await NotificationService.notifyTaskCompleted(
  userId,
  taskId,
  taskTitle,
  completedByName
);
```

### 6. Notify User About Workflow Status

```typescript
await NotificationService.notifyWorkflowCompleted(
  userId,
  workflowId,
  workflowName,
  success // true or false
);
```

### 7. Notify User About Channel Invite

```typescript
await NotificationService.notifyChannelInvite(
  userId,
  channelId,
  channelName,
  invitedBy
);
```

### 8. Notify Multiple Users About New Member

```typescript
await NotificationService.notifyMemberJoined(
  [userId1, userId2, userId3],
  newMemberName,
  organizationId
);
```

### 9. Custom System Notification

```typescript
await NotificationService.notifySystem(
  userId,
  'System Alert',
  'Your export is ready for download',
  'HIGH',
  '/exports/download/123'
);
```

### 10. Create Custom Notification

```typescript
await NotificationService.createNotification({
  userId: 'user-123',
  type: 'SYSTEM',
  title: 'Custom Notification',
  body: 'Something happened',
  priority: 'NORMAL',
  resourceId: 'resource-456',
  resourceType: 'custom',
  actionUrl: '/custom/resource/456',
  metadata: { custom: 'data' },
  sendPush: true,
  sendEmail: false,
});
```

## REST API Endpoints

### Get All Notifications
```bash
GET /api/notifications?page=1&limit=20&read=false&type=MESSAGE
```

### Get Unread Count
```bash
GET /api/notifications/count?breakdown=true
```

### Get Single Notification
```bash
GET /api/notifications/[id]
```

### Mark as Read
```bash
PATCH /api/notifications/[id]
Content-Type: application/json

{
  "read": true
}
```

### Mark All as Read
```bash
POST /api/notifications/read-all
Content-Type: application/json

{
  "type": "MESSAGE"  // optional filter
}
```

### Delete Notification
```bash
DELETE /api/notifications/[id]
```

### Bulk Mark as Read
```bash
PATCH /api/notifications
Content-Type: application/json

{
  "ids": ["clx1", "clx2", "clx3"]
}
```

### Bulk Delete
```bash
DELETE /api/notifications
Content-Type: application/json

{
  "ids": ["clx1", "clx2", "clx3"]
}
```

## Notification Types

```typescript
type NotificationType =
  | 'MESSAGE'           // New message in channel
  | 'MENTION'           // User was mentioned
  | 'THREAD_REPLY'      // Reply to thread
  | 'CALL'              // Incoming call
  | 'CHANNEL_INVITE'    // Channel invitation
  | 'ORGANIZATION_UPDATE' // Org-level update
  | 'SYSTEM';           // System notification
```

## Priority Levels

```typescript
type NotificationPriority =
  | 'LOW'     // Gray badge, no sound
  | 'NORMAL'  // Default behavior
  | 'HIGH'    // Red badge, sound
  | 'URGENT'; // Full screen, sound
```

## Utility Methods

### Get Unread Count
```typescript
const count = await NotificationService.getUnreadCount(userId);
```

### Mark Notification as Read
```typescript
await NotificationService.markAsRead(notificationId, userId);
```

### Mark All as Read
```typescript
const count = await NotificationService.markAllAsRead(userId);
```

### Delete Notification
```typescript
await NotificationService.deleteNotification(notificationId, userId);
```

## Cleanup Jobs (Cron)

### Delete Expired Notifications
```typescript
// Run daily
const deletedCount = await NotificationService.deleteExpiredNotifications();
console.log(`Deleted ${deletedCount} expired notifications`);
```

### Archive Old Notifications
```typescript
// Run weekly
const archivedCount = await NotificationService.archiveOldNotifications(30);
console.log(`Archived ${archivedCount} old notifications`);
```

## Example: Complete Message Flow

```typescript
// 1. Create message
const message = await prisma.message.create({
  data: {
    content: 'Hey @john, check this out!',
    channelId: 'channel-123',
    authorId: 'user-456',
  },
});

// 2. Get channel members
const members = await prisma.channelMember.findMany({
  where: { channelId: message.channelId },
  include: { user: true },
});

// 3. Extract mentions
const mentions = extractMentions(message.content); // ['@john']
const mentionedUserIds = await getUserIdsByUsername(mentions);

// 4. Notify mentioned users (HIGH priority)
for (const userId of mentionedUserIds) {
  await NotificationService.notifyMention(
    userId,
    message.id,
    message.channelId,
    authorUser.name,
    message.content.substring(0, 100)
  );
}

// 5. Notify other channel members (NORMAL priority)
for (const member of members) {
  if (
    member.userId !== message.authorId &&
    !mentionedUserIds.includes(member.userId)
  ) {
    await NotificationService.notifyNewMessage(
      member.userId,
      message.id,
      message.channelId,
      authorUser.name,
      message.content.substring(0, 100)
    );
  }
}
```

## Best Practices

1. **Always specify actionUrl** - Makes notifications actionable
2. **Include metadata** - Store context for analytics and debugging
3. **Use appropriate priority** - Don't abuse HIGH/URGENT
4. **Truncate body text** - Keep under 200 characters
5. **Set expiration** - For time-sensitive notifications
6. **Batch bulk operations** - Use `createBulkNotifications` for multiple users
7. **Handle errors gracefully** - Notification failures shouldn't break core flows

## Error Handling

```typescript
try {
  await NotificationService.createNotification({
    userId: 'user-123',
    type: 'MESSAGE',
    title: 'New message',
    body: 'You have a new message',
  });
} catch (error) {
  console.error('Failed to create notification:', error);
  // Continue with core flow - notifications are non-critical
}
```

## TypeScript Types

```typescript
import type {
  NotificationType,
  NotificationPriority,
  notification as Notification,
} from '@prisma/client';

import type {
  CreateNotificationOptions,
  BulkCreateNotificationOptions,
} from '@/lib/services/notification-service';
```

## Files Reference

- **Service**: `/lib/services/notification-service.ts`
- **Validation**: `/lib/validations/notification.ts`
- **API Routes**: `/app/api/notifications/**/*.ts`
- **Prisma Schema**: `/packages/@neolith/database/prisma/schema.prisma`
- **Tests**: `/app/api/notifications/__tests__/notifications.test.ts`
