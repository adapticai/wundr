# Notification Preferences API Reference

## Base URL

All endpoints are relative to: `/api/notifications`

## Authentication

All endpoints require authentication via NextAuth session.

---

## Settings Management

### Get Notification Settings

Retrieve complete notification preferences for the authenticated user.

**Endpoint:** `GET /api/notifications/settings`

**Response:**

```json
{
  "enabled": true,
  "sound": true,
  "desktop": true,
  "mobile": true,
  "email": false,
  "digestFrequency": "instant",
  "quietHours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00"
  },
  "mutedChannels": [],
  "preferences": {
    "message": { "enabled": true, "sound": true, "desktop": true },
    "mention": { "enabled": true, "sound": true, "desktop": true },
    "reaction": { "enabled": true, "sound": false, "desktop": false },
    "thread_reply": { "enabled": true, "sound": true, "desktop": true },
    "channel_invite": { "enabled": true, "sound": true, "desktop": true },
    "call_incoming": { "enabled": true, "sound": true, "desktop": true },
    "call_missed": { "enabled": true, "sound": false, "desktop": true },
    "orchestrator_update": { "enabled": true, "sound": false, "desktop": true },
    "system": { "enabled": true, "sound": false, "desktop": true }
  }
}
```

---

### Update Notification Settings

Update notification preferences (partial updates supported).

**Endpoint:** `PUT /api/notifications/settings`

**Request Body:**

```json
{
  "enabled": true,
  "digestFrequency": "daily",
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  },
  "preferences": {
    "mention": {
      "enabled": true,
      "sound": true,
      "desktop": true
    },
    "orchestrator_update": {
      "enabled": true,
      "sound": false,
      "desktop": true
    }
  }
}
```

**Response:** Same structure as GET response with updated values.

**Validation Rules:**

- `enabled`, `sound`, `desktop`, `mobile`, `email`: boolean
- `digestFrequency`: "instant" | "hourly" | "daily" | "weekly" | "never"
- `quietHours.start/end`: HH:mm format (24-hour)
- `mutedChannels`: array of strings
- `preferences`: per-notification-type settings

---

## Testing

### Send Test Notification

Send a test notification across all enabled channels.

**Endpoint:** `POST /api/notifications/test`

**Response:**

```json
{
  "success": true,
  "message": "Test notification sent",
  "channels": ["in-app", "desktop", "email"]
}
```

The test notification:

- Creates a real notification in the database
- Attempts delivery via all enabled channels
- Returns list of channels used
- Respects quiet hours and muted channels

---

## Push Notifications

### Get VAPID Public Key

Get the server's VAPID public key for push notification subscriptions.

**Endpoint:** `GET /api/notifications/vapid-key`

**Response:**

```json
{
  "publicKey": "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFg..."
}
```

**Usage:** Use this key when calling `pushManager.subscribe()` in the browser.

---

### Subscribe to Push Notifications

Subscribe the current device to push notifications.

**Endpoint:** `POST /api/notifications/subscribe`

**Request Body:**

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
    "auth": "tBHItJI5svbpez7KI4CCXg=="
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Push subscription saved"
}
```

---

### Unsubscribe from Push Notifications

Remove push notification subscription for the current device.

**Endpoint:** `POST /api/notifications/unsubscribe`

**Request Body:**

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

**Response:**

```json
{
  "success": true,
  "message": "Push subscription removed"
}
```

---

## Notification Types

All notification types support individual configuration:

| Type                  | Label                | Description                            |
| --------------------- | -------------------- | -------------------------------------- |
| `message`             | Direct Messages      | New messages in direct conversations   |
| `mention`             | Mentions             | When someone mentions you in a message |
| `reaction`            | Reactions            | When someone reacts to your message    |
| `thread_reply`        | Thread Replies       | New replies to threads you are in      |
| `channel_invite`      | Channel Invites      | Invitations to join channels           |
| `call_incoming`       | Incoming Calls       | When someone calls you                 |
| `call_missed`         | Missed Calls         | Notifications about missed calls       |
| `orchestrator_update` | Orchestrator Updates | Updates from your Orchestrators        |
| `system`              | System Notifications | Important system announcements         |

Each type has three toggles:

- `enabled`: Receive this type of notification
- `sound`: Play sound for this notification type
- `desktop`: Show desktop popup for this notification type

---

## Digest Frequency Options

| Value     | Description                          |
| --------- | ------------------------------------ |
| `instant` | Send notifications immediately       |
| `hourly`  | Bundle notifications every hour      |
| `daily`   | Send daily digest at configured time |
| `weekly`  | Send weekly digest on configured day |
| `never`   | Don't send email notifications       |

---

## Error Responses

All endpoints use standardized error format:

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "errors": {
      "digestFrequency": "Digest frequency must be one of: instant, hourly, daily, weekly, never",
      "quietHours.start": "Quiet hours start must be in HH:mm format"
    }
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401): Authentication required
- `NOT_FOUND` (404): User not found
- `VALIDATION_ERROR` (400): Invalid request data
- `CONFIGURATION_ERROR` (503): Server configuration issue
- `INTERNAL_ERROR` (500): Unexpected server error

---

## Integration Examples

### React Hook Usage

```typescript
import { useNotificationSettings } from '@/hooks/use-notifications';

function NotificationSettings() {
  const { settings, updateSettings, isLoading } = useNotificationSettings();

  const handleEnableDesktop = async () => {
    await updateSettings({ desktop: true });
  };

  const handleSetQuietHours = async () => {
    await updateSettings({
      quietHours: {
        enabled: true,
        start: "22:00",
        end: "08:00"
      }
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={handleEnableDesktop}>
        Enable Desktop Notifications
      </button>
      <button onClick={handleSetQuietHours}>
        Set Quiet Hours
      </button>
    </div>
  );
}
```

### Push Subscription Example

```typescript
import { usePushNotifications } from '@/hooks/use-notifications';

function PushNotificationToggle() {
  const {
    isSupported,
    isEnabled,
    requestPermission,
    subscribeToPush
  } = usePushNotifications();

  const handleEnable = async () => {
    if (isSupported && !isEnabled) {
      const granted = await requestPermission();
      if (granted) {
        await subscribeToPush();
      }
    }
  };

  return (
    <button onClick={handleEnable} disabled={!isSupported || isEnabled}>
      {isEnabled ? 'Push Notifications Enabled' : 'Enable Push Notifications'}
    </button>
  );
}
```

---

## Database Storage

All notification preferences are stored in the `user.preferences` JSON field:

```typescript
{
  notificationSettings: NotificationSettings,
  pushSubscriptions: PushSubscription[],
  emailPreferences: EmailPreferences
}
```

This allows for:

- Schema flexibility
- Easy versioning
- Backward compatibility
- No additional database migrations
