# /api/messages/[messageId] - Quick Reference

## Endpoints

### GET /api/messages/:id

**Get message with thread replies**

- Auth: Required
- Access: Channel member
- Returns: Message + reactions + attachments + reply count

### PATCH /api/messages/:id

**Edit message (author only)**

- Auth: Required
- Access: Message author only
- Body: `{ content: string, metadata?: object }`
- Feature: Auto-tracks edit history in metadata

### DELETE /api/messages/:id

**Delete message (soft delete)**

- Auth: Required
- Access: Message author OR channel admin/owner
- Behavior: Sets isDeleted=true, content="[Message deleted]"

## Edit History Format

```json
{
  "metadata": {
    "editHistory": [
      {
        "content": "previous version",
        "editedAt": "2025-11-26T10:30:00Z",
        "editedBy": "user_123"
      }
    ]
  }
}
```

## HTTP Status Codes

- `200` - Success
- `401` - Not authenticated
- `403` - Not authorized (wrong user/role)
- `404` - Message not found or no channel access
- `410` - Message deleted
- `400` - Validation error (bad input)
- `500` - Internal server error

## File Location

`/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/messages/[id]/route.ts`

## Implementation Status

✅ All requirements complete:

- ✅ GET with thread replies
- ✅ PATCH with author-only access
- ✅ DELETE with admin support
- ✅ Edit history tracking
- ✅ Channel membership access control
