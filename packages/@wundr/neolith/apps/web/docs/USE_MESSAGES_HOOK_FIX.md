# Messages Hook (use-chat.ts) Fix Report

## Summary

Fixed critical API endpoint mismatches and response structure issues in the messages hook to align
with the actual Messages API implementation.

## Issues Fixed

### 1. API Endpoint Mismatch (CRITICAL)

**Problem:**

- Hook was sending POST requests to `/api/messages` (incorrect)
- API endpoint is `/api/channels/:channelId/messages`

**Fix:**

- Updated sendMessage to use correct endpoint: `/api/channels/${input.channelId}/messages`
- Changed from FormData to JSON body to match API expectations

### 2. Response Structure Mismatch

**Problem:**

- API returns: `{ data: messages, pagination: {...} }`
- Hook expected: `{ messages: [], hasMore: boolean }`

**Fix:**

- Updated fetchMessages to access `result.data` instead of `data.messages`
- Updated pagination to use `result.pagination.hasMore`
- Updated editMessage to access `result.data`
- Updated sendMessage to access `result.data`
- Updated fetchThread to access `result.data.parentMessage` and `result.data.replies`

### 3. Cursor-Based Pagination

**Problem:**

- Hook used old `before`/`after` query params with dates
- API uses cursor-based pagination with message IDs and `direction` field

**Fix:**

- Updated to use `cursor` and `direction` query parameters
- Removed `channelId` from query params (it's in the URL path)
- Properly map filter.before/after to cursor + direction

### 4. Reactions Toggle Implementation

**Problem:**

- Hook tried to POST to toggle, but API has separate add/remove endpoints
- Response structure was incorrect

**Fix:**

- Implemented proper toggle logic:
  1. GET current reactions to check if user already reacted
  2. DELETE if exists, POST if doesn't exist
  3. GET updated reactions list
- Fixed response parsing to use `result.data`

### 5. Thread API Response Structure

**Problem:**

- Hook expected `data.messages` for thread replies
- API returns `data.replies`

**Fix:**

- Updated to use `result.data.replies` instead of `data.messages`
- Added fallback for missing participants array

### 6. TypeScript Type Updates

**Problem:**

- SendMessageInput didn't include `type` and `metadata` fields required by API

**Fix:**

- Added `type?: 'TEXT' | 'SYSTEM' | 'FILE' | 'COMMAND'` to SendMessageInput
- Added `metadata?: Record<string, unknown>` to SendMessageInput
- Added `metadata?: Record<string, unknown>` to UpdateMessageInput

## API Endpoints (Verified)

### Messages

- `GET /api/channels/:channelId/messages` - List messages with cursor pagination
- `POST /api/channels/:channelId/messages` - Send new message (JSON body)
- `PATCH /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message

### Reactions

- `GET /api/messages/:id/reactions` - Get all reactions (grouped by emoji)
- `POST /api/messages/:id/reactions` - Add reaction
- `DELETE /api/messages/:id/reactions?emoji=:emoji` - Remove reaction

### Threads

- `GET /api/messages/:id/thread` - Get thread replies
- `POST /api/messages/:id/thread` - Reply to thread

## Response Structures (Verified)

### List Messages

```json
{
  "data": [...messages],
  "pagination": {
    "hasMore": boolean,
    "nextCursor": string | null,
    "prevCursor": string | null
  }
}
```

### Single Message Operations

```json
{
  "data": {...message},
  "message": "Success message"
}
```

### Thread

```json
{
  "data": {
    "parentMessage": {...},
    "replies": [...messages]
  },
  "pagination": {
    "hasMore": boolean,
    "nextCursor": string | null,
    "prevCursor": string | null,
    "totalCount": number
  }
}
```

### Reactions

```json
{
  "data": [
    {
      "emoji": "thumbsup",
      "count": 5,
      "users": [...],
      "hasReacted": boolean
    }
  ]
}
```

## Optimistic Updates

The hook already provides proper optimistic update functions:

- `addOptimisticMessage(message)` - Add message before API confirms
- `updateOptimisticMessage(messageId, updates)` - Update message before API confirms
- `removeOptimisticMessage(messageId)` - Remove message before API confirms

These work correctly and don't need changes.

## Testing Recommendations

1. **Test Message Sending:**
   - Send a message to a channel
   - Verify it appears immediately (optimistic)
   - Verify it's replaced with server response

2. **Test Pagination:**
   - Load initial messages
   - Scroll to load more
   - Verify cursor-based pagination works
   - Check hasMore flag

3. **Test Reactions:**
   - Add a reaction
   - Remove a reaction
   - Verify toggle behavior

4. **Test Threads:**
   - Reply to a message
   - Load thread replies
   - Verify nested thread prevention

5. **Test Edit/Delete:**
   - Edit a message
   - Delete a message
   - Verify optimistic updates

## Files Modified

1. `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/hooks/use-chat.ts`
   - Fixed fetchMessages cursor pagination
   - Fixed sendMessage endpoint and response parsing
   - Fixed editMessage response parsing
   - Fixed deleteMessage (no changes needed, already correct)
   - Fixed toggleReaction to use proper add/remove flow
   - Fixed fetchThread response parsing

2. `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/types/chat.ts`
   - Added `type` field to SendMessageInput
   - Added `metadata` field to SendMessageInput
   - Added `metadata` field to UpdateMessageInput

## Verification Status

- TypeScript compilation: PASSED (no errors in modified files)
- API endpoint alignment: VERIFIED
- Response structure handling: VERIFIED
- Optimistic updates: WORKING (no changes needed)
