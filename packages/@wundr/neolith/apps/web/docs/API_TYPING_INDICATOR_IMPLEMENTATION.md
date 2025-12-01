# Typing Indicator API Implementation

## Overview

The typing indicator API endpoint has been successfully implemented at:

```
/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/channels/[channelId]/typing/route.ts
```

## Endpoints

### POST `/api/channels/:channelId/typing`

Send a typing indicator signal for a channel.

**Request:**

```json
{
  "isTyping": true // optional, defaults to true
}
```

**Response:**

```json
{
  "data": {
    "channelId": "ch_123abc",
    "typingUsers": [
      {
        "userId": "user_456def",
        "userName": "John Doe"
      }
    ],
    "isTyping": true
  }
}
```

**Features:**

- Validates user authentication
- Checks channel membership
- Stores typing state with 5-second TTL
- Returns list of other typing users (excludes current user)
- Auto-expires after 5 seconds

### GET `/api/channels/:channelId/typing`

Get currently typing users in a channel.

**Response:**

```json
{
  "data": {
    "channelId": "ch_123abc",
    "typingUsers": [
      {
        "userId": "user_456def",
        "userName": "John Doe"
      }
    ]
  }
}
```

**Features:**

- Returns currently typing users
- Automatically cleans up expired typing indicators
- Excludes the requesting user from the list

## Implementation Details

### Storage Strategy

**In-Memory Store (Development):**

```typescript
const typingStore = new Map<
  string,
  Map<string, { userId: string; userName: string; expiresAt: number }>
>();
```

**TTL Configuration:**

```typescript
const TYPING_TTL_MS = 5000; // 5 seconds
```

### Production Considerations

For production deployments, the in-memory store should be replaced with:

- **Redis** (recommended) - Fast, distributed, built-in TTL support
- **Memcached** - Alternative distributed cache
- **Any key-value store with TTL support**

Example Redis migration:

```typescript
// Store typing indicator
await redis.setex(
  `typing:${channelId}:${userId}`,
  5, // TTL in seconds
  JSON.stringify({ userId, userName })
);

// Get typing users
const keys = await redis.keys(`typing:${channelId}:*`);
const typingUsers = await Promise.all(keys.map(key => redis.get(key)));
```

### Security Features

1. **Authentication Required** - All requests must be authenticated
2. **Channel Membership Verification** - Users must be channel members
3. **Input Validation** - Zod schema validation for all inputs
4. **Error Handling** - Comprehensive error responses

### Error Codes

| Code                 | Description                  |
| -------------------- | ---------------------------- |
| `UNAUTHORIZED`       | User not authenticated       |
| `VALIDATION_ERROR`   | Invalid request data         |
| `NOT_CHANNEL_MEMBER` | User not a member of channel |
| `INTERNAL_ERROR`     | Server error                 |

## Validation Schemas

### Typing Indicator Schema

```typescript
export const typingIndicatorSchema = z.object({
  isTyping: z.boolean().optional().default(true),
});
```

### Channel ID Parameter Schema

```typescript
export const channelIdParamSchema = z.object({
  channelId: z.string().cuid('Invalid channel ID format'),
});
```

## Usage Examples

### Client-Side Implementation

**Start Typing:**

```typescript
const sendTypingIndicator = async (channelId: string, isTyping: boolean) => {
  const response = await fetch(`/api/channels/${channelId}/typing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isTyping }),
  });
  return response.json();
};

// User starts typing
await sendTypingIndicator('ch_123', true);
```

**Stop Typing:**

```typescript
// User stops typing
await sendTypingIndicator('ch_123', false);
```

**Periodic Updates:**

```typescript
let typingInterval: NodeJS.Timeout | null = null;

const startTyping = (channelId: string) => {
  // Send initial typing indicator
  sendTypingIndicator(channelId, true);

  // Send periodic updates every 3 seconds (before 5s TTL)
  typingInterval = setInterval(() => {
    sendTypingIndicator(channelId, true);
  }, 3000);
};

const stopTyping = (channelId: string) => {
  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }
  sendTypingIndicator(channelId, false);
};
```

**Get Typing Users:**

```typescript
const getTypingUsers = async (channelId: string) => {
  const response = await fetch(`/api/channels/${channelId}/typing`);
  return response.json();
};

// Poll for typing users
const pollTypingUsers = (channelId: string) => {
  setInterval(async () => {
    const { data } = await getTypingUsers(channelId);
    console.log('Currently typing:', data.typingUsers);
  }, 2000);
};
```

## Build Verification

The API has been verified to:

- ✅ Compile successfully with TypeScript
- ✅ Pass Next.js build process
- ✅ Follow project validation patterns
- ✅ Implement proper error handling
- ✅ Use correct authentication middleware

**Build Command:**

```bash
cd /Users/iroselli/wundr/packages/@wundr/neolith/apps/web
npm run build
```

**Build Result:** ✅ SUCCESS

## File Structure

```
apps/web/
├── app/
│   └── api/
│       └── channels/
│           └── [channelId]/
│               └── typing/
│                   └── route.ts          # Main implementation
├── lib/
│   └── validations/
│       └── message.ts                    # Validation schemas
└── docs/
    └── API_TYPING_INDICATOR_IMPLEMENTATION.md  # This file
```

## Next Steps

### Recommended Enhancements

1. **WebSocket Integration**
   - Real-time typing indicator broadcasts
   - Eliminate polling overhead
   - Instant updates for all channel members

2. **Production Storage**
   - Migrate to Redis/Memcached
   - Add connection pooling
   - Implement cluster support

3. **Rate Limiting**
   - Prevent typing indicator spam
   - Limit to 1 request per second per user
   - Add backoff for excessive requests

4. **Monitoring**
   - Track typing indicator usage
   - Monitor memory consumption
   - Alert on storage issues

5. **Testing**
   - Add unit tests for cleanup logic
   - Add integration tests for API endpoints
   - Add E2E tests for client behavior

## Related Files

- `/app/api/channels/[channelId]/messages/route.ts` - Message sending API
- `/app/api/presence/route.ts` - User presence API
- `/lib/validations/message.ts` - Validation schemas
- `/lib/auth.ts` - Authentication middleware

## Verification Checklist

- [x] POST endpoint implemented
- [x] GET endpoint implemented
- [x] 5-second TTL configured
- [x] In-memory storage with cleanup
- [x] Authentication required
- [x] Channel membership validation
- [x] Input validation with Zod
- [x] Error handling
- [x] TypeScript compilation
- [x] Build verification
- [x] Documentation created
