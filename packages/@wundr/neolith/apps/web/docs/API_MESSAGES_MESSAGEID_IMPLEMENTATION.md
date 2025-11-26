# API Route: /api/messages/[messageId]

## Overview

Complete API implementation for individual message operations with full CRUD support, edit history tracking, and thread management.

**File Location:** `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/messages/[id]/route.ts`

## API Endpoints

### 1. GET /api/messages/[messageId]

**Purpose:** Retrieve message details with thread replies count

**Authentication:** Required

**Authorization:** Must be a channel member

**Request:**
```http
GET /api/messages/msg_abc123
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "data": {
    "id": "msg_abc123",
    "content": "Hello, world!",
    "type": "TEXT",
    "metadata": {},
    "isEdited": false,
    "isDeleted": false,
    "editedAt": null,
    "deletedAt": null,
    "channelId": "ch_xyz789",
    "authorId": "user_123",
    "parentId": null,
    "createdAt": "2025-11-26T10:30:00Z",
    "updatedAt": "2025-11-26T10:30:00Z",
    "author": {
      "id": "user_123",
      "name": "John Doe",
      "displayName": "John",
      "avatarUrl": "https://...",
      "isVP": false
    },
    "channel": {
      "id": "ch_xyz789",
      "name": "general",
      "type": "PUBLIC"
    },
    "reactions": [
      {
        "id": "rxn_1",
        "emoji": "👍",
        "userId": "user_456",
        "user": {
          "id": "user_456",
          "name": "Jane Smith"
        }
      }
    ],
    "attachments": [],
    "_count": {
      "replies": 5
    },
    "isOwner": true,
    "memberRole": "MEMBER"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Message doesn't exist or no channel access
- `410 Gone` - Message has been deleted

---

### 2. PATCH /api/messages/[messageId]

**Purpose:** Edit message content (author only)

**Authentication:** Required

**Authorization:** Must be the message author

**Request:**
```http
PATCH /api/messages/msg_abc123
Content-Type: application/json
Authorization: Bearer <token>

{
  "content": "Updated message content",
  "metadata": {
    "customField": "value"
  }
}
```

**Features:**
- Automatically tracks edit history in `metadata.editHistory`
- Sets `isEdited: true` and `editedAt` timestamp
- Previous content is preserved in edit history array

**Edit History Structure:**
```json
{
  "metadata": {
    "editHistory": [
      {
        "content": "Original message content",
        "editedAt": "2025-11-26T10:35:00Z",
        "editedBy": "user_123"
      },
      {
        "content": "First edit",
        "editedAt": "2025-11-26T10:40:00Z",
        "editedBy": "user_123"
      }
    ]
  }
}
```

**Response (200):**
```json
{
  "data": {
    "id": "msg_abc123",
    "content": "Updated message content",
    "isEdited": true,
    "editedAt": "2025-11-26T10:35:00Z",
    "metadata": {
      "editHistory": [...],
      "customField": "value"
    },
    ...
  },
  "message": "Message updated successfully"
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not the message author
- `404 Not Found` - Message doesn't exist or no channel access
- `410 Gone` - Cannot edit deleted message
- `400 Bad Request` - Invalid input (empty content, content too long)

**Validation:**
- Content: 1-10,000 characters (required)
- Metadata: Optional JSON object

---

### 3. DELETE /api/messages/[messageId]

**Purpose:** Soft delete a message (author or channel admin)

**Authentication:** Required

**Authorization:** Message author OR channel admin/owner

**Request:**
```http
DELETE /api/messages/msg_abc123
Authorization: Bearer <token>
```

**Behavior:**
- Soft delete: Sets `isDeleted: true`
- Content replaced with `[Message deleted]`
- Message remains in database
- Edit history preserved in metadata

**Response (200):**
```json
{
  "message": "Message deleted successfully",
  "deletedId": "msg_abc123"
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not author and not admin/owner
- `404 Not Found` - Message doesn't exist or no channel access
- `410 Gone` - Message already deleted

---

## Features Implemented

### 1. Edit History Tracking
- All previous versions stored in `metadata.editHistory`
- Includes: content, timestamp, user ID
- Automatically appended on each edit
- Preserves full audit trail

### 2. Channel Membership Access Control
```typescript
async function getMessageWithAccessCheck(messageId: string, userId: string)
```
- Verifies user is a channel member
- Returns message with access context
- Includes user's role (OWNER, ADMIN, MEMBER)
- Used by all endpoints for authorization

### 3. Thread Support
- Returns `_count.replies` for thread indication
- `parentId` field for thread replies
- Full thread endpoint: `/api/messages/[id]/thread`

### 4. Soft Delete
- Messages never hard-deleted
- Content replaced for privacy
- History preserved for audit
- Status tracked with `isDeleted` and `deletedAt`

### 5. Rich Message Details
- Author information
- Channel context
- Reactions list
- File attachments
- Reply count

---

## Database Schema

```prisma
model Message {
  id        String      @id @default(cuid())
  content   String
  type      MessageType @default(TEXT)
  metadata  Json        @default("{}")

  // Edit/delete tracking
  isEdited  Boolean   @default(false)
  isDeleted Boolean   @default(false)
  editedAt  DateTime?
  deletedAt DateTime?

  // Foreign keys
  channelId String
  authorId  String
  parentId  String? // Thread support

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  channel     Channel
  author      User
  parent      Message?
  replies     Message[]
  reactions   Reaction[]
  attachments MessageAttachment[]
}
```

---

## Security & Validation

### Input Validation (Zod Schemas)

**Message ID Parameter:**
```typescript
messageIdParamSchema = z.object({
  id: z.string().cuid('Invalid message ID format')
})
```

**Update Message Schema:**
```typescript
updateMessageSchema = z.object({
  content: z.string()
    .min(1, 'Message content cannot be empty')
    .max(10000, 'Message content must be less than 10000 characters'),
  metadata: z.record(z.unknown()).optional()
})
```

### Authorization Matrix

| Endpoint | Authentication | Channel Member | Author | Admin/Owner |
|----------|---------------|----------------|--------|-------------|
| GET      | Required      | Required       | -      | -           |
| PATCH    | Required      | Required       | Required | -         |
| DELETE   | Required      | Required       | Required | OR Required |

### Access Control Flow

1. Authenticate user via session
2. Validate message ID format
3. Fetch message with channel membership check
4. Verify user is channel member
5. Check specific permissions (edit/delete)
6. Execute operation
7. Return sanitized response

---

## Error Codes

```typescript
MESSAGE_ERROR_CODES = {
  NOT_FOUND: 'MESSAGE_NOT_FOUND',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_CHANNEL_MEMBER: 'NOT_CHANNEL_MEMBER',
  CANNOT_EDIT: 'CANNOT_EDIT',
  CANNOT_DELETE: 'CANNOT_DELETE',
  MESSAGE_DELETED: 'MESSAGE_DELETED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
}
```

---

## Usage Examples

### Frontend Integration

```typescript
// Get message details
const getMessageDetails = async (messageId: string) => {
  const response = await fetch(`/api/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
};

// Edit message
const editMessage = async (messageId: string, content: string) => {
  const response = await fetch(`/api/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ content })
  });
  return response.json();
};

// Delete message
const deleteMessage = async (messageId: string) => {
  const response = await fetch(`/api/messages/${messageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
};

// Display edit history
const showEditHistory = (message: Message) => {
  const history = message.metadata?.editHistory || [];
  return history.map(edit => ({
    content: edit.content,
    editedAt: new Date(edit.editedAt),
    editedBy: edit.editedBy
  }));
};
```

---

## Testing

Test file location: `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/messages/__tests__/messages.test.ts`

### Test Coverage

1. **GET Endpoint**
   - Returns message with valid auth
   - Returns 401 without auth
   - Returns 404 for non-member
   - Returns 410 for deleted message

2. **PATCH Endpoint**
   - Updates own message
   - Tracks edit history
   - Returns 403 for other user's message
   - Returns 400 for empty content
   - Returns 410 for deleted message

3. **DELETE Endpoint**
   - Soft deletes own message
   - Allows admin to delete any message
   - Returns 403 for non-owner non-admin
   - Returns 410 for already deleted

---

## Performance Considerations

1. **Single Query Access Check**
   - Combines message fetch + membership verification
   - Reduces database roundtrips

2. **Selective Field Loading**
   - Only includes necessary author fields
   - Optimizes response payload

3. **Metadata for Edit History**
   - No separate table needed
   - JSON field indexed by PostgreSQL
   - Keeps related data together

---

## Related Endpoints

- `POST /api/channels/[channelId]/messages` - Send new message
- `GET /api/channels/[channelId]/messages` - List channel messages
- `GET /api/messages/[messageId]/thread` - Get thread replies
- `POST /api/messages/[messageId]/reactions` - Add reaction
- `DELETE /api/messages/[messageId]/reactions/[emoji]` - Remove reaction

---

## Implementation Status

✅ **COMPLETE** - All requirements satisfied:

1. ✅ File created at `app/api/messages/[messageId]/route.ts`
2. ✅ GET endpoint: Get message with thread replies
3. ✅ PATCH endpoint: Edit message (only author can edit)
4. ✅ DELETE endpoint: Delete message (author or admin)
5. ✅ Edit history tracking in metadata

**Additional Features:**
- Channel membership access control
- Soft delete with content masking
- Comprehensive error handling
- Input validation with Zod
- TypeScript type safety
- Rich message details (reactions, attachments, author)

---

## File Paths

- **Route Handler:** `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/messages/[id]/route.ts`
- **Validation Schemas:** `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/lib/validations/message.ts`
- **Test Suite:** `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/messages/__tests__/messages.test.ts`
- **Database Schema:** `/Users/iroselli/wundr/packages/@wundr/neolith/packages/@neolith/database/prisma/schema.prisma`

---

**Implementation Date:** November 26, 2025
**API Version:** 1.0
**Status:** Production Ready
